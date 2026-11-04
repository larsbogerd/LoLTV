import {
    eventUrl,
    teamUrl,
    type Event,
    type Match,
    type MatchDetail,
    type Player,
    type Stream,
    type Team,
    type TeamProfile,
} from '../data'
import { logoUrl } from '../format'
import type { Fmt } from '../format'
import type { GameStats, ItemInfo } from '../live'
import { GameBoard, type BoardTeam } from './game'
import { Layout, Logo, roleLabel, Tag } from './ui'

export function MatchPage(props: {
    fmt: Fmt
    detail: MatchDetail
    event: Event | null
    boards: { id: string; number: number; stats: GameStats }[]
    version: string
    items: Map<number, ItemInfo> | null
    champions: Map<string, string> | null
    profiles: [TeamProfile, TeamProfile] | null
}) {
    const { fmt, detail, event } = props
    const m = detail.match
    const raw = detail.details

    const teams: Team[] =
        m?.teams ??
        raw.match.teams.map((t) => ({
            id: t.id,
            name: t.name,
            code: t.code,
            image: t.image,
            score: t.result?.gameWins ?? null,
            won: null,
            tbd: t.code === 'TBD',
        }))

    const state =
        m?.state ?? (raw.match.games.some((g) => g.state === 'inProgress') ? 'inProgress' : 'unstarted')

    const bestOf = m?.bestOf ?? raw.match.strategy.count
    const live = state === 'inProgress'
    const [a, b] = live ? withFeedScore(teams, detail, props.boards, bestOf) : [teams[0]!, teams[1]!]
    // Some of the score comes from the live feed, not Riot's results (yet).
    const unofficial = a.score !== teams[0]!.score || b.score !== teams[1]!.score
    const decided = a.won !== null
    const title = `${a.name} vs. ${b.name}${event ? ` at ${event.name}` : ''}`
    const side = (t: Team) => (t.won === false ? 'side lost' : 'side')
    // Form only matters before a match; once it's on, the sidebar is just streams.
    const form = state === 'unstarted' ? props.profiles : null
    const streams = state !== 'completed' && detail.streams.length > 0
    const splitCls = ['split', live && 'mfull', !form && !streams && 'solo'].filter(Boolean).join(' ')

    return (
        <Layout fmt={fmt} title={title} watch={m ? [m] : []} nav="matches">
            <div class="mhead">
                <div class="score">
                    <TeamSide t={a} cls={side(a)} />
                    <div class="mid">
                        {state === 'unstarted' ? (
                            <div class="big">{m ? fmt.time(m.start) : 'TBD'}</div>
                        ) : (
                            <div
                                class="big"
                                title={
                                    unofficial
                                        ? 'From the live game feed, not yet confirmed by Riot'
                                        : undefined
                                }
                            >
                                <span class={a.won ? 'w' : live && !decided ? '' : 'l'}>{a.score ?? 0}</span>
                                <span style="color:var(--muted)"> - </span>
                                <span class={b.won ? 'w' : live && !decided ? '' : 'l'}>{b.score ?? 0}</span>
                            </div>
                        )}
                        {/* HLTV's centre stack: date, event, format, live state. */}
                        {m && <div class="when">{fmt.longDate(m.start)}</div>}
                        <a class="mhead-ev" href={event ? eventUrl(event) : undefined}>
                            <Logo src={raw.league.image} size={16} />
                            {event?.name ?? raw.league.name}
                            {m?.stage && ` · ${m.stage}`}
                        </a>
                        <div class="when">Best of {bestOf}</div>
                        {live && !decided && <span class="live mlive">LIVE</span>}
                    </div>
                    <TeamSide t={b} cls={side(b)} />
                </div>
                {detail.stakes && <div class="mstakes">{detail.stakes}</div>}
            </div>
            {props.profiles && state === 'unstarted' && props.profiles.every((p) => p.starters.length) && (
                <Lineups lineups={[props.profiles[0].starters, props.profiles[1].starters]} />
            )}

            {live && (
                // Phones while a game is on: the scoreboard below is the point, so games and streams
                // shrink to a side-by-side pair (and the full split below is hidden).
                <div class="mlivebar">
                    <LiveGames detail={detail} boards={props.boards} />
                    <section>
                        <h2 class="h">Watch</h2>
                        {detail.streams.length ? (
                            <Streams streams={detail.streams} />
                        ) : (
                            <div class="empty">No English streams.</div>
                        )}
                    </section>
                </div>
            )}
            <div class={splitCls} style="margin-top:16px">
                <section>
                    <GamesHeading boards={props.boards} />
                    {detail.games.length ? (
                        <table class="stand games">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Blue side</th>
                                    <th>Red side</th>
                                    <th class="c">Status</th>
                                    <th class="c">VOD</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detail.games.map((g) => (
                                    <tr>
                                        <td>Game {g.number}</td>
                                        <td>{g.blue ? <TeamCell t={g.blue} /> : 'TBD'}</td>
                                        <td>{g.red ? <TeamCell t={g.red} /> : 'TBD'}</td>
                                        <td class="c">
                                            {gameState(g, props.boards) === 'inProgress' ? (
                                                <span class="live">LIVE</span>
                                            ) : gameState(g, props.boards) === 'completed' ? (
                                                'Played'
                                            ) : (
                                                '–'
                                            )}
                                        </td>
                                        <td class="c">
                                            {g.vod ? (
                                                <a href={g.vod} target="_blank" rel="noopener">
                                                    Watch
                                                </a>
                                            ) : (
                                                '–'
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div class="empty">Games appear once the match is set.</div>
                    )}
                </section>
                {(form || streams) && (
                    <div class="col">
                        {form && (
                            <div class="mform">
                                <Form profiles={form} matchId={detail.details.id} fmt={fmt} />
                            </div>
                        )}
                        {streams && (
                            <section>
                                <h2 class="h">Watch</h2>
                                <Streams streams={detail.streams} />
                            </section>
                        )}
                    </div>
                )}
            </div>
            <GameBoards
                boards={props.boards}
                detail={detail}
                version={props.version}
                items={props.items}
                champions={props.champions}
                // In a Bo1 the match result is the game result, so no guessing needed.
                winnerId={bestOf === 1 && state === 'completed' ? teams.find((t) => t.won)?.id : undefined}
            />
        </Layout>
    )
}

// Riot's results trail the live feed by minutes: a game can be over on the feed (and on stream)
// while the match still says it's in progress. Feed-finished games Riot hasn't counted yet are
// added to the score with the feed's best-guess winner, until Riot's own numbers catch up.
// Games are played in order, so Riot's total says which games it has counted: the first N.
function withFeedScore(
    teams: Team[],
    detail: MatchDetail,
    boards: { number: number; stats: GameStats }[],
    bestOf: number,
): [Team, Team] {
    const [a, b] = [{ ...teams[0]! }, { ...teams[1]! }]
    const counted = (a.score ?? 0) + (b.score ?? 0)
    const codeOf = (teamId: string) => detail.details.match.teams.find((t) => t.id === teamId)?.code

    for (const { number, stats } of boards) {
        if (number <= counted || stats.state !== 'finished' || !stats.winner) continue
        const code = codeOf(stats[stats.winner].teamId)
        const t = code === a.code ? a : code === b.code ? b : null

        if (t) t.score = (t.score ?? 0) + 1
    }

    const needed = Math.floor(bestOf / 2) + 1

    if ((a.score ?? 0) >= needed || (b.score ?? 0) >= needed) {
        a.won = (a.score ?? 0) >= needed
        b.won = !a.won
    }

    return [a, b]
}

// A game's state, with the live feed's word on when it ended (Riot's lags behind).
function gameState(
    g: { number: number; state: string },
    boards: { number: number; stats: GameStats }[],
): string {
    const finished = boards.find((b) => b.number === g.number)?.stats.state === 'finished'

    return g.state === 'inProgress' && finished ? 'completed' : g.state
}

// The patch is the same for every game in a match, so it's said once, here.
function GamesHeading(props: { boards: { stats: GameStats }[] }) {
    const patches = [...new Set(props.boards.map((b) => b.stats.patch))]

    return (
        <h2 class="h">
            Games
            {patches.length > 0 && <small>Patch {patches.join(', ')}</small>}
        </h2>
    )
}

// Live view of the games: number and outcome only. Sides and VODs can wait until it's over;
// winners are the scoreboard's best guess, same as the boards below.
function LiveGames(props: { detail: MatchDetail; boards: { number: number; stats: GameStats }[] }) {
    const teams = props.detail.details.match.teams

    return (
        <section>
            <GamesHeading boards={props.boards} />
            <div class="list">
                {props.detail.games.map((g) => {
                    const stats = props.boards.find((b) => b.number === g.number)?.stats
                    const winnerId = stats?.winner ? stats[stats.winner].teamId : null
                    const winner = winnerId ? teams.find((t) => t.id === winnerId) : null

                    return (
                        <div class="li">
                            <span class="grow">Game {g.number}</span>
                            {gameState(g, props.boards) === 'inProgress' ? (
                                <span class="live">LIVE</span>
                            ) : winner ? (
                                <span class="lg-win" title={`${winner.name} won`}>
                                    <Logo src={winner.image} size={16} />
                                    {winner.code}
                                </span>
                            ) : (
                                <span class="sub">
                                    {gameState(g, props.boards) === 'completed' ? 'Played' : '–'}
                                </span>
                            )}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

const PROVIDERS: Record<Stream['provider'], { name: string; color: string; path: string }> = {
    twitch: {
        name: 'Twitch',
        color: '#a970ff',
        path: 'M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z',
    },
    youtube: {
        name: 'YouTube',
        color: '#ff3d3d',
        path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
    },
    kick: {
        name: 'Kick',
        color: '#53fc18',
        path: 'M2 2h6v6h2V6h2V4h2V2h6v6h-2v2h-2v4h2v2h2v4h-6v-2h-2v-2h-2v-2H8v6H2z',
    },
}

function Streams(props: { streams: Stream[] }) {
    return (
        <div class="list">
            {props.streams.map((s) => {
                const p = PROVIDERS[s.provider]

                return (
                    <a class="li" href={s.url} target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill={p.color} aria-hidden="true">
                            <path d={p.path} />
                        </svg>
                        {p.name}
                    </a>
                )
            })}
        </div>
    )
}

function TeamCell(props: { t: Team }) {
    return (
        <span class="t">
            <Logo src={props.t.image} size={18} />
            {props.t.code}
        </span>
    )
}

// Logo, name and league as one box that opens the team page.
function TeamSide(props: { t: Team; cls: string }) {
    const { t } = props
    const url = teamUrl(t)

    const body = (
        <>
            <Logo src={t.image} size={64} />
            <span>{t.name}</span>
            <Tag t={t} />
        </>
    )

    return url ? (
        <a class={props.cls} href={url} title={`${t.name} team page`}>
            {body}
        </a>
    ) : (
        <div class={props.cls}>{body}</div>
    )
}

// One scoreboard per started game: the live one open, else the latest finished one.
function GameBoards(props: {
    boards: { id: string; number: number; stats: GameStats }[]
    detail: MatchDetail
    version: string
    items: Map<number, ItemInfo> | null
    champions: Map<string, string> | null
    winnerId?: string
}) {
    if (!props.boards.length) return null

    const teams = new Map<string, BoardTeam>(
        props.detail.details.match.teams.flatMap((t) =>
            t.id ? [[t.id, { code: t.code, image: t.image }]] : [],
        ),
    )

    const live = props.boards.find((b) => b.stats.state !== 'finished')
    const openNumber = (live ?? props.boards[props.boards.length - 1])!.number

    return (
        <div class="gboards">
            {props.boards.map((b) => (
                <GameBoard
                    id={b.id}
                    number={b.number}
                    stats={b.stats}
                    teams={teams}
                    version={props.version}
                    items={props.items}
                    champions={props.champions}
                    winnerId={props.boards.length === 1 ? props.winnerId : undefined}
                    open={b.number === openNumber}
                />
            ))}
        </div>
    )
}

// Only shown before a match starts. Desktop: each team's five in a row under their side, both
// in lane order (top to support). Phones: compact rows, role by role.
function Lineups(props: { lineups: [Player[], Player[]] }) {
    const [a, b] = props.lineups

    return (
        <section class="lineups">
            <div class="lu-desk">
                <LineupGroup players={a} />
                <span class="lu-vs">vs</span>
                <LineupGroup players={b} />
            </div>
            <div class="list lu-rows">
                {a.map((p, i) => {
                    const q = b[i]

                    return (
                        <div class="lu-row">
                            <LineupPlayer p={p} side="l" />
                            <span class="lu-role">{roleLabel(p.role)}</span>
                            {q ? <LineupPlayer p={q} side="r" /> : <span />}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

// Same size side by side: every league crops its headshots differently, so overlapping or
// scaling them makes some heads look huge.
function LineupGroup(props: { players: Player[] }) {
    return (
        <div class="lu-group">
            {props.players.map((p) => {
                const photo = logoUrl(p.image, 200)

                return (
                    <figure class="lu-fig">
                        {photo ? (
                            <img src={photo} alt="" loading="lazy" decoding="async" />
                        ) : (
                            <div class="lu-blank" />
                        )}
                        <figcaption>
                            <b>{p.handle}</b>
                            <span>{roleLabel(p.role)}</span>
                        </figcaption>
                    </figure>
                )
            })}
        </div>
    )
}

function LineupPlayer(props: { p: Player; side: 'l' | 'r' }) {
    const photo = logoUrl(props.p.image, 48)

    return (
        <span class={`lu-p ${props.side}`}>
            {photo ? (
                <img src={photo} width={24} height={24} alt="" loading="lazy" />
            ) : (
                <span class="lu-nophoto" />
            )}
            <b>{props.p.handle}</b>
        </span>
    )
}

// ---------- recent form (sidebar) ----------

function own(m: Match, t: TeamProfile): Team | undefined {
    return m.teams.find((x) => x.id === t.id || x.code === t.code)
}

function Form(props: { profiles: [TeamProfile, TeamProfile]; matchId: string; fmt: Fmt }) {
    const others = (t: TeamProfile) => t.results.filter((m) => m.id !== props.matchId)

    return (
        <section>
            <h2 class="h">Recent form</h2>
            <div class="list">
                {props.profiles.map((t) => (
                    <a class="li" href={teamUrl(t) ?? undefined}>
                        <Logo src={t.image} size={18} />
                        <b class="grow">{t.code}</b>
                        <span class="form">
                            {others(t)
                                .slice(0, 5)
                                .map((m) => {
                                    const us = own(m, t)
                                    const them = m.teams.find((x) => x !== us)
                                    const label = `${us?.won ? 'Win' : 'Loss'} vs ${them?.code ?? '?'} ${us?.score ?? 0}-${them?.score ?? 0}, ${props.fmt.shortDate(m.start)}`

                                    return (
                                        <span class={us?.won ? 'w' : 'l'} title={label}>
                                            {us?.won ? 'W' : 'L'}
                                        </span>
                                    )
                                })}
                        </span>
                    </a>
                ))}
            </div>
        </section>
    )
}
