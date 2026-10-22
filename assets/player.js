/* Pitch Perception: player page. Data: data/players/pNNN.json (one shard per id % 128), data/peers.json. */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, pctile, money, short, full, chip, clubTag} = PP;
const surname = n => PP.surname(n);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const NSHARD = 128, shardCache = {};
let peersP = null;
const shardUrl = id => `data/players/p${String(id % NSHARD).padStart(3,"0")}.json`;
const loadShard = id => { const u = shardUrl(id); if(!shardCache[u]) shardCache[u] = fetch(u).then(r => { if(!r.ok) throw new Error(`${u} returned ${r.status}`); return r.json(); }); return shardCache[u]; };
const loadPlayer = async id => { const d = await loadShard(id); return {rec: d.players[String(id)], teams: d.teams}; };
const loadPeers = () => peersP || (peersP = fetch("data/peers.json").then(r => { if(!r.ok) throw new Error(`peers.json returned ${r.status}`); return r.json(); }));

const COMP = { // key: [label, what it measures]
  passing:["Passing","How much each of his passes changed his team's chance of scoring. A completed pass shares its value with the receiver."],
  setpiece:["Set-piece delivery","Passes from corners, free kicks and other restarts."],
  carrying:["Carrying","Moving the ball with his feet between other actions."],
  dribbling:["Dribbling","Take-ons: beating a defender with the ball."],
  shooting:["Shot selection","Each shot's expected-goal value minus the value of keeping the ball where he shot from. This is chance quality, not finishing."],
  receiving:["Receiving","His half of the value of passes he received: getting to where the ball goes."],
  security:["Ball security","The value lost when he gives the ball away. Zero is the best possible score."],
  penalties:["Penalties won","Being fouled for a penalty: what the penalty is worth beyond having the ball on the spot. Left out of the rating because it barely repeats from one half-season to the next; the pass or run before the foul still earns the value of reaching the spot."],
  other:["Other touches","Every other action on the ball: headed flick-ons, clearances in possession, loose touches."],
  winning_ball:["Winning the ball","Interceptions, tackles and loose-ball recoveries together, each valued by the danger removed. The three rows beneath it are its parts."],
  interceptions:["Interceptions","Winning the ball by cutting out a pass, valued by the danger removed."],
  tackles:["Tackles","Winning the ball in a tackle, valued by the danger removed."],
  recoveries:["Loose-ball recoveries","Picking up loose balls, valued by the danger removed."],
  clearances:["Clearances","Clearances that end the opponent's possession, valued by the danger removed."],
  blocks:["Blocks","Blocked passes and crosses, valued by the danger removed."],
  aerials:["Aerials won","Aerial duels that win the ball back, valued by the danger removed."],
  high_regains:["High regains","Ball wins of any kind in the attacking third. Already counted in the rows above."],
  not_beaten:["Not dribbled past","Being dribbled past is charged half of what the attacker gained. Not part of the rating."],
  fouls:["Fouls","The value given away by fouls. Not part of the rating."]};
const SKILL_ORDER = ["passing","setpiece","carrying","dribbling","shooting","receiving","security","winning_ball","interceptions","tackles","recoveries","clearances","blocks","aerials","high_regains","not_beaten","fouls"];
const posSing = p => (PP.POS[p] || p || "player").toLowerCase();
const posPl = p => PP.POSPL[p] || "players at his position";
const conf = p => p == null ? null : p >= 0.95 ? ["Clear",3] : p >= 0.8 ? ["Likely",2] : ["Unclear",1];
/* percentile bars under the model signal: where the player ranks per 90, by position and overall (0 = lowest, 100 = highest) */
const pctBars = (rows, s) => {
  const ok = rows.filter(r => r[1] != null);
  if(s.mins < 900 || !ok.length) return `<div class="pctbars"><div class="sig-cap"><span class="r-label">Percentile, per 90</span><span class="r-small">No percentile under 900 minutes</span></div></div>`;
  const band = p => Math.min(5, Math.floor(p * 5) + 1), lab = p => p >= 0.995 ? "Top 1%" : p < 0.005 ? "Bottom 1%" : PP.ord(Math.round(p*100));
  return `<div class="pctbars"><div class="sig-cap"><span class="r-label">Percentile, per 90</span><span class="r-small">Where the player ranks: 0 lowest, 100 highest</span></div>
    ${ok.map(([l, p]) => `<div class="pctrow"><span class="pl">${esc(l)}</span><span class="pt" role="img" aria-label="${esc(l)}: ${lab(p)}"><b style="width:${Math.max(1, p*100)}%;background:var(--pct-${band(p)})"></b><i style="left:${p*100}%"></i><u></u></span><span class="pv num">${lab(p)}</span></div>`).join("")}</div>`;
};
const confGlyph = l => `<span class="conf" data-l="${l}" aria-hidden="true"><i></i><i></i><i></i></span>`;

let ST = null;   // current page state

PP.pages.player = async (main, h) => {
  const bits = h.split("-"), id = +bits[1], want = bits[2] ? +bits[2] : null;
  const ix = (PP.data.index || []).find(r => r[0] === id);
  main.innerHTML = `<div class="wrap"><section class="pid"><div class="r-label">${ix ? clubTag(ix[2], true) : ""}</div><h1 class="r-name">${ix ? esc(ix[1]) : "Player"}</h1><p class="r-small">Loading the model's numbers for this player.</p></section></div>`;
  let rec, peers, teams;
  let photo = null;
  try { [{rec, teams}, peers, , , photo] = await Promise.all([loadPlayer(id), loadPeers(), PP.loadArch(), PP.loadImages(), PP.loadPhoto(id), PP.loadRoles(), PP.loadInjuries()]); }
  catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">This player's data did not load</h1><p>${esc(e.message)}. Reload the page; if it persists, the site needs republishing.</p></section></div>`; return; }
  if(location.hash.slice(1) !== h && !(h === "player-"+id && location.hash === "")) return;
  if(!rec){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">No player with this link</h1><p>Search for him by name above.</p></section></div>`; return; }
  const seasons = rec.seasons.slice().sort((a,b) => a.year - b.year || a.mins - b.mins);
  const byYear = {}; seasons.forEach(s => { if(!byYear[s.year] || s.mins > byYear[s.year].mins) byYear[s.year] = s; });
  const years = Object.keys(byYear).map(Number).sort();
  const year = want && byYear[want] ? want : years[years.length-1];
  ST = {rec, peers, teams, byYear, years, year, s: byYear[year], cmp: null, chainI: 0, zoneMode: "t", photo};
  render(main);
};

function render(main){
  const {rec, s} = ST, gk = s.pos === "GK";
  main.innerHTML = identity() + (gk ? keeperBody() : outfieldBody());
  PP.bindDisclosures(main);
  $$(".pseason button", main).forEach(b => b.addEventListener("click", () => { location.hash = `#player-${rec.id}-${b.dataset.y}`; }));
  if(gk){ drawKeeper(); return; }
  PP.chart($("#psignal"), drawSignal);
  PP.chart($("#fingerprint"), drawFingerprint);
  PP.zoneLegend($("#zleg"), PP.ZMAX, "goals per 90");
  $$(".zmode button").forEach(b => b.addEventListener("click", () => { ST.zoneMode = b.dataset.m; $$(".zmode button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawFingerprint($("#fingerprint")); }));
  bindDecomp();
  bindChains();
  PP.chart($("#pseasons"), drawSeasons);
  PP.chart($("#pmatches"), drawMatches);
  PP.chart($("#ppeers"), drawPeers);
  bindCompare();
  ["#psignal","#fingerprint","#decomp","#ppitch","#psteps","#pseasons","#ppeers",".pid .bdgs",".pid .pfacts",".pplate .pp-left"].forEach(q => $$(q).forEach(PP.bindTips));
}

/* ---------------- identity ---------------- */
function identity(){
  const {rec, s, years, year} = ST;
  const age = rec.age != null ? rec.age - ((rec.age_year || year) - year) : null;
  const facts = [["Position", PP.POS[s.pos] || s.pos || "Not recorded"], age != null ? ["Age", `${age} in ${year}`] : null,
    s.slot ? ["Contract type", PP.SLOT[s.slot] || s.slot] : null, ["Minutes, "+year, PP.int(s.mins)],
    s.comp ? ["Guaranteed pay", money(s.comp)] : null].filter(Boolean);
  const role = s.pos !== "GK" ? PP.roleFor(rec.id, year, s.team, s.pos) : null;           // playing style (145), 900+ minutes
  if(role) facts.splice(1, 0, ["Playing style", role.label, role.tip]);
  // in his latest season the header shows his current club (latest appearance, 72); figures stay with the club they came from
  const latest = year === Math.max(...years), club = latest && rec.team ? rec.team : s.team, moved = club !== s.team;
  const ph = PP.headshot(ST.photo, club, 120);
  return `<div class="wrap"><section class="pid${ph ? " has-ph" : ""}" aria-labelledby="pname">
    ${ph ? `<div class="pid-ph">${ph}</div>` : ""}
    <a class="pclub" href="#team-${PP.slug(club)}">${PP.crestImg(club, 28) || ""}${clubTag(club, true)}</a>
    ${moved ? `<p class="r-small" style="margin:0">Now at ${esc(short(club))}. The ${year} figures below are from his ${PP.int(s.mins)} minutes at ${esc(short(s.team))}.</p>` : ""}
    <h1 class="r-name" id="pname">${esc(rec.name)}</h1>
    ${PP.badgeChips(PP.badgesFor(rec.id, year, s.team), s.pos, year)}
    <dl class="pfacts">${facts.map(([k,v,tip]) => `<div><dt>${k}</dt><dd${tip ? ` class="prole" data-tip="${esc(tip)}"` : ""}>${esc(v)}</dd></div>`).join("")}</dl>
    ${injNote(rec.id, year)}
    ${years.length > 1 ? `<div class="seg pseason" role="group" aria-label="Season">${years.map(y => `<button type="button" data-y="${y}" aria-pressed="${y===year}">${y}</button>`).join("")}</div>` : ""}
  </section></div>`;
}

/* injuries (160, owner 2026-10-21): the current status, then Transfermarkt's spells that touch this season, each with the
   club's regular-season games in that time that he did not play in (our count; Transfermarkt's covers every competition) */
function injNote(id, year){
  const I = PP.data.inj; if(!I) return "";
  const st = PP.injStatus(id, year), sp = ((I.history || {})[id] || []).filter(x => x[4] === year).sort((a,b) => a[0] < b[0] ? -1 : 1);
  if(!st && !sp.length) return "";
  const games = n => n === 0 ? "no league games missed" : `${n} league game${n === 1 ? "" : "s"} missed`;
  const missed = ((I.missed || {})[id] || {})[year] || 0;          // each game once, however many spells overlap it
  const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
  const src = st ? (st.src === "tm" ? `Transfermarkt, ${PP.dayShort(I.tm_date)}` : `MLS availability report, ${PP.dayShort(I.mls_report)}`) : "";
  const now = st ? `<p class="pinj-now"><span class="injm ${st.s === "q" ? "q" : "out"}" aria-hidden="true">${PP.INJ_SVG}</span><b>${st.s === "q" ? "Questionable" : "Out"}</b>: ${esc(st.r)}${st.since ? `, since ${PP.dayShort(st.since)}` : ""}${st.src === "tm" ? (st.back ? `. Expected back ${PP.dayShort(st.back)}` : ". No expected return given") : ""}. <span class="r-small">${src}</span></p>` : "";
  const list = sp.length ? `<ul class="pinj-list">${sp.map(x => `<li>${esc(cap(x[2]))}, ${PP.dayShort(x[0])} to ${x[1] ? PP.dayShort(x[1]) : "now"}${x[3] != null ? ` (${PP.int(x[3])} days)` : ""}: ${games(x[6])}${x[6] && x[5] ? ` for ${esc(short(x[5]))}` : ""}</li>`).join("")}</ul>` : "";
  const sum = sp.length ? `<p class="r-small">${missed ? `${PP.int(missed)} league game${missed === 1 ? "" : "s"} missed through injury in ${year}. ` : ""}Season totals count only the minutes played. Injuries: Transfermarkt.</p>` : "";
  return `<div class="pinj"><div class="r-label">Injuries, ${year}</div>${now}${list}${sum}</div>`;
}

/* ---------------- outfield ---------------- */
function prevSeason(){ const {years, year, byYear} = ST; const i = years.indexOf(year); for(let k = i-1; k >= 0; k--){ const p = byYear[years[k]]; if(p.mins >= 450 && p.p90 != null) return p; } return null; }
function parts(s){
  const d = s.decomp; if(!d) return [];
  const out = [];
  Object.entries(d.att || {}).forEach(([k,v]) => out.push({k, side:"a", v}));
  Object.entries(d.def || {}).forEach(([k,v]) => out.push({k, side:"d", v}));
  return out;
}
function whyText(){
  const {rec, s} = ST, nm = surname(rec.name), ps = parts(s).filter(p => p.k !== "other");
  const pos = ps.filter(p => p.v > 0).sort((a,b) => b.v - a.v), neg = ps.filter(p => p.v < 0).sort((a,b) => a.v - b.v)[0];
  const lead = s.attack >= s.defence ? `most of it with the ball (${sgn(s.attack)} in attack, ${sgn(s.defence)} winning it back)` : `most of it by winning the ball back (${sgn(s.defence)}, against ${sgn(s.attack)} in attack)`;
  let t = `${esc(nm)} added ${sgn(s.rating)} goals over a replacement-level ${posSing(s.pos)} in ${PP.int(s.mins)} minutes, ${lead}.`;
  if(pos.length >= 2) t += ` His biggest contributions were ${COMP[pos[0].k][0].toLowerCase()} (${sgn(pos[0].v)}) and ${COMP[pos[1].k][0].toLowerCase()} (${sgn(pos[1].v)})`;
  if(neg && pos.length >= 2) t += `; ${COMP[neg.k][0].toLowerCase()} cost him ${num(-neg.v)}.`; else if(pos.length >= 2) t += ".";
  return t;
}
function outfieldBody(){
  const {s, rec} = ST, prev = prevSeason(), ci = conf(s.p_above_repl), cs = conf(s.p_above_slot);
  const pc = s.pct || {};
  const sub = [`<span>goals more than a replacement-level ${posSing(s.pos)} would add in the same minutes</span>`, s.points_vs_repl != null ? `<span class="num">${s.points_vs_repl >= 0 ? "Worth" : "Costs the team"} about ${num(Math.abs(s.points_vs_repl),1)} points in the table</span>` : "",
    ""].join("");
  const mv = prev ? (() => { const d = s.p90 - prev.p90; return `<span class="v"><span class="tri ${d>=0?"up":"down"}" aria-hidden="true"></span><span class="num">${sgn(d,3)} per 90</span></span><span class="r-small">Since ${prev.year}: ${num(prev.p90,3)} to ${num(s.p90,3)} goals per 90.</span>`; })()
    : `<span class="v">No earlier season</span><span class="r-small">No previous season of 450+ minutes in our data.</span>`;
  const slot = s.slot_value != null ? `<span class="v num">${sgn(s.slot_value)} goals</span><span class="r-small">Against a typical ${PP.SLOT[s.slot]||s.slot} season (${num(s.benchmark)} goals).${s.points_vs_slot!=null?` ${sgn(s.points_vs_slot)} points (range ${num(s.points_vs_slot_lo)} to ${num(s.points_vs_slot_hi)}).`:""}</span>` : `<span class="v">Not available</span><span class="r-small">No contract type on record for this season.</span>`;
  return `<div class="wrap"><section class="plate pplate" aria-label="Model signal">
      <div class="pp-left">
        <span class="r-label">Value above replacement, ${s.year}</span>
        <span class="r-figure" data-tip="${esc(`Goals of expected-goal difference this player's actions added over a replacement-level ${posSing(s.pos)} in the same minutes.`)}">${sgn(s.rating)}</span>
        <div class="sub-fig">${sub}</div>
        <div class="sig-cap"><span class="r-label">Model signal</span><span class="r-small">90% range ${num(s.lo)} to ${num(s.hi)} goals</span></div>
        <div class="chart" id="psignal"></div>
        ${pctBars([[`Among ${posPl(s.pos)}`, pc.model], ["Among all outfield players", pc.league]], s)}
        <div class="indicators">
          <div class="ind"><span class="r-label">Above replacement?</span>${ci ? `<span class="v">${confGlyph(ci[1])}${ci[0]}</span><span class="r-small">${pct(s.p_above_repl)} chance this season's value is above replacement level. How sure the model is, not a ranking: the percentile ranks the player.</span>` : `<span class="v">Not available</span>`}</div>
          <div class="ind"><span class="r-label">Movement</span>${mv}</div>
          <div class="ind"><span class="r-label">Against the contract type</span>${slot}${cs ? `<span class="r-small">${confGlyph(cs[1])} ${cs[0]}: ${pct(s.p_above_slot)} chance of beating it.</span>` : ""}</div>
        </div>
      </div>
      <div class="pp-right">
        <div class="fig-cap"><span class="r-label">Where he adds value, per 90 minutes</span>
          <div class="seg zmode" role="group" aria-label="Which value"><button type="button" data-m="t" aria-pressed="true">All</button><button type="button" data-m="a" aria-pressed="false">With the ball</button><button type="button" data-m="d" aria-pressed="false">Winning it</button></div></div>
        <div class="chart" id="fingerprint"></div>
        <div id="zleg" class="zleg"></div>
        <p class="r-note pp-why">${whyText()}</p>
      </div>
    </section></div>
    ${decompSection()}
    ${impactSection()}
    ${trajectorySection()}
    ${peersSection()}
    ${detailSection()}`;
}

function drawSignal(el){
  const s = ST.s, W = el.clientWidth; if(!W) return; const H = 74; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Value above replacement ${sgn(s.rating)} goals, range ${num(s.lo)} to ${num(s.hi)}`},el);
  const lo = Math.min(-1, Math.floor(Math.min(s.lo, 0) - 0.5)), hi = Math.max(2, Math.ceil(Math.max(s.hi, s.benchmark||0) + 0.5)), m = {l:8,r:8}, ay = 36;
  const sx = v => m.l + (v-lo)/(hi-lo)*(W-m.l-m.r);
  S("line",{x1:m.l,x2:W-m.r,y1:ay,y2:ay,class:"g-line"},svg);
  const stp = hi - lo > 12 ? 4 : 2;
  for(let v = Math.ceil(lo/stp)*stp; v <= hi; v += stp){ S("line",{x1:sx(v),x2:sx(v),y1:ay+4,y2:ay+8,class:"g-base"},svg); text(svg, sx(v), ay+22, (v<0?"−":"")+Math.abs(v), "t-axis", {"text-anchor":"middle"}); }
  S("line",{x1:sx(0),x2:sx(0),y1:ay-14,y2:ay+8,stroke:"var(--mid)","stroke-width":2},svg);
  text(svg, sx(0)-4, ay-20, W < 400 ? "Repl." : "Replacement", "t-axis", {"text-anchor":"end"});
  if(s.benchmark != null && s.slot){ S("line",{x1:sx(s.benchmark),x2:sx(s.benchmark),y1:ay-14,y2:ay+8,class:"g-base"},svg); text(svg, sx(s.benchmark)+4, ay-20, `${W<400?s.slot:"Typical "+(s.slot==="TAM/GAM"?"TAM":s.slot)} ${num(s.benchmark)}`, "t-axis", {}); }
  S("rect",{x:sx(s.lo),y:ay-8,width:Math.max(2,sx(s.hi)-sx(s.lo)),height:16,rx:2,fill:"var(--band)","data-tip":`90% range: ${num(s.lo)} to ${num(s.hi)} goals`},svg);
  S("rect",{x:sx(s.rating)-6.5,y:ay-6.5,width:13,height:13,fill:"var(--signal)",stroke:"var(--raised)","stroke-width":2,transform:`rotate(45 ${sx(s.rating)} ${ay})`,"data-tip":`<b>${sgn(s.rating)} goals</b> above replacement`},svg);
}
function drawFingerprint(el){
  const s = ST.s, z = s.zones;
  if(!z){ el.innerHTML = `<div class="missing"><b>Not available</b><span>No located actions for this season.</span></div>`; return; }
  const a = z.a || Array(96).fill(0), d = z.d || Array(96).fill(0), mode = ST.zoneMode;
  const cells = a.map((v,i) => (mode === "a" ? v : mode === "d" ? d[i] : v + d[i]) / 1e4);
  PP.zoneMap(el, cells, {maxW:640, label:`Where ${ST.rec.name} adds value on the pitch`});
}

/* decomposition: exact rating parts + skills percentiles */
function decompSection(){
  const s = ST.s, d = s.decomp, sk = s.skills, keys = ST.peers.components.map(c => c.key), NOISE = ST.peers.noise_below;
  if(!d && !sk) return "";
  const P = k => sk ? sk[keys.indexOf(k)] : null;
  // reliability of each row for this player: within his position, at his minutes (68, from 2026-10-14)
  const R = k => { const p = P(k); return p && p[2] != null ? p[2] : null; }, noisy = k => R(k) != null && R(k) < NOISE;
  const vals = [...Object.values(d.att||{}), ...Object.values(d.def||{}), d.att_repl, d.def_repl, s.attack, s.defence].filter(v => v != null);
  const M = Math.max(0.5, ...vals.map(Math.abs));
  // ball security is a cost by definition (owner, 2026-10-09: "always red"): colour it by how the player compares at his position
  const secP = (P("security") || [])[0], secCls = (secP == null ? "nil" : secP >= 0.5 ? "pos" : "neg") + " sec";
  const bar = (v, na="–", cls=null) => v == null ? `<span class="dz-na">${na}</span>` : `<span class="dz"><span class="z"></span><span class="b ${cls || (v>=0?"pos":"neg")}" style="${v>=0?`left:50%;width:${v/M*50}%`:`left:${50+v/M*50}%;width:${-v/M*50}%`}"></span></span><span class="dv num">${sgn(v)}</span>`;
  const pbar = (k) => { const p = P(k); if(!p || p[0] == null) return `<span class="pc-na r-small">${k==="other"?"":"–"}</span>`; const noise = noisy(k), band = Math.min(5, Math.floor(p[0]*5)+1);
    const cm = ST.cmp && ST.cmp.s && ST.cmp.s.skills ? ST.cmp.s.skills[keys.indexOf(k)] : null;
    return `<span class="pc" data-tip="${esc(`<b>${COMP[k][0]}</b><br>Better than ${Math.round(p[0]*100)}% of ${posPl(s.pos)} with 900+ minutes in ${s.year}, per 90<br>${sgn(p[1],4)} goals per 90 (raw possession value)${R(k) != null ? `<br>Reliability ${R(k).toFixed(2)} among ${posPl(s.pos)} with his ${PP.int(s.mins)} minutes${noise?", mostly noise":""}: how closely one half of a season agrees with the other` : ""}`)}"><span class="tr"><span class="fl${noise?" noise":""}" style="width:${Math.max(1.5,p[0]*100)}%;--c:var(--pct-${band});background:var(--pct-${band})"></span>${cm && cm[0]!=null?`<span class="cmp-ring" style="left:${cm[0]*100}%"></span>`:""}</span><span class="pn${p[0]>=0.9?" top":""}">${pctile(p[0])}</span></span>`; };
  const row = (k, v, extra="", cls="") => k === "other"
    ? `<div class="dr" role="row"><span class="dl"><span>${COMP[k][0]}</span><small>${COMP[k][1]}</small></span><span class="dg">${bar(v)}</span><span></span></div>`
    : `<div class="dr${cls?" "+cls:""}" role="row"><button type="button" class="dl" aria-expanded="false" data-k="${k}"><span>${COMP[k][0]}</span>${noisy(k)?`<small>mostly noise at his minutes</small>`:""}${k==="security"?`<small>always a cost; green when he loses less than most ${posPl(s.pos)}</small>`:""}${extra}</button><span class="dg">${bar(v, k==="high_regains"?"counted above":"not counted", k==="security"?secCls:null)}</span>${pbar(k)}</div>
    <div class="dx" data-k="${k}" hidden><p class="r-small">${COMP[k][1]}</p><div class="chart dstrip" data-k="${k}"></div></div>`;
  const sub = (label, v, cls="") => `<div class="dr dsub ${cls}" role="row"><span class="dl">${label}</span><span class="dg">${bar(v)}</span><span></span></div>`;
  const repl = (v, what) => `<div class="dr drepl" role="row"><span class="dl">Replacement level<small>${what}</small></span><span class="dg">${bar(v)}</span><span></span></div>`;
  const A = d && d.att ? ["passing","setpiece","carrying","dribbling","shooting","receiving","security","other"].map(k => row(k, d.att[k])).join("") : "";
  // winning the ball: the three action types together (2026-10-14), its parts indented beneath it
  const WB = ["interceptions","tackles","recoveries"], wb = d && d.def && WB.every(k => d.def[k] != null) ? WB.reduce((a, k) => a + d.def[k], 0) : null;
  const D = d && d.def ? (keys.includes("winning_ball") ? row("winning_ball", wb) + WB.map(k => row(k, d.def[k], "", "dpart")).join("") : WB.map(k => row(k, d.def[k])).join(""))
    + ["clearances","blocks","aerials","other"].map(k => k === "other" ? (Math.abs(d.def.other||0) > 0.005 ? row("other", d.def.other) : "") : row(k, d.def[k])).join("") + row("high_regains", null) : "";
  const O = d && d.outside ? row("not_beaten", null, `<small>not in the rating</small>`) + row("fouls", null, `<small>not in the rating</small>`) + (keys.includes("penalties") ? row("penalties", null, `<small>not in the rating</small>`) : "") : "";
  return `<section class="band" id="value" aria-labelledby="value-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="value-h">How he adds value</h2>
      <p>The rating, broken into the actions that earned it. The first column adds up exactly to his value above replacement (indented rows make up the row above them); the second ranks each skill per 90 minutes against ${posPl(s.pos)} with 900+ minutes in ${s.year}. Select a row to see where he sits among them.</p></div>
    ${ST.cmp ? cmpStrip() : ""}
    <div class="decomp" id="decomp" role="table">
      <div class="dr dhead" role="row"><span>Action</span><span>Season total, goals</span><span>Rank per 90</span></div>
      <div class="dgroup">With the ball</div>${A}${d ? repl(d.att_repl, d.att_repl <= 0 ? `a replacement ${posSing(s.pos)} would add ${num(-d.att_repl)} with the ball in ${PP.int(s.mins)} minutes; it is taken off` : `a replacement ${posSing(s.pos)} would lose ${num(d.att_repl)} with the ball in ${PP.int(s.mins)} minutes; it is added back`) + sub("Attack", s.attack) : ""}
      <div class="dgroup">Winning it back</div>${D}${d ? repl(d.def_repl, d.def_repl <= 0 ? `a replacement ${posSing(s.pos)} would win back ${num(-d.def_repl)} in ${PP.int(s.mins)} minutes, given the danger he faced; it is taken off` : `added back for the danger he faced`) + sub("Winning it back", s.defence) : ""}
      ${sub("Value above replacement", s.rating, "dtotal")}
      ${O ? `<div class="dgroup">Outside the rating</div>${O}` : ""}
    </div>
    <div class="pct-key">${[1,2,3,4,5].map(i => `<span><i style="background:var(--pct-${i})"></i>${["0–20","20–40","40–60","60–80","80–100"][i-1]}</span>`).join("")}<span><i class="hatchkey"></i>Mostly noise at his minutes (reliability under ${NOISE})</span>${ST.cmp?`<span><i class="cmp-key"></i>${PP.plink(ST.cmp.rec.id, ST.cmp.rec.name, ST.cmp.s && ST.cmp.s.year)}</span>`:""}</div>
  </div></section>`;
}
function bindDecomp(){
  $$("#decomp button.dl").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.k, x = $(`.dx[data-k="${k}"]`), o = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", String(o)); x.hidden = !o;
    if(o){ const el = $(`.dstrip[data-k="${k}"]`); PP.chart(el, drawStrip); PP.bindTips(el); }
  }));
}
function drawStrip(el){
  const k = el.dataset.k, s = ST.s, keys = ST.peers.components.map(c => c.key), ki = keys.indexOf(k), grp = ST.peers.groups[`${s.year}|${s.pos}`] || [];
  const vals = grp.filter(r => r[7]).map(r => ({id:r[0], name:r[1], team:r[2], v:r[7][ki]})).filter(r => r.v != null);
  const W = el.clientWidth; if(!W || !vals.length){ el.innerHTML = `<p class="r-small">Too few ${posPl(s.pos)} with 900+ minutes to compare.</p>`; return; }
  const me = s.skills ? s.skills[ki][1] : null, H = 64; el.innerHTML = "";
  const all = vals.map(r => r.v).concat(me != null ? [me] : []), lo = Math.min(...all), hi = Math.max(...all), pad = (hi-lo)*0.04 || 0.001;
  const sx = v => 10 + (v-lo+pad)/(hi-lo+2*pad)*(W-20);
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`${COMP[k][0]} per 90 among ${posPl(s.pos)}`},el);
  S("line",{x1:10,x2:W-10,y1:30,y2:30,class:"g-base"},svg);
  const sorted = vals.map(r => r.v).sort((a,b) => a-b), med = sorted[Math.floor(sorted.length/2)];
  S("line",{x1:sx(med),x2:sx(med),y1:16,y2:44,stroke:"var(--ink-3)","stroke-width":1,"stroke-dasharray":"2 2"},svg);
  text(svg, sx(med), 12, "median", "t-axis", {"text-anchor":"middle"});
  vals.forEach((r,i) => S("circle",{cx:sx(r.v),cy:30+((i%5)-2)*3,r:3,fill:"var(--dot)","data-tip":`<b>${esc(r.name)}</b>, ${esc(short(r.team))}<br>${sgn(r.v,4)} per 90`},svg));
  const cm = ST.cmp && ST.cmp.s && ST.cmp.s.skills ? ST.cmp.s.skills[ki][1] : null;
  if(cm != null) S("circle",{cx:sx(cm),cy:30,r:6,fill:"var(--paper)",stroke:"var(--ink)","stroke-width":2,"data-tip":`<b>${esc(ST.cmp.rec.name)}</b><br>${sgn(cm,4)} per 90`},svg);
  if(me != null){ S("rect",{x:sx(me)-6,y:24,width:12,height:12,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":2,transform:`rotate(45 ${sx(me)} 30)`,"data-tip":`<b>${esc(ST.rec.name)}</b><br>${sgn(me,4)} per 90`},svg);
    text(svg, sx(me), 58, surname(ST.rec.name), "t-lab", {"text-anchor": sx(me) > W-50 ? "end" : sx(me) < 50 ? "start" : "middle"}); }
}

/* possession impact */
function impactSection(){
  const s = ST.s, im = s.impact, ch = s.chains || [], pr = s.partners || [];
  if(!im && !ch.length) return "";
  const met = (label, v, p, fmt) => `<div class="metric"><span class="r-label">${label}</span><span class="mv num">${fmt(v)}</span><span class="r-small">${p!=null && s.mins >= 900 ? (p >= 0.995 ? `Highest of ${posPl(s.pos)}` : p < 0.005 ? `Lowest of ${posPl(s.pos)}` : `${pctile(p)} percentile of ${posPl(s.pos)}`) : "No percentile under 900 minutes"}</span></div>`;
  const metrics = im ? `<div class="metrics">
      ${met("Possessions touched, per 90", im.inv_p90, im.inv_p90_pct, v => v.toFixed(1))}
      ${met("Of those, ended in a shot", im.shot_share, im.shot_share_pct, v => Math.round(v*100)+"%")}
      ${met("Attacking value added per 100 possessions touched", im.val_per_inv, im.val_per_inv_pct, v => sgn(v*100,2)+" goals")}
    </div>` : "";
  const tabs = ch.map((c,i) => { const opp = c.home === c.team ? c.away : c.home; return `<button type="button" role="tab" aria-selected="${i===ST.chainI}" data-i="${i}"><b>${c.ends === "goal" ? "Goal" : c.ends === "shot" ? "Shot" : "Lost"}</b> v ${PP.crestTag(opp)}, ${c.date ? PP.dateLong(c.date) : ""}</button>`; }).join("");
  const partners = pr.length ? `<div class="partners"><h3 class="r-heading">Most valuable connections</h3><p class="r-small">Completed passes with each teammate, either way, and the value those passes added in ${s.year}.</p>
      ${(() => { const mx = Math.max(...pr.map(p => Math.abs(p[3]))); return pr.map(p => `<a class="prow" href="#player-${p[0]}"><span class="nm">${esc(p[1])}</span><span class="tr"><i style="width:${Math.max(2, Math.abs(p[3])/mx*100)}%;background:${p[3]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(p[3])}</span><span class="r-small">${PP.int(p[2])} passes</span></a>`).join(""); })()}</div>` : "";
  const chains = ch.length ? `<div class="pchains"><div class="fig-cap"><h3 class="r-heading">Possessions shaped most</h3><button type="button" class="btn-text" id="pplay">Play the chain</button></div>
      <div class="ctabs" role="tablist" aria-label="Possessions">${tabs}</div>
      <p class="r-small" id="pchain-cap"></p>
      <div class="chart" id="ppitch"></div><div class="chart" id="psteps"></div>
      <div class="legend"><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain"></line></svg>Pass</span><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain carry"></line></svg>Carry</span><span>His actions are full strength; teammates' are faded</span></div></div>`
    : `<div class="missing"><b>No possession chains for ${s.year}</b><span>They are shown for 2025 and 2026 seasons with 450+ minutes.</span></div>`;
  return `<section class="band" id="impact" aria-labelledby="impact-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="impact-h">How he shapes possessions</h2><p>Every possession his team had while he was on the pitch, from the first touch to the shot or the loss of the ball. The model values each action by how much it moved the chance of a goal.</p></div>
    ${metrics}
    <div class="impactwrap">${chains}${partners}</div>
  </div></section>`;
}
function chainObj(c){
  return {steps: c.steps.map(r => { const shot = /shot|goal/.test(r[1]); return {key:String(r[0]), id:r[0], player:c.who[r[0]] || "", action:r[1], x:r[2], y:r[3], ex:r[4], ey:r[5], vb:r[6], va:shot ? null : r[7], xg:shot ? r[7] : null, delta:r[8], goal:r[9]}; }), c};
}
function bindChains(){
  const ch = ST.s.chains || []; if(!ch.length) return;
  const show = (animate) => {
    const c = ch[ST.chainI], o = chainObj(c), me = String(ST.rec.id), mine = o.steps.filter(x => x.key === me).length;
    const opp = c.home === c.team ? c.away : c.home, [gh, ga] = String(c.score||"").split(":").map(x => x.trim());
    $("#pchain-cap").innerHTML = `${esc(short(c.home))} ${gh||""}–${ga||""} ${esc(short(c.away))}, ${c.date ? PP.dateLong(c.date) : ""}, ${c.minute} minutes in. ${o.steps.length} actions, ${c.ends === "goal" ? "ending in a goal" : c.ends === "shot" ? "ending in a shot" : "ending when the ball was lost"}. He made ${PP.WORDS[mine]||mine} of them, worth ${sgn(c.his,3)} goals of possession value to him: each bar is an action's full change in value, and a completed pass shares it with the receiver. The rating then weights attack and subtracts the replacement level, so the match-by-match figures are on a smaller scale.`;
    const big = o.steps.map((x,i) => [x.delta||0, i]).filter(([,i]) => o.steps[i].key === me).sort((a,b) => b[0]-a[0]).map(x => x[1]);
    const labels = [0, o.steps.length-1].concat(big.length ? [big[0]] : []);
    PP.chainPitch($("#ppitch"), o, {focus: me, labels, animate, maxW: 820});
    PP.chainSteps($("#psteps"), o, {focus: me, animate, maxW: 820, height: 170});
  };
  PP.chart($("#ppitch"), () => show(false));
  $$(".ctabs button").forEach(b => b.addEventListener("click", () => { ST.chainI = +b.dataset.i; $$(".ctabs button").forEach(x => x.setAttribute("aria-selected", String(x === b))); show(false); }));
  $("#pplay").addEventListener("click", () => show(true));
}

/* trajectory */
function trajectorySection(){
  const s = ST.s;
  return `<section class="band" id="trajectory" aria-labelledby="traj-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="traj-h">Over time</h2><p>His value above replacement in every MLS season in our data, with its 90% range, and how the selected season built up match by match.</p></div>
    <div class="trajwrap">
      <figure class="tfig"><div class="fig-cap"><span class="r-label">Season by season</span></div><div class="chart" id="pseasons"></div></figure>
      <figure class="tfig"><div class="fig-cap"><span class="r-label">${s.year}, match by match: running total</span><span class="r-small">Value above replacement, the rating's units. Hover to scrub</span></div><div class="chart" id="pmatches"></div></figure>
    </div>
  </div></section>`;
}
function drawSeasons(el){
  const all = ST.years.map(y => ST.byYear[y]).filter(x => x.rating != null), W = el.clientWidth; if(!W) return; const H = 230; el.innerHTML = "";
  if(!all.length){ el.innerHTML = `<p class="r-small">No outfield seasons.</p>`; return; }
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Value above replacement by season with 90% ranges"},el);
  const m = {l:34,r:12,t:16,b:40}, iw = W-m.l-m.r, ih = H-m.t-m.b;
  const y0 = Math.min(-1, Math.floor(Math.min(...all.map(x => x.lo)))), y1 = Math.max(2, Math.ceil(Math.max(...all.map(x => x.hi)))), sy = v => m.t + ih - (v-y0)/(y1-y0)*ih;
  const st = y1 - y0 > 8 ? 2 : 1;
  for(let v = Math.ceil(y0/st)*st; v <= y1; v += st){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, (v<0?"−":"")+Math.abs(v), "t-axis", {"text-anchor":"end"}); }
  text(svg, m.l+iw, sy(0)-6, "Replacement level", "t-axis", {"text-anchor":"end"});
  const band = iw/all.length;
  all.forEach((x,i) => { const cx = m.l + band*i + band/2, sel = x.year === ST.year;
    S("rect",{x:cx-7,y:sy(x.hi),width:14,height:Math.max(2,sy(x.lo)-sy(x.hi)),rx:2,fill:"var(--band)"},svg);
    S("rect",{x:cx-6,y:sy(x.rating)-6,width:12,height:12,fill:sel?"var(--signal)":"var(--paper)",stroke:sel?"var(--paper)":"var(--ink-2)","stroke-width":2,transform:`rotate(45 ${cx} ${sy(x.rating)})`},svg);
    if(band > 46) text(svg, cx+12, sy(x.rating)+4, sgn(x.rating,1), sel?"t-lab halo":"t-lab2 halo", {});
    text(svg, cx, H-m.b+17, x.year, "t-axis", {"text-anchor":"middle",style:sel?"font-weight:700;fill:var(--ink)":""});
    if(band > 56){ const t = text(svg, cx, H-m.b+31, short(x.team), "t-axis", {"text-anchor":"middle"});
      if(PP.crestURL(x.team)){ const w = t.getComputedTextLength(), x0 = cx - (w + 18)/2; PP.svgCrest(svg, x.team, x0, H-m.b+20, 14); t.setAttribute("x", x0 + 18); t.setAttribute("text-anchor", "start"); } }
    else if(band > 22) PP.svgCrest(svg, x.team, cx-7, H-m.b+21, 14);
    S("rect",{x:m.l+band*i,y:m.t,width:band,height:ih,class:"hit","data-tip":`<b>${x.year}, ${esc(full(x.team))}</b><br>${sgn(x.rating)} goals (range ${num(x.lo)} to ${num(x.hi)})<br>${num(x.p90,3)} per 90, ${PP.int(x.mins)} minutes, ${posSing(x.pos)}`},svg);
  });
}
function drawMatches(el){
  const s = ST.s, ms = s.matches || [], W = el.clientWidth; if(!W) return;
  if(ms.length < 2){ el.innerHTML = `<p class="r-small">Too few matches this season to draw.</p>`; return; }
  const H = 230; el.innerHTML = "";
  const teams = ST.teams, run = []; let t = 0; ms.forEach(m => { t += m[5]; run.push(t); });
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Running total of value above replacement through ${s.year}`},el);
  const m = {l:34,r:14,t:16,b:30}, iw = W-m.l-m.r, ih = H-m.t-m.b, n = ms.length;
  const y0 = Math.min(0, Math.floor(Math.min(...run))), y1 = Math.max(1, Math.ceil(Math.max(...run))), sy = v => m.t + ih - (v-y0)/(y1-y0)*ih, sx = i => m.l + (n===1?0:i/(n-1))*iw;
  const st = y1 - y0 > 8 ? 2 : 1;
  for(let v = y0; v <= y1; v += st){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, (v<0?"−":"")+Math.abs(v), "t-axis", {"text-anchor":"end"}); }
  const bw = Math.max(2, Math.min(10, iw/n*0.5)), bmax = Math.max(...ms.map(x => Math.abs(x[5]))) || 1;
  ms.forEach((x,i) => { const h = Math.abs(x[5])/bmax*ih*0.28; S("rect",{x:sx(i)-bw/2,y:x[5]>=0?sy(0)-h:sy(0),width:bw,height:Math.max(1,h),fill:x[5]>=0?"var(--turf)":"var(--flare)",opacity:.55},svg); });
  S("path",{d:run.map((v,i) => (i?"L":"M")+sx(i)+","+sy(v)).join(""),fill:"none",stroke:"var(--signal)","stroke-width":2,"stroke-linejoin":"round"},svg);
  S("circle",{cx:sx(n-1),cy:sy(run[n-1]),r:4.5,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":2},svg);
  text(svg, sx(n-1)-8, sy(run[n-1])-10, sgn(run[n-1],2), "t-lab halo", {"text-anchor":"end"});
  text(svg, m.l, H-8, `Match 1`, "t-axis", {}); text(svg, m.l+iw, H-8, `Match ${n}`, "t-axis", {"text-anchor":"end"});
  const cross = S("line",{x1:0,x2:0,y1:m.t,y2:m.t+ih,stroke:"var(--ink-3)","stroke-width":1,opacity:0},svg);
  const ov = S("rect",{x:m.l-6,y:m.t,width:iw+12,height:ih,fill:"transparent"},svg);
  const move = e => { const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(n-1, Math.round((e.clientX-r.left-m.l)/iw*(n-1)))), x = ms[i];
    cross.setAttribute("x1", sx(i)); cross.setAttribute("x2", sx(i)); cross.setAttribute("opacity", 1);
    const opp = teams[x[1]] || "", [h, a] = String(x[3]||"").split(":"), us = x[2] ? h : a, them = x[2] ? a : h;
    PP.showTip(`<b>${new Date(`${s.year}-${x[0]}T12:00:00Z`).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}, ${x[2]?"v":"at"} ${esc(short(opp))}</b>${us!=null&&them!=null?` (${us}–${them})`:""}<br>${PP.int(x[4])} minutes, ${sgn(x[5],3)} goals<br>Running total ${sgn(run[i],2)}`, e.clientX, e.clientY); };
  ov.addEventListener("pointermove", move); ov.addEventListener("pointerdown", move);
  ov.addEventListener("pointerleave", () => { cross.setAttribute("opacity", 0); PP.hideTip(); });
}

/* peers */
function peersSection(){
  const s = ST.s, grp = ST.peers.groups[`${s.year}|${s.pos}`] || [], sorted = grp.slice().sort((a,b) => b[4]-a[4]), rank = sorted.findIndex(r => r[0] === ST.rec.id);
  const sim = s.similar || [];
  return `<section class="band" id="peers" aria-labelledby="peers-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="peers-h">Among his peers</h2><p>${grp.length} ${posPl(s.pos)} played 900+ minutes in ${s.year}. ${rank >= 0 ? `Per 90 minutes he ranks <b>${PP.ord(rank+1)}</b>.` : `He played fewer than 900 minutes, so he is drawn against them but not ranked.`} Each dot is one of them: attack across, winning the ball back up.</p></div>
    <div class="peerswrap">
      <figure class="tfig"><div class="chart" id="ppeers"></div></figure>
      <aside class="aside">
        ${sim.length ? `<div><h3 class="r-heading">Most similar skills profiles</h3><p class="r-small">${cap(posPl(s.pos))} in ${s.year} whose 16 skill percentiles sit closest to his, weighted by how reliable each skill is.</p>
          <div class="simlist">${sim.map(x => `<div class="sim"><a href="#player-${x[0]}-${s.year}" class="nm">${esc(x[1])}</a><span class="meta">${PP.crestOr(x[2], 16)}${esc(short(x[2]))}</span><span class="num r-small">${Math.round(x[3]*100)}% alike</span><button type="button" class="btn-text cmpbtn" data-id="${x[0]}">Compare</button></div>`).join("")}</div></div>` : ""}
        <div class="cmpbox"><label class="r-label" for="cmpq">Compare with any player from ${s.year}</label><div class="cfield"><input id="cmpq" type="search" placeholder="Type a name" autocomplete="off"><div class="cres" id="cmpres" hidden></div></div></div>
      </aside>
    </div>
  </div></section>`;
}
function drawPeers(el){
  const s = ST.s, grp = ST.peers.groups[`${s.year}|${s.pos}`] || [], W = el.clientWidth; if(!W) return;
  const me = {id:ST.rec.id, name:ST.rec.name, a:s.attack/Math.max(1,s.mins)*90, d:s.defence/Math.max(1,s.mins)*90};
  const pts = grp.map(r => ({id:r[0], name:r[1], team:r[2], a:r[5], d:r[6], p90:r[4]})).filter(r => r.id !== me.id);
  const H = Math.round(Math.min(380, Math.max(260, W*0.62))); el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Attack and ball-winning per 90 for ${posPl(s.pos)} in ${s.year}`},el);
  const m = {l:44,r:14,t:14,b:38}, iw = W-m.l-m.r, ih = H-m.t-m.b, xs = pts.map(p=>p.a).concat(me.a), ys = pts.map(p=>p.d).concat(me.d);
  const nice = (lo, hi) => { const st = (hi-lo) > 0.4 ? 0.1 : 0.05; return [Math.floor(lo/st)*st, Math.ceil(hi/st)*st, st]; };
  const [x0, x1, xst] = nice(Math.min(...xs, 0), Math.max(...xs, 0)), [y0, y1, yst] = nice(Math.min(...ys, 0), Math.max(...ys, 0));
  const sx = v => m.l + (v-x0)/(x1-x0)*iw, sy = v => m.t + ih - (v-y0)/(y1-y0)*ih, f2 = v => (v<-1e-9?"−":v>1e-9?"+":"")+Math.abs(v).toFixed(2);
  for(let v = y0; v <= y1+1e-9; v += yst){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:Math.abs(v)<1e-9?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, f2(v), "t-axis", {"text-anchor":"end"}); }
  for(let v = x0; v <= x1+1e-9; v += xst){ text(svg, sx(v), H-m.b+16, f2(v), "t-axis", {"text-anchor": Math.abs(v-x0) < 1e-9 ? "start" : "middle"}); }
  S("line",{x1:sx(0),x2:sx(0),y1:m.t,y2:m.t+ih,class:"g-base"},svg);
  text(svg, m.l+iw, H-4, "Attack, goals above replacement per 90", "t-axis", {"text-anchor":"end"});
  text(svg, m.l+4, m.t+4, "Winning it back, per 90", "t-axis", {"dominant-baseline":"hanging"});
  const cmpId = ST.cmp ? ST.cmp.rec.id : null;
  pts.forEach(p => { const isC = p.id === cmpId; S("circle",{cx:sx(p.a),cy:sy(p.d),r:isC?6:4,fill:isC?"var(--paper)":"var(--dot)",stroke:isC?"var(--ink)":"var(--paper)","stroke-width":isC?2:1.5},svg);
    S("circle",{cx:sx(p.a),cy:sy(p.d),r:9,class:"hit","data-tip":`<b>${esc(p.name)}</b>, ${esc(short(p.team))}<br>Attack ${sgn(p.a,3)}, winning it back ${sgn(p.d,3)} per 90<br>Total ${sgn(p.p90,3)} per 90`},svg);
    if(isC) text(PP.svgA(svg, p.id, ST.year), sx(p.a)+9, sy(p.d)+4, surname(p.name), "t-lab halo", {}); });
  const top = pts.slice().sort((a,b) => b.p90 - a.p90).slice(0,3);
  top.forEach(p => { if(p.id !== cmpId) text(PP.svgA(svg, p.id, ST.year), sx(p.a) + (sx(p.a) > m.l+iw-80 ? -8 : 8), sy(p.d)+4, surname(p.name), "t-lab2 halo", {"text-anchor": sx(p.a) > m.l+iw-80 ? "end" : "start"}); });
  S("rect",{x:sx(me.a)-7,y:sy(me.d)-7,width:14,height:14,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":2,transform:`rotate(45 ${sx(me.a)} ${sy(me.d)})`,"data-tip":`<b>${esc(me.name)}</b><br>Attack ${sgn(me.a,3)}, winning it back ${sgn(me.d,3)} per 90`},svg);
  text(svg, sx(me.a) + (sx(me.a) > m.l+iw-90 ? -11 : 11), sy(me.d)+4, surname(me.name), "t-lab halo", {"text-anchor": sx(me.a) > m.l+iw-90 ? "end" : "start"});
}
function cmpStrip(){
  const c = ST.cmp, cs = c.s;
  return `<div class="cmpstrip"><span>Comparing with <a href="#player-${c.rec.id}-${cs.year}"><b>${esc(c.rec.name)}</b></a>, ${PP.crestTag(cs.team)}, ${cs.year}: ${cs.rating!=null?`${sgn(cs.rating)} goals in ${PP.int(cs.mins)} minutes`:"no outfield rating"}. His percentiles show as rings.</span><button type="button" class="btn-text" id="cmpclear">Stop comparing</button></div>`;
}
function bindCompare(){
  const setCmp = async id => {
    try{ const {rec} = await loadPlayer(+id); if(!rec) return;
      const cs = rec.seasons.filter(x => x.year === ST.year).sort((a,b) => b.mins - a.mins)[0] || rec.seasons[rec.seasons.length-1];
      ST.cmp = {rec, s: cs}; render($("#main")); const v = $("#value"); if(v) v.scrollIntoView({behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"});
    }catch(e){ /* the comparison simply does not appear */ }
  };
  $$(".cmpbtn").forEach(b => b.addEventListener("click", () => setCmp(b.dataset.id)));
  const clr = $("#cmpclear"); if(clr) clr.addEventListener("click", () => { ST.cmp = null; render($("#main")); });
  const q = $("#cmpq"), box = $("#cmpres"); if(!q) return;
  q.addEventListener("input", () => {
    const t = q.value.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,""); if(t.length < 2){ box.hidden = true; return; }
    const hits = (PP.data.index || []).filter(r => r[0] !== ST.rec.id && r[1] && r[1].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").includes(t)).slice(0, 6);
    box.innerHTML = hits.length ? hits.map(r => `<button type="button" data-id="${r[0]}">${esc(r[1])} <span class="r-small">${PP.crestTag(r[2])}, ${(PP.POS[r[3]]||r[3]||"player").toLowerCase()}</span></button>`).join("") : `<span class="r-small">No player matches.</span>`;
    box.hidden = false;
    $$("button", box).forEach(b => b.addEventListener("click", () => { box.hidden = true; setCmp(b.dataset.id); }));
  });
}

/* detailed data */
function detailSection(){
  const {rec, s} = ST, teams = ST.teams;
  const seasonRows = rec.seasons.slice().sort((a,b) => b.year - a.year).map(x => `<tr><td>${x.year}</td><td>${PP.crestTag(x.team)}</td><td>${posSing(x.pos)}</td><td class="n">${PP.int(x.mins)}</td>
    <td class="n">${x.rating!=null?sgn(x.rating):x.gk&&x.gk.skill!=null?sgn(x.gk.skill):"–"}</td><td class="n">${x.lo!=null?`${num(x.lo)} to ${num(x.hi)}`:x.gk&&x.gk.skill_lo!=null?`${num(x.gk.skill_lo)} to ${num(x.gk.skill_hi)}`:"–"}</td><td class="n">${x.p90!=null?num(x.p90,3):"–"}</td><td class="n">${x.attack!=null?sgn(x.attack):"–"}</td><td class="n">${x.defence!=null?sgn(x.defence):"–"}</td>
    <td>${PP.SLOT[x.slot]||x.slot||"–"}</td><td class="n">${x.comp?money(x.comp):"–"}</td><td class="n">${x.slot_value!=null?sgn(x.slot_value):"–"}</td><td class="n">${x.conv&&x.conv.goals!=null?x.conv.goals:"–"}</td><td class="n">${x.conv&&x.conv.shots!=null?x.conv.shots:"–"}</td></tr>`).join("");
  const ms = (s.matches||[]).slice().reverse().map(x => { const [h,a] = String(x[3]||"").split(":"); return `<tr><td>${new Date(`${s.year}-${x[0]}T12:00:00Z`).toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"})}</td><td>${x[2]?"v":"at"} ${teams[x[1]] ? PP.crestTag(teams[x[1]]) : ""}</td><td class="n">${h??""}–${a??""}</td><td class="n">${PP.int(x[4])}</td><td class="n">${sgn(x[5],3)}</td></tr>`; }).join("");
  const keys = ST.peers.components.map(c => c.key);
  const sk = s.skills ? SKILL_ORDER.filter(k => keys.includes(k)).map(k => { const v = s.skills[keys.indexOf(k)]; return `<tr><td>${COMP[k][0]}</td><td class="n">${sgn(v[1],4)}</td><td class="n">${v[0]!=null?pctile(v[0]):"–"}</td><td class="n">${v[2]!=null?v[2].toFixed(2):"–"}</td></tr>`; }).join("") : "";
  const ry = ST.peers.reliability_years || [];
  const disc = (id, title, inner) => `<div class="ddisc"><button class="btn-text why" type="button" data-disc aria-expanded="false" aria-controls="${id}">${title}</button><div class="disc" id="${id}" aria-hidden="true"><div><div class="why-body">${inner}</div></div></div></div>`;
  return `<section class="band" id="detail" aria-labelledby="det-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="det-h">Detailed data</h2><p>The numbers behind every chart on this page.</p></div>
    ${disc("d-seasons","Every season", `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Season</th><th>Club</th><th>Position</th><th class="n">Minutes</th><th class="n">Value</th><th class="n">90% range</th><th class="n">Per 90</th><th class="n">Attack</th><th class="n">Winning it</th><th>Contract type</th><th class="n">Pay</th><th class="n">Against type</th><th class="n">Goals</th><th class="n">Shots</th></tr></thead><tbody>${seasonRows}</tbody></table></div>`)}
    ${ms ? disc("d-matches", `Every match in ${s.year}`, `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Date</th><th>Opponent</th><th class="n">Score</th><th class="n">Minutes</th><th class="n">Value added</th></tr></thead><tbody>${ms}</tbody></table></div><p class="r-small">Value added per match sums exactly to the season total. Scores are home–away.</p>`) : ""}
    ${sk ? disc("d-skills", `Skills per 90, ${s.year}`, `<div class="tbl-wrap"><table class="dtable"><thead><tr><th>Skill</th><th class="n">Goals per 90 (raw)</th><th class="n">Percentile</th><th class="n">Reliability</th></tr></thead><tbody>${sk}</tbody></table></div><p class="r-small">Raw possession value before calibration and replacement. Reliability is how consistently a skill ranks ${posPl(s.pos)} over a season of his ${PP.int(s.mins)} minutes, estimated from how closely one half of a season agrees with the other (${ry.length ? `${ry[0]}–${String(ry[1]).slice(2)} ` : ""}players with 900+ minutes, within each position); under ${ST.peers.noise_below} is mostly noise.</p>`) : ""}
    ${disc("d-method", "How this is calculated", s.pos === "GK" ? keeperMethod() : `<div class="r-small" style="font-size:var(--t-13);color:var(--ink-2);display:grid;gap:8px;max-width:72ch">
      <p>Every on-ball action is valued by how much it changes the value of the possession: the expected goals of the next shot, counted for his team if it takes that shot and against it if the opponent does, from a model of how possessions move between 96 zones of the pitch, taking account of how the ball arrived. A completed pass splits its value equally between passer and receiver. Winning the ball is valued by the danger it removes.</p>
      <p>Attack is his on-ball value minus what a replacement-level ${posSing(s.pos)} would add in the same minutes; winning it back is his ball-winning minus what a replacement would have won back: a fixed amount per 90 plus a share of the danger that came his way. Both are in goals of expected-goal difference${ST.peers.w_off === 1 && ST.peers.w_def === 1 ? " and count as they are" : ` (weights ${ST.peers.w_off.toFixed(2)} for attack, ${ST.peers.w_def.toFixed(2)} for ball-winning)`}; the Method page explains the ball-winning weight. Replacement level is set per position and season.</p>
      <p>The 90% range comes from resampling the season's matches 1,000 times. It shows how much the season's numbers could have differed, not uncertainty in the model itself.</p></div>`)}
  </div></section>`;
}

/* ---------------- keepers ---------------- */
/* Keepers are ranked and valued by shot-stopping (owner, 2026-10-17): the season's goals prevented shrunk by its
   reliability, shots / (shots + 500) (GK_SHRINK_STUDY.md, chosen by a test fixed in advance). The raw season figure
   stays as this season's description. */
const GK_K = 500;
const gkRel = n => n > 0 ? n / (n + GK_K) : 0;
function keeperMethod(){
  return `<div class="r-small" style="font-size:var(--t-13);color:var(--ink-2);display:grid;gap:8px;max-width:72ch">
      <p>Each shot on target gets a post-shot expected-goal value from where it was struck, where it was heading in the goal mouth and how high, the body part and the situation, from a model fitted on other seasons. Goals prevented is that value minus the goals he conceded, measured against the season's average keeper.</p>
      <p>A season of shots is mostly luck, so shot-stopping keeps only the share of goals prevented that repeats: shots / (shots + ${GK_K}). The ${GK_K} comes from how well one season predicted the next for keepers in MLS and eleven other leagues, chosen by a test fixed in advance; its 90% range held 89% of the time in seasons it was not fitted on. Both figures are against an average keeper.</p>
      <p>The 90% range on goals prevented comes from resampling the season's shots 1,000 times. It shows how much the season could have differed, not uncertainty in the model itself.</p></div>`;
}
function keeperBody(){
  const s = ST.s, g = s.gk || {}, pc = s.pct || {}, prev = (() => { const i = ST.years.indexOf(ST.year); for(let k = i-1; k >= 0; k--){ const p = ST.byYear[ST.years[k]]; if(p.gk && p.gk.skill != null && p.mins >= 900) return p; } return null; })();
  const n = g.shots_faced || 0, rel = Math.round(gkRel(n) * 100), nm = esc(surname(ST.rec.name));
  return `<div class="wrap"><section class="plate pplate pk" aria-label="Model signal">
      <div class="pp-left">
        <span class="r-label">Shot-stopping, ${s.year}</span>
        <span class="r-figure">${sgn(g.skill,1)}</span>
        <div class="sub-fig"><span>goals saved beyond an average keeper, allowing for luck</span></div>
        ${pctBars([["Among goalkeepers", pc.model]], s)}
        <div class="sig-cap"><span class="r-label">90% range</span><span class="r-small">${num(g.skill_lo,1)} to ${num(g.skill_hi,1)} goals</span></div>
        <div class="indicators">
          <div class="ind"><span class="r-label">Goals prevented this season</span><span class="v num">${sgn(g.goals_prevented,1)}</span><span class="r-small">${PP.int(n)} shots on target worth ${num(g.psxg_faced,1)} post-shot expected goals; he conceded ${PP.int(g.goals_conceded||0)}. Range ${num(g.gp_lo,1)} to ${num(g.gp_hi,1)}.</span></div>
          <div class="ind"><span class="r-label">Movement</span>${prev ? `<span class="v"><span class="tri ${g.skill-prev.gk.skill>=0?"up":"down"}" aria-hidden="true"></span>${sgn(g.skill - prev.gk.skill,1)} goals</span><span class="r-small">Shot-stopping since ${prev.year} (${sgn(prev.gk.skill,1)}).</span>` : `<span class="v">No earlier season</span>`}</div>
        </div>
      </div>
      <div class="pp-right"><p class="r-note pp-why">${nm} faced shots on target worth ${num(g.psxg_faced,1)} goals and let in ${PP.int(g.goals_conceded||0)}: ${sgn(g.goals_prevented,1)} goals prevented. Most of a season's goals prevented is luck. Over ${PP.int(n)} shots on target, about ${rel}% of the difference between keepers is skill, judged by how well one season predicts the next, so his shot-stopping keeps ${rel}% of it: ${sgn(g.skill,1)} goals. That is the figure keepers are ranked by.</p>
        <p class="r-small">Shot-stopping is the only part of a keeper's game that relates to goals conceded in our tests.${g.distribution!=null?` Distribution (${sgn(g.distribution,2)}) and claims and sweeping (${sgn(g.claims_sweeping,2)}) are measured but showed no link to goals conceded beyond it, so they are reported, not rated.`:""}</p></div>
    </section></div>
    <section class="band" id="trajectory"><div class="wrap"><div class="band-head"><h2 class="r-title">Over time</h2><p>Shot-stopping in every MLS season in our data, with its 90% range; the small circle is that season's raw goals prevented.</p></div><div class="chart" id="kseasons"></div></div></section>
    <section class="band" id="peers"><div class="wrap"><div class="band-head"><h2 class="r-title">Among his peers</h2><p>Goalkeepers with 900+ minutes in ${s.year}: shots faced across, shot-stopping up.</p></div><div class="chart" id="kpeers"></div></div></section>
    ${detailSection()}`;
}
function drawKeeper(){
  PP.chart($("#kseasons"), el => {
    const all = ST.years.map(y => ST.byYear[y]).filter(x => x.gk && x.gk.skill != null), W = el.clientWidth; if(!W) return; const H = 220; el.innerHTML = "";
    const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Shot-stopping by season"},el);
    const m = {l:34,r:12,t:14,b:36}, iw = W-m.l-m.r, ih = H-m.t-m.b;
    const lo_ = all.map(x => Math.min(x.gk.skill_lo ?? x.gk.skill, x.gk.goals_prevented ?? x.gk.skill)), hi_ = all.map(x => Math.max(x.gk.skill_hi ?? x.gk.skill, x.gk.goals_prevented ?? x.gk.skill));
    const y0 = Math.floor(Math.min(-2, ...lo_)), y1 = Math.ceil(Math.max(2, ...hi_)), sy = v => m.t + ih - (v-y0)/(y1-y0)*ih;
    const st = y1-y0 > 12 ? 4 : 2;
    for(let v = Math.ceil(y0/st)*st; v <= y1; v += st){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, (v<0?"−":"")+Math.abs(v), "t-axis", {"text-anchor":"end"}); }
    const band = iw/Math.max(1, all.length);
    all.forEach((x,i) => { const cx = m.l+band*i+band/2, g = x.gk, sel = x.year === ST.year;
      if(g.skill_lo != null) S("rect",{x:cx-7,y:sy(g.skill_hi),width:14,height:Math.max(2,sy(g.skill_lo)-sy(g.skill_hi)),rx:2,fill:"var(--band)"},svg);
      if(g.goals_prevented != null) S("circle",{cx:cx+15,cy:sy(g.goals_prevented),r:3.5,fill:"var(--paper)",stroke:"var(--ink-3)","stroke-width":1.5},svg);
      S("rect",{x:cx-6,y:sy(g.skill)-6,width:12,height:12,fill:sel?"var(--signal)":"var(--paper)",stroke:sel?"var(--paper)":"var(--ink-2)","stroke-width":2,transform:`rotate(45 ${cx} ${sy(g.skill)})`},svg);
      text(svg, cx, H-m.b+17, x.year, "t-axis", {"text-anchor":"middle",style:sel?"font-weight:700;fill:var(--ink)":""});
      S("rect",{x:m.l+band*i,y:m.t,width:band,height:ih,class:"hit","data-tip":`<b>${x.year}, ${esc(full(x.team))}</b><br>Shot-stopping ${sgn(g.skill,1)} (range ${num(g.skill_lo,1)} to ${num(g.skill_hi,1)})<br>Goals prevented ${sgn(g.goals_prevented,1)}<br>${PP.int(g.shots_faced||0)} shots faced, ${PP.int(x.mins)} minutes`},svg); });
  });
  PP.chart($("#kpeers"), el => {
    const s = ST.s, grp = ST.peers.groups[`${s.year}|GK`] || [], W = el.clientWidth; if(!W) return; const H = Math.round(Math.min(340, Math.max(240, W*0.5))); el.innerHTML = "";
    const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Shot-stopping against shots faced, goalkeepers"},el);
    const pts = grp.map(r => ({id:r[0], name:r[1], team:r[2], raw:r[4], sf:r[5], gp:r[7]})).filter(p => p.gp != null && p.sf != null), m = {l:40,r:14,t:12,b:36}, iw = W-m.l-m.r, ih = H-m.t-m.b;
    const me = pts.find(p => p.id === ST.rec.id) || {id:ST.rec.id, name:ST.rec.name, gp:s.gk.skill, raw:s.gk.goals_prevented, sf:s.gk.shots_faced};
    const xs = pts.map(p=>p.sf).concat(me.sf), ys = pts.map(p=>p.gp).concat(me.gp), x0 = Math.floor(Math.min(...xs)/20)*20, x1 = Math.ceil(Math.max(...xs)/20)*20, y0 = Math.floor(Math.min(...ys,-1)), y1 = Math.ceil(Math.max(...ys,1));
    const sx = v => m.l + (v-x0)/(x1-x0||1)*iw, sy = v => m.t + ih - (v-y0)/(y1-y0||1)*ih, st = y1-y0 > 12 ? 4 : 2;
    for(let v = Math.ceil(y0/st)*st; v <= y1; v += st){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, (v<0?"−":v>0?"+":"")+Math.abs(v), "t-axis", {"text-anchor":"end"}); }
    for(let v = x0; v <= x1; v += 20) text(svg, sx(v), H-m.b+16, v, "t-axis", {"text-anchor":"middle"});
    text(svg, m.l+iw, H-4, "Shots on target faced", "t-axis", {"text-anchor":"end"});
    pts.filter(p => p.id !== me.id).forEach(p => { S("circle",{cx:sx(p.sf),cy:sy(p.gp),r:4,fill:"var(--dot)",stroke:"var(--paper)","stroke-width":1.5},svg); S("circle",{cx:sx(p.sf),cy:sy(p.gp),r:9,class:"hit","data-tip":`<b>${esc(p.name)}</b>, ${esc(short(p.team))}<br>Shot-stopping ${sgn(p.gp,1)} from ${PP.int(p.sf)} shots<br>Goals prevented ${sgn(p.raw,1)}`},svg); });
    S("rect",{x:sx(me.sf)-7,y:sy(me.gp)-7,width:14,height:14,fill:"var(--signal)",stroke:"var(--paper)","stroke-width":2,transform:`rotate(45 ${sx(me.sf)} ${sy(me.gp)})`},svg);
    text(svg, sx(me.sf)+11, sy(me.gp)+4, surname(me.name), "t-lab halo", {});
    PP.bindTips(el);
  });
  PP.bindTips($("#kseasons"));
}
})();
