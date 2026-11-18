# LOLTV

An HLTV inspired overview of League of Legends esports: live and upcoming matches, results, events,
rankings, teams and transfers at a glance.

Live at [loltv.larsbogerd.com](https://loltv.larsbogerd.com/).

## Why

I follow CS2 esports, and [HLTV](https://www.hltv.org) is a big part of why that is easy: small
type, dense rows, everything on one page, easy on the eyes. When League of Legends' Worlds 2026 came up I wanted
to follow it the same way. [LoL Esports](https://lolesports.com) made that hard: big cards, autoplaying video, spoiler
gates, and a lot of clicks to learn who plays when.

So I built the site I wanted to use. It shows League of Legends esports the way HLTV shows
Counter-Strike. It started as a simple schedule for Worlds and grew into events, brackets, power
rankings, team pages and a transfers page for the off-season.

Thanks to Riot Games for leaving the data behind lolesports.com open enough to build on, and to
[Leaguepedia](https://lol.fandom.com) for the rosters and transfers.

## How it is built

The site runs on the free plan of Cloudflare Workers and deploys on every push to `master`. It
needs no variables or secrets. `wrangler.jsonc` declares the only two resources: a KV namespace
for the Leaguepedia data and a cron trigger that fills it.

The parts that took the most thought:

- **Swiss brackets.** The API gives no Swiss records, so the site replays the results round by
  round to put each match in its record pool (see "Events and stages").
- **Transfers.** Leaguepedia has joins and leaves, not transfers. Pure functions pair them, and
  tests cover the rules with real rows.
- **A slow source on a free plan.** Leaguepedia allows about one request per six seconds, so a
  cron trigger fetches it in twelve small steps per hour and no page ever waits for it.
- **APIs that can easily change.** The data source is unofficial, so each part tries falling back to
  something useful when a call fails.

## URLs

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
LCK, LPL, LEC, LCS, CBLOL and LCP. It excludes everything else that the API carries that I consider noise (ERLs,
Challengers, promotion tournaments, off-season cups). The list is at the top of `src/data/events.ts`.

### Events and stages

What HLTV calls an "event" is a _tournament_ inside a _league_ in the API. For example, Worlds
2026 is tournament `worlds_2026` in league `worlds`. The API doesn't give Swiss records, so
`swissTable()` counts them from the match results.

The HLTV-style Swiss bracket (`swissBracket()`) replays the results round by round to put each
match in its record pool. It assumes the 16-team, 3-wins/3-losses format that Worlds and MSI
use. For other formats it shows the table instead.

The homepage features the ongoing international event (Worlds / MSI / First Stand), or else the
next one. See `featuredEvent()` in `src/data/events.ts`.

The server renders times in the viewer's timezone. It reads the timezone from a `tz` cookie that
a small inline script sets on the first visit.

## Tech stack

- **Language:** TypeScript, strict mode.
- **Server:** [Hono](https://hono.dev) on Cloudflare Workers, with server-rendered JSX.
- **Storage and jobs:** Workers KV and a cron trigger, for the Leaguepedia data.
- **Frontend:** plain HTML and one CSS file. No client framework, and only a few small inline
  scripts.
- **Tests:** Node's built-in test runner (`node --test`).
- **Tooling:** ESLint, Prettier and `tsc`, run by GitHub Actions on every push and pull request.

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
`time` values are the start of an hour plus 0, 5, 10 ... 55 minutes, in milliseconds.

## Credits and legal

- Match, event, team and ranking data: [lolesports.com](https://lolesports.com), through its
  unofficial API. Champion icons: Data Dragon.
- Rosters and transfers: [Leaguepedia](https://lol.fandom.com), licensed
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).
- Layout and URL scheme: inspired by [HLTV](https://www.hltv.org). This project has no
  connection to HLTV.

LOLTV was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot
Games. Riot Games does not endorse or sponsor this project.

The code is licensed under the [MIT License](LICENSE). The license doesn't cover the data, logos
and photos that the site shows, or the Leaguepedia rows in the test fixtures.

## Roadmap

Future work, fragile points and decisions so far are in [ROADMAP.md](ROADMAP.md).
