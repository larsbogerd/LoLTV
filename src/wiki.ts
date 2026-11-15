// Roster data from Leaguepedia (lol.fandom.com), kept apart from the lolesports clients.
//
// lolesports has no roster changes, coaches or contracts. Leaguepedia has them in Cargo tables
// that anyone can query, but slowly: more than about one request per six seconds gets
// "ratelimited". So pages never query it. A cron trigger does, one small step every five
// minutes, and stores the result in KV. Pages read the two finished documents from KV.
import { env } from 'cloudflare:workers'
import { cached, fetchPowerRankings, fetchTeam } from './api'
import {
    handleOf,
    teamRoster,
    toMoves,
    type ChangeRow,
    type Move,
    type PlayerRow,
    type Side,
    type TeamRoster,
} from './transfers'

const API = 'https://lol.fandom.com/api.php'
// Fandom asks API clients to say who they are. It carries no contact details on purpose.
const USER_AGENT = 'LOLTV/0.1 (League of Legends esports overview; server-side cache, hourly)'
const WINDOW_DAYS = 90 // how far back the transfer feed goes
const MAX_MOVES = 400
const MAX_ROWS = 500 // Cargo's limit per anonymous query

// Teams that neither their name nor their short code finds on Leaguepedia. Keyed by
// lolesports team code, which survives sponsor renames better than the name.
const ALIASES: Record<string, string> = {
    TLAW: 'Team Liquid', // "Team Liquid Alienware"
}

function store(): KVNamespace | undefined {
    // SAFETY: the binding is declared in wrangler.jsonc. Typed by hand (and optional)
    // because the generated Env type isn't part of this project.
    return (env as { WIKI?: KVNamespace }).WIKI
}

// ---------- what pages read ----------

export interface MoveSide extends Side {
    // `team` is the display name. The rest is there for tier 1 teams only.
    id?: string
    slug?: string
    code?: string
    image?: string | null
}

export interface TeamMove extends Omit<Move, 'from' | 'to'> {
    from: MoveSide
    to: MoveSide
    image: string | null // player photo, from lolesports
    leagues: string[] // home league slugs of the tier 1 teams involved
}

export interface MoveFeed {
    builtAt: string
    moves: TeamMove[] // newest first
}

export interface Rosters {
    builtAt: string
    teams: Record<string, TeamRoster> // by lolesports team id
}

// Both are optional data: null when KV is empty, missing or failing, so pages fall back.
export const getMoves = () => read<MoveFeed>('wiki:moves')
export const getRosters = () => read<Rosters>('wiki:rosters')

async function read<T>(key: string): Promise<T | null> {
    const kv = store()

    if (!kv) return null

    try {
        return await cached(key, 60, () => kv.get<T>(key, 'json'))
    } catch (err) {
        console.error(`${key} unavailable:`, err)

        return null
    }
}

// ---------- Cargo client ----------

async function cargo(params: Record<string, string>): Promise<Record<string, string>[]> {
    const qs = new URLSearchParams({
        action: 'cargoquery',
        format: 'json',
        limit: String(MAX_ROWS),
        ...params,
    })

    const res = await fetch(`${API}?${qs.toString()}`, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
    })

    if (!res.ok) throw new Error(`Leaguepedia returned ${res.status}`)

    const body = await res.json<{
        cargoquery?: { title: Record<string, string> }[]
        error?: { code: string }
    }>()

    if (!body.cargoquery) throw new Error(`Leaguepedia: ${body.error?.code ?? 'no rows'}`)

    return body.cargoquery.map((r) => r.title)
}

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const list = (values: string[]) => values.map(quote).join(',')
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
// Names come back with HTML entities ("Daniel&nbsp;Esteban").
const clean = (s: string | undefined) =>
    (s ?? '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim()

// Join and leave rows. With `news`, each row also gets the link to its announcement.
async function changes(where: string, news: boolean, offset = 0): Promise<ChangeRow[]> {
    const rows = await cargo({
        tables: news ? 'RosterChanges=RC,NewsItems=N' : 'RosterChanges=RC',
        ...(news ? { join_on: 'RC.NewsId=N.NewsId' } : {}),
        fields:
            'RC.RosterChangeId=Id,RC.Date_Sort=Date,RC.Player,RC.Direction,RC.Team,RC.RoleDisplay=Role,' +
            `RC.Status,RC.NewsId${news ? ',N.Source' : ''}`,
        where,
        order_by: 'RC.Date_Sort DESC, RC.RosterChangeId',
        offset: String(offset),
    })

    return rows.flatMap((r): ChangeRow[] => {
        const direction = r.Direction

        if (direction !== 'Join' && direction !== 'Leave') return []
        // "url;;;label;;;site;;;language"
        const url = (r.Source ?? '').split(';;;')[0]!.trim()

        return [
            {
                id: r.Id ?? '',
                date: (r.Date ?? '').slice(0, 10),
                player: r.Player ?? '',
                direction,
                team: r.Team ?? '',
                roles: r.Role ?? '',
                status: r.Status ?? '',
                newsId: r.NewsId ?? '',
                source: /^https?:\/\//.test(url) ? url : null,
            },
        ]
    })
}

// ---------- the cron steps ----------

// A tier 1 team (from the power ranking) and its name on Leaguepedia.
interface TeamRef {
    id: string
    slug: string
    name: string
    code: string
    image: string | null
    league: string | null // home league slug
    wiki: string | null
}

type Photos = Record<string, Record<string, string>> // team id -> handle (lower case) -> image

const TICK_MS = 5 * 60e3 // must match the cron in wrangler.jsonc
const PHOTO_BATCH = 20
const PLAYER_CHUNK = 120

// One step per tick, in this order, so a full refresh takes an hour. Each step makes at
// most one Leaguepedia request, which keeps us far under their limit and under the Workers
// free plan's CPU time and subrequest limits. A step that fails leaves its old result in
// place, and the next hour tries again.
const STEPS: Record<string, (kv: KVNamespace, now: number) => Promise<string>> = {
    teams: async (kv, now) => {
        const ranked = await fetchPowerRankings(`${new Date(now).getUTCFullYear()}-01-01`, day(now))
        const teams = ranked.map((r) => r.team)
        const active = "(IsDisbanded IS NULL OR IsDisbanded=0) AND (RenamedTo IS NULL OR RenamedTo='')"

        const rows = await cargo({
            tables: 'Teams',
            fields: 'Name,Short,IsDisbanded=Gone,RenamedTo=Renamed',
            where: `Name IN (${list(teams.map((t) => t.name))}) OR (Short IN (${list(teams.map((t) => t.code))}) AND ${active})`,
        })

        const lower = (s: string | undefined) => (s ?? '').toLowerCase()

        const refs = teams.map((t): TeamRef => {
            const byName = rows.find((r) => lower(r.Name) === lower(t.name))
            // The short code only counts when exactly one active team has it.
            const byCode = rows.filter(
                (r) => lower(r.Short) === lower(t.code) && r.Gone !== '1' && !r.Renamed,
            )

            return {
                id: t.id,
                slug: t.slug,
                name: t.name,
                code: t.code,
                image: t.image || null,
                league: t.homeLeague?.slug ?? null,
                wiki: ALIASES[t.code] ?? byName?.Name ?? (byCode.length === 1 ? byCode[0]!.Name! : null),
            }
        })

        const unmapped = refs.filter((t) => !t.wiki).map((t) => t.name)

        if (unmapped.length) console.warn('wiki: no Leaguepedia team for', unmapped.join(', '))
        await put(kv, 'teams', refs)

        return `${refs.length - unmapped.length} of ${refs.length} teams mapped`
    },

    rosterA: (kv) => rosterStep(kv, 0),
    rosterB: (kv) => rosterStep(kv, 1),
    coachesA: (kv) => coachStep(kv, 0),
    coachesB: (kv) => coachStep(kv, 1),
    moves0: (kv, now) => moveStep(kv, now, 0),
    moves1: (kv, now) => moveStep(kv, now, 1),
    others0: (kv, now) => otherStep(kv, now, 0),
    others1: (kv, now) => otherStep(kv, now, 1),
    others2: (kv, now) => otherStep(kv, now, 2),

    // Player photos come from the lolesports rosters, a few teams per hour.
    photos: async (kv, now) => {
        const teams = (await part<TeamRef[]>(kv, 'teams')) ?? []
        const batches = Math.ceil(teams.length / PHOTO_BATCH)

        if (!batches) return 'no teams yet'
        const batch = Math.floor(now / (TICK_MS * SLOTS.length)) % batches
        const photos = (await part<Photos>(kv, 'photos')) ?? {}

        await Promise.all(
            teams.slice(batch * PHOTO_BATCH, (batch + 1) * PHOTO_BATCH).map(async (t) => {
                const raw = await fetchTeam(t.id).catch(() => null)

                if (!raw) return

                photos[t.id] = Object.fromEntries(
                    raw.players.filter((p) => p.image).map((p) => [handleKey(p.summonerName), p.image]),
                )
            }),
        )
        await put(kv, 'photos', photos)

        return `batch ${batch + 1} of ${batches}`
    },

    assemble: async (kv, now) => {
        const teams = await part<TeamRef[]>(kv, 'teams')

        if (!teams) return 'no teams yet'

        const [players, coaches, rows, photos] = await Promise.all([
            parts<PlayerRow>(kv, ['rosterA', 'rosterB']),
            parts<ChangeRow>(kv, ['coachesA', 'coachesB']),
            parts<ChangeRow>(kv, ['moves0', 'moves1', 'others0', 'others1', 'others2']),
            part<Photos>(kv, 'photos'),
        ])

        const builtAt = new Date(now).toISOString()
        const byWiki = new Map(teams.flatMap((t) => (t.wiki ? [[t.wiki, t] as const] : [])))

        // The coaches' joins go back years. The players' only as far as the transfer window,
        // which is enough to know who was benched lately.
        const joins = [...coaches, ...rows]

        const rosters: Rosters = {
            builtAt,
            teams: Object.fromEntries(
                [...byWiki].map(([wiki, t]) => [t.id, teamRoster(wiki, players, joins)]),
            ),
        }

        const side = (s: Side): MoveSide => {
            const t = s.team ? byWiki.get(s.team) : undefined

            return t ? { ...s, team: t.name, id: t.id, slug: t.slug, code: t.code, image: t.image } : s
        }

        const since = day(now - WINDOW_DAYS * 86400e3)

        const moves = toMoves(rows)
            .filter((m) => m.date >= since)
            .flatMap((m): TeamMove[] => {
                const involved = [m.to.team, m.from.team].flatMap((name) => byWiki.get(name ?? '') ?? [])

                if (!involved.length) return []
                const photo = involved.map((t) => photos?.[t.id]?.[handleKey(m.handle)]).find(Boolean)

                return [
                    {
                        ...m,
                        from: side(m.from),
                        to: side(m.to),
                        image: photo ?? null,
                        leagues: [...new Set(involved.flatMap((t) => t.league ?? []))],
                    },
                ]
            })
            .slice(0, MAX_MOVES)

        if (players.length) await kv.put('wiki:rosters', JSON.stringify(rosters))
        await kv.put('wiki:moves', JSON.stringify({ builtAt, moves } satisfies MoveFeed))

        return `${moves.length} moves, ${players.length} people on ${byWiki.size} teams`
    },
}

const SLOTS = Object.keys(STEPS)

export const handleKey = (handle: string) => handle.trim().toLowerCase()

// The teams with a Leaguepedia name, split in two so a query stays under the row limit.
async function half(kv: KVNamespace, which: number): Promise<string[]> {
    const teams = (await part<TeamRef[]>(kv, 'teams')) ?? []

    return teams.flatMap((t) => t.wiki ?? []).filter((_, i) => i % 2 === which)
}

async function rosterStep(kv: KVNamespace, which: number): Promise<string> {
    const teams = await half(kv, which)

    if (!teams.length) return 'no teams yet'

    const rows = await cargo({
        tables: 'Players',
        fields: '_pageID=PageId,_pageName=Page,ID=Handle,Name,Country,Role,Team,Contract,IsSubstitute=Sub,IsTrainee=Trainee',
        where: `Team IN (${list(teams)}) AND Role IN ('Top','Jungle','Mid','Bot','Support','Coach')`,
    })

    const people = rows.map((r): PlayerRow => ({
        pageId: Number(r.PageId),
        page: r.Page ?? '',
        handle: clean(r.Handle) || handleOf(r.Page ?? ''),
        name: clean(r.Name),
        country: clean(r.Country),
        role: r.Role ?? '',
        team: r.Team ?? '',
        contract: r.Contract ? r.Contract.slice(0, 10) : null,
        sub: r.Sub === '1' || r.Trainee === '1',
    }))

    await put(kv, which ? 'rosterB' : 'rosterA', people)

    return `${people.length} people on ${teams.length} teams`
}

// Which kind of coach each coach is: "Coach" in Players, "Head Coach" in their latest join.
async function coachStep(kv: KVNamespace, which: number): Promise<string> {
    const name = which ? 'coachesB' : 'coachesA'
    const people = (await part<PlayerRow[]>(kv, which ? 'rosterB' : 'rosterA')) ?? []
    const pages = [...new Set(people.filter((p) => p.role === 'Coach').map((p) => p.page))]
    const teams = [...new Set(people.map((p) => p.team))]

    if (!pages.length) return 'no coaches yet'

    const rows = await changes(
        `RC.Player IN (${list(pages)}) AND RC.Team IN (${list(teams)}) AND RC.Direction='Join'`,
        false,
    )

    await put(kv, name, rows)

    return `${rows.length} joins for ${pages.length} coaches`
}

// Every join and leave at a tier 1 team in the window, 500 rows per page.
async function moveStep(kv: KVNamespace, now: number, page: number): Promise<string> {
    const name = `moves${page}`
    const teams = ((await part<TeamRef[]>(kv, 'teams')) ?? []).flatMap((t) => t.wiki ?? [])

    if (!teams.length) return 'no teams yet'

    if (page > 0 && ((await part<ChangeRow[]>(kv, `moves${page - 1}`)) ?? []).length < MAX_ROWS) {
        await put(kv, name, [])

        return 'not needed'
    }

    const rows = await changes(
        `RC.Team IN (${list(teams)}) AND RC.Date_Sort >= '${day(now - WINDOW_DAYS * 86400e3)}'`,
        true,
        page * MAX_ROWS,
    )

    await put(kv, name, rows)

    return `${rows.length} rows`
}

// The other half of those moves: the same players joining or leaving teams outside tier 1.
async function otherStep(kv: KVNamespace, now: number, chunk: number): Promise<string> {
    const name = `others${chunk}`
    const teams = ((await part<TeamRef[]>(kv, 'teams')) ?? []).flatMap((t) => t.wiki ?? [])
    const rows = await parts<ChangeRow>(kv, ['moves0', 'moves1'])
    const players = [...new Set(rows.map((r) => r.player))] // newest moves first
    const mine = players.slice(chunk * PLAYER_CHUNK, (chunk + 1) * PLAYER_CHUNK)

    if (!mine.length || !teams.length) {
        await put(kv, name, [])

        return 'not needed'
    }

    // A little before the window, so a leave just outside it still pairs with its join.
    const since = day(now - (WINDOW_DAYS + 10) * 86400e3)

    const found = await changes(
        `RC.Player IN (${list(mine)}) AND RC.Team NOT IN (${list(teams)}) AND RC.Date_Sort >= '${since}'`,
        true,
    )

    await put(kv, name, found)

    return `${found.length} rows for ${mine.length} players`
}

async function put(kv: KVNamespace, name: string, data: unknown): Promise<void> {
    await kv.put(`wiki:part:${name}`, JSON.stringify(data))
}

function part<T>(kv: KVNamespace, name: string): Promise<T | null> {
    return kv.get<T>(`wiki:part:${name}`, 'json')
}

async function parts<T>(kv: KVNamespace, names: string[]): Promise<T[]> {
    const lists = await Promise.all(names.map((n) => part<T[]>(kv, n)))

    return lists.flatMap((l) => l ?? [])
}

// Called by the cron trigger. The step follows from the clock, so there is no state to keep.
export async function tick(time: number): Promise<void> {
    const kv = store()
    const slot = SLOTS[Math.floor(time / TICK_MS) % SLOTS.length]!

    if (!kv) {
        console.error('wiki: the WIKI KV binding is missing')

        return
    }

    try {
        console.log(`wiki ${slot}: ${await STEPS[slot]!(kv, time)}`)
    } catch (err) {
        console.error(`wiki ${slot} failed:`, err)
    }
}
