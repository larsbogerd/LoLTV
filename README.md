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
npm test           # the transfer pairing rules (node --test, no dependencies)
```

Transfers and rosters come from a cron trigger, which doesn't run by itself in `wrangler dev`.
To fill the local KV, start the server with `npx wrangler dev --test-scheduled` and request
`/cdn-cgi/handler/scheduled?time=<ms>` once for each of the twelve steps of an hour: the
`time` values are the start of an hour plus 0, 5, 10 ... 55 minutes, in milliseconds. Leave a
few seconds between the requests (see "Rosters and transfers" below).

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
    - The Worker needs no variables or secrets. It has one KV namespace (`WIKI`, for rosters
      and transfers) and a cron trigger, both declared in `wrangler.jsonc`. The namespace has no
      id there, so Wrangler creates it on deploy. If a deploy asks for an id instead, run
      `npx wrangler kv namespace create WIKI` and put the id it prints in `wrangler.jsonc`.
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
| Transfers       | `/transfers`, `/transfers?league=<slug>`, `/transfers?team=<id>`          |

Slugs are cosmetic: a wrong or missing slug redirects to the correct one.

## Data

Matches, events, teams and rankings come from the **unofficial** API that lolesports.com itself uses
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

A team page combines five sources:

- `getTeams` (REST): the team, and photos of everyone lolesports.com lists with it
- the `GetTeamEvents` GraphQL query: its matches across all leagues
- the power ranking: rank and this year's placements
- Leaguepedia: the roster (starters, bench, head coach, contracts) and the team's roster moves
- the live-stats feed: who played the team's latest game

The roster is who is under contract according to Leaguepedia. It all sits in the profile box:
one starter per role as a card (with flag and the contract's last year), then the head coach
and the bench as lines under the team's numbers, as on HLTV. A role or the head coach line with
nobody in it shows as "Open". The rest of the coaching staff isn't shown. This is right all
winter, when the last game played still shows last season's five.

Flags are emoji made from the country name (`flagEmoji()` in `src/format.ts`), so there are no
image files. Windows browsers show two letters instead of a flag.

The live-stats feed remains for two cases. When Leaguepedia lists two starters for one role,
the one who played the latest game gets the card. When Leaguepedia has nothing for a team (KV
empty, or the team isn't matched), `lineup()` in `src/data.ts` gives the five who played the
latest game, as before, and the page shows no coach.

### Rosters and transfers (Leaguepedia)

lolesports.com has no roster changes, coaches or contracts. [Leaguepedia](https://lol.fandom.com)
has them, in Cargo tables that anyone can query without a key: `RosterChanges` (one row per
join or leave), `NewsItems` (the announcement behind it), `Players` (who is on a team now) and
`Teams`. The content is CC BY-SA 3.0, so the footer credits it. `src/wiki.ts` holds the client.

Leaguepedia is slow on purpose: more than about one request per six seconds gets a
`ratelimited` error. So no page ever queries it. A cron trigger runs every five minutes and does
one step per run, twelve steps to the hour, each with at most one Leaguepedia request:

| Step                 | Does                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `teams`              | the ranked teams, matched to their Leaguepedia names                 |
| `rosterA`, `rosterB` | everyone on those teams, half the teams at a time                    |
| `coachesA/B`         | the coaches' joins, which say who is head coach                      |
| `moves0`, `moves1`   | joins and leaves at those teams in the last 90 days, 500 rows a page |
| `others0` – `2`      | the same players' joins and leaves at teams outside tier 1           |
| `photos`             | player photos from the lolesports rosters, 20 teams per hour         |
| `assemble`           | builds the two documents that pages read                             |

Each step stores its rows in a Workers KV namespace (binding `WIKI`). `assemble` writes
`wiki:rosters` and `wiki:moves`, and pages read only those two. A step that fails keeps its
previous rows, and the next hour tries again. The step follows from the clock, so the cron keeps
no state. One step per run also keeps the Worker under the free plan's limits (CPU time,
50 subrequests).

Teams are matched by name, then by short code when exactly one active team has it. What neither
finds goes in `ALIASES` in `src/wiki.ts`, and the `teams` step logs every team it can't match.

Leaguepedia has no "transfer" rows. `toMoves()` in `src/transfers.ts` makes them:

- a leave and a join on the same team and day is a contract renewal (not shown), unless the
  status changed: then the player was benched, or came back
- a leave and a join at two teams within a week is one transfer
- a row on its own is a signing from no team, or a departure to no team

`test/transfers.test.mjs` covers these rules with real rows. The transfers page shows players
and coaches. It leaves out streamers, managers, analysts and owners.

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
  data.ts          domain model: events, matches, standings, team profiles
  live.ts          live-stats feed: game scoreboards
  wiki.ts          Leaguepedia client, the cron steps, and the KV documents pages read
  transfers.ts     pure roster logic: rows to transfers, players to a roster
  format.ts        timezone-aware formatting, slugs, logo resizing
  style.ts         all CSS
  views/           ui.tsx (shared components), home, lists (matches/results/events),
                   event, match, ranking, team, transfers
test/              node --test fixtures for transfers.ts
public/            web app manifest and home-screen icons, served as static assets
reference/         HLTV (good) and lolesports.com (bad) screenshots used as design reference
```

The server renders times in the viewer's timezone. It reads the timezone from a `tz` cookie that
a small inline script sets on the first visit.

## Roadmap

Future work, fragile points and decisions so far are in [ROADMAP.md](ROADMAP.md).
