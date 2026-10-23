# Roadmap

Where LOLTV is heading and what to keep an eye on. Pick up from here in a new session.

## Next up

- **Deploy to Cloudflare Workers.** Run `npx wrangler login` once, then `npm run deploy`, then
  attach a custom domain to the `loltv` Worker. See the README's "Deploy" section.
- **Check live Bo3 and Bo5 scores** once Worlds Swiss has a live Bo3 (the first ones are on 25 and
  26 Oct 2026). The series score (games won) should update after each game in match rows, the
  Swiss bracket and the match page. If it only updates at the end, look at `getLive` instead
  of the schedule.

## Later additions

- **Team profiles** (`/team/<id>/<slug>`): roster, upcoming matches, recent results, and the
  power ranking history. `teamGPRHistory` is already in the ranking response. lolesports.com's
  GraphQL manifest also has a `GetTeams` query (TeamOverview).
- **Live match stats**: kills, gold, towers and dragons per game from the live-stats feed
  (`feed.lolesports.com/livestats/v1/window/<gameId>?startingTime=<ISO, rounded to 10s>`).
    - **What it unlocks:** the per-game winners the match page can't show today.
    - **The catch:** without `startingTime` it returns the start of the game, so finished games
      need a time search to reach the final frame.
- **Power rank in match rows and on the match page**, e.g. "#1 HLE vs #13 TES". The data is
  already loaded for the league tags.
- **Calendar subscription (.ics)** per event or team, so matches appear in a phone calendar in
  local time.
- **Favourite teams**, highlighted across pages and stored in a cookie (no accounts).
- **Head-to-head and recent form** on the match page, built from schedule history.
- **Region strength** from lolesports.com's `GetLeagueElo` GraphQL query, which uses the same
  persisted-query setup as the power ranking. Gives context for cross-region matchups.
- **Add to home screen**: a web app manifest and icon so it opens like an app on a phone.
- **HLTV-style match stars** (importance), e.g. from the power ranks of both teams.
- **Proper double-elimination brackets** for regional playoffs (LEC, LCS, LPL, ...), drawn
  like Liquipedia: upper bracket on top, lower bracket below, connector lines, grand final on
  the right. See `reference/good/liquipedia-lec-double-elim-playoffs.webp` and
  [the LEC 2025 Summer playoffs](https://liquipedia.net/leagueoflegends/LEC/2025/Summer/Playoffs).
  For now irregular playoffs are a chronological grid (`bracketColumns()` in `src/data.ts`).
    - **The hard part is the data:** the API has no bracket structure (`previousMatchIds` is
      empty, and every match is just "Playoffs").
    - **Finished matches:** the links can be rebuilt by finding each team's previous match in
      the stage. A team arriving from a win is in the upper bracket, from a loss the lower one.
    - **Matches still to be played:** these are TBD vs TBD, so placing them needs a template
      per league format (number of teams, which rounds exist), matched against the schedule.
    - **Rejected:** Liquipedia's own API is rate-limited, needs attribution, and its data API
      requires a key, so it isn't a good live source for a Worker.
- **Docker/Node option**: add `@hono/node-server` and a Dockerfile if it ever moves off
  Workers.

## Fragile points

- **Power ranking query id** (`GPR_QUERY_ID` in `src/api.ts`). If lolesports.com changes the
  query, the homepage falls back to Swiss standings, `/ranking` shows a notice and the league
  tags disappear. To find the new id:
    1. Open lolesports.com/en-US/gpr and find the JS chunk that holds the persisted query
       manifest (search the bundles for `generatePersistedQueryIdsFromManifest`).
    2. In that manifest, read the `id` of the `GetTeamGpr` operation.
    3. Requests need these headers: `content-type: application/json`,
       `apollographql-client-name` and `apollographql-client-version`.
- **Swiss bracket** (`swissBracket()` in `src/data.ts`). It assumes the 16-team, 3-wins /
  3-losses format, with rounds taken from chronological chunks of 8/8/8/6/3 matches. A
  different format falls back to the standings table.
- **Unofficial API**: `esports-api.lolesports.com` with the public key from their frontend.
  Responses are cached and served stale on errors, but the whole site depends on it.

## Decisions so far

- **Leagues:** tier 1 only. The cross-region events are Worlds, MSI, First Stand, EWC and
  Americas Cup; the regions are LCK, LPL, LEC, LCS, CBLOL and LCP. The list lives at the top of
  `src/data.ts`.
- **Spoilers:** results are always shown. A spoiler toggle was explicitly not wanted.
- **URLs:** HLTV's URL scheme. Slugs are cosmetic and redirect to the correct one.
- **Featured event:** the homepage features the ongoing (or next) Worlds, MSI or First Stand.
