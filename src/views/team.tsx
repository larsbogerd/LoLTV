import {
    eventUrl,
    matchUrl,
    type Match,
    type Player,
    type Roster,
    type Team,
    type TeamProfile,
} from '../data'
import { logoUrl, ordinal, type Fmt } from '../format'
import { MovesBox } from './transfers'
import { Layout, Logo, roleLabel, Tag } from './ui'

// Full words on the player cards (the shared roleLabel() is the short form).
const ROLE_NAME = new Map([
    ['top', 'Top'],
    ['jungle', 'Jungle'],
    ['mid', 'Mid'],
    ['bottom', 'Bot'],
    ['support', 'Support'],
])

export function TeamPage(props: { fmt: Fmt; team: TeamProfile }) {
    const { fmt, team: t } = props
    const r = t.ranking
    const placements = new Map(t.achievements.map((a) => [a.tournamentId, a.placement]))
    const wiki = t.roster?.source === 'wiki'

    return (
        <Layout fmt={fmt} title={t.name} watch={t.upcoming} nav="ranking">
            <div class="split">
                <div class="col">
                    <section class="tprofile">
                        {t.roster && (
                            <div class="tp-lineup">
                                {t.roster.slots.map((s) => (
                                    <PlayerCard p={s.player} label={ROLE_NAME.get(s.role) ?? s.role} />
                                ))}
                            </div>
                        )}
                        <div class="tp-head">
                            <Logo src={t.image} size={56} />
                            <div style="min-width:0">
                                {t.league && (
                                    <div class="sub tp-league">
                                        <Logo src={t.league.image} size={14} />
                                        {t.league.name} · {t.league.region.toLowerCase()}
                                    </div>
                                )}
                                <h1>{t.name}</h1>
                            </div>
                        </div>
                        <div class="tp-stats">
                            <div>
                                <span>Power ranking</span>
                                <b>
                                    {r ? `#${r.rank}` : '–'}
                                    {r?.leagueRank && t.league && (
                                        <small>
                                            {' '}
                                            #{r.leagueRank} in {t.league.name}
                                        </small>
                                    )}
                                </b>
                            </div>
                            <div>
                                <span>Points</span>
                                <b>{r ? r.points : '–'}</b>
                            </div>
                            <div>
                                <span>Matches this year</span>
                                <b>{r ? `${r.wins}-${r.losses}` : '–'}</b>
                            </div>
                            {/* Only Leaguepedia knows the coach, so no line without it. */}
                            {wiki && <CoachLine coach={t.roster?.headCoach ?? null} />}
                        </div>
                    </section>

                    <Form team={t} />

                    {!t.matchesAvailable && (
                        <div class="notice">This team's matches can't be loaded right now.</div>
                    )}
                    <section>
                        <h2 class="h">Upcoming matches for {t.name}</h2>
                        {t.upcoming.length ? (
                            <ByEvent matches={t.upcoming} team={t} fmt={fmt} placements={placements} />
                        ) : (
                            <div class="empty">No upcoming matches scheduled.</div>
                        )}
                    </section>
                    <section>
                        <h2 class="h">Recent results for {t.name}</h2>
                        {t.results.length ? (
                            <ByEvent matches={t.results} team={t} fmt={fmt} placements={placements} />
                        ) : (
                            <div class="empty">No results in the last few months.</div>
                        )}
                    </section>
                </div>

                <div class="col">
                    {wiki && t.roster && <RosterList roster={t.roster} />}
                    <MovesBox
                        title="Roster moves"
                        moves={t.moves}
                        fmt={fmt}
                        href={`/transfers?team=${t.id}`}
                    />
                    {t.achievements.length > 0 && (
                        <section>
                            <h3 class="label">Placements this year</h3>
                            <div class="list">
                                {t.achievements.map((a) => (
                                    <a class="li" href={a.event ? eventUrl(a.event) : undefined}>
                                        <span class={`place p${Math.min(a.placement, 4)}`}>
                                            {ordinal(a.placement)}
                                        </span>
                                        <span class="grow name">{a.name}</span>
                                    </a>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </Layout>
    )
}

// HLTV's coach line under the team's numbers: Sergey 'hally' Shavaev. The handle goes after
// the first name, which is also how Leaguepedia writes it (Im 'Tom' Jae-hyeon).
function CoachLine(props: { coach: Player | null }) {
    const { coach } = props
    const [first, ...rest] = (coach?.name ?? '').split(' ')

    return (
        <div>
            <span>{coach?.title && /interim/i.test(coach.title) ? 'Interim head coach' : 'Head coach'}</span>
            {coach ? (
                <b class="tp-coach">
                    {first} <em>'{coach.handle}'</em> {rest.join(' ')}
                </b>
            ) : (
                <b class="tp-coach">Open</b>
            )}
        </div>
    )
}

// One slot of the lineup. Nobody in it: the team is still looking.
function PlayerCard(props: { p: Player | null; label: string }) {
    const { p } = props
    const photo = logoUrl(p?.image, 200)

    return (
        <div class={`tp-player ${p ? '' : 'open'}`}>
            {photo ? <img src={photo} alt="" loading="lazy" decoding="async" /> : <div class="tp-nophoto" />}
            <div class="tp-name">
                <b>{p?.handle ?? 'Open'}</b>
                <span>{props.label}</span>
            </div>
        </div>
    )
}

// Everyone under contract: the five, the bench and the staff, with what Leaguepedia knows
// about them.
function RosterList(props: { roster: Roster }) {
    const r = props.roster

    const row = (p: Player, role: string) => (
        <div class="li">
            <span class="tp-role">{role}</span>
            <span class="grow">
                <span class="name">{p.handle}</span>
                <span class="sub name">{[p.name, p.country].filter(Boolean).join(' · ')}</span>
            </span>
            {p.contractEnd && (
                <span class="sub" title={`Contract until ${p.contractEnd}`}>
                    until {p.contractEnd.slice(0, 4)}
                </span>
            )}
        </div>
    )

    return (
        <section>
            <h3 class="label">Roster</h3>
            <div class="list">
                {r.slots.map((s) => s.player && row(s.player, roleLabel(s.role)))}
                {r.bench.map((p) => row(p, `${roleLabel(p.role)} ${p.status ?? 'bench'}`))}
                {r.headCoach && row(r.headCoach, r.headCoach.title ?? 'Head coach')}
                {r.coaches.map((p) =>
                    row(p, `${p.title ?? 'Coach'}${p.status === 'inactive' ? ', inactive' : ''}`),
                )}
            </div>
        </section>
    )
}

// HLTV's "Match stats" box: current streak and win rate over the last three months.
function Form(props: { team: TeamProfile }) {
    const results = props.team.results

    if (!results.length) return null
    const won = (m: Match) => own(m, props.team).won === true
    const first = won(results[0]!)
    let streak = 0

    for (const m of results) {
        if (won(m) !== first) break
        streak++
    }

    const cutoff = Date.now() - 90 * 86400e3
    const recent = results.filter((m) => Date.parse(m.start) >= cutoff)
    const wins = recent.filter(won).length

    return (
        <div class="tp-form">
            <div>
                <b class={first ? 'w' : 'l'}>
                    {streak}
                    {first ? 'W' : 'L'}
                </b>
                <span>Current streak</span>
            </div>
            <div>
                <b>{recent.length ? `${Math.round((wins / recent.length) * 100)}%` : '–'}</b>
                <span>
                    Win rate, last 3 months ({wins}-{recent.length - wins})
                </span>
            </div>
        </div>
    )
}

function own(m: Match, t: TeamProfile): Team {
    return m.teams.find((x) => x.id === t.id || x.code === t.code) ?? m.teams[0]
}

// Matches grouped under event headers, like HLTV's team page. Finished events show the
// team's placement ("LCK Split 3 2026 - 2nd").
function ByEvent(props: { matches: Match[]; team: TeamProfile; fmt: Fmt; placements: Map<string, number> }) {
    const groups: { key: string; matches: Match[] }[] = []

    for (const m of props.matches) {
        const key = m.event?.id ?? m.leagueSlug
        const last = groups[groups.length - 1]

        if (last?.key === key) last.matches.push(m)
        else groups.push({ key, matches: [m] })
    }

    return (
        <div class="tp-matches">
            {groups.map((g) => {
                const e = g.matches[0]!.event
                const place = e ? props.placements.get(e.id) : undefined

                return (
                    <>
                        <a class="tp-event" href={e ? eventUrl(e) : undefined}>
                            {e?.name ?? g.matches[0]!.leagueName}
                            {place && ` - ${ordinal(place)}`}
                        </a>
                        {g.matches.map((m) => (
                            <TeamMatchRow m={m} team={props.team} fmt={props.fmt} />
                        ))}
                    </>
                )
            })}
        </div>
    )
}

function TeamMatchRow(props: { m: Match; team: TeamProfile; fmt: Fmt }) {
    const { m, fmt } = props
    const us = own(m, props.team)
    const them = m.teams.find((x) => x !== us) ?? m.teams[1]
    const date = fmt.dayKey(m.start).split('-').reverse().join('/')

    // The whole row links to the match (like match rows elsewhere), so no nested team link.
    return (
        <a class={`tp-row ${m.state}`} href={matchUrl(m)}>
            <span class="tp-date">{m.state === 'unstarted' ? `${date} ${fmt.time(m.start)}` : date}</span>
            <span class={`tp-side us ${us.won === false ? 'lost' : ''}`}>
                <span class="tn">{us.name}</span>
                <Logo src={us.image} size={18} />
            </span>
            <span class="tp-score">
                {m.state === 'unstarted' ? (
                    '-'
                ) : (
                    <>
                        <span class={us.won ? 'w' : us.won === false ? 'l' : ''}>{us.score ?? 0}</span>
                        {' : '}
                        <span class={them.won ? 'w' : them.won === false ? 'l' : ''}>{them.score ?? 0}</span>
                    </>
                )}
            </span>
            <span class={`tp-side them ${them.won === false ? 'lost' : ''}`}>
                <Logo src={them.image} size={18} />
                <span class="tn">{them.name}</span>
                <Tag t={them} />
            </span>
            <span class="tp-btn">{m.state === 'inProgress' ? 'LIVE' : 'Match'}</span>
        </a>
    )
}
