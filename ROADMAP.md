# Roadmap

What comes next, what can break, and the decisions that the code doesn't explain. The README
describes how the site works today.

## Ideas

- **Spoilers:** the site currently always shows results. There is no spoiler toggle (yet).
- **Player and coach pages** (`/player/<pageId>/<handle>`): bio, contract and team history from
  Leaguepedia, fetched on demand and stored in KV for a day.
- **Team pages:** a power ranking history chart (`teamGPRHistory` is in the ranking response
  but not mapped yet), and tabs like HLTV's.
- **Transfers:** where a player went after a free-agency gap (today a join more than a week
  after the leave shows as "No team → B"), and paging beyond 90 days.
- **Live stats:** a gold-lead graph, runes and skill order, and a scoreboard that refreshes
  every 10–15s instead of the whole page every minute.
- **Better brackets** for the different regional play-ins and playoffs, drawn like
  [Liquipedia's](https://liquipedia.net/leagueoflegends/LEC/2025/Summer/Playoffs).
- **Match stars** (importance) like HLTV's, e.g. from the power ranks of both teams.


## Fragile points

- **Swiss bracket** (`swissBracket()` in `src/data.ts`). It assumes 16 teams and 3 wins or 3
  losses, with rounds of 8/8/8/6/3 matches. Other formats show the standings table instead.
- **Leaguepedia** (`src/wiki.ts`).
    - **Rate limit:** about one request per six seconds per address, measured in November 2026.
      Workers share their outbound addresses, so if Leaguepedia throttles them, log in with a
      bot password (a Worker secret). Never add a query to a page view.
    - **Table and field names:** if the wiki renames one, that step logs `wiki <step> failed`
      and pages keep the last good data.
    - **Team names:** a team that rebrands on one site only stops matching. The `teams` step
      logs `no Leaguepedia team for ...`. Add the team to `ALIASES`.


## Decisions

- **Leagues:** tier 1 only. The list is at the top of `src/data.ts`.
- **Rosters:** who is under contract according to Leaguepedia, not who played the last game.
  Trade-off: when a substitute plays mid-season, the page shows the contracted starter until
  Leaguepedia marks the change.
- **Leaguepedia over Liquipedia:** Liquipedia's free API has no table queries, and its database
  API needs a key whose plans were unavailable in November 2026.
- **Transfers page:** players and coaches of tier 1 teams, last 90 days. Contract renewals are
  hidden. Bench moves are shown.
- **Finished events:** an event is finished once its last match is played, even when the API's
  end date is a day later.
