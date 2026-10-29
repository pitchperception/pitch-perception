/* Pitch Perception: the playoffs (owner, 2026-10-27). From the end of the regular season the "Playoff race" tab shows
   the clubs still in, with each one's chance of reaching every remaining round, the bracket and the playoff matches;
   the front page and the Matches page show the playoff fixtures, forecasts and results. Clubs that did not qualify or
   are knocked out are left out of the chances. Data: data/playoffs.json (event_model/172_playoff_site.py, from 171's
   league-feed state and 29's bracket simulation with every playoff result so far held fixed). */
(function(){
"use strict";
const {$$, S, text, esc, pct, pctShort, short, full, chip, clubTag} = PP;
let poP = null;
PP.loadPlayoffs = () => poP || (poP = fetch("data/playoffs.json").then(r => r.ok ? r.json() : null).catch(() => null));
const RL = {wild_card:"Wild card", round_one:"Round One", conf_semi:"Conference semifinal", conf_final:"Conference final", cup:"MLS Cup"};
const COLS = {p_round1:["Round One","R1"], p_semis:["Conference semifinals","Semis"], p_conf_final:["Conference final","Conf. final"],
              p_cup_final:["MLS Cup final","Final"], p_champion:["Win MLS Cup","Win"]};
const REACHED = {p_round1:"in Round One", p_semis:"in the conference semifinals", p_conf_final:"in the conference final", p_cup_final:"in MLS Cup", p_champion:"MLS Cup winners"};
const byId = P => Object.fromEntries((P.matches || []).map(m => [m.id, m]));
const alive = P => (P.teams || []).filter(t => t.status !== "out");
const team = (P, t) => (P.teams || []).find(x => x.team === t) || {};
const seedTag = (P, t) => { const s = team(P, t).seed; return s ? `<span class="po-seed num">${s}</span>` : ""; };
const kickText = m => { if(!m.time_confirmed) return "Date and time to be confirmed"; const k = PP.kick(m.kickoff_utc); return k ? `${k.day}, ${k.time}` : ""; };
const gameName = m => m.round === "round_one" ? `Round One, game ${m.game}` : RL[m.round];
const rlow = r => (RL[r] || r || "").replace(/^Wild card/, "wild card").replace(/^Conference/, "conference");
const fav = P => alive(P).slice().sort((a,b) => (b.p_champion||0) - (a.p_champion||0))[0];
const and = a => a.length > 1 ? a.slice(0,-1).join(", ") + " and " + a[a.length-1] : a[0] || "";
const scoreText = m => {
  let s = `${m.g_home}–${m.g_away}`;
  if(m.pen_home != null) s += `, ${Math.max(m.pen_home, m.pen_away)}–${Math.min(m.pen_home, m.pen_away)} on penalties`;
  else if(m.et) s += " after extra time";
  return s;
};
const resultSentence = m => {
  const s = `${esc(short(m.home))} ${m.g_home}–${m.g_away} ${esc(short(m.away))}`;
  if(m.pen_home != null) return `${s}; ${esc(short(m.winner))} won ${Math.max(m.pen_home, m.pen_away)}–${Math.min(m.pen_home, m.pen_away)} on penalties`;
  return m.et ? `${s} after extra time` : s;
};
const resultLine = m => m.winner ? `${esc(short(m.winner))} ${m.pen_home != null ? "won on penalties" : "won"}` : m.status === "final_pending" ? "Level; penalties to come" : "";
const seriesText = (m, P) => {     // a Round One game's series score before it, from the home side's view
  const b = m.series_before; if(!b || (!b[0] && !b[1])) return "";
  if(b[0] === b[1]) return `series level ${b[0]}–${b[1]}`;
  const lead = b[0] > b[1] ? m.home : m.away;
  return `${esc(short(lead))} lead the series ${Math.max(...b)}–${Math.min(...b)}`;
};
// where the forecast comes from (owner, 2026-10-27: team sheets apply in the playoffs too), the league pages' labels
const srcLine = f => f && f.source === "lineups" ? `<span class="src"><i class="st confirmed"></i>Confirmed lineups</span>`
  : f && f.source === "availability" ? `<span class="src"><i class="st likely"></i>Likely lineups from the availability report</span>`
  : `<span class="src"><i class="st model"></i>Team strength only; no lineup news yet</span>`;
const pbar = (m, f) => { const [h, a] = PP.pairKit(m.home, m.away); return `<div class="pbar" role="img" aria-label="${esc(short(m.home))} ${pct(f.pH)}, draw ${pct(f.pD)}, ${esc(short(m.away))} ${pct(f.pA)} after 90 minutes"><i style="width:${f.pH*100}%;background:${h}"></i><i style="width:${f.pD*100}%;background:var(--mid)"></i><i style="width:${f.pA*100}%;background:${a}"></i></div>`; };
const throughLine = (m, f) => {
  const ph = f.p_through_home;
  if(ph == null) return "";
  const what = m.round === "round_one" ? "To win the series" : m.round === "cup" ? "To win MLS Cup" : "To go through";
  return `<span class="po-through">${what}: <b>${esc(short(m.home))} ${pctShort(ph)}</b>, <b>${esc(short(m.away))} ${pctShort(1-ph)}</b></span>`;
};

/* one upcoming playoff match, as a Matches-page row */
PP.poUpRow = (m, P) => { const f = m.forecast;
  // each row opens the match's page (P-B, 2026-10-27); a row being played gets the live score and chance to go through (live.js)
  const live = PP.live && f && PP.live.inWindow({kickoff_utc: m.kickoff_utc, status: "upcoming"}) ? ` data-po-live="${m.id}"` : "";
  return `<div class="fx po-fx" data-href="#playoff-${m.id}" role="link" tabindex="0"${live}><span class="time">${m.time_confirmed ? PP.kick(m.kickoff_utc).time : "Time TBC"}</span>
    <div class="teams"><span>${seedTag(P, m.home)}${clubTag(m.home, true)}</span><span>${seedTag(P, m.away)}${clubTag(m.away, true)}</span></div>
    ${f ? `<div class="probs">${pbar(m, f)}<div class="plab"><span><b>${pctShort(f.pH)}</b> win</span><span>${pctShort(f.pD)} draw</span><span><b>${pctShort(f.pA)}</b> win</span></div>
      <span class="src">After 90 minutes${m.round === "wild_card" || m.round === "round_one" ? "; a draw goes straight to penalties" : "; a draw goes to extra time"}</span></div>` : `<div class="probs"><span class="r-small">No forecast yet</span></div>`}
    <div class="stake"><span class="r-label">${gameName(m)}${seriesText(m, P) ? `, ${seriesText(m, P)}` : ""}</span>${f ? throughLine(m, f) : ""}${srcLine(f)}</div></div>`;
};
/* one played playoff match */
PP.poPastRow = (m, P) => { const f = m.forecast, hw = m.winner === m.home;
  const pre = f && f.p_win_home != null ? `Before kickoff: ${esc(short(m.home))} ${pctShort(f.p_win_home)} to win this match, ${esc(short(m.away))} ${pctShort(1 - f.p_win_home)}` : "No forecast recorded before kickoff";
  return `<div class="fx fxp po-fx" data-href="#playoff-${m.id}" role="link" tabindex="0"><span class="score num">${m.g_home ?? ""}–${m.g_away ?? ""}</span>
    <div class="teams"><span${m.winner && hw ? ' class="po-w"' : ""}>${seedTag(P, m.home)}${clubTag(m.home, true)}</span><span${m.winner && !hw ? ' class="po-w"' : ""}>${seedTag(P, m.away)}${clubTag(m.away, true)}</span></div>
    <div class="xgpair r-small">${m.pen_home != null ? `<span>Penalties ${m.pen_home}–${m.pen_away}</span>` : m.et ? `<span>After extra time (${m.g90_home}–${m.g90_away} after 90)</span>` : ""}<span>${resultLine(m)}</span></div>
    <div class="stake r-small"><span class="r-label">${gameName(m)}</span><span>${pre}</span></div></div>`;
};

/* ---------------- the chances: one heat table per conference ---------------- */
function chances(P){
  const A = alive(P), keys = P.reach.map(c => c.key).filter(k => A.some(t => t[k] != null && t[k] < 0.9995));
  if(!keys.length) return "";
  const cell = (t, k) => { const p = t[k];
    if(p == null) return `<i class="po-c"></i>`;
    if(p >= 0.9995) return `<i class="po-c po-in" data-tip="<b>${esc(full(t.team))}</b><br>Already ${REACHED[k]}">✓</i>`;
    const band = p < 0.005 ? 0 : Math.min(5, Math.floor(p*5-1e-9)+1);
    return `<i class="po-c" style="${band ? `background:var(--pct-${band});color:${band>=4?"var(--paper)":"var(--ink)"}` : ""}" data-tip="<b>${esc(full(t.team))}</b><br>${COLS[k][0]}: ${pct(p)}">${pctShort(p)}</i>`; };
  const grid = conf => {
    const ts = A.filter(t => t.conference === conf).sort((a,b) => (b.p_champion||0) - (a.p_champion||0) || (a.seed||99) - (b.seed||99));
    if(!ts.length) return "";
    return `<div class="po-block"><h3 class="r-heading">${conf}ern Conference</h3><div class="po-grid" style="--po-n:${keys.length}" role="table" aria-label="${conf}ern Conference: chance of reaching each round">
      <div class="po-row po-head" role="row"><span class="po-s" role="columnheader"><span class="nmL">Seed</span><span class="nmS">#</span></span><span class="po-t" role="columnheader">Club</span>${keys.map(k => `<span class="po-h" role="columnheader"><span class="nmL">${COLS[k][0]}</span><span class="nmS">${COLS[k][1]}</span></span>`).join("")}</div>
      ${ts.map(t => `<div class="po-row" role="row"><span class="po-s num">${t.seed ?? ""}</span><a class="po-t" href="#team-${PP.slug(t.team)}">${chip(t.team)}<span class="nmL">${esc(short(t.team))}</span><span class="nmS">${(PP.CLUB[t.team]||[t.team])[0]}</span></a>${keys.map(k => cell(t, k)).join("")}</div>`).join("")}</div></div>`;
  };
  return `<section class="band" id="po-chances" aria-labelledby="poc-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="poc-h">${P.phase === "set" ? "Chance of reaching each round" : "Who can still win it"}</h2><p>Every club still in the playoffs, with its chance of reaching each round still to come and of winning MLS Cup, darker for likelier. ${P.played ? "Every playoff result so far is fixed; the rest" : "The bracket"} is played out ${PP.int(P.sims || 20000)} times from today's team strengths. A tick: already there.</p></div>
    <div class="po-chances">${grid("East")}${grid("West")}</div>
    <div class="pct-key">${[1,2,3,4,5].map(i => `<span><i style="background:var(--pct-${i})"></i>${["0–20%","20–40%","40–60%","60–80%","80–100%"][i-1]}</span>`).join("")}<span>✓ already there</span></div>
  </div></section>`;
}

/* ---------------- MLS Cup chances day by day (owner, 2026-10-27): one line per club still in, from playoffs.json's
   history (the last forecast run of each day since the regular season ended). A club that is out is not drawn. ---------------- */
let POH = null;
function history(P){
  const H = P.history || {}, n = (H.dates || []).length, A = alive(P).filter(t => (H.p_champion || {})[t.team]);
  if(n < 2 || !A.length) return "";
  POH = {P, A};
  return `<section class="band" id="po-history" aria-labelledby="poh2-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="poh2-h">MLS Cup chances through the playoffs</h2><p>Each line is a club still in the playoffs: its chance of winning MLS Cup after each day's forecast since the regular season ended. The three likeliest champions today are drawn strongest; hover or tap for any club. Clubs that are out are not drawn.</p></div>
    <figure class="tfig" style="margin:0"><div class="chart po-hist"></div></figure>
  </div></section>`;
}
function drawHistory(el){
  if(!POH) return;
  const {P, A} = POH, H = P.history, dates = H.dates, n = dates.length, W = el.clientWidth; if(!W) return;
  const narrow = W < 520, Ht = narrow ? 300 : 360; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":"Chance of winning MLS Cup after each day of the playoffs, one line per club still in"},el);
  const m = {l:40,r:narrow?58:112,t:10,b:24}, iw = W-m.l-m.r, ih = Ht-m.t-m.b, sx = i => m.l + i/(n-1)*iw;
  const val = (t, i) => H.p_champion[t.team][i];
  const all = A.flatMap(t => H.p_champion[t.team].filter(v => v != null)), y1 = Math.max(0.1, Math.ceil(Math.max(...all)*10)/10), sy = v => m.t + ih - v/y1*ih;
  const step = y1 <= 0.4 ? 0.1 : 0.25;
  for(let v = 0; v <= y1+1e-9; v += step){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v<1e-9?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, Math.round(v*100)+"%", "t-axis", {"text-anchor":"end"}); }
  const ticks = narrow ? [0, n-1] : [0, Math.floor((n-1)/2), n-1];
  ticks.forEach(i => text(svg, sx(i), Ht-6, new Date(dates[i]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"}), "t-axis", {"text-anchor": i === 0 ? "start" : i === n-1 ? "end" : "middle"}));
  const top = new Set(A.slice().sort((a,b) => (b.p_champion||0) - (a.p_champion||0)).slice(0, 3).map(t => t.team));
  const strong = t => top.has(t.team), paths = new Map();
  A.slice().sort((a,b) => strong(a) - strong(b)).forEach(t => {
    const pts = H.p_champion[t.team].map((v,i) => v == null ? null : [sx(i), sy(v)]).filter(Boolean);
    paths.set(t.team, S("path",{d:pts.map((q,i) => (i?"L":"M")+q[0]+","+q[1]).join(""),fill:"none",stroke:strong(t)?"var(--signal)":"var(--ink-3)","stroke-width":strong(t)?2.25:1.1,"stroke-opacity":strong(t)?1:0.55,"stroke-linejoin":"round",style:"transition:opacity 120ms ease-out"},svg));
  });
  const ends = A.filter(t => val(t, n-1) != null).map(t => ({t, y: sy(val(t, n-1))})).sort((a,b) => a.y - b.y);
  for(let i = 1; i < ends.length; i++) if(ends[i].y - ends[i-1].y < 12.5) ends[i].y = ends[i-1].y + 12.5;
  const over = ends.length ? ends[ends.length-1].y - (m.t+ih+4) : 0; if(over > 0) ends.forEach(e => e.y -= over);
  ends.forEach(e => text(svg, sx(n-1)+7, e.y+4, `${narrow ? (PP.CLUB[e.t.team]||[e.t.team])[0] : short(e.t.team)} ${pctShort(val(e.t, n-1))}`, strong(e.t) ? "t-lab" : "t-lab2", {style: strong(e.t) ? "" : "opacity:.75"}));
  const cross = S("line",{x1:0,x2:0,y1:m.t,y2:m.t+ih,stroke:"var(--ink-3)",opacity:0},svg), ov = S("rect",{x:m.l,y:m.t,width:iw,height:ih,fill:"transparent"},svg);
  const move = e => { const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n-1, Math.round((e.clientX-r.left-m.l)/iw*(n-1)))), y = e.clientY - r.top;
    let best = null, bd = 1e9; A.forEach(t => { const v = val(t, i); if(v == null) return; const d = Math.abs(sy(v) - y); if(d < bd){ bd = d; best = t; } });
    cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("opacity", 1);
    paths.forEach((pth, k) => pth.style.opacity = !best || k === best.team ? 1 : 0.2);
    if(best) PP.showTip(`<b>${esc(full(best.team))}</b><br>${new Date(dates[i]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}: ${pct(val(best, i))} to win MLS Cup<br>Now ${pct(val(best, n-1))}`, e.clientX, e.clientY); };
  ov.addEventListener("pointermove", move); ov.addEventListener("pointerdown", move);
  ov.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); paths.forEach(pth => pth.style.opacity = 1); PP.hideTip(); });
}

/* ---------------- the bracket ---------------- */
function bracket(P){
  const M = byId(P), B = P.bracket || {};
  const side = (t, seed, mark, win) => t ? `<div class="po-side${win ? " po-w" : ""}"><span class="po-seed num">${seed ?? ""}</span>${clubTag(t)}<span class="po-r num">${mark ?? ""}</span></div>`
    : `<div class="po-side po-tbd"><span class="po-seed num"></span><span class="r-small">To be decided</span><span class="po-r"></span></div>`;
  const tieCard = x => {
    if(!x) return "";
    const ms = (x.matches || []).map(id => M[id]).filter(Boolean), done = ms.filter(m => m.status === "final"), next = ms.find(m => m.status === "scheduled");
    let ma = null, mb = null, note = "";
    if(x.round === "round_one"){
      if(x.wins){ ma = x.wins[0]; mb = x.wins[1]; }
      note = done.map(m => `G${m.game} ${m.home === x.a ? `${m.g_home}–${m.g_away}` : `${m.g_away}–${m.g_home}`}${m.pen_home != null ? " (pens)" : ""}`).join(" · ");
    } else if(done.length){
      const m = done[0], fa = m.home === x.a;
      ma = fa ? m.g_home : m.g_away; mb = fa ? m.g_away : m.g_home;
      note = m.pen_home != null ? `Penalties ${fa ? m.pen_home : m.pen_away}–${fa ? m.pen_away : m.pen_home}` : m.et ? "After extra time" : "";
    }
    if(!x.winner && next) note = (note ? note + " · " : "") + (next.round === "round_one" ? `Game ${next.game}: ` : "") + kickText(next);
    return `<div class="po-tie">${side(x.a, x.seed_a, ma, x.winner && x.winner === x.a)}${side(x.b, x.seed_b, mb, x.winner && x.winner === x.b)}${note ? `<div class="po-note r-small">${note}</div>` : ""}</div>`;
  };
  const conf = c => { const b = B[c]; if(!b) return "";
    return `<div class="po-conf"><h3 class="r-heading">${c}ern Conference</h3><div class="po-rounds">
      <div class="po-round"><span class="r-label">Wild card</span>${tieCard(b.wild_card)}</div>
      <div class="po-round"><span class="r-label">Round One, best of three</span>${b.round_one.map(tieCard).join("")}</div>
      <div class="po-round"><span class="r-label">Conference semifinals</span>${b.semis.map(tieCard).join("")}</div>
      <div class="po-round"><span class="r-label">Conference final</span>${tieCard(b.final)}</div></div></div>`; };
  const cup = B.cup ? `<div class="po-cup"><span class="r-label">MLS Cup, 18 December</span>${tieCard({...B.cup, seed_a: null, seed_b: null})}</div>` : "";
  return `<section class="band well" id="po-bracket" aria-labelledby="pob-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="pob-h">The bracket</h2><p>Seeds ${P.seeds_official ? "as the league published them" : "from the final table (the league's own seeding replaces them once published)"}. The better seed hosts; in Round One it hosts games 1 and 3. Kickoff times are Eastern.</p></div>
    <div class="po-bracket">${conf("East")}${conf("West")}</div>${cup}
  </div></section>`;
}

/* ---------------- the matches ---------------- */
function nextMatches(P, k){
  const M = byId(P), up = (P.next || []).map(id => M[id]).filter(Boolean).slice(0, k || 8);
  if(!up.length) return "";
  const byDay = {}; up.forEach(m => { const d = m.time_confirmed ? PP.kick(m.kickoff_utc).day : "Date to be confirmed"; (byDay[d] = byDay[d] || []).push(m); });
  return Object.entries(byDay).map(([d, arr]) => `<div class="fx-day">${d}</div>${arr.map(m => PP.poUpRow(m, P)).join("")}`).join("");
}
function results(P){
  const done = (P.matches || []).filter(m => m.status === "final" || m.status === "final_pending").slice().reverse();
  if(!done.length) return "";
  return `<section class="band" id="po-results" aria-labelledby="por-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="por-h">Results</h2><p>Every playoff match so far, latest first, with the forecast written down before kickoff.</p></div>
    <div class="fixtures">${done.map(m => PP.poPastRow(m, P)).join("")}</div></div></section>`;
}
PP.poRecordLine = P => { const R = P.record || {}, T = R.ties || {}, H = R.higher_seed || {};
  const lead = "Every playoff forecast on this site is written down before kickoff, never changed, and kept apart from the regular-season record.";
  const dl = ` <a href="data/forecast_log_playoffs.csv">Download the playoff record</a>.`;
  const bench = H.n_ties ? ` The benchmark is the higher seed's record: it went through in ${Math.round(H.rate * 100)}% of ${H.n_ties} playoff ties in 2013–25.` : "";
  if(!T.n) return `${lead} No tie has been decided yet.${bench}${dl}`;
  return `${lead} ${T.n} tie${T.n === 1 ? " has" : "s have"} been decided: the forecasts' favourite went through in ${T.favourite_through}, and their own chances said about ${Math.round(T.favourite_expected)}; the higher seed went through in ${T.higher_seed_through}.${bench} Too few to judge the forecasts yet.${dl}`;
};
/* 188 (owner, 2026-10-29): the same forecasts run back over past playoffs, in counts and words only */
const btLine = P => { const B = (P.record || {}).backtest;
  return B ? `<p>Run back over the ${esc(String(B.window).replace("-", "–"))} playoffs, forecasts made the same way picked the side that went through in ${B.favourite_through} of ${B.n_ties} ties; backing the higher seed every time picked ${B.higher_seed_through}. The forecasts did ${esc(B.words)}.</p>` : ""; };
function method(P){
  const F = (P.format || []).map(f => `<li><b>${RL[f.round]}</b>, ${esc(f.dates)}: ${esc(f.rule)}.</li>`).join("");
  return `<section class="band" id="po-method" aria-labelledby="pom-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="pom-h">How the playoff forecast works</h2></div>
    <div class="r-note" style="font-size:var(--t-15);display:grid;gap:var(--s-3);max-width:68ch">
      <p>Every playoff match still to come is played out from the same team-strength rating as the rest of the site, built half on results and half on chances (expected goals), with home advantage for the host. Once a match's team sheets are out, its forecast uses them, through the same lineup model as the regular season, and so does the bracket's chance for that match. Every result so far is fixed, a Round One series from its current score, and the rest of the bracket is played out ${PP.int(P.sims || 20000)} times.</p>
      <ul class="po-format">${F}</ul>
      <p>A level match after 90 minutes: in the wild card and Round One it goes straight to penalties; from the conference semifinals it goes to 30 minutes of extra time, played at a third of each side's usual scoring rate, then penalties. The forecast treats a shoot-out as a coin toss.</p>
      <p>${PP.poRecordLine(P)} Playoff forecasts are graded apart from the regular season: on the score after 90 minutes, against how often home sides, draws and away sides won playoff matches in 2013–25, and on who went through, once per tie, against the higher seed's record over the same years.</p>
      ${btLine(P)}
      <p class="r-small">Player ratings and every other page stay regular season only.</p>
    </div></div></section>`;
}

/* ---------------- the page ---------------- */
PP.poPage = (main, P) => {
  const A = alive(P), f = fav(P), done = P.phase === "complete";
  const runner = done ? (() => { const c = (P.matches || []).find(m => m.round === "cup"); return c ? (c.winner === c.home ? c.away : c.home) : null; })() : null;
  const cupM = (P.matches || []).find(m => m.round === "cup" && m.status === "final");
  const stand = done && P.champion ? `${esc(full(P.champion))} won MLS Cup${runner && cupM ? `, beating ${esc(short(runner))} ${scoreText(cupM.winner === cupM.home ? cupM : {...cupM, g_home: cupM.g_away, g_away: cupM.g_home, pen_home: cupM.pen_away, pen_away: cupM.pen_home})}` : ""}.`
    : P.phase === "set" ? `The regular season is over and ${PP.WORDS[A.length] || A.length} clubs are in. ${f ? `${esc(short(f.team))} are the most likely champions, at ${pct(f.p_champion)}.` : ""}`
    : `${cap(PP.WORDS[A.length] || String(A.length))} clubs are still in. ${f ? `${esc(short(f.team))} are the most likely champions, at ${pct(f.p_champion)}.` : ""}`;
  const d = new Date(P.as_of + "T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",timeZone:"UTC"});
  const nx = (P.next || []).map(id => byId(P)[id]).filter(Boolean)[0];
  const dl = `Forecast of ${d}; ${P.played ? `playoff results through ${PP.dateLong(P.results_through)}` : "no playoff match played yet"}.${nx ? ` Next: ${gameName(nx).toLowerCase().replace(/^round one/, "Round One").replace(/^mls cup/, "MLS Cup")}, ${esc(short(nx.home))} v ${esc(short(nx.away))}${nx.time_confirmed ? `, ${PP.kick(nx.kickoff_utc).day}` : ""}.` : P.phase === "set" ? " The playoffs start with the wild card on 18 November; MLS Cup is on 18 December." : ""}`;
  const nm = nextMatches(P, 8);
  const fin = P.race_final ? `<p class="dateline"><a href="#race-final">The final regular-season table, and the odds as they stood on ${new Date(P.race_final + "T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",timeZone:"UTC"})}</a></p>` : "";
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">${done ? "MLS Cup 2026" : "The playoffs"}</h1>
      <p class="r-note standfirst">${stand}</p><p class="dateline">${dl}</p>${fin}</section></div>
    ${done ? "" : chances(P)}${done ? "" : history(P)}
    ${nm ? `<section class="band" id="po-next" aria-labelledby="pon-h"><div class="wrap"><div class="band-head"><h2 class="r-title" id="pon-h">Next matches</h2><p>Win, draw and defeat chances after 90 minutes, and each side's chance of going through. Kickoff times are Eastern.</p></div><div class="fixtures">${nm}</div></div></section>` : ""}
    ${bracket(P)}${results(P)}${method(P)}`;
  ["#po-chances", "#po-bracket", "#po-next", "#po-results"].forEach(q => $$(q).forEach(PP.bindTips));
  $$(".po-hist").forEach(el => PP.chart(el, drawHistory));
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- the front page ---------------- */
PP.poHomeBand = P => {
  if(!P || P.phase === "regular") return "";
  const A = alive(P).slice().sort((a,b) => (b.p_champion||0) - (a.p_champion||0)), top = A.slice(0, 8), mx = Math.max(0.01, ...top.map(t => t.p_champion || 0));
  const bars = P.phase === "complete" ? `<p class="r-note">${esc(full(P.champion))} won MLS Cup.</p>`
    : `<div class="funnel titlef">${top.map(t => `<div class="fn" data-tip="<b>${esc(full(t.team))}</b><br>Win MLS Cup: ${pct(t.p_champion)}<br>Reach the final: ${pct(t.p_cup_final)}"><a href="#team-${PP.slug(t.team)}" class="club">${chip(t.team)}${esc(short(t.team))}</a><span class="tr"><i style="width:${Math.max(0.5,(t.p_champion||0)/mx*100)}%"></i></span><span class="num">${pct(t.p_champion)}</span></div>`).join("")}</div>`;
  const nm = nextMatches(P, 4);
  return `<section class="band well" id="po-home" aria-labelledby="poh-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="poh-h">${P.phase === "complete" ? "MLS Cup 2026" : "The playoffs"}</h2><p>${P.phase === "complete" ? "" : `${cap(PP.WORDS[A.length] || String(A.length))} clubs ${P.phase === "set" ? "are in" : "are still in"}. Chance of winning MLS Cup, with every playoff result so far fixed.`}</p></div>
    ${bars}
    ${nm ? `<h3 class="r-heading" style="margin-top:var(--s-6)">Next</h3><div class="fixtures">${nm}</div>` : ""}
    <div style="margin-top:var(--s-4)"><a href="#race" class="btn-text">The full playoff forecast</a></div>
  </div></section>`;
};
/* the rail card's headline and text */
PP.poRail = P => {
  if(!P || P.phase === "regular") return null;
  const A = alive(P), f = fav(P), M = byId(P);
  const last = (P.matches || []).filter(m => m.status === "final").slice(-1)[0];
  if(P.phase === "complete") return {head: `${esc(short(P.champion))} won MLS Cup`, body: last ? `${resultSentence(last)}.` : ""};
  const nx = (P.next || []).map(id => M[id]).filter(Boolean)[0];
  return {head: f ? `<a href="#race">${esc(short(f.team))}</a> are favourites for MLS Cup, at ${pct(f.p_champion)}` : "The playoffs",
          body: `${cap(PP.WORDS[A.length] || String(A.length))} clubs ${P.phase === "set" ? "are in" : "are still in"}.${last ? ` Last result: ${resultSentence(last)}.` : ""}${nx ? ` Next: ${esc(short(nx.home))} v ${esc(short(nx.away))}${nx.time_confirmed ? `, ${PP.kick(nx.kickoff_utc).day}` : ""}.` : ""}`};
};
/* the lead story's MLS Cup line, from the playoff chances once the regular season is over */
PP.poCupLine = (P, t) => {
  const x = team(P, t); if(!P || P.phase === "regular") return null;
  if(!x.team) return `${esc(short(t))} did not reach the playoffs.`;
  if(x.status === "champion") return `${esc(short(t))} won MLS Cup.`;
  if(x.status === "out") return `${esc(short(t))} are out of the playoffs (${rlow(x.out_in)}).`;
  const order = alive(P).slice().sort((a,b) => (b.p_champion||0) - (a.p_champion||0)), i = order.findIndex(y => y.team === t);
  return i === 0 ? `The playoff forecast, which weighs results and chances equally, makes ${esc(short(t))} favourites for MLS Cup (${pct(x.p_champion)}).`
    : `The playoff forecast, which weighs results and chances equally, gives ${esc(short(t))} a ${pct(x.p_champion)} chance of MLS Cup, ${PP.ordWord(i + 1)} behind ${esc(short(order[0].team))} (${pct(order[0].p_champion)}).`;
};

/* ---------------- the Matches page: one strip button per playoff stage ---------------- */
const STAGES = [["wild_card", m => m.round === "wild_card", "WC", "Wild card"], ["r1g1", m => m.round === "round_one" && m.game === 1, "R1·1", "Round One, game 1"],
  ["r1g2", m => m.round === "round_one" && m.game === 2, "R1·2", "Round One, game 2"], ["r1g3", m => m.round === "round_one" && m.game === 3, "R1·3", "Round One, game 3"],
  ["conf_semi", m => m.round === "conf_semi", "Semis", "Conference semifinals"], ["conf_final", m => m.round === "conf_final", "Finals", "Conference finals"],
  ["cup", m => m.round === "cup", "Cup", "MLS Cup"]];
PP.poSlates = P => !P || P.phase === "regular" ? [] : STAGES.map(([k, f, s, l]) => {
  const ms = (P.matches || []).filter(f); if(!ms.length) return null;
  const ds = ms.map(m => m.kickoff_utc).sort();
  return {key: "po-" + k, n: null, playoff: true, short: s, label: l, kind: "Playoffs", resched: [],
          first: new Date(ds[0].replace("Z", ":00Z")).toLocaleDateString("en-CA", {timeZone: "America/New_York"}),
          last: new Date(ds[ds.length-1].replace("Z", ":00Z")).toLocaleDateString("en-CA", {timeZone: "America/New_York"}),
          // the shape the strip's state and default-slate logic read: played / upcoming
          matches: ms.map(m => ({...m, po: m, status: m.status === "final" ? "played" : "upcoming"}))};
}).filter(Boolean);
PP.poSlateView = (w, P) => {
  const ms = w.matches.map(x => x.po), up = ms.filter(m => m.status !== "final" && m.status !== "final_pending"), done = ms.filter(m => m.status === "final" || m.status === "final_pending");
  const byDay = {}; up.forEach(m => { const d = m.time_confirmed ? PP.kick(m.kickoff_utc).day : "Date to be confirmed"; (byDay[d] = byDay[d] || []).push(m); });
  return `<section class="band" style="padding-top:0"><div class="band-head"><p>${PP.poRecordLine(P)}</p></div>
    <div class="fixtures">${Object.entries(byDay).map(([d, arr]) => `<div class="fx-day">${d}</div>${arr.map(m => PP.poUpRow(m, P)).join("")}`).join("")}
    ${done.length ? `<div class="fx-day">Results</div>${done.map(m => PP.poPastRow(m, P)).join("")}` : ""}</div></section>`;
};
PP.poClubRows = (P, t) => {
  if(!P || P.phase === "regular") return "";
  const ms = (P.matches || []).filter(m => m.home === t || m.away === t); if(!ms.length) return "";
  return `<section class="band" style="padding-top:0"><div class="band-head"><h2 class="r-title">Playoffs</h2></div><div class="fixtures">${ms.map(m => m.status === "final" || m.status === "final_pending" ? PP.poPastRow(m, P) : PP.poUpRow(m, P)).join("")}</div></section>`;
};
})();
