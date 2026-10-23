// Domain layer: turns raw API responses into the shapes the views use.
// "Event" follows HLTV's meaning: one tournament (e.g. Worlds 2026), which in API terms
// is a tournament inside a league.

import {
    fetchEventDetails,
    fetchLeagues,
    fetchSchedule,
    fetchStandings,
    fetchTournaments,
    type RawEventDetails,
    type RawLeague,
    type RawScheduleEvent,
    type RawStage,
    type RawState,
    type RawTeam,
} from './api'
import { slugify } from './format'

export type State = RawState

export interface League {
    id: string
    slug: string
    name: string
    region: string
    image: string
    tier: 1 | 2 | 3
}

export interface Event {
    id: string
    slug: string // url slug, e.g. worlds-2026
    name: string // Worlds 2026
    league: League
    startDate: string // YYYY-MM-DD
    endDate: string
}

export interface Team {
    id?: string
    name: string
    code: string
    image: string | null
    score: number | null // game wins in the series
    won: boolean | null
    tbd: boolean
}

export interface Match {
    id: string
    start: string // ISO
    state: State
    bestOf: number
    stage: string // blockName: Swiss, Quarterfinals, Week 3...
    leagueSlug: string
    leagueName: string
    leagueImage: string | null
    event: Event | null
    teams: [Team, Team]
}

// ---------- leagues & events ----------

const TIER1 = new Set(['worlds', 'msi', 'first_stand'])
const TIER2 = new Set(['lck', 'lpl', 'lec', 'lcs', 'lcp', 'cblol-brazil', 'lta_n', 'lta_s'])
const EXCLUDED = new Set(['tft_esports'])

function toLeague(raw: RawLeague): League {
    const tier = TIER1.has(raw.slug) ? 1 : TIER2.has(raw.slug) ? 2 : 3
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
    return raw.filter((l) => l.displayPriority.status !== 'hidden' && !EXCLUDED.has(l.slug)).map(toLeague)
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

function eventFor(events: Event[], leagueSlug: string, start: string): Event | null {
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

function shiftDay(date: string, days: number): string {
    return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400e3).toISOString().slice(0, 10)
}

export function eventStatus(e: Event, now = new Date()): 'ongoing' | 'upcoming' | 'finished' {
    const today = now.toISOString().slice(0, 10)
    if (today < e.startDate) return 'upcoming'
    if (today > e.endDate) return 'finished'
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

// The event that gets the banner on the homepage — HLTV does this for majors.
export function featuredEvent(events: Event[], now = new Date()): Event | null {
    const tier1 = events.filter((e) => e.league.tier === 1)
    const ongoing = tier1.find((e) => eventStatus(e, now) === 'ongoing')
    if (ongoing) return ongoing
    const upcoming = tier1
        .filter((e) => eventStatus(e, now) === 'upcoming')
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    if (upcoming) return upcoming
    return tier1.sort((a, b) => b.endDate.localeCompare(a.endDate))[0] ?? null
}

// ---------- matches ----------

function toTeam(raw: RawTeam | undefined): Team {
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
interface Lookups {
    events: Event[]
    leagues: Map<string, League>
}

async function getLookups(): Promise<Lookups> {
    const [events, leagues] = await Promise.all([getEvents(), getLeagues()])
    return { events, leagues: new Map(leagues.map((l) => [l.slug, l])) }
}

function toMatch(raw: RawScheduleEvent, { events, leagues }: Lookups): Match | null {
    if (raw.type !== 'match' || !raw.match) return null
    return {
        id: raw.match.id,
        start: raw.startTime,
        state: raw.state,
        bestOf: raw.match.strategy.count,
        stage: raw.blockName ?? '',
        leagueSlug: raw.league.slug,
        leagueName: raw.league.name,
        leagueImage: raw.league.image ?? leagues.get(raw.league.slug)?.image ?? null,
        event: eventFor(events, raw.league.slug, raw.startTime),
        teams: [toTeam(raw.match.teams[0]), toTeam(raw.match.teams[1])],
    }
}

export interface MatchPage {
    matches: Match[]
    older: string | null
    newer: string | null
}

export async function getSchedulePage(pageToken?: string): Promise<MatchPage> {
    const [schedule, lookups] = await Promise.all([fetchSchedule({ pageToken }), getLookups()])
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

    const out = raws
        .filter((r) => {
            const day = r.startTime.slice(0, 10)
            return day >= from && day <= to
        })
        .map((r) => toMatch(r, lookups))
        .filter((m): m is Match => m !== null)
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

// ---------- standings ----------

export interface SwissRow {
    team: Team
    wins: number
    losses: number
    status: 'qualified' | 'eliminated' | 'alive'
    live: boolean
}

export const SWISS_WINS_TO_QUALIFY = 3
export const SWISS_LOSSES_TO_ELIMINATE = 3

// The API has no rankings for Swiss stages, so records are tallied from the stage's matches.
export function swissTable(matches: Match[]): SwissRow[] {
    const rows = new Map<string, SwissRow>()
    const row = (t: Team) => {
        let r = rows.get(t.code)
        if (!r) rows.set(t.code, (r = { team: t, wins: 0, losses: 0, status: 'alive', live: false }))
        return r
    }
    for (const m of matches) {
        for (const t of m.teams) {
            if (t.tbd) continue
            const r = row(t)
            if (m.state === 'inProgress') r.live = true
            if (m.state === 'completed' && t.won === true) r.wins++
            if (m.state === 'completed' && t.won === false) r.losses++
        }
    }
    for (const r of rows.values()) {
        if (r.wins >= SWISS_WINS_TO_QUALIFY) r.status = 'qualified'
        else if (r.losses >= SWISS_LOSSES_TO_ELIMINATE) r.status = 'eliminated'
    }
    return [...rows.values()].sort(
        (a, b) => b.wins - a.wins || a.losses - b.losses || a.team.code.localeCompare(b.team.code),
    )
}

export interface Stage {
    name: string
    status: 'done' | 'active' | 'upcoming'
    kind: 'swiss' | 'table' | 'bracket'
    swiss?: SwissRow[]
    table?: { position: number; team: Team; wins: number; losses: number }[]
    columns?: { name: string; matches: Match[] }[]
}

export function isSwiss(name: string): boolean {
    return /swiss/i.test(name)
}

export async function getStages(event: Event, eventMatches: Match[]): Promise<Stage[]> {
    let raw: RawStage[] = []
    try {
        raw = await fetchStandings(event.id)
    } catch {
        // standings are optional; fall back to grouping by stage name below
    }
    const byId = new Map(eventMatches.map((m) => [m.id, m]))
    const stages: Stage[] = []

    for (const stage of raw) {
        const ids = stage.sections.flatMap((s) => s.matches.map((m) => m.id))
        const matches = ids.map((id) => byId.get(id)).filter((m): m is Match => !!m)
        const rankings = stage.sections.flatMap((s) => s.rankings ?? [])

        const status = stageStatus(matches)

        if (isSwiss(stage.name) || isSwiss(stage.slug)) {
            stages.push({ name: stage.name, status, kind: 'swiss', swiss: swissTable(matches) })
        } else if (rankings.length) {
            stages.push({
                name: stage.name,
                status,
                kind: 'table',
                table: rankings.flatMap((r) =>
                    r.teams.map((t) => ({
                        position: r.ordinal,
                        team: toTeam(t),
                        wins: t.record?.wins ?? 0,
                        losses: t.record?.losses ?? 0,
                    })),
                ),
            })
        } else {
            stages.push({ name: stage.name, status, kind: 'bracket', columns: columnsByStage(matches) })
        }
    }

    if (!stages.length && eventMatches.length) {
        stages.push({
            name: 'Matches',
            status: stageStatus(eventMatches),
            kind: 'bracket',
            columns: columnsByStage(eventMatches),
        })
    }
    return stages
}

function stageStatus(matches: Match[]): Stage['status'] {
    if (matches.length && matches.every((m) => m.state === 'completed')) return 'done'
    if (matches.some((m) => m.state !== 'unstarted')) return 'active'
    return 'upcoming'
}

// Groups matches into columns by their block name, in chronological order of first appearance.
function columnsByStage(matches: Match[]): { name: string; matches: Match[] }[] {
    const cols = new Map<string, Match[]>()
    for (const m of [...matches].sort((a, b) => a.start.localeCompare(b.start))) {
        const key = m.stage || 'Matches'
        cols.set(key, [...(cols.get(key) ?? []), m])
    }
    return [...cols].map(([name, ms]) => ({ name, matches: ms }))
}

// ---------- single match ----------

export interface Game {
    number: number
    state: string
    blue: Team | null
    red: Team | null
    vod: string | null
}

export interface MatchDetail {
    match: Match | null // schedule entry (has start time, stage, scores)
    details: RawEventDetails
    games: Game[]
    streams: { label: string; url: string }[]
}

function mediaUrl(provider: string, parameter: string): string | null {
    if (provider === 'youtube') return `https://www.youtube.com/watch?v=${parameter}`
    if (provider === 'twitch') return `https://www.twitch.tv/${parameter}`
    if (provider === 'kick') return `https://kick.com/${parameter}`
    return null
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
    const details = await fetchEventDetails(id)
    if (!details?.match) return null

    const event = await getEvent(details.tournament.id)
    const match = event ? ((await getEventMatches(event)).find((m) => m.id === id) ?? null) : null

    const teamsById = new Map(details.match.teams.map((t) => [t.id, toTeam(t)]))
    const games: Game[] = details.match.games
        .filter((g) => g.state !== 'unneeded')
        .map((g) => {
            const side = (s: 'blue' | 'red') => teamsById.get(g.teams.find((t) => t.side === s)?.id) ?? null
            const vod = g.vods.find((v) => v.locale.startsWith('en')) ?? g.vods[0]
            return {
                number: g.number,
                state: g.state,
                blue: side('blue'),
                red: side('red'),
                vod: vod ? mediaUrl(vod.provider, vod.parameter) : null,
            }
        })

    const streams = details.streams
        .filter((s) => s.locale.startsWith('en'))
        .map((s) => {
            const url = mediaUrl(s.provider, s.parameter)
            return url
                ? { label: `${s.provider[0]!.toUpperCase()}${s.provider.slice(1)} · ${s.parameter}`, url }
                : null
        })
        .filter((s): s is { label: string; url: string } => s !== null)

    return { match, details, games, streams }
}
