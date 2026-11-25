// All styling in one place. Deliberately HLTV-like: dark slate boxes, small type, fixed max
// width, nothing that scales with the viewport.

// Riot's position icons from the League client (via raw.communitydragon.org, the
// rcp-fe-lol-static-assets plugin, svg/position-*.svg), without their colours. Used as CSS
// masks, so an icon takes the text colour and the page loads nothing extra. The half-opaque
// shape is the rest of the map, which is what makes top, mid and bot readable. The coach
// icon is our own, drawn on the same 34×34 grid: a person with the tie cut out.
const ROLE_ICONS: Record<string, string> = {
    top: "<path opacity='.5' fill-rule='evenodd' d='M21,14H14v7h7V14Zm5-3V26L11.014,26l-4,4H30V7.016Z'/><polygon points='4 4 4.003 28.045 9 23 9 9 23 9 28.045 4.003 4 4'/>",
    jungle: "<path fill-rule='evenodd' d='M25,3c-2.128,3.3-5.147,6.851-6.966,11.469A42.373,42.373,0,0,1,20,20a27.7,27.7,0,0,1,1-3C21,12.023,22.856,8.277,25,3ZM13,20c-1.488-4.487-4.76-6.966-9-9,3.868,3.136,4.422,7.52,5,12l3.743,3.312C14.215,27.917,16.527,30.451,17,31c4.555-9.445-3.366-20.8-8-28C11.67,9.573,13.717,13.342,13,20Zm8,5a15.271,15.271,0,0,1,0,2l4-4c0.578-4.48,1.132-8.864,5-12C24.712,13.537,22.134,18.854,21,25Z'/>",
    mid: "<path opacity='.5' fill-rule='evenodd' d='M30,12.968l-4.008,4L26,26H17l-4,4H30ZM16.979,8L21,4H4V20.977L8,17,8,8h8.981Z'/><polygon points='25 4 4 25 4 30 9 30 30 9 30 4 25 4'/>",
    bottom: "<path opacity='.5' fill-rule='evenodd' d='M13,20h7V13H13v7ZM4,4V26.984l3.955-4L8,8,22.986,8l4-4H4Z'/><polygon points='29.997 5.955 25 11 25 25 11 25 5.955 29.997 30 30 29.997 5.955'/>",
    support:
        "<path fill-rule='evenodd' d='M26,13c3.535,0,8-4,8-4H23l-3,3,2,7,5-2-3-4h2ZM22,5L20.827,3H13.062L12,5l5,6Zm-5,9-1-1L13,28l4,3,4-3L18,13ZM11,9H0s4.465,4,8,4h2L7,17l5,2,2-7Z'/>",
    coach: "<circle cx='17' cy='9' r='6'/><path fill-rule='evenodd' d='M4 32C4 24 9.5 18.5 17 18.5S30 24 30 32ZM15.4 19.2H18.6L18 21.4H16ZM16 22H18L19.2 28 17 31 14.8 28Z'/>",
}

const ROLE_CSS = Object.entries(ROLE_ICONS)
    .map(([role, shapes]) => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 34 34'>${shapes}</svg>`

        return `.role.r-${role} { --icon: url("data:image/svg+xml,${encodeURIComponent(svg)}"); }`
    })
    .join('\n')

export const CSS = /* css */ `
:root {
  --bg: #0d0f12;
  --page: #1b1f25;
  --nav: #2d3844;
  --nav-hover: #3a4757;
  --box: #2a313b;
  --box-hover: #343d49;
  --head: #232932;
  --line: #20252c;
  --text: #d6dae0;
  --dim: #a3abb7;
  --muted: #7d8794;
  --link: #8fbfef;
  --accent: #3c7ac4;
  --gold: #c8aa6e;
  --win: #5fb35a;
  --loss: #d35757;
  --live: #e2463f;
  --radius: 3px;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
a { color: inherit; text-decoration: none; }
img { display: block; }
h1, h2, h3 { margin: 0; font-weight: 600; }
/* equal-width digits so times, scores and stats line up in columns */
.mt, .tl .ts, .rs, .tm-team .ts, .tm-time, .bm .bt .ts, .rk-pts, .stand .rec, .mini .rec, .sw-s,
.tp-score, .score .big, .gb-gold, .gb-kills, .gb-kda, .gb-cs, .gb-final { font-variant-numeric: tabular-nums; }

/* ---------- top bar ---------- */
.nav { background: var(--nav); position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 0 #00000066; }
.nav-inner { max-width: 1180px; margin: 0 auto; display: flex; align-items: stretch; height: 44px; }
.brand {
  display: flex; align-items: center; padding: 0 16px; font-weight: 800; font-size: 19px; letter-spacing: .5px;
  background: var(--accent); color: #fff;
}
.brand span { color: var(--gold); }
.nav nav { display: flex; overflow-x: auto; scrollbar-width: none; }
.nav nav a { display: flex; align-items: center; padding: 0 16px; color: #c3cad3; font-size: 15px; white-space: nowrap; }
.nav nav a:hover { background: var(--nav-hover); color: #fff; }
.nav nav a.on { color: #fff; box-shadow: inset 0 -2px 0 var(--gold); }

/* ---------- page shell ---------- */
.page { max-width: 1180px; margin: 0 auto; background: var(--page); padding: 14px 16px 24px; min-height: calc(100vh - 44px - 40px); }
footer { max-width: 1180px; margin: 0 auto; padding: 12px 16px; color: var(--muted); font-size: 11px; display: flex; gap: 6px 14px; flex-wrap: wrap; }
footer a { color: var(--dim); }

.home { display: grid; grid-template-columns: 190px minmax(0, 1fr) 230px; gap: 16px; align-items: start; }
.split { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.split.solo { grid-template-columns: minmax(0, 1fr); }
.col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* ---------- labels & headings ---------- */
.label { font-size: 12px; font-weight: 700; color: var(--muted); margin: 0 0 5px; display: flex; justify-content: space-between; }
.label a { color: var(--link); text-transform: none; font-weight: 500; letter-spacing: 0; }
.h { font-size: 16px; font-weight: 600; margin: 4px 0 8px; color: var(--text); display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.h small, .h a { font-size: 12px; font-weight: 400; color: var(--link); }
.h small { color: var(--muted); }
.day { font-size: 13px; font-weight: 700; color: var(--dim); margin: 14px 0 5px; }
.day:first-child { margin-top: 0; }
.day em { font-style: normal; color: var(--gold); margin-right: 6px; }
.empty { background: var(--box); padding: 14px; color: var(--muted); border-radius: var(--radius); }
.more { display: block; text-align: center; background: var(--head); color: var(--link); padding: 8px; margin-top: 1px; border-radius: 0 0 var(--radius) var(--radius); }
.more:hover { background: var(--box-hover); }
.more small { display: block; color: var(--muted); font-size: 11px; margin-top: 1px; }
.note { color: var(--muted); font-size: 11px; margin: 10px 2px 0; }
.notice { background: #3b2a1e; color: #f1c79b; padding: 8px 12px; margin-bottom: 12px; border-radius: var(--radius); }

/* home-league tag after team names at international events */
.tag { flex: none; color: var(--muted); font-size: 10px; font-weight: 600; letter-spacing: .3px; }

/* ---------- logos ---------- */
/* a faint halo keeps black logos visible on the dark background */
.logo { object-fit: contain; flex: none; filter: drop-shadow(0 0 0.6px #ffffffb0) drop-shadow(0 0 1px #ffffff30); }
.logo-ph { display: inline-block; flex: none; border-radius: 2px; background: #ffffff10; }

/* ---------- generic list box ---------- */
.list { background: var(--box); border-radius: var(--radius); overflow: hidden; }
.list > * + * { border-top: 1px solid var(--line); }
a.li, .li { display: flex; align-items: center; gap: 8px; padding: 7px 10px; min-height: 34px; }
a.li:hover { background: var(--box-hover); }
.li .grow { flex: 1; min-width: 0; }
.li .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }
.li .sub { color: var(--muted); font-size: 11px; }
.li .num { color: var(--muted); width: 16px; text-align: right; font-size: 12px; }

/* ---------- power ranking ---------- */
.mv { font-size: 10px; color: var(--muted); min-width: 22px; text-align: right; white-space: nowrap; }
.mv.up { color: var(--win); }
.mv.down { color: var(--loss); }
.li.rk { padding: 8px 12px; gap: 12px; }
.rk-pos { width: 38px; font-size: 18px; font-weight: 700; color: var(--dim); }
.rk-name { font-size: 15px; font-weight: 600; }
.rk-pts { color: var(--dim); white-space: nowrap; }
.rk-pts small { color: var(--muted); font-size: 11px; }
.rk .mv { font-size: 12px; min-width: 32px; }

/* ---------- match rows (upcoming / live) ---------- */
.mrow { display: grid; grid-template-columns: 58px minmax(0, 1fr) minmax(0, 240px); align-items: center; background: var(--box); min-height: 54px; }
.mrow + .mrow { border-top: 1px solid var(--line); }
.mrow:hover { background: var(--box-hover); }
.group { border-radius: var(--radius); overflow: hidden; }
.mt { text-align: center; padding: 6px 4px; border-right: 1px solid var(--line); align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
.mt b { font-size: 14px; font-weight: 600; }
.bo { font-size: 10px; color: var(--muted); text-transform: uppercase; }
.mteams { padding: 6px 12px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.tl { display: flex; align-items: center; gap: 7px; font-size: 14px; min-width: 0; }
.tl .tn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl .ts { margin-left: auto; font-weight: 700; padding-left: 8px; }
.tl.won .ts { color: var(--win); }
.tl.lost { color: var(--dim); }
.tl.lost .ts { color: var(--loss); }
.tl.tbd { color: var(--muted); }
.mev { display: flex; align-items: center; gap: 8px; padding: 6px 12px; color: var(--dim); min-width: 0; }
.mev .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mev small { display: block; color: var(--muted); font-size: 11px; }
.live { display: inline-block; background: var(--live); color: #fff; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 2px; letter-spacing: .5px; }

/* ---------- result rows (HLTV results page) ---------- */
.rrow { display: grid; grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr) minmax(0, 210px) 34px; align-items: center; background: var(--box); min-height: 36px; padding: 0 4px; }
.rrow + .rrow { border-top: 1px solid var(--line); }
.rrow:hover { background: var(--box-hover); }
.rt { display: flex; align-items: center; gap: 7px; min-width: 0; padding: 0 8px; }
.rt .tn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rt.r1 { justify-content: flex-end; text-align: right; }
.rt.lost { color: var(--dim); }
.rt.won { font-weight: 600; }
.rs { text-align: center; font-weight: 700; font-size: 14px; white-space: nowrap; }
.rs .w { color: var(--win); }
.rs .l { color: var(--loss); }
.rev { display: flex; align-items: center; gap: 7px; color: var(--dim); font-size: 12px; min-width: 0; padding-left: 8px; border-left: 1px solid var(--line); align-self: stretch; }
.rev .name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rbo { color: var(--muted); font-size: 11px; text-align: center; }

/* ---------- today's matches (homepage right column) ---------- */
.today .list > .tm-label { padding: 4px 10px; background: var(--head); color: var(--muted); font-size: 11px; font-weight: 700; min-height: 0; }
.tm { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 10px; }
.tm:hover { background: var(--box-hover); }
.tm-teams { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tm-team { display: flex; align-items: center; gap: 6px; }
.tm-team .tn { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tm-team .ts { font-weight: 700; min-width: 12px; text-align: right; }
.tm-team.won .ts { color: var(--win); }
.tm-team.lost { color: var(--dim); }
.tm-team.lost .ts { color: var(--loss); }
.tm-time { width: 42px; text-align: right; color: var(--dim); font-size: 12px; }
.tm.completed .tm-time { color: var(--muted); font-size: 11px; }
.tm-day { display: none; }

/* ---------- event banner + tabs ---------- */
.banner { border-radius: var(--radius); overflow: hidden; background: var(--box); }
.banner-main {
  display: flex; align-items: center; gap: 14px; padding: 16px 18px;
  background: radial-gradient(ellipse at 20% 0%, #2a4a7a 0%, transparent 60%), linear-gradient(135deg, #14233b, #0f1520 70%);
}
.banner-title { font-size: 21px; font-weight: 700; color: #fff; }
.banner-sub { color: #aab6c6; font-size: 12px; margin-top: 2px; }
.banner .pill { margin-left: auto; align-self: flex-start; }
.pill { font-size: 10px; font-weight: 800; letter-spacing: .5px; padding: 3px 7px; border-radius: 2px; background: #ffffff1a; color: #e6eaf0; text-transform: uppercase; white-space: nowrap; }
.pill.on { background: var(--live); color: #fff; }
.pill.q { background: #2f5d2c; color: #b8e6b3; }
.pill.x { background: #5a2626; color: #f0b3b3; }
.tabs { display: flex; background: var(--head); }
.tabs a { flex: 1; text-align: center; padding: 9px 6px; font-size: 14px; color: var(--dim); border-right: 1px solid var(--line); }
.tabs a:last-child { border-right: 0; }
.tabs a:hover { background: var(--box-hover); color: var(--text); }
.tabs a.on { color: #fff; font-weight: 600; box-shadow: inset 0 -2px 0 var(--gold); }

/* ---------- filter chips ---------- */
.chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-bottom: 12px; }
.chip { display: flex; align-items: center; gap: 6px; padding: 5px 10px; background: var(--box); border-radius: 14px; color: var(--dim); white-space: nowrap; font-size: 12px; }
.chip:hover { background: var(--box-hover); color: var(--text); }
.chip.on { background: var(--accent); color: #fff; }

/* ---------- standings ---------- */
.stand { width: 100%; border-collapse: collapse; background: var(--box); border-radius: var(--radius); overflow: hidden; }
.stand td, .stand th { padding: 6px 10px; text-align: left; }
.stand th { background: var(--head); color: var(--muted); font-size: 11px; font-weight: 700; text-transform: uppercase; }
.stand tr + tr td { border-top: 1px solid var(--line); }
.stand .c { text-align: center; }
.stand .rec { font-weight: 700; white-space: nowrap; }
.stand .t { display: flex; align-items: center; gap: 8px; }
.stand tr.eliminated td { color: var(--muted); }
.stand tr.qualified .rec { color: var(--win); }
.stand tr.eliminated .rec { color: var(--loss); }
.stand tr.gap td { border-top: 2px solid var(--line); }
.mini .rec { margin-left: auto; font-weight: 700; }
.mini .qualified .rec { color: var(--win); }
.mini .eliminated { color: var(--muted); }
.mini .eliminated .rec { color: var(--loss); }

/* ---------- brackets ---------- */
.bm { background: var(--box); border-radius: var(--radius); display: block; position: relative; transition: opacity .12s; }
.bm:hover { background: var(--box-hover); }
.bm:focus-visible { outline: 1px solid var(--link); outline-offset: 1px; }
.bm .bt { display: flex; align-items: center; gap: 7px; padding: 5px 8px; }
.bm .bt + .bt { border-top: 1px solid var(--line); }
.bm .bt .tn { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bm .bt .ts { font-weight: 700; }
.bm .bt.won .ts { color: var(--win); }
.bm .bt.lost { color: var(--dim); }
.bm .bt.lost .ts { color: var(--loss); }
.bm .bt.tbd { color: var(--muted); padding-left: 10px; }
.bm .bd { font-size: 10px; color: var(--muted); padding: 3px 8px 0; display: flex; justify-content: space-between; }
.bm .bf { font-size: 10px; color: var(--muted); padding: 3px 8px 4px; border-top: 1px solid var(--line); }
/* the champion: the one place gold appears in a bracket */
.bm .bt.champ { box-shadow: inset 2px 0 0 var(--gold); }
.bm .bt.champ .tn { color: var(--gold); font-weight: 600; }
.mgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }

.tree-scroll { overflow-x: auto; }
.tree { position: relative; display: grid; column-gap: 26px; min-width: 640px; }
.tree.tiered { grid-template-rows: auto auto; row-gap: 12px; min-width: 720px; }
.tree-cell { display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 1; padding: 0 0 4px; }
.tree.tiered .tree-cell { padding: 10px 0; }
.tree-cell h4 { margin: 0; font-size: 12px; font-weight: 600; color: var(--dim); }
.tree-ms { flex: 1; display: flex; flex-direction: column; justify-content: space-around; gap: 8px; }
.tree-cell.final .tree-ms { justify-content: center; }
/* the lower bracket sits on a recessed band so the two tiers read apart */
.tree-band { background: #ffffff05; border-top: 1px solid var(--line); border-radius: var(--radius); margin: 0 -10px; }
.tree-lines { position: absolute; inset: 0; pointer-events: none; z-index: 0; }
.tree-lines path { fill: none; stroke: #4a5563; stroke-width: 1.5; }
/* following a team's run */
.tracing .bm:not(.on) { opacity: .35; }
.tracing .tree-lines path:not(.on) { opacity: .25; }
.tree-lines path.on { stroke: var(--accent); stroke-width: 2; }
.tracing .bt.on { background: #3c7ac41f; }
.stage + .stage { margin-top: 18px; }
details.stage > summary { cursor: pointer; list-style: none; }
details.stage > summary::-webkit-details-marker { display: none; }
details.stage > summary::before { content: "▸"; color: var(--muted); margin-right: 6px; }
details.stage[open] > summary::before { content: "▾"; }
details.stage > summary small { margin-right: auto; color: var(--muted); }

/* ---------- event overview ---------- */
.einfo { display: flex; flex-wrap: wrap; gap: 8px 40px; background: var(--box); padding: 10px 18px; border-radius: 0 0 var(--radius) var(--radius); margin: 1px 0 16px; }
.einfo span { display: block; color: var(--muted); font-size: 11px; }
.einfo b { font-size: 14px; font-weight: 600; text-transform: capitalize; }
.egrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 20px; align-items: start; }
/* final placements of a finished event, after HLTV's prize distribution */
/* four to a row, the top four two to a row; a short last row stretches to fill */
.places { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
.pl { flex: 1 1 calc(25% - 6px); display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; padding: 12px 10px; background: var(--box); border-radius: var(--radius); text-align: center; }
a.pl:hover { background: var(--box-hover); }
.pl.wide { flex-basis: calc(50% - 4px); }
.pl.top { gap: 6px; padding: 18px 10px; }
.pl-name { display: flex; align-items: baseline; justify-content: center; gap: 6px; max-width: 100%; font-weight: 600; }
.pl-name .tn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pl.top .pl-name { font-size: 16px; }
.pl-rank { font-weight: 800; color: var(--dim); }
.pl.top .pl-rank { font-size: 15px; }
.pl.p1 { background: linear-gradient(180deg, #c8aa6e24, transparent 75%), var(--box); box-shadow: inset 0 2px 0 var(--gold); }
a.pl.p1:hover { background: linear-gradient(180deg, #c8aa6e24, transparent 75%), var(--box-hover); }
.pl.p1 .pl-name, .pl.p1 .pl-rank { color: var(--gold); }
.pl.p2 .pl-rank { color: #c0c7d1; }
.pl.p3 .pl-rank { color: #c98a5a; }
/* the last major's finalists on the homepage: under its banner, and small in the sidebar */
.home .places { margin: 8px 0; }
.home .places + .more { margin-top: 0; border-radius: var(--radius); }
.li.p1 .name { color: var(--gold); font-weight: 600; }
.tables { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px 16px; }
details.sub { margin-top: 10px; }
details.sub > summary { cursor: pointer; color: var(--link); font-size: 12px; margin-bottom: 8px; }

/* Swiss "group play" bracket, after HLTV */
.swiss-scroll { overflow-x: auto; background: var(--box); border-radius: var(--radius); padding: 14px; }
.swiss { display: grid; grid-template-columns: repeat(6, minmax(156px, 1fr)); gap: 12px; min-width: 1000px; }
.sw-col { display: flex; flex-direction: column; justify-content: center; gap: 16px; }
.sw-col.edge { justify-content: space-between; }
.sw-pool { display: flex; flex-direction: column; gap: 4px; }
.sw-rec { font-size: 12px; font-weight: 700; color: var(--dim); }
.sw-m { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 4px; background: var(--head); border-radius: var(--radius); padding: 6px; font-size: 12px; min-height: 30px; }
.sw-m:hover { background: var(--box-hover); }
.sw-m.inProgress { box-shadow: inset 0 0 0 1px var(--live); }
.sw-t { display: flex; align-items: center; gap: 5px; min-width: 0; }
.sw-t.r { justify-content: flex-end; }
.sw-t .tn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.sw-t.lost { opacity: .4; }
.sw-s { color: var(--muted); font-size: 11px; font-weight: 700; padding: 0 2px; }
.sw-m.completed .sw-s, .sw-m.inProgress .sw-s { color: var(--text); }
.sw-q { width: 16px; height: 16px; border-radius: 50%; background: #ffffff14; color: var(--muted); font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.sw-out { border-radius: var(--radius); padding: 6px 6px 8px; }
.sw-out.q { background: #2e6a2a; }
.sw-out.x { background: #6c2323; }
.sw-out .sw-rec { color: #fff; text-align: center; margin-bottom: 6px; }
.sw-teams { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 4px; }
.sw-ot { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 36px; font-size: 10px; font-weight: 700; color: #fff; }
.sw-ot .sw-q { width: 22px; height: 22px; background: #00000033; color: #ffffff80; }

/* ---------- team page (after HLTV) ---------- */
.tprofile { background: var(--box); border-radius: var(--radius); overflow: hidden; }
.tp-lineup { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; padding: 14px 14px 0; background: linear-gradient(180deg, #14233b, #1c2a3d 70%, var(--box)); }
.tp-player { display: flex; flex-direction: column; align-items: center; min-width: 0; }
.tp-player img, .tp-nophoto { width: 100%; max-width: 120px; aspect-ratio: 1 / 1; object-fit: cover; object-position: top; }
.tp-nophoto { background: #ffffff0d; border-radius: 50% 50% 0 0; }
.tp-name { width: 100%; text-align: center; background: #0b1220d0; padding: 4px 2px; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tp-name span { display: block; color: var(--muted); font-size: 10px; text-transform: uppercase; }
.tp-head { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.tp-head h1 { font-size: 24px; color: #fff; }
.tp-league { display: flex; align-items: center; gap: 6px; text-transform: capitalize; }
.tp-stats > div { display: flex; justify-content: space-between; gap: 12px; padding: 8px 16px; }
.tp-stats > div + div { border-top: 1px solid var(--line); }
.tp-stats span { color: var(--dim); font-weight: 600; }
.tp-stats small { color: var(--muted); font-weight: 400; }
.tp-form { display: grid; grid-template-columns: 1fr 1fr; background: var(--box); border-radius: var(--radius); }
.tp-form > div { text-align: center; padding: 10px; }
.tp-form > div + div { border-left: 1px solid var(--line); }
.tp-form b { display: block; font-size: 18px; }
.tp-form b.w { color: var(--win); }
.tp-form b.l { color: var(--loss); }
.tp-form span { color: var(--muted); font-size: 11px; }
.tp-matches { border-radius: var(--radius); overflow: hidden; }
.tp-event { display: block; background: var(--head); text-align: center; padding: 8px; font-weight: 700; color: var(--text); margin-top: 8px; }
.tp-event:first-child { margin-top: 0; }
a.tp-event:hover { color: var(--link); }
.tp-row { display: grid; grid-template-columns: 110px minmax(0, 1fr) 54px minmax(0, 1fr) 56px; align-items: center; gap: 6px; background: var(--box); padding: 6px 10px; min-height: 36px; }
.tp-row + .tp-row { border-top: 1px solid var(--line); }
.tp-row:hover { background: var(--box-hover); }
.tp-row:hover .tp-btn { filter: brightness(1.15); }
.tp-date { color: var(--muted); font-size: 12px; }
.tp-side { display: flex; align-items: center; gap: 7px; min-width: 0; }
.tp-side.us { justify-content: flex-end; }
.tp-side .tn { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tp-side.lost { color: var(--muted); }
.tp-score { text-align: center; font-weight: 700; white-space: nowrap; }
.tp-score .w { color: var(--win); }
.tp-score .l { color: var(--loss); }
.tp-btn { justify-self: end; background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 2px; }
.tp-row.inProgress .tp-btn { background: var(--live); }
.place { font-weight: 800; width: 36px; color: var(--dim); }
.place.p1 { color: var(--gold); }
.place.p2 { color: #c0c7d1; }
.place.p3 { color: #c98a5a; }
a.team-link:hover, a.sw-ot:hover { color: var(--link); }
.tp-stats .tp-people { font-weight: 400; color: var(--dim); text-align: right; }
.tp-people em { font-style: normal; font-weight: 700; color: var(--text); }
/* Results fold: a checkbox, the list, and its label as a bar under the list. Unchecked, the
   rows past the fold are hidden. Phones fold sooner (see the responsive block). */
.tp-fold { position: absolute; opacity: 0; pointer-events: none; }
.tp-fold:not(:checked) ~ .tp-matches .fold { display: none; }
.tp-foldbar { cursor: pointer; user-select: none; }
.tp-foldbar.phone { display: none; }
.tp-foldbar .less, .tp-fold:checked ~ .tp-foldbar .all { display: none; }
.tp-fold:checked ~ .tp-foldbar .less { display: inline; }
.tp-fold:focus-visible ~ .tp-foldbar { outline: 1px solid var(--link); outline-offset: -1px; }
.tp-player.open { opacity: .45; }
.tp-player.open b { font-weight: 400; font-style: italic; }

/* ---------- transfers (after HLTV) ---------- */
.role { display: block; flex: none; width: 18px; height: 18px; background: var(--dim); -webkit-mask: var(--icon) center / contain no-repeat; mask: var(--icon) center / contain no-repeat; }
${ROLE_CSS}
.tr { display: grid; grid-template-columns: 36px 44px 14px 44px 18px minmax(0, 1fr) auto; align-items: center; gap: 8px; background: var(--box); padding: 6px 12px; min-height: 50px; }
.tr + .tr { border-top: 1px solid var(--line); }
.tr-photo { display: block; flex: none; border-radius: 50%; object-fit: cover; object-position: top; background: #ffffff10; }
.tr-side { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; flex: none; }
.tr-side small, .tr-side.none { color: var(--muted); font-size: 9px; font-weight: 800; letter-spacing: .4px; text-transform: uppercase; text-align: center; line-height: 1.1; }
.tr-ph { display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; background: #ffffff14; color: var(--dim); font-weight: 800; }
.tr-arrow { color: var(--muted); text-align: center; }
.tr-text { min-width: 0; color: var(--dim); font-size: 14px; }
.tr-text b { color: var(--text); font-weight: 600; }
.tr-text a:hover b { color: var(--link); }
.tr-src { color: var(--link); font-size: 11px; }
.tr-src svg { display: none; width: 14px; height: 14px; }
.li.trm { gap: 6px; }
.trm .tr-side.none { width: 20px; font-size: 8px; }
.note a { color: var(--dim); text-decoration: underline; }

/* ---------- game scoreboards (match page) ---------- */
.gboards { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.gb { background: var(--box); border-radius: var(--radius); }
.gb-sum { border-radius: var(--radius) var(--radius) 0 0; }
.gb:not([open]) > .gb-sum { border-radius: var(--radius); }
.gb-sum { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: var(--head); cursor: pointer; list-style: none; }
.gb-sum::-webkit-details-marker { display: none; }
.gb-sum::before { content: "▸"; color: var(--muted); }
.gb[open] > .gb-sum::before { content: "▾"; }
.gb-final { color: var(--dim); }
.gb-sum .gb-win { margin-left: -4px; }
.gb-teams { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto minmax(0, 1fr); align-items: center; gap: 18px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.gb-team { display: flex; align-items: center; gap: 7px; min-width: 0; }
.gb-team.red { flex-direction: row-reverse; }
.gb-side { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .4px; padding: 1px 5px; border-radius: 2px; }
.gb-side.blue { background: #2a4b7c; color: #a9c8ff; }
.gb-side.red { background: #6b2a2a; color: #ffb3b3; }
.gb-win { background: #2e6a2a; color: #c8f0c3; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 2px; }
.gb-gold { color: var(--muted); font-size: 11px; white-space: nowrap; }
.gb-gold b { color: var(--text); font-size: 13px; }
.gb-kills { display: flex; align-items: center; gap: 8px; font-size: 18px; }
.gb-kills .blue { color: #6aa5ff; }
.gb-kills .red { color: #ff7a7a; }
.gb-swords { color: var(--muted); }
.gb-row { display: grid; grid-template-columns: minmax(0, 1fr) 64px minmax(0, 1fr); align-items: center; padding: 4px 12px; }
.gb-row + .gb-row { border-top: 1px solid var(--line); }
.gb-role { text-align: center; font-size: 11px; font-weight: 700; color: var(--muted); line-height: 1.2; }
.gb-p { display: grid; align-items: center; gap: 8px; min-width: 0; }
.gb-p.l { grid-template-columns: 28px minmax(0, 1fr) 130px 62px 52px; }
.gb-p.r { grid-template-columns: 52px 62px 130px minmax(0, 1fr) 28px; }
.gb-p.r .gb-cs { order: 2; }
.gb-p.r .gb-kda { order: 3; }
.gb-p.r .gb-items { order: 4; }
.gb-p.r .gb-pname { order: 6; text-align: right; }
.gb-p.r .gb-champ, .gb-p.r .gb-champ-ph { order: 7; }
.gb-champ-ph { width: 28px; }
.gb-cols { padding-top: 3px; padding-bottom: 3px; }
.gb-cols span { color: var(--muted); font-size: 10px; font-weight: 700; text-transform: uppercase; }
.gb-items { display: flex; gap: 2px; }
.gb-items img, .gb-slot { width: 20px; height: 20px; border-radius: 2px; flex: none; }
.gb-slot { background: #00000040; box-shadow: inset 0 0 0 1px #ffffff10; }
/* Item tooltips: below the icon, growing toward the middle of the board. */
.gb-it { position: relative; display: block; width: 20px; height: 20px; border-radius: 2px; outline: none; }
.gb-it:hover img, .gb-it:focus-visible img { box-shadow: 0 0 0 1px var(--gold); }
.gb-tip {
  display: none; position: absolute; top: calc(100% + 6px); left: -6px; z-index: 20; width: 260px;
  padding: 8px 10px; background: #14181d; border: 1px solid #c8aa6e66; border-radius: var(--radius);
  box-shadow: 0 6px 18px #000000a0; font-size: 12px; line-height: 1.4; color: var(--dim); text-align: left; white-space: normal;
}
.gb-p.r .gb-tip { left: auto; right: -6px; }
.gb-row:nth-last-child(-n + 2) .gb-tip { top: auto; bottom: calc(100% + 6px); }
.gb-it:hover .gb-tip, .gb-it:focus-visible .gb-tip,
.gb-champ:hover .gb-tip, .gb-champ:focus-visible .gb-tip { display: block; }
.gb-tip-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.gb-tip-head b { color: var(--text); font-size: 13px; }
.gb-tip-gold { color: var(--gold); font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.gb-tip-gold::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 4px; border-radius: 50%; background: var(--gold); vertical-align: 1px; }
.gb-tip-stats { display: block; margin-top: 5px; padding-top: 5px; border-top: 1px solid #ffffff14; }
.gb-tip-stats > span { display: block; }
.gb-tip-stats b { color: var(--text); }
.gb-tip-fx { display: block; margin-top: 6px; }
.gb-tip-fx b { color: var(--gold); }
.gb-tip-cd { color: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.gb-tip-fx b.active::before { content: "Active: "; color: var(--text); }
/* Champions: just the name, as a small label. */
.gb-tip-ch { width: max-content; padding: 3px 8px; color: var(--text); font-weight: 600; white-space: nowrap; }
/* No overflow: hidden, so the tooltip can leave the icon: the image and badge round themselves. */
.gb-champ { position: relative; width: 28px; height: 28px; border-radius: 3px; background: #ffffff10; outline: none; }
.gb-champ[tabindex]:hover, .gb-champ:focus-visible { box-shadow: 0 0 0 1px var(--gold); }
.gb-champ img { display: block; width: 28px; height: 28px; border-radius: 3px; }
.gb-champ i { position: absolute; right: 0; bottom: 0; background: #000000c0; color: #fff; font-style: normal; font-size: 9px; font-weight: 700; padding: 0 2px; line-height: 12px; border-radius: 3px 0 3px 0; }
.gb-pname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; }
.gb-kda { text-align: center; white-space: nowrap; font-weight: 600; }
.gb-cs { text-align: center; color: var(--dim); font-size: 12px; white-space: nowrap; }

/* ---------- match page ---------- */
.mhead { background: var(--box); border-radius: var(--radius); overflow: hidden; }
.mhead-ev { display: flex; align-items: center; justify-content: center; gap: 6px; margin: 4px 0 2px; color: var(--link); }
.mlive { margin-top: 6px; }
.lineups { margin-top: 1px; }
.lu-desk { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: end; padding: 18px 12px 12px; background: linear-gradient(180deg, var(--box), #14233b); border-radius: 0 0 var(--radius) var(--radius); }
.lu-vs { color: var(--muted); font-size: 12px; font-weight: 700; padding: 0 12px 40px; }
.lu-group { display: flex; justify-content: center; align-items: flex-end; gap: 6px; }
.lu-fig { margin: 0; width: 96px; text-align: center; }
.lu-fig img, .lu-blank { display: block; width: 96px; height: 78px; object-fit: cover; object-position: top; }
.lu-blank { background: #ffffff0a; border-radius: 50% 50% 0 0; }
.lu-fig figcaption { margin-top: 4px; line-height: 1.15; }
.lu-fig figcaption b { display: block; font-size: 13px; white-space: nowrap; }
.lu-fig figcaption span { color: var(--muted); font-size: 10px; font-weight: 700; }
.lu-rows { display: none; margin-top: 12px; }
.lu-row { display: grid; grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr); align-items: center; padding: 5px 12px; }
.lu-role { text-align: center; color: var(--muted); font-size: 11px; font-weight: 700; }
.lu-p { display: flex; align-items: center; gap: 8px; min-width: 0; }
.lu-p.r { flex-direction: row-reverse; }
.lu-p b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lu-p img, .lu-nophoto { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; object-position: top; background: #ffffff10; flex: none; }
.mform { display: flex; flex-direction: column; gap: 14px; }
.form { display: flex; gap: 3px; }
.form span { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; border-radius: 2px; }
.form .w { background: #2e6a2a; color: #c8f0c3; }
.form .l { background: #6c2323; color: #f0b3b3; }
.mstakes { text-align: center; padding: 8px 12px; border-top: 1px solid var(--line); color: var(--gold); font-weight: 600; font-size: 13px; }
.score { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; padding: 22px 12px; gap: 12px; }
.score .side { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; font-size: 16px; font-weight: 600; justify-self: center; padding: 12px 22px; border-radius: var(--radius); }
.score a.side:hover { background: var(--box-hover); }
.score .side.lost { color: var(--dim); font-weight: 400; }
.score .mid { text-align: center; }
.score .big { font-size: 34px; font-weight: 800; letter-spacing: 2px; white-space: nowrap; }
.score .big .w { color: var(--win); }
.score .big .l { color: var(--loss); }
.score .when { color: var(--dim); margin-top: 2px; }
.games td .t { display: inline-flex; align-items: center; gap: 6px; }
.side-b { color: #6aa5ff; font-size: 11px; font-weight: 700; }
.side-r { color: #ff7a7a; font-size: 11px; font-weight: 700; }
.games a { color: var(--link); }
.mlivebar { display: none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 16px; align-items: start; }
.lg-win { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }

/* ---------- responsive ---------- */
@media (max-width: 1000px) {
  .home { grid-template-columns: minmax(0, 1fr) 230px; }
  .home .left { grid-column: 1 / -1; order: 3; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
}
@media (max-width: 1000px) {
  .gb-items { display: none !important; }
  .gb-p.l { grid-template-columns: 28px minmax(0, 1fr) 62px 52px; }
  .gb-p.r { grid-template-columns: 52px 62px minmax(0, 1fr) 28px; }
}
@media (max-width: 760px) {
  .page { padding: 10px 10px 20px; }
  .home, .split, .egrid { grid-template-columns: minmax(0, 1fr); }
  .pl { flex-basis: calc(50% - 4px); }
  .pl.top .pl-name { font-size: 14px; }
  .home .left { grid-template-columns: minmax(0, 1fr); }
  /* HLTV mobile: today's matches become a horizontal strip at the top */
  .home .today { order: -1; }
  .home .today .label { display: none; }
  .home .today .list { display: flex; overflow-x: auto; gap: 6px; background: none; scrollbar-width: none; }
  .home .today .list > * + * { border-top: 0; }
  .home .today .tm-label { display: none; }
  .home .today .tm { flex: 0 0 150px; background: var(--box); border-radius: var(--radius); flex-direction: column; align-items: stretch; gap: 3px; }
  .home .today .tm-time { order: -1; width: auto; text-align: left; font-size: 11px; }
  .home .today .tm-day { display: inline; }
  /* only the league icon on the right, as in result rows */
  .mrow { grid-template-columns: 52px minmax(0, 1fr) 34px; }
  .mrow .mev { padding: 0 10px 0 0; justify-content: flex-end; }
  .mrow .mev > div { display: none; }
  .mrow.noev { grid-template-columns: 52px minmax(0, 1fr); }
  .mrow.noev .mev { display: none; }
  .rrow { grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr) 26px; }
  .rrow .rbo { display: none; }
  .rrow .rev { border-left: 0; padding-left: 4px; justify-content: flex-end; }
  .rrow .rev .name { display: none; }
  .rrow .tag { display: none; }
  .rrow.noev { grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr); }
  .rrow.noev .rev { display: none; }
  .banner-title { font-size: 18px; }
  .tabs a { font-size: 13px; }
  .score .big { font-size: 28px; }
  .score { gap: 4px; padding: 16px 4px; }
  .score .side { padding: 8px 2px; font-size: 14px; max-width: 100%; }
  .score .side .logo { width: 48px; height: 48px; }
  .score .mid { max-width: 150px; }
  .mhead-ev { flex-wrap: wrap; font-size: 12px; }
  .tp-lineup { gap: 3px; padding: 10px 8px 0; }
  .tp-name { font-size: 11px; }
  .tp-fold:not(:checked) ~ .tp-matches .fold-phone { display: none; }
  .tp-foldbar.phone { display: block; }
  .tr { grid-template-columns: 30px 34px 10px 34px 14px minmax(0, 1fr) auto; gap: 6px; padding: 6px 0 6px 8px; }
  .tr .role { width: 14px; height: 14px; }
  .tr-text { font-size: 13px; }
  /* No room for the word: an icon, with a tap area the row's height. */
  .tr-src { display: flex; align-items: center; justify-content: center; align-self: stretch; width: 36px; margin: -6px 0; color: var(--muted); }
  .tr-src span { display: none; }
  .tr-src svg { display: block; }
  .tp-row { grid-template-columns: minmax(0, 1fr) 46px minmax(0, 1fr) 48px; }
  .tp-date { grid-column: 1 / -1; }
  .gb-teams, .gb-row { padding-left: 6px; padding-right: 6px; }
  .lu-desk { display: none; }
  .mform { display: none; }
  .mlivebar { display: grid; }
  .split.mfull { display: none; }
  .lu-rows { display: block; }
  .gb-teams { gap: 10px; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); }
  .gb-gold { display: none; }
  .gb-row { grid-template-columns: minmax(0, 1fr) 44px minmax(0, 1fr); }
  .gb-p { gap: 5px; }
  .gb-p.l { grid-template-columns: 28px minmax(0, 1fr) 52px; }
  .gb-p.r { grid-template-columns: 52px minmax(0, 1fr) 28px; }
  .gb-cs, .gb-cols { display: none; }

  .nav nav a { padding: 0 9px; font-size: 14px; }
  .brand { padding: 0 11px; font-size: 17px; }
}
/* Touch screens have no hover: a tap focuses the item and opens its tooltip. */
@media (hover: none) {
  .gb-it:focus .gb-tip, .gb-champ:focus .gb-tip { display: block; }
}
`

// Cache-busting version for /style.css
export const CSS_VERSION = (() => {
    let h = 5381

    for (let i = 0; i < CSS.length; i++) h = ((h << 5) + h + CSS.charCodeAt(i)) | 0

    return (h >>> 0).toString(36)
})()
