// Domain layer: turns raw API responses into the shapes the views use.
// "Event" follows HLTV's meaning: one tournament (e.g. Worlds 2026), which in API terms
// is a tournament inside a league.

import {
    fetchEventDetails,
    fetchLeagues,
    fetchPowerRankings,
    fetchSchedule,
    fetchStandings,
    fetchTeam,
    fetchTeamEvents,
    fetchTournaments,
    type RawEventDetails,
    type RawLeague,
    type RawScheduleEvent,
    type RawStage,
    type RawState,
    type RawTeam,
    type RawTeamEvent,
} from './api'
import { slugify } from './format'
import { fetchGameMetadata } from './live'

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
    tag?: string // home league (LEC, LCK...), only set at international events
    slug?: string // set when known, for links to the team page
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

// LOLTV only follows tier 1: Riot's international events plus the six major regions.
// Everything else the API carries (ERLs, Challengers, promotion tournaments, off-season cups,
// national-team events) is left out on purpose. Add a league slug here to follow it.
const TIER1 = new Set(['worlds', 'msi', 'first_stand']) // featured on the homepage
const CROSS_REGION = new Set([...TIER1, 'ewc_lol', 'americas_cup'])
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
// Schedule teams have no id either. Ids (for team links) and home leagues (for tags) come
// from the power ranking, keyed by team code; without a ranking there are no tags or links.
interface Lookups {
    events: Event[]
    leagues: Map<string, League>
    homeLeagues: Map<string, string> // team code -> league name
    teamRefs: Map<string, { id: string; slug: string }> // team code -> id + slug
}

async function getLookups(): Promise<Lookups> {
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

// ---------- Swiss bracket (HLTV "group play" view) ----------

// Worlds/MSI-style Swiss: 16 teams, 3 wins to advance, 3 losses to go out, 5 rounds.
// Each round lists its record pools as [wins, losses, number of matches].
const SWISS_16: [number, number, number][][] = [
    [[0, 0, 8]],
    [
        [1, 0, 4],
        [0, 1, 4],
    ],
    [
        [2, 0, 2],
        [1, 1, 4],
        [0, 2, 2],
    ],
    [
        [2, 1, 3],
        [1, 2, 3],
    ],
    [[2, 2, 3]],
]
// Final records and how many teams can finish on each.
const SWISS_16_OUTCOMES: [number, number, number][] = [
    [3, 0, 2],
    [3, 1, 3],
    [3, 2, 3],
    [0, 3, 2],
    [1, 3, 3],
    [2, 3, 3],
]

export interface SwissPool {
    wins: number
    losses: number
    matches: Match[]
}

export interface SwissOutcome {
    wins: number
    losses: number
    teams: (Team | null)[] // null = not decided yet
}

export interface SwissBracket {
    pools: SwissPool[]
    outcomes: SwissOutcome[]
}

// A match where a win or a loss ends a team's Swiss run; these are played as Bo3.
const decisive = (p: { wins: number; losses: number }) => p.wins === 2 || p.losses === 2

// Places every Swiss match in its record pool by replaying results round by round.
// The API has no round numbers, so rounds come from chronological order. Returns null
// when the stage doesn't look like a 16-team Swiss, so the caller can fall back to a table.
export function swissBracket(matches: Match[]): SwissBracket | null {
    const total = SWISS_16.flat().reduce((n, [, , count]) => n + count, 0)
    if (matches.length !== total) return null
    const sorted = [...matches].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    const teams = new Map<string, Team>()
    for (const m of sorted) for (const t of m.teams) if (!t.tbd) teams.set(t.code, t)
    if (teams.size > 16) return null

    const record = new Map<string, { wins: number; losses: number }>()
    const rec = (code: string) => record.get(code) ?? { wins: 0, losses: 0 }
    const pools: SwissPool[] = []
    let next = 0

    for (const round of SWISS_16) {
        const size = round.reduce((n, [, , count]) => n + count, 0)
        const roundMatches = sorted.slice(next, next + size)
        next += size
        const roundPools = round.map(([wins, losses, count]) => ({
            wins,
            losses,
            count,
            matches: [] as Match[],
        }))
        const hasRoom = (p: (typeof roundPools)[number]) => p.matches.length < p.count

        const unplaced: Match[] = []
        for (const m of roundMatches) {
            const known = m.teams.find((t) => !t.tbd)
            const r = known && rec(known.code)
            const pool = r && roundPools.find((p) => p.wins === r.wins && p.losses === r.losses && hasRoom(p))
            if (pool) pool.matches.push(m)
            else unplaced.push(m)
        }
        // Pairings that aren't known yet: Bo3s go to deciding pools, Bo1s to the others.
        for (const m of unplaced) {
            const pool =
                roundPools.find((p) => hasRoom(p) && decisive(p) === m.bestOf > 1) ?? roundPools.find(hasRoom)
            if (!pool) return null
            pool.matches.push(m)
        }

        for (const m of roundMatches) {
            if (m.state !== 'completed') continue
            for (const t of m.teams) {
                if (t.tbd || t.won === null) continue
                const r = rec(t.code)
                record.set(t.code, t.won ? { ...r, wins: r.wins + 1 } : { ...r, losses: r.losses + 1 })
            }
        }
        pools.push(...roundPools.map(({ wins, losses, matches }) => ({ wins, losses, matches })))
    }

    const outcomes = SWISS_16_OUTCOMES.map(([wins, losses, count]) => {
        const finished = [...teams.values()].filter((t) => {
            const r = rec(t.code)
            return r.wins === wins && r.losses === losses
        })
        const open = Math.max(0, count - finished.length)
        return { wins, losses, teams: [...finished, ...Array<null>(open).fill(null)] }
    })
    return { pools, outcomes }
}

export interface Stage {
    name: string
    status: 'done' | 'active' | 'upcoming'
    kind: 'swiss' | 'table' | 'bracket'
    swiss?: SwissRow[]
    swissBracket?: SwissBracket | null
    tables?: { name: string; rows: { position: number; team: Team; wins: number; losses: number }[] }[]
    columns?: { name: string; matches: Match[] }[] // one column = plain grid, several = bracket
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

        const status = stageStatus(matches)

        if (isSwiss(stage.name) || isSwiss(stage.slug)) {
            stages.push({
                name: stage.name,
                status,
                kind: 'swiss',
                swiss: swissTable(matches),
                swissBracket: swissBracket(matches),
            })
        } else if (stage.sections.some((sec) => sec.rankings?.length)) {
            // One table per section: LCK, for example, splits its groups into Legend and Rise.
            stages.push({
                name: stage.name,
                status,
                kind: 'table',
                tables: stage.sections
                    .filter((sec) => sec.rankings?.length)
                    .map((sec) => ({
                        name: sec.name,
                        rows: sec.rankings.flatMap((r) =>
                            r.teams.map((t) => ({
                                position: r.ordinal,
                                team: toTeam(t),
                                wins: t.record?.wins ?? 0,
                                losses: t.record?.losses ?? 0,
                            })),
                        ),
                    })),
            })
        } else {
            stages.push({
                name: stage.name,
                status,
                kind: 'bracket',
                columns: bracketColumns(stage.name, matches),
            })
        }
    }

    if (!stages.length && eventMatches.length) {
        stages.push({
            name: 'Matches',
            status: stageStatus(eventMatches),
            kind: 'bracket',
            columns: bracketColumns('Matches', eventMatches),
        })
    }
    return stages
}

function stageStatus(matches: Match[]): Stage['status'] {
    if (matches.length && matches.every((m) => m.state === 'completed')) return 'done'
    if (matches.some((m) => m.state !== 'unstarted')) return 'active'
    return 'upcoming'
}

// The API has no bracket structure (previousMatchIds is empty), only block names. When those
// blocks form a clean single-elimination tree (4 -> 2 -> 1, like Worlds knockouts) they become
// bracket columns; anything else (double elimination, gauntlets) is one chronological grid.
function bracketColumns(stageName: string, matches: Match[]): { name: string; matches: Match[] }[] {
    const sorted = [...matches].sort((a, b) => a.start.localeCompare(b.start))
    const cols = new Map<string, Match[]>()
    for (const m of sorted) {
        const key = m.stage || stageName
        cols.set(key, [...(cols.get(key) ?? []), m])
    }
    const columns = [...cols].map(([name, ms]) => ({ name, matches: ms }))
    const isTree =
        columns.length > 1 &&
        columns.every((c, i) => i === 0 || c.matches.length * 2 === columns[i - 1]!.matches.length)
    return isTree ? columns : [{ name: stageName, matches: sorted }]
}

// ---------- power ranking ----------

export interface Placement {
    tournamentId: string
    name: string // "LCK Split 3 2026"
    placement: number
    end: string // ISO
}

export interface RankedTeam {
    rank: number
    previousRank: number | null
    points: number
    team: { id: string; slug: string; name: string; code: string; image: string | null }
    league: { name: string; slug: string; image: string } | null
    wins: number // matches this year
    losses: number
    placements: Placement[] // finished tournaments this year
}

export interface Ranking {
    updated: string // ISO, when GPR was last calculated
    teams: RankedTeam[]
}

let rankingFailedUntil = 0

// Optional data: returns null instead of throwing so pages can fall back to something else.
// A failure is remembered for a few minutes so a broken endpoint doesn't slow every page.
export async function getRanking(now = new Date()): Promise<Ranking | null> {
    if (Date.now() < rankingFailedUntil) return null
    try {
        const raw = await fetchPowerRankings(`${now.getUTCFullYear()}-01-01`, now.toISOString().slice(0, 10))
        const teams = raw
            .map((r) => ({
                rank: r.currentTeamGPR.rank,
                previousRank: r.previousTeamGPR?.rank ?? null,
                points: Math.round(r.currentTeamGPR.gprScore),
                team: {
                    id: r.team.id,
                    slug: r.team.slug,
                    name: r.team.name,
                    code: r.team.code,
                    image: r.team.image || null,
                },
                league: r.team.homeLeague,
                wins: r.teamMatchRecord?.wins ?? 0,
                losses: r.teamMatchRecord?.losses ?? 0,
                placements: (r.tournaments ?? []).flatMap(({ tournament: t }) => {
                    const placement = t.standings?.find((s) => s.team.id === r.team.id)?.placement
                    if (!placement) return []
                    const name = `${t.league?.name ?? ''} ${t.name}`.trim()
                    return [{ tournamentId: t.id, name, placement, end: t.endTime }]
                }),
            }))
            .sort((a, b) => a.rank - b.rank || b.points - a.points || a.team.name.localeCompare(b.team.name))
        const updated = raw.map((r) => r.currentTeamGPR.dateCalculated).sort()
        return { updated: updated[updated.length - 1] ?? now.toISOString(), teams }
    } catch (err) {
        console.error('power ranking unavailable:', err)
        rankingFailedUntil = Date.now() + 5 * 60e3
        return null
    }
}

// ---------- team profile ----------

export interface Player {
    id: string
    handle: string
    name: string // real name
    image: string | null
    role: string
}

export interface TeamProfile {
    id: string
    slug: string
    name: string
    code: string
    image: string | null
    league: { name: string; region: string; image: string | null } | null
    starters: Player[] // the five who played the team's latest game, top to support
    ranking: (RankedTeam & { leagueRank: number | null }) | null
    achievements: (Placement & { event: Event | null })[]
    upcoming: Match[]
    results: Match[] // newest first, last 120 days (or this year if that's empty), followed leagues only
    matchesAvailable: boolean // false when the team-events query failed
}

const ROLES = ['top', 'jungle', 'mid', 'bottom', 'support']
const roleIndex = (role: string) => (ROLES.includes(role) ? ROLES.indexOf(role) : ROLES.length)

export async function getTeamProfile(id: string, now = new Date()): Promise<TeamProfile | null> {
    const raw = await fetchTeam(id)
    if (!raw) return null
    const day = 86400e3
    const iso = (t: number) => new Date(t).toISOString()
    const optional = <T>(p: Promise<T>) => p.catch((err: unknown) => (console.error(err), null))

    const [lookups, ranking, recentPast, future] = await Promise.all([
        getLookups(),
        getRanking(now),
        optional(fetchTeamEvents(raw.id, ['completed'], iso(now.getTime() - 120 * day), iso(now.getTime()))),
        optional(
            fetchTeamEvents(
                raw.id,
                ['unstarted', 'inProgress'],
                iso(now.getTime() - day),
                iso(now.getTime() + 60 * day),
                30,
            ),
        ),
    ])
    // Teams knocked out early haven't played for months: fall back to the whole year.
    const past =
        recentPast?.length === 0
            ? await optional(
                  fetchTeamEvents(
                      raw.id,
                      ['completed'],
                      `${now.getUTCFullYear()}-01-01T00:00:00Z`,
                      iso(now.getTime()),
                  ),
              )
            : recentPast

    // GetTeamEvents gives tournament ids, which are our event ids. Matches in leagues we don't
    // follow are left out, like everywhere else on the site.
    const toTeamMatch = (e: RawTeamEvent): Match | null => {
        const event = lookups.events.find((ev) => ev.id === e.tournament?.id)
        if (!event || !e.match) return null
        const teams = e.matchTeams.map((t) => ({ ...toTeam(t), id: t.teamId ?? t.id, slug: t.slug }))
        if (teams.length !== 2) return null
        if (isInternational(event)) for (const t of teams) if (!t.tbd) t.tag = lookups.homeLeagues.get(t.code)
        return {
            id: e.match.id,
            start: e.startTime,
            state: e.state,
            bestOf: 0, // not in this query
            stage: '',
            leagueSlug: event.league.slug,
            leagueName: event.league.name,
            leagueImage: event.league.image,
            event,
            teams: [teams[0]!, teams[1]!],
        }
    }
    const results = (past ?? [])
        .map(toTeamMatch)
        .filter((m): m is Match => m !== null)
        .sort((a, b) => b.start.localeCompare(a.start))
    const upcoming = (future ?? [])
        .map(toTeamMatch)
        .filter((m): m is Match => m !== null)
        .sort((a, b) => a.start.localeCompare(b.start))

    const players: Player[] = raw.players
        .map((p) => ({
            id: p.id,
            handle: p.summonerName,
            name: `${p.firstName.trim()} ${p.lastName.trim()}`.trim(),
            image: p.image || null,
            role: p.role,
        }))
        .sort((a, b) => roleIndex(a.role) - roleIndex(b.role) || a.handle.localeCompare(b.handle))
    // Lineup source: the live match if there is one, else the latest result. Only matches at
    // followed events count: at off-season cups (WSCI, KeSPA Cup) teams often field academy players.
    const latest = upcoming.find((m) => m.state === 'inProgress') ?? results[0]
    const starters = latest ? await optional(lineup(raw.id, raw.code, latest.id, players)) : null

    const rankedTeam = ranking?.teams.find((t) => t.team.id === raw.id)
    const sameLeague = ranking?.teams.filter((t) => t.league && t.league.slug === rankedTeam?.league?.slug)
    const leagueRank = rankedTeam && sameLeague ? sameLeague.indexOf(rankedTeam) + 1 : null

    return {
        id: raw.id,
        slug: raw.slug,
        name: raw.name,
        code: raw.code,
        image: raw.image || null,
        league: raw.homeLeague ? { ...raw.homeLeague, image: rankedTeam?.league?.image ?? null } : null,
        starters: starters ?? [],
        ranking: rankedTeam ? { ...rankedTeam, leagueRank } : null,
        achievements: (rankedTeam?.placements ?? [])
            .map((p) => {
                const event = lookups.events.find((e) => e.id === p.tournamentId) ?? null
                return { ...p, name: event?.name ?? p.name, event }
            })
            .sort((a, b) => b.end.localeCompare(a.end)),
        upcoming,
        results,
        matchesAvailable: past !== null && future !== null,
    }
}

// lolesports.com lists everyone attached to a team (subs, academy) without saying who starts.
// The live-stats metadata of the team's latest game does: the five who actually played. A game
// in progress already has its metadata, so a live match gives today's lineup.
async function lineup(
    teamId: string,
    code: string,
    matchId: string,
    roster: Player[],
): Promise<Player[] | null> {
    const details = await fetchEventDetails(matchId)
    const game = details?.match.games.filter((g) => g.state === 'completed' || g.state === 'inProgress').pop()
    if (!game) return null
    const meta = await fetchGameMetadata(game.id)
    const side = [meta?.blueTeamMetadata, meta?.redTeamMetadata].find((s) => s?.esportsTeamId === teamId)
    if (!side) return null
    const byId = new Map(roster.map((p) => [p.id, p]))
    return side.participantMetadata
        .map((p) => {
            const known = byId.get(p.esportsPlayerId)
            if (known) return { ...known, role: p.role }
            // A player who isn't on the roster list (e.g. a stand-in): name only.
            const prefix = `${code} `
            const handle = p.summonerName.startsWith(prefix)
                ? p.summonerName.slice(prefix.length)
                : p.summonerName
            return { id: p.esportsPlayerId, handle, name: '', image: null, role: p.role }
        })
        .sort((a, b) => roleIndex(a.role) - roleIndex(b.role))
}

// ---------- single match ----------

export interface Game {
    id: string
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
                id: g.id,
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
