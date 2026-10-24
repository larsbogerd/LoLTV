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
    gold: number
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
    const window = await fetchWindow(gameId, feedTime(at), live ? 10 : 24 * 3600)
    const frame = window.frames[window.frames.length - 1]!

    const side = (sideMeta: RawSideMetadata, team: RawFrameTeam): SideStats => {
        const byId = new Map(team.participants.map((p) => [p.participantId, p]))
        const players = sideMeta.participantMetadata
            .map((m) => {
                const p = byId.get(m.participantId)
                return {
                    name: m.summonerName.replace(/^\S+\s+/, ''), // "HLE Zeus" -> "Zeus"
                    champion: m.championId,
                    role: m.role,
                    level: p?.level ?? 0,
                    kills: p?.kills ?? 0,
                    deaths: p?.deaths ?? 0,
                    assists: p?.assists ?? 0,
                    cs: p?.creepScore ?? 0,
                    gold: p?.totalGold ?? 0,
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

// ---------- champion icons (Data Dragon) ----------

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
