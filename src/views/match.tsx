import {
    eventUrl,
    teamUrl,
    type Event,
    type Match,
    type MatchDetail,
    type Player,
    type Team,
    type TeamProfile,
} from '../data'
import { logoUrl } from '../format'
import type { Fmt } from '../format'
import type { GameStats } from '../live'
import { GameBoard, type BoardTeam } from './game'
import { Layout, Logo, Tag } from './ui'

export function MatchPage(props: {
    fmt: Fmt
    detail: MatchDetail
    event: Event | null
    boards: { number: number; stats: GameStats }[]
    version: string
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

    const [a, b] = [teams[0]!, teams[1]!]

    const state =
        m?.state ?? (raw.match.games.some((g) => g.state === 'inProgress') ? 'inProgress' : 'unstarted')

    const bestOf = m?.bestOf ?? raw.match.strategy.count
    const live = state === 'inProgress'
    const title = `${a.name} vs. ${b.name}${event ? ` at ${event.name}` : ''}`
    const side = (t: Team) => (t.won === false ? 'side lost' : 'side')

    return (
        <Layout fmt={fmt} title={title} watch={m ? [m] : []} nav="matches">
            <div class="mhead">
                <div class="score">
                    <TeamSide t={a} cls={side(a)} />
                    <div class="mid">
                        {state === 'unstarted' ? (
                            <div class="big">{m ? fmt.time(m.start) : 'TBD'}</div>
                        ) : (
                            <div class="big">
                                <span class={a.won ? 'w' : live ? '' : 'l'}>{a.score ?? 0}</span>
                                <span style="color:var(--muted)"> - </span>
                                <span class={b.won ? 'w' : live ? '' : 'l'}>{b.score ?? 0}</span>
                            </div>
                        )}
                        {/* HLTV's centre stack: date, event, format, live state. */}
                        {m && <div class="when">{fmt.longDate(m.start)}</div>}
                        <a class="mev" href={event ? eventUrl(event) : undefined}>
                            <Logo src={raw.league.image} size={16} />
                            {event?.name ?? raw.league.name}
                            {m?.stage && ` · ${m.stage}`}
                        </a>
                        <div class="when">Best of {bestOf}</div>
                        {live && <span class="live mlive">LIVE</span>}
                    </div>
                    <TeamSide t={b} cls={side(b)} />
                </div>
                {detail.stakes && <div class="mstakes">{detail.stakes}</div>}
            </div>
            {props.profiles && state === 'unstarted' && props.profiles.every((p) => p.starters.length) && (
                <Lineups lineups={[props.profiles[0].starters, props.profiles[1].starters]} />
            )}

            <div class="split" style="margin-top:16px">
                <section>
                    <h2 class="h">Games</h2>
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
                                            {g.state === 'inProgress' ? (
                                                <span class="live">LIVE</span>
                                            ) : g.state === 'completed' ? (
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
                <div class="col">
                    {props.profiles && (
                        <div class="mform">
                            <Form profiles={props.profiles} matchId={detail.details.id} fmt={fmt} />
                        </div>
                    )}
                    {state !== 'completed' && detail.streams.length > 0 && (
                        <section>
                            <h3 class="label">English streams</h3>
                            <div class="list">
                                {detail.streams.map((s) => (
                                    <a class="li" href={s.url} target="_blank" rel="noopener">
                                        {s.label}
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
            <GameBoards
                boards={props.boards}
                detail={detail}
                version={props.version}
                // In a Bo1 the match result is the game result, so no guessing needed.
                winnerId={bestOf === 1 && state === 'completed' ? teams.find((t) => t.won)?.id : undefined}
            />
        </Layout>
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
    boards: { number: number; stats: GameStats }[]
    detail: MatchDetail
    version: string
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
                    number={b.number}
                    stats={b.stats}
                    teams={teams}
                    version={props.version}
                    winnerId={props.boards.length === 1 ? props.winnerId : undefined}
                    open={b.number === openNumber}
                />
            ))}
        </div>
    )
}

const ROLE_LABEL: Record<string, string> = {
    top: 'TOP',
    jungle: 'JGL',
    mid: 'MID',
    bottom: 'BOT',
    support: 'SUP',
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
                            <span class="lu-role">{ROLE_LABEL[p.role] ?? p.role}</span>
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
                            <span>{ROLE_LABEL[p.role] ?? p.role}</span>
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
