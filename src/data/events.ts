// Leagues and events: which leagues the site follows, and the status of an event.

import { fetchLeagues, fetchTournaments, type RawLeague } from '../api'
import { slugify } from '../format'
import type { Event, League, Match } from './types'

// LOLTV only follows tier 1: Riot's international events plus the six major regions.
// Everything else the API carries (ERLs, Challengers, promotion tournaments, off-season cups,
// national-team events) is left out on purpose. Add a league slug here to follow it.
const TIER1 = new Set(['worlds', 'msi', 'first_stand']) // featured on the homepage
export const CROSS_REGION = new Set([...TIER1, 'ewc_lol', 'americas_cup'])
const REGIONS = new Set(['lck', 'lpl', 'lec', 'lcs', 'cblol-brazil', 'lcp'])
const FOLLOWED = new Set([...CROSS_REGION, ...REGIONS])

function toLeague(raw: RawLeague): League {
    const tier = TIER1.has(raw.slug) ? 1 : CROSS_REGION.has(raw.slug) ? 2 : 3

    return { id: raw.id, slug: raw.slug, name: raw.name, region: raw.region, image: raw.image, tier }
}

// "lcs_split_3_2026" + league "LCS" -> "LCS Split 3 2026"
function eventName(tournamentSlug: string, league: League): string {
    const leaguePrefix = league.slug.replace(/-/g, '_') + '_'

    if (tournamentSlug.startsWith(leaguePrefix)) {
        return `${league.name} ${titleCase(tournamentSlug.slice(leaguePrefix.length))}`
    }

    const known = new Map(league.name.split(/\s+/).map((w) => [w.toLowerCase(), w] as const))

    return titleCase(tournamentSlug, known)
}

function titleCase(slug: string, known = new Map<string, string>()): string {
    return slug
        .split(/[_-]+/)
        .filter(Boolean)
        .map((w) => known.get(w) ?? w[0]!.toUpperCase() + w.slice(1))
        .join(' ')
}

export async function getLeagues(): Promise<League[]> {
    const raw = await fetchLeagues()

    return raw.filter((l) => FOLLOWED.has(l.slug)).map(toLeague)
}

export async function getEvents(): Promise<Event[]> {
    const leagues = await getLeagues()
    const perLeague = await fetchTournaments(leagues.map((l) => l.id))
    const events: Event[] = []
    leagues.forEach((league, i) => {
        for (const t of perLeague[i] ?? []) {
            events.push({
                id: t.id,
                slug: slugify(t.slug),
                name: eventName(t.slug, league),
                league,
                startDate: t.startDate,
                endDate: t.endDate,
            })
        }
    })

    return events
}

export async function getEvent(id: string): Promise<Event | null> {
    return (await getEvents()).find((e) => e.id === id) ?? null
}

export function eventFor(events: Event[], leagueSlug: string, start: string): Event | null {
    const day = start.slice(0, 10)

    return (
        events.find(
            (e) =>
                e.league.slug === leagueSlug &&
                shiftDay(e.startDate, -1) <= day &&
                day <= shiftDay(e.endDate, 1),
        ) ?? null
    )
}

export function shiftDay(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400e3).toISOString().slice(0, 10)
}

// By the calendar, unless the event's own matches say it's over sooner: the API's end date is
// often the day after the final. The schedule has to reach the end date for that, so a split
// whose playoffs aren't scheduled yet stays ongoing.
export function eventStatus(
    e: Event,
    now = new Date(),
    matches: Match[] = [],
): 'ongoing' | 'upcoming' | 'finished' {
    const today = now.toISOString().slice(0, 10)

    if (today < e.startDate) return 'upcoming'

    if (today > e.endDate) return 'finished'

    const lastDay = matches.reduce((max, m) => (m.start > max ? m.start : max), '').slice(0, 10)

    if (lastDay >= shiftDay(e.endDate, -2) && matches.every((m) => m.state === 'completed')) {
        return 'finished'
    }

    return 'ongoing'
}

// Ongoing first, then upcoming; within each, by tier then start date.
export function activeEvents(events: Event[], now = new Date()): Event[] {
    const rank = { ongoing: 0, upcoming: 1, finished: 2 }

    return events
        .filter((e) => eventStatus(e, now) !== 'finished')
        .sort(
            (a, b) =>
                rank[eventStatus(a, now)] - rank[eventStatus(b, now)] ||
                a.league.tier - b.league.tier ||
                a.startDate.localeCompare(b.startDate),
        )
}

// A major about to start takes over the homepage this many days ahead. Before that, the
// leagues still playing matter more than its empty schedule.
const FEATURE_AHEAD_DAYS = 14

// The event that gets the banner on the homepage — HLTV does this for majors. By the calendar:
// a major that is on, or the next one once it's close.
export function featuredEvent(events: Event[], now = new Date()): Event | null {
    const tier1 = events.filter((e) => e.league.tier === 1)
    const ongoing = tier1.find((e) => eventStatus(e, now) === 'ongoing')

    if (ongoing) return ongoing
    const horizon = shiftDay(now.toISOString().slice(0, 10), FEATURE_AHEAD_DAYS)

    return (
        tier1
            .filter((e) => eventStatus(e, now) === 'upcoming' && e.startDate <= horizon)
            .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
    )
}
