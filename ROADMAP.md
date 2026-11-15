# Roadmap

Where LOLTV is going and what to watch. Continue from here in a new session.

## Later additions

- **Team profiles, round two:** the pages exist (`/team/<id>/<slug>`). Ideas next:
    - power ranking history as a small chart. `teamGPRHistory` is in the ranking response, but
      the code doesn't map it yet.
    - player and coach pages (`/player/<pageId>/<handle>`, the id being the Leaguepedia page id
      that the roster snapshot already keeps): bio, contract and team history from
      Leaguepedia's `Players` and `Tenures` tables, later per-game stats from
      `ScoreboardPlayers`. One query per page, on demand, stored in KV for a day: a page view
      must never query Leaguepedia directly (see "Fragile points").
    - tabs like HLTV's (Matches, Events, Achievements)
- **Transfers, round two.** The first version is `/transfers` (see the README).
    - **Verify before the first deploy:** that Leaguepedia answers requests from Cloudflare's
      network at all. Every test so far ran from a home connection. Workers share their
      outbound addresses, and Leaguepedia limits per address. If it throttles or blocks them,
      log in with a Leaguepedia bot password (a Worker secret), which has a higher limit.
    - where a player went after a free-agency gap. Today a join more than a week after the
      leave shows as "No team → B".
    - paging beyond 90 days.
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
- **Leaguepedia** (`src/wiki.ts`): rosters and transfers. Three things can break it.
    - **The rate limit.** About one request per six seconds from one address, measured in
      November 2026: seven requests six seconds apart were fine, four within six seconds were
      not. The cron does one request per five minutes. Never add a query to a page view.
    - **Table and field names.** The queries name Cargo tables and fields (`RosterChanges`,
      `Players.IsSubstitute`, ...). If the wiki renames one, that step fails and logs
      `wiki <step> failed`, and pages keep the last good data.
    - **Team names.** A team that rebrands on lolesports.com but not on Leaguepedia stops
      matching. The `teams` step logs `no Leaguepedia team for ...`, and that team's page falls
      back to the last game's lineup. Add the team to `ALIASES`.
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
- **Rosters and transfers:** from Leaguepedia, fetched by a cron trigger into KV, never by a
  page view. Liquipedia was the other candidate. Its free API has no table queries and doesn't
  support read-only use, and its database API needs a key whose plans were unavailable in
  November 2026.
- **Team pages:** the roster is who is under contract (Leaguepedia), not who played the last
  game. The last game only breaks a tie between two starters for one role, and stands in when
  Leaguepedia has nothing. Trade-off: when a substitute plays mid-season, the page shows the
  contracted starter until Leaguepedia marks the change.
- **Transfers page:** players and coaches of tier 1 teams, last 90 days. Contract renewals are
  hidden, as on HLTV. Bench moves are shown.
- **Leagues:** tier 1 only. The cross-region events are Worlds, MSI, First Stand, EWC and
  Americas Cup. The regions are LCK, LPL, LEC, LCS, CBLOL and LCP. The list is at the top of
  `src/data.ts`.
- **Spoilers:** the site always shows results. There is deliberately no spoiler toggle.
- **URLs:** HLTV's URL scheme. Slugs are cosmetic, and a wrong slug redirects to the correct one.
- **Homepage:** three states.
    - **A major is on:** Worlds, MSI or First Stand gets the banner and the centre column, from
      14 days before it starts until its final is played.
    - **The leagues are playing:** the centre column lists every league's matches. The last
      major's champion and runner-up sit in the sidebar.
    - **A break** (nothing live, nothing starting within 7 days): the last major's banner and
      finalists lead, above the next events with their dates and the last four results. The
      winner also leads for 14 days after any major.

- **Finished events:** an event is finished once its last match is played, even when the API's
  end date is a day later. Its overview then shows the final placements, read from the last
  real bracket, in place of the latest results. The `/events` list has no matches to look at,
  so it still goes by the end date.
