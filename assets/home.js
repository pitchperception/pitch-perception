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
      ${lead(H)}
      <div class="rail">${[insRace(H), insContract(H)].join("")}</div>
    </div>
  </div>
  ${H.chain ? chainBand(H) : ""}
  <section class="band" id="wkteaser" aria-labelledby="wkt-h" hidden></section>
  ${raceBand(H)}
  ${moversBand(H)}
  ${nextBand(H)}
  ${leadersBand(H)}`;
  PP.bindDisclosures(main);
  PP.chart($("#scatter"), drawScatter);
  PP.chart($("#bridge"), drawBridge);
  PP.chart($("#spark"), drawSpark);
  PP.chart($("#payvalue"), drawPayValue);
  $$(".mv-glyph").forEach(el => PP.chart(el, drawMover));
  $$(".race-chart").forEach(el => PP.chart(el, drawRace));
  if(H.chain){ PP.chart($("#pitch"), drawPitch); PP.chart($("#steps"), drawSteps); }
  ["#scatter","#bridge","#spark","#payvalue","#pitch","#steps","#lboard",".rail","#movers-band"].forEach(s => $$(s).forEach(PP.bindTips));
  if(H.chain) bindChain();
  bindRaceTools();
  weekTeaser();
};

/* ---------------- the week in review, teaser (82 / weeks.js) ---------------- */
async function weekTeaser(){
  const I = await PP.loadWeeks(); if(!I || !I.weeks.length) return;
  const wk = PP.latestWeek(I); let W; try { [W] = await Promise.all([PP.loadWeek(wk.week), PP.loadArch()]); } catch(e){ return; }
  const el = $("#wkteaser"); if(!el || location.hash.replace("#","") && location.hash !== "#today") return;
  const P = (W.players || []).slice(0, 5), top = P[0];
  el.innerHTML = `<div class="wrap"><div class="band-head"><span class="kicker">The week in review</span><h2 class="r-title" id="wkt-h">${top ? `${PP.plink(top[0], top[1])} was the player of the week` : "The week in review"}</h2>
      <p>${esc(PP.weekRange(wk))}. ${top ? `${PP.plink(top[0], surname(top[1]))} added ${sgn(top[6],2)} goals above replacement for ${esc(short(top[2]))}, the most in MLS. ` : ""}<a href="#week-${wk.week}">The full week: team of the week, awards and every match report</a>.</p></div>
    <div class="wkteaser"><div class="wklist">${P.map((p,k) => `<a class="wkrow" href="#player-${p[0]}"><span class="rk">${k+1}</span><span class="nm">${esc(p[1])}${PP.badgeMini(PP.badgesFor(p[0], 2026, p[2]))}</span><span class="meta">${chip(p[2])}${esc(short(p[2]))}</span><span class="tr"><i style="width:${Math.max(2, Math.abs(p[6])/Math.abs(P[0][6]||1)*100)}%;background:var(--turf)"></i></span><span class="v num">${sgn(p[6],2)}</span></a>`).join("")}</div>
      <figure style="margin:0"><div class="fig-cap"><span class="r-label">Team of the week</span><span class="r-small">${esc(W.formation || "4-3-3")}; hover a player</span></div><div class="chart" id="hometotw"></div></figure></div></div>`;
  el.hidden = false;
  PP.chart($("#hometotw"), e => PP.drawEleven(e, W.xi || [], {maxV: 1, maxW: 640, tip: p => `<b>${esc(p.player)}</b>, ${esc(short(p.team))}<br>${p.keeper ? `${sgn(p.value,2)} goals prevented` : `${sgn(p.value,2)} goals above replacement`}`}));
  PP.bindTips($("#hometotw"));
}

/* ---------------- edition line ---------------- */
function dateline(H){
  const d = new Date(H.as_of + "T12:00:00Z").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).replace(",", "");
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
  const note2 = `${cupLine} Finishing and shot-stopping are the least repeatable parts of the game in our tests: year-to-year correlations of about 0.05 and 0.18.`;
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
      <p class="r-small" style="font-size:var(--t-13);color:var(--ink-2);max-width:64ch">Expected goals come from a shot model fitted to MLS for this site: each shot is worth the share of similar shots that were scored. Goals prevented compare the goals a keeper conceded with the post-shot expected goals of the shots he faced, centred so an average keeper is zero. The dashed line on the chart is the league-wide fit of points on expected-goal difference; a team's height above it is points the chances alone would not explain.</p>
    </div></div></div></div>
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

function insRace(H){
  const t = H.race.teams.slice().sort((a,b) => b.move_playoffs - a.move_playoffs), up = t[0], dn = t[t.length-1];
  const ago = h => h.hist_playoffs[h.hist_playoffs.length-5];
  const head = `<a href="#team-${PP.slug(up.team)}">${esc(short(up.team))}</a>'s playoff chances rose from ${pct(ago(up))} to ${pct(up.p_playoffs)} in four weeks`;
  const body = `${cap(formText(up.form_4w))}. Over the same weeks ${esc(short(dn.team))} fell from ${pct(ago(dn))} to ${pct(dn.p_playoffs)}, taking ${formText(dn.form_4w)}.`;
  const rows = (arr) => arr.map(x => `<tr><td>${clubTag(x.team)}</td><td class="n">${pctShort(ago(x))}</td><td class="n">${pctShort(x.p_playoffs)}</td><td class="n" style="font-weight:600">${pp(x.move_playoffs)}</td><td class="n">${x.form_4w.pts} / ${x.form_4w.n*3}</td></tr>`).join("");
  const why = `<table class="mini-table"><thead><tr><th>Biggest moves</th><th class="n">4 wk ago</th><th class="n">Now</th><th class="n">Points</th><th class="n">Pts won</th></tr></thead><tbody>${rows(t.slice(0,3))}${rows(t.slice(-3).reverse())}</tbody></table>
    <p class="r-small">Chance of reaching the playoffs (top nine in each conference). Points are percentage points. Each week is the forecast reconstructed with today's model, using only the results known by then, ${H.race.dates.length} weeks in all.</p>`;
  return ins("ins-race", "Playoff race", head, body, `<div class="chart micro" id="spark"></div>`, why);
}
function drawSpark(el){
  const H = PP.data.home, t = H.race.teams.slice().sort((a,b) => b.move_playoffs - a.move_playoffs), lines = [[t[0],"var(--turf)"],[t[t.length-1],"var(--flare)"]];
  const W = el.clientWidth; if(!W) return; const Ht = 110; el.innerHTML = "";
  const svg = S("svg",{width:W,height:Ht,viewBox:`0 0 ${W} ${Ht}`,role:"img","aria-label":"Playoff chances through the season for the biggest riser and faller"},el);
  const n = H.race.dates.length, m = {l:30,r:96,t:8,b:18}, iw = W-m.l-m.r, ih = Ht-m.t-m.b, sx = i => m.l + i/(n-1)*iw, sy = v => m.t + ih - v*ih;
  S("rect",{x:sx(n-5),y:m.t,width:sx(n-1)-sx(n-5),height:ih,fill:"var(--well)"},svg);
  [0,0.5,1].forEach(v => { S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-6, sy(v)+4, (v*100)+"%", "t-axis", {"text-anchor":"end"}); });
  text(svg, sx(n-5)+4, Ht-4, "last 4 weeks", "t-axis", {});
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
  const maxPay = Math.max(...cheap.map(p => p.comp)), under = Math.ceil((maxPay+1)/5000)*5000;
  const rest = top.filter(p => !cheapSlots.includes(p.slot));
  const head = `${cap(PP.WORDS[cheap.length]||String(cheap.length))} of the ${PP.WORDS[top.length]} most valuable players this season earn under ${money(under)}`;
  const names = cheap.map(p => `<a href="#player-${p.ws_player_id}">${esc(p.player)}</a>`);
  const list = names.length > 1 ? names.slice(0,-1).join(", ") + " and " + names[names.length-1] : names[0];
  const body = (rest.length ? `Behind ${rest.map(p => `<a href="#player-${p.ws_player_id}">${esc(p.player)}</a> (${money(p.comp)})`).join(" and ")} come ` : "") + `${list}, on Senior, Supplemental and Homegrown contracts rather than Designated Player or TAM deals.`;
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
  text(svg, cx+10, cy+2, W < 420 ? `${cheap.length} more, under $${Math.round(lim/1000)}k` : `${cheap.length} more, all under ${money(lim)}`, "t-anno halo", {});
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
    return `<div class="race-conf" data-conf="${c}" data-hidden="${c!==biggest}">
      <div class="fig-cap"><h3 class="r-heading">${c}ern Conference</h3><span class="r-small">Chance of the playoffs, last twelve weeks</span></div>
      <div class="chart race-chart" data-conf="${c}"></div>
      <div class="settled">${through.length?`<span><b>Through:</b> ${through.map(x => `<a href="#team-${PP.slug(x.team)}">${esc(short(x.team))}</a>`).join(", ")}</span>`:""}${out.length?`<span><b>Out:</b> ${out.map(x => `<a href="#team-${PP.slug(x.team)}">${esc(short(x.team))}</a>`).join(", ")}</span>`:""}</div>
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
        <span class="r-label" style="padding-bottom:6px">Who added what, in goals. Select a player to see his actions.</span>
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
        <p class="r-note" style="font-size:var(--t-15)">Every action is valued by how much it changes the chance that a possession ends in a goal, at either end. A player's value is the sum, measured against what a replacement-level player at his position would add in the same minutes.</p>
        ${def.length ? `<p class="r-note" style="font-size:var(--t-15)">${cap(PP.WORDS[def.length]||String(def.length))} of the top ten earn most of their value by winning the ball back: ${and(names(def))}. ${att.length ? `${and(names(att))} earn${att.length===1?"s":""} most of ${att.length===1?"his":"theirs"} on the ball.` : ""}</p>` : ""}
        <a href="#players" class="btn-text">Every player</a>
      </aside>
    </div>
  </div></section>`;
}
})();
