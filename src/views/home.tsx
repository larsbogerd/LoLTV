import type { Child } from 'hono/jsx'
import {
    teamUrl,
    activeEvents,
    eventUrl,
    isSwiss,
    swissTable,
    type Event,
    type LastMajor,
    type Match,
    type Ranking,
} from '../data'
import type { Fmt } from '../format'
import {
    ByDay,
    CompactMatch,
    EventBanner,
    EventRow,
    eventWhen,
    Layout,
    Logo,
    MatchRow,
    PlaceCard,
    ResultRow,
} from './ui'

const DAY = 86400e3
// With nothing live and nothing starting within this many days, the leagues are on a break.
const BREAK_DAYS = 7
// On a break the latest results are old news: fewer of them than the usual eight.
const BREAK_RESULTS = 4
// How long a finished major leads the page, and how old a "latest" result may be while the
// leagues are playing.
const NEWS_DAYS = 14

// Three states. A major is on (or about to start): its banner and only its matches. The leagues
// are playing: every league's matches. A break: the last major's winner and the next events.
export function HomePage(props: {
    fmt: Fmt
    events: Event[]
    featured: Event | null
    featuredMatches: Match[]
    last: LastMajor | null // only without a featured event
    schedule: Match[]
    ranking: Ranking | null
    now?: Date // previews render another day
    notice?: Child
}) {
    const { fmt, featured, last } = props
    const now = props.now ?? new Date()
    const fm = props.featuredMatches
    const centre = featured ? fm : props.schedule
    const live = centre.filter((m) => m.state === 'inProgress')
    const upcoming = centre.filter((m) => m.state === 'unstarted').slice(0, 8)

    const soon = now.getTime() + BREAK_DAYS * DAY

    const onBreak =
        !featured &&
        !props.schedule.some(
            (m) => m.state === 'inProgress' || (m.state === 'unstarted' && Date.parse(m.start) < soon),
        )

    // The last major's winner leads the page while that's news, or while nothing else is on.
    // After that it moves to the sidebar.
    const newsFrom = new Date(now.getTime() - NEWS_DAYS * DAY).toISOString()
    const leads = !!last && (onBreak || last.event.endDate >= newsFrom.slice(0, 10))

    // On a break the last results are all there is, however old: a short list of them. While the
    // leagues play, only recent ones, so a new season doesn't open on last season's results.
    const results = centre
        .filter((m) => m.state === 'completed')
        .filter((m) => featured || onBreak || m.start >= newsFrom)
        .reverse()
        .slice(0, onBreak ? BREAK_RESULTS : 8)

    const events = activeEvents(props.events, now).filter((e) => e.id !== last?.event.id)
    // The sidebar ranks majors first; on a break what counts is which event comes soonest.
    const nextEvents = [...events].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const swiss = swissTable(fm.filter((m) => isSwiss(m.stage)))
    const stage = (live[0] ?? upcoming[0] ?? results[0])?.stage
    const matchesHref = featured ? `/matches?event=${featured.id}` : '/matches'
    const resultsHref = featured ? `/results?event=${featured.id}` : '/results'

    return (
        <Layout fmt={fmt} title="Home" watch={[...props.schedule, ...fm]} nav="home">
            {props.notice}
            <div class="home">
                <div class="col left">
                    {props.ranking && (
                        <section>
                            <h3 class="label">Power ranking</h3>
                            <div class="list mini">
                                {props.ranking.teams.slice(0, 5).map((t) => (
                                    <a class="li" href={teamUrl(t.team) ?? '/ranking'}>
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
                    {last && !leads && <MajorWinnerBox last={last} />}
                    {/* On a break the same events are listed in the centre, with their dates. */}
                    {!onBreak && events.length > 0 && (
                        <section>
                            <h3 class="label">Events</h3>
                            <div class="list">
                                {events.slice(0, 7).map((e) => (
                                    <a class="li" href={eventUrl(e)}>
                                        <Logo src={e.league.image} size={22} />
                                        <span class="grow">
                                            <span class="name">{e.name}</span>
                                            <span class="sub">{eventWhen(e, fmt, now)}</span>
                                        </span>
                                    </a>
                                ))}
                            </div>
                            <a class="more" href="/events">
                                All events
                            </a>
                        </section>
                    )}
                </div>

                <div class="col">
                    {featured && (
                        <EventBanner event={featured} fmt={fmt} matches={fm} sub={stage} now={now} />
                    )}
                    {last && leads && <MajorWinner last={last} fmt={fmt} now={now} />}
                    {onBreak && (
                        <section>
                            <h2 class="h">
                                Next events <a href="/events">All events</a>
                            </h2>
                            {events.length ? (
                                <div class="list">
                                    {nextEvents.slice(0, 5).map((e) => (
                                        <EventRow event={e} fmt={fmt} now={now} />
                                    ))}
                                </div>
                            ) : (
                                <div class="empty">No upcoming events announced yet.</div>
                            )}
                        </section>
                    )}
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
                    {(!onBreak || upcoming.length > 0) && (
                        <section>
                            <h2 class="h">
                                Upcoming <a href={matchesHref}>All matches</a>
                            </h2>
                            {upcoming.length ? (
                                <ByDay
                                    matches={upcoming}
                                    fmt={fmt}
                                    row={(m) => <MatchRow m={m} fmt={fmt} showEvent={!featured} />}
                                />
                            ) : (
                                <div class="empty">No upcoming matches scheduled.</div>
                            )}
                        </section>
                    )}
                    {(featured || results.length > 0) && (
                        <section>
                            <h2 class="h">
                                Latest results <a href={resultsHref}>All results</a>
                            </h2>
                            {results.length ? (
                                <ByDay
                                    matches={results}
                                    fmt={fmt}
                                    row={(m) => <ResultRow m={m} showEvent={!featured} />}
                                />
                            ) : (
                                <div class="empty">No results yet.</div>
                            )}
                        </section>
                    )}
                </div>

                <div class="col today">
                    <TodayBox fmt={fmt} matches={props.schedule} now={now} />
                </div>
            </div>
        </Layout>
    )
}

// The last major in the centre column: its banner and the two finalists. The rest of the
// placements and the bracket are a click away.
function MajorWinner(props: { last: LastMajor; fmt: Fmt; now: Date }) {
    const { event, matches, places } = props.last

    return (
        <section>
            <EventBanner event={event} fmt={props.fmt} matches={matches} now={props.now} />
            {places.length > 0 && (
                <>
                    <div class="places">
                        {places.slice(0, 2).map((p) => (
                            <PlaceCard p={p} />
                        ))}
                    </div>
                    <a class="more" href={eventUrl(event)}>
                        Final placements and bracket
                    </a>
                </>
            )}
        </section>
    )
}

// The same, small, for the sidebar once the leagues are playing again.
function MajorWinnerBox(props: { last: LastMajor }) {
    const { event, places } = props.last

    if (!places.length) return null

    return (
        <section>
            <h3 class="label">{event.name}</h3>
            <div class="list">
                {places.slice(0, 2).map((p) => (
                    <a class={`li p${p.from}`} href={teamUrl(p.team) ?? eventUrl(event)}>
                        <Logo src={p.team.image} size={22} />
                        <span class="grow">
                            <span class="name">{p.team.name}</span>
                            <span class="sub">{p.from === 1 ? 'Champion' : 'Runner-up'}</span>
                        </span>
                    </a>
                ))}
            </div>
            <a class="more" href={eventUrl(event)}>
                Placements and bracket
            </a>
        </section>
    )
}

// HLTV's right-hand "Today's matches" column, across all leagues.
function TodayBox(props: { fmt: Fmt; matches: Match[]; now: Date }) {
    const { fmt } = props
    const today = fmt.dayKey(props.now.toISOString())
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

    const group = (label: string, ms: Match[], day?: string) =>
        ms.length > 0 && (
            <>
                <div class="li tm-label">{label}</div>
                {ms.map((m) => (
                    <CompactMatch m={m} fmt={fmt} day={day} />
                ))}
            </>
        )
    const nextLabel = nextDay && (fmt.relativeDay(fmt.dayKey(nextDay.start)) ?? fmt.shortDate(nextDay.start))

    return (
        <section>
            <h3 class="label">
                {!live.length && !later.length && !done.length && next.length
                    ? 'Upcoming matches'
                    : "Today's matches"}{' '}
                <a href="/matches">All</a>
            </h3>
            <div class="list">
                {group('Live', live)}
                {group('Upcoming', later)}
                {nextLabel && group(nextLabel, next, nextLabel)}
                {group('Finished', done)}
                {!live.length && !later.length && !next.length && !done.length && (
                    <div class="li sub">No matches today.</div>
                )}
            </div>
        </section>
    )
}
