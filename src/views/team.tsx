import { eventUrl, matchUrl } from '../data/matches'
import type { Player, Roster, TeamProfile } from '../data/team'
import type { Match, Team } from '../data/types'
import { logoUrl, ordinal, type Fmt } from '../format'
import { MovesBox } from './transfers'
import { Flag, Layout, Logo, RoleIcon, roleName, Tag } from './ui'

// Results shown before "Show all": a screenful on a phone, more where there is room. A team
// plays some thirty matches in the four months the page covers.
const FOLD_PHONE = 4
const FOLD_DESKTOP = 8

export function TeamPage(props: { fmt: Fmt; team: TeamProfile }) {
    const { fmt, team: t } = props
    const r = t.ranking
    const placements = new Map(t.achievements.map((a) => [a.tournamentId, a.placement]))
    const wiki = t.roster?.source === 'wiki'
    // Which results the fold hides: "fold" everywhere, "fold-phone" on phones only.
    const fold = (i: number) => (i >= FOLD_DESKTOP ? 'fold' : i >= FOLD_PHONE ? 'fold-phone' : '')
    // Has someone to list: a team between rosters can be five open slots.
    const listed = wiki && (t.roster!.bench.length > 0 || t.roster!.slots.some((s) => s.player))

    return (
        <Layout fmt={fmt} title={t.name} watch={t.upcoming} nav="ranking">
            <div class="split">
                <div class="col">
                    <section class="tprofile">
                        {t.roster && (
                            <div class="tp-lineup">
                                {t.roster.slots.map((s) => (
                                    <PlayerCard p={s.player} label={roleName(s.role)} />
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
                        {/* One list that folds: a checkbox and its label under the list, no script.
                            There is no results page per team to link to (yet). */}
                        {t.results.length > FOLD_PHONE && (
                            <input type="checkbox" id="tp-fold" class="tp-fold" />
                        )}
                        {t.results.length ? (
                            <ByEvent
                                matches={t.results}
                                team={t}
                                fmt={fmt}
                                placements={placements}
                                fold={fold}
                            />
                        ) : (
                            <div class="empty">No results in the last few months.</div>
                        )}
                        {t.results.length > FOLD_PHONE && (
                            <label
                                for="tp-fold"
                                class={`more tp-foldbar ${t.results.length > FOLD_DESKTOP ? '' : 'phone'}`}
                            >
                                <span class="all">Show all {t.results.length} results ▾</span>
                                <span class="less">Show fewer ▴</span>
                            </label>
                        )}
                    </section>
                </div>

                <div class="col">
                    {listed && <RosterList roster={t.roster!} />}
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
    const words = (coach?.name ?? '').split(' ').filter(Boolean)
    // A handle that is the coach's own name (André Pereira Guilhoto, "Guilhoto") isn't repeated.
    const own = words.findIndex((w) => w.toLowerCase() === coach?.handle.toLowerCase())

    return (
        <div>
            <span>Head coach</span>
            {coach ? (
                <b class="tp-people" title={about(coach)}>
                    <Flag country={coach.country} />{' '}
                    {own >= 0 ? (
                        words.map((w, i) => <>{i === own ? <em>{w}</em> : w} </>)
                    ) : (
                        <>
                            {words[0]} <em>'{coach.handle}'</em> {words.slice(1).join(' ')}
                        </>
                    )}
                </b>
            ) : (
                <b class="tp-people">Open</b>
            )}
        </div>
    )
}

// Tooltip: what Leaguepedia knows about someone and the line has no room for.
function about(p: Player): string | undefined {
    const contract = p.contractEnd ? `contract until ${p.contractEnd}` : ''

    return [p.name, p.country, contract].filter(Boolean).join(', ')
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

// The players under contract, starters first: what the cards have no room for (name,
// country, contract) and who is on the bench. The coaching staff isn't listed: the head coach
// has his line, and the rest have titles like "Performance Coach" that say little.
function RosterList(props: { roster: Roster }) {
    const starters = props.roster.slots.flatMap((s) => s.player ?? [])

    const row = (p: Player, note?: string) => (
        <div class="li">
            <RoleIcon role={p.role} />
            <span class="grow">
                <span class="name">{p.handle}</span>
                <span class="sub name">
                    <Flag country={p.country} /> {[p.name, note].filter(Boolean).join(' · ')}
                </span>
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
                {starters.map((p) => row(p))}
                {props.roster.bench.map((p) => row(p, p.status === 'inactive' ? 'inactive' : 'bench'))}
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
// `fold` gives the class of the match at a position in the list, for rows a fold can hide.
function ByEvent(props: {
    matches: Match[]
    team: TeamProfile
    fmt: Fmt
    placements: Map<string, number>
    fold?: (index: number) => string
}) {
    const groups: { key: string; matches: Match[]; first: number }[] = []

    props.matches.forEach((m, i) => {
        const key = m.event?.id ?? m.leagueSlug
        const last = groups[groups.length - 1]

        if (last?.key === key) last.matches.push(m)
        else groups.push({ key, matches: [m], first: i })
    })

    const fold = props.fold ?? (() => '')

    return (
        <div class="tp-matches">
            {groups.map((g) => {
                const e = g.matches[0]!.event
                const place = e ? props.placements.get(e.id) : undefined

                return (
                    <>
                        {/* An event's header hides with its first match. */}
                        <a class={`tp-event ${fold(g.first)}`} href={e ? eventUrl(e) : undefined}>
                            {e?.name ?? g.matches[0]!.leagueName}
                            {place && ` - ${ordinal(place)}`}
                        </a>
                        {g.matches.map((m, i) => (
                            <TeamMatchRow m={m} team={props.team} fmt={props.fmt} cls={fold(g.first + i)} />
                        ))}
                    </>
                )
            })}
        </div>
    )
}

function TeamMatchRow(props: { m: Match; team: TeamProfile; fmt: Fmt; cls: string }) {
    const { m, fmt } = props
    const us = own(m, props.team)
    const them = m.teams.find((x) => x !== us) ?? m.teams[1]
    const date = fmt.dayKey(m.start).split('-').reverse().join('/')

    // The whole row links to the match (like match rows elsewhere), so no nested team link.
    return (
        <a class={`tp-row ${m.state} ${props.cls}`} href={matchUrl(m)}>
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
