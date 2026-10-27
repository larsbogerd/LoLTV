import type { Child } from 'hono/jsx'
import { eventStatus, eventUrl, matchUrl, teamUrl, type Event, type Match, type Team } from '../data'
import { daysUntil, logoUrl, type Fmt } from '../format'
import { CSS_VERSION } from '../style'

// Stores the viewer's timezone in a cookie so the server can render local times.
// Reloads once (per tab session) when the cookie was missing or outdated.
const TZ_SCRIPT = `(function(){try{var z=Intl.DateTimeFormat().resolvedOptions().timeZone;var m=document.cookie.match(/(?:^|; )tz=([^;]*)/);if(z&&(!m||decodeURIComponent(m[1])!==z)){document.cookie="tz="+encodeURIComponent(z)+"; path=/; max-age=31536000; samesite=lax";if(!sessionStorage.getItem("tzr")){sessionStorage.setItem("tzr","1");location.reload();}}}catch(e){}})();`

// Keeps pages current without polling all day: reload every minute while something is live
// (data-live), or once when the next match is due to start (data-next). Only while visible.
const REFRESH_SCRIPT = `(function(){var d=document.body.dataset,t=Date.now(),due=d.next?Date.parse(d.next)+30000:0;if(!d.live&&!due)return;function r(){if(document.visibilityState!=="visible")return;var n=Date.now();if(d.live?n-t>60000:n>=due){try{sessionStorage.setItem("auto","1")}catch(e){}location.reload();}}setInterval(r,5000);document.addEventListener("visibilitychange",r);})();`

// Live game clocks count up every second. The feed's clock only arrives with a page load, so
// after one of our own auto-refreshes the running clock stays canon (no jumps); a refresh by
// the user takes the feed's clock again. Clocks of paused games don't run.
const CLOCK_SCRIPT = `(function(){var els=document.querySelectorAll("[data-clock]");if(!els.length)return;var auto=false,t0=Date.now();try{auto=sessionStorage.getItem("auto")==="1";sessionStorage.removeItem("auto")}catch(e){}els.forEach(function(el){var base=+el.dataset.clock,key="clock-"+el.dataset.game,run=!!el.dataset.running;try{var s=JSON.parse(sessionStorage.getItem(key)||"null");if(auto&&run&&s&&s.r)base=s.c+(t0-s.t)/1000;sessionStorage.setItem(key,JSON.stringify({c:base,t:t0,r:run}))}catch(e){}el.base=base});function fmt(s){s=Math.max(0,Math.floor(s));return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}function tick(){var dt=(Date.now()-t0)/1000;els.forEach(function(el){el.textContent=fmt(el.dataset.running?el.base+dt:el.base)})}tick();setInterval(tick,1000)})();`

// A match counts as live from its scheduled start: the API often flips to inProgress a few
// minutes late. Matches that are hours overdue are ignored (postponed or stale data).
function refreshHints(matches: Match[], now = Date.now()) {
    let live = false
    let next: string | null = null

    for (const m of matches) {
        if (m.state === 'inProgress') live = true

        if (m.state !== 'unstarted') continue
        const start = Date.parse(m.start)

        if (start <= now && now - start < 3 * 3600e3) live = true
        else if (start > now && start - now < 12 * 3600e3 && (!next || m.start < next)) next = m.start
    }

    return { live, next }
}

type NavKey = 'home' | 'matches' | 'results' | 'events' | 'ranking'

export function Layout(props: { title?: string; fmt: Fmt; watch?: Match[]; nav?: NavKey; children: Child }) {
    const { live, next } = refreshHints(props.watch ?? [])

    const link = (key: NavKey, href: string, label: string) => (
        <a href={href} class={props.nav === key ? 'on' : undefined}>
            {label}
        </a>
    )

    return (
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="theme-color" content="#2d3844" />
                <title>
                    {props.title ? `${props.title} | LOLTV` : 'LOLTV — League of Legends matches & results'}
                </title>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                <link rel="stylesheet" href={`/style.css?v=${CSS_VERSION}`} />
                <script dangerouslySetInnerHTML={{ __html: TZ_SCRIPT }} />
            </head>
            <body data-live={live ? '1' : undefined} data-next={!live && next ? next : undefined}>
                <header class="nav">
                    <div class="nav-inner">
                        <a class="brand" href="/">
                            LOL<span>TV</span>
                        </a>
                        <nav>
                            {link('matches', '/matches', 'Matches')}
                            {link('results', '/results', 'Results')}
                            {link('events', '/events', 'Events')}
                            {link('ranking', '/ranking', 'Ranking')}
                        </nav>
                    </div>
                </header>
                <main class="page">{props.children}</main>
                <footer>
                    <span>Times in {props.fmt.tz}</span>
                    <span>
                        Data: <a href="https://lolesports.com">lolesports.com</a> (unofficial)
                    </span>
                    {live && <span>Auto-refreshing while live</span>}
                    {!live && next && (
                        <span>Refreshes when the next match starts ({props.fmt.time(next)})</span>
                    )}
                </footer>
                <script dangerouslySetInnerHTML={{ __html: CLOCK_SCRIPT }} />
                <script dangerouslySetInnerHTML={{ __html: REFRESH_SCRIPT }} />
            </body>
        </html>
    )
}

export function Logo(props: { src: string | null | undefined; size: number }) {
    const url = logoUrl(props.src, props.size * 2)

    if (!url) return <span class="logo-ph" style={`width:${props.size}px;height:${props.size}px`} />

    return (
        <img
            class="logo"
            src={url}
            width={props.size}
            height={props.size}
            alt=""
            loading="lazy"
            decoding="async"
        />
    )
}

function teamClass(base: string, t: Team) {
    return [base, t.won === true && 'won', t.won === false && 'lost', t.tbd && 'tbd']
        .filter(Boolean)
        .join(' ')
}

const ROLE_SHORT = new Map([
    ['top', 'TOP'],
    ['jungle', 'JGL'],
    ['mid', 'MID'],
    ['bottom', 'BOT'],
    ['support', 'SUP'],
])

// TOP / JGL / MID / BOT / SUP, as on the scoreboard and lineups.
export function roleLabel(role: string): string {
    return ROLE_SHORT.get(role) ?? role
}

// Small grey home-league label after a team name, at international events only.
// A team name that links to the team page when the team's id is known.
export function TeamName(props: { t: { id?: string; slug?: string; name: string } }) {
    const url = teamUrl(props.t)

    return url ? (
        <a class="team-link" href={url}>
            {props.t.name}
        </a>
    ) : (
        <>{props.t.name}</>
    )
}

export function Tag(props: { t: Team }) {
    return props.t.tag ? <span class="tag">{props.t.tag}</span> : null
}

function eventLabel(m: Match) {
    return m.event?.name ?? m.leagueName
}

// ---------- upcoming / live ----------

export function MatchRow(props: { m: Match; fmt: Fmt; showEvent?: boolean }) {
    const { m, fmt } = props
    const live = m.state === 'inProgress'

    return (
        <a class={`mrow ${m.state} ${props.showEvent === false ? 'noev' : ''}`} href={matchUrl(m)}>
            <div class="mt">
                {live ? <span class="live">LIVE</span> : <b>{fmt.time(m.start)}</b>}
                <span class="bo">bo{m.bestOf}</span>
            </div>
            <div class="mteams">
                {m.teams.map((t) => (
                    <div class={teamClass('tl', t)}>
                        <Logo src={t.image} size={18} />
                        <span class="tn">{t.name}</span>
                        <Tag t={t} />
                        {live && <span class="ts">{t.score ?? 0}</span>}
                    </div>
                ))}
            </div>
            <div class="mev">
                {props.showEvent !== false && <Logo src={m.leagueImage} size={22} />}
                <div style="min-width:0">
                    {props.showEvent !== false && <span class="name">{eventLabel(m)}</span>}
                    <small>{m.stage}</small>
                </div>
            </div>
        </a>
    )
}

// ---------- results ----------

export function ResultRow(props: { m: Match; showEvent?: boolean }) {
    const { m } = props
    const [a, b] = m.teams
    const showEvent = props.showEvent !== false

    return (
        <a class={`rrow ${showEvent ? '' : 'noev'}`} href={matchUrl(m)}>
            <div class={teamClass('rt r1', a)}>
                <Tag t={a} />
                <span class="tn">{a.name}</span>
                <Logo src={a.image} size={18} />
            </div>
            <div class="rs">
                <span class={a.won ? 'w' : 'l'}>{a.score ?? '-'}</span> -{' '}
                <span class={b.won ? 'w' : 'l'}>{b.score ?? '-'}</span>
            </div>
            <div class={teamClass('rt r2', b)}>
                <Logo src={b.image} size={18} />
                <span class="tn">{b.name}</span>
                <Tag t={b} />
            </div>
            <div class="rev">
                {showEvent && <Logo src={m.leagueImage} size={18} />}
                <span class="name">{showEvent ? `${eventLabel(m)} · ${m.stage}` : m.stage}</span>
            </div>
            <div class="rbo">bo{m.bestOf}</div>
        </a>
    )
}

// Groups rows under day headings, like HLTV's matches and results pages.
export function ByDay(props: { matches: Match[]; fmt: Fmt; row: (m: Match) => Child }) {
    const groups = new Map<string, Match[]>()

    for (const m of props.matches) {
        const key = props.fmt.dayKey(m.start)
        groups.set(key, [...(groups.get(key) ?? []), m])
    }

    return (
        <>
            {[...groups].map(([key, ms]) => {
                const rel = props.fmt.relativeDay(key)

                return (
                    <>
                        <h3 class="day">
                            {rel && <em>{rel}</em>}
                            {props.fmt.dayHeading(key)}
                        </h3>
                        <div class="group">{ms.map(props.row)}</div>
                    </>
                )
            })}
        </>
    )
}

// ---------- compact "today's matches" box ----------

// `day` labels a match that isn't today. It shows only on phones, where the group labels
// of the homepage strip are hidden.
export function CompactMatch(props: { m: Match; fmt: Fmt; day?: string }) {
    const { m, fmt } = props
    const showScore = m.state !== 'unstarted'

    return (
        <a class={`tm ${m.state}`} href={matchUrl(m)} title={`${eventLabel(m)} · ${m.stage}`}>
            <div class="tm-teams">
                {m.teams.map((t) => (
                    <div class={teamClass('tm-team', t)}>
                        <Logo src={t.image} size={14} />
                        <span class="tn">{t.tbd ? 'TBD' : t.code}</span>
                        {showScore && <span class="ts">{t.score ?? 0}</span>}
                    </div>
                ))}
            </div>
            <div class="tm-time">
                {m.state === 'inProgress' ? (
                    <span class="live">LIVE</span>
                ) : m.state === 'completed' ? (
                    'Final'
                ) : (
                    <>
                        {props.day && <span class="tm-day">{props.day} </span>}
                        {fmt.time(m.start)}
                    </>
                )}
            </div>
        </a>
    )
}

// ---------- event banner ----------

export function EventBanner(props: {
    event: Event
    fmt: Fmt
    tab?: 'overview' | 'matches' | 'results'
    sub?: string
}) {
    const { event: e, fmt } = props
    const status = eventStatus(e)
    const dates = `${fmt.shortDate(`${e.startDate}T12:00:00Z`)} – ${fmt.shortDate(`${e.endDate}T12:00:00Z`)}`

    const tab = (key: string, href: string, label: string) => (
        <a href={href} class={props.tab === key ? 'on' : undefined}>
            {label}
        </a>
    )

    return (
        <div class="banner">
            <div class="banner-main">
                <Logo src={e.league.image} size={44} />
                <div style="min-width:0">
                    <a href={eventUrl(e)} class="banner-title">
                        {e.name}
                    </a>
                    <div class="banner-sub">
                        {dates}
                        {props.sub && ` · ${props.sub}`}
                    </div>
                </div>
                <span class={`pill ${status === 'ongoing' ? 'on' : ''}`}>{status}</span>
            </div>
            <nav class="tabs">
                {tab('overview', eventUrl(e), 'Overview')}
                {tab('matches', `/matches?event=${e.id}`, 'Matches')}
                {tab('results', `/results?event=${e.id}`, 'Results')}
            </nav>
        </div>
    )
}

// Event filter chips for the global matches/results pages.
export function EventChips(props: { matches: Match[]; base: string; current?: string }) {
    const seen = new Map<string, Event>()

    for (const m of props.matches) if (m.event && !seen.has(m.event.id)) seen.set(m.event.id, m.event)

    if (seen.size < 2) return null
    const events = [...seen.values()].sort((a, b) => a.league.tier - b.league.tier)

    return (
        <div class="chips">
            <a class={`chip ${props.current ? '' : 'on'}`} href={props.base}>
                All
            </a>
            {events.map((e) => (
                <a class={`chip ${props.current === e.id ? 'on' : ''}`} href={`${props.base}?event=${e.id}`}>
                    <Logo src={e.league.image} size={14} />
                    {e.name}
                </a>
            ))}
        </div>
    )
}

export function eventWhen(e: Event, fmt: Fmt, now = new Date()): string {
    const status = eventStatus(e, now)

    if (status === 'ongoing') return 'Ongoing'

    if (status === 'finished') return `Ended ${fmt.shortDate(`${e.endDate}T12:00:00Z`)}`
    const days = daysUntil(e.startDate, now)

    return days <= 1 ? 'Starts tomorrow' : `In ${days} days`
}
