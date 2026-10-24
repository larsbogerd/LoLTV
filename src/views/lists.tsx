import { eventStatus, eventUrl, type Event, type Match } from '../data'
import type { Fmt } from '../format'
import { ByDay, EventBanner, EventChips, eventWhen, Layout, Logo, MatchRow, ResultRow } from './ui'

export function MatchesPage(props: { fmt: Fmt; event: Event | null; matches: Match[] }) {
    const { fmt, event } = props
    const live = props.matches.filter((m) => m.state === 'inProgress')
    const upcoming = props.matches.filter((m) => m.state === 'unstarted')

    return (
        <Layout
            fmt={fmt}
            title={event ? `${event.name} matches` : 'Matches'}
            watch={props.matches}
            nav="matches"
        >
            {event ? (
                <div style="margin-bottom:14px">
                    <EventBanner event={event} fmt={fmt} tab="matches" />
                </div>
            ) : (
                <EventChips matches={props.matches} base="/matches" />
            )}
            {live.length > 0 && (
                <section style="margin-bottom:16px">
                    <h2 class="h">Live matches</h2>
                    <div class="group">
                        {live.map((m) => (
                            <MatchRow m={m} fmt={fmt} showEvent={!event} />
                        ))}
                    </div>
                </section>
            )}
            <h2 class="h">Upcoming matches</h2>
            {upcoming.length ? (
                <ByDay
                    matches={upcoming}
                    fmt={fmt}
                    heading="matches"
                    row={(m) => <MatchRow m={m} fmt={fmt} showEvent={!event} />}
                />
            ) : (
                <div class="empty">No upcoming matches scheduled.</div>
            )}
        </Layout>
    )
}

export function ResultsPage(props: {
    fmt: Fmt
    event: Event | null
    matches: Match[]
    older: string | null
    newer?: boolean
}) {
    const { fmt, event } = props
    const results = props.matches.filter((m) => m.state === 'completed').reverse()

    return (
        <Layout fmt={fmt} title={event ? `${event.name} results` : 'Results'} nav="results">
            {event ? (
                <div style="margin-bottom:14px">
                    <EventBanner event={event} fmt={fmt} tab="results" />
                </div>
            ) : (
                <EventChips matches={results} base="/results" />
            )}
            <h2 class="h">
                Results
                {props.newer && <a href="/results">← Latest</a>}
            </h2>
            {results.length ? (
                <ByDay
                    matches={results}
                    fmt={fmt}
                    heading="results"
                    row={(m) => <ResultRow m={m} showEvent={!event} />}
                />
            ) : (
                <div class="empty">No results yet.</div>
            )}
            {props.older && (
                <a
                    class="more"
                    style="margin-top:12px;border-radius:3px"
                    href={`/results?before=${encodeURIComponent(props.older)}`}
                >
                    Older results →
                </a>
            )}
        </Layout>
    )
}

export function EventsPage(props: { fmt: Fmt; events: Event[] }) {
    const { fmt } = props
    const now = new Date()

    const byTier = (a: Event, b: Event) =>
        a.league.tier - b.league.tier || a.startDate.localeCompare(b.startDate)

    const ongoing = props.events.filter((e) => eventStatus(e, now) === 'ongoing').sort(byTier)

    const upcoming = props.events
        .filter((e) => eventStatus(e, now) === 'upcoming')
        .sort((a, b) => a.startDate.localeCompare(b.startDate))

    const cutoff = new Date(now.getTime() - 60 * 86400e3).toISOString().slice(0, 10)

    const recent = props.events
        .filter((e) => eventStatus(e, now) === 'finished' && e.endDate >= cutoff)
        .sort((a, b) => b.endDate.localeCompare(a.endDate))

    const table = (title: string, events: Event[]) =>
        events.length > 0 && (
            <section style="margin-bottom:18px">
                <h2 class="h">{title}</h2>
                <div class="list">
                    {events.map((e) => (
                        <a class="li" href={eventUrl(e)}>
                            <Logo src={e.league.image} size={24} />
                            <span class="grow">
                                <span class="name">{e.name}</span>
                                <span class="sub">{e.league.region}</span>
                            </span>
                            <span class="sub" style="text-align:right">
                                {fmt.shortDate(`${e.startDate}T12:00:00Z`)} –{' '}
                                {fmt.shortDate(`${e.endDate}T12:00:00Z`)}
                                <br />
                                {eventWhen(e, fmt, now)}
                            </span>
                        </a>
                    ))}
                </div>
            </section>
        )

    return (
        <Layout fmt={fmt} title="Events" nav="events">
            {table('Ongoing events', ongoing)}
            {table('Upcoming events', upcoming)}
            {table('Recently finished', recent)}
        </Layout>
    )
}
