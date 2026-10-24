// Thin client for the unofficial lolesports.com API (the same one their site uses).
// Responses are cached in memory per isolate; on upstream failure we serve stale data.

const BASE = 'https://esports-api.lolesports.com/persisted/gw'
// Public key shipped in the lolesports.com frontend bundle — not a secret.
const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z'

export type RawState = 'unstarted' | 'inProgress' | 'completed'

export interface RawTeam {
    id?: string
    slug?: string
    name: string
    code: string
    image: string
    result?: { outcome: 'win' | 'loss' | 'tie' | null; gameWins: number } | null
    record?: { wins: number; losses: number } | null
}

export interface RawScheduleEvent {
    startTime: string
    state: RawState
    type: string // "match" | "show"
    blockName?: string
    league: { name: string; slug: string; image?: string }
    match?: {
        id: string
        flags?: string[]
        teams: RawTeam[]
        strategy: { type: string; count: number }
    }
}

export interface RawSchedule {
    pages: { older: string | null; newer: string | null }
    events: RawScheduleEvent[]
}

export interface RawLeague {
    id: string
    slug: string
    name: string
    region: string
    image: string
    priority: number
    displayPriority: { position: number; status: string }
}

export interface RawTournament {
    id: string
    slug: string
    startDate: string
    endDate: string
}

export interface RawStandingMatch {
    id: string
    state: RawState
    previousMatchIds: string[]
    teams: RawTeam[]
}

export interface RawStage {
    id: string
    name: string
    type: string | null
    slug: string
    sections: {
        name: string
        matches: RawStandingMatch[]
        rankings: { ordinal: number; teams: RawTeam[] }[]
    }[]
}

export interface RawVod {
    parameter: string
    locale: string
    provider: string
}

export interface RawEventDetails {
    id: string
    type: string
    tournament: { id: string }
    league: { id: string; slug: string; name: string; image: string }
    match: {
        strategy: { count: number }
        teams: RawTeam[]
        games: {
            number: number
            id: string
            state: RawState | 'unneeded'
            teams: { id: string; side: 'blue' | 'red' }[]
            vods: RawVod[]
        }[]
    }
    streams: (RawVod & { mediaLocale?: { englishName: string } })[]
}

export class ApiError extends Error {}

const cache = new Map<string, { expires: number; value: unknown }>()
const MAX_ENTRIES = 300

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key)
    if (hit && hit.expires > Date.now()) return hit.value as T

    try {
        const value = await load()
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
        cache.set(key, { expires: Date.now() + ttlSeconds * 1000, value })
        return value
    } catch (err) {
        if (hit) return hit.value as T // stale beats nothing
        throw err instanceof ApiError ? err : new ApiError(`${key} failed: ${String(err)}`)
    }
}

async function get<T>(
    path: string,
    params: Record<string, string | undefined>,
    ttlSeconds: number,
): Promise<T> {
    const qs = new URLSearchParams({ hl: 'en-US' })
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
    const url = `${BASE}/${path}?${qs.toString()}`

    return cached(url, ttlSeconds, async () => {
        const res = await fetch(url, { headers: { 'x-api-key': API_KEY } })
        if (!res.ok) throw new ApiError(`${path} returned ${res.status}`)
        const body = await res.json<{ data?: T }>()
        if (!body.data) throw new ApiError(`${path} returned no data`)
        return body.data
    })
}

export async function fetchSchedule(
    opts: { leagueId?: string; pageToken?: string } = {},
): Promise<RawSchedule> {
    const data = await get<{ schedule: RawSchedule }>('getSchedule', opts, 60)
    return data.schedule
}

export async function fetchLeagues(): Promise<RawLeague[]> {
    const data = await get<{ leagues: RawLeague[] }>('getLeagues', {}, 6 * 3600)
    return data.leagues
}

// Accepts many league ids at once; the response keeps the request order but omits the ids.
export async function fetchTournaments(leagueIds: string[]): Promise<RawTournament[][]> {
    const data = await get<{ leagues: { tournaments: RawTournament[] }[] }>(
        'getTournamentsForLeague',
        { leagueId: leagueIds.join(',') },
        6 * 3600,
    )
    return data.leagues.map((l) => l.tournaments)
}

export async function fetchStandings(tournamentId: string): Promise<RawStage[]> {
    const data = await get<{ standings: { stages: RawStage[] }[] }>('getStandings', { tournamentId }, 60)
    return data.standings[0]?.stages ?? []
}

export async function fetchEventDetails(matchId: string): Promise<RawEventDetails | null> {
    const data = await get<{ event: RawEventDetails | null }>('getEventDetails', { id: matchId }, 30)
    return data.event
}

// ---------- lolesports.com GraphQL ----------
// Power ranking and team data live in lolesports.com's own GraphQL API, not the API above.
// It only runs registered ("persisted") queries, sent by id. These ids come from the query
// manifest in their frontend bundle (see ROADMAP.md). If Riot changes a query, its id stops
// working and callers fall back gracefully.

const GQL = 'https://lolesports.com/api/gql'
const QUERY_IDS = {
    GetTeamGpr: '9411e88d02eb7f7ea8516ed9f206cb557d150208d6654c06f044781f8d9789ba',
    GetTeamEvents: '4597f76e634ed6ce19c4c5c2f64213e26742e299f43e5174a7143c04ae780424',
}

async function persisted<T>(
    operationName: keyof typeof QUERY_IDS,
    variables: Record<string, unknown>,
    ttlSeconds: number,
): Promise<T> {
    const qs = new URLSearchParams({
        operationName,
        variables: JSON.stringify(variables),
        extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: QUERY_IDS[operationName] } }),
    })
    const url = `${GQL}?${qs.toString()}`

    return cached(url, ttlSeconds, async () => {
        const res = await fetch(url, {
            headers: {
                // Apollo rejects GETs without a non-simple content type (CSRF protection).
                'content-type': 'application/json',
                'apollographql-client-name': 'Esports Web',
                'apollographql-client-version': '1.0.0',
            },
        })
        if (!res.ok) throw new ApiError(`${operationName} returned ${res.status}`)
        const body = await res.json<{ data?: T }>()
        if (!body.data) throw new ApiError(`${operationName} returned no data`)
        return body.data
    })
}

export interface RawGpr {
    gprScore: number
    rank: number
    dateCalculated: string
}

export interface RawGprTournament {
    tournamentRecord: { wins: number; losses: number } | null
    tournament: {
        id: string
        name: string // e.g. "Split 3 2026", without the league
        slug: string
        startTime: string
        endTime: string
        state: string
        league: { id: string; name: string } | null
        standings: { team: { id: string }; placement: number | null }[] | null
    }
}

export interface RawTeamGpr {
    team: {
        id: string
        code: string
        name: string
        slug: string
        image: string
        homeLeague: { name: string; slug: string; image: string } | null
    }
    currentTeamGPR: RawGpr
    previousTeamGPR: RawGpr | null
    teamMatchRecord: { wins: number; losses: number } | null
    tournaments: RawGprTournament[] | null
}

// Rankings are recalculated every few days; `endDate` is today, so the cache key rolls daily.
export async function fetchPowerRankings(startDate: string, endDate: string): Promise<RawTeamGpr[]> {
    const data = await persisted<{ teamGPR?: RawTeamGpr[] }>(
        'GetTeamGpr',
        { hl: 'en-US', step: 10, startDate, endDate, sport: 'lol' },
        3 * 3600,
    )
    if (!data.teamGPR?.length) throw new ApiError('GetTeamGpr returned no teams')
    return data.teamGPR
}

export interface RawTeamEvent {
    id: string
    startTime: string
    state: RawState
    match: { id: string } | null
    tournament: { id: string; name: string } | null
    matchTeams: (RawTeam & { teamId?: string })[]
}

// One team's matches across all leagues. Results come oldest first and capped at pageSize,
// so callers keep the date window narrow enough to fit.
export async function fetchTeamEvents(
    teamId: string,
    states: RawState[],
    from: string,
    to: string,
    pageSize = 100,
): Promise<RawTeamEvent[]> {
    const data = await persisted<{ esports: { events: RawTeamEvent[] } | null }>(
        'GetTeamEvents',
        {
            hl: 'en-US',
            sport: ['lol'],
            teamId: [teamId],
            eventState: states,
            eventType: 'match',
            pageSize,
            eventDateStart: from,
            eventDateEnd: to,
        },
        60,
    )
    return data.esports?.events ?? []
}

// ---------- teams (REST) ----------

export interface RawPlayer {
    id: string
    summonerName: string
    firstName: string
    lastName: string
    image: string
    role: string // top, jungle, mid, bottom, support (or "none" for staff)
}

export interface RawTeamDetail {
    id: string
    slug: string
    name: string
    code: string
    image: string
    alternativeImage: string | null
    backgroundImage: string | null
    status: string
    homeLeague: { name: string; region: string } | null
    players: RawPlayer[]
}

// Accepts a numeric team id or a slug.
export async function fetchTeam(idOrSlug: string): Promise<RawTeamDetail | null> {
    const data = await get<{ teams: RawTeamDetail[] | null }>('getTeams', { id: idOrSlug }, 6 * 3600)
    return data.teams?.[0] ?? null
}
