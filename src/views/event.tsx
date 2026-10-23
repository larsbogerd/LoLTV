import { matchUrl, teamUrl, type Event, type Match, type Stage, type SwissRow, type Team } from '../data'
import { dateRange, type Fmt } from '../format'
import { CompactMatch, EventBanner, Layout, Logo, Tag, TeamName } from './ui'

const STATUS_LABEL = { active: 'In progress', upcoming: 'Upcoming', done: 'Completed' }

export function EventPage(props: { fmt: Fmt; event: Event; matches: Match[]; stages: Stage[] }) {
    const { fmt, event, matches, stages } = props
    const live = matches.filter((m) => m.state === 'inProgress')
    const next = matches.filter((m) => m.state === 'unstarted').slice(0, 6)
    const recent = matches
        .filter((m) => m.state === 'completed')
        .reverse()
        .slice(0, 6)
    const stage = (live[0] ?? next[0] ?? recent[0])?.stage
    const teams = new Set(matches.flatMap((m) => m.teams.filter((t) => !t.tbd).map((t) => t.code)))

    // Stages stay in their natural order (like HLTV); only the one in play is unfolded.
    // Between stages that's the next one up, and once everything is done, the last one.
    const anyActive = stages.some((s) => s.status === 'active')
    const fallback = stages.find((s) => s.status === 'upcoming') ?? stages[stages.length - 1]
    const isOpen = (s: Stage) => (anyActive ? s.status === 'active' : s === fallback)

    return (
        <Layout fmt={fmt} title={event.name} watch={matches} nav="events">
            <EventBanner event={event} fmt={fmt} tab="overview" sub={stage} />
            <div class="einfo">
                <div>
                    <span>Date</span>
                    <b>{dateRange(event.startDate, event.endDate)}</b>
                </div>
                <div>
                    <span>Teams</span>
                    <b>{teams.size || '–'}</b>
                </div>
                <div>
                    <span>Current stage</span>
                    <b>{stage ?? '–'}</b>
                </div>
                <div>
                    <span>Region</span>
                    <b>{event.league.region.toLowerCase()}</b>
                </div>
            </div>

            {stages.length === 0 && <div class="empty">No stage information yet.</div>}
            {stages.map((s) => (
                <details class="stage" open={isOpen(s) || undefined}>
                    <summary class="h">
                        {s.name} <small>{STATUS_LABEL[s.status]}</small>
                    </summary>
                    <StageBody stage={s} fmt={fmt} />
                </details>
            ))}

            <div class="egrid">
                {(live.length > 0 || next.length > 0) && (
                    <section class="today">
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
                    <section class="today">
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
        </Layout>
    )
}

function StageBody(props: { stage: Stage; fmt: Fmt }) {
    const s = props.stage
    if (s.kind === 'swiss') return <SwissStage stage={s} fmt={props.fmt} />
    if (s.kind === 'table') {
        const tables = s.tables ?? []
        return (
            <div class="tables">
                {tables.map((t) => (
                    <div>
                        {tables.length > 1 && <h4 class="label">{t.name}</h4>}
                        <RankTable rows={t.rows} />
                    </div>
                ))}
            </div>
        )
    }
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

// ---------- Swiss: HLTV "group play" bracket ----------

function SwissStage(props: { stage: Stage; fmt: Fmt }) {
    const b = props.stage.swissBracket
    const table = <SwissTable rows={props.stage.swiss ?? []} />
    if (!b) return table

    const pool = (wins: number, losses: number) => {
        const p = b.pools.find((x) => x.wins === wins && x.losses === losses)
        return p && <SwissPool label={`${wins}:${losses}`} matches={p.matches} fmt={props.fmt} />
    }
    const outcome = (wins: number, losses: number) => {
        const o = b.outcomes.find((x) => x.wins === wins && x.losses === losses)
        return o && <SwissOutcome label={`${wins}:${losses}`} teams={o.teams} qualified={wins > losses} />
    }

    return (
        <>
            <div class="swiss-scroll">
                <div class="swiss">
                    <div class="sw-col">{pool(0, 0)}</div>
                    <div class="sw-col">
                        {pool(1, 0)}
                        {pool(0, 1)}
                    </div>
                    <div class="sw-col">
                        {pool(2, 0)}
                        {pool(1, 1)}
                        {pool(0, 2)}
                    </div>
                    <div class="sw-col edge">
                        {outcome(3, 0)}
                        {pool(2, 1)}
                        {pool(1, 2)}
                        {outcome(0, 3)}
                    </div>
                    <div class="sw-col edge">
                        {outcome(3, 1)}
                        {pool(2, 2)}
                        {outcome(1, 3)}
                    </div>
                    <div class="sw-col edge">
                        {outcome(3, 2)}
                        {outcome(2, 3)}
                    </div>
                </div>
            </div>
            <details class="sub">
                <summary>Standings table</summary>
                {table}
            </details>
        </>
    )
}

function SwissPool(props: { label: string; matches: Match[]; fmt: Fmt }) {
    const { fmt } = props
    return (
        <div class="sw-pool">
            <div class="sw-rec">{props.label}</div>
            {props.matches.map((m) => {
                const [a, b] = m.teams
                const when = `${fmt.relativeDay(fmt.dayKey(m.start)) ?? fmt.shortDate(m.start)} ${fmt.time(m.start)} · bo${m.bestOf}`
                return (
                    <a class={`sw-m ${m.state}`} href={matchUrl(m)} title={when}>
                        <SwissSide t={a} />
                        <span class="sw-s">
                            {m.state === 'unstarted' ? 'vs' : `${a.score ?? 0}:${b.score ?? 0}`}
                        </span>
                        <SwissSide t={b} right />
                    </a>
                )
            })}
        </div>
    )
}

function SwissSide(props: { t: Team; right?: boolean }) {
    const { t } = props
    const cls = ['sw-t', props.right && 'r', t.won === false && 'lost'].filter(Boolean).join(' ')
    const logo = t.tbd ? <span class="sw-q">?</span> : <Logo src={t.image} size={16} />
    const name = <span class="tn">{t.tbd ? '' : t.code}</span>
    return <span class={cls}>{props.right ? [name, logo] : [logo, name]}</span>
}

function SwissOutcome(props: { label: string; teams: (Team | null)[]; qualified: boolean }) {
    return (
        <div class={`sw-out ${props.qualified ? 'q' : 'x'}`}>
            <div class="sw-rec">{props.label}</div>
            <div class="sw-teams">
                {props.teams.map((t) =>
                    t ? (
                        <a class="sw-ot" title={t.name} href={teamUrl(t) ?? undefined}>
                            <Logo src={t.image} size={22} />
                            {t.code}
                        </a>
                    ) : (
                        <span class="sw-ot">
                            <span class="sw-q">?</span>
                        </span>
                    ),
                )}
            </div>
        </div>
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
                                    <TeamName t={r.team} />
                                    <Tag t={r.team} />
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

// ---------- other stage types ----------

function RankTable(props: { rows: NonNullable<Stage['tables']>[number]['rows'] }) {
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
                                <TeamName t={r.team} />
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
                                    {props.columns.length === 1 &&
                                        m.stage &&
                                        m.stage !== col.name &&
                                        ` · ${m.stage}`}
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
                                    <Tag t={t} />
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
