# LOLTV

HLTV-inspired overview of League of Legends esports: live and upcoming matches and results at a
glance. Small type, dense rows, no autoplay, no spoiler gates. Personal project.

A Cloudflare Worker renders the HTML on the server, with [Hono](https://hono.dev) and server-only
JSX. The browser gets plain HTML and one CSS file. The only JS sets a timezone cookie and reloads
the page. It reloads every minute while a match is live, or once when the next match is due.

## Run locally

```bash
npm install
npm run dev        # http://localhost:8787
npm run typecheck
```

## Deploy (Cloudflare Workers)

### From the Cloudflare dashboard (deploys on every push to `master`)

1. Go to **Workers & Pages → Create → Import a repository**. Connect GitHub. Give the Cloudflare
   app access to the `LoLTV` repo only.
2. Select the repo and use these settings:
    - **Project name:** `loltv`. It must match `name` in `wrangler.jsonc`.
    - **Build command:** leave it empty. The build installs the dependencies automatically, and
      Wrangler bundles the TypeScript itself.
    - **Deploy command:** `npx wrangler deploy` (the default).
    - **Path:** `/`.
    - The Worker needs no variables or secrets.
3. Click **Deploy**. The site goes live at `https://loltv.<your-subdomain>.workers.dev`.
4. Under **Settings → Build → Branch control**, check that the production branch is `master`.
   Pushes to other branches upload only preview versions.
5. To use your own domain, go to **Settings → Domains & Routes → Add → Custom domain** and add
   it, e.g. `loltv.example.com`. The domain must be on the same Cloudflare account. Cloudflare
   configures DNS and the certificate automatically. A Worker needs no tunnel.

The Worker's logs are in its **Observability** tab. The free plan is enough. It allows 100k
requests a day and 10 ms of CPU time per request. A page uses a few ms. Error 1102 means
that a request exceeded the CPU time limit.

### From the terminal

```bash
npx wrangler login
npm run deploy     # -> https://loltv.<your-subdomain>.workers.dev
```

The code uses only standard `fetch`. A later move to Node/Docker needs `@hono/node-server` and a
Dockerfile, and nothing else changes.

## URLs (copied from HLTV)

| Page            | URL                                                                       |
| --------------- | ------------------------------------------------------------------------- |
| Home            | `/`                                                                       |
| Upcoming + live | `/matches`, `/matches?event=<id>`                                         |
| Results         | `/results`, `/results?event=<id>`, older: `/results?before=<token>`       |
| Events          | `/events`                                                                 |
| Event overview  | `/events/<id>/<slug>` (e.g. `/events/115660540725177488/worlds-2026`)     |
| Match           | `/matches/<id>/<team1>-vs-<team2>-<event>`                                |
| Ranking         | `/ranking`, `/ranking?league=<slug>`                                      |
| Team            | `/team/<id>/<slug>` (e.g. `/team/100205573496804586/hanwha-life-esports`) |

Slugs are cosmetic: a wrong or missing slug redirects to the correct one.

## Data

All data comes from the **unofficial** API that lolesports.com itself uses
(`esports-api.lolesports.com/persisted/gw/*`, with the public key from their frontend). The API
can change without notice. The Worker caches responses in memory: 60s for schedules, 6h for
leagues and tournaments. When the API fails, the Worker continues to serve the last good copy.

| Endpoint                                 | Used for                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- |
| `getSchedule`                            | all matches (global, or per league with `leagueId`), paged via tokens |
| `getLeagues` + `getTournamentsForLeague` | the event index (one call for all leagues)                            |
| `getStandings`                           | stage structure of an event (Swiss / bracket / round-robin tables)    |
| `getEventDetails`                        | match page: games, sides, VODs, streams                               |
| `getTeams`                               | team page: name, logo, home league, full roster with photos           |

Game scoreboards come from the live-stats feed (`feed.lolesports.com/livestats/v1/window`).
`src/live.ts` holds that code, separate from the other API calls. Champion icons come from Data
Dragon.

### Which leagues

The site shows tier 1 only: Worlds, MSI, First Stand, Esports World Cup and Americas Cup, plus
LCK, LPL, LEC, LCS, CBLOL and LCP. It excludes everything else that the API carries (ERLs,
Challengers, promotion tournaments, off-season cups). The list is at the top of `src/data.ts`.

### Global Power Ranking

The Global Power Ranking (GPR) isn't in that API. It comes from lolesports.com's own GraphQL
endpoint (`lolesports.com/api/gql`). That endpoint runs only _persisted_ queries: a request
sends the id of a query that their frontend registered, not the query itself. `QUERY_IDS` in
`src/api.ts` holds the ids that their frontend uses. The ids come from the query manifest chunk
in their JS bundle.

If Riot changes that query, the id stops working. Then the homepage panel shows the Swiss table
instead, `/ranking` shows a notice, and the league tags and team links disappear. To fix it,
find the new `GetTeamGpr` id in their manifest. The Worker caches the ranking for 3 hours.

The ranking also gives each team's id and home league. The site uses them for team links and
for the grey `LEC` / `LCK` tags next to team names at international events.

### Team pages

A team page combines four sources:

- `getTeams` (REST): the team and its roster
- the `GetTeamEvents` GraphQL query: its matches across all leagues
- the power ranking: rank and this year's placements
- the live-stats feed: the lineup

lolesports.com lists subs and academy players with a team, and doesn't say who starts. So
`lineup()` in `src/data.ts` reads the starting five from the metadata of the team's latest game.

### Events and stages

What HLTV calls an "event" is a _tournament_ inside a _league_ in the API. For example, Worlds
2026 is tournament `worlds_2026` in league `worlds`. The API doesn't give Swiss records, so
`swissTable()` counts them from the match results.

The HLTV-style Swiss bracket (`swissBracket()`) replays the results round by round to put each
match in its record pool. It assumes the 16-team, 3-wins/3-losses format that Worlds and MSI
use. For other formats it shows the table instead.

The homepage features the ongoing international event (Worlds / MSI / First Stand), or else the
next one. See `featuredEvent()` in `src/data.ts`.

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
public/            web app manifest and home-screen icons, served as static assets
reference/         HLTV (good) and lolesports.com (bad) screenshots used as design reference
```

The server renders times in the viewer's timezone. It reads the timezone from a `tz` cookie that
a small inline script sets on the first visit.

## Roadmap

Future work, fragile points and decisions so far are in [ROADMAP.md](ROADMAP.md).
