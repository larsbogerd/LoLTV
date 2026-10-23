# LOLTV

HLTV-style overview of League of Legends esports: live, upcoming and results at a glance.
Small type, dense rows, no autoplay, no spoiler gates. Personal project.

Server-rendered HTML from a Cloudflare Worker ([Hono](https://hono.dev) + JSX on the server only).
The browser gets plain HTML + one CSS file; the only JS is a timezone cookie and a
once-a-minute reload while something is live.

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

In the API, an "event" (HLTV's word) is a _tournament_ inside a _league_: Worlds 2026 is
tournament `worlds_2026` in league `worlds`. Swiss records aren't provided, so they're counted
from the match results in `swissTable()`.

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
  views/           ui.tsx (shared components), home, lists (matches/results/events), event, match
reference/         HLTV (good) and lolesports.com (bad) screenshots used as design reference
```

Times are rendered on the server in the viewer's timezone (read from a `tz` cookie that a
tiny inline script sets on the first visit).

## Ideas / not done yet

- Per-game winners and stats (kills, gold) via the live-stats feed (`feed.lolesports.com/livestats/v1/window/<gameId>`)
- League filter preferences, HLTV-style match "stars"
- Team pages (`/team/<id>/<slug>`)
