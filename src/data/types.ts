import type { RawState } from '../api'

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
