import { eventUrl, type Event, type MatchDetail, type Team } from '../data'
import type { Fmt } from '../format'
import { Layout, Logo, Tag } from './ui'

export function MatchPage(props: { fmt: Fmt; detail: MatchDetail; event: Event | null }) {
    const { fmt, detail, event } = props
    const m = detail.match
    const raw = detail.details
    const teams: Team[] =
        m?.teams ??
        raw.match.teams.map((t) => ({
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
                <div class="mhead-ev">
                    <Logo src={raw.league.image} size={18} />
                    {event ? <a href={eventUrl(event)}>{event.name}</a> : <span>{raw.league.name}</span>}
                    {m?.stage && <span>· {m.stage}</span>}
                </div>
                <div class="score">
                    <div class={side(a)}>
                        <Logo src={a.image} size={64} />
                        {a.name}
                        <Tag t={a} />
                    </div>
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
                        <div class="when">
                            {live ? (
                                <span class="live">LIVE</span>
                            ) : (
                                m &&
                                `${fmt.relativeDay(fmt.dayKey(m.start)) ?? ''} ${fmt.shortDate(m.start)}`.trim()
                            )}
                        </div>
                        <div class="when">Best of {bestOf}</div>
                    </div>
                    <div class={side(b)}>
                        <Logo src={b.image} size={64} />
                        {b.name}
                        <Tag t={b} />
                    </div>
                </div>
            </div>

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
                                        <td class="c">{g.vod ? <a href={g.vod}>Watch</a> : '–'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div class="empty">Games appear once the match is set.</div>
                    )}
                </section>
                {state !== 'completed' && detail.streams.length > 0 && (
                    <section>
                        <h3 class="label">English streams</h3>
                        <div class="list">
                            {detail.streams.map((s) => (
                                <a class="li" href={s.url}>
                                    {s.label}
                                </a>
                            ))}
                        </div>
                    </section>
                )}
            </div>
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
