# LOLTV

HLTV-style overview of League of Legends esports: live, upcoming and results at a glance.
Small type, dense rows, no autoplay, no spoiler gates. Personal project.

Server-rendered HTML from a Cloudflare Worker ([Hono](https://hono.dev) + JSX on the server only).
The browser gets plain HTML + one CSS file; the only JS is a timezone cookie and an
auto-refresh (every minute while a match is live, or once when the next match is due).

## Run locally

```bash
npm install
npm run dev        # http://localhost:8787
npm run typecheck
```

## Deploy (Cloudflare Workers)

```bash
npx wrangler login
npm run deploy     # -> https://loltv.<your-subdomain>.workers.dev
```

To serve it on your own domain, add a custom domain to the `loltv` Worker in the Cloudflare
dashboard (Workers & Pages → loltv → Settings → Domains & Routes), or add a `routes` entry
to `wrangler.jsonc`. The free plan is plenty.

The code only uses standard `fetch`, so moving to Node/Docker later means adding
`@hono/node-server` and a Dockerfile; nothing else changes.

## URLs (copied from HLTV)

| Page            | URL                                                                   |
| --------------- | --------------------------------------------------------------------- |
| Home            | `/`                                                                   |
| Upcoming + live | `/matches`, `/matches?event=<id>`                                     |
| Results         | `/results`, `/results?event=<id>`, older: `/results?before=<token>`   |
| Events          | `/events`                                                             |
| Event overview  | `/events/<id>/<slug>` (e.g. `/events/115660540725177488/worlds-2026`) |
| Match           | `/matches/<id>/<team1>-vs-<team2>-<event>`                            |
| Ranking         | `/ranking`, `/ranking?league=<slug>`                                  |

Slugs are cosmetic: a wrong or missing slug redirects to the right one.

## Data

Everything comes from the **unofficial** API that lolesports.com itself uses
(`esports-api.lolesports.com/persisted/gw/*`, public key from their frontend). It can change
without notice. Responses are cached in memory (60s for schedules, 6h for leagues/tournaments),
and when the API fails we keep serving the last good copy.

| Endpoint                                 | Used for                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `getSchedule`                            | all matches (global, or per league with `leagueId`), paged via tokens |
| `getLeagues` + `getTournamentsForLeague` | the event index (one call for all leagues)                            |
| `getStandings`                           | stage structure of an event (Swiss / bracket / round-robin tables)    |
| `getEventDetails`                        | match page: games, sides, VODs, streams                               |

### Which leagues

Only tier 1: Worlds, MSI, First Stand, Esports World Cup and Americas Cup, plus LCK, LPL,
LEC, LCS, CBLOL and LCP. Everything else the API carries (ERLs, Challengers, promotion
tournaments, off-season cups) is filtered out; the list is at the top of `src/data.ts`.

### Global Power Ranking

GPR isn't in that API. It comes from lolesports.com's own GraphQL endpoint
(`lolesports.com/api/gql`), which only runs _persisted_ queries: requests send the id of a
query registered by their frontend instead of the query itself. `GPR_QUERY_ID` in
`src/api.ts` is the id their GPR page uses, found in the query manifest chunk of their JS
bundle. If Riot changes that query the id stops working: the homepage panel then falls back
to the Swiss table, `/ranking` shows a notice and the league tags disappear. To fix it,
look up the new `GetTeamGpr` id in their manifest. The ranking is cached for 3 hours.

The ranking also provides each team's home league, used for the grey `LEC` / `LCK` tags
next to team names at international events.

### Events and stages

In the API, an "event" (HLTV's word) is a _tournament_ inside a _league_: Worlds 2026 is
tournament `worlds_2026` in league `worlds`. Swiss records aren't provided, so they're counted
from the match results in `swissTable()`. The HLTV-style Swiss bracket (`swissBracket()`)
replays the results round by round to put each match in its record pool; it assumes the
16-team, 3-wins/3-losses format used at Worlds and MSI, and falls back to the table otherwise.

The homepage features the ongoing international event (Worlds / MSI / First Stand), or
the next one coming up. See `featuredEvent()` in `src/data.ts`.

## Layout

```
src/
  index.tsx        routes
  api.ts           raw API client + cache
  data.ts          domain model: events, matches, standings
  format.ts        timezone-aware formatting, slugs, logo resizing
  style.ts         all CSS
  views/           ui.tsx (shared components), home, lists (matches/results/events),
                   event, match, ranking
reference/         HLTV (good) and lolesports.com (bad) screenshots used as design reference
```

Times are rendered on the server in the viewer's timezone (read from a `tz` cookie that a
tiny inline script sets on the first visit).

## Roadmap

Future work, fragile points and decisions so far are in [ROADMAP.md](ROADMAP.md).
