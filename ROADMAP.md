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

- **Team profiles, round two:** the pages exist (`/team/<id>/<slug>`). Ideas next:
    - power ranking history as a small chart; `teamGPRHistory` is in the ranking response
      but isn't mapped yet
    - player pages, plus tabs like HLTV's (Matches, Events, Achievements)
    - not in the API: coach, player ages and nationalities. Those would need Liquipedia,
      which is rate-limited.
- **Live match stats, round two.** The first version, a scoreboard per game on the match page,
  lives in `src/live.ts` and `src/views/game.tsx`. Ideas next:
    - **item info on hover:** name, cost and stats in a small styled tooltip, for players who
      don't know items. Data Dragon's `item.json` has it all (name, total gold, stats and passive
      text, 672 KB, cached a day; only the items on the page go into the HTML). It can be done
      with CSS hover/focus, no JS. Items only show on desktop, so phones aren't affected.
      Small enough for one commit.
    - runes, skill order and summoner spells: runes and skill order are in `/details` but were
      left out to keep the board lean (tried runes, removed them). Summoner spells aren't in
      the feed.
    - a gold-lead graph over the game, by fetching several windows
    - refreshing just the scoreboard every 10–15s while live, instead of the whole-page reload
      every minute
    - a winner in the Games table. The feed has no winner field: Bo1s use the match result,
      other games guess from towers destroyed (gold on a tie). Check this against real
      results.
- **Calendar subscription (.ics)** per event or team, so matches appear in a phone calendar in
  local time.
- **Favourite teams**, highlighted across pages and stored in a cookie (no accounts).
- **Head-to-head and recent form** on the match page: the last 5 results per team and earlier
  meetings, from `GetTeamEvents` (already used by team pages). The match page now has the
  stakes line and expected lineups (done), so these would complete a "match preview".
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

- **GraphQL query ids** (`QUERY_IDS` in `src/api.ts`: `GetTeamGpr` and `GetTeamEvents`).
  If lolesports.com changes a query, its id stops working.
    - **`GetTeamGpr` breaks:** the homepage falls back to Swiss standings, `/ranking` shows a
      notice, and league tags and team links disappear.
    - **`GetTeamEvents` breaks:** team pages show a notice instead of their matches and lose
      the lineup.

    To find a new id:
    1. Open lolesports.com/en-US/gpr and find the JS chunk that holds the persisted query
       manifest (search the bundles for `generatePersistedQueryIdsFromManifest`).
    2. In that manifest, read the `id` of the operation (`GetTeamGpr`, `GetTeamEvents`).
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
