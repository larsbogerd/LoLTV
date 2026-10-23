// All styling in one place. Deliberately HLTV-like: dark slate boxes, small type, fixed max
// width, nothing that scales with the viewport.

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
.col { display: flex; flex-direction: column; gap: 14px; min-width: 0; }

/* ---------- labels & headings ---------- */
.label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: var(--muted); margin: 0 0 5px; display: flex; justify-content: space-between; }
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
.mrow.inProgress .mt { box-shadow: inset 3px 0 0 var(--live); }

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
.today .list > .tm-label { padding: 4px 10px; background: var(--head); color: var(--muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; min-height: 0; }
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
.tm.inProgress { box-shadow: inset 3px 0 0 var(--live); }
.tm.completed .tm-time { color: var(--muted); font-size: 11px; }

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
.bracket { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 4px; }
.bcol { flex: 1 0 170px; display: flex; flex-direction: column; gap: 8px; justify-content: space-around; }
.bcol h4 { margin: 0; font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: .4px; }
.bm { background: var(--box); border-radius: var(--radius); display: block; }
.bm:hover { background: var(--box-hover); }
.bm .bt { display: flex; align-items: center; gap: 7px; padding: 5px 8px; }
.bm .bt + .bt { border-top: 1px solid var(--line); }
.bm .bt .tn { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bm .bt .ts { font-weight: 700; }
.bm .bt.won .ts { color: var(--win); }
.bm .bt.lost { color: var(--dim); }
.bm .bt.lost .ts { color: var(--loss); }
.bm .bd { font-size: 10px; color: var(--muted); padding: 3px 8px 0; display: flex; justify-content: space-between; }
.bm.inProgress { box-shadow: inset 3px 0 0 var(--live); }
.bracket.single .bcol { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
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

/* ---------- match page ---------- */
.mhead { background: var(--box); border-radius: var(--radius); overflow: hidden; }
.mhead-ev { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--head); color: var(--dim); }
.mhead-ev a { color: var(--link); }
.score { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 22px 12px; gap: 12px; }
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

/* ---------- responsive ---------- */
@media (max-width: 1000px) {
  .home { grid-template-columns: minmax(0, 1fr) 230px; }
  .home .left { grid-column: 1 / -1; order: 3; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
}
@media (max-width: 760px) {
  .page { padding: 10px 10px 20px; }
  .home, .split, .egrid { grid-template-columns: minmax(0, 1fr); }
  .home .left { grid-template-columns: minmax(0, 1fr); }
  /* HLTV mobile: today's matches become a horizontal strip at the top */
  .home .today { order: -1; }
  .home .today .label { display: none; }
  .home .today .list { display: flex; overflow-x: auto; gap: 6px; background: none; scrollbar-width: none; }
  .home .today .list > * + * { border-top: 0; }
  .home .today .tm-label { display: none; }
  .home .today .tm { flex: 0 0 150px; background: var(--box); border-radius: var(--radius); flex-direction: column; align-items: stretch; gap: 3px; }
  .home .today .tm-time { order: -1; width: auto; text-align: left; font-size: 11px; }
  .mrow { grid-template-columns: 52px minmax(0, 1fr); }
  .mrow .mev { grid-column: 2; padding-top: 0; font-size: 11px; }
  .mrow .mev .logo, .mrow .mev .logo-ph { display: none; }
  .mrow .mev small { display: inline; margin-left: 6px; }
  .mrow.noev .mev { display: none; }
  .rrow { grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr) 26px; }
  .rrow .rbo { display: none; }
  .rrow .rev { border-left: 0; padding-left: 4px; justify-content: flex-end; }
  .rrow .rev .name { display: none; }
  .banner-title { font-size: 18px; }
  .tabs a { font-size: 13px; }
  .score .big { font-size: 28px; }
  .tp-lineup { gap: 3px; padding: 10px 8px 0; }
  .tp-name { font-size: 11px; }
  .tp-row { grid-template-columns: minmax(0, 1fr) 46px minmax(0, 1fr) 48px; }
  .tp-date { grid-column: 1 / -1; }
  .nav nav a { padding: 0 9px; font-size: 14px; }
  .brand { padding: 0 11px; font-size: 17px; }
}
`

// Cache-busting version for /style.css
export const CSS_VERSION = (() => {
    let h = 5381
    for (let i = 0; i < CSS.length; i++) h = ((h << 5) + h + CSS.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
})()
