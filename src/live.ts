// Live game stats: the lolesports live-stats feed (feed.lolesports.com/livestats/v1).
// Kept apart from api.ts/data.ts on purpose: it's a different service with its own timing rules.
//
// How the feed works:
// - /window/<gameId>?startingTime=<ISO, whole 10s> returns ~10 frames (one per second) from
//   that moment: per team gold, kills, towers, inhibitors, barons, dragons, and per player
//   level, K/D/A, CS and gold. Without startingTime it returns the game's first frames.
// - Every response carries gameMetadata: patch, and per player the champion and role.
// - Asking for a moment after the game ended returns the final frames (gameState "finished"),
//   so a finished game needs no end time: ask for start + 3h (capped at now).
// - /details/<gameId>?startingTime=... has the same timing, per player only: items, damage
//   share, kill participation, wards, runes, skill order (~57 KB per window). We use items.
//   Summoner spells are in neither endpoint.
// - There is no winner field.

import { ApiError, cached } from './api'

interface RawParticipantMeta {
    participantId: number
    esportsPlayerId: string
    summonerName: string
    championId: string
    role: string
}

export interface RawSideMetadata {
    esportsTeamId: string
    participantMetadata: RawParticipantMeta[]
}

export interface RawGameMetadata {
    patchVersion: string
    blueTeamMetadata: RawSideMetadata
    redTeamMetadata: RawSideMetadata
}

interface RawFrameTeam {
    totalGold: number
    inhibitors: number
    towers: number
    barons: number
    totalKills: number
    dragons: string[]
    participants: {
        participantId: number
        totalGold: number
        level: number
        kills: number
        deaths: number
        assists: number
        creepScore: number
    }[]
}

interface RawFrame {
    rfc460Timestamp: string
    gameState: 'in_game' | 'paused' | 'finished'
    blueTeam: RawFrameTeam
    redTeam: RawFrameTeam
}

interface RawWindow {
    gameMetadata: RawGameMetadata
    frames: RawFrame[]
}

interface RawDetails {
    frames: {
        rfc460Timestamp: string
        participants: {
            participantId: number
            items: number[]
        }[]
    }[]
}

const FEED = 'https://feed.lolesports.com/livestats/v1'

async function fetchWindow(
    gameId: string,
    startingTime: string | null,
    ttlSeconds: number,
): Promise<RawWindow> {
    const url = `${FEED}/window/${gameId}${startingTime ? `?startingTime=${startingTime}` : ''}`

    return cached(url, ttlSeconds, async () => {
        const res = await fetch(url)

        // 204 = no stats yet (game just started). Throwing keeps that out of the cache.
        if (!res.ok || res.status === 204) throw new ApiError(`livestats returned ${res.status}`)
        const body = await res.json<RawWindow>()

        if (!body.frames?.length) throw new ApiError('livestats returned no frames')

        return body
    })
}

async function fetchDetails(gameId: string, startingTime: string, ttlSeconds: number): Promise<RawDetails> {
    const url = `${FEED}/details/${gameId}?startingTime=${startingTime}`

    return cached(url, ttlSeconds, async () => {
        const res = await fetch(url)

        if (!res.ok || res.status === 204) throw new ApiError(`livestats details returned ${res.status}`)
        const body = await res.json<RawDetails>()

        if (!body.frames?.length) throw new ApiError('livestats details returned no frames')

        return body
    })
}

// The game's first window: lineup, champions and the start time. Never changes once it exists.
async function fetchStart(gameId: string): Promise<RawWindow> {
    return fetchWindow(gameId, null, 24 * 3600)
}

// Who played a game (used for team lineups).
export async function fetchGameMetadata(gameId: string): Promise<RawGameMetadata | null> {
    return (await fetchStart(gameId)).gameMetadata
}

// ---------- normalized game stats ----------

export interface PlayerLine {
    name: string // without the team tag
    champion: string // Data Dragon id, e.g. "KSante"
    role: string
    level: number
    kills: number
    deaths: number
    assists: number
    cs: number
    items: number[] // finished items first; no trinkets, wards or potions
}

export interface SideStats {
    teamId: string
    gold: number
    kills: number
    towers: number // destroyed by this team
    inhibitors: number
    barons: number
    dragons: string[]
    players: PlayerLine[] // top, jungle, mid, bottom, support
}

export interface GameStats {
    state: 'in_game' | 'paused' | 'finished'
    clock: number // seconds since the first frame (includes pauses)
    patch: string // "16.20"
    blue: SideStats
    red: SideStats
    winner: 'blue' | 'red' | null // a best guess, see guessWinner()
}

const ROLES = ['top', 'jungle', 'mid', 'bottom', 'support']

// Feed timestamps must be whole 10-second marks, in the past.
function feedTime(ms: number): string {
    return new Date(Math.floor(ms / 10000) * 10000).toISOString().replace('.000Z', 'Z')
}

// Live: about a minute behind real time (the broadcast delay). Finished: the final frame.
export async function getGameStats(
    gameId: string,
    live: boolean,
    now = Date.now(),
): Promise<GameStats | null> {
    const start = await fetchStart(gameId)
    const meta = start.gameMetadata
    const startMs = Date.parse(start.frames[0]!.rfc460Timestamp)
    const at = live ? now - 60e3 : Math.min(startMs + 3 * 3600e3, now - 60e3)
    const ttl = live ? 10 : 24 * 3600

    const [window, details] = await Promise.all([
        fetchWindow(gameId, feedTime(at), ttl),
        // Optional: without it the board just has no items.
        fetchDetails(gameId, feedTime(at), ttl).catch(() => null),
    ])

    const frame = window.frames[window.frames.length - 1]!

    const extra = new Map(
        details?.frames[details.frames.length - 1]?.participants.map((p) => [p.participantId, p]),
    )

    const side = (sideMeta: RawSideMetadata, team: RawFrameTeam): SideStats => {
        const byId = new Map(team.participants.map((p) => [p.participantId, p]))

        const players = sideMeta.participantMetadata
            .map((m) => {
                const p = byId.get(m.participantId)
                const x = extra.get(m.participantId)

                return {
                    name: m.summonerName.replace(/^\S+\s+/, ''), // "HLE Zeus" -> "Zeus"
                    champion: m.championId,
                    role: m.role,
                    level: p?.level ?? 0,
                    kills: p?.kills ?? 0,
                    deaths: p?.deaths ?? 0,
                    assists: p?.assists ?? 0,
                    cs: p?.creepScore ?? 0,
                    items: x ? cleanItems(x.items) : [],
                }
            })
            .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))

        return {
            teamId: sideMeta.esportsTeamId,
            gold: team.totalGold,
            kills: team.totalKills,
            towers: team.towers,
            inhibitors: team.inhibitors,
            barons: team.barons,
            dragons: team.dragons,
            players,
        }
    }

    const blue = side(meta.blueTeamMetadata, frame.blueTeam)
    const red = side(meta.redTeamMetadata, frame.redTeam)

    return {
        state: frame.gameState,
        clock: Math.max(0, Math.round((Date.parse(frame.rfc460Timestamp) - startMs) / 1000)),
        patch: meta.patchVersion.split('.').slice(0, 2).join('.'),
        blue,
        red,
        winner: frame.gameState === 'finished' ? guessWinner(blue, red) : null,
    }
}

// The feed has no winner. At the end of a game the winner has almost always destroyed more
// towers (the nexus needs a lane opened); on a tie, the gold lead decides. A surrender while
// even could fool this, so callers prefer the real result when they know it (Bo1s).
function guessWinner(blue: SideStats, red: SideStats): 'blue' | 'red' {
    if (blue.towers !== red.towers) return blue.towers > red.towers ? 'blue' : 'red'

    return blue.gold >= red.gold ? 'blue' : 'red'
}

// Trinkets, wards, potions, elixirs and other consumables add noise to a scoreboard.
const NOT_SHOWN = new Set([
    3340, 3363, 3364, 3330, 3513, 2055, 2003, 2010, 2031, 2033, 2138, 2139, 2140, 2150, 2151, 2152,
])

// The feed lists items in no particular order: finished items (ids from 3000 up) go first.
function cleanItems(items: number[]): number[] {
    const kept = items.filter((id) => !NOT_SHOWN.has(id))

    return [...kept.filter((id) => id >= 3000), ...kept.filter((id) => id < 3000)].slice(0, 6)
}

// ---------- icons (Data Dragon) ----------

// Data Dragon versions look like "16.20.1"; the feed's patch is "16.20". Fall back to latest.
export async function ddragonVersion(patch: string): Promise<string> {
    const versions = await cached('ddragon-versions', 24 * 3600, async () => {
        const res = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')

        if (!res.ok) throw new ApiError(`ddragon versions returned ${res.status}`)

        return res.json<string[]>()
    })

    return versions.find((v) => v.startsWith(`${patch}.`)) ?? versions[0] ?? '16.20.1'
}

export function championIcon(version: string, champion: string): string {
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champion}.png`
}

export function itemIcon(version: string, item: number): string {
    return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item}.png`
}

// ---------- item tooltips (Data Dragon) ----------

export interface ItemInfo {
    name: string
    gold: number // total cost, components included
    stats: string[] // "45 Attack Damage"
    effects: { kind: 'passive' | 'active' | ''; name: string; cooldown: string; text: string }[]
}

interface RawItem {
    name: string
    description: string
    gold: { total: number }
}

// item.json is ~670 KB and never changes for a version, so the edge keeps it and we keep only
// the parsed fields. Some items lack text Riot never filled in (Infinity Edge has no passive).
export async function getItems(version: string): Promise<Map<number, ItemInfo>> {
    return cached(`ddragon-items-${version}`, 7 * 24 * 3600, async () => {
        const data = await ddragonData<RawItem>(version, 'item')

        return new Map(
            Object.entries(data).map(([id, it]) => [
                Number(id),
                { name: it.name, gold: it.gold.total, ...parseDescription(it.description) },
            ]),
        )
    })
}

// Display names by id: the feed only has the id, "KSante" for K'Sante.
export async function getChampions(version: string): Promise<Map<string, string>> {
    return cached(`ddragon-champions-${version}`, 7 * 24 * 3600, async () => {
        const data = await ddragonData<{ name: string }>(version, 'champion')

        return new Map(Object.entries(data).map(([id, c]) => [id, c.name]))
    })
}

// A Data Dragon data file's "data" map. Files never change for a version, so the edge keeps them.
async function ddragonData<T>(version: string, file: 'item' | 'champion'): Promise<Record<string, T>> {
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/${file}.json`, {
        cf: { cacheTtl: 7 * 24 * 3600, cacheEverything: true },
    })

    if (!res.ok) throw new ApiError(`ddragon ${file}.json returned ${res.status}`)

    return (await res.json<{ data: Record<string, T> }>()).data
}

// The description is Riot's own markup: <stats>a<br>b</stats>, then <passive>Name</passive> or
// <active>Name</active>, each followed by its text. Every other tag only colours words.
function parseDescription(description: string): Pick<ItemInfo, 'stats' | 'effects'> {
    const html = description.replace(/<\/?mainText>/g, '')
    const stats = (/<stats>([\s\S]*?)<\/stats>/.exec(html)?.[1] ?? '')
        .split(/<br\s*\/?>/)
        .map(plain)
        .filter(Boolean)

    // [text before, kind, name, text, kind, name, text, ...]. A tag only starts an effect at the
    // start of a line or sentence; mid-sentence it just names one ("Empower your next Cleave").
    const parts = html
        .replace(/<stats>[\s\S]*?<\/stats>/, '')
        .split(/(?<=(?:^|<br\s*\/?>|<li>|<\/rules>|\.)\s*)<(passive|active)>([\s\S]*?)<\/\1>/)
    const effects: ItemInfo['effects'] = []
    const before = plain(parts[0] ?? '')

    if (before) effects.push({ kind: '', name: '', cooldown: '', text: before })

    for (let i = 1; i + 2 < parts.length; i += 3) {
        // The text may open with a cooldown: "(8s, max 4 charges) Grant ...". "(0s)" means none.
        const [, cooldown = '', text = ''] = /^(?:\(([^)]*)\)\s*)?(.*)$/.exec(plain(parts[i + 2]!)) ?? []

        // Some items carry a bare "ACTIVE" heading before the real active: nothing to show.
        if (!text) continue
        effects.push({
            kind: parts[i] as 'passive' | 'active',
            name: plain(parts[i + 1]!).replace(/:$/, ''),
            cooldown: /^0s\b|max 0 charges/.test(cooldown) ? '' : cooldown,
            text,
        })
    }

    return { stats, effects }
}

const plain = (html: string) =>
    html
        .replace(/<br\s*\/?>/g, ' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
