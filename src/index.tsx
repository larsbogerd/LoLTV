import { Hono, type Context } from 'hono'
import { getCookie } from 'hono/cookie'
import type { HtmlEscapedString } from 'hono/utils/html'
import { ApiError } from './api'
import {
    featuredEvent,
    getEvent,
    getEventMatches,
    getEvents,
    getMatchDetail,
    getRanking,
    getTeamProfile,
    type MatchDetail,
    type Player,
    getSchedulePage,
    getStages,
    getUpcoming,
    matchSlug,
    eventUrl,
} from './data'
import { makeFmt, safeTimeZone, type Fmt } from './format'
import { ddragonVersion, getGameStats } from './live'
import { CSS } from './style'
import { ErrorPage } from './views/error'
import { EventPage } from './views/event'
import { HomePage } from './views/home'
import { EventsPage, MatchesPage, ResultsPage } from './views/lists'
import { MatchPage } from './views/match'
import { RankingPage } from './views/ranking'
import { TeamPage } from './views/team'

const app = new Hono()

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#3c7ac4"/><path d="M9 7h4v14h8v4H9z" fill="#c8aa6e"/></svg>`

function fmtFor(c: Context): Fmt {
    return makeFmt(safeTimeZone(getCookie(c, 'tz')))
}

async function render(
    c: Context,
    page: HtmlEscapedString | Promise<HtmlEscapedString>,
    status: 200 | 404 | 502 = 200,
) {
    c.header('cache-control', 'private, max-age=0, must-revalidate')
    const html: string = await page
    return c.html(`<!DOCTYPE html>${html}`, status)
}

app.get('/style.css', (c) =>
    c.body(CSS, 200, {
        'content-type': 'text/css; charset=utf-8',
        'cache-control': 'public, max-age=31536000, immutable',
    }),
)
app.get('/favicon.svg', (c) =>
    c.body(FAVICON, 200, { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' }),
)
app.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 301))

app.get('/', async (c) => {
    const [events, page, ranking] = await Promise.all([getEvents(), getSchedulePage(), getRanking()])
    const featured = featuredEvent(events)
    const featuredMatches = featured ? await getEventMatches(featured) : []
    return render(
        c,
        <HomePage
            fmt={fmtFor(c)}
            events={events}
            featured={featured}
            featuredMatches={featuredMatches}
            schedule={page.matches}
            ranking={ranking}
        />,
    )
})

// HLTV style: /ranking, filterable by home league with ?league=<slug>
app.get('/ranking', async (c) => {
    const ranking = await getRanking()
    return render(c, <RankingPage fmt={fmtFor(c)} ranking={ranking} league={c.req.query('league')} />)
})

// HLTV style: /matches, /matches?event=<id>
app.get('/matches', async (c) => {
    const eventId = c.req.query('event')
    const event = eventId ? await getEvent(eventId) : null
    if (eventId && !event) return notFound(c)
    const matches = event ? await getEventMatches(event) : await getUpcoming()
    return render(c, <MatchesPage fmt={fmtFor(c)} event={event} matches={matches} />)
})

// HLTV style: /results, /results?event=<id>; older pages via ?before=<token>
app.get('/results', async (c) => {
    const eventId = c.req.query('event')
    const before = c.req.query('before')
    if (eventId) {
        const event = await getEvent(eventId)
        if (!event) return notFound(c)
        return render(
            c,
            <ResultsPage fmt={fmtFor(c)} event={event} matches={await getEventMatches(event)} older={null} />,
        )
    }
    const page = await getSchedulePage(before)
    return render(
        c,
        <ResultsPage
            fmt={fmtFor(c)}
            event={null}
            matches={page.matches}
            older={page.older}
            newer={!!before}
        />,
    )
})

app.get('/events', async (c) => render(c, <EventsPage fmt={fmtFor(c)} events={await getEvents()} />))

// HLTV style: /events/<id>/<slug>
app.get('/events/:id/:slug?', async (c) => {
    const event = await getEvent(c.req.param('id'))
    if (!event) return notFound(c)
    if (c.req.param('slug') !== event.slug) return c.redirect(eventUrl(event), 301)
    const matches = await getEventMatches(event)
    const stages = await getStages(event, matches)
    return render(c, <EventPage fmt={fmtFor(c)} event={event} matches={matches} stages={stages} />)
})

// HLTV style: /matches/<id>/<team1>-vs-<team2>-<event>
app.get('/matches/:id/:slug?', async (c) => {
    const id = c.req.param('id')
    if (!/^\d+$/.test(id)) return notFound(c)
    const detail = await getMatchDetail(id)
    if (!detail) return notFound(c)
    if (detail.match && c.req.param('slug') !== matchSlug(detail.match)) {
        return c.redirect(`/matches/${id}/${matchSlug(detail.match)}`, 301)
    }
    // Stats for every game that has started. Optional: a game without stats just has no board.
    const played = detail.games.filter((g) => g.state === 'completed' || g.state === 'inProgress')
    const [event, ...stats] = await Promise.all([
        getEvent(detail.details.tournament.id),
        ...played.map((g) => getGameStats(g.id, g.state === 'inProgress').catch(() => null)),
    ])
    const boards = played.flatMap((g, i) => (stats[i] ? [{ number: g.number, stats: stats[i] }] : []))
    const patch = boards[0]?.stats.patch
    const version = patch ? await ddragonVersion(patch).catch(() => '') : ''
    return render(
        c,
        <MatchPage
            fmt={fmtFor(c)}
            detail={detail}
            event={event}
            boards={boards}
            version={version}
            lineups={await expectedLineups(detail)}
        />,
    )
})

// Before a match: both teams' starting fives, read from their latest games (same as team pages).
async function expectedLineups(detail: MatchDetail): Promise<[Player[], Player[]] | null> {
    if (!detail.match || detail.match.state !== 'unstarted') return null
    const ids = detail.match.teams.map(
        (t) => t.id ?? detail.details.match.teams.find((r) => r.code === t.code)?.id,
    )
    if (ids.some((id) => !id)) return null
    const [a, b] = await Promise.all(ids.map((id) => getTeamProfile(id!).catch(() => null)))
    return a?.starters.length && b?.starters.length ? [a.starters, b.starters] : null
}

// HLTV style: /team/<id>/<slug>
app.get('/team/:id/:slug?', async (c) => {
    const id = c.req.param('id')
    if (!/^\d+$/.test(id)) return notFound(c)
    const team = await getTeamProfile(id)
    if (!team) return notFound(c)
    if (c.req.param('slug') !== team.slug) return c.redirect(`/team/${team.id}/${team.slug}`, 301)
    return render(c, <TeamPage fmt={fmtFor(c)} team={team} />)
})

function notFound(c: Context) {
    return render(
        c,
        <ErrorPage
            fmt={fmtFor(c)}
            title="Not found"
            message="That page doesn't exist (or the API doesn't know it)."
        />,
        404,
    )
}

app.notFound(notFound)

app.onError((err, c) => {
    console.error(err)
    const upstream = err instanceof ApiError
    return render(
        c,
        <ErrorPage
            fmt={fmtFor(c)}
            title={upstream ? 'Data unavailable' : 'Something broke'}
            message={upstream ? "The lolesports API didn't respond. Try again in a minute." : String(err)}
        />,
        502,
    )
})

export default app
