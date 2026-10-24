/* Pitch Perception: live matches (owner's request, 2026-10-24). While a match is on, the page reads the score, minute,
   cards, events and team statistics from the league's public match feed, in the visitor's browser, and works out live
   win / draw / defeat chances from the pre-match forecast and what has happened so far.
   The chances: each side's scoring rate through the match (Dixon and Robinson, 1998) on top of the pre-match Dixon-Coles
   forecast, with typical stoppage time; parameters in data/live.json (162, 163). The recursion below is the same as
   162's live_probs, checked against its test cases (163 --check). */
(function(){
"use strict";
const {$, $$, S, text, esc, pct, pctShort, short} = PP;
const API = "https://stats-api.mlssoccer.com";
const POLL_PAGE = 30e3, POLL_LIST = 60e3;
let LP = null;
const model = () => LP || (LP = fetch("data/live.json").then(r => r.ok ? r.json() : null).then(L => { if(L) prep(L); return L; }).catch(() => null));

/* ---------------- the model ---------------- */
function prep(L){
  L._max = {};
  [1, 2].forEach(p => { L._max[p] = Math.max(...Object.keys(L.survival[p]).map(Number)); });
}
const binOf = (p, m) => p === 1 ? (m >= 45 ? 9 : Math.floor(m / 5)) : (m >= 90 ? 19 : 10 + Math.floor((m - 45) / 5));
function reach(L, p, mFrom, mTo){
  const base = p === 1 ? 45 : 90; if(mTo < base) return 1;
  const Sp = L.survival[p], sTo = Sp[mTo] != null ? Sp[mTo] : 0;
  const sFrom = mFrom >= base - 1 ? (Sp[Math.max(mFrom, base - 1)] != null ? Sp[Math.max(mFrom, base - 1)] : 1) : 1;
  return sFrom > 0 ? Math.min(1, sTo / sFrom) : 0;
}
function termSum(T, gd, men, p){
  const h = p === 1 ? "1h" : "2h", g = k => T[k] || 0;
  let t = g("men_up") * Math.max(Math.min(men, 2), 0) + g("men_down") * Math.max(Math.min(-men, 2), 0);
  if(gd <= -2) t += g("gdm2_" + h); else if(gd === -1) t += g("gdm1_" + h); else if(gd === 1) t += g("gdp1_" + h); else if(gd >= 2) t += g("gdp2_" + h);
  return t;
}
/* W/D/L given the state at the start of minute m (0-based) of period p: goals gh, ga and red cards rh, ra so far */
function probs(L, lamH, lamA, p, m, gh, ga, rh, ra, rho){
  if(rho == null) rho = L.rho;
  const N = L.maxg + 1, T = L.terms || {};
  let G = new Float64Array(N * N); G[0] = 1;
  let eh = 0, ea = 0;
  const steps = [];
  if(p === 1){ for(let k = m; k <= L._max[1]; k++) steps.push([1, k]); for(let k = 45; k <= L._max[2]; k++) steps.push([2, k]); }
  else for(let k = m; k <= L._max[2]; k++) steps.push([2, k]);
  for(const [pp, k] of steps){
    const w = reach(L, pp, pp === p ? m : -1, k); if(w <= 1e-6) continue;
    const b = L.bins[binOf(pp, k)], H = new Float64Array(N * N);
    for(let x = 0; x < N; x++) for(let y = 0; y < N; y++){
      const q = G[x * N + y]; if(q === 0) continue;
      const d = gh + x - ga - y;
      const lh = lamH / 90 * w * Math.exp(b + termSum(T, d, ra - rh, pp)), la = lamA / 90 * w * Math.exp(b + termSum(T, -d, rh - ra, pp));
      eh += q * lh; ea += q * la;
      const p0h = Math.exp(-lh), p0a = Math.exp(-la), xi = Math.min(x + 1, N - 1), yi = Math.min(y + 1, N - 1);
      H[x * N + y] += q * p0h * p0a; H[xi * N + y] += q * (1 - p0h) * p0a; H[x * N + yi] += q * p0h * (1 - p0a); H[xi * N + yi] += q * (1 - p0h) * (1 - p0a);
    }
    G = H;
  }
  G[0] *= 1 - eh * ea * rho; G[1] *= 1 + eh * rho; G[N] *= 1 + ea * rho; G[N + 1] *= 1 - rho;
  let s = 0; for(let i = 0; i < G.length; i++){ if(G[i] < 0) G[i] = 0; s += G[i]; }
  const out = [0, 0, 0];
  for(let x = 0; x < N; x++) for(let y = 0; y < N; y++){ const d = gh + x - ga - y; out[d > 0 ? 0 : d === 0 ? 1 : 2] += G[x * N + y] / s; }
  return out;
}
const final = (gh, ga) => gh > ga ? [1, 0, 0] : gh === ga ? [0, 1, 0] : [0, 0, 1];

/* ---------------- the feed ---------------- */
const get = path => fetch(API + path, {cache: "no-store"}).then(r => r.ok ? r.json() : null).catch(() => null);
const DONE = /final|full|end/i, BREAK = s => s === "half" || /^half|break|pause/i.test(s);
/* the feed's minute is the one being played, 1-based ("39", "45+2"); the model's is 0-based within its period */
function clock(minute, status){
  status = status || "";
  if(DONE.test(status)) return {p: 2, m: 999, label: "Full time", short: "FT", done: true, on: false};
  if(BREAK(status)) return {p: 2, m: 45, label: "Half-time", short: "HT", on: true};
  if(!/firstHalf|secondHalf/.test(status)) return {p: 1, m: 0, label: "", short: "", on: false, pre: /schedul|pre/i.test(status)};
  const mm = String(minute || "").match(/^(\d+)(?:\+(\d+))?$/), p = status === "secondHalf" ? 2 : 1;
  if(!mm) return {p, m: p === 1 ? 0 : 45, label: "Live", short: "Live", on: true};
  const base = +mm[1], ex = +(mm[2] || 0), n = base + ex - 1;
  return {p, m: p === 2 ? Math.max(45, n) : Math.max(0, n), label: ex ? `${base}+${ex}'` : `${base}'`, short: ex ? `${base}+${ex}'` : `${base}'`, on: true};
}
const evClock = e => { const p = e.game_section === "secondHalf" ? 2 : 1, mm = String(e.minute_of_play || "").match(/^(\d+)(?:\+(\d+))?$/);
  const n = mm ? +mm[1] + +(mm[2] || 0) - 1 : (p === 1 ? 0 : 45); return {p, m: p === 2 ? Math.max(45, n) : n, label: e.minute_of_play ? e.minute_of_play + "'" : ""}; };
async function stats(id){
  const d = await get(`/statistics/clubs/matches/${id}`), s = d && d.match_statistics_list && d.match_statistics_list[0] && d.match_statistics_list[0].match_statistics;
  if(!s) return null;
  const T = s.team_statistics || [], h = T.find(t => t.team_role === "home") || {}, a = T.find(t => t.team_role !== "home") || {};
  const sc = String(s.result || "").match(/(\d+)\s*:\s*(\d+)/);
  const gh = sc ? +sc[1] : (h.goals || 0), ga = sc ? +sc[2] : (a.goals || 0);
  const red = t => (t.cards_red || 0) + (t.cards_yellow_red || 0);
  const row = t => ({shots: t.shots_at_goal_sum, on: (t.shots_at_goal_held || 0) + (t.shots_at_goal_successfull || 0), poss: t.possession_ratio,
    corners: t.corner_kicks_sum, fouls: t.fouls_sum, offsides: t.offsides, yellow: t.cards_yellow, red: red(t)});
  return {status: s.match_status, clock: clock(s.minute_of_play, s.match_status), gh, ga, rh: red(h), ra: red(a), home: row(h), away: row(a)};
}
async function events(id){
  const d = await get(`/matches/${id}/key_events?per_page=500`);
  const ev = ((d && d.events) || []).slice().sort((x, y) => String(x.event.event_time).localeCompare(String(y.event.event_time)));
  const out = []; let gh = 0, ga = 0;
  const who = e => e.player_alias || [e.player_first_name, e.player_last_name].filter(Boolean).join(" ");
  ev.forEach(x => { const e = x.event || {}, c = evClock(e), side = e.team_role === "home" ? 0 : 1;
    const sc = String(e.result || "").match(/^(\d+):(\d+)$/);
    if(sc && (+sc[1] !== gh || +sc[2] !== ga)){
      const s2 = +sc[1] > gh ? 0 : 1; gh = +sc[1]; ga = +sc[2];
      out.push({kind: "goal", side: s2, ...c, who: who(e), own: s2 !== side, score: [gh, ga],
        assist: e.assist_player_alias || [e.assist_player_first_name, e.assist_player_last_name].filter(Boolean).join(" ")});
    } else if(x.type === "cards"){
      const col = String(e.card_color || e.card_rating || "");
      out.push({kind: /red/i.test(col) ? (/yellow/i.test(col) ? "second" : "red") : "yellow", side, ...c, who: who(e)});
    } else if(x.type === "final_whistle"){
      out.push({kind: "end", side: -1, ...c});          // end of a half: fixes the length of first-half stoppage time on the chart
    } else if(x.type === "substitutions"){
      out.push({kind: "sub", side, ...c, who: [e.player_in_first_name, e.player_in_last_name].filter(Boolean).join(" "), off: [e.player_out_first_name, e.player_out_last_name].filter(Boolean).join(" ")});
    }
  });
  return out;
}
/* the chances through the match so far, one point per minute played, from the goal and red-card times */
function curve(L, m, ev, now){
  const lastIn = p => Math.max(-1, ...ev.filter(e => e.p === p).map(e => e.m));
  const end1 = now.p === 1 && !now.done ? Math.max(44, now.m) : Math.max(44, lastIn(1));
  const end2 = now.done ? Math.max(89, lastIn(2)) : now.m;
  const state = (p, k) => { let gh = 0, ga = 0, rh = 0, ra = 0;
    ev.forEach(e => { if(e.p < p || (e.p === p && e.m < k)){ if(e.kind === "goal"){ if(e.side === 0) gh++; else ga++; } else if(e.kind === "red" || e.kind === "second"){ if(e.side === 0) rh++; else ra++; } } });
    return [gh, ga, rh, ra]; };
  const pts = [], push = (p, k, x) => pts.push({x, p, k, v: probs(L, m.xg_home, m.xg_away, p, k, ...state(p, k))});
  for(let k = 0; k <= (now.p === 1 && !now.done ? now.m : end1); k++) push(1, k, k);
  if(now.p === 2 || now.done) for(let k = 45; k <= Math.min(end2, 130); k++) push(2, k, end1 + 1 + (k - 45));
  if(now.done){ const s = state(3, 0); pts.push({x: pts[pts.length - 1].x + 1, p: 2, k: 999, v: final(s[0], s[1])}); }
  return {pts, end1};
}

/* ---------------- drawing ---------------- */
function drawCurve(el, m, C, ev){
  const W = el.clientWidth; if(!W || !C.pts.length) return; el.innerHTML = "";
  const H = 230, mg = {l: 36, r: W < 520 ? 52 : 120, t: 26, b: 28}, [ch, ca] = PP.pairKit(m.home, m.away);
  const xmax = Math.max(C.end1 + 1 + 50, C.pts[C.pts.length - 1].x), sx = v => mg.l + v / xmax * (W - mg.l - mg.r), sy = v => mg.t + (1 - v) * (H - mg.t - mg.b);
  const last = C.pts[C.pts.length - 1].v;
  const svg = S("svg", {width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Live chances through the match: ${short(m.home)} ${pct(last[0])}, draw ${pct(last[1])}, ${short(m.away)} ${pct(last[2])}`}, el);
  const band = (lo, hi, fill) => { const top = C.pts.map((q, i) => `${i ? "L" : "M"}${sx(q.x)},${sy(hi(q.v))}`).join(""), bot = C.pts.slice().reverse().map(q => `L${sx(q.x)},${sy(lo(q.v))}`).join("");
    S("path", {d: top + bot + "Z", fill, opacity: 0.88}, svg); };
  band(v => 0, v => v[0], ch); band(v => v[0], v => v[0] + v[1], "var(--mid)"); band(v => v[0] + v[1], v => 1, ca);
  [0, 0.5, 1].forEach(v => { S("line", {x1: mg.l, x2: W - mg.r, y1: sy(v), y2: sy(v), class: "g-line"}, svg); text(svg, mg.l - 6, sy(v) + 4, Math.round(v * 100) + "%", "t-axis", {"text-anchor": "end"}); });
  [[0, "0'"], [15, "15'"], [30, "30'"], [C.end1 + 1, "HT"], [C.end1 + 16, "60'"], [C.end1 + 31, "75'"], [C.end1 + 46, "90'"]].forEach(([x, l]) => text(svg, sx(x), H - 8, l, "t-axis", {"text-anchor": "middle"}));
  S("line", {x1: sx(C.end1 + 1), x2: sx(C.end1 + 1), y1: mg.t, y2: H - mg.b, class: "g-line", "stroke-dasharray": "3 3"}, svg);
  const xOf = e => e.p === 1 ? e.m + 1 : C.end1 + 1 + (e.m - 45) + 1;
  ev.filter(e => e.kind === "goal" || e.kind === "red" || e.kind === "second").forEach(e => {
    const x = sx(Math.min(xOf(e), xmax)), goal = e.kind === "goal";
    S("line", {x1: x, x2: x, y1: mg.t - 6, y2: H - mg.b, stroke: "var(--paper)", "stroke-width": 1.5}, svg);
    S(goal ? "circle" : "rect", goal ? {cx: x, cy: mg.t - 12, r: 6, fill: e.side ? ca : ch, stroke: "var(--paper)", "stroke-width": 1.5, "data-tip": `<b>${e.own ? "Own goal" : "Goal"}</b>, ${esc(e.label)}<br>${esc(e.who)}, ${esc(short(e.side ? m.away : m.home))}<br>${e.score[0]}–${e.score[1]}`}
      : {x: x - 4, y: mg.t - 18, width: 8, height: 11, rx: 1.5, fill: "var(--flare)", "data-tip": `<b>Red card</b>, ${esc(e.label)}<br>${esc(e.who)}, ${esc(short(e.side ? m.away : m.home))}`}, svg);
  });
  const xr = W - mg.r + 8, lab = [[last[0] / 2, `${short(m.home)} ${pctShort(last[0])}`], [last[0] + last[1] / 2, `Draw ${pctShort(last[1])}`], [last[0] + last[1] + last[2] / 2, `${short(m.away)} ${pctShort(last[2])}`]];
  if(W >= 520){ let prev = Infinity; lab.map(([v, s]) => [sy(v) + 4, s]).sort((a, b) => b[0] - a[0]).forEach(([y, s]) => { const yy = Math.min(y, prev - 14); prev = yy; text(svg, xr, Math.max(yy, mg.t + 4), s, "t-lab", {}); }); }
}
const statRows = [["shots", "Shots"], ["on", "On target"], ["poss", "Possession"], ["corners", "Corners"], ["fouls", "Fouls"], ["yellow", "Yellow cards"], ["red", "Red cards"]];
function statsHtml(m, s){
  const [ch, ca] = PP.pairKit(m.home, m.away);
  return `<div class="lstats">${statRows.map(([k, l]) => { const a = +s.home[k] || 0, b = +s.away[k] || 0, t = a + b, f = k === "poss" ? v => Math.round(v) + "%" : v => v;
    return `<div class="lsr"><span class="num">${f(a)}</span><span class="lsl">${l}</span><span class="num">${f(b)}</span><div class="lsb">${t ? `<i style="width:${a / t * 100}%;background:${ch}"></i><i style="width:${b / t * 100}%;background:${ca}"></i>` : `<i style="width:100%;background:var(--well)"></i>`}</div></div>`; }).join("")}</div>`;
}
const ICON = {goal: `<i class="lev-i goal" aria-hidden="true"></i>`, yellow: `<i class="lev-i card y" aria-hidden="true"></i>`, red: `<i class="lev-i card r" aria-hidden="true"></i>`, second: `<i class="lev-i card yr" aria-hidden="true"></i>`, sub: `<i class="lev-i sub" aria-hidden="true">⇄</i>`};
const KIND = {goal: "Goal", yellow: "Yellow card", red: "Red card", second: "Second yellow", sub: "Substitution"};
function eventsHtml(m, ev){
  ev = ev.filter(e => e.kind !== "end");
  if(!ev.length) return `<p class="r-small">No goals, cards or substitutions yet.</p>`;
  return `<ol class="levents">${ev.slice().reverse().map(e => `<li class="lev ${e.side ? "a" : "h"}${e.kind === "goal" ? " is-goal" : ""}"><span class="num lmin">${esc(e.label)}</span>${ICON[e.kind]}
    <span class="lwho">${PP.chip(e.side ? m.away : m.home)}<span class="sr">${KIND[e.kind]}: </span>${e.kind === "sub" ? `${esc(e.who)} <span class="r-small">for ${esc(e.off)}</span>` : `${esc(e.who)}${e.kind === "goal" ? ` <b class="num">${e.score[0]}–${e.score[1]}</b>${e.own ? ` <span class="r-small">own goal</span>` : e.assist ? ` <span class="r-small">assist ${esc(e.assist)}</span>` : ""}` : ""}`}</span></li>`).join("")}</ol>`;
}
const ingredients = L => L.variant === "L2" ? "the score, red cards, how teams play when ahead or behind, and the time left" : L.variant === "L1" ? "the score, red cards and the time left" : "the score and the time left";
const note = L => `Live score and events from the league's match feed, refreshed every 30 seconds. The live chances start from the forecast before kickoff and update with ${ingredients(L)}, including typical stoppage time: each side's scoring rate through a match (after Dixon and Robinson, 1998), fitted on MLS regular-season matches 2021–25.`;

/* ---------------- timers ---------------- */
const timers = new Set();
function every(ms, hash, fn){
  let t = null;
  const tick = async () => { if(location.hash.slice(1) !== hash){ timers.delete(t); return; }
    if(!document.hidden){ const go = await fn(); if(go === false){ timers.delete(t); return; } }
    t = setTimeout(tick, ms); timers.add(t); };
  tick();
}
addEventListener("hashchange", () => { timers.forEach(clearTimeout); timers.clear(); });

/* a match is in the live window from 10 minutes before kickoff until 12 hours after, until its result is in the site's data */
const kick = m => m.kickoff_utc ? new Date(m.kickoff_utc.replace("Z", ":00Z")) : null;
const inWindow = (m, now = Date.now()) => { const k = kick(m); return m.status !== "played" && k && now >= k - 10 * 60e3 && now <= +k + 12 * 3600e3; };

/* ---------------- match page ---------------- */
async function page(m, el){
  const L = await model(); if(!L) return false;
  const id = L.ids[String(m.id)]; if(!id) return false;
  const hash = location.hash.slice(1); let C = null, EV = [];
  el.innerHTML = `<div class="wrap"><section class="plate pplate mplate lplate" aria-live="polite"><div class="pp-left"><span class="r-label">Live</span><p class="r-small">Checking the match feed.</p></div><div class="pp-right"></div></section></div>
    <section class="band" id="lcurvesec" hidden><div class="wrap"><div class="band-head"><h2 class="r-title">The chances, minute by minute</h2><p>${esc(short(m.home))} win (bottom), draw, ${esc(short(m.away))} win (top), as the match has gone. Circles are goals, rectangles red cards; hover them.</p></div><div class="chart" id="lcurve"></div></div></section>`;
  every(POLL_PAGE, hash, async () => {
    const [s, ev] = await Promise.all([stats(id), events(id)]);
    if(location.hash.slice(1) !== hash) return false;
    if(!s){ $(".lplate .pp-left", el).innerHTML = `<span class="r-label">Live</span><p class="r-small">The match feed is not answering; trying again shortly.</p>`; return true; }
    if(!s.clock.on && !s.clock.done){ $(".lplate .pp-left", el).innerHTML = `<span class="r-label">Live</span><p class="r-small">${s.clock.pre ? "Not kicked off yet. The live score and chances appear here from kickoff." : "No live data for this match."}</p>`; return true; }
    EV = ev || EV;
    const now = s.clock, v = now.done ? final(s.gh, s.ga) : probs(L, m.xg_home, m.xg_away, now.p, now.m, s.gh, s.ga, s.rh, s.ra);
    const sc = $(".mscore"); if(sc){ sc.textContent = `${s.gh}–${s.ga}`; sc.classList.add("is-live"); }
    const pill = $(".lpill-head"); if(pill) pill.outerHTML = livePill(now);
    else { const lab = $(".mhead .r-label"); if(lab) lab.insertAdjacentHTML("afterend", livePill(now)); }
    $(".lplate .pp-left", el).innerHTML = `<span class="r-label">${now.done ? "Full time" : "Live chances"}</span>
      ${PP.pbarFor(m, v, true)}
      <div class="mprob num"><span><b class="r-figure" style="font-size:var(--t-36)">${pctShort(v[0])}</b><br>${esc(short(m.home))} win</span><span><b class="r-figure" style="font-size:var(--t-36)">${pctShort(v[1])}</b><br>draw</span><span style="text-align:right"><b class="r-figure" style="font-size:var(--t-36)">${pctShort(v[2])}</b><br>${esc(short(m.away))} win</span></div>
      <p class="r-small">Before kickoff: ${pctShort(m.pH)} ${esc(short(m.home))} win, ${pctShort(m.pD)} draw, ${pctShort(m.pA)} ${esc(short(m.away))} win.</p>
      <h3 class="r-heading" style="margin-top:var(--s-4)">Match events</h3>${eventsHtml(m, EV)}`;
    $(".lplate .pp-right", el).innerHTML = `<span class="r-label">Match statistics</span>${statsHtml(m, s)}<p class="r-small">${note(L)}</p>`;
    C = curve(L, m, EV, now);
    $("#lcurvesec").hidden = false;
    PP.chart($("#lcurve"), e2 => drawCurve(e2, m, C, EV)); PP.bindTips($("#lcurve"));
    return !now.done;
  });
  return true;
}
const livePill = c => c.done ? `<span class="lpill lpill-head done">Full time</span>` : `<span class="lpill lpill-head"><i aria-hidden="true"></i>${c.short === "HT" ? "Half-time" : "Live " + esc(c.short)}</span>`;

/* ---------------- matches list: live rows ---------------- */
let LIST = null;                 // one poller per visit to the list; redraws (filters, matchdays) re-apply its last readings
addEventListener("hashchange", () => { LIST = null; });
async function list(root, matches){
  const L = await model(); if(!L) return;
  const hash = location.hash.slice(1);
  if(LIST && LIST.hash === hash){ LIST.root = root; LIST.apply(); return; }
  const ids = () => $$("[data-live]", LIST.root).map(r => r.dataset.live).filter(x => L.ids[x]);
  LIST = {hash, root, cache: {}};
  if(!ids().length){ LIST = null; return; }
  const me = LIST;
  me.apply = () => Object.entries(me.cache).forEach(([w, s]) => { const m = matches.find(x => String(x.id) === w); if(!s || !m || !(s.clock.on || s.clock.done)) return;
    const v = s.clock.done ? final(s.gh, s.ga) : probs(L, m.xg_home, m.xg_away, s.clock.p, s.clock.m, s.gh, s.ga, s.rh, s.ra);
    $$(`[data-live="${w}"]`, me.root).forEach(r => {
      const t = $(".time", r); if(t) t.innerHTML = `${s.clock.done ? `<span class="lpill done">FT</span>` : `<span class="lpill"><i aria-hidden="true"></i>${esc(s.clock.short)}</span>`}<b class="lsc num">${s.gh}–${s.ga}</b>`;
      const pb = $(".probs", r); if(pb) pb.innerHTML = `${PP.pbarFor(m, v)}<div class="plab"><span><b>${pctShort(v[0])}</b> win</span><span>${pctShort(v[1])} draw</span><span><b>${pctShort(v[2])}</b> win</span></div>`;
      const st = $(".stake", r); if(st && !$(".lpre", st)) st.insertAdjacentHTML("afterbegin", `<span class="r-small lpre">${s.clock.done ? "Full time." : "Live chances."} Before kickoff ${pctShort(m.pH)}, ${pctShort(m.pD)}, ${pctShort(m.pA)}.</span>`);
      r.classList.add("is-live");
    });
  });
  every(POLL_LIST, hash, async () => {
    if(LIST !== me) return false;
    const want = [...new Set(ids())]; if(!want.length) return true;
    await Promise.all(want.map(async w => { if(me.cache[w] && me.cache[w].clock.done) return; const s = await stats(L.ids[w]); if(s) me.cache[w] = s; }));
    if(LIST !== me) return false;
    me.apply();
    return true;                  // keeps polling while the list is open: other matches may kick off
  });
}

PP.pbarFor = PP.pbarFor || ((m, v, big) => { const [h, a] = PP.pairKit(m.home, m.away); return `<div class="pbar${big ? " big" : ""}" role="img" aria-label="${esc(short(m.home))} ${pct(v[0])}, draw ${pct(v[1])}, ${esc(short(m.away))} ${pct(v[2])}"><i style="width:${v[0] * 100}%;background:${h}"></i><i style="width:${v[1] * 100}%;background:var(--mid)"></i><i style="width:${v[2] * 100}%;background:${a}"></i></div>`; });
PP.live = {model, probs, clock, curve, inWindow, page, list, _test: {reach, binOf}};
})();
