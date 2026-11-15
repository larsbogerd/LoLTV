// Made-up homepages for days the calendar hasn't reached, at /preview/home/<scenario> (local
// dev only). The leagues, teams and past results are real; the 2027 events and their matches
// are invented, so the page can be judged before the API knows the next season.

import type { Event, Match, Ranking, Team } from './data'

export const SCENARIOS = {
    december: { label: 'the winter break', now: '2026-12-10T12:00:00Z' },
    january: { label: 'the leagues are back', now: '2027-01-20T12:00:00Z' },
} as const

export type Scenario = keyof typeof SCENARIOS

export function isScenario(name: string): name is Scenario {
    return name in SCENARIOS
}

// league slug, name suffix, start, end, and the hours (UTC) its two daily matches start
const SEASON = [
    ['lck', 'Split 1 2027', '2027-01-13', '2027-02-28', [8, 10]],
    ['lpl', 'Split 1 2027', '2027-01-14', '2027-03-07', [9, 11]],
    ['lec', 'Split 1 2027', '2027-01-16', '2027-03-01', [16, 18]],
    ['first_stand', '2027', '2027-03-15', '2027-03-21', []],
] as const

export function previewHome(
    scenario: Scenario,
    events: Event[],
    schedule: Match[],
    ranking: Ranking | null,
): { now: Date; events: Event[]; schedule: Match[] } {
    const now = new Date(SCENARIOS[scenario].now)
    const made: Event[] = []
    const matches: Match[] = []

    for (const [slug, suffix, startDate, endDate, hours] of SEASON) {
        const league = events.find((e) => e.league.slug === slug)?.league

        if (!league) continue
        const name = `${league.name} ${suffix}`
        const event = { id: `preview-${slug}`, slug: `preview-${slug}`, name, league, startDate, endDate }
        made.push(event)

        const teams = (ranking?.teams ?? []).filter((t) => t.league?.slug === slug)

        if (teams.length < 4) continue

        // Two matches a day from the start date until three days past "now".
        for (let day = 0, n = 0; ; day++) {
            const date = new Date(Date.parse(`${startDate}T00:00:00Z`) + day * 86400e3)

            if (date.getTime() > now.getTime() + 3 * 86400e3) break

            for (const hour of hours) {
                const start = new Date(date.getTime() + hour * 3600e3)
                const [a, b] = [teams[n % teams.length]!, teams[(n + 1 + (n % 3)) % teams.length]!]
                const done = start < now
                // The better-ranked team wins, with an upset every fourth match.
                const aWins = a.rank < b.rank !== (n % 4 === 3)

                const side = (t: typeof a, won: boolean): Team => ({
                    ...t.team,
                    score: done ? (won ? 2 : n % 2) : null,
                    won: done ? won : null,
                    tbd: false,
                })

                matches.push({
                    id: `preview-${slug}-${n++}`,
                    start: start.toISOString(),
                    state: done ? 'completed' : 'unstarted',
                    bestOf: 3,
                    stage: `Week ${Math.floor(day / 7) + 1}`,
                    leagueSlug: slug,
                    leagueName: league.name,
                    leagueImage: league.image,
                    event,
                    teams: [side(a, aWins), side(b, !aWins)],
                })
            }
        }
    }

    return {
        now,
        events: [...events, ...made],
        schedule: [...schedule, ...matches].sort((a, b) => a.start.localeCompare(b.start)),
    }
}
