/* Pitch Perception: Today ("What the model sees"). Every sentence is generated from data/home.json. */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, pp, pctile, money, short, full, chip, clubTag, tok} = PP;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const surname = n => { const p = String(n).split(" "); return p.length > 1 ? p.slice(1).join(" ") : n; };
const STAKE = (s, conf) => ({"top 7":"a top-seven finish","playoffs":"the playoffs","1st in conference":`first place in the ${conf}`,"Supporters' Shield":"the Supporters' Shield","MLS Cup":"MLS Cup"}[s] || s);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

PP.pages.today = main => {
  const H = PP.data.home;
  const race = H.race, teams = race.teams, byTeam = Object.fromEntries(teams.map(t => [t.team, t]));
  PP.byTeam = byTeam;
  main.innerHTML = `
  <div class="wrap">
    <header class="edition">
      <h1 class="r-name">What the model sees</h1>
      <p class="r-note standfirst">Pitch Perception applies a possession-value model, a well-established approach in football analytics, to every MLS action: each one is valued by how much it changes the chance that a possession ends in a goal, and those changes are added up for every player and team. This is what that showed this week. <a href="#method-origins" class="r-small" style="font-family:inherit">Where the method comes from</a></p>
      <p class="dateline">${dateline(H)}</p>
    </header>
    <div class="front">
      <div class="front-main">${leadBlock(H)}${H.season_over ? "" : placesLead(H)}</div>
      <div class="rail">${[H.season_over ? `<div id="ins-po"></div>` : insRace(H), insContract(H)].join("")}</div>
    </div>
  </div>
  ${H.chain ? chainBand(H) : ""}
  <section class="band" id="wkteaser" aria-labelledby="wkt-h" hidden></section>
  ${H.season_over ? `<section class="band well" id="po-home" hidden></section>` : raceBand(H)}
  ${moversBand(H)}
  ${nextBand(H)}
  ${leadersBand(H)}`;
  PP.bindDisclosures(main);
  PP.chart($("#scatter"), drawScatter);
  PP.chart($("#bridge"), drawBridge);
  PP.chart($("#rcpace"), drawPace);
  PP.chart($("#spark"), drawSpark);
  PP.chart($("#payvalue"), drawPayValue);
  $$(".mv-glyph").forEach(el => PP.chart(el, drawMover));
  $$(".race-chart").forEach(el => PP.chart(el, drawRace));
  if(H.chain){ PP.chart($("#pitch"), drawPitch); PP.chart($("#steps"), drawSteps); }
  ["#scatter","#bridge","#spark","#payvalue","#pitch","#steps","#lboard",".rail","#movers-band","#places"].forEach(s => $$(s).forEach(PP.bindTips));
  if(H.chain) bindChain();
  bindRaceTools();
  weekTeaser();
  if(H.season_over) playoffBits(H);
};

/* ---------------- the playoffs (owner, 2026-10-27; playoffs.js): once the regular season is over the playoff race band,
   its rail card and the lead's MLS Cup line come from data/playoffs.json, which the matchday refresh keeps current ---------------- */
async function playoffBits(H){
  const P = await PP.loadPlayoffs(); if(!P || P.phase === "regular" || (location.hash.replace("#","") && location.hash !== "#today")) return;
  const band = $("#po-home"); if(band){ band.outerHTML = PP.poHomeBand(P); PP.bindTips($("#po-home")); }
  const rail = PP.poRail(P), slot = $("#ins-po");
  if(rail && slot) slot.outerHTML = ins("ins-race", P.phase === "complete" ? "MLS Cup" : "Playoffs", rail.head, rail.body, "",
    `<p class="r-small">${PP.poRecordLine(P)}</p>`);
  PP.bindDisclosures($("#ins-race"));
  const cl = $("#cupline"), line = PP.poCupLine(P, PP.leadTeam || H.outperformer.team); if(cl && line) cl.innerHTML = line;   // the lead's club (record chase or results vs chances)
}

/* ---------------- the matchday in review, teaser (82 / weeks.js; per matchday since 2026-10-15) ---------------- */
async function weekTeaser(){
  const I = await PP.loadRounds(); if(!I || !I.matchdays.length) return;
  const wk = PP.latestRound(I); let W; try { [W] = await Promise.all([PP.loadRound(wk.md), PP.loadArch()]); } catch(e){ return; }
  const el = $("#wkteaser"); if(!el || location.hash.replace("#","") && location.hash !== "#today") return;
  const P = (W.players || []).slice(0, 5), top = P[0];
  el.innerHTML = `<div class="wrap"><div class="band-head"><span class="kicker">The matchday in review</span><h2 class="r-title" id="wkt-h">${top ? `${PP.plink(top[0], top[1])} was the player of Matchday ${wk.md}` : "The matchday in review"}</h2>
      <p>Matchday ${wk.md}, ${esc(PP.weekRange(wk))}. ${top ? `${PP.plink(top[0], surname(top[1]))} added ${sgn(top[6],2)} goals above replacement for ${esc(short(top[2]))}, the most in MLS. ` : ""}<a href="#matchday-${wk.md}">The full matchday: team of the matchday, awards and every match report</a>.</p></div>
    <div class="wkteaser"><div class="wklist">${P.map((p,k) => `<a class="wkrow" href="#player-${p[0]}"><span class="rk">${k+1}</span><span class="nm">${esc(p[1])}${PP.badgeMini(PP.badgesFor(p[0], 2026, p[2]))}</span><span class="meta">${chip(p[2])}${esc(short(p[2]))}</span><span class="tr"><i style="width:${Math.max(2, Math.abs(p[6])/Math.abs(P[0][6]||1)*100)}%;background:var(--turf)"></i></span><span class="v num">${sgn(p[6],2)}</span></a>`).join("")}</div>
      <figure style="margin:0"><div class="fig-cap"><span class="r-label">Team of the matchday</span><span class="r-small">${esc(W.formation || "4-3-3")}; hover a player</span></div><div class="chart" id="hometotw"></div></figure></div></div>`;
  el.hidden = false;
  PP.chart($("#hometotw"), e => PP.drawEleven(e, W.xi || [], {maxV: 1, maxW: 640, tip: p => `<b>${esc(p.player)}</b>, ${esc(short(p.team))}<br>${p.keeper ? `${sgn(p.value,2)} goals prevented` : `${sgn(p.value,2)} goals above replacement`}`}));
  PP.bindTips($("#hometotw"));
}

/* ---------------- edition line ---------------- */
function dateline(H){
  const d = new Date(H.as_of + "T12:00:00Z").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).replace(",", "");
  if(H.season_over) return `${d}. The regular season is over: all ${H.played} matches played, results through ${PP.dateLong(H.data_through)}. The playoffs run from 18 November to MLS Cup on 18 December.`;
  const nxt = upcoming(H)[0], k = nxt && nxt.kickoff_utc ? PP.kick(nxt.kickoff_utc) : null;
  return `${d}. ${H.played} of ${H.played + H.remaining} regular-season matches played, results through ${PP.dateLong(H.data_through)}.` +
    (nxt && k ? ` Next: ${esc(short(nxt.home))} v ${esc(short(nxt.away))}, ${k.day}, ${k.time}.` : "");
}
const upcoming = H => H.next.filter(m => m.kickoff_utc && new Date(m.kickoff_utc.replace("Z",":00Z")) > new Date(Date.now() - 2*3600e3));

/* ---------------- lead: results vs chances ---------------- */
function lead(H){
  const o = H.outperformer, t = PP.byTeam[o.team], k = o.keeper;
  const sorted = H.race.teams.slice().sort((a,b) => b.points - a.points);
  const first = sorted[0].team === o.team, gap = first ? sorted[0].points - sorted[1].points : null;
  const head = first
    ? `${esc(short(o.team))} lead MLS by ${gap} points. On the chances they create and allow, they rank ${PP.ordWord(o.xgd_rank)}.`
    : `${esc(short(o.team))} are ${PP.ordWord(o.pts_rank)} on points. On the chances they create and allow, they rank ${PP.ordWord(o.xgd_rank)}.`;
  const note = `They have scored ${Math.round(o.gf)} goals from chances worth ${o.xgf.toFixed(1)} and conceded ${Math.round(o.ga)} from chances worth ${o.xga.toFixed(1)}: a goal difference of ${sgn(o.gd,0)} where the chances added up to ${sgn(o.xgd,1)}. Keeper ${PP.plink(k.ws_player_id, k.player)} accounts for ${k.goals_prevented.toFixed(1)} of the goals saved (range ${num(k.lo,1)} to ${num(k.hi,1)}).`;
  // the cup line reads the actual order (owner, 2026-10-09: it called this team favourites when it was second)
  const cup = H.race.teams.slice().sort((a,b) => b.p_champion - a.p_champion), cr = cup.findIndex(x => x.team === o.team);
  const cupLine = cr === 0
    ? `The playoff forecast, which weighs results and chances equally, makes ${esc(short(o.team))} favourites for MLS Cup (${pct(t.p_champion)}).`
    : `The playoff forecast, which weighs results and chances equally, gives ${esc(short(o.team))} a ${pct(t.p_champion)} chance of MLS Cup, ${PP.ordWord(cr + 1)} behind ${esc(short(cup[0].team))} (${pct(cup[0].p_champion)}).`;
  // the record chase (owner, 2026-10-15), while it is live: only for the points leader, between 2% and 98%, or once broken
  const rc = H.record_chase, N = n => PP.WORDS[n] || String(n);
  const recLine = !(rc && first && rc.team === o.team) ? "" : rc.points > rc.record
    ? `${esc(short(o.team))} have broken the league record of ${rc.record} points (${esc(short(rc.holder))}, ${rc.holder_season}). `
    : rc.p_break >= 0.02 && rc.p_break <= 0.98
      ? `The model gives them a ${pct(rc.p_break)} chance of breaking the league record of ${rc.record} points (${esc(short(rc.holder))}, ${rc.holder_season}): they need ${N(rc.need)} points from their last ${N(rc.left)} matches. `
      : "";
  const note2 = `${recLine}<span id="cupline">${cupLine}</span> Finishing and shot-stopping are the least repeatable parts of the game in our tests: year-to-year correlations of about 0.05 and 0.18.`;
  return `<article class="lead" aria-labelledby="lead-h">
    <span class="kicker">Results against chances</span>
    <h2 id="lead-h">${head}</h2>
    <p class="r-note">${note}</p>
    <p class="r-note" style="color:var(--ink-2)">${note2}</p>
    <div class="lead-figs">
      <figure style="margin:0"><div class="fig-cap"><span class="r-label">Points per match against expected-goal difference per match, 2026</span></div><div class="chart" id="scatter"></div></figure>
      <figure style="margin:0"><div class="fig-cap"><span class="r-label">How ${esc(short(o.team))}'s ${sgn(o.gd,0)} goal difference was built</span></div><div class="chart" id="bridge"></div></figure>
    </div>
    <div><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="why-lead" id="why-lead-btn">How this is measured</button>
    <div class="disc" id="why-lead" aria-hidden="true"><div><div class="why-body">
      <p class="r-small" style="font-size:var(--t-13);color:var(--ink-2);max-width:64ch">Expected goals come from a shot model fitted to MLS for this site: each shot is worth the share of similar shots that were scored. Goals prevented compare the goals a keeper conceded with the post-shot expected goals of the shots they faced, centred so an average keeper is zero. The dashed line on the chart is the league-wide fit of points on expected-goal difference; a team's height above it is points the chances alone would not explain.</p>
    </div></div></div></div>
  </article>`;
}

/* ---------------- lead: the points record (owner, 2026-10-27: the Today page's headline while the chase is live) ----------------
   The rule is the record sentence's (2026-10-15): the points leader, while the chance of breaking the league record is between
   2% and 98%, or once it is broken; plus a leader that finished level with it. Otherwise the results-against-chances lead. */
const recordLive = rc => !!(rc && rc.pace && rc.pace.length) &&
  (rc.points > rc.record || (rc.points === rc.record && !rc.left) || (rc.p_break >= 0.02 && rc.p_break <= 0.98));
function leadBlock(H){
  const live = recordLive(H.record_chase);
  PP.leadTeam = live ? H.record_chase.team : H.outperformer.team;
  return live ? recordLead(H) : lead(H);
}
const cupLineFor = (H, team) => {
  const t = PP.byTeam[team] || {}, cup = H.race.teams.slice().sort((a,b) => b.p_champion - a.p_champion), cr = cup.findIndex(x => x.team === team);
  return cr === 0 ? `The playoff forecast, which weighs results and chances equally, makes ${esc(short(team))} favourites for MLS Cup (${pct(t.p_champion)}).`
    : `The playoff forecast, which weighs results and chances equally, gives ${esc(short(team))} a ${pct(t.p_champion)} chance of MLS Cup, ${PP.ordWord(cr + 1)} behind ${esc(short(cup[0].team))} (${pct(cup[0].p_champion)}).`;
};
const NW = n => PP.WORDS[n] || String(n);
const nMatches = n => `${NW(n)} ${n === 1 ? "match" : "matches"}`, nPoints = n => `${NW(n)} ${n === 1 ? "point" : "points"}`;
/* the fewest results that reach `need` points from `left` matches (each one needed: one result worse falls short), in words */
function waysTo(left, need, exact){
  const say = (w, d) => [w ? (w === 1 ? "a win" : `${NW(w)} wins`) : "", d ? (d === 1 ? "a draw" : `${NW(d)} draws`) : ""].filter(Boolean).join(" and ") || `${NW(left)} defeats`;
  const out = [];
  for(let w = left; w >= 0; w--) for(let d = left - w; d >= 0; d--){
    const p = 3*w + d;
    if(exact ? p === need : p >= need && (!w || p - 2 < need) && (!d || p - 1 < need)) out.push(say(w, d));
  }
  return out.join(", or ");
}
function recordLead(H){
  const rc = H.record_chase, team = rc.team, T = esc(short(team)), b = rc.best_at_stage, yr = H.season;
  const holder = `${esc(short(rc.holder))} in ${rc.holder_season}`, broke = rc.points > rc.record, level = rc.points === rc.record;
  const head = broke ? (rc.left ? `${T} have broken the league points record` : `${T} finished with ${rc.points} points, a league record`)
    : level ? (rc.left ? `${T} have equalled the league points record` : `${T} finished level with the league points record`)
    : `${T} need ${nPoints(rc.need)} from their last ${nMatches(rc.left)} to break the league points record`;
  const isRecord = b && b.team === rc.holder && b.season === rc.holder_season && b.points === rc.record;
  const stage = !b || isRecord ? "" : rc.points > b.points ? `, the most any team has had after ${rc.played} matches since 2013 (the previous best: ${esc(short(b.team))}, ${b.points} in ${b.season})`
    : rc.points === b.points ? `, level with the most any team has had after ${rc.played} matches since 2013 (${esc(short(b.team))}, ${b.season})`
    : `; ${esc(short(b.team))} had ${b.points} after ${rc.played} matches in ${b.season}`;
  const chase = broke ? `The previous record was ${rc.record}, set by ${holder}.${rc.left ? ` They have ${nMatches(rc.left)} left.` : ""}`
    : level ? `The record is ${rc.record}, set by ${holder}.${rc.left ? ` One more point from their last ${nMatches(rc.left)} breaks it; the forecast gives them a ${pct(rc.p_break)} chance.` : ""}`
    : `The record is ${rc.record}, set by ${holder}. ${cap(NW(rc.need))} more ${rc.need === 1 ? "point" : "points"} would break it and ${NW(rc.need - 1)} would equal it; the forecast gives them a ${pct(rc.p_break)} chance of breaking it and ${pct(rc.p_tie_or_break)} of at least equalling it.`;
  const day = iso => new Date(iso.replace("Z",":00Z")).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"America/New_York"}).replace(",", "");
  const fx = rc.fixtures.map(f => {
    const opp = f.at_home ? f.away : f.home, k = f.kickoff_utc ? PP.kick(f.kickoff_utc) : null, kit = PP.pairKit(f.home, f.away), [cW, cL] = f.at_home ? kit : [kit[1], kit[0]];
    return `<a class="rc-row" href="#match-${f.ws_match_id}">
      <span class="rc-when"><b>${f.kickoff_utc ? day(f.kickoff_utc) : PP.dateLong(f.date)}</b>${k ? `<span>${k.time}</span>` : ""}</span>
      <span class="rc-opp">${f.at_home ? "v" : "at"} ${clubTag(opp)}</span>
      <span class="probs"><span class="pbar" role="img" aria-label="${T} win ${pct(f.p_win)}, draw ${pct(f.p_draw)}, defeat ${pct(f.p_loss)}"><i style="width:${f.p_win*100}%;background:${cW}"></i><i style="width:${f.p_draw*100}%;background:var(--mid)"></i><i style="width:${f.p_loss*100}%;background:${cL}"></i></span>
        <span class="plab"><span><b>${pctShort(f.p_win)}</b> win</span><span>${pctShort(f.p_draw)} draw</span><span><b>${pctShort(f.p_loss)}</b> defeat</span></span></span></a>`;
  }).join("");
  const pLevel = Math.max(0, rc.p_tie_or_break - rc.p_break), pShort = Math.max(0, 1 - rc.p_tie_or_break);
  const rows = broke || !rc.left ? [] : level
    ? [[`1 or more`, `${rc.record + 1} or more`, "Broken", rc.p_break, waysTo(rc.left, 1)], [`0`, `${rc.record}`, "Equalled", pLevel, `${NW(rc.left)} defeats`]]
    : [[`${rc.need} or more`, `${rc.record + 1} or more`, "Broken", rc.p_break, waysTo(rc.left, rc.need)],
       [`${rc.need - 1}`, `${rc.record}`, "Equalled", pLevel, waysTo(rc.left, rc.need - 1, true)],
       ...(rc.need >= 2 ? [[rc.need - 2 ? `${rc.need - 2} or fewer` : "0", `${rc.record - 1} or fewer`, "Short", pShort, ""]] : [])];
  const table = rows.length ? `<table class="mini-table rc-table"><thead><tr><th>${rc.left === 1 ? "Points from the last match" : `Points from the last ${NW(rc.left)}`}</th><th class="n">Final total</th><th>Record</th><th class="n">Chance</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r[0]}${r[4] ? `<span class="r-small rc-ways">${esc(cap(r[4]))}</span>` : ""}</td><td class="n">${r[1]}</td><td>${r[2]}</td><td class="n">${pct(r[3])}</td></tr>`).join("")}</tbody></table>` : "";
  const dash = s => s.role === "record" ? "" : s.role === "next" && s === rc.seasons.filter(x => x.role !== "record")[1] ? " dash" : "";
  const sw = (c, w, d) => `<i class="lg-line" style="background:none;height:0;border-top:${w}px ${d ? "dashed" : "solid"} ${c}"></i>`;
  const legend = `<div class="legend rc-legend"><span>${sw(PP.kit(team), 3)}${T} ${yr}</span>${rc.seasons.map(s =>
    `<span>${sw(s.role === "record" ? "var(--ink)" : "var(--ink-3)", 2, dash(s))}${esc(short(s.team))} ${s.season}${s.role === "record" ? " (record)" : ""}</span>`).join("")}</div>`;
  return `<article class="lead" aria-labelledby="lead-h">
    <span class="kicker">The points record</span>
    <h2 id="lead-h">${head}</h2>
    <p class="r-note">${T} have ${rc.points} points from ${rc.played} matches${stage}. ${chase}</p>
    <p class="r-note" style="color:var(--ink-2)"><span id="cupline">${cupLineFor(H, team)}</span></p>
    <div class="lead-figs rc-figs">
      <figure style="margin:0"><div class="fig-cap"><span class="r-label">Points after each match: ${T} ${yr} and the highest totals since 2013</span><span class="r-small">From match ${Math.max(1, rc.played - 16)}; shaded: ${T}'s likely finish (the middle 80%)</span></div>${legend}<div class="chart" id="rcpace"></div></figure>
      ${rc.left ? `<figure style="margin:0"><div class="fig-cap"><span class="r-label">${rc.left === 1 ? "The last match" : `The last ${nMatches(rc.left)}`}: ${T}'s chances</span><span class="r-small">Kickoff times are Eastern</span></div><div class="rc-fx">${fx}</div>${table}</figure>` : ""}
    </div>
    <div><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="why-lead" id="why-lead-btn">How this is measured</button>
    <div class="disc" id="why-lead" aria-hidden="true"><div><div class="why-body">
      <p class="r-small" style="font-size:var(--t-13);color:var(--ink-2);max-width:64ch">Points come from every regular-season result since 2013, three for a win and one for a draw. The chance of the record combines the forecast's win, draw and defeat chances for each match left over every combination of results, worked out exactly rather than simulated${rc.left ? `; the range drawn after the last match holds the middle 80% of those combinations (${rc.q10} to ${rc.q90} points)` : ""}. The forecast is the same one shown on each match page.</p>
    </div></div></div></div>
  </article>`;
}

function drawPace(el){
  const H = PP.data.home, rc = H.record_chase, W = el.clientWidth; if(!W || !rc) return;
  const narrow = W < 560, Ht = narrow ? 280 : 320; el.innerHTML = "";
  const kit = PP.kit(rc.team), others = rc.seasons, second = others.filter(s => s.role !== "record")[1];
  const L = Math.max(rc.played + rc.left, ...others.map(s => s.pts.length));
  // the second half of the season: the chase is decided there; the hover reads any match
  const X0 = Math.max(1, Math.min(rc.played, L) - 16);
  const at = (pts, i) => pts[Math.min(i, pts.length) - 1];
  const lo = Math.min(...others.map(s => at(s.pts, X0)), at(rc.pace, X0)), top = Math.max(rc.record, rc.q90 || 0, rc.points, ...others.map(s => s.pts[s.pts.length - 1]));
  const y0 = Math.max(0, Math.floor((lo - 3) / 10) * 10), y1 = Math.ceil((top + 3) / 10) * 10;
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":`Points after each match from match ${X0}: ${full(rc.team)} ${H.season} and the highest totals since 2013`},el);
  const m = {l:30, r:narrow ? 66 : 138, t:12, b:30}, iw = W - m.l - m.r, ih = Ht - m.t - m.b;
  const sx = i => m.l + (i - X0) / (L - X0) * iw, sy = v => m.t + ih - (v - y0) / (y1 - y0) * ih;
  for(let v = y0; v <= y1; v += 10){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===y0?"g-base":"g-line"},svg); text(svg, m.l-6, sy(v)+4, v, "t-axis", {"text-anchor":"end"}); }
  const ticks = []; for(let i = Math.ceil(X0 / 5) * 5; i < L - 1; i += 5) ticks.push(i);
  [X0, ...ticks.filter(i => i - X0 >= 3), L].forEach(i => text(svg, sx(i), Ht - 12, i, "t-axis", {"text-anchor":"middle"}));
  S("line",{x1:m.l,x2:m.l+iw,y1:sy(rc.record),y2:sy(rc.record),stroke:"var(--ink-2)","stroke-width":1,"stroke-dasharray":"4 4"},svg);
  text(svg, m.l + 6, sy(rc.record) - 6, `Record: ${rc.record}`, "t-lab2 halo", {});
  const path = pts => pts.map((v,i) => [i + 1, v]).filter(([i]) => i >= X0).map(([i,v], k) => (k ? "L" : "M") + sx(i) + "," + sy(v)).join("");
  if(rc.left){   // where the leader can end up: from today's total to the middle 80% of final totals, through the expected one
    const xe = sx(rc.played + rc.left), xn = sx(rc.played), yn = sy(rc.points);
    S("path",{d:`M${xn},${yn}L${xe},${sy(rc.q90)}L${xe},${sy(rc.q10)}Z`,fill:kit,"fill-opacity":0.16,stroke:"none"},svg);
    S("line",{x1:xn,y1:yn,x2:xe,y2:sy(rc.exp_final),stroke:kit,"stroke-width":1.5,"stroke-dasharray":"3 3"},svg);
  }
  others.slice().reverse().forEach(s => S("path",{d:path(s.pts),fill:"none",stroke:s.role === "record" ? "var(--ink)" : "var(--ink-3)","stroke-width":s.role === "record" ? 1.75 : 1.25,
    "stroke-dasharray":s === second ? "5 3" : null,"stroke-linejoin":"round"},svg));
  S("path",{d:path(rc.pace),fill:"none",stroke:kit,"stroke-width":3,"stroke-linejoin":"round","stroke-linecap":"round"},svg);
  S("circle",{cx:sx(rc.played),cy:sy(rc.points),r:4.5,fill:kit,stroke:"var(--paper)","stroke-width":2},svg);
  const below = sy(rc.points) - sy(rc.record) < 22;          // keep the leader's label clear of the record line
  text(svg, sx(rc.played) - 8, sy(rc.points) + (below ? 18 : -10), `${short(rc.team)} ${rc.points}`, "t-lab halo", {"text-anchor":"end"});
  // end labels: the comparison seasons' totals and the leader's likely range, kept 14px apart
  const ends = others.map(s => ({y:sy(s.pts[s.pts.length - 1]), lab:`${narrow ? (PP.CLUB[s.team] || [s.team])[0] : short(s.team)} ${narrow ? "’" + String(s.season).slice(2) : s.season} · ${s.pts[s.pts.length - 1]}`,
    cls:s.role === "record" ? "t-lab" : "t-lab2", dot:[sx(s.pts.length), sy(s.pts[s.pts.length - 1]), s.role === "record" ? "var(--ink)" : "var(--ink-3)"]}));
  if(rc.left) ends.push({y:sy(rc.exp_final), lab:narrow ? `${(PP.CLUB[rc.team] || [rc.team])[0]} ${rc.q10}–${rc.q90}` : `${short(rc.team)} ${rc.q10}–${rc.q90}`, cls:"t-lab", fill:kit});
  ends.sort((a,b) => a.y - b.y);
  for(let i = 1; i < ends.length; i++) if(ends[i].y - ends[i-1].y < 14) ends[i].y = ends[i-1].y + 14;
  const over = ends.length ? ends[ends.length - 1].y - (m.t + ih) : 0; if(over > 0) ends.forEach(e => e.y -= over);
  ends.forEach(e => { if(e.dot) S("circle",{cx:e.dot[0],cy:e.dot[1],r:2.5,fill:e.dot[2]},svg);
    const t_ = text(svg, sx(L) + 8, e.y + 4, e.lab, e.cls, {}); if(e.fill) t_.setAttribute("style", `fill:${e.fill}`); });
  // hover: every season's points after the same number of matches
  const cross = S("line",{x1:0,x2:0,y1:m.t,y2:m.t+ih,stroke:"var(--ink-3)","stroke-width":1,opacity:0},svg);
  const ov = S("rect",{x:m.l,y:m.t,width:iw,height:ih,fill:"transparent"},svg);
  const move = e => { const r = svg.getBoundingClientRect(), i = Math.max(X0, Math.min(L, Math.round((e.clientX - r.left - m.l) / iw * (L - X0)) + X0));
    cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("opacity", 1);
    const lines = [[`${full(rc.team)} ${H.season}`, rc.pace[i - 1]], ...others.map(s => [`${full(s.team)} ${s.season}`, s.pts[i - 1]])].filter(x => x[1] != null).sort((a,b) => b[1] - a[1]);
    const proj = rc.left && i > rc.played ? `<br>${esc(short(rc.team))}, likely final total ${Math.round(rc.exp_final)} (${rc.q10} to ${rc.q90})` : "";
    PP.showTip(`<b>After ${i} matches</b><br>${lines.map(x => `${esc(x[0])}: ${x[1]}`).join("<br>")}${proj}`, e.clientX, e.clientY); };
  ov.addEventListener("pointermove", move); ov.addEventListener("pointerdown", move);
  ov.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); PP.hideTip(); });
}

/* ---------------- second headline: the last playoff places (owner, 2026-10-27), until the regular season ends ----------------
   From home.json `bubble` (71): the thresholds are fixed there and stated here; "clinched" and "eliminated" only when points
   and matches left prove it, otherwise the simulation's own count. */
const pct1 = v => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
function placesLead(H){
  const B = H.bubble; if(!B) return "";
  const C = B.conferences, confs = ["East","West"].filter(c => C[c]), sims = B.sims.toLocaleString("en-US");
  const total = confs.reduce((a,c) => a + C[c].open, 0), withOpen = confs.filter(c => C[c].open);
  const head = !total ? "Every playoff place is all but settled"
    : withOpen.length === 1 ? (total === 1 ? `One playoff place is still open, in the ${withOpen[0]}` : `${cap(NW(total))} playoff places are still open, ${total === 2 ? "both" : "all"} in the ${withOpen[0]}`)
    : `${cap(NW(total))} playoff places are still open: ${confs.map(c => `${NW(C[c].open)} in the ${c}`).join(", ")}`;
  const nSim = p => Math.round(p * B.sims);
  const certain = x => nSim(x.p_playoffs) === B.sims ? `in every one of ${sims} simulations` : `in ${nSim(x.p_playoffs).toLocaleString("en-US")} of ${sims} simulations`;
  const gone = x => nSim(x.p_playoffs) === 0 ? `in none of ${sims} simulations` : `in ${nSim(x.p_playoffs).toLocaleString("en-US")} of ${sims} simulations`;
  const names = arr => arr.map(x => `<a href="#team-${PP.slug(x.team)}">${esc(short(x.team))}</a>`).join(", ");
  const group = (arr, say) => { const g = {}; arr.forEach(x => { const k = say(x); (g[k] = g[k] || []).push(`<a href="#team-${PP.slug(x.team)}">${esc(short(x.team))}</a>`); });
    return Object.entries(g).map(([k, v]) => `${v.join(", ")} (${k})`).join("; "); };
  const panel = c => {
    const v = C[c], cont = v.clubs.filter(x => x.state === "contention"), cert = v.clubs.filter(x => x.state === "certain"), out = v.clubs.filter(x => x.state === "out");
    const sub = v.open ? `${cap(NW(v.open))} ${v.open === 1 ? "place" : "places"} open, ${NW(cont.length)} ${cont.length === 1 ? "club" : "clubs"} in contention` : `No places open: ${NW(cert.length)} clubs have clinched or are all but certain`;
    const row = x => `<a class="pl-row" href="#team-${PP.slug(x.team)}"><span class="nm">${clubTag(x.team)}</span><span class="pts r-small">${x.points} pts, ${x.left} left</span>
      <span class="pbar1" aria-hidden="true"><i style="width:${Math.max(1.5, x.p_playoffs * 100)}%"></i></span><span class="v num">${pct(x.p_playoffs)}</span></a>`;
    return `<div class="pl-conf"><h3 class="r-heading">${c}ern Conference</h3><p class="r-small pl-sub">${sub}</p>
      ${cont.length ? `<div class="pl-list">${cont.map(row).join("")}</div>` : ""}
      <div class="settled">${[[cert.filter(x => x.clinched), "Clinched", null], [cert.filter(x => !x.clinched), "All but certain", certain],
        [out.filter(x => !x.eliminated), "All but out", gone], [out.filter(x => x.eliminated), "Eliminated", null]].filter(([a]) => a.length)
        .map(([a, lab, say]) => `<span><b>${lab}:</b> ${say ? group(a, say) : names(a)}</span>`).join("")}</div></div>`;
  };
  const day = iso => new Date(iso.replace("Z",":00Z")).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"America/New_York"}).replace(",", "");
  const dec = B.deciders.map(d => { const k = d.kickoff_utc ? PP.kick(d.kickoff_utc) : null;
    return `<a class="pl-dec" href="#match-${d.ws_match_id}"><span class="pl-when"><b>${k ? day(d.kickoff_utc) : PP.dateLong(d.date)}</b>${k ? ` ${k.time}` : ""}</span>
      <span class="pl-teams">${esc(short(d.home))} v ${esc(short(d.away))}</span>
      <span class="pl-stakes">${d.stakes.map(s => `<span><b>${esc(short(s.team))}</b>: ${pct(s.if_win)} with a win, ${pct(s.if_loss)} with a defeat</span>`).join("")}</span></a>`; }).join("");
  return `<article class="lead lead-2" id="places" aria-labelledby="places-h">
    <span class="kicker">The last playoff places</span>
    <h2 id="places-h">${head}</h2>
    <p class="r-note">The top ${NW(B.places)} in each conference reach the playoffs. A place counts as open until ${NW(B.places)} clubs are all but certain of one, at ${pct1(B.hi)} or more in ${sims} simulations of the rest of the season; clubs between ${pct1(B.lo)} and ${pct1(B.hi)} are in contention. Clinched and eliminated mean the points already settle it, whatever happens in the matches left.</p>
    <div class="pl-confs">${confs.map(panel).join("")}</div>
    ${dec ? `<div class="pl-decs"><h3 class="r-heading">The matches that decide it</h3><p class="r-small">The upcoming matches whose results move a contender's playoff chances most, with that chance after a win and after a defeat. Kickoff times are Eastern.</p>${dec}</div>` : ""}
    <div><a href="#race" class="btn-text">Full playoff forecast</a></div>
  </article>`;
}

function drawScatter(el){
  const H = PP.data.home, o = H.outperformer, pts = o.all, W = el.clientWidth; if(!W) return;
  const Ht = Math.round(Math.min(380, Math.max(250, W * 0.58)));
  el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":"Scatter plot of points per match against expected-goal difference per match for all 30 teams"},el);
  const m = {l:40,r:14,t:12,b:40}, iw = W-m.l-m.r, ih = Ht-m.t-m.b;
  const xs = pts.map(p => p.xgd_pg), ys = pts.map(p => p.pts_pg);
  const x0 = Math.floor((Math.min(...xs)-0.1)*4)/4, x1 = Math.ceil((Math.max(...xs)+0.1)*4)/4, y0 = Math.floor((Math.min(...ys)-0.1)*4)/4, y1 = Math.ceil((Math.max(...ys)+0.1)*4)/4;
  const sx = v => m.l + (v-x0)/(x1-x0)*iw, sy = v => m.t + ih - (v-y0)/(y1-y0)*ih;
  for(let v = Math.ceil(y0*2)/2; v <= y1+1e-9; v += 0.5){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:"g-line"},svg); text(svg, m.l-8, sy(v)+4, v.toFixed(1), "t-axis", {"text-anchor":"end"}); }
  for(let v = Math.ceil(x0*2)/2; v <= x1+1e-9; v += 0.5){ text(svg, sx(v), Ht-m.b+17, (v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(1), "t-axis", {"text-anchor":"middle"}); }
  if(x0 < 0 && x1 > 0) S("line",{x1:sx(0),x2:sx(0),y1:m.t,y2:m.t+ih,class:"g-base"},svg);
  text(svg, m.l+iw, Ht-4, "Expected-goal difference per match", "t-axis", {"text-anchor":"end"});
  // league fit
  const n = pts.length, mx = xs.reduce((a,b)=>a+b)/n, my = ys.reduce((a,b)=>a+b)/n;
  const b = xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0) / xs.reduce((s,x)=>s+(x-mx)**2,0), a = my - b*mx;
  S("line",{x1:sx(x0),y1:sy(a+b*x0),x2:sx(x1),y2:sy(a+b*x1),stroke:"var(--ink-3)","stroke-width":1.25,"stroke-dasharray":"4 4"},svg);
  const res = pts.map(p => ({...p, res: p.pts_pg - (a + b*p.xgd_pg)}));
  const label = new Set([o.team, res.slice().sort((p,q)=>q.xgd_pg-p.xgd_pg)[0].team, res.slice().sort((p,q)=>p.res-q.res)[0].team, res.filter(p=>p.team!==o.team).sort((p,q)=>q.res-p.res)[0].team]);
  res.sort((p,q) => (p.team===o.team) - (q.team===o.team)).forEach(p => {
    const hi = p.team === o.team, cx = sx(p.xgd_pg), cy = sy(p.pts_pg);
    S("circle",{cx,cy,r:hi?7:5,fill:hi?"var(--signal)":"var(--dot)",stroke:"var(--paper)","stroke-width":2},svg);
    S("circle",{cx,cy,r:11,class:"hit","data-tip":`<b>${esc(full(p.team))}</b><br>${p.pts_pg.toFixed(2)} points per match<br>${sgn(p.xgd_pg,2)} expected-goal difference per match<br>${p.res>=0?"+":"−"}${Math.abs(p.res).toFixed(2)} points per match against the fit`},svg);
    if(label.has(p.team)){ const right = cx < m.l + iw - 90; text(svg, cx + (right?11:-11), cy+4, short(p.team), hi?"t-lab halo":"t-lab2 halo", {"text-anchor":right?"start":"end"}); }
  });
  text(svg, m.l+4, m.t+4, "Points per match", "t-axis", {"dominant-baseline":"hanging"});
}

function drawBridge(el){
  const o = PP.data.home.outperformer, W = el.clientWidth; if(!W) return;
  const Ht = 230; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":`Bridge from expected-goal difference ${o.xgd.toFixed(1)} to goal difference ${o.gd}`},el);
  const scored = o.gf - o.xgf, saved = o.xga - o.ga, keeper = Math.min(Math.max(0, o.keeper.goals_prevented), Math.max(0, saved));
  const nw = W < 560;
  const steps = [
    {lab:["Expected","difference"], from:0, to:o.xgd, kind:"base", tip:`Chances created minus chances allowed: ${sgn(o.xgd,1)}`},
    {lab:nw?["Extra","scored"]:["Scored above","expected"], from:o.xgd, to:o.xgd+scored, kind:scored>=0?"pos":"neg", tip:`${Math.round(o.gf)} goals from chances worth ${o.xgf.toFixed(1)}: ${sgn(scored,1)}`},
    {lab:nw?["Fewer","conceded"]:["Conceded below","expected"], from:o.xgd+scored, to:o.xgd+scored+saved, kind:saved>=0?"pos":"neg", split:keeper, tip:`${Math.round(o.ga)} conceded from chances worth ${o.xga.toFixed(1)}: ${sgn(saved,1)}, of which ${esc(o.keeper.player)}'s saves ${sgn(o.keeper.goals_prevented,1)}`},
    {lab:["Goal","difference"], from:0, to:o.gd, kind:"total", tip:`Goal difference ${sgn(o.gd,0)}`}];
  const m = {l:34,r:8,t:22,b:W<560?54:40}, iw = W-m.l-m.r, ih = Ht-m.t-m.b;
  const top = Math.max(...steps.map(s => Math.max(s.from, s.to))), bot = Math.min(0, ...steps.map(s => Math.min(s.from, s.to)));
  const y1 = Math.ceil(top/10)*10, y0 = Math.floor(bot/10)*10, sy = v => m.t + ih - (v-y0)/(y1-y0)*ih;
  for(let v = y0; v <= y1; v += 10){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, v, "t-axis", {"text-anchor":"end"}); }
  const band = iw/steps.length, bw = Math.min(56, band*0.55);
  steps.forEach((s,i) => {
    const x = m.l + band*i + (band-bw)/2, yA = sy(Math.max(s.from,s.to)), yB = sy(Math.min(s.from,s.to));
    const fill = s.kind==="base" ? "var(--ink-3)" : s.kind==="total" ? "var(--ink)" : s.kind==="pos" ? "var(--turf)" : "var(--flare)";
    if(s.split){ const yk = sy(s.from + s.split); S("rect",{x,y:yk,width:bw,height:Math.max(1,yB-yk),fill:"var(--turf)"},svg); S("rect",{x,y:yA,width:bw,height:Math.max(1,yk-yA-2),fill:"var(--turf-2)"},svg);
      if(W >= 560) text(svg, x+bw+6, (yk+yB)/2+4, `keeper ${s.split.toFixed(1)}`, "t-lab2 halo", {}); else s.lab = s.lab.concat([`(keeper ${s.split.toFixed(1)})`]); }
    else S("rect",{x,y:yA,width:bw,height:Math.max(1,yB-yA),fill},svg);
    if(i < steps.length-1 && s.kind !== "total"){ const yn = sy(s.to); S("line",{x1:x+bw,x2:x+band,y1:yn,y2:yn,stroke:"var(--ink-3)","stroke-width":1,"stroke-dasharray":"2 3"},svg); }
    const val = s.kind==="base"||s.kind==="total" ? s.to : s.to - s.from;
    text(svg, x+bw/2, yA-7, sgn(val, s.kind==="total"?0:1), "t-lab", {"text-anchor":"middle"});
    s.lab.forEach((l,j) => text(svg, x+bw/2, Ht-m.b+16+j*14, l, "t-axis", {"text-anchor":"middle"}));
    S("rect",{x:m.l+band*i,y:m.t,width:band,height:ih,class:"hit","data-tip":s.tip},svg);
  });
}

/* ---------------- rail insights ---------------- */
function ins(id, kicker, head, body, micro, why){
  return `<article class="ins" id="${id}"><span class="kicker">${kicker}</span><h3>${head}</h3><p class="r-note">${body}</p>${micro}
    <div><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="${id}-why">Why the model thinks this</button>
    <div class="disc" id="${id}-why" aria-hidden="true"><div><div class="why-body">${why}</div></div></div></div></article>`;
}
function formText(f){ if(!f.n) return "no matches"; const parts = []; if(f.w) parts.push(`${PP.WORDS[f.w]||f.w} win${f.w>1?"s":""}`); if(f.d) parts.push(`${PP.WORDS[f.d]||f.d} draw${f.d>1?"s":""}`); if(f.l) parts.push(`${PP.WORDS[f.l]||f.l} defeat${f.l>1?"s":""}`); return `${f.pts===0?"no":f.pts} point${f.pts===1?"":"s"} from ${PP.WORDS[f.n]||f.n} match${f.n>1?"es":""} (${parts.join(", ")})`; }

/* which playoff story leads (owner, 2026-10-15): one team's swing of 20+ points from a single match this week, with the team on
   the other side of that result; otherwise the biggest four-week rise and fall */
function raceStory(H){
  const T = H.race.teams, wk = T.filter(x => x.form_week && x.form_week.n === 1 && x.move_week != null).sort((a,b) => Math.abs(b.move_week) - Math.abs(a.move_week))[0];
  if(wk && Math.abs(wk.move_week) >= 0.20){
    const o = T.find(x => x.team === wk.form_week.last.opp), other = o && Math.sign(o.move_week) === -Math.sign(wk.move_week) ? o : null;
    return {mode: "week", main: wk, other};
  }
  const t = T.slice().sort((a,b) => b.move_playoffs - a.move_playoffs);
  return {mode: "4w", up: t[0], dn: t[t.length-1]};
}
function insRace(H){
  const st = raceStory(H);
  if(st.mode === "week") return insRaceWeek(H, st);
  const t = H.race.teams.slice().sort((a,b) => b.move_playoffs - a.move_playoffs), up = t[0], dn = t[t.length-1];
  const ago = h => h.hist_playoffs[h.hist_playoffs.length-5];
  const head = `<a href="#team-${PP.slug(up.team)}">${esc(short(up.team))}</a>'s playoff chances rose from ${pct(ago(up))} to ${pct(up.p_playoffs)} in four weeks`;
  const body = `${cap(formText(up.form_4w))}. Over the same weeks ${esc(short(dn.team))} fell from ${pct(ago(dn))} to ${pct(dn.p_playoffs)}, taking ${formText(dn.form_4w)}.`;
  const rows = (arr) => arr.map(x => `<tr><td>${clubTag(x.team)}</td><td class="n">${pctShort(ago(x))}</td><td class="n">${pctShort(x.p_playoffs)}</td><td class="n" style="font-weight:600">${pp(x.move_playoffs)}</td><td class="n">${x.form_4w.pts} / ${x.form_4w.n*3}</td></tr>`).join("");
  const why = `<table class="mini-table"><thead><tr><th>Biggest moves</th><th class="n">4 wk ago</th><th class="n">Now</th><th class="n">Points</th><th class="n">Pts won</th></tr></thead><tbody>${rows(t.slice(0,3))}${rows(t.slice(-3).reverse())}</tbody></table>
    <p class="r-small">Chance of reaching the playoffs (top nine in each conference). Points are percentage points. Each week is the forecast reconstructed with today's model, using only the results known by then, ${H.race.dates.length} weeks in all.</p>`;
  return ins("ins-race", "Playoff race", head, body, `<div class="chart micro" id="spark"></div>`, why);
}
function insRaceWeek(H, st){
  const m = st.main, L = m.form_week.last, hi = Math.max(L.gf, L.ga), lo = Math.min(L.gf, L.ga), opp = esc(short(L.opp));
  const res = L.gf > L.ga ? `beating ${opp} ${hi}–${lo}` : L.gf < L.ga ? `losing ${hi}–${lo} to ${opp}` : `a ${hi}–${lo} draw with ${opp}`;
  const head = `<a href="#team-${PP.slug(m.team)}">${esc(short(m.team))}</a>'s playoff chances ${m.move_week > 0 ? "jumped" : "fell"} from ${pct(m.p_week_ago)} to ${pct(m.p_playoffs)} after ${res}`;
  const o = st.other;
  const body = o ? `${esc(short(o.team))}, on the other side of that result, ${o.move_week < 0 ? "fell" : "rose"} from ${pct(o.p_week_ago)} to ${pct(o.p_playoffs)}.`
    : `The biggest swing from a single match this week.`;
  const t = H.race.teams.slice().sort((a,b) => b.move_week - a.move_week);
  const rows = arr => arr.map(x => `<tr><td>${clubTag(x.team)}</td><td class="n">${pctShort(x.p_week_ago)}</td><td class="n">${pctShort(x.p_playoffs)}</td><td class="n" style="font-weight:600">${pp(x.move_week)}</td></tr>`).join("");
  const why = `<table class="mini-table"><thead><tr><th>Biggest moves this week</th><th class="n">Last week</th><th class="n">Now</th><th class="n">Points</th></tr></thead><tbody>${rows(t.slice(0,3))}${rows(t.slice(-3).reverse())}</tbody></table>
    <p class="r-small">Chance of reaching the playoffs (top nine in each conference). Points are percentage points. Last week is the forecast reconstructed with today's model from the results known then.</p>`;
  return ins("ins-race", "Playoff race", head, body, `<div class="chart micro" id="spark"></div>`, why);
}
function drawSpark(el){
  const H = PP.data.home, st = raceStory(H), t = H.race.teams.slice().sort((a,b) => b.move_playoffs - a.move_playoffs);
  const week = st.mode === "week", col = x => x.move_week > 0 ? "var(--turf)" : "var(--flare)";
  const lines = week ? [[st.main, col(st.main)]].concat(st.other ? [[st.other, col(st.other)]] : []) : [[t[0],"var(--turf)"],[t[t.length-1],"var(--flare)"]];
  const span = week ? 1 : 4;
  const W = el.clientWidth; if(!W) return; const Ht = 110; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":"Playoff chances through the season for the biggest riser and faller"},el);
  const n = H.race.dates.length, m = {l:30,r:96,t:8,b:18}, iw = W-m.l-m.r, ih = Ht-m.t-m.b, sx = i => m.l + i/(n-1)*iw, sy = v => m.t + ih - v*ih;
  S("rect",{x:sx(n-1-span),y:m.t,width:sx(n-1)-sx(n-1-span),height:ih,fill:"var(--well)"},svg);
  [0,0.5,1].forEach(v => { S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-6, sy(v)+4, (v*100)+"%", "t-axis", {"text-anchor":"end"}); });
  text(svg, week ? sx(n-1) : sx(n-5)+4, Ht-4, week ? "last week" : "last 4 weeks", "t-axis", week ? {"text-anchor":"end"} : {});
  text(svg, m.l, Ht-4, "Feb", "t-axis", {});
  const ends = [];
  lines.forEach(([tm, c]) => {
    S("path",{d:tm.hist_playoffs.map((v,i) => (i?"L":"M")+sx(i)+","+sy(v)).join(""),fill:"none",stroke:c,"stroke-width":2,"stroke-linejoin":"round"},svg);
    S("circle",{cx:sx(n-1),cy:sy(tm.p_playoffs),r:4,fill:c,stroke:"var(--paper)","stroke-width":2},svg);
    ends.push({y:sy(tm.p_playoffs), t:`${short(tm.team)} ${pctShort(tm.p_playoffs)}`});
    tm.hist_playoffs.forEach((v,i) => S("rect",{x:sx(i)-iw/(2*(n-1)),y:m.t,width:iw/(n-1),height:ih,class:"hit","data-tip":`<b>${esc(H.race.dates[i])}</b><br>${lines.map(([x]) => `${esc(short(x.team))} ${pct(x.hist_playoffs[i])}`).join("<br>")}`},svg));
  });
  ends.sort((a,b) => a.y-b.y); if(ends.length === 2 && ends[1].y - ends[0].y < 15){ const mid = (ends[0].y+ends[1].y)/2; ends[0].y = mid-8; ends[1].y = mid+8; }
  ends.forEach(e => text(svg, sx(n-1)+9, e.y+4, e.t, "t-lab", {}));
}

function insContract(H){
  const top = H.contract, cheapSlots = ["Senior","Supplemental","Homegrown"], cheap = top.filter(p => cheapSlots.includes(p.slot));
  const rest = top.filter(p => !cheapSlots.includes(p.slot)), N = n => PP.WORDS[n] || String(n);
  const link = p => `<a href="#player-${p.ws_player_id}">${esc(p.player)}</a>`;
  const and = a => a.length > 1 ? a.slice(0,-1).join(", ") + " and " + a[a.length-1] : (a[0] || "");
  const type = p => (PP.SLOT[p.slot] || p.slot).toLowerCase();
  const pay = rest.length ? (rest.length === 1 ? ` The other one in the top ${N(top.length)}, ${link(rest[0])}, earns ${money(rest[0].comp)}.`
    : ` The other ${N(rest.length)} in the top ${N(top.length)} earn between ${money(Math.min(...rest.map(x => x.comp)))} and ${money(Math.max(...rest.map(x => x.comp)))}.`) : "";
  let head, body;
  if(cheap.length === 1){                         // owner, 2026-10-15: "One of the six ... earn" when only one did
    const p = cheap[0];
    head = `One of the most valuable players in MLS this season earns ${money(p.comp)}`;
    body = `${link(p)} has added ${num(p.rating,1)} goals above replacement for ${esc(short(p.team))} on a ${type(p)} contract.${pay}`;
  } else {
    const maxPay = Math.max(...cheap.map(p => p.comp)), under = Math.ceil((maxPay+1)/5000)*5000;
    head = `${cap(N(cheap.length))} of the ${N(top.length)} most valuable players this season earn under ${money(under)}`;
    body = `${and(cheap.map(link))} play on ${and([...new Set(cheap.map(type))])} contracts.${pay}`;
  }
  const why = `<table class="mini-table"><thead><tr><th>Player</th><th>Contract type</th><th class="n">Pay</th><th class="n">Value</th><th class="n">Beats typical</th></tr></thead><tbody>${top.map(p => `<tr><td><a href="#player-${p.ws_player_id}" style="font-weight:600;text-decoration:none">${esc(p.player)}</a></td><td>${PP.SLOT[p.slot]||p.slot}</td><td class="n">${money(p.comp)}</td><td class="n">${sgn(p.rating)}</td><td class="n">${pctShort(p.p_above_slot)}</td></tr>`).join("")}</tbody></table>
    <p class="r-small">Value is goals above a replacement-level player at the same position, 2026 to date. "Beats typical" is the chance the season beats what a typical player on the same contract type returns (${H.slot_benchmarks.map(b=>`${b.slot} ${b.benchmark.toFixed(2)}`).join(", ")} goals per season on average). Pay is guaranteed compensation from the MLS Players Association.</p>`;
  return ins("ins-contract", "Contracts", head, body, `<div class="chart micro" id="payvalue"></div>`, why);
}
function drawPayValue(el){
  const H = PP.data.home, W = el.clientWidth; if(!W) return; const Ht = 190; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":"Value above replacement against guaranteed pay for every player with 900 or more minutes"},el);
  const m = {l:30,r:10,t:10,b:30}, iw = W-m.l-m.r, ih = Ht-m.t-m.b, lx0 = Math.log10(60000), lx1 = Math.log10(3.2e7);
  const sx = v => m.l + (Math.log10(Math.max(60000,v))-lx0)/(lx1-lx0)*iw, y0 = -3, y1 = 7, sy = v => m.t + ih - (Math.max(y0,Math.min(y1,v))-y0)/(y1-y0)*ih;
  [0,3,6].forEach(v => { S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-6, sy(v)+4, v, "t-axis", {"text-anchor":"end"}); });
  [[1e5,"$100k"],[1e6,"$1m"],[1e7,"$10m"]].forEach(([v,l]) => text(svg, sx(v), Ht-12, l, "t-axis", {"text-anchor":"middle"}));
  text(svg, m.l+iw, Ht, "Guaranteed pay, log scale", "t-axis", {"text-anchor":"end"});
  const topIds = new Set(H.contract.map(p => p.ws_player_id));
  H.pay_value.filter(p => !topIds.has(p[5])).forEach(p => S("circle",{cx:sx(p[0]),cy:sy(p[1]),r:2.6,fill:"var(--dot)","data-tip":`<b>${esc(p[3])}</b>, ${esc(short(p[4]))}<br>${money(p[0])}, ${sgn(p[1])} goals`},svg));
  H.contract.forEach(p => { S("circle",{cx:sx(p.comp),cy:sy(p.rating),r:5,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":2,"data-tip":`<b>${esc(p.player)}</b>, ${esc(short(p.team))}<br>${money(p.comp)}, ${sgn(p.rating)} goals<br>${PP.SLOT[p.slot]||p.slot}`},svg); });
  const messi = H.contract.reduce((a,b) => a.comp > b.comp ? a : b);
  text(PP.svgA(svg, messi.ws_player_id), sx(messi.comp)-9, sy(messi.rating)+4, surname(messi.player), "t-lab halo", {"text-anchor":"end"});
  const cheap = H.contract.filter(p => p !== messi), cx = Math.max(...cheap.map(p => sx(p.comp))), cy = Math.min(...cheap.map(p => sy(p.rating)));
  const lim = Math.ceil((Math.max(...cheap.map(p=>p.comp))+1)/5000)*5000;
  const lab = text(svg, cx+10, cy+2, W < 420 ? `${cheap.length} more, under $${Math.round(lim/1000)}k` : `${cheap.length} more, all under ${money(lim)}`, "t-anno halo", {});
  if(cx + 10 + lab.getComputedTextLength() > W - 4){ lab.setAttribute("x", W - 4); lab.setAttribute("y", cy - 12); lab.setAttribute("text-anchor", "end"); }   // keep it on the chart
}


function moversBand(H){
  const up = H.improved, dn = H.declined, top = up[0];
  if(!up.length && !dn.length) return "";
  const all = up.concat(dn), d0 = Math.floor(Math.min(...all.map(x => Math.min(x.lo, x.lo_25)))*20)/20, d1 = Math.ceil(Math.max(...all.map(x => Math.max(x.hi, x.hi_25)))*20)/20;
  PP.moverDomain = [d0, d1];
  const row = (x, i, kind) => `<div class="mv-row"><a href="#player-${x.ws_player_id}" class="nm">${esc(x.player)}</a>
      <span class="meta">${chip(x.team)}${esc(short(x.team))}, ${PP.POS[x.pos].toLowerCase()}</span>
      <span class="chart mv-glyph" data-kind="${kind}" data-i="${i}"></span>
      <span class="mv-val num">${num(x.p90_25,2)} <span aria-hidden="true">to</span> <b>${num(x.p90,2)}</b></span></div>`;
  const col = (title, arr, kind) => arr.length ? `<div class="mv-col"><h3 class="r-heading">${title}</h3><div class="mv-head r-small"><span>Value per 90 minutes, 2025 to 2026</span></div>${arr.map((x,i) => row(x,i,kind)).join("")}</div>` : "";
  const lede = top ? `<a href="#player-${top.ws_player_id}">${esc(top.player)}</a> has gone from ${num(top.p90_25,2)} to ${num(top.p90,2)} goals per 90 minutes for ${esc(short(top.team))}, the biggest rise this season. Each list only includes players whose 2026 range sits wholly above, or wholly below, their 2025 range, so the change is bigger than the model's uncertainty.` : "";
  return `<section class="band" id="movers-band" aria-labelledby="mv-h"><div class="wrap">
    <div class="band-head"><span class="kicker">Most improved</span><h2 class="r-title" id="mv-h">Players on the move</h2><p>${lede}</p></div>
    <div class="movers">${col("Rising", up, "up")}${col("Falling", dn, "dn")}</div>
    <div class="legend" style="margin-top:var(--s-4)"><span><i style="width:16px;height:10px;background:var(--band);border-radius:2px;display:inline-block"></i>90% range</span><span><i style="width:9px;height:9px;border:2px solid var(--ink-2);transform:rotate(45deg);display:inline-block"></i>2025</span><span><i class="lg-m"></i>2026</span><span class="r-small">Players with 900+ minutes at one club in each season.</span></div>
  </div></section>`;
}
function drawMover(el){
  const H = PP.data.home, x = (el.dataset.kind === "up" ? H.improved : H.declined)[+el.dataset.i], W = el.clientWidth; if(!W || !x) return;
  const [d0, d1] = PP.moverDomain, Ht = 30; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":`${x.player}: ${num(x.p90_25,3)} in 2025, ${num(x.p90,3)} in 2026`},el);
  const sx = v => 6 + (v-d0)/(d1-d0)*(W-12);
  if(d0 < 0) S("line",{x1:sx(0),x2:sx(0),y1:2,y2:Ht-2,stroke:"var(--mid)","stroke-width":2},svg);
  [[x.p90_25, x.lo_25, x.hi_25, 9, false, 2025],[x.p90, x.lo, x.hi, 21, true, 2026]].forEach(([v, l, h, y, now, yr]) => {
    S("rect",{x:sx(l),y:y-4,width:Math.max(2,sx(h)-sx(l)),height:8,rx:2,fill:"var(--band)"},svg);
    S("rect",{x:sx(v)-4,y:y-4,width:8,height:8,fill:now?"var(--signal)":"var(--paper)",stroke:now?"var(--paper)":"var(--ink-2)","stroke-width":now?1.5:1.5,transform:`rotate(45 ${sx(v)} ${y})`},svg);
  });
  S("rect",{x:0,y:0,width:W,height:Ht,class:"hit","data-tip":`<b>${esc(x.player)}</b><br>2025: ${num(x.p90_25,3)} per 90 (range ${num(x.lo_25,3)} to ${num(x.hi_25,3)})<br>2026: ${num(x.p90,3)} (range ${num(x.lo,3)} to ${num(x.hi,3)})<br>${PP.int(x.mins)} minutes in 2026`},svg);
}

/* ---------------- race band ---------------- */
function raceBand(H){
  const confs = ["East","West"], d = H.race;
  const biggest = d.teams.slice().sort((a,b) => Math.abs(b.move_playoffs) - Math.abs(a.move_playoffs))[0].conference;
  const panel = c => {
    const t = d.teams.filter(x => x.conference === c), through = t.filter(x => x.p_playoffs >= 0.995), out = t.filter(x => x.p_playoffs < 0.005);
    // 99.5% is not a proof (owner, 2026-10-29): "Clinched" / "Eliminated" only where points and matches left prove it (71's
    // bubble, as in the band above), "All but" otherwise; once the season is over the table decides: "Through" / "Out"
    const pr = {}; Object.values((H.bubble || {}).conferences || {}).forEach(v => v.clubs.forEach(x => { pr[x.team] = x; }));
    const link = x => `<a href="#team-${PP.slug(x.team)}">${esc(short(x.team))}</a>`;
    const groups = H.season_over ? [[through, "Through"], [out, "Out"]]
      : [[through.filter(x => (pr[x.team] || {}).clinched), "Clinched"], [through.filter(x => !(pr[x.team] || {}).clinched), "All but through"],
         [out.filter(x => !(pr[x.team] || {}).eliminated), "All but out"], [out.filter(x => (pr[x.team] || {}).eliminated), "Eliminated"]];
    return `<div class="race-conf" data-conf="${c}" data-hidden="${c!==biggest}">
      <div class="fig-cap"><h3 class="r-heading">${c}ern Conference</h3><span class="r-small">Chance of the playoffs, last twelve weeks</span></div>
      <div class="chart race-chart" data-conf="${c}"></div>
      <div class="settled">${groups.filter(([a]) => a.length).map(([a, lab]) => `<span><b>${lab}:</b> ${a.map(link).join(", ")}</span>`).join("")}</div>
    </div>`;
  };
  return `<section class="band well" id="race-band" aria-labelledby="race-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="race-h">The playoff race</h2>
      <p>Each line is a team's chance of reaching the playoffs after each of the last twelve weeks, recomputed with today's model from the results known at the time. Teams still in contention, or that moved ten points or more in the last four weeks, are drawn; green lines rose, red lines fell.</p></div>
    <div class="race-tools seg" role="group" aria-label="Conference" style="margin-bottom:var(--s-4)">${confs.map(c => `<button type="button" data-conf="${c}" aria-pressed="${c===biggest}">${c}</button>`).join("")}</div>
    <div class="race">${confs.map(panel).join("")}</div>
    <div class="legend" style="margin-top:var(--s-5)"><span><i class="lg-line" style="--c:var(--turf)"></i>Rose 10+ points in four weeks</span><span><i class="lg-line" style="--c:var(--flare)"></i>Fell 10+ points</span><span><i class="lg-line" style="--c:var(--ink-3)"></i>Moved less</span><a href="#race" class="btn-text" style="margin-left:auto">Full playoff forecast</a></div>
  </div></section>`;
}
function bindRaceTools(){
  $$(".race-tools button").forEach(b => b.addEventListener("click", () => {
    $$(".race-tools button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $$(".race-conf").forEach(p => p.dataset.hidden = String(p.dataset.conf !== b.dataset.conf));
    PP.redraw();
  }));
}
function drawRace(el){
  const H = PP.data.home, d = H.race, conf = el.dataset.conf, W = el.clientWidth; if(!W) return;
  const all = d.teams.filter(t => t.conference === conf), K = Math.min(13, d.dates.length), off = d.dates.length - K;
  const live = all.filter(t => (t.p_playoffs > 0.02 && t.p_playoffs < 0.98) || Math.abs(t.move_playoffs) >= 0.1).map(t => ({...t, hist: t.hist_playoffs.slice(off)}));
  const dates = d.dates.slice(off);
  const Ht = 320, narrow = W < 520; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":`Weekly playoff chances for ${conf}ern Conference teams still in contention`},el);
  const n = dates.length, m = {l:38,r:narrow?74:118,t:10,b:24}, iw = W-m.l-m.r, ih = Ht-m.t-m.b;
  const sx = i => m.l + i/(n-1)*iw, sy = v => m.t + ih - v*ih;
  S("rect",{x:sx(n-5),y:m.t,width:sx(n-1)-sx(n-5),height:ih,fill:"var(--paper)"},svg);
  text(svg, sx(n-1)-5, m.t+ih-6, narrow ? "4 wks" : "Last 4 weeks", "t-axis halo", {"text-anchor":"end"});
  [0,.25,.5,.75,1].forEach(v => { S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, Math.round(v*100)+"%", "t-axis", {"text-anchor":"end"}); });
  dates.forEach((s,i) => { if(i % 4 === 0 || i === n-1) text(svg, sx(i), Ht-6, new Date(s+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"}), "t-axis", {"text-anchor":i===n-1?"end":"middle"}); });
  const col = t => t.move_playoffs >= 0.1 ? "var(--turf)" : t.move_playoffs <= -0.1 ? "var(--flare)" : "var(--ink-3)";
  const order = live.slice().sort((a,b) => Math.abs(a.move_playoffs) - Math.abs(b.move_playoffs));
  const paths = new Map();
  order.forEach(t => { const big = Math.abs(t.move_playoffs) >= 0.1; const p = S("path",{d:t.hist.map((v,i) => (i?"L":"M")+sx(i)+","+sy(v)).join(""),fill:"none",stroke:col(t),"stroke-width":big?2:1.25,"stroke-opacity":big?1:0.6,"stroke-linejoin":"round",style:"transition:opacity 120ms ease-out"},svg); paths.set(t.team, p); });
  // end labels with simple collision avoidance
  const ends = live.map(t => ({t, y:sy(t.p_playoffs)})).sort((a,b) => a.y - b.y);
  for(let i = 1; i < ends.length; i++) if(ends[i].y - ends[i-1].y < 14) ends[i].y = ends[i-1].y + 14;
  const over = ends.length ? ends[ends.length-1].y - (m.t+ih+4) : 0; if(over > 0) ends.forEach(e => e.y -= over);
  for(let i = ends.length-2; i >= 0; i--) if(ends[i+1].y - ends[i].y < 14) ends[i].y = ends[i+1].y - 14;
  ends.forEach(e => { S("circle",{cx:sx(n-1),cy:sy(e.t.p_playoffs),r:3.5,fill:col(e.t),stroke:"var(--well)","stroke-width":1.5},svg);
    text(svg, sx(n-1)+8, e.y+4, `${narrow ? (PP.CLUB[e.t.team]||[e.t.team])[0] : short(e.t.team)} ${pctShort(e.t.p_playoffs)}`, "t-lab2", {"data-team":e.t.team}); });
  // hover: nearest line at the nearest week
  const cross = S("line",{x1:0,x2:0,y1:m.t,y2:m.t+ih,stroke:"var(--ink-3)","stroke-width":1,opacity:0},svg);
  const ov = S("rect",{x:m.l,y:m.t,width:iw,height:ih,fill:"transparent"},svg);
  const move = e => { const r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, i = Math.max(0, Math.min(n-1, Math.round((x-m.l)/iw*(n-1))));
    let best = null, bd = 1e9; live.forEach(t => { const dd = Math.abs(sy(t.hist[i]) - y); if(dd < bd){ bd = dd; best = t; } });
    cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("opacity", 1);
    paths.forEach((p, k) => p.style.opacity = !best || k === best.team ? 1 : 0.25);
    if(best) PP.showTip(`<b>${esc(full(best.team))}</b><br>${new Date(dates[i]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}: ${pct(best.hist[i])}<br>Now ${pct(best.p_playoffs)}, ${pp(best.move_playoffs)} points in four weeks`, e.clientX, e.clientY); };
  ov.addEventListener("pointermove", move); ov.addEventListener("pointerdown", move);
  ov.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); paths.forEach(p => p.style.opacity = 1); PP.hideTip(); });
}

/* ---------------- chain of the week ---------------- */
function chainBand(H){
  const c = H.chain, team = short(c.team), first = c.steps[0], last = c.steps[c.steps.length-1];
  const head = c.n_players >= 11 ? `All eleven ${esc(team)} players touched this goal` : `${cap(PP.WORDS[c.n_players]||String(c.n_players))} ${esc(team)} players touched this goal`;
  const [gh, ga] = c.score.split(":").map(s => s.trim());
  const opp = c.home === c.team ? c.away : c.home;
  const lede = `${esc(short(c.home))} ${gh}–${ga} ${esc(short(c.away))}, ${PP.dateLong(c.date)}, ${c.minute} minutes in. ${c.n_actions} actions from ${PP.plink(first.id, first.player)}'s ${esc(first.action)} to ${PP.plink(last.id, last.player)}'s finish. Each action is valued by how much it changed the chance that ${esc(team)}'s possession would end in a goal; the chart below the pitch shows what each one added.`;
  const max = Math.max(...c.totals.map(t => Math.abs(t.value)));
  const credits = c.totals.map(t => { const w = Math.abs(t.value)/max*50; return `<button type="button" aria-pressed="false" data-player="${esc(t.player)}"><span class="nm">${esc(t.player)}</span><span class="tr"><span class="z" style="left:50%"></span><i style="${t.value>=0?`left:50%;width:${w}%;background:var(--turf);border-radius:0 3px 3px 0`:`left:${50-w}%;width:${w}%;background:var(--flare);border-radius:3px 0 0 3px`}"></i></span><span class="v">${sgn(t.value,3)}</span></button>`; }).join("");
  return `<section class="band" id="chain-band" aria-labelledby="chain-h"><div class="wrap">
    <div class="band-head"><span class="kicker">Chain of the week</span><h2 class="r-title" id="chain-h">${head}</h2><p>${lede}</p></div>
    <div class="chainwrap">
      <figure style="margin:0;display:grid;gap:var(--s-3);min-width:0">
        <div class="fig-cap"><span class="legend"><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain"></line></svg>Pass</span><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain carry"></line></svg>Carry</span><span>Attacking left to right against ${esc(short(opp))}</span></span><button type="button" class="btn-text" id="play-chain">Play the chain</button></div>
        <div class="chart" id="pitch"></div>
        <div class="chart" id="steps"></div>
      </figure>
      <div class="credits" aria-label="Credit by player">
        <span class="r-label" style="padding-bottom:6px">Who added what, in goals. Select a player to see their actions.</span>
        ${credits}
        <p class="r-small" style="padding-top:10px">A completed pass splits its value between passer and receiver.${c.regain_swing!=null?` Winning the ball back to start the move (${PP.plink(first.id, first.player)}'s ${esc(first.action)}) counts toward defence and is not included here.`:""}</p>
      </div>
    </div>
  </div></section>`;
}
let chainFocus = null;
function bindChain(){
  $$("#chain-band .credits button").forEach(b => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    $$("#chain-band .credits button").forEach(x => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", String(on)); chainFocus = on ? b.dataset.player : null; applyFocus();
  }));
  const play = $("#play-chain"); if(play) play.addEventListener("click", () => { drawPitch($("#pitch"), true); drawSteps($("#steps"), true); });
}
function homeChain(){
  const c = PP.data.home.chain, st = c.steps.map(s => ({key:s.player, player:s.player, action:s.action, x:s.x, y:s.y, ex:s.end_x, ey:s.end_y, vb:s.v_before, va:s.v_after, xg:s.xg, delta:s.delta, goal:s.goal}));
  const big = st.slice(0,-1).reduce((bi, s, i) => (s.delta||0) > (st[bi].delta||0) ? i : bi, 0);
  return {steps: st, labels: [0, st.length-1].concat(big ? [big] : [])};
}
function applyFocus(){ ["#pitch","#steps"].forEach(q => { const el = $(q); if(el) PP.focusChain(el, chainFocus); }); }
function drawPitch(el, animate){ const ch = homeChain(); PP.chainPitch(el, ch, {labels: ch.labels, animate}); applyFocus(); }
function drawSteps(el, animate){ PP.chainSteps(el, homeChain(), {animate}); applyFocus(); }

/* ---------------- next up ---------------- */
function nextBand(H){
  const list = upcoming(H).slice(0, 8);
  if(!list.length) return "";
  const byDay = {}; list.forEach(m => { const k = PP.kick(m.kickoff_utc); (byDay[k.day] = byDay[k.day] || []).push([m,k]); });
  const src = s => s === "lineups" ? `<span class="src"><i class="st confirmed"></i>Confirmed lineups</span>` : s === "availability" ? `<span class="src"><i class="st likely"></i>Likely lineups from the league availability report</span>` : `<span class="src"><i class="st model"></i>Team strength only; no lineup news yet</span>`;
  const conf = t => (PP.byTeam[t]||{}).conference || "";
  const stake = (m, side) => { const t = m[side], s = m["stake_"+side], w = m["if_win_"+side], l = m["if_loss_"+side]; if(!s || w == null) return "";
    return `<div><b>${esc(short(t))}</b>, ${STAKE(s, conf(t)+"ern Conference")}: ${pct(w)} with a win, ${pct(l)} with a defeat</div>`; };
  const rows = Object.entries(byDay).map(([day, arr]) => `<div class="fx-day">${day}</div>` + arr.map(([m,k]) => `<div class="fx fxl" data-href="#match-${m.ws_match_id}">
      <span class="time">${k.time}</span>
      <div class="teams"><a href="#team-${PP.slug(m.home)}" style="text-decoration:none">${clubTag(m.home, true)}</a><a href="#team-${PP.slug(m.away)}" style="text-decoration:none">${clubTag(m.away, true)}</a></div>
      <div class="probs"><div class="pbar" role="img" aria-label="${esc(short(m.home))} ${pct(m.pH)}, draw ${pct(m.pD)}, ${esc(short(m.away))} ${pct(m.pA)}"><i style="width:${m.pH*100}%;background:${PP.pairKit(m.home, m.away)[0]}"></i><i style="width:${m.pD*100}%;background:var(--mid)"></i><i style="width:${m.pA*100}%;background:${PP.pairKit(m.home, m.away)[1]}"></i></div>
        <div class="plab"><span><b>${pctShort(m.pH)}</b> win</span><span>${pctShort(m.pD)} draw</span><span><b>${pctShort(m.pA)}</b> win</span></div>${src(m.headline_source)}</div>
      <div class="stake">${stake(m,"home")}${stake(m,"away")}</div>
    </div>`).join("")).join("");
  return `<section class="band" id="next-band" aria-labelledby="next-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="next-h">Next up</h2><p>Win, draw and defeat chances for the next ${list.length} matches, and for each side the season goal the result moves most. Kickoff times are Eastern.</p></div>
    <div class="fixtures">${rows}</div>
    <div style="margin-top:var(--s-4)"><a href="#matches" class="btn-text">All matches</a></div>
  </div></section>`;
}

/* ---------------- leaders ---------------- */
function leadersBand(H){
  const L = H.leaders, d0 = Math.min(-1, ...L.map(p => p.lo ?? p.rating)), d1 = Math.max(...L.map(p => p.hi ?? p.rating));
  const rows = L.map((p,i) => `<a class="lrow" href="#player-${p.ws_player_id}" data-tip="<b>${esc(p.player)}</b><br>${sgn(p.rating)} goals above replacement${p.lo!=null?`<br>90% range ${num(p.lo)} to ${num(p.hi)}`:""}<br>Attack ${sgn(p.attack)}, defence ${sgn(p.defence)}<br>${PP.int(p.mins)} minutes">
      <span class="rk">${i+1}</span><span class="nm">${esc(p.player)}</span>
      <span class="val">${PP.ibar(p.rating, p.lo, p.hi, d0, d1)}<span style="min-width:42px;text-align:right">${sgn(p.rating)}</span></span>
      <span class="meta">${chip(p.team)}${esc(short(p.team))}, ${PP.POS[p.pos].toLowerCase()}</span></a>`).join("");
  const def = L.filter(p => p.defence > p.attack), att = L.filter(p => p.attack >= p.defence);
  const names = a => a.map(p => PP.plink(p.ws_player_id, surname(p.player))); const and = a => a.length > 1 ? a.slice(0,-1).join(", ") + " and " + a[a.length-1] : a[0] || "";
  return `<section class="band" id="leaders-band" aria-labelledby="lead-h2"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="lead-h2">The most valuable players of 2026</h2><p>Goals added above a replacement-level player at the same position, with the model's 90% range. Outfield players with 900+ minutes.</p></div>
    <div class="leaders">
      <div class="lboard" id="lboard">${rows}</div>
      <aside class="aside">
        <p class="r-note" style="font-size:var(--t-15)">Every action is valued by how much it changes the chance that a possession ends in a goal, at either end. A player's value is the sum, measured against what a replacement-level player at the same position would add in the same minutes.</p>
        ${def.length ? `<p class="r-note" style="font-size:var(--t-15)">${cap(PP.WORDS[def.length]||String(def.length))} of the top ten earn most of their value by winning the ball back: ${and(names(def))}. ${att.length ? `${and(names(att))} earn${att.length===1?"s":""} most of theirs on the ball.` : ""}</p>` : ""}
        <a href="#players" class="btn-text">Every player</a>
      </aside>
    </div>
  </div></section>`;
}
})();
