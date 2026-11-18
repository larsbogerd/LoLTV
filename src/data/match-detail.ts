// The match page: games, VODs and streams.

import { fetchEventDetails, type RawEventDetails } from '../api'
import { getEvent } from './events'
import { getEventMatches, toTeam } from './matches'
import { matchStakes } from './swiss'
import type { Match, Team } from './types'

export interface Game {
    id: string
    number: number
    state: string
    blue: Team | null
    red: Team | null
    vod: string | null
}

export interface Stream {
    provider: 'twitch' | 'youtube' | 'kick'
    url: string
}

export interface MatchDetail {
    match: Match | null // schedule entry (has start time, stage, scores)
    details: RawEventDetails
    games: Game[]
    streams: Stream[]
    stakes: string | null // e.g. "1:2 · loser is out", or "1:2 · BLG to 2:2, HLE is out" once played
}

function mediaUrl(provider: string, parameter: string): string | null {
    if (provider === 'youtube') return `https://www.youtube.com/watch?v=${parameter}`

    if (provider === 'twitch') return `https://www.twitch.tv/${parameter}`

    if (provider === 'kick') return `https://kick.com/${parameter}`

    return null
}

export async function getMatchDetail(id: string): Promise<MatchDetail | null> {
    const details = await fetchEventDetails(id)

    if (!details?.match) return null

    const event = await getEvent(details.tournament.id)
    const eventMatches = event ? await getEventMatches(event) : []
    const match = eventMatches.find((m) => m.id === id) ?? null

    const teamsById = new Map(details.match.teams.map((t) => [t.id, toTeam(t)]))

    const games: Game[] = details.match.games
        .filter((g) => g.state !== 'unneeded')
        .map((g) => {
            const side = (s: 'blue' | 'red') => teamsById.get(g.teams.find((t) => t.side === s)?.id) ?? null
            const vod = g.vods.find((v) => v.locale.startsWith('en')) ?? g.vods[0]

            return {
                id: g.id,
                number: g.number,
                state: g.state,
                blue: side('blue'),
                red: side('red'),
                vod: vod ? mediaUrl(vod.provider, vod.parameter) : null,
            }
        })

    // Every English stream is a Riot channel, so the provider is all worth showing.
    const streams = details.streams
        .filter((s) => s.locale.startsWith('en'))
        .map((s) => {
            const url = mediaUrl(s.provider, s.parameter)

            return url ? { provider: s.provider as Stream['provider'], url } : null
        })
        .filter((s): s is Stream => s !== null)

    return { match, details, games, streams, stakes: match ? matchStakes(match, eventMatches) : null }
}
