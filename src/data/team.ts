// The team page: profile, roster and lineup.

import { fetchEventDetails, fetchTeam, fetchTeamEvents, type RawTeamEvent } from '../api'
import { fetchGameMetadata } from '../live'
import type { Person, TeamRoster } from '../transfers'
import { getMoves, getRosters, handleKey, type TeamMove } from '../wiki'
import { getLookups, isInternational, toTeam } from './matches'
import { getRanking, type Placement, type RankedTeam } from './ranking'
import type { Event, Match } from './types'

export interface Player {
    id: string
    handle: string
    name: string // real name
    image: string | null
    role: string // top, jungle, mid, bottom, support, coach
    // From Leaguepedia, so only on a 'wiki' roster:
    country?: string
    contractEnd?: string | null // YYYY-MM-DD
    status?: 'sub' | 'inactive' // why someone on the roster isn't starting
}

export interface Roster {
    // wiki: who is under contract (Leaguepedia). feed: who played the team's latest game.
    source: 'wiki' | 'feed'
    slots: { role: string; player: Player | null }[] // top to support; null is an open slot
    headCoach: Player | null // unknown on a 'feed' roster
    bench: Player[] // players only: the rest of the coaching staff isn't shown
}

// The five starters, when every slot is filled.
export function startingFive(roster: Roster | null): Player[] | null {
    const players = roster?.slots.flatMap((s) => s.player ?? []) ?? []

    return players.length === 5 ? players : null
}

export interface TeamProfile {
    id: string
    slug: string
    name: string
    code: string
    image: string | null
    league: { name: string; region: string; image: string | null } | null
    roster: Roster | null // null when neither source knows the lineup
    moves: TeamMove[] // the team's latest roster moves, newest first
    ranking: (RankedTeam & { leagueRank: number | null }) | null
    achievements: (Placement & { event: Event | null })[]
    upcoming: Match[]
    results: Match[] // newest first, last 120 days (or this year if that's empty), followed leagues only
    matchesAvailable: boolean // false when the team-events query failed
}

const ROLES = ['top', 'jungle', 'mid', 'bottom', 'support']
const roleIndex = (role: string) => (ROLES.includes(role) ? ROLES.indexOf(role) : ROLES.length)

export async function getTeamProfile(id: string, now = new Date()): Promise<TeamProfile | null> {
    const raw = await fetchTeam(id)

    if (!raw) return null
    const day = 86400e3
    const iso = (t: number) => new Date(t).toISOString()
    // Everything thrown here is an Error: ApiError from the clients, or a runtime error.
    const optional = <T>(p: Promise<T>) => p.catch((err: Error) => (console.error(err), null))

    const [lookups, ranking, rosters, feed, recentPast, future] = await Promise.all([
        getLookups(),
        getRanking(now),
        getRosters(),
        getMoves(),
        optional(fetchTeamEvents(raw.id, ['completed'], iso(now.getTime() - 120 * day), iso(now.getTime()))),
        optional(
            fetchTeamEvents(
                raw.id,
                ['unstarted', 'inProgress'],
                iso(now.getTime() - day),
                iso(now.getTime() + 60 * day),
                30,
            ),
        ),
    ])

    // Teams knocked out early haven't played for months: fall back to the whole year.
    const past =
        recentPast?.length === 0
            ? await optional(
                  fetchTeamEvents(
                      raw.id,
                      ['completed'],
                      `${now.getUTCFullYear()}-01-01T00:00:00Z`,
                      iso(now.getTime()),
                  ),
              )
            : recentPast

    // GetTeamEvents gives tournament ids, which are our event ids. Matches in leagues we don't
    // follow are left out, like everywhere else on the site.
    const toTeamMatch = (e: RawTeamEvent): Match | null => {
        const event = lookups.events.find((ev) => ev.id === e.tournament?.id)

        if (!event || !e.match) return null
        const teams = e.matchTeams.map((t) => ({ ...toTeam(t), id: t.teamId ?? t.id, slug: t.slug }))

        if (teams.length !== 2) return null

        if (isInternational(event)) for (const t of teams) if (!t.tbd) t.tag = lookups.homeLeagues.get(t.code)

        return {
            id: e.match.id,
            start: e.startTime,
            state: e.state,
            bestOf: 0, // not in this query
            stage: '',
            leagueSlug: event.league.slug,
            leagueName: event.league.name,
            leagueImage: event.league.image,
            event,
            teams: [teams[0]!, teams[1]!],
        }
    }

    const results = (past ?? [])
        .map(toTeamMatch)
        .filter((m): m is Match => m !== null)
        .sort((a, b) => b.start.localeCompare(a.start))

    const upcoming = (future ?? [])
        .map(toTeamMatch)
        .filter((m): m is Match => m !== null)
        .sort((a, b) => a.start.localeCompare(b.start))

    const players: Player[] = raw.players
        .map((p) => ({
            id: p.id,
            handle: p.summonerName,
            name: `${p.firstName.trim()} ${p.lastName.trim()}`.trim(),
            image: p.image || null,
            role: p.role,
        }))
        .sort((a, b) => roleIndex(a.role) - roleIndex(b.role) || a.handle.localeCompare(b.handle))

    // Who played last: the live match if there is one, else the latest result. Only matches at
    // followed events count: at off-season cups (WSCI, KeSPA Cup) teams often field academy players.
    const latest = upcoming.find((m) => m.state === 'inProgress') ?? results[0]
    const played = async () => (latest ? await optional(lineup(raw.id, raw.code, latest.id, players)) : null)
    const wiki = rosters?.teams[raw.id]
    // A team with nobody at all on Leaguepedia is a team we matched to the wrong page.
    const known = wiki && (wiki.players.length > 0 || wiki.headCoach || wiki.coaches.length > 0)
    const roster = known ? await wikiRoster(wiki, players, played) : feedRoster(await played())

    const rankedTeam = ranking?.teams.find((t) => t.team.id === raw.id)
    const sameLeague = ranking?.teams.filter((t) => t.league && t.league.slug === rankedTeam?.league?.slug)
    const leagueRank = rankedTeam && sameLeague ? sameLeague.indexOf(rankedTeam) + 1 : null

    return {
        id: raw.id,
        slug: raw.slug,
        name: raw.name,
        code: raw.code,
        image: raw.image || null,
        league: raw.homeLeague ? { ...raw.homeLeague, image: rankedTeam?.league?.image ?? null } : null,
        roster,
        moves: (feed?.moves ?? []).filter((m) => m.from.id === raw.id || m.to.id === raw.id).slice(0, 5),
        ranking: rankedTeam ? { ...rankedTeam, leagueRank } : null,
        achievements: (rankedTeam?.placements ?? [])
            .map((p) => {
                const event = lookups.events.find((e) => e.id === p.tournamentId) ?? null

                return { ...p, name: event?.name ?? p.name, event }
            })
            .sort((a, b) => b.end.localeCompare(a.end)),
        upcoming,
        results,
        matchesAvailable: past !== null && future !== null,
    }
}

// The roster a team has now: who is under contract according to Leaguepedia. That is right
// all winter, when the last game played still shows last season's five. Photos and player
// ids come from the lolesports roster, matched by handle. Two starters for one role is the
// one thing Leaguepedia can't settle, so there the last game played decides.
async function wikiRoster(
    wiki: TeamRoster,
    known: Player[],
    played: () => Promise<Player[] | null>,
): Promise<Roster> {
    const byHandle = new Map(known.map((p) => [handleKey(p.handle), p]))

    const player = (p: Person): Player => {
        const match = byHandle.get(handleKey(p.handle))

        return {
            id: match?.id ?? `wiki-${p.pageId}`,
            handle: p.handle,
            name: p.name || match?.name || '',
            image: match?.image ?? null,
            role: p.role,
            country: p.country,
            contractEnd: p.contractEnd,
            status: p.inactive ? 'inactive' : p.sub ? 'sub' : undefined,
        }
    }

    const starters = wiki.players.filter((p) => !p.sub && !p.inactive)
    const contested = ROLES.some((role) => starters.filter((p) => p.role === role).length > 1)
    const lastFive = new Set(((contested ? await played() : null) ?? []).map((p) => handleKey(p.handle)))

    const picks = ROLES.map((role) => {
        const candidates = starters.filter((p) => p.role === role)

        return candidates.find((p) => lastFive.has(handleKey(p.handle))) ?? candidates[0] ?? null
    })

    return {
        source: 'wiki',
        slots: ROLES.map((role, i) => ({ role, player: picks[i] ? player(picks[i]) : null })),
        headCoach: wiki.headCoach ? player(wiki.headCoach) : null,
        bench: wiki.players.filter((p) => !picks.includes(p)).map(player),
    }
}

// Without Leaguepedia: the five who played the team's latest game, and nothing else.
function feedRoster(played: Player[] | null): Roster | null {
    if (!played?.length) return null

    return {
        source: 'feed',
        slots: played.map((p) => ({ role: p.role, player: p })),
        headCoach: null,
        bench: [],
    }
}

// lolesports.com lists everyone attached to a team (subs, academy) without saying who starts.
// The live-stats metadata of the team's latest game does: the five who actually played. A game
// in progress already has its metadata, so a live match gives today's lineup.
async function lineup(
    teamId: string,
    code: string,
    matchId: string,
    roster: Player[],
): Promise<Player[] | null> {
    const details = await fetchEventDetails(matchId)
    const game = details?.match.games.filter((g) => g.state === 'completed' || g.state === 'inProgress').pop()

    if (!game) return null
    const meta = await fetchGameMetadata(game.id)
    const side = [meta?.blueTeamMetadata, meta?.redTeamMetadata].find((s) => s?.esportsTeamId === teamId)

    if (!side) return null
    const byId = new Map(roster.map((p) => [p.id, p]))

    return side.participantMetadata
        .map((p) => {
            const known = byId.get(p.esportsPlayerId)

            if (known) return { ...known, role: p.role }
            // A player who isn't on the roster list (e.g. a stand-in): name only.
            const prefix = `${code} `

            const handle = p.summonerName.startsWith(prefix)
                ? p.summonerName.slice(prefix.length)
                : p.summonerName

            return { id: p.esportsPlayerId, handle, name: '', image: null, role: p.role }
        })
        .sort((a, b) => roleIndex(a.role) - roleIndex(b.role))
}
