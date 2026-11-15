import {
    eventStatus,
    finalPlacements,
    matchUrl,
    teamUrl,
    type DoubleElim,
    type Event,
    type Finish,
    type Match,
    type Stage,
    type SwissRow,
    type Team,
} from '../data'
import { dateRange, ordinal, type Fmt } from '../format'
import { CompactMatch, EventBanner, Layout, Logo, Tag, TeamName } from './ui'

// Next up / Latest results stay short; the full lists are one click away. Four fits a
// whole knockout round (Worlds quarterfinals) without burying the bracket.
const LIST_CAP = 4

const STATUS_LABEL = { active: 'In progress', upcoming: 'Upcoming', done: 'Completed' }

export function EventPage(props: { fmt: Fmt; event: Event; matches: Match[]; stages: Stage[] }) {
    const { fmt, event, matches, stages } = props
    const live = matches.filter((m) => m.state === 'inProgress')
    const next = matches.filter((m) => m.state === 'unstarted').slice(0, Math.max(0, LIST_CAP - live.length))

    const recent = matches
        .filter((m) => m.state === 'completed')
        .reverse()
        .slice(0, LIST_CAP)

    const stage = (live[0] ?? next[0] ?? recent[0])?.stage
    const teams = new Set(matches.flatMap((m) => m.teams.filter((t) => !t.tbd).map((t) => t.code)))
    // A finished event leads with who finished where. That says more than its last few results,
    // so those make way; without a bracket to read placements from, they stay.
    const over = eventStatus(event, new Date(), matches) === 'finished'
    const places = over ? finalPlacements(stages) : []

    // Stages stay in their natural order (like HLTV); only the one in play is unfolded.
    // Between stages that's the next one up, and once everything is done, the last one.
    const anyActive = stages.some((s) => s.status === 'active')
    const fallback = stages.find((s) => s.status === 'upcoming') ?? stages[stages.length - 1]
    const isOpen = (s: Stage) => (anyActive ? s.status === 'active' : s === fallback)

    return (
        <Layout fmt={fmt} title={event.name} watch={matches} nav="events">
            <EventBanner
                event={event}
                fmt={fmt}
                matches={matches}
                tab="overview"
                sub={over ? undefined : stage}
            />
            <div class="einfo">
                <div>
                    <span>Date</span>
                    <b>{dateRange(event.startDate, event.endDate)}</b>
                </div>
                <div>
                    <span>Teams</span>
                    <b>{teams.size || '–'}</b>
                </div>
                {!over && (
                    <div>
                        <span>Current stage</span>
                        <b>{stage ?? '–'}</b>
                    </div>
                )}
                <div>
                    <span>Region</span>
                    <b>{event.league.region.toLowerCase()}</b>
                </div>
            </div>

            {places.length > 0 && <Placements places={places} />}

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
                {recent.length > 0 && places.length === 0 && (
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

// HLTV's prize distribution box, without the prizes: the finalists large, the rest below.
function Placements(props: { places: Finish[] }) {
    return (
        <section>
            <h2 class="h">Final placements</h2>
            <div class="places">
                {props.places.map((p) => {
                    const top = p.to <= 2
                    const cls = `pl p${p.from} ${top ? 'top' : ''} ${p.to <= 4 ? 'wide' : ''}`
                    const url = teamUrl(p.team)

                    const body = (
                        <>
                            <Logo src={p.team.image} size={top ? 48 : 28} />
                            <span class="pl-name">
                                <span class="tn">{p.team.name}</span>
                                <Tag t={p.team} />
                            </span>
                            <span class="pl-rank">
                                {p.from === p.to ? ordinal(p.from) : `${p.from}-${ordinal(p.to)}`}
                            </span>
                        </>
                    )

                    return url ? (
                        <a class={cls} href={url}>
                            {body}
                        </a>
                    ) : (
                        <div class={cls}>{body}</div>
                    )
                })}
            </div>
        </section>
    )
}

function StageBody(props: { stage: Stage; fmt: Fmt }) {
    const s = props.stage

    if (s.kind === 'double' && s.double) return <DoubleStage d={s.double} fmt={props.fmt} />

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

    const columns = s.columns ?? []

    if (columns.length > 1) return <KnockoutStage columns={columns} fmt={props.fmt} />

    return <MatchGrid matches={columns[0]?.matches ?? []} name={columns[0]?.name} fmt={props.fmt} />
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

// Blocks that don't form a tree (gauntlets, unknown formats): a plain chronological grid.
function MatchGrid(props: { matches: Match[]; name?: string; fmt: Fmt }) {
    return (
        <div class="mgrid">
            {props.matches.map((m) => (
                <BracketMatch
                    m={m}
                    fmt={props.fmt}
                    note={m.stage && m.stage !== props.name ? m.stage : undefined}
                />
            ))}
        </div>
    )
}

function BracketMatch(props: { m: Match; fmt: Fmt; note?: string; foot?: string; champion?: boolean }) {
    const { m, fmt } = props

    return (
        <a class={`bm ${m.state}`} href={matchUrl(m)} data-id={m.id}>
            <div class="bd">
                <span>
                    {fmt.shortDate(m.start)} {fmt.time(m.start)}
                    {props.note && ` · ${props.note}`}
                </span>
                {m.state === 'inProgress' ? <span class="live">LIVE</span> : <span>bo{m.bestOf}</span>}
            </div>
            {m.teams.map((t) =>
                t.tbd ? (
                    <div class="bt tbd">
                        <span class="tn">TBD</span>
                    </div>
                ) : (
                    <div
                        class={`bt ${t.won === true ? 'won' : t.won === false ? 'lost' : ''} ${props.champion && t.won ? 'champ' : ''}`}
                        data-team={t.code}
                    >
                        <Logo src={t.image} size={16} />
                        <span class="tn">{t.name}</span>
                        <Tag t={t} />
                        {m.state !== 'unstarted' && <span class="ts">{t.score ?? 0}</span>}
                    </div>
                ),
            )}
            {props.foot && <div class="bf">{props.foot}</div>}
        </a>
    )
}

// ---------- tree brackets ----------

// One cell of the bracket grid: a round's header and its matches, stacked and centred so each
// match sits between the two it was fed by.
interface Cell {
    name: string
    matches: Match[]
    col: number
    row: string // grid-row value: "1", "2", "1 / span 2"
    foot?: (m: Match) => string | undefined
    final?: boolean
}

// Shared by single and double elimination: rounds on a grid, connector lines drawn client-side
// from `from` (match id -> the matches its teams came from), and hovering a team traces its run.
function TreeBracket(props: {
    cells: Cell[]
    cols: number
    tiers: number
    from: Record<string, string[]>
    fmt: Fmt
}) {
    const { cells, cols, tiers, fmt } = props

    return (
        <div class="tree-scroll">
            <div
                class={`tree ${tiers > 1 ? 'tiered' : ''}`}
                style={`grid-template-columns: repeat(${cols}, minmax(176px, 1fr))`}
            >
                {tiers > 1 && <div class="tree-band" style={`grid-column: 1 / ${props.cols}; grid-row: 2`} />}
                {cells.map((c) => (
                    <div
                        class={`tree-cell ${c.final ? 'final' : ''}`}
                        style={`grid-column: ${c.col}; grid-row: ${c.row}`}
                    >
                        <h4>{c.name}</h4>
                        <div class="tree-ms">
                            {c.matches.map((m) => (
                                <BracketMatch
                                    m={m}
                                    fmt={fmt}
                                    foot={c.foot?.(m)}
                                    champion={c.final && m.state === 'completed'}
                                />
                            ))}
                        </div>
                    </div>
                ))}
                <svg class="tree-lines" aria-hidden="true" data-from={JSON.stringify(props.from)} />
            </div>
            <script dangerouslySetInnerHTML={{ __html: TREE_SCRIPT }} />
        </div>
    )
}

// Single elimination (Worlds knockouts): each round halves, so match j is fed by 2j and 2j+1.
function KnockoutStage(props: { columns: { name: string; matches: Match[] }[]; fmt: Fmt }) {
    const { columns } = props
    const from: Record<string, string[]> = {}

    columns.forEach((c, i) =>
        c.matches.forEach((m, j) => {
            const prev = columns[i - 1]?.matches

            if (prev)
                from[m.id] = [prev[2 * j], prev[2 * j + 1]].filter((x): x is Match => !!x).map((x) => x.id)
        }),
    )

    const cells = columns.map((c, i) => ({
        name: c.name,
        matches: c.matches,
        col: i + 1,
        row: '1',
        final: i === columns.length - 1 && c.matches.length === 1,
    }))

    return <TreeBracket cells={cells} cols={columns.length} tiers={1} from={from} fmt={props.fmt} />
}

// Double elimination, Liquipedia-style: upper bracket on top, lower below, rounds aligned from
// the right so the two finals sit side by side and feed the grand final.
function DoubleStage(props: { d: DoubleElim; fmt: Fmt }) {
    const { d } = props
    const shift = Math.max(0, d.lower.length - d.upper.length)
    const cols = Math.max(d.upper.length, d.lower.length) + (d.final ? 1 : 0)

    const cells: Cell[] = [
        ...d.upper.map((r, i) => ({
            name: r.name,
            matches: r.matches,
            col: i + 1 + shift,
            row: '1',
            foot: (m: Match) => dropNote(d, m),
        })),
        ...d.lower.map((r, i) => ({ name: r.name, matches: r.matches, col: i + 1, row: '2' })),
        ...(d.final
            ? [{ name: 'Grand final', matches: [d.final], col: cols, row: '1 / span 2', final: true }]
            : []),
    ]

    return <TreeBracket cells={cells} cols={cols} tiers={2} from={d.from} fmt={props.fmt} />
}

// Upper-bracket losers get a second life; say where, since no line shows it.
function dropNote(d: DoubleElim, m: Match): string {
    const to = d.drop[m.id]
    const loser = m.teams.find((t) => t.won === false)
    const round = to && d.lower.find((r) => r.matches.some((x) => x.id === to))

    return loser && round
        ? `↓ ${loser.code} drops to ${round.name.toLowerCase()}`
        : '↓ Loser drops to the lower bracket'
}

// Draws elbow lines from each match to the next match on the same side, tagging each line with
// the team(s) that travelled it. Hovering a team row lights up every card and line of its run.
const TREE_SCRIPT = `(() => {
  const box = document.currentScript.previousElementSibling
  const svg = box.querySelector('.tree-lines')
  const from = JSON.parse(svg.dataset.from)
  const teams = (el) => [...el.querySelectorAll('[data-team]')].map((t) => t.dataset.team)
  const draw = () => {
    if (!box.offsetParent) return
    const o = box.getBoundingClientRect()
    svg.setAttribute('width', box.scrollWidth); svg.setAttribute('height', box.scrollHeight)
    let out = ''
    for (const [to, srcs] of Object.entries(from)) {
      const t = box.querySelector('[data-id="' + to + '"]')
      for (const id of srcs) {
        const f = box.querySelector('[data-id="' + id + '"]')
        if (!t || !f) continue
        const a = f.getBoundingClientRect(), b = t.getBoundingClientRect()
        if (b.left <= a.right) continue
        const ay = a.top + a.height / 2 - o.top, by = b.top + b.height / 2 - o.top
        // an upper-bracket loser's drop isn't drawn; the card's footnote says where it went
        if (Math.abs(ay - by) > box.clientHeight / 2 && !t.closest('.final')) continue
        const x1 = a.right - o.left, x2 = b.left - o.left, mx = x2 - 10
        const both = teams(t).filter((c) => teams(f).includes(c))
        out += '<path data-teams="' + both.join(' ') + '" d="M' + x1 + ' ' + ay + 'H' + mx + 'V' + by + 'H' + x2 + '" />'
      }
    }
    svg.innerHTML = out
  }
  const trace = (code) => {
    box.classList.toggle('tracing', !!code)
    for (const el of box.querySelectorAll('.on')) el.classList.remove('on')
    if (!code) return
    for (const row of box.querySelectorAll('[data-team="' + code + '"]')) {
      row.classList.add('on'); row.closest('.bm').classList.add('on')
    }
    for (const p of svg.querySelectorAll('path')) if (p.dataset.teams.split(' ').includes(code)) p.classList.add('on')
  }
  box.addEventListener('mouseover', (e) => trace(e.target.closest('[data-team]')?.dataset.team))
  box.addEventListener('mouseleave', () => trace(null))
  box.closest('details')?.addEventListener('toggle', draw)
  draw(); addEventListener('resize', draw)
})()`
