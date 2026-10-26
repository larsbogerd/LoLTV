# Roadmap

Where LOLTV is going and what to watch. Continue from here in a new session.

## Next up

- **Check live Bo3 and Bo5 scores** once Worlds Swiss has a live Bo3 (the first ones are on 25 and
  26 Oct 2026). The series score (games won) should update after each game in match rows, the
  Swiss bracket and the match page. If it updates only at the end, look at `getLive` instead of
  the schedule.

## Later additions

- **Team profiles, round two:** the pages exist (`/team/<id>/<slug>`). Ideas next:
    - power ranking history as a small chart. `teamGPRHistory` is in the ranking response, but
      the code doesn't map it yet.
    - player pages, plus tabs like HLTV's (Matches, Events, Achievements)
    - not in the API: coach, player ages and nationalities. Those would need Liquipedia,
      which is rate-limited.
- **Live match stats, round two.** The first version, a scoreboard per game on the match page,
  lives in `src/live.ts` and `src/views/game.tsx`. Items have hover tooltips from Data Dragon's
  `item.json` for the game's patch. Ideas next:
    - runes, skill order and summoner spells: `/details` has runes and skill order, but the
      board leaves both out to stay lean. An earlier version showed runes, and they were
      removed. Summoner spells aren't in the feed.
    - a gold-lead graph over the game, by fetching several windows
    - refreshing just the scoreboard every 10–15s while live, instead of the whole-page reload
      every minute
    - a winner in the Games table. The feed has no winner field. For a Bo1 the code uses the
      match result. For other games it guesses from towers destroyed, and from gold on a tie.
      Check this against real results.
- **Calendar subscription (.ics)** per event or team, so matches appear in a phone calendar in
  local time.
- **Favourite teams**, highlighted across pages and stored in a cookie (no accounts).
- **Region strength** from lolesports.com's `GetLeagueElo` GraphQL query, which uses the same
  persisted-query setup as the power ranking. It gives context for cross-region matchups.
- **Add to home screen**: a web app manifest and icon so it opens like an app on a phone.
- **Own typeface**: replace the system font stack with one semi-condensed family, e.g. Barlow
  Semi Condensed. It fits more team names per row and gives the site its own voice. Serve a
  subset woff2 (about 20 KB) from the Worker, so the page still loads no third-party assets.
- **Visible keyboard focus**: a 2px gold `:focus-visible` outline on links and rows. Today only
  hover states exist, so keyboard users can't see where they are.
- **HLTV-style match stars** (importance), e.g. from the power ranks of both teams.
- **Proper double-elimination brackets** for regional playoffs (LEC, LCS, LPL, ...). Draw them
  like Liquipedia: upper bracket on top, lower bracket below, connector lines, grand final on
  the right. See `reference/good/liquipedia-lec-double-elim-playoffs.webp` and
  [the LEC 2025 Summer playoffs](https://liquipedia.net/leagueoflegends/LEC/2025/Summer/Playoffs).
  For now, `bracketColumns()` in `src/data.ts` shows irregular playoffs as a chronological grid.
    - **The hard part is the data:** the API has no bracket structure (`previousMatchIds` is
      empty, and every match is just "Playoffs").
    - **Finished matches:** the code can rebuild the links from each team's previous match in
      the stage. A team that comes from a win is in the upper bracket. A team that comes from a
      loss is in the lower bracket.
    - **Matches still to be played:** these are TBD vs TBD. To place them, the code needs a
      template per league format (number of teams, which rounds exist). It matches that
      template against the schedule.
    - **Rejected:** Liquipedia's own API is rate-limited and needs attribution, and its data API
      needs a key. So Liquipedia isn't a good live source for a Worker.
- **Docker/Node option**: add `@hono/node-server` and a Dockerfile if the site ever leaves
  Workers.

## Fragile points

- **GraphQL query ids** (`QUERY_IDS` in `src/api.ts`: `GetTeamGpr` and `GetTeamEvents`).
  If lolesports.com changes a query, its id stops working.
    - **`GetTeamGpr` breaks:** the homepage shows the Swiss standings instead, `/ranking` shows
      a notice, and league tags and team links disappear.
    - **`GetTeamEvents` breaks:** team pages show a notice instead of their matches and lose
      the lineup.

    To find a new id:
    1. Open lolesports.com/en-US/gpr.
    2. Find the JS chunk that holds the persisted-query manifest. Search the bundles for
       `generatePersistedQueryIdsFromManifest`.
    3. In that manifest, read the `id` of the operation (`GetTeamGpr`, `GetTeamEvents`).
    4. Send these headers with each request: `content-type: application/json`,
       `apollographql-client-name` and `apollographql-client-version`.

- **Swiss bracket** (`swissBracket()` in `src/data.ts`). It assumes the 16-team, 3-wins /
  3-losses format. It takes the rounds from chronological chunks of 8/8/8/6/3 matches. For a
  different format it shows the standings table instead.
- **Unofficial API**: `esports-api.lolesports.com` with the public key from their frontend.
  The Worker caches responses and serves stale copies when the API fails. But the whole site
  still depends on the API.

## Decisions so far

- **Hosting:** Cloudflare Workers, and the site is live (see the README's "Deploy" section). It
  stays on Workers, also for future live stats, which will poll from the client. Only push
  updates would need self-hosting.
- **Match page:** a stakes line, plus expected lineups before a match starts. Live and result
  pages show no player photos. On desktop, a sidebar next to the Games table shows each team's
  recent form (last five results) and their head-to-head (last three meetings), from
  `GetTeamEvents`. Phones don't show the sidebar.
- **Leagues:** tier 1 only. The cross-region events are Worlds, MSI, First Stand, EWC and
  Americas Cup. The regions are LCK, LPL, LEC, LCS, CBLOL and LCP. The list is at the top of
  `src/data.ts`.
- **Spoilers:** the site always shows results. There is deliberately no spoiler toggle.
- **URLs:** HLTV's URL scheme. Slugs are cosmetic, and a wrong slug redirects to the correct one.
- **Featured event:** the homepage features the ongoing (or next) Worlds, MSI or First Stand.
