// The Global Power Ranking.

import { fetchPowerRankings } from '../api'

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
