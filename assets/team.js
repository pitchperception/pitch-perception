/* Pitch Perception: team pages and the Teams index. Data: data/teams/<slug>.json, data/league.json. */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, pctile, money, short, full, chip, clubTag} = PP;
const surname = n => PP.surname(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const cache = {};
let leagueP = null;
const loadTeam = slug => cache[slug] || (cache[slug] = fetch(`data/teams/${slug}.json`).then(r => { if(!r.ok) throw new Error(`data/teams/${slug}.json returned ${r.status}`); return r.json(); }));
const loadLeague = () => leagueP || (leagueP = fetch("data/league.json").then(r => { if(!r.ok) throw new Error(`league.json returned ${r.status}`); return r.json(); }));
const COMPL = {passing:"Passing",setpiece:"Set-piece delivery",carrying:"Carrying",dribbling:"Dribbling",shooting:"Shot selection",receiving:"Receiving",security:"Ball security",
  interceptions:"Interceptions",tackles:"Tackles",recoveries:"Loose-ball recoveries",clearances:"Clearances",blocks:"Blocks",aerials:"Aerials won",high_regains:"High regains",not_beaten:"Not dribbled past",fouls:"Fouls"};
const POSG = {GK:"Goalkeepers",CB:"Defence",FB:"Defence",CM_DM:"Midfield",AM:"Midfield",W:"Attack",ST:"Attack"};
const STAKE = (s, conf) => ({"top 7":"a top-seven finish","playoffs":"the playoffs","1st in conference":`first place in the ${conf}`,"Supporters' Shield":"the Supporters' Shield","MLS Cup":"MLS Cup"}[s] || s);
let T = null;

// what the Strength column is (owner, 2026-10-10): the production rating of matchmodel.py (rating "blend"), in plain words
function strengthNote(race){
  const r = race.filter(t => t.elo != null).sort((a,b) => b.elo - a.elo); if(!r.length) return "";
  const hi = r[0], lo = r[r.length-1], exp = d => 1 / (1 + Math.pow(10, -d/400));
  return `<div><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="why-strength">What strength means</button>
    <div class="disc" id="why-strength" aria-hidden="true"><div><div class="why-body" style="max-width:64ch">
      <p class="r-small" style="font-size:var(--t-13);color:var(--ink-2)"><b>What it represents.</b> How good each club is right now, on a scale where the league average is about 1,500. It works like an Elo rating in chess: a club gains points when it does better than expected and loses them when it does worse. Today it runs from ${PP.int(hi.elo)} (${esc(short(hi.team))}) to ${PP.int(lo.elo)} (${esc(short(lo.team))}). Before each match the two ratings, with 60 points added for the home side, set the result each side is expected to get: a 100-point edge means the stronger side is expected to take ${Math.round(exp(100)*100)}% of the result on offer, counting a draw as half a win.</p>
      <p class="r-small" style="font-size:var(--t-13);color:var(--ink-2)"><b>How it moves.</b> After each match, a club's result is counted half as what actually happened (win, draw or loss, and the margin) and half as what the chances would usually produce, from both sides' expected goals. A lucky win therefore earns less than a deserved one, and an unlucky defeat costs less. The bigger the surprise, the bigger the move, and wider margins count a little more. Each new season every rating moves a third of the way back to 1,500, because squads change; expansion clubs start at 1,450.</p>
      <p class="r-small" style="font-size:var(--t-13);color:var(--ink-2)"><b>How it is used.</b> Every match forecast and every simulation of the rest of the season starts from it; lineup news and the league's availability report then adjust each match. It replaced a rating built on results alone on 7 October 2026, after a test fixed in advance showed it predicted the 2021&ndash;25 matches slightly better. The <a href="#method">Method</a> page has the details.</p>
    </div></div></div></div>`;
}

/* ---------------- Teams index ---------------- */
PP.pages.teams = async main => {
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Teams</h1><p class="r-small">Loading.</p></section></div>`;
  let L, TR = null; try { [L, TR] = await Promise.all([loadLeague(), fetch("data/trends.json").then(r => r.ok ? r.json() : null).catch(() => null)]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The league data did not load</h1><p>${esc(e.message)}</p></section></div>`; return; }
  const race = ((PP.data.home||{}).race||{teams:[]}).teams, byT = Object.fromEntries(race.map(t => [t.team, t]));
  const col = c => race.filter(t => t.conference === c).sort((a,b) => b.points - a.points || a.played - b.played);
  const rows = arr => arr.map((t,i) => `<a class="trow" href="#team-${PP.slug(t.team)}"><span class="rk">${i+1}</span><span class="nm">${PP.chip(t.team)}<span class="nmt"><span class="nm-full">${esc(full(t.team))}</span><span class="nm-short">${esc(short(t.team))}</span></span></span>
    <span class="num">${t.points} pts, ${t.played} played</span><span class="num"><span class="sr">Strength </span>${PP.int(t.elo)}</span><span class="tp"><span class="pbar1"><i style="width:${Math.max(1,t.p_playoffs*100)}%"></i></span><span class="num">${pctShort(t.p_playoffs)}</span></span></a>`).join("");
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Teams</h1><p class="r-note" style="max-width:62ch">Every club's page: how strong the model thinks they are, how they play, who carries them and what is left of their season. Ordered by points; the bar is the chance of reaching the playoffs.</p><a class="btn-text" href="#managers">The managers: style, shapes and results against their squads</a>
      ${strengthNote(race)}</section>
    <div class="tindex">${["East","West"].map(c => `<section><h2 class="r-title">${c}ern Conference</h2><div class="thead"><span></span><span>Club</span><span>Record</span><span>Strength</span><span>Playoffs</span></div>${rows(col(c))}</section>`).join("")}</div></div>
    <section class="band" id="lstyle"><div class="wrap"><div class="band-head"><h2 class="r-title">How the league plays</h2><p>Every club of 2026 by the chances it creates and allows per match, from our shot model. Up and to the right is better at both ends; the diagonal lines mark equal expected-goal difference.</p></div>
      <div class="chart" id="lscatter"></div></div></section>
    ${TR ? `<section class="band" id="ltrends"><div class="wrap"><div class="band-head"><h2 class="r-title">The league over time</h2><p>Goals and expected goals per match, and how results split between home wins, draws and away wins, every regular season since ${TR.seasons[0].year}. ${TR.seasons[TR.seasons.length-1].year} is in progress.</p></div>
      <div class="trajwrap"><figure class="tfig"><div class="fig-cap"><span class="r-label">Goals per match</span></div><div class="chart" id="lgoals"></div><div class="legend"><span><i class="lg-line" style="--c:var(--ink)"></i>Goals</span><span><i class="lg-line" style="--c:var(--signal)"></i>Expected goals (2020 on)</span></div></figure>
      <figure class="tfig"><div class="fig-cap"><span class="r-label">Results</span></div><div class="chart" id="lres"></div><div class="legend"><span><i style="width:10px;height:10px;background:var(--signal);display:inline-block;border-radius:2px"></i>Home win</span><span><i style="width:10px;height:10px;background:var(--mid);display:inline-block;border-radius:2px"></i>Draw</span><span><i style="width:10px;height:10px;background:var(--ink-3);display:inline-block;border-radius:2px"></i>Away win</span></div></figure></div></div></section>` : ""}`;
  const L26 = (L.seasons["2026"] || []).map(r => Object.fromEntries(L.cols.map((k,i) => [k, r[i]])));
  PP.chart($("#lscatter"), el => drawLeague(el, L26)); PP.bindTips($("#lscatter"));
  PP.bindDisclosures(main);
  if(TR){ PP.chart($("#lgoals"), el => drawGoals(el, TR.seasons)); PP.chart($("#lres"), el => drawRes(el, TR.seasons)); ["#lgoals","#lres"].forEach(q => PP.bindTips($(q))); }
};
function drawLeague(el, rows){
  const W = Math.min(el.clientWidth, 980); if(!W || !rows.length) return; const H = Math.round(Math.min(520, Math.max(320, W*0.6))); el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Expected goals created against allowed per match, every club"},el);
  const m = {l:46,r:18,t:14,b:40}, iw = W-m.l-m.r, ih = H-m.t-m.b, xs = rows.map(r => r.xgf_pg), ys = rows.map(r => r.xga_pg);
  const x0 = Math.floor((Math.min(...xs)-0.05)*10)/10, x1 = Math.ceil((Math.max(...xs)+0.05)*10)/10, y0 = Math.floor((Math.min(...ys)-0.05)*10)/10, y1 = Math.ceil((Math.max(...ys)+0.05)*10)/10;
  const sx = v => m.l + (v-x0)/(x1-x0)*iw, sy = v => m.t + (v-y0)/(y1-y0)*ih;     // fewer allowed is higher on the chart
  for(let v = Math.ceil(x0*5)/5; v <= x1+1e-9; v += 0.2) text(svg, sx(v), H-m.b+16, v.toFixed(1), "t-axis", {"text-anchor":"middle"});
  for(let v = Math.ceil(y0*5)/5; v <= y1+1e-9; v += 0.2){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:"g-line"},svg); text(svg, m.l-8, sy(v)+4, v.toFixed(1), "t-axis", {"text-anchor":"end"}); }
  [-0.5, 0, 0.5, 1].forEach(d => { const p = []; for(let x = x0; x <= x1+1e-9; x += 0.01){ const y = x - d; if(y >= y0 && y <= y1) p.push([sx(x), sy(y)]); } if(p.length > 1){ S("path",{d:p.map((q,i) => (i?"L":"M")+q[0]+","+q[1]).join(""),fill:"none",stroke:d===0?"var(--rule-strong)":"var(--rule)","stroke-dasharray":"4 4"},svg); const q = p[p.length-1]; text(svg, q[0]-4, q[1]+12, `${d>0?"+":d<0?"\u2212":""}${Math.abs(d).toFixed(1)}`, "t-axis", {"text-anchor":"end"}); } });
  text(svg, m.l+iw, H-4, "Expected goals created per match", "t-axis", {"text-anchor":"end"});
  text(svg, m.l+4, m.t+4, "Expected goals allowed per match (fewer is higher)", "t-axis", {"dominant-baseline":"hanging"});
  rows.forEach(r => { const cx = sx(r.xgf_pg), cy = sy(r.xga_pg);
    S("circle",{cx,cy,r:6,fill:"var(--dot)",stroke:"var(--paper)","stroke-width":2},svg);
    const a = S("a",{href:`#team-${PP.slug(r.team)}`},svg); text(a, cx+9, cy+4, PP.short(r.team), "t-lab2 halo", {});
    S("circle",{cx,cy,r:11,class:"hit","data-tip":`<b>${esc(full(r.team))}</b><br>${num(r.xgf_pg,2)} created, ${num(r.xga_pg,2)} allowed per match<br>${sgn(r.xgd_pg,2)} difference, ${num(r.pts_pg,2)} points per match`},svg); });
}
function drawGoals(el, ss){
  const W = el.clientWidth; if(!W) return; const H = 220; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Goals and expected goals per match by season"},el);
  const m = {l:38,r:14,t:12,b:26}, iw = W-m.l-m.r, ih = H-m.t-m.b, n = ss.length, sx = i => m.l + i/(n-1)*iw, y0 = 2.4, y1 = 3.4, sy = v => m.t + ih - (v-y0)/(y1-y0)*ih;
  for(let v = y0; v <= y1+1e-9; v += 0.2){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:"g-line"},svg); text(svg, m.l-8, sy(v)+4, v.toFixed(1), "t-axis", {"text-anchor":"end"}); }
  ss.forEach((s,i) => { if(i % 2 === 0 || i === n-1) text(svg, sx(i), H-6, s.year, "t-axis", {"text-anchor":"middle"}); });
  S("path",{d:ss.map((s,i) => (i?"L":"M")+sx(i)+","+sy(s.goals_pm)).join(""),fill:"none",stroke:"var(--ink)","stroke-width":2},svg);
  const xi = ss.map((s,i) => [s,i]).filter(([s]) => s.xg_pm != null);
  S("path",{d:xi.map(([s,i],k) => (k?"L":"M")+sx(i)+","+sy(s.xg_pm)).join(""),fill:"none",stroke:"var(--signal)","stroke-width":2},svg);
  ss.forEach((s,i) => S("rect",{x:sx(i)-iw/(2*(n-1)),y:m.t,width:iw/(n-1),height:ih,class:"hit","data-tip":`<b>${s.year}</b>${s.year===2026?" (so far)":""}<br>${s.goals_pm.toFixed(2)} goals per match${s.xg_pm!=null?`<br>${s.xg_pm.toFixed(2)} expected goals`:""}<br>${PP.int(s.matches)} matches`},svg));
}
function drawRes(el, ss){
  const W = el.clientWidth; if(!W) return; const H = 220; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Home wins, draws and away wins by season"},el);
  const m = {l:38,r:14,t:12,b:26}, iw = W-m.l-m.r, ih = H-m.t-m.b, n = ss.length, bw = iw/n;
  [0,0.25,0.5,0.75,1].forEach(v => text(svg, m.l-8, m.t + ih - v*ih + 4, Math.round(v*100)+"%", "t-axis", {"text-anchor":"end"}));
  ss.forEach((s,i) => { let y = m.t + ih; [[s.home_win,"var(--signal)"],[s.draw,"var(--mid)"],[s.away_win,"var(--ink-3)"]].forEach(([p,c]) => { const h = p*ih; S("rect",{x:m.l+i*bw+1,y:y-h,width:bw-2,height:Math.max(0,h-1),fill:c},svg); y -= h; });
    if(i % 2 === 0 || i === n-1) text(svg, m.l+i*bw+bw/2, H-6, s.year, "t-axis", {"text-anchor":"middle"});
    S("rect",{x:m.l+i*bw,y:m.t,width:bw,height:ih,class:"hit","data-tip":`<b>${s.year}</b><br>Home wins ${pct(s.home_win)}<br>Draws ${pct(s.draw)}<br>Away wins ${pct(s.away_win)}`},svg); });
}

/* ---------------- team page ---------------- */
PP.pages.team = async (main, h) => {
  const bits = h.slice(5).split("-"), last = bits[bits.length-1], year = /^\d{4}$/.test(last) ? +last : null, slug = (year ? bits.slice(0,-1) : bits).join("-");
  const team = PP.teamBySlug(slug);
  if(!team){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">No club with this link</h1><p>Pick a club from the Teams list.</p><a class="btn-text" href="#teams">All teams</a></section></div>`; return; }
  main.innerHTML = `<div class="wrap"><section class="pid"><div class="r-label">${clubTag(team)}</div><h1 class="r-name">${esc(full(team))}</h1><p class="r-small">Loading the model's view of this club.</p></section></div>`;
  let D, L; try { [D, L] = await Promise.all([loadTeam(slug), loadLeague(), PP.loadArch(), PP.loadImages()]); }
  catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">${team ? "This club's data did not load" : "No club with this link"}</h1><p>${team ? esc(e.message)+". Reload the page; if it persists, the site needs republishing." : "Pick a club from the Teams list."}</p><a class="btn-text" href="#teams">All teams</a></section></div>`; return; }
  if(location.hash.slice(1) !== h) return;
  const seasons = D.seasons.slice().sort((a,b) => a.year - b.year), years = seasons.map(s => s.year), y = year && years.includes(year) ? year : years[years.length-1];
  T = {D, L, seasons, years, year: y, s: seasons.find(s => s.year === y), zoneMode: "create"};
  render(main);
};

function lg(){ const L = T.L, rows = L.seasons[String(T.year)] || [], c = L.cols; return rows.map(r => Object.fromEntries(c.map((k,i) => [k, r[i]]))); }
function rankOf(key, hiGood=true){ const rows = lg().filter(r => r[key] != null), me = rows.find(r => r.team === T.D.team); if(!me) return null; const sorted = rows.slice().sort((a,b) => hiGood ? b[key]-a[key] : a[key]-b[key]); return {rank: sorted.indexOf(me)+1, of: rows.length}; }
function confRank(){ const conf = T.D.conference, east = new Set(T.L.east), rows = lg().filter(r => (east.has(r.team) ? "East" : "West") === conf).map(r => ({team:r.team, pts:(r.pts_pg||0)*(r.games||0), g:r.games})); rows.sort((a,b) => b.pts - a.pts || a.g - b.g); return {rank: rows.findIndex(r => r.team === T.D.team)+1, of: rows.length}; }

function render(main){
  const s = T.s, cur = s.year === 2026 && s.forecast;
  main.innerHTML = identity() + plate() + `<div id="tmgr"></div>` + piecesSection() + playSection() + resultsSection() + (cur ? runinSection() : "") + rankSection() + moneySection() + detailSection();
  if(PP.managerCard) PP.managerCard(T.D.team, T.year).then(html => { const el = $("#tmgr"); if(el) el.outerHTML = html; });
  PP.bindDisclosures(main);
  $$(".tseason button", main).forEach(b => b.addEventListener("click", () => { location.hash = `#team-${T.D.slug}-${b.dataset.y}`; }));
  PP.chart($("#tstrength"), drawStrength);
  PP.chart($("#tzones"), drawZones);
  $$(".tzmode button").forEach(b => b.addEventListener("click", () => { T.zoneMode = b.dataset.m; $$(".tzmode button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawZones($("#tzones")); }));
  PP.chart($("#txi"), drawXI);
  PP.chart($("#tresults"), drawResults);
  if($("#televo")) PP.chart($("#televo"), drawElo);
  if($("#tseeds")) PP.chart($("#tseeds"), drawSeeds);
  $$(".cstrip").forEach(el => PP.chart(el, drawStrip));
  ["#tstrength","#tzones","#txi","#tresults","#televo","#tseeds",".cstrips","#tsquad",".tstyle"].forEach(q => $$(q).forEach(PP.bindTips));
}

/* identity */
function identity(){
  const {D, s, years, year} = T, cr = confRank(), el = s.elo ? rankOf("elo") : null;
  const facts = [["Record", `${s.w}–${s.d}–${s.l}`], ["Points", `${s.pts} from ${s.games}`], cr.rank ? ["Conference", `${PP.ord(cr.rank)} in the ${D.conference} on points`] : null,
    s.formation ? ["Shape", `${s.formation}${s.formation_share ? `, ${Math.round(s.formation_share*100)}% of matches` : ""}`] : null].filter(Boolean);
  const crest = PP.crestImg(D.team, 112);
  return `<div class="wrap"><section class="pid${crest ? " has-ph" : ""}" aria-labelledby="tname">
    ${crest ? `<div class="pid-ph pid-crest">${crest}</div>` : ""}
    <span class="r-label">${chip(D.team)} ${D.conference}ern Conference</span>
    <h1 class="r-name" id="tname">${esc(full(D.team))}</h1>
    <dl class="pfacts">${facts.map(([k,v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${years.length > 1 ? `<div class="seg pseason tseason" role="group" aria-label="Season">${years.map(y => `<button type="button" data-y="${y}" aria-pressed="${y===year}">${y}</button>`).join("")}</div>` : ""}
  </section></div>`;
}

/* plate: strength */
function whyTeam(){
  const s = T.s, nm = short(T.D.team), xr = rankOf("xgd_pg"), pr = rankOf("pts_pg");
  if(!xr || !pr) return "";
  const gd = s.gf - s.ga, xgd = s.xgf - s.xga, gap = gd - xgd;
  let t = `${esc(nm)} have ${s.pts} points from ${s.games} matches (${PP.ord(pr.rank)} in MLS per match) and an expected-goal difference of ${sgn(s.xgd_pg,2)} per match (${PP.ord(xr.rank)}).`;
  if(Math.abs(pr.rank - xr.rank) >= 6) t += pr.rank < xr.rank ? ` Their results are running well ahead of their chances: a goal difference of ${sgn(gd,0)} from chances worth ${sgn(xgd,1)}.` : ` Their results are lagging their chances: a goal difference of ${sgn(gd,0)} from chances worth ${sgn(xgd,1)}.`;
  else t += ` Their results and their chances tell the same story (goal difference ${sgn(gd,0)}, expected ${sgn(xgd,1)}).`;
  return t;
}
function plate(){
  const s = T.s, cur = s.year === 2026 && s.elo, er = cur ? rankOf("elo") : null, sv = rankOf("squad_value"), F = s.forecast || {};
  const hist = s.history || [], n = hist.length, eloMove = cur && s.elo_traj && s.elo_traj.length > 4 ? s.elo - (hist.length >= 5 ? hist[n-5][3] : s.elo_traj[0][1]) : null, poMove = n >= 5 ? hist[n-1][1] - hist[n-5][1] : null;
  const left = cur ? `<span class="r-label">Team strength, ${PP.dateLong(PP.data.home.as_of)}</span>
      <span class="r-figure">${PP.int(s.elo)}</span>
      <div class="sub-fig"><span>${PP.ord(er.rank)} strongest of ${er.of} clubs</span><span>The rating every match forecast starts from, built half from results and half from chances (expected goals), with home advantage and margin.</span></div>`
    : `<span class="r-label">Points per match, ${s.year}</span><span class="r-figure">${num(s.pts_pg,2)}</span><div class="sub-fig"><span>${PP.ord(rankOf("pts_pg").rank)} of ${rankOf("pts_pg").of} clubs</span><span>Team strength ratings are shown for the current season only.</span></div>`;
  return `<div class="wrap"><section class="plate pplate" aria-label="Team strength">
    <div class="pp-left">${left}
      <div class="sig-cap"><span class="r-label">${cur ? "Every club's strength" : "Every club's points per match"}</span><span class="r-small">${cur ? "Strength rating, today" : s.year}</span></div>
      <div class="chart" id="tstrength"></div>
      <div class="indicators">
        <div class="ind"><span class="r-label">Chances</span><span class="v num">${sgn(s.xgd_pg,2)} xG per match</span><span class="r-small">${PP.ord(rankOf("xgd_pg").rank)} in MLS: ${num(s.xgf_pg,2)} created, ${num(s.xga_pg,2)} allowed per match.</span></div>
        ${cur ? `<div class="ind"><span class="r-label">Outlook</span><span class="v">${pct(F.p_playoffs)} playoffs</span><span class="r-small">${pct(F.p_champion)} to win MLS Cup; ${Math.round(F.proj_points)} points projected (${Math.round(F.points_p10)} to ${Math.round(F.points_p90)}).</span></div>
        <div class="ind"><span class="r-label">Movement, four weeks</span>${eloMove!=null ? `<span class="v"><span class="tri ${eloMove>=0?"up":"down"}" aria-hidden="true"></span><span class="num">${sgn(eloMove,0)} strength</span></span>` : `<span class="v">–</span>`}<span class="r-small">${poMove!=null ? `Playoff chance ${PP.pp(poMove)} points (${pctShort(hist[n-5][1])} to ${pctShort(hist[n-1][1])}).` : ""}</span></div>`
        : `<div class="ind"><span class="r-label">Squad value</span><span class="v num">${sgn(s.squad_value,1)} goals</span><span class="r-small">${sv ? `${PP.ord(sv.rank)} of ${sv.of} clubs.` : ""}</span></div>`}
      </div>
    </div>
    <div class="pp-right">
      <div class="fig-cap"><span class="r-label">Where they play, per match</span>
        <div class="seg tzmode zmode" role="group" aria-label="Which value"><button type="button" data-m="create" aria-pressed="true">Creating</button><button type="button" data-m="win" aria-pressed="false">Winning it</button><button type="button" data-m="concede" aria-pressed="false">Conceding</button></div></div>
      <div class="chart" id="tzones"></div>
      <div id="tzleg" class="zleg"></div>
      <p class="r-small" id="tzcap"></p>
      <p class="r-note pp-why">${whyTeam()}</p>
    </div>
  </section></div>`;
}
function drawStrength(el){
  const s = T.s, cur = s.year === 2026 && s.elo, key = cur ? "elo" : "pts_pg", rows = lg().filter(r => r[key] != null), W = el.clientWidth; if(!W || !rows.length) return;
  const H = 70; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Every club's ${cur?"strength rating":"points per match"}`},el);
  const vals = rows.map(r => r[key]), lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi-lo)*0.06, sx = v => 10 + (v-lo+pad)/(hi-lo+2*pad)*(W-20), ay = 34;
  S("line",{x1:10,x2:W-10,y1:ay,y2:ay,class:"g-line"},svg);
  const mean = vals.reduce((a,b)=>a+b)/vals.length; S("line",{x1:sx(mean),x2:sx(mean),y1:ay-12,y2:ay+12,stroke:"var(--mid)","stroke-width":2},svg); text(svg, sx(mean), ay-16, "league average", "t-axis", {"text-anchor":"middle"});
  rows.forEach((r,i) => { if(r.team === T.D.team) return; S("circle",{cx:sx(r[key]),cy:ay+((i%3)-1)*4,r:4,fill:"var(--dot)",stroke:"var(--raised)","stroke-width":1,"data-tip":`<b>${esc(full(r.team))}</b><br>${cur?`Strength ${PP.int(r[key])}`:`${num(r[key],2)} points per match`}`},svg); });
  const v = cur ? s.elo : s.pts_pg;
  S("rect",{x:sx(v)-6.5,y:ay-6.5,width:13,height:13,fill:"var(--signal)",stroke:"var(--raised)","stroke-width":2,transform:`rotate(45 ${sx(v)} ${ay})`,"data-tip":`<b>${esc(full(T.D.team))}</b><br>${cur?`Strength ${PP.int(v)}`:`${num(v,2)} points per match`}`},svg);
  text(svg, sx(v), ay+24, short(T.D.team), "t-lab", {"text-anchor": sx(v) > W-50 ? "end" : sx(v) < 50 ? "start" : "middle"});
  [lo, hi].forEach((x,k) => { if(Math.abs(sx(x) - sx(v)) > 70) text(svg, k ? W-10 : 10, H-4, cur ? PP.int(x) : num(x,2), "t-axis", {"text-anchor": k ? "end" : "start"}); });
}
function drawZones(el){
  const z = T.s.zones || {}, m = T.zoneMode, arr = z[m];
  const cap = {create:"Value of their own possessions, by where each action happened.", win:"Value of winning the ball back, by where they won it.", concede:"Value opponents created against them, drawn as if attacking their goal on the left. Red is danger they allowed."}[m];
  $("#tzcap") && ($("#tzcap").textContent = cap);
  if(!arr){ el.innerHTML = `<div class="missing"><b>Not available</b><span>No located actions for this season.</span></div>`; return; }
  const zmax = m === "win" ? 0.25 : 0.06, cells = arr.map(v => (m === "concede" ? -v : v) / 1e4);
  PP.zoneMap(el, cells, {maxW:640, zmax, unit:"goals per match", whose:"their", label:`${full(T.D.team)}: where they ${m === "create" ? "create" : m === "win" ? "win the ball back" : "concede"}`});
  PP.zoneLegend($("#tzleg"), zmax, "goals per match");
}

/* pieces: XI on the pitch, squad value, run-in value */
function piecesSection(){
  const s = T.s, ros = s.roster || [], sv = rankOf("squad_value"), out = new Set(s.out || []), squad = s.squad ? new Set(s.squad) : null;
  const groups = {}; ros.forEach(p => { const g = POSG[p.pos] || "Position not recorded"; (groups[g] = groups[g] || []).push(p); });
  const val = p => p.pos === "GK" ? p.gp : p.rating;
  const all = ros.map(val).filter(v => v != null), M = Math.max(1, ...all.map(Math.abs));
  const row = p => { const v = val(p), gone = squad && !squad.has(p.id), off = out.has(p.id);
    return `<a class="sqrow${gone?" gone":""}" href="#player-${p.id}-${s.year}" data-tip="${esc(`<b>${esc(p.name)}</b><br>${PP.POS[p.pos]||"Position not recorded"}, ${PP.int(p.mins)} minutes<br>${p.pos==="GK"?`${sgn(p.gp,1)} goals prevented`:`${sgn(p.rating)} goals above replacement`}${p.lo!=null?` (range ${num(p.lo,1)} to ${num(p.hi,1)})`:""}<br>${PP.SLOT[p.slot]||p.slot||"No contract type on record"}${p.comp?`, ${money(p.comp)}`:""}`)}">
      <span class="nm">${esc(p.name)}${PP.badgeMini(PP.badgesFor(p.id, s.year, T.D.team))}${off?` <span class="tag">out</span>`:""}${gone?` <span class="tag">left</span>`:""}</span><span class="r-small">${PP.int(p.mins)} min</span>
      <span class="dz"><span class="z"></span>${v!=null?`<span class="b ${v>=0?"pos":"neg"}" style="${v>=0?`left:50%;width:${v/M*50}%`:`left:${50+v/M*50}%;width:${-v/M*50}%`}"></span>`:""}</span><span class="num v">${v!=null?sgn(v,2):"–"}</span></a>`; };
  const order = ["Goalkeepers","Defence","Midfield","Attack","Position not recorded"];
  const sq = order.filter(g => groups[g]).map(g => { const tot = groups[g].map(val).filter(v => v != null).reduce((a,b)=>a+b,0);
    const main = groups[g].filter(p => p.mins >= 450), rest = groups[g].filter(p => p.mins >= 1 && p.mins < 450);
    return `<div class="sqgroup"><div class="sqhead"><span>${g}</span><span class="num">${sgn(tot,1)}</span></div>${main.map(row).join("")}${rest.length ? `<details class="sqmore"><summary>${rest.length} more under 450 minutes</summary>${rest.map(row).join("")}</details>` : ""}</div>`; }).join("");
  const imp = s.impact || [];
  const impH = imp.length ? `<div class="impact"><h3 class="r-heading">Who they can least afford to lose</h3><p class="r-small">The rest of the season re-simulated with each of their four most valuable outfield players replaced by a replacement-level player. Computed ${PP.dateLong(s.impact_date)} with the earlier lineup model (Elo plus lineup strength).</p>
      <div class="tbl-wrap"><table class="dtable"><thead><tr><th>Without</th><th class="n">Points</th><th class="n">Playoffs</th><th class="n">MLS Cup</th></tr></thead><tbody>${imp.map(p => `<tr><td><a href="#player-${p.id}">${esc(p.name)}</a></td><td class="n">${sgn(p.d_points,1)}</td><td class="n">${PP.pp(p.d_playoffs)} pts</td><td class="n">${PP.pp(p.d_cup)} pts</td></tr>`).join("")}</tbody></table></div></div>` : "";
  return `<section class="band" id="pieces" aria-labelledby="pieces-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="pieces-h">How the pieces fit together</h2><p>The most-used starting eleven of ${s.year}, each player drawn by the value he adds above a replacement at his position, and every player's share of the squad's total. Keepers count by goals prevented.</p></div>
    <div class="pieces">
      <div class="pleft"><figure class="tfig"><div class="fig-cap"><span class="r-label">Most-used eleven${s.formation?`, ${esc(s.formation)}`:""}</span><span class="r-small">Size and colour: value added in ${s.year}</span></div><div class="chart" id="txi"></div></figure>${impH}</div>
      <aside class="aside" id="tsquad">
        <div class="sqtotal"><span class="r-label">Squad value above replacement</span><span class="r-figure" style="font-size:var(--t-36)">${sgn(s.squad_value,1)}</span><span class="r-small">goals${sv?`, ${PP.ord(sv.rank)} of ${sv.of} clubs`:""}</span></div>
        ${sq}
      </aside>
    </div>
  </div></section>`;
}
function drawXI(el){
  const s = T.s, xi = s.lineup || [], W = Math.min(el.clientWidth, 760); if(!W) return;
  if(!xi.length){ el.innerHTML = `<div class="missing"><b>Not available</b><span>No starting lineups on record for this season.</span></div>`; return; }
  const portrait = W < 520, H = portrait ? Math.round(W*105/68) : Math.round(W*68/105); el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Most-used eleven of ${full(T.D.team)} with each player's value`},el);
  let sx, sy;
  if(portrait){                                                            // attack runs up the screen
    const px = (L, Wd) => ({x: Wd/68*W, y: H - L/105*H});
    sx = (L, Wd) => Wd/68*W; sy = L => H - L/105*H;
    S("rect",{x:0,y:0,width:W,height:H,rx:4,class:"pitch-ground"},svg);
    const R = (L0, W0, l, w) => S("rect",{x:W0/68*W,y:H-(L0+l)/105*H,width:w/68*W,height:l/105*H,class:"pitch-line"},svg);
    R(0,0,105,68); S("line",{x1:0,x2:W,y1:H/2,y2:H/2,class:"pitch-line"},svg); S("circle",{cx:W/2,cy:H/2,r:9.15/68*W,class:"pitch-line"},svg);
    R(0,13.84,16.5,40.32); R(88.5,13.84,16.5,40.32); R(0,24.84,5.5,18.32); R(99.5,24.84,5.5,18.32);
  } else { const b = PP.pitchBase(svg, W, H, false); PP.pitchLines(svg, b.sx, b.sy); sx = b.sx; sy = b.sy; }
  // lineup x: 0 = left flank, 1 = right flank; y: 1 = own goal. Attacking right, the right flank is at the bottom.
  const at = p => { const L = 6 + (1 - p.y) * 88; return portrait ? {cx: (6 + p.x * 56)/68*W, cy: H - L/105*H} : {cx: sx(L), cy: sy(6 + (1 - p.x) * 56)}; };
  xi.forEach(p => { const c = at(p), q = {x:0,y:0}, v = p.value, rr = Math.max(9, Math.min(W/(portrait?18:26), 9 + Math.abs(v||0) * 3.2)), f = PP.valueFill(v||0, 5);
    S("circle",{cx:c.cx,cy:c.cy,r:rr,fill:f,stroke:"var(--paper)","stroke-width":2,"data-tip":`<b>${esc(p.player)}</b><br>${PP.POS[p.pos]||""}, started ${Math.round((p.share||0)*100)}% of matches<br>${p.pos==="GK"?"Keeper value":"Value above replacement"}: ${sgn(v,2)}<br>${PP.SLOT[p.contract]||p.contract||""}`},svg);
    text(svg, c.cx, c.cy+4, sgn(v,1), "t-axis", {"text-anchor":"middle",style:`fill:${PP.inkOn(f)};font-weight:650;font-size:11px`});
    text(svg, c.cx, c.cy+rr+13, surname(p.player), "t-lab halo-w", {"text-anchor":"middle"});
  });
}

/* how they play */
function playSection(){
  const s = T.s, P = s.poss || {}, f = P.for || {}, a = P.against || {}, comps = T.L.components;
  const rk = (key, hiGood=true) => { const r = rankOf(key, hiGood); return r ? `${PP.ord(r.rank)} of ${r.of}` : ""; };
  const rkLow = key => { const r = rankOf(key, false); return r ? (r.rank === 1 ? "the lowest in MLS" : `${PP.ord(r.rank)} lowest of ${r.of}`) : ""; };
  const met = (label, v, sub) => `<div class="metric"><span class="r-label">${label}</span><span class="mv num">${v}</span><span class="r-small">${sub}</span></div>`;
  const metrics = f.per_match ? `<div class="metrics m4">
      ${met("Actions per possession", f.length.toFixed(1), `Opponents: ${(a.length||0).toFixed(1)}. Longer means more patient build-up.`)}
      ${met("Reach the attacking third", Math.round(f.f3*100)+"%", `${rk("poss_f3")} in MLS. Opponents: ${Math.round((a.f3||0)*100)}%`)}
      ${met("End in a shot", Math.round(f.shot*100)+"%", `Opponents: ${Math.round((a.shot||0)*100)}%`)}
      ${met("Value per possession", sgn(f.value,4), `${rk("poss_value")} in MLS. Opponents: ${sgn(a.value||0,4)}, ${rkLow("poss_value_against")}`)}
    </div>` : "";
  const st = s.style, nClubs = lg().length;
  const bar = k => { const i = comps.indexOf(k); if(!st || i < 0 || !st[i] || st[i][1] == null) return ""; const [v, p] = st[i], band = Math.min(5, Math.floor(p*5-1e-9)+1), pos = nClubs - Math.round(p*nClubs) + 1;
    return `<div class="sk" data-tip="${esc(`<b>${COMPL[k]}</b><br>${sgn(v,4)} goals per match from the whole squad (raw possession value)<br>${PP.ord(pos)} of ${nClubs} clubs`)}"><span class="lbl">${COMPL[k]}</span><span class="track"><span class="fill" style="width:${Math.max(2,p*100)}%;background:var(--pct-${band})"></span></span><span class="p${pos<=3?" top":""}">${PP.ord(pos)}</span></div>`; };
  const attK = ["passing","setpiece","carrying","dribbling","shooting","receiving","security"], defK = ["interceptions","tackles","recoveries","clearances","blocks","aerials","high_regains"];
  return `<section class="band" id="play" aria-labelledby="play-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="play-h">How they play</h2><p>Their possessions, and the squad's skills added together, ranked among the ${lg().length} clubs. The pitch map above shows where all of it happens.</p></div>
    ${metrics}
    ${st ? `<div class="tstyle"><h3 class="r-heading">The squad's skills, per match</h3><p class="r-small">Each bar is the club's rank among MLS clubs (higher is better) for the value its players add with each skill, per match.</p>
      <div class="skills2"><div class="sk-group"><span class="r-label">With the ball</span>${attK.map(bar).join("")}</div><div class="sk-group"><span class="r-label">Winning it back</span>${defK.map(bar).join("")}</div></div></div>` : ""}
  </div></section>`;
}

/* results and chances */
function resultsSection(){
  const s = T.s, cur = s.year === 2026 && s.elo_traj;
  const ms = s.matches || [];
  let pts = 0, xp = 0; ms.forEach(m => { pts += m[3] > m[4] ? 3 : m[3] === m[4] ? 1 : 0; if(m[5] != null && m[6] != null) xp += xpts(m[5], m[6]); });
  return `<section class="band" id="results" aria-labelledby="res-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="res-h">Results against chances</h2><p>Every match of ${s.year}: the expected-goal difference from our shot model as a bar, the result above it, and the running points total against the points those chances would usually earn (${pts} against ${xp.toFixed(1)} so far).</p></div>
    <figure class="tfig"><div class="chart" id="tresults"></div><div class="legend"><span><i class="lg-line" style="--c:var(--ink)"></i>Points</span><span><i class="lg-line" style="--c:var(--signal)"></i>Points the chances would usually earn</span><span><i style="width:10px;height:10px;background:var(--turf);display:inline-block;border-radius:2px"></i>Created more</span><span><i style="width:10px;height:10px;background:var(--flare);display:inline-block;border-radius:2px"></i>Allowed more</span></div></figure>
    ${cur ? `<figure class="tfig" style="margin-top:var(--s-6)"><div class="fig-cap"><span class="r-label">Team strength through ${s.year}</span><span class="r-small">Strength rating after each match (half results, half chances); the shaded band is the middle half of the league</span></div><div class="chart" id="televo"></div></figure>` : ""}
  </div></section>`;
}
function pois(k, l){ let p = Math.exp(-l); for(let i=1;i<=k;i++) p *= l/i; return p; }
function xpts(a, b){ let w=0, d=0; for(let i=0;i<10;i++) for(let j=0;j<10;j++){ const p = pois(i,a)*pois(j,b); if(i>j) w+=p; else if(i===j) d+=p; } return 3*w + d; }
function drawResults(el){
  const ms = T.s.matches || [], W = el.clientWidth; if(!W || !ms.length) return; const H = 300; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Expected-goal difference and results for every match, with running points against expected points"},el);
  const n = ms.length, m = {l:34,r:40,t:24,b:28}, iw = W-m.l-m.r, band = iw/n, top = 160, mid = m.t + top/2;
  let pts = 0, xp = 0; const P = [], X = [];
  ms.forEach(x => { pts += x[3] > x[4] ? 3 : x[3] === x[4] ? 1 : 0; if(x[5] != null) xp += xpts(x[5], x[6]); P.push(pts); X.push(xp); });
  // upper panel: running points vs expected points
  const pmax = Math.max(P[n-1], X[n-1], 3), py = v => m.t + top - v/pmax*top;
  const pst = pmax > 40 ? 20 : pmax > 16 ? 10 : 5; for(let v = 0; v <= pmax; v += pst){ S("line",{x1:m.l,x2:m.l+iw,y1:py(v),y2:py(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, py(v)+4, v, "t-axis", {"text-anchor":"end"}); }
  const line = (arr, c) => S("path",{d:arr.map((v,i) => (i?"L":"M")+(m.l+band*i+band/2)+","+py(v)).join(""),fill:"none",stroke:c,"stroke-width":2,"stroke-linejoin":"round"},svg);
  line(X, "var(--signal)"); line(P, "var(--ink)");
  text(svg, m.l+iw+4, py(P[n-1])+4, P[n-1], "t-lab", {}); text(svg, m.l+iw+4, py(X[n-1])+4, X[n-1].toFixed(0), "t-lab2", {style:"fill:var(--signal)"});
  // lower panel: xG difference bars and results
  const by = m.t + top + 34, bh = H - m.b - by, xd = ms.map(x => (x[5]??0) - (x[6]??0)), M = Math.max(1, ...xd.map(Math.abs)), bz = by + bh/2, bs = v => v/M*bh/2;
  S("line",{x1:m.l,x2:m.l+iw,y1:bz,y2:bz,class:"g-base"},svg);
  text(svg, m.l-8, by+6, "xG", "t-axis", {"text-anchor":"end"});
  const bw = Math.max(2, Math.min(14, band*0.6));
  ms.forEach((x,i) => { const cx = m.l+band*i+band/2, v = xd[i], res = x[3] > x[4] ? "W" : x[3] === x[4] ? "D" : "L";
    S("rect",{x:cx-bw/2,y:v>=0?bz-bs(v):bz,width:bw,height:Math.max(1,Math.abs(bs(v))),fill:v>=0?"var(--turf)":"var(--flare)",rx:1.5},svg);
    const cy = by - 12; S("circle",{cx,cy,r:Math.min(5, band*0.35),fill:res==="W"?"var(--ink)":res==="D"?"var(--paper)":"var(--paper)",stroke:res==="L"?"var(--ink-3)":"var(--ink)","stroke-width":res==="L"?1.5:1.5,"stroke-dasharray":res==="L"?"2 1.5":""},svg);
    S("rect",{x:cx-band/2,y:m.t,width:band,height:H-m.t-m.b,class:"hit","data-tip":`<b>${new Date(x[0]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}, ${x[2]?"v":"at"} ${esc(short(x[1]))}</b><br>${x[3]}–${x[4]} (${res==="W"?"won":res==="D"?"drew":"lost"})<br>xG ${num(x[5],2)} to ${num(x[6],2)}<br>Points ${P[i]}, chances worth ${X[i].toFixed(1)}`},svg); });
  text(svg, m.l, H-8, "Match 1", "t-axis", {}); text(svg, m.l+iw, H-8, `Match ${n}`, "t-axis", {"text-anchor":"end"});
  const lg2 = S("g",{},svg); [["W","won",""],["D","drew",""],["L","lost","2 1.5"]].forEach(([k,l,da],i) => { const x0 = m.l + i*58; S("circle",{cx:x0+5,cy:m.t-12,r:4.5,fill:k==="W"?"var(--ink)":"var(--paper)",stroke:k==="L"?"var(--ink-3)":"var(--ink)","stroke-width":1.5,"stroke-dasharray":da},lg2); text(lg2, x0+14, m.t-8, cap(l), "t-axis", {}); });
}
function drawElo(el){
  const s = T.s, tr = s.elo_traj || [], W = el.clientWidth; if(!W || tr.length < 2) return; const H = 220; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Strength rating after each match"},el);
  const m = {l:44,r:56,t:12,b:24}, iw = W-m.l-m.r, ih = H-m.t-m.b, day = d => (new Date(d+"T12:00:00Z") - new Date(tr[0][0]+"T12:00:00Z"))/864e5, D1 = day(tr[tr.length-1][0]) || 1;
  const hist = s.history || [], allE = lg().map(r => r.elo).filter(Boolean).sort((a,b) => a-b), q1 = allE[Math.floor(allE.length*0.25)], q3 = allE[Math.floor(allE.length*0.75)];
  const vals = tr.map(x => x[1]).concat([q1, q3]), y0 = Math.floor((Math.min(...vals)-10)/20)*20, y1 = Math.ceil((Math.max(...vals)+10)/20)*20, sy = v => m.t + ih - (v-y0)/(y1-y0)*ih, sx = d => m.l + d/D1*iw;
  S("rect",{x:m.l,y:sy(q3),width:iw,height:Math.max(1,sy(q1)-sy(q3)),fill:"var(--well)"},svg);
  for(let v = y0; v <= y1; v += (y1-y0 > 120 ? 40 : 20)){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:"g-line"},svg); text(svg, m.l-8, sy(v)+4, PP.int(v), "t-axis", {"text-anchor":"end"}); }
  S("path",{d:tr.map((x,i) => (i?"L":"M")+sx(day(x[0]))+","+sy(x[1])).join(""),fill:"none",stroke:"var(--ink)","stroke-width":2,"stroke-linejoin":"round"},svg);
  const L = tr[tr.length-1]; S("circle",{cx:sx(day(L[0])),cy:sy(L[1]),r:4.5,fill:"var(--ink)",stroke:"var(--paper)","stroke-width":2},svg);
  text(svg, sx(day(L[0]))+8, sy(L[1])+4, PP.int(L[1]), "t-lab", {});
  [["03-01","Mar"],["05-01","May"],["07-01","Jul"],["09-01","Sep"]].forEach(([d,l]) => { const dd = day(`${s.year}-${d}`); if(dd > 0 && dd < D1) text(svg, sx(dd), H-6, l, "t-axis", {"text-anchor":"middle"}); });
  tr.forEach((x,i) => { const nx = tr[i+1], w = nx ? sx(day(nx[0])) - sx(day(x[0])) : 12; S("rect",{x:sx(day(x[0]))-Math.min(w,12)/2,y:m.t,width:Math.max(4,Math.min(w,12)),height:ih,class:"hit","data-tip":`<b>${new Date(x[0]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}</b><br>Strength ${PP.int(x[1])}`},svg); });
}

/* run-in: playoff outlook */
function runinSection(){
  const s = T.s, F = s.forecast, seeds = s.seeds || [], home = seeds.slice(0,4).reduce((a,b)=>a+b,0), sch = s.schedule, rem = s.remaining || [];
  const rounds = [["Reach the playoffs", F.p_playoffs], ["Round One", F.p_round1], ["Conference semifinal", F.p_semis], ["Conference final", F.p_conf_final], ["MLS Cup final", F.p_cup_final], ["Win MLS Cup", F.p_champion]].filter(x => x[1] != null);
  const funnel = rounds.map(([l,p]) => `<div class="fn"><span>${l}</span><span class="tr"><i style="width:${Math.max(0.5,p*100)}%"></i></span><span class="num">${pct(p)}</span></div>`).join("");
  const conf = T.D.conference + "ern Conference";
  const fx = rem.map(m => { const k = m.kickoff_utc ? PP.kick(m.kickoff_utc) : null;
    return `<div class="rfx fxl" data-href="#match-${m.id}"><span class="r-small">${k ? `${k.day.replace(/^(\w+) /,"$1, ")}` : m.date}</span><span class="who">${m.home?"v":"at"} <a href="#team-${PP.slug(m.opp)}">${clubTag(m.opp)}</a> <span class="r-small">strength ${PP.int(m.opp_elo)}</span></span>
      <span class="pbar"><i style="width:${m.p_win*100}%;background:var(--signal)"></i><i style="width:${m.p_draw*100}%;background:var(--mid)"></i><i style="width:${m.p_loss*100}%;background:var(--rule-strong)"></i></span>
      <span class="num r-small"><b>${pctShort(m.p_win)}</b> win, ${pctShort(m.p_draw)} draw, ${pctShort(m.p_loss)} loss</span>
      <span class="r-small">${m.stake && m.if_win != null ? `${cap(STAKE(m.stake, conf))}: ${pct(m.if_win)} with a win, ${pct(m.if_loss)} with a defeat` : ""}</span></div>`; }).join("");
  return `<section class="band well" id="runin" aria-labelledby="runin-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="runin-h">The run-in</h2><p>${rem.length} regular-season matches left. The season is simulated 20,000 times from today's strengths, with lineup news where it exists; these are the shares of simulations.</p></div>
    <div class="runin">
      <div class="rcol"><h3 class="r-heading">Where they finish in the ${conf}</h3><p class="r-small">Seeds one to four host a best-of-three Round One series: ${pct(home)} chance.</p><div class="chart" id="tseeds"></div>
        <h3 class="r-heading" style="margin-top:var(--s-5)">How far they go</h3><div class="funnel">${funnel}</div>
        <p class="r-small">Projected ${Math.round(F.proj_points)} points, between ${Math.round(F.points_p10)} and ${Math.round(F.points_p90)} in eight seasons out of ten.</p></div>
      <div class="rcol"><h3 class="r-heading">What is left</h3>${sch ? `<p class="r-small">Remaining opponents average a strength rating of ${PP.int(sch.opp_elo)}, the ${PP.ord(sch.rank)} hardest schedule of ${sch.of}; ${sch.home} of ${sch.n} at home.</p>` : ""}<div class="rfixtures">${fx || `<p class="r-small">No matches left.</p>`}</div></div>
    </div>
  </div></section>`;
}
function drawSeeds(el){
  const seeds = T.s.seeds || [], W = el.clientWidth; if(!W || !seeds.length) return; const H = 150; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Chance of finishing in each conference position"},el);
  const n = seeds.length, m = {l:8,r:8,t:18,b:30}, band = (W-m.l-m.r)/n, ih = H-m.t-m.b, M = Math.max(...seeds, 0.05);
  seeds.forEach((p,i) => { const k = i+1, x = m.l + band*i, h = p/M*ih, col = k <= 4 ? "var(--signal)" : k <= 9 ? "var(--pct-2)" : "var(--rule-strong)";
    S("rect",{x:x+2,y:m.t+ih-h,width:Math.max(2,band-4),height:Math.max(p>0?1:0,h),fill:col,rx:2,"data-tip":`<b>${PP.ord(k)} in the conference</b><br>${pct(p)}${k<=4?"<br>Hosts Round One":k<=7?"<br>Round One away":k<=9?"<br>Wild-card game":"<br>Misses the playoffs"}`},svg);
    if(p >= 0.03) text(svg, x+band/2, m.t+ih-h-5, Math.round(p*100)+"%", "t-axis", {"text-anchor":"middle"});
    text(svg, x+band/2, H-m.b+15, k, "t-axis", {"text-anchor":"middle",style:k<=9?"fill:var(--ink-2)":""}); });
  S("line",{x1:m.l,x2:W-m.r,y1:m.t+ih,y2:m.t+ih,class:"g-base"},svg);
  const x9 = m.l + band*9; S("line",{x1:x9,x2:x9,y1:m.t,y2:H-m.b+4,stroke:"var(--ink-3)","stroke-dasharray":"3 3"},svg);
  text(svg, x9-4, H-4, "playoff line", "t-axis", {"text-anchor":"end"});
}

/* where they rank */
function rankSection(){
  const s = T.s, cur = s.year === 2026;
  const metrics = [["pts_pg","Points per match",true,v=>num(v,2)],["xgd_pg","Expected-goal difference per match",true,v=>sgn(v,2)],["xgf_pg","Expected goals created per match",true,v=>num(v,2)],
    ["xga_pg","Expected goals allowed per match",false,v=>num(v,2)],["squad_value","Squad value above replacement",true,v=>sgn(v,1)],["poss_value","Value per possession",true,v=>sgn(v,4)]].concat(cur ? [["elo","Strength rating",true,v=>PP.int(v)],["p_playoffs","Chance of the playoffs",true,v=>pctShort(v)]] : []);
  return `<section class="band" id="ranks" aria-labelledby="rank-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="rank-h">Where they rank</h2><p>Every club in ${s.year} on each measure; ${esc(short(T.D.team))} is the diamond. Better is to the right.</p></div>
    <div class="cstrips">${metrics.map(([k,l,hg,f]) => { const r = rankOf(k, hg); const me = lg().find(x => x.team === T.D.team) || {};
      return `<div class="cs"><span class="cl">${l}</span><span class="chart cstrip" data-k="${k}" data-hg="${hg?1:0}"></span><span class="cv num">${me[k]!=null?f(me[k]):"–"}<span class="r-small">${r?` ${PP.ord(r.rank)}`:""}</span></span></div>`; }).join("")}</div>
  </div></section>`;
}
function drawStrip(el){
  const k = el.dataset.k, hg = el.dataset.hg === "1", rows = lg().filter(r => r[k] != null), W = el.clientWidth; if(!W || !rows.length) return;
  const H = 26; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":k},el);
  const v = rows.map(r => r[k]), lo = Math.min(...v), hi = Math.max(...v), sx = x => 8 + ((hg ? x-lo : hi-x)/((hi-lo)||1))*(W-16);
  S("line",{x1:8,x2:W-8,y1:H/2,y2:H/2,class:"g-line"},svg);
  rows.forEach(r => { if(r.team === T.D.team) return; S("circle",{cx:sx(r[k]),cy:H/2,r:4,fill:"var(--dot)","data-tip":`<b>${esc(full(r.team))}</b><br>${k==="p_playoffs"?pct(r[k]):k==="elo"?PP.int(r[k]):num(r[k],k==="poss_value"?4:2)}`},svg); });
  const me = rows.find(r => r.team === T.D.team);
  if(me) S("rect",{x:sx(me[k])-6,y:H/2-6,width:12,height:12,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":2,transform:`rotate(45 ${sx(me[k])} ${H/2})`},svg);
}

/* money */
function moneySection(){
  const s = T.s, sl = (s.slots || []).filter(x => x.players);
  if(!sl.length) return "";
  const M = Math.max(...sl.map(x => Math.abs(x.vs_slot||0)), 1);
  return `<section class="band" id="money" aria-labelledby="money-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="money-h">What the money buys</h2><p>Value added by players on each kind of contract, against what a typical player on that contract returns in the same minutes. Pay is guaranteed compensation.</p></div>
    <div class="tbl-wrap"><table class="dtable mtable"><thead><tr><th>Contract type</th><th class="n">Players</th><th class="n">Pay</th><th class="n">Value</th><th>Against a typical player on that contract</th><th class="n">Beating it</th></tr></thead>
    <tbody>${sl.map(x => `<tr><td>${PP.SLOT[x.slot]||x.slot}</td><td class="n">${x.players}</td><td class="n">${money(x.pay)}</td><td class="n">${sgn(x.value,1)}</td>
      <td><span class="dg" style="display:grid;grid-template-columns:minmax(80px,1fr) 52px;gap:8px;align-items:center"><span class="dz"><span class="z"></span><span class="b ${x.vs_slot>=0?"pos":"neg"}" style="${x.vs_slot>=0?`left:50%;width:${x.vs_slot/M*50}%`:`left:${50+x.vs_slot/M*50}%;width:${-x.vs_slot/M*50}%`}"></span></span><span class="num" style="text-align:right">${sgn(x.vs_slot,1)}</span></span></td><td class="n">${x.beating} of ${x.players}</td></tr>`).join("")}</tbody></table></div>
  </div></section>`;
}

/* detail */
function detailSection(){
  const s = T.s, ros = s.roster || [], ms = (s.matches || []).slice().reverse(), out = new Set(s.out || []), squad = s.squad ? new Set(s.squad) : null;
  const disc = (id, title, inner) => `<div class="ddisc"><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="${id}">${title}</button><div class="disc" id="${id}" aria-hidden="true"><div><div class="why-body">${inner}</div></div></div></div>`;
  const rr = ros.map(p => `<tr><td><a href="#player-${p.id}-${s.year}">${esc(p.name)}</a>${out.has(p.id)?" (out)":""}${squad&&!squad.has(p.id)?" (left)":""}</td><td>${(PP.POS[p.pos]||"–").toLowerCase()}</td><td class="n">${PP.int(p.mins)}</td><td class="n">${p.pos==="GK"?`${sgn(p.gp,1)} prevented`:sgn(p.rating)}</td><td class="n">${p.lo!=null?`${num(p.lo,1)} to ${num(p.hi,1)}`:"–"}</td><td>${PP.SLOT[p.slot]||p.slot||"–"}</td><td class="n">${p.comp?money(p.comp):"–"}</td><td class="n">${p.slot_value!=null?sgn(p.slot_value):"–"}</td></tr>`).join("");
  const mr = ms.map(x => `<tr><td>${new Date(x[0]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}</td><td>${x[2]?"v":"at"} ${esc(short(x[1]))}</td><td class="n">${x[3]}–${x[4]}</td><td class="n">${num(x[5],2)}</td><td class="n">${num(x[6],2)}</td></tr>`).join("");
  const hr = T.seasons.slice().reverse().map(x => `<tr><td><a href="#team-${T.D.slug}-${x.year}">${x.year}</a></td><td class="n">${x.games}</td><td class="n">${x.w}–${x.d}–${x.l}</td><td class="n">${x.pts}</td><td class="n">${x.gf}–${x.ga}</td><td class="n">${num(x.xgf,1)}–${num(x.xga,1)}</td><td class="n">${PP.ord(x.pts_pg_rank)}</td><td class="n">${PP.ord(x.xgd_pg_rank)}</td><td class="n">${sgn(x.squad_value,1)}</td></tr>`).join("");
  return `<section class="band" id="tdetail" aria-labelledby="tdet-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="tdet-h">Detailed data</h2><p>The numbers behind every chart on this page.</p></div>
    ${disc("t-roster", `Every player, ${s.year}`, `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Player</th><th>Position</th><th class="n">Minutes</th><th class="n">Value</th><th class="n">90% range</th><th>Contract type</th><th class="n">Pay</th><th class="n">Against type</th></tr></thead><tbody>${rr}</tbody></table></div>`)}
    ${disc("t-matches", `Every match, ${s.year}`, `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Date</th><th>Opponent</th><th class="n">Score</th><th class="n">xG for</th><th class="n">xG against</th></tr></thead><tbody>${mr}</tbody></table></div>`)}
    ${disc("t-history", "Every season", `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Season</th><th class="n">Played</th><th class="n">Record</th><th class="n">Points</th><th class="n">Goals</th><th class="n">xG</th><th class="n">Points rank</th><th class="n">xG difference rank</th><th class="n">Squad value</th></tr></thead><tbody>${hr}</tbody></table></div><p class="r-small">Ranks are per match among all clubs that season.</p>`)}
  </div></section>`;
}
})();
