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

async function get<T>(
    path: string,
    params: Record<string, string | undefined>,
    ttlSeconds: number,
): Promise<T> {
    const qs = new URLSearchParams({ hl: 'en-US' })
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
    const url = `${BASE}/${path}?${qs.toString()}`

    const hit = cache.get(url)
    if (hit && hit.expires > Date.now()) return hit.value as T

    try {
        const res = await fetch(url, { headers: { 'x-api-key': API_KEY } })
        if (!res.ok) throw new ApiError(`${path} returned ${res.status}`)
        const body = await res.json<{ data?: T }>()
        if (!body.data) throw new ApiError(`${path} returned no data`)
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!)
        cache.set(url, { expires: Date.now() + ttlSeconds * 1000, value: body.data })
        return body.data
    } catch (err) {
        if (hit) return hit.value as T // stale beats nothing
        throw err instanceof ApiError ? err : new ApiError(`${path} failed: ${String(err)}`)
    }
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
