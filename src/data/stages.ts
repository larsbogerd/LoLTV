// The stages of an event (Swiss, tables, brackets) and its final placements.

import { fetchStandings, type RawStage } from '../api'
import { toTeam } from './matches'
import { isSwiss, swissBracket, swissTable, type SwissBracket, type SwissRow } from './swiss'
import type { Event, Match, Team } from './types'

export interface Stage {
    name: string
    status: 'done' | 'active' | 'upcoming'
    kind: 'swiss' | 'table' | 'bracket' | 'double'
    swiss?: SwissRow[]
    swissBracket?: SwissBracket | null
    tables?: { name: string; rows: { position: number; team: Team; wins: number; losses: number }[] }[]
    columns?: { name: string; matches: Match[] }[] // one column = plain grid, several = bracket
    double?: DoubleElim
}

export interface DoubleRound {
    name: string
    round: number // 1-based within its side
    matches: Match[]
}

export interface DoubleElim {
    upper: DoubleRound[]
    lower: DoubleRound[]
    final: Match | null
    pending: Match[] // TBD vs TBD: no way to tell which side of the bracket they're on yet
    from: Record<string, string[]> // match id -> ids of the matches its teams came from
    drop: Record<string, string> // upper match id -> lower match its loser went on to play
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
            const columns = bracketColumns(stage.name, matches)
            const double = columns.length === 1 ? doubleElim(matches) : null

            stages.push(
                double
                    ? { name: stage.name, status, kind: 'double', double }
                    : { name: stage.name, status, kind: 'bracket', columns },
            )
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

// Double elimination, rebuilt from results because the API has no bracket structure. A team is
// in the upper bracket until it loses; a team that first shows up against a lower-bracket team
// was seeded into the lower bracket (LEC seeds 5-6). Upper meets lower only in the grand final.
// A match is one round past the latest round either team reached on that side, so byes (LCK
// seeds 1-2 start in upper round 2) still line up.
export function doubleElim(matches: Match[]): DoubleElim | null {
    const sorted = [...matches].sort((a, b) => a.start.localeCompare(b.start))
    const side = new Map<string, 'upper' | 'lower' | 'out'>()
    const reached = { upper: new Map<string, number>(), lower: new Map<string, number>() }
    const last = new Map<string, string>() // team -> id of its latest match
    const rounds = { upper: new Map<number, Match[]>(), lower: new Map<number, Match[]>() }
    const from: Record<string, string[]> = {}
    const drop: Record<string, string> = {}
    const droppedFrom = new Map<string, string>() // team -> upper match it dropped from
    const pending: Match[] = []
    let final: Match | null = null

    for (const m of sorted) {
        const known = m.teams.filter((t) => !t.tbd)

        if (!known.length) {
            pending.push(m)
            continue
        }

        const sides = known.map((t) => side.get(t.code))
        const hasLower = sides.includes('lower')
        const hasUpper = sides.includes('upper')
        const where = hasLower && hasUpper ? 'final' : hasLower ? 'lower' : 'upper'

        from[m.id] = known.map((t) => last.get(t.code)).filter((id): id is string => !!id)

        if (where === 'final') {
            final = m
        } else {
            const round = Math.max(...known.map((t) => reached[where].get(t.code) ?? 0)) + 1

            rounds[where].set(round, [...(rounds[where].get(round) ?? []), m])

            for (const t of known) {
                reached[where].set(t.code, round)

                const dropped = droppedFrom.get(t.code)

                if (where === 'lower' && dropped) {
                    drop[dropped] = m.id
                    droppedFrom.delete(t.code)
                }
            }
        }

        for (const t of known) {
            last.set(t.code, m.id)
            if (!side.has(t.code)) side.set(t.code, where === 'lower' ? 'lower' : 'upper')
        }

        const loser = m.teams.find((t) => t.won === false)

        if (loser && where !== 'final') {
            if (side.get(loser.code) === 'upper') {
                side.set(loser.code, 'lower')
                droppedFrom.set(loser.code, m.id)
            } else {
                side.set(loser.code, 'out')
            }
        }
    }

    // Not double elimination unless someone actually played on after a loss.
    if (!rounds.upper.size || !rounds.lower.size) return null

    const named = (which: 'upper' | 'lower'): DoubleRound[] => {
        const list = [...rounds[which]].sort(([a], [b]) => a - b)
        const label = which === 'upper' ? 'Upper' : 'Lower'

        return list.map(([round, ms], i) => {
            const fromEnd = list.length - 1 - i
            const name =
                fromEnd === 0
                    ? `${label} final`
                    : fromEnd === 1 && which === 'upper'
                      ? 'Upper semifinals'
                      : `${label} round ${round}`

            return { name, round, matches: ms }
        })
    }

    return { upper: named('upper'), lower: named('lower'), final, pending, from, drop }
}

// Where a team finished an event. Teams that went out in the same round share places from..to
// (3-4th, 5-8th).
export interface Finish {
    team: Team
    from: number
    to: number
}

// Final placements of a finished event, read off its last real bracket: the final's winner and
// loser, then each earlier round's losers. In double elimination everyone but the finalists goes
// out in the lower bracket. A later stage that isn't a bracket decides something else (LPL's
// regional qualifier), and teams that never reached the bracket aren't placed.
export function finalPlacements(stages: Stage[]): Finish[] {
    const stage = [...stages].reverse().find((s) => s.double || (s.columns?.length ?? 0) > 1)

    if (!stage) return []

    const rounds = stage.double
        ? [...stage.double.lower.map((r) => r.matches), stage.double.final ? [stage.double.final] : []]
        : (stage.columns ?? []).map((c) => c.matches)

    const final = rounds.pop() ?? []
    const winner = final[0]?.teams.find((t) => t.won === true)

    if (final.length !== 1 || !winner) return []
    const out: Finish[] = [{ team: winner, from: 1, to: 1 }]

    for (const matches of [final, ...rounds.reverse()]) {
        const losers = matches.flatMap((m) => m.teams.filter((t) => t.won === false))
        const from = out.length + 1

        for (const team of losers) out.push({ team, from, to: from + losers.length - 1 })
    }

    return out
}
