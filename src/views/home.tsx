import { activeEvents, eventUrl, isSwiss, swissTable, type Event, type Match, type Ranking } from '../data'
import type { Fmt } from '../format'
import { ByDay, CompactMatch, EventBanner, eventWhen, Layout, Logo, MatchRow, ResultRow } from './ui'

export function HomePage(props: {
    fmt: Fmt
    events: Event[]
    featured: Event | null
    featuredMatches: Match[]
    schedule: Match[]
    ranking: Ranking | null
}) {
    const { fmt, featured } = props
    const fm = props.featuredMatches
    // Without a featured event the centre column falls back to all leagues.
    const centre = featured ? fm : props.schedule
    const live = centre.filter((m) => m.state === 'inProgress')
    const upcoming = centre.filter((m) => m.state === 'unstarted').slice(0, 8)
    const results = centre
        .filter((m) => m.state === 'completed')
        .reverse()
        .slice(0, 8)
    const swiss = swissTable(fm.filter((m) => isSwiss(m.stage)))
    const stage = (live[0] ?? upcoming[0] ?? results[0])?.stage
    const matchesHref = featured ? `/matches?event=${featured.id}` : '/matches'
    const resultsHref = featured ? `/results?event=${featured.id}` : '/results'

    return (
        <Layout fmt={fmt} watch={[...props.schedule, ...fm]} nav="home">
            <div class="home">
                <div class="col left">
                    {props.ranking && (
                        <section>
                            <h3 class="label">Power ranking</h3>
                            <div class="list mini">
                                {props.ranking.teams.slice(0, 5).map((t) => (
                                    <a class="li" href="/ranking">
                                        <span class="num">{t.rank}.</span>
                                        <Logo src={t.team.image} size={18} />
                                        <span class="grow name">{t.team.code}</span>
                                    </a>
                                ))}
                            </div>
                            <a class="more" href="/ranking">
                                Complete ranking
                                <small>Last updated: {fmt.ordinalDate(props.ranking.updated)}</small>
                            </a>
                        </section>
                    )}
                    {/* Fallback when the ranking can't be loaded */}
                    {!props.ranking && swiss.length > 0 && featured && (
                        <section>
                            <h3 class="label">{featured.name} · Swiss</h3>
                            <div class="list mini">
                                {swiss.map((r) => (
                                    <a class={`li ${r.status}`} href={eventUrl(featured)}>
                                        <Logo src={r.team.image} size={18} />
                                        <span class="grow name">{r.team.code}</span>
                                        {r.live && <span class="live">LIVE</span>}
                                        <span class="rec">
                                            {r.wins}-{r.losses}
                                        </span>
                                    </a>
                                ))}
                            </div>
                            <a class="more" href={eventUrl(featured)}>
                                Full standings
                            </a>
                        </section>
                    )}
                    <section>
                        <h3 class="label">Events</h3>
                        <div class="list">
                            {activeEvents(props.events)
                                .slice(0, 7)
                                .map((e) => (
                                    <a class="li" href={eventUrl(e)}>
                                        <Logo src={e.league.image} size={22} />
                                        <span class="grow">
                                            <span class="name">{e.name}</span>
                                            <span class="sub">{eventWhen(e, fmt)}</span>
                                        </span>
                                    </a>
                                ))}
                        </div>
                        <a class="more" href="/events">
                            All events
                        </a>
                    </section>
                </div>

                <div class="col">
                    {featured && <EventBanner event={featured} fmt={fmt} sub={stage} />}
                    {live.length > 0 && (
                        <section>
                            <h2 class="h">Live now</h2>
                            <div class="group">
                                {live.map((m) => (
                                    <MatchRow m={m} fmt={fmt} showEvent={!featured} />
                                ))}
                            </div>
                        </section>
                    )}
                    <section>
                        <h2 class="h">
                            Upcoming <a href={matchesHref}>All matches →</a>
                        </h2>
                        {upcoming.length ? (
                            <ByDay
                                matches={upcoming}
                                fmt={fmt}
                                heading="matches"
                                row={(m) => <MatchRow m={m} fmt={fmt} showEvent={!featured} />}
                            />
                        ) : (
                            <div class="empty">No upcoming matches scheduled.</div>
                        )}
                    </section>
                    <section>
                        <h2 class="h">
                            Latest results <a href={resultsHref}>All results →</a>
                        </h2>
                        {results.length ? (
                            <ByDay
                                matches={results}
                                fmt={fmt}
                                heading="results"
                                row={(m) => <ResultRow m={m} showEvent={!featured} />}
                            />
                        ) : (
                            <div class="empty">No results yet.</div>
                        )}
                    </section>
                </div>

                <div class="col today">
                    <TodayBox fmt={fmt} matches={props.schedule} />
                </div>
            </div>
        </Layout>
    )
}

// HLTV's right-hand "Today's matches" column, across all leagues.
function TodayBox(props: { fmt: Fmt; matches: Match[] }) {
    const { fmt } = props
    const today = fmt.dayKey(new Date())
    const isToday = (m: Match) => fmt.dayKey(m.start) === today
    const live = props.matches.filter((m) => m.state === 'inProgress')
    const later = props.matches.filter((m) => m.state === 'unstarted' && isToday(m))
    const done = props.matches.filter((m) => m.state === 'completed' && isToday(m)).reverse()
    // Nothing left today: show the next day that has matches.
    const nextDay = props.matches.find((m) => m.state === 'unstarted' && fmt.dayKey(m.start) > today)
    const next =
        later.length === 0 && nextDay
            ? props.matches.filter(
                  (m) => m.state === 'unstarted' && fmt.dayKey(m.start) === fmt.dayKey(nextDay.start),
              )
            : []

    const group = (label: string, ms: Match[]) =>
        ms.length > 0 && (
            <>
                <div class="li tm-label">{label}</div>
                {ms.map((m) => (
                    <CompactMatch m={m} fmt={fmt} />
                ))}
            </>
        )

    return (
        <section>
            <h3 class="label">
                Today's matches <a href="/matches">All</a>
            </h3>
            <div class="list">
                {group('Live', live)}
                {group('Upcoming', later)}
                {nextDay &&
                    group(fmt.relativeDay(fmt.dayKey(nextDay.start)) ?? fmt.shortDate(nextDay.start), next)}
                {group('Finished', done)}
                {!live.length && !later.length && !next.length && !done.length && (
                    <div class="li sub">No matches today.</div>
                )}
            </div>
        </section>
    )
}
