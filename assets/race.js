/* Pitch Perception: the playoff race. Data: data/race.json. */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, short, full, chip, clubTag} = PP;
let raceP = null, R = null, finP = null;
const load = () => raceP || (raceP = fetch("data/race.json").then(r => { if(!r.ok) throw new Error(`race.json returned ${r.status}`); return r.json(); }));
// the final regular-season race (owner, 2026-10-27): #race-final, frozen by 74 when the last league match was in
const loadFinal = () => finP || (finP = fetch("data/race_final.json").then(r => { if(!r.ok) throw new Error(`race_final.json returned ${r.status}`); return r.json(); }));
const STAKE = (s, conf) => ({"top 7":"a top-seven finish","playoffs":"the playoffs","1st in conference":`first place in the ${conf}`,"Supporters' Shield":"the Supporters' Shield","MLS Cup":"MLS Cup"}[s] || s);
const METRICS = [["p_playoffs","Playoffs"],["p_top7","Top seven"],["p_conf_1st","First in conference"],["p_champion","MLS Cup"],["elo","Strength"]];

PP.pages.race = async (main, h) => {
  const over = !!(PP.data.home || {}).season_over, fin = h === "race-final";
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">${over ? "The playoffs" : "The playoff race"}</h1><p class="r-small">Loading the forecast.</p></section></div>`;
  // once the regular season is over the tab is the playoffs (owner, 2026-10-27): the clubs still in, their chance of each
  // round, the bracket and the matches (playoffs.js, data/playoffs.json); the race below stays for the regular season
  if(over && !fin){ const P = await PP.loadPlayoffs(); if(location.hash.slice(1) !== "race") return; if(P && P.phase && P.phase !== "regular"){ PP.poPage(main, P); return; } }
  if(fin){
    let F; try { F = await loadFinal(); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The final regular-season table is not saved yet</h1><p>It is saved the night the last league match is in. <a href="#race">The playoffs</a></p></section></div>`; return; }
    if(location.hash.slice(1) !== "race-final") return;
    R = {D: F, conf: "East", metric: "p_playoffs", sel: null, final: true};
    render(main); return;
  }
  let D; try { D = await load(); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The forecast did not load</h1><p>${esc(e.message)}. Reload the page; if it persists, the site needs republishing.</p></section></div>`; return; }
  if(location.hash.slice(1) !== "race") return;
  R = {D, conf: "West", metric: "p_playoffs", sel: null};
  const t = D.teams, n = D.dates.length;
  const mv = t.map(x => ({...x, move: x.hist.p_playoffs[n-1] - x.hist.p_playoffs[n-5]}));
  R.conf = mv.sort((a,b) => Math.abs(b.move) - Math.abs(a.move))[0].conference;
  render(main);
};

function render(main){
  const D = R.D;
  main.innerHTML = header() + landscape() + trajectories() + movers() + bubble() + matter() + disagree() + title() + production() + method();
  $$(".rconf button").forEach(b => b.addEventListener("click", () => { R.conf = b.dataset.c; $$(".rconf button").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.c === R.conf))); $$(".lgrid").forEach(g => g.dataset.hidden = String(g.dataset.conf !== R.conf)); PP.redraw(); }));
  $$(".rmetric button").forEach(b => b.addEventListener("click", () => { R.metric = b.dataset.m; $$(".rmetric button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $$(".rtraj").forEach(el => drawTraj(el)); }));
  $$(".lrow2").forEach(r => r.addEventListener("click", e => { if(e.target.closest("a")) return; R.sel = R.sel === r.dataset.team ? null : r.dataset.team; $$(".lrow2").forEach(x => x.classList.toggle("on", x.dataset.team === R.sel)); $$(".rtraj").forEach(el => drawTraj(el)); }));
  $$(".rtraj").forEach(el => PP.chart(el, drawTraj));
  $$(".rbub").forEach(el => PP.chart(el, drawBubble));
  PP.bindDisclosures(main);
  [".landscape",".rtrajs",".rbubs"].forEach(q => $$(q).forEach(PP.bindTips));
}

function header(){
  const D = R.D, d = new Date(D.as_of+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",timeZone:"UTC"});
  if(R.final) return `<div class="wrap"><section class="pid"><h1 class="r-name">The final regular-season table</h1>
    <p class="r-note standfirst">The table at the end of the regular season, and the playoff odds as they stood on ${d}, before the first playoff match. This page is frozen.</p>
    <p class="dateline">Results through ${PP.dateLong(D.data_through)}. <a href="#race">The playoffs: today's chances, the bracket and the matches</a></p>
  </section></div>`;
  const fav = D.teams.slice().sort((a,b) => b.p_champion - a.p_champion)[0];
  return `<div class="wrap"><section class="pid"><h1 class="r-name">The playoff race</h1>
    <p class="r-note standfirst">The rest of the season played out ${PP.int(D.sims)} times from today's team strengths, with lineup news where it exists. ${esc(short(fav.team))} are the most likely champions, at ${pct(fav.p_champion)}.</p>
    <p class="dateline">Forecast of ${d}; results through ${PP.dateLong(D.data_through)}; ${D.remaining} regular-season matches left. Nine clubs per conference reach the playoffs; seeds one to four host a best-of-three Round One series.</p>
  </section></div>`;
}

/* the landscape: finishing-position distribution per conference */
function landscape(){
  const D = R.D, n = D.dates.length;
  const grid = c => {
    const ts = D.teams.filter(t => t.conference === c).sort((a,b) => a.exp_conf_rank - b.exp_conf_rank);
    const rows = ts.map(t => { const home = t.seeds.slice(0,4).reduce((a,b)=>a+b,0), mv = t.hist.p_playoffs[n-1] - t.hist.p_playoffs[n-5];
      const cells = t.seeds.map((p,i) => { const band = p < 0.005 ? 0 : Math.min(5, Math.floor(p*5-1e-9)+1); return `<i class="lc${i===3?" l4":""}${i===8?" l9":""}" style="${band?`background:var(--pct-${band})`:""}" data-tip="<b>${esc(full(t.team))}</b><br>${PP.ord(i+1)} in the ${c}: ${pct(p)}">${p>=0.2?`<b style="color:${band>=4?"var(--paper)":"var(--ink)"}">${Math.round(p*100)}</b>`:""}</i>`; }).join("");
      return `<div class="lrow2" data-team="${esc(t.team)}" tabindex="0"><span class="lpos num">${t.pos}</span><a class="lteam" href="#team-${PP.slug(t.team)}">${chip(t.team)}<span class="nmL">${esc(short(t.team))}</span><span class="nmS">${(PP.CLUB[t.team]||[t.team])[0]}</span></a><span class="lpts num">${t.points_now}<small>/${t.played}</small></span>
        <span class="lcells">${cells}</span><span class="lp num">${pctShort(t.p_playoffs)}</span><span class="lp num">${pctShort(home)}</span><span class="lp num">${pctShort(t.p_champion)}</span>
        <span class="lmv num">${Math.abs(mv) >= 0.005 ? `<span class="tri ${mv>0?"up":"down"}" aria-hidden="true"></span>${PP.pp(mv)}` : "–"}</span></div>`; }).join("");
    return `<div class="lgrid" data-conf="${c}" data-hidden="${c!==R.conf}"><h3 class="r-heading">${c}ern Conference</h3>
      <div class="lhead"><span class="lpos">Now</span><span class="lteam">Club</span><span class="lpts">Pts</span><span class="lcells">${Array.from({length:15},(_,i)=>`<i>${i+1}</i>`).join("")}</span><span class="lp">Playoffs</span><span class="lp">Hosts R1</span><span class="lp">Cup</span><span class="lmv">4 wk</span></div>${rows}</div>`;
  };
  return `<section class="band" id="landscape" aria-labelledby="land-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="land-h">Where every club finishes</h2><p>Each row is a club's chance of finishing in each position in its conference, darker for likelier. The solid line after fourth marks home advantage in Round One; the dashed line after ninth is the playoff cut. "Now" is today's table position. Select a row to follow the club in the charts below.</p></div>
    <div class="seg rconf race-tools" role="group" aria-label="Conference">${["East","West"].map(c => `<button type="button" data-c="${c}" aria-pressed="${c===R.conf}">${c}</button>`).join("")}</div>
    <div class="landscape">${grid("East")}${grid("West")}</div>
    <div class="pct-key" style="margin-top:var(--s-4)">${[1,2,3,4,5].map(i => `<span><i style="background:var(--pct-${i})"></i>${["0–20%","20–40%","40–60%","60–80%","80–100%"][i-1]}</span>`).join("")}<span>Numbers shown where the chance is 20% or more</span></div>
  </div></section>`;
}

/* trajectories */
function trajectories(){
  return `<section class="band well" id="traj" aria-labelledby="rt-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="rt-h">How the race has moved</h2><p>The forecast as it stood after every week of the season, recomputed with today's model (team strength only, without lineup news) from the results known at the time. Green lines rose ten points or more in the last four weeks, red lines fell; select a club in the table above, or hover, to follow one.</p></div>
    <div class="seg rmetric" role="group" aria-label="Measure" style="margin-bottom:var(--s-4)">${METRICS.map(([k,l]) => `<button type="button" data-m="${k}" aria-pressed="${k===R.metric}">${l}</button>`).join("")}</div>
    <div class="rtrajs">${["East","West"].map(c => `<figure class="tfig"><div class="fig-cap"><h3 class="r-heading">${c}ern Conference</h3></div><div class="chart rtraj" data-conf="${c}"></div></figure>`).join("")}</div>
  </div></section>`;
}
function drawTraj(el){
  const D = R.D, conf = el.dataset.conf, key = R.metric, W = el.clientWidth; if(!W) return;
  const ts = D.teams.filter(t => t.conference === conf), n = D.dates.length, H = 340, narrow = W < 520; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`${conf}ern Conference: ${key} each week`},el);
  const m = {l:44,r:narrow?62:112,t:10,b:24}, iw = W-m.l-m.r, ih = H-m.t-m.b, sx = i => m.l + i/(n-1)*iw;
  const isP = key !== "elo", all = ts.flatMap(t => t.hist[key].filter(v => v != null));
  const y0 = isP ? 0 : Math.floor(Math.min(...all)/50)*50, y1 = isP ? (key === "p_champion" ? Math.max(0.1, Math.ceil(Math.max(...all)*10)/10) : 1) : Math.ceil(Math.max(...all)/50)*50, sy = v => m.t + ih - (v-y0)/(y1-y0)*ih;
  const step = isP ? (y1 <= 0.4 ? 0.1 : 0.25) : 50;
  S("rect",{x:sx(n-5),y:m.t,width:sx(n-1)-sx(n-5),height:ih,fill:"var(--paper)"},svg);
  for(let v = y0; v <= y1+1e-9; v += step){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:Math.abs(v-y0)<1e-9?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, isP ? Math.round(v*100)+"%" : PP.int(v), "t-axis", {"text-anchor":"end"}); }
  const seen = {}; D.dates.forEach((d,i) => { const k = d.slice(0,7); if(!(k in seen)){ seen[k] = i; if(i > 0 && (!narrow || ["03","05","07","09"].includes(k.slice(5)))) text(svg, sx(i), H-6, new Date(k+"-15T12:00:00Z").toLocaleDateString("en-GB",{month:"short",timeZone:"UTC"}), "t-axis", {"text-anchor":"middle"}); } });
  const mv = t => t.hist.p_playoffs[n-1] - t.hist.p_playoffs[n-5], col = t => R.sel ? (t.team === R.sel ? "var(--signal)" : "var(--ink-3)") : mv(t) >= 0.1 ? "var(--turf)" : mv(t) <= -0.1 ? "var(--flare)" : "var(--ink-3)";
  const strong = t => R.sel ? t.team === R.sel : Math.abs(mv(t)) >= 0.1;
  const paths = new Map();
  ts.slice().sort((a,b) => strong(a) - strong(b)).forEach(t => { const pts = t.hist[key].map((v,i) => v == null ? null : [sx(i), sy(v)]).filter(Boolean);
    const p = S("path",{d:pts.map((q,i) => (i?"L":"M")+q[0]+","+q[1]).join(""),fill:"none",stroke:col(t),"stroke-width":strong(t)?2.25:1.1,"stroke-opacity":strong(t)?1:(R.sel?0.35:0.55),"stroke-linejoin":"round",style:"transition:opacity 120ms ease-out"},svg); paths.set(t.team, p); });
  const lastv = t => t.hist[key][n-1];
  const ends = ts.filter(t => lastv(t) != null).map(t => ({t, y: sy(lastv(t))})).sort((a,b) => a.y - b.y);
  for(let i = 1; i < ends.length; i++) if(ends[i].y - ends[i-1].y < 12.5) ends[i].y = ends[i-1].y + 12.5;
  const over = ends.length ? ends[ends.length-1].y - (m.t+ih+4) : 0; if(over > 0) ends.forEach(e => e.y -= over);
  ends.forEach(e => text(svg, sx(n-1)+7, e.y+4, `${narrow ? (PP.CLUB[e.t.team]||[e.t.team])[0] : short(e.t.team)} ${isP ? pctShort(lastv(e.t)) : PP.int(lastv(e.t))}`, strong(e.t) ? "t-lab" : "t-lab2", {style: strong(e.t) ? "" : "opacity:.75"}));
  const cross = S("line",{x1:0,x2:0,y1:m.t,y2:m.t+ih,stroke:"var(--ink-3)",opacity:0},svg), ov = S("rect",{x:m.l,y:m.t,width:iw,height:ih,fill:"transparent"},svg);
  const move = e => { const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n-1, Math.round((e.clientX-r.left-m.l)/iw*(n-1)))), y = e.clientY - r.top;
    let best = null, bd = 1e9; ts.forEach(t => { const v = t.hist[key][i]; if(v == null) return; const dd = Math.abs(sy(v) - y); if(dd < bd){ bd = dd; best = t; } });
    cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("opacity", 1);
    paths.forEach((p,k) => p.style.opacity = !best || k === best.team ? 1 : 0.2);
    if(best){ const v = best.hist[key][i]; PP.showTip(`<b>${esc(full(best.team))}</b><br>${new Date(D.dates[i]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}: ${isP ? pct(v) : "Strength "+PP.int(v)}<br>Now ${isP ? pct(lastv(best)) : PP.int(lastv(best))}`, e.clientX, e.clientY); } };
  ov.addEventListener("pointermove", move); ov.addEventListener("pointerdown", move);
  ov.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); paths.forEach(p => p.style.opacity = 1); PP.hideTip(); });
}

/* movers */
function movers(){
  const D = R.D, n = D.dates.length, ago = D.ago;
  const t = D.teams.map(x => ({...x, mv: x.hist.p_playoffs[n-1] - x.hist.p_playoffs[n-5], emv: (x.hist.elo[n-1]||0) - (x.hist.elo[n-5]||0), cmv: x.hist.p_champion[n-1] - x.hist.p_champion[n-5]}));
  const up = t.filter(x => x.mv > 0.005).sort((a,b) => b.mv - a.mv).slice(0,5), dn = t.filter(x => x.mv < -0.005).sort((a,b) => a.mv - b.mv).slice(0,5);
  const form = f => f.n ? `${f.w}–${f.d}–${f.l}, ${f.pts} pts, goals ${f.gf}–${f.ga}` : "no matches";
  const row = x => `<div class="mvr"><a class="nm" href="#team-${PP.slug(x.team)}">${chip(x.team)}${esc(short(x.team))}</a>
      <span class="num">${pctShort(x.hist.p_playoffs[n-5])} <span aria-hidden="true">to</span> <b>${pctShort(x.hist.p_playoffs[n-1])}</b></span>
      <span class="num mvv"><span class="tri ${x.mv>0?"up":"down"}" aria-hidden="true"></span>${PP.pp(x.mv)}</span>
      <span class="r-small">${form(x.form_4w)}; strength ${sgn(x.emv,0)}</span></div>`;
  return `<section class="band" id="movers" aria-labelledby="mv2-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="mv2-h">What changed in four weeks</h2><p>Playoff chances now against the forecast of ${new Date(ago+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",timeZone:"UTC"})}, with each club's results since. A club can also move without playing well or badly, when its rivals do.</p></div>
    <div class="movers2"><div><h3 class="r-heading">Rising</h3>${up.map(row).join("") || `<p class="r-small">No club gained.</p>`}</div><div><h3 class="r-heading">Falling</h3>${dn.map(row).join("") || `<p class="r-small">No club lost ground.</p>`}</div></div>
  </div></section>`;
}

/* uncertainty: final points ranges */
function bubble(){
  return `<section class="band" id="bubble" aria-labelledby="bub-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="bub-h">Still to be decided</h2><p>Where each club's final points total lands in eight seasons out of ten (the bar), against its points today (the hollow mark) and its projection (the diamond). Overlapping bars are the races still open.</p></div>
    <div class="rbubs">${["East","West"].map(c => `<figure class="tfig"><div class="fig-cap"><h3 class="r-heading">${c}ern Conference</h3></div><div class="chart rbub" data-conf="${c}"></div></figure>`).join("")}</div>
  </div></section>`;
}
function drawBubble(el){
  const D = R.D, conf = el.dataset.conf, ts = D.teams.filter(t => t.conference === conf).sort((a,b) => b.proj_points - a.proj_points), W = el.clientWidth; if(!W) return;
  const rh = 22, m = {l:W<480?84:118,r:16,t:8,b:28}, H = m.t + ts.length*rh + m.b; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`${conf}ern Conference final points ranges`},el);
  const lo = Math.floor(Math.min(...ts.map(t => t.points_now))/5)*5, hi = Math.ceil(Math.max(...ts.map(t => t.points_p90))/5)*5, sx = v => m.l + (v-lo)/(hi-lo)*(W-m.l-m.r);
  for(let v = lo; v <= hi; v += 10){ S("line",{x1:sx(v),x2:sx(v),y1:m.t,y2:H-m.b,class:"g-line"},svg); text(svg, sx(v), H-8, v, "t-axis", {"text-anchor":"middle"}); }
  const cut = ts[8], cutY = m.t + 9*rh;
  S("line",{x1:m.l-4,x2:W-m.r,y1:cutY,y2:cutY,stroke:"var(--ink-3)","stroke-dasharray":"3 3"},svg);
  text(svg, W-m.r, cutY+11, "playoff line by projection", "t-axis", {"text-anchor":"end"});
  ts.forEach((t,i) => { const y = m.t + i*rh + rh/2, open = t.p_playoffs > 0.02 && t.p_playoffs < 0.98;
    text(svg, m.l-8, y+4, short(t.team), open ? "t-lab" : "t-lab2", {"text-anchor":"end"});
    S("rect",{x:sx(t.points_p10),y:y-4,width:Math.max(2,sx(t.points_p90)-sx(t.points_p10)),height:8,rx:3,fill:open?"var(--signal)":"var(--band)",opacity:open?0.45:1},svg);
    S("circle",{cx:sx(t.points_now),cy:y,r:4,fill:"var(--paper)",stroke:"var(--ink-2)","stroke-width":1.5},svg);
    S("rect",{x:sx(t.proj_points)-4.5,y:y-4.5,width:9,height:9,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":1.5,transform:`rotate(45 ${sx(t.proj_points)} ${y})`},svg);
    S("rect",{x:0,y:y-rh/2,width:W,height:rh,class:"hit","data-tip":`<b>${esc(full(t.team))}</b><br>${t.points_now} points now, ${Math.round(t.proj_points)} projected<br>Between ${Math.round(t.points_p10)} and ${Math.round(t.points_p90)} in eight seasons of ten<br>Playoffs ${pct(t.p_playoffs)}`},svg); });
}

/* matches that matter */
function matter(){
  const D = R.D, conf = t => (D.teams.find(x => x.team === t) || {}).conference || "";
  if(!D.matter || !D.matter.length) return "";                         // no league match left
  const rows = D.matter.map(m => { const k = PP.kick(m.kickoff_utc);
    const side = s => m["stake_"+s] && m["if_win_"+s] != null ? `<div><b>${esc(short(m[s]))}</b>, ${STAKE(m["stake_"+s], conf(m[s])+"ern Conference")}: ${pct(m["if_win_"+s])} with a win, ${pct(m["if_loss_"+s])} with a defeat</div>` : "";
    const dshort = k ? k.date.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"America/New_York"}) : m.date;
    return `<div class="fx fxl" data-href="#match-${m.ws_match_id}"><span class="time">${dshort}<br>${k ? k.time : ""}</span>
      <div class="teams"><a href="#team-${PP.slug(m.home)}" style="text-decoration:none">${clubTag(m.home, true)}</a><a href="#team-${PP.slug(m.away)}" style="text-decoration:none">${clubTag(m.away, true)}</a></div>
      <div class="probs"><div class="pbar" role="img" aria-label="${esc(short(m.home))} ${pct(m.pH)}, draw ${pct(m.pD)}, ${esc(short(m.away))} ${pct(m.pA)}"><i style="width:${m.pH*100}%;background:${PP.pairKit(m.home, m.away)[0]}"></i><i style="width:${m.pD*100}%;background:var(--mid)"></i><i style="width:${m.pA*100}%;background:${PP.pairKit(m.home, m.away)[1]}"></i></div>
        <div class="plab"><span><b>${pctShort(m.pH)}</b> win</span><span>${pctShort(m.pD)} draw</span><span><b>${pctShort(m.pA)}</b> win</span></div><span class="src">Importance ${Math.round(m.importance)} of 100</span></div>
      <div class="stake">${side("home")}${side("away")}</div></div>`; }).join("");
  return `<section class="band well" id="matter" aria-labelledby="mat-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="mat-h">The matches that matter most</h2><p>Ranked by how far a win or a defeat moves each side's chance of the season goal it affects most, in the same simulations. The most important remaining match scores 100.</p></div>
    <div class="fixtures">${rows}</div>
  </div></section>`;
}

/* forecast vs table */
function disagree(){
  const D = R.D, maxPlayed = {};
  D.teams.forEach(t => maxPlayed[t.conference] = Math.max(maxPlayed[t.conference]||0, t.played));
  const d = D.teams.map(t => ({...t, gap: t.pos - t.exp_conf_rank})).filter(t => Math.abs(t.gap) >= 1.5).sort((a,b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0,6);
  if(!d.length) return "";
  const why = t => { const gih = maxPlayed[t.conference] - t.played, parts = []; if(gih > 0) parts.push(`${PP.WORDS[gih]||gih} game${gih>1?"s":""} in hand`);
    const er = D.teams.filter(x => x.conference === t.conference).sort((a,b) => b.elo - a.elo).findIndex(x => x.team === t.team) + 1; parts.push(`${PP.ord(er)} strongest in the ${t.conference} by team strength`); return parts.join("; "); };
  return `<section class="band" id="vs-table" aria-labelledby="vt-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="vt-h">Where the forecast and the table disagree</h2><p>Clubs whose expected finishing position is well away from where they sit today, usually because of games in hand or a strength the table has not caught up with.</p></div>
    <div class="vtlist">${d.map(t => `<div class="vtr"><a class="nm" href="#team-${PP.slug(t.team)}">${chip(t.team)}${esc(full(t.team))}</a><span class="num">${PP.ord(t.pos)} now</span><span class="num"><b>${num(t.exp_conf_rank,1)}</b> expected</span><span class="r-small">${t.gap > 0 ? "Forecast expects them to climb" : "Forecast expects them to slip"}: ${why(t)}.</span></div>`).join("")}</div>
  </div></section>`;
}

/* title race */
function title(){
  const D = R.D, ts = D.teams.slice().sort((a,b) => b.p_champion - a.p_champion).slice(0,10), mx = ts[0].p_champion, sh = D.teams.slice().sort((a,b) => b.p_shield - a.p_shield).slice(0,4);
  return `<section class="band" id="title" aria-labelledby="ti-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="ti-h">Who wins it</h2><p>Chance of lifting MLS Cup, through every round of the 2025 playoff format. Supporters' Shield: ${sh.map(t => `${esc(short(t.team))} ${pct(t.p_shield)}`).join(", ")}.</p></div>
    <div class="funnel titlef">${ts.map(t => `<div class="fn"><a href="#team-${PP.slug(t.team)}" class="club">${chip(t.team)}${esc(short(t.team))}</a><span class="tr"><i style="width:${Math.max(0.5,t.p_champion/mx*100)}%"></i></span><span class="num">${pct(t.p_champion)}</span></div>`).join("")}</div>
  </div></section>`;
}

/* results or chances (81_forecast_alternatives.py): the headline rating beside results-only Elo */
function production(){
  const P = R.D.production; if(!P) return "";
  const T = P.teams, all = R.D.teams.map(t => ({...t, v: T[t.team]})).filter(t => t.v);
  const top = all.slice().sort((a,b) => Math.max(b.v.p_champion, b.v.p_champion_results) - Math.max(a.v.p_champion, a.v.p_champion_results)).slice(0, 10);
  const luck = all.filter(t => t.v.gd != null && t.v.xgd != null).sort((a,b) => (b.v.gd - b.v.xgd) - (a.v.gd - a.v.xgd))[0];
  const favR = all.slice().sort((a,b) => b.v.p_champion_results - a.v.p_champion_results)[0], favB = all.slice().sort((a,b) => b.v.p_champion - a.v.p_champion)[0];
  const t = P.test[P.model], ov = P.study.over, mx = Math.max(...top.map(x => Math.max(x.v.p_champion, x.v.p_champion_results)));
  const sx = v => `${(v / mx * 100).toFixed(1)}%`;
  const lead = luck ? `${esc(full(luck.team))} have a goal difference of ${PP.sgn(luck.v.gd,0)} from chances worth ${PP.sgn(luck.v.xgd,0)}: ${Math.round(luck.v.gd - luck.v.xgd)} goals better than their shots and the shots against them suggest, the most in the league. A rating built only on results (Elo) takes that at face value and makes ${luck.team === favR.team ? "them clear favourites" : "them contenders"}: ${esc(short(favR.team))} ${pct(favR.v.p_champion_results)} to win MLS Cup.` : "";
  return `<section class="band" id="production" aria-labelledby="pr-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="pr-h">Results or chances?</h2>
      <p>${lead} The forecast on this page rates teams half on results and half on chances (expected goals), which makes it ${favB.team === favR.team ? `${esc(short(favB.team))} ${pct(favB.v.p_champion)}` : `${esc(short(favB.team))} ${pct(favB.v.p_champion)} and ${esc(short(favR.team))} ${pct(favR.v.p_champion)}`}.</p></div>
    <div class="prgrid"><div>
      <div class="legend" style="margin-bottom:var(--s-3)"><span><i class="lg-m"></i>Half results, half chances (this forecast)</span><span><i class="lg-c"></i>Results only (Elo)</span></div>
      <div class="prlist">${top.map(x => { const a = x.v.p_champion, b = x.v.p_champion_results, lo = Math.min(a,b), hi = Math.max(a,b);
        return `<div class="prrow"><a href="#team-${PP.slug(x.team)}" class="club">${chip(x.team)}${esc(short(x.team))}</a><span class="prtrack" role="img" aria-label="${esc(short(x.team))}: ${pct(a)} on results and chances, ${pct(b)} on results only"><span class="link" style="left:${sx(lo)};width:calc(${sx(hi)} - ${sx(lo)})"></span><span class="c" style="left:${sx(b)}"></span><span class="m" style="left:${sx(a)}"></span></span><span class="num r-small">${pct(a)} / ${pct(b)}</span><span class="num r-small">${x.v.gd != null ? `${PP.sgn(x.v.gd,0)} goals, ${PP.sgn(x.v.xgd,0)} expected` : ""}</span></div>`; }).join("")}</div>
      <p class="r-small" style="margin-top:var(--s-3)">Chance of winning MLS Cup under each rating, from the same simulation without lineup news, so the two are like for like.</p>
    </div>
    <div class="r-note" style="font-size:var(--t-15);display:grid;gap:var(--s-3);max-width:60ch">
      <p><b>Why both?</b> We tested ratings built on chances against Elo, with the test fixed before it ran. On ${PP.int(P.n_dev)} matches from 2021–25, half results and half chances predicted results <span class="tipline" data-tip="${PP.esc(`Log loss ${PP.sgn(t.diff,4)} against Elo, 95% interval ${PP.sgn(t.ci[0],4)} to ${PP.sgn(t.ci[1],4)} (lower is better)`)}">slightly better than Elo</span>; chances alone did no better. On 2026 so far the two are level. The forecast switched to the half-and-half rating on 7 October 2026.</p>
      <p><b>Does over-performance last?</b> Partly, which is why results keep half the weight. After 27 games in 2021–25, the two biggest over-performers each season had averaged ${num(ov.ppg_first27,2)} points a game; they took ${num(ov.ppg_rest,2)} from the rest, still above the league's ${num(ov.league_rest_ppg,2)}.</p>
      <p><b>Why ${esc(short(favR.team))} stay near the top either way:</b> points already won are banked. They bring the top seed and home advantage through the playoffs, whatever the rating.</p>
    </div></div>
  </div></section>`;
}

/* method and the full table */
function method(){
  const D = R.D, b = D.backtest || {}, ll = b.log_loss || {};
  const rows = D.teams.slice().sort((a,b) => a.conference.localeCompare(b.conference) || a.exp_conf_rank - b.exp_conf_rank).map(t => `<tr><td>${t.conference}</td><td><a href="#team-${PP.slug(t.team)}">${esc(short(t.team))}</a></td><td class="n">${t.points_now}</td><td class="n">${t.played}</td><td class="n">${Math.round(t.proj_points)}</td><td class="n">${Math.round(t.points_p10)}–${Math.round(t.points_p90)}</td><td class="n">${pctShort(t.p_playoffs)}</td><td class="n">${pctShort(t.p_top7)}</td><td class="n">${pctShort(t.p_conf_1st)}</td><td class="n">${pctShort(t.p_semis)}</td><td class="n">${pctShort(t.p_conf_final)}</td><td class="n">${pctShort(t.p_cup_final)}</td><td class="n">${pctShort(t.p_champion)}</td><td class="n">${pctShort(t.p_shield)}</td></tr>`).join("");
  const disc = (id, title, inner) => `<div class="ddisc"><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="${id}">${title}</button><div class="disc" id="${id}" aria-hidden="true"><div><div class="why-body">${inner}</div></div></div></div>`;
  return `<section class="band" id="rmethod" aria-labelledby="rm-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="rm-h">How the forecast works</h2></div>
    <div class="r-note" style="font-size:var(--t-15);display:grid;gap:var(--s-3);max-width:68ch">
      <p>Each remaining match is drawn from its scoreline probabilities: team strengths from a rating built half on results and half on chances (expected goals), with home advantage and margin, turned into expected goals with a Poisson model fitted on 2021–26. Where the starting lineups or the league's availability report are known, the expected goals for that match are adjusted for who plays. Strengths are held at today's values.</p>
      <p>Ties are broken on wins, goal difference and goals for (MLS's later tiebreakers are not modelled). Each simulated season seeds its own bracket in the 2025 format: wild card between eighth and ninth, best-of-three Round One, single-match semifinals and finals at the better seed, extra time then penalties.</p>
      ${ll["B1 Elo"] ? `<p>Tested on ${PP.int(b.n)} matches from 2021–25 it was not fitted on, the results-only version of the match model <span class="tipline" data-tip="${PP.esc(`Log loss ${ll["B1 Elo"].toFixed(3)} against ${ll["B0 base rates"].toFixed(3)} for the league's usual mix alone (lower is better)`)}">did better than simply going by the league's usual mix of home wins, draws and away wins</span>, but not by much: football results are hard to call. The half-and-half rating improves on it slightly (see above). The weekly history above is reconstructed: today's model, team strength only, refitted on the results known at each date. It shows what this model would have said then, not what was published; forecasts published since 9 October 2026 are in the <a href="#matches">live record</a> (<a href="#method-record">how we check it</a>).</p>` : ""}
    </div>
    ${disc("r-table", "Every club, every probability", `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Conf.</th><th>Club</th><th class="n">Pts</th><th class="n">Played</th><th class="n">Projected</th><th class="n">Range</th><th class="n">Playoffs</th><th class="n">Top 7</th><th class="n">1st</th><th class="n">Semis</th><th class="n">Conf. final</th><th class="n">Final</th><th class="n">Champion</th><th class="n">Shield</th></tr></thead><tbody>${rows}</tbody></table></div>`)}
  </div></section>`;
}
})();
