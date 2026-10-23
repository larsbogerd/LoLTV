import { matchUrl, type Event, type Match, type Stage, type SwissRow } from '../data'
import type { Fmt } from '../format'
import { CompactMatch, EventBanner, Layout, Logo } from './ui'

export function EventPage(props: { fmt: Fmt; event: Event; matches: Match[]; stages: Stage[] }) {
    const { fmt, event, matches } = props
    const live = matches.filter((m) => m.state === 'inProgress')
    const next = matches.filter((m) => m.state === 'unstarted').slice(0, 6)
    const recent = matches
        .filter((m) => m.state === 'completed')
        .reverse()
        .slice(0, 6)
    const stage = (live[0] ?? next[0] ?? recent[0])?.stage

    return (
        <Layout fmt={fmt} title={event.name} live={live.length > 0} nav="events">
            <div style="margin-bottom:14px">
                <EventBanner event={event} fmt={fmt} tab="overview" sub={stage} />
            </div>
            <div class="split">
                <div class="col">
                    {props.stages.length === 0 && <div class="empty">No stage information yet.</div>}
                    {/* What's happening now comes first; finished stages fold away at the bottom. */}
                    {[
                        ...props.stages.filter((s) => s.status !== 'done'),
                        ...props.stages.filter((s) => s.status === 'done'),
                    ].map((s) =>
                        s.status === 'done' ? (
                            <details class="stage">
                                <summary class="h">
                                    {s.name} <small>Completed</small>
                                </summary>
                                <StageBody stage={s} fmt={fmt} />
                            </details>
                        ) : (
                            <section class="stage">
                                <h2 class="h">
                                    {s.name} {s.status === 'upcoming' && <small>Upcoming</small>}
                                </h2>
                                <StageBody stage={s} fmt={fmt} />
                            </section>
                        ),
                    )}
                </div>
                <div class="col today">
                    {(live.length > 0 || next.length > 0) && (
                        <section>
                            <h3 class="label">
                                Next up <a href={`/matches?event=${event.id}`}>All</a>
                            </h3>
                            <div class="list">
                                {[...live, ...next].map((m) => (
                                    <MatchWithDate m={m} fmt={fmt} />
                                ))}
                            </div>
                        </section>
                    )}
                    {recent.length > 0 && (
                        <section>
                            <h3 class="label">
                                Latest results <a href={`/results?event=${event.id}`}>All</a>
                            </h3>
                            <div class="list">
                                {recent.map((m) => (
                                    <MatchWithDate m={m} fmt={fmt} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </Layout>
    )
}

function StageBody(props: { stage: Stage; fmt: Fmt }) {
    const s = props.stage
    if (s.kind === 'swiss') return <SwissTable rows={s.swiss ?? []} />
    if (s.kind === 'table') return <RankTable rows={s.table ?? []} />
    return <Bracket columns={s.columns ?? []} fmt={props.fmt} />
}

function MatchWithDate(props: { m: Match; fmt: Fmt }) {
    const { m, fmt } = props
    const rel = fmt.relativeDay(fmt.dayKey(m.start))
    return (
        <>
            <div class="li tm-label">
                {rel ?? fmt.shortDate(m.start)} · {m.stage}
            </div>
            <CompactMatch m={m} fmt={fmt} />
        </>
    )
}

function SwissTable(props: { rows: SwissRow[] }) {
    let prev = ''
    return (
        <table class="stand">
            <thead>
                <tr>
                    <th>Team</th>
                    <th class="c">Record</th>
                    <th class="c">Status</th>
                </tr>
            </thead>
            <tbody>
                {props.rows.map((r) => {
                    const rec = `${r.wins}-${r.losses}`
                    const gap = prev !== '' && prev !== rec
                    prev = rec
                    return (
                        <tr class={`${r.status} ${gap ? 'gap' : ''}`}>
                            <td>
                                <span class="t">
                                    <Logo src={r.team.image} size={20} />
                                    {r.team.name}
                                </span>
                            </td>
                            <td class="c rec">{rec}</td>
                            <td class="c">
                                {r.status === 'qualified' && <span class="pill q">Qualified</span>}
                                {r.status === 'eliminated' && <span class="pill x">Eliminated</span>}
                                {r.status === 'alive' && r.live && <span class="live">LIVE</span>}
                            </td>
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

function RankTable(props: { rows: NonNullable<Stage['table']> }) {
    return (
        <table class="stand">
            <thead>
                <tr>
                    <th class="c">#</th>
                    <th>Team</th>
                    <th class="c">W-L</th>
                </tr>
            </thead>
            <tbody>
                {props.rows.map((r) => (
                    <tr>
                        <td class="c">{r.position}</td>
                        <td>
                            <span class="t">
                                <Logo src={r.team.image} size={20} />
                                {r.team.name}
                            </span>
                        </td>
                        <td class="c rec">
                            {r.wins}-{r.losses}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

function Bracket(props: { columns: { name: string; matches: Match[] }[]; fmt: Fmt }) {
    const { fmt } = props
    return (
        <div class={`bracket ${props.columns.length === 1 ? 'single' : ''}`}>
            {props.columns.map((col) => (
                <div class="bcol">
                    {props.columns.length > 1 && <h4>{col.name}</h4>}
                    {col.matches.map((m) => (
                        <a class={`bm ${m.state}`} href={matchUrl(m)}>
                            <div class="bd">
                                <span>
                                    {fmt.shortDate(m.start)} {fmt.time(m.start)}
                                </span>
                                {m.state === 'inProgress' ? (
                                    <span class="live">LIVE</span>
                                ) : (
                                    <span>bo{m.bestOf}</span>
                                )}
                            </div>
                            {m.teams.map((t) => (
                                <div class={`bt ${t.won === true ? 'won' : t.won === false ? 'lost' : ''}`}>
                                    <Logo src={t.image} size={16} />
                                    <span class="tn">{t.name}</span>
                                    {m.state !== 'unstarted' && <span class="ts">{t.score ?? 0}</span>}
                                </div>
                            ))}
                        </a>
                    ))}
                </div>
            ))}
        </div>
    )
}
