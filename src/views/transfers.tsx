import { teamUrl, type Ranking } from '../data'
import { logoUrl, type Fmt } from '../format'
import type { MoveFeed, MoveSide, TeamMove } from '../wiki'
import { Layout, Logo, RoleIcon, roleLabel } from './ui'

// HLTV's transfers page: who moved where, newest first, one row per player.
export function TransfersPage(props: {
    fmt: Fmt
    feed: MoveFeed | null
    ranking: Ranking | null
    league?: string
    team?: string
}) {
    const { fmt, feed } = props
    const all = feed?.moves ?? []
    const team = props.team ? props.ranking?.teams.find((t) => t.team.id === props.team)?.team : undefined

    // League chips, biggest leagues first, for the leagues that have moves.
    const leagues = new Map<string, { name: string; image: string; n: number }>()

    for (const t of props.ranking?.teams ?? []) {
        if (!t.league || !all.some((m) => m.leagues.includes(t.league!.slug))) continue
        const l = leagues.get(t.league.slug) ?? { name: t.league.name, image: t.league.image, n: 0 }

        leagues.set(t.league.slug, { ...l, n: l.n + 1 })
    }

    const moves = all.filter(
        (m) =>
            (!props.league || m.leagues.includes(props.league)) &&
            (!props.team || m.from.id === props.team || m.to.id === props.team),
    )

    const days = new Map<string, TeamMove[]>()

    for (const m of moves) days.set(m.date, [...(days.get(m.date) ?? []), m])

    return (
        <Layout fmt={fmt} title="Transfers" nav="transfers">
            <h2 class="h">
                {team ? `${team.name} transfers` : 'Transfers'}
                {team ? <a href="/transfers">All transfers</a> : <small>Last 90 days</small>}
            </h2>
            {!team && leagues.size > 1 && (
                <div class="chips">
                    <a class={`chip ${props.league ? '' : 'on'}`} href="/transfers">
                        All
                    </a>
                    {[...leagues]
                        .sort((a, b) => b[1].n - a[1].n)
                        .map(([slug, l]) => (
                            <a
                                class={`chip ${props.league === slug ? 'on' : ''}`}
                                href={`/transfers?league=${slug}`}
                            >
                                <Logo src={l.image} size={14} />
                                {l.name}
                            </a>
                        ))}
                </div>
            )}
            {!feed && <div class="empty">Transfers can't be loaded right now. Try again in a while.</div>}
            {feed && moves.length === 0 && <div class="empty">No roster moves in the last 90 days.</div>}
            {[...days].map(([key, ms]) => {
                const rel = fmt.relativeDay(key)

                return (
                    <>
                        <h3 class="day">
                            {rel && <em>{rel}</em>}
                            {fmt.dayHeading(key)}
                        </h3>
                        <div class="group">
                            {ms.map((m) => (
                                <MoveRow m={m} />
                            ))}
                        </div>
                    </>
                )
            })}
            {feed && (
                <p class="note">
                    Players and coaches of tier 1 teams. Contract renewals are left out. Roster data from{' '}
                    <a href="https://lol.fandom.com">Leaguepedia</a>.
                </p>
            )}
        </Layout>
    )
}

function MoveRow(props: { m: TeamMove }) {
    const { m } = props

    return (
        <div class="tr">
            <Photo m={m} size={36} />
            <SideLogo s={m.from} size={26} />
            <span class="tr-arrow">→</span>
            <SideLogo s={m.to} size={26} />
            <RoleIcon role={m.role} />
            <span class="tr-text">
                <Sentence m={m} />
            </span>
            {m.source && (
                <a class="tr-src" href={m.source} target="_blank" rel="noopener nofollow">
                    Source
                </a>
            )}
        </div>
    )
}

// "Recent transfers" on the homepage and "Roster moves" on a team page.
export function MovesBox(props: { title: string; moves: TeamMove[]; fmt: Fmt; href: string }) {
    if (!props.moves.length) return null

    return (
        <section>
            <h3 class="label">{props.title}</h3>
            <div class="list">
                {props.moves.map((m) => (
                    <div class="li trm" title={plain(m)}>
                        <Photo m={m} size={28} />
                        <span class="grow">
                            <span class="name">{m.handle}</span>
                            <span class="sub name">
                                {m.role === 'coach' ? 'Coach' : roleLabel(m.role)} ·{' '}
                                {props.fmt.shortDate(`${m.date}T12:00:00Z`)}
                            </span>
                        </span>
                        <SideLogo s={m.from} size={20} />
                        <span class="tr-arrow">→</span>
                        <SideLogo s={m.to} size={20} />
                    </div>
                ))}
            </div>
            <a class="more" href={props.href}>
                All transfers
            </a>
        </section>
    )
}

function Photo(props: { m: TeamMove; size: number }) {
    const url = logoUrl(props.m.image, props.size * 3)
    const style = `width:${props.size}px;height:${props.size}px`

    return url ? (
        <img class="tr-photo" src={url} style={style} alt="" loading="lazy" decoding="async" />
    ) : (
        <span class="tr-photo" style={style} />
    )
}

// A team's logo with BENCH or COACH under it, as on HLTV. Teams outside tier 1 have no
// logo here: they get their initial. No team at all is spelled out.
function SideLogo(props: { s: MoveSide; size: number }) {
    const { s, size } = props

    if (!s.team) return <span class="tr-side none">No team</span>
    const url = s.id ? teamUrl({ id: s.id, slug: s.slug, name: s.team }) : null

    const body = (
        <>
            {s.image ? (
                <Logo src={s.image} size={size} />
            ) : (
                <span class="tr-ph" style={`width:${size}px;height:${size}px`}>
                    {s.team.slice(0, 1).toUpperCase()}
                </span>
            )}
            {s.label && <small>{s.label}</small>}
        </>
    )

    return url ? (
        <a class="tr-side" href={url} title={s.team}>
            {body}
        </a>
    ) : (
        <span class="tr-side" title={s.team}>
            {body}
        </span>
    )
}

function TeamRef(props: { s: MoveSide }) {
    const { s } = props
    const url = s.id ? teamUrl({ id: s.id, slug: s.slug, name: s.team ?? '' }) : null

    return url ? (
        <a href={url}>
            <b>{s.team}</b>
        </a>
    ) : (
        <b>{s.team}</b>
    )
}

// What happened, as words and teams: "transfers from <A> to <B>", "is benched on <A>".
function phrase(m: TeamMove): (string | MoveSide)[] {
    const job = m.roleLabel.toLowerCase()
    const as = m.role === 'coach' ? [`as ${job}`] : []

    switch (m.kind) {
        case 'transfer':
            return m.from.team === m.to.team
                ? [`becomes ${job} of`, m.to]
                : ['transfers from', m.from, 'to', m.to, ...as]
        case 'join':
            return ['joins', m.to, ...as]
        case 'leave':
            return ['parts ways with', m.from]
        case 'benched':
            return ['is benched on', m.to]
        case 'unbenched':
            return ['returns to the active roster of', m.to]
    }
}

function Sentence(props: { m: TeamMove }) {
    const { m } = props

    return (
        <>
            <b>{m.handle}</b>
            {phrase(m).map((p) => (
                <> {typeof p === 'string' ? p : <TeamRef s={p} />}</>
            ))}
        </>
    )
}

// The same sentence as plain text, for tooltips on the compact rows.
function plain(m: TeamMove): string {
    return [m.handle, ...phrase(m).map((p) => (typeof p === 'string' ? p : p.team))].join(' ')
}
