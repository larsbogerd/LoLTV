// Matches from the schedule, and the URLs of matches, events and teams.

import { fetchSchedule, type RawScheduleEvent, type RawTeam } from '../api'
import { slugify } from '../format'
import { CROSS_REGION, eventFor, getEvents, getLeagues, shiftDay } from './events'
import { getRanking } from './ranking'
import type { Event, League, Match, Team } from './types'

export function toTeam(raw: RawTeam | undefined): Team {
    if (!raw || raw.name === 'TBD' || raw.code === 'TBD') {
        return { name: 'TBD', code: 'TBD', image: null, score: null, won: null, tbd: true }
    }

    const outcome = raw.result?.outcome

    return {
        id: raw.id,
        name: raw.name,
        code: raw.code,
        image: raw.image || null,
        score: raw.result?.gameWins ?? null,
        won: outcome === 'win' ? true : outcome === 'loss' ? false : null,
        tbd: false,
    }
}

// Schedule entries only carry league name + slug; logos and events come from these lookups.
// Schedule teams have no id either. Ids (for team links) and home leagues (for tags) come
// from the power ranking, keyed by team code; without a ranking there are no tags or links.
interface Lookups {
    events: Event[]
    leagues: Map<string, League>
    homeLeagues: Map<string, string> // team code -> league name
    teamRefs: Map<string, { id: string; slug: string }> // team code -> id + slug
}

export async function getLookups(): Promise<Lookups> {
    const [events, leagues, ranking] = await Promise.all([getEvents(), getLeagues(), getRanking()])
    const homeLeagues = new Map<string, string>()
    const teamRefs = new Map<string, { id: string; slug: string }>()

    for (const t of ranking?.teams ?? []) {
        if (t.league) homeLeagues.set(t.team.code, t.league.name)
        teamRefs.set(t.team.code, { id: t.team.id, slug: t.team.slug })
    }

    return { events, leagues: new Map(leagues.map((l) => [l.slug, l])), homeLeagues, teamRefs }
}

function linkTeam(t: Team, { teamRefs }: Lookups): void {
    const ref = t.tbd ? undefined : teamRefs.get(t.code)

    if (ref) {
        t.id ??= ref.id
        t.slug ??= ref.slug
    }
}

export function teamUrl(t: { id?: string; slug?: string; name: string }): string | null {
    return t.id ? `/team/${t.id}/${t.slug ?? slugify(t.name)}` : null
}

// Events where teams from different regions meet, so home-league tags add information.
export function isInternational(e: Event | null): boolean {
    return !!e && CROSS_REGION.has(e.league.slug)
}

function toMatch(raw: RawScheduleEvent, lookups: Lookups): Match | null {
    const { events, leagues, homeLeagues } = lookups

    if (raw.type !== 'match' || !raw.match || !leagues.has(raw.league.slug)) return null
    const event = eventFor(events, raw.league.slug, raw.startTime)
    const teams: [Team, Team] = [toTeam(raw.match.teams[0]), toTeam(raw.match.teams[1])]

    for (const t of teams) linkTeam(t, lookups)

    // At international events, show where each team comes from ("G2 · LEC").
    if (isInternational(event)) for (const t of teams) if (!t.tbd) t.tag = homeLeagues.get(t.code)

    return {
        id: raw.match.id,
        start: raw.startTime,
        state: raw.state,
        bestOf: raw.match.strategy.count,
        stage: raw.blockName ?? '',
        leagueSlug: raw.league.slug,
        leagueName: raw.league.name,
        leagueImage: raw.league.image ?? leagues.get(raw.league.slug)?.image ?? null,
        event,
        teams,
    }
}

export interface MatchPage {
    matches: Match[]
    older: string | null
    newer: string | null
}

// The "global" schedule, limited to the followed leagues so pages aren't padded with
// matches we'd throw away.
export async function getSchedulePage(pageToken?: string): Promise<MatchPage> {
    const lookups = await getLookups()
    const leagueId = [...lookups.leagues.values()].map((l) => l.id).join(',')
    const schedule = await fetchSchedule({ leagueId, pageToken })

    return {
        matches: schedule.events.map((e) => toMatch(e, lookups)).filter((m): m is Match => m !== null),
        older: schedule.pages.older,
        newer: schedule.pages.newer,
    }
}

// Upcoming + live across all leagues, reaching one page forward if the current page runs short.
export async function getUpcoming(min = 40): Promise<Match[]> {
    const page = await getSchedulePage()
    let matches = page.matches.filter((m) => m.state !== 'completed')

    if (matches.length < min && page.newer) {
        const next = await getSchedulePage(page.newer)
        matches = matches.concat(next.matches.filter((m) => m.state !== 'completed'))
    }

    return dedupe(matches)
}

// All matches of one event. The league's default page is centred on "now", so long events
// (regional splits) may need a few older and newer pages to be covered completely.
export async function getEventMatches(event: Event): Promise<Match[]> {
    const lookups = await getLookups()
    const from = shiftDay(event.startDate, -1)
    const to = shiftDay(event.endDate, 1)
    const raws: RawScheduleEvent[] = []
    const first = await fetchSchedule({ leagueId: event.league.id })
    raws.push(...first.events)

    for (const dir of ['older', 'newer'] as const) {
        let page = first

        for (let i = 0; i < 3; i++) {
            const edge = dir === 'older' ? page.events[0] : page.events[page.events.length - 1]
            const day = edge?.startTime.slice(0, 10)
            const token = page.pages[dir]

            if (!token || !day || (dir === 'older' ? day < from : day > to)) break
            page = await fetchSchedule({ leagueId: event.league.id, pageToken: token })
            raws.push(...page.events)
        }
    }

    const out = raws.flatMap((r) => {
        const day = r.startTime.slice(0, 10)

        if (day < from || day > to) return []
        const m = toMatch(r, lookups)

        return m ? [m] : []
    })

    return dedupe(out).sort((a, b) => a.start.localeCompare(b.start))
}

function dedupe(matches: Match[]): Match[] {
    const seen = new Set<string>()

    return matches.filter((m) => !seen.has(m.id) && seen.add(m.id))
}

export function matchSlug(m: Match): string {
    return slugify(m.teams[0].name, 'vs', m.teams[1].name, m.event?.slug ?? m.leagueSlug)
}

export function matchUrl(m: Match): string {
    return `/matches/${m.id}/${matchSlug(m)}`
}

export function eventUrl(e: Event): string {
    return `/events/${e.id}/${e.slug}`
}
