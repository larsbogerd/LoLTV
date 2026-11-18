// Swiss stages: the standings table, the HLTV-style bracket, and what a match decides.

import type { Match, Team } from './types'

export function isSwiss(name: string): boolean {
    return /swiss/i.test(name)
}

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

        const roundPools = round.map(([wins, losses, count]): SwissPool & { count: number } => ({
            wins,
            losses,
            count,
            matches: [],
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

// What a match decides (upcoming and live) or decided (finished, told with the result). Swiss
// pools come from swissBracket(); knockout rounds from their stage name. Regional playoffs (often
// double elimination) have no bracket structure in the API, so they get nothing rather than a
// wrong claim.
export function matchStakes(m: Match, eventMatches: Match[]): string | null {
    if (m.teams.some((t) => t.tbd)) return null

    const done = m.state === 'completed'
    const w = m.teams.find((t) => t.won === true)?.code
    const l = m.teams.find((t) => t.won === false)?.code

    // A finished match without a known result: say nothing rather than a future tense.
    if (done && (!w || !l)) return null

    if (isSwiss(m.stage)) {
        const pool = swissBracket(eventMatches.filter((x) => isSwiss(x.stage)))?.pools.find((p) =>
            p.matches.some((x) => x.id === m.id),
        )

        if (!pool) return null
        const record = `${pool.wins}:${pool.losses}`
        const up = pool.wins === 2 ? 'advances' : `to ${pool.wins + 1}:${pool.losses}`
        const down = pool.losses === 2 ? 'is out' : `to ${pool.wins}:${pool.losses + 1}`

        if (done) return `${record} · ${w} ${up}, ${l} ${down}`

        if (pool.wins === 2 && pool.losses === 2) return `${record} · winner advances, loser is out`

        if (pool.wins === 2) return `${record} · winner advances`

        if (pool.losses === 2) return `${record} · loser is out`

        return `${record} · winner ${up}, loser ${down}`
    }

    if (/^finals?$/i.test(m.stage)) return done ? `Final · ${w} won the title` : 'Final · for the title'

    if (/^(quarter|semi)finals?$/i.test(m.stage)) {
        return `${m.stage.replace(/s$/, '')} · ${done ? `${l} is out` : 'loser is out'}`
    }

    return null
}
