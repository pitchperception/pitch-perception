/* Pitch Perception: the Players explorer. Data: data/explorer.json (every player-season 2020-26). */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, pctile, money, short, full, chip} = PP;
let expP = null, E = null;
const load = () => expP || (expP = fetch("data/explorer.json").then(r => { if(!r.ok) throw new Error(`explorer.json returned ${r.status}`); return r.json(); }));
const POSO = ["CB","FB","CM_DM","AM","W","ST","GK"];
const VIEWS = [["value","Most valuable"],["tiers","Tiers"],["p90","Per 90"],["contract","Against contract type"],["rising","Rising"],["falling","Falling"]];
const ST = {view:"value", year:null, pos:"all", team:"all", slot:"all", arch:"all", minMins:900, q:"", n:50, sort:null, tconf:0.9};
const SLOTS = [["DP","Designated Player"],["U22","U22 Initiative"],["TAM/GAM","TAM / GAM"],["Senior","Senior roster"],["Supplemental","Supplemental roster"],["Homegrown","Homegrown"],["none","No contract on record"]];
try{ const s = JSON.parse(localStorage.getItem("pp-explore") || "{}"); Object.assign(ST, s, {q:"", n:50}); }catch(e){}
const slotOn = r => ST.slot === "all" || (ST.slot === "none" ? !r.slot : r.slot === ST.slot);
const slotName = () => (SLOTS.find(s => s[0] === ST.slot) || [,""])[1];
const save = () => { try{ localStorage.setItem("pp-explore", JSON.stringify({view:ST.view, year:ST.year, pos:ST.pos, slot:ST.slot, arch:ST.arch, minMins:ST.minMins, tconf:ST.tconf})); }catch(e){} };

PP.pages.players = async (main, h) => {
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Players</h1><p class="r-small">Loading every player-season.</p></section></div>`;
  let D; try { [D] = await Promise.all([load(), PP.loadArch()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The player data did not load</h1><p>${esc(e.message)}. Reload the page; if it persists, the site needs republishing.</p></section></div>`; return; }
  const hh = location.hash.slice(1);
  if(hh !== "players" && !hh.startsWith("players-")) return;
  const ak = hh.slice(8); if(ak && PP.data.arch && PP.data.arch.byKey[ak]){ ST.arch = ak; ST.pos = "all"; ST.slot = "all"; if(ST.view === "tiers") ST.view = "value"; }
  const ix = Object.fromEntries(D.cols.map((c,i) => [c,i]));
  E = {rows: D.rows.map(r => ({id:r[ix.ws_player_id], name:r[ix.player], team:r[ix.team], year:r[ix.year], pos:r[ix.pos], mins:r[ix.mins], rating:r[ix.rating], lo:r[ix.rating_lo], hi:r[ix.rating_hi], p90:r[ix.rating_p90],
    attack:r[ix.attack], defence:r[ix.defence], slot:r[ix.slot], comp:r[ix.comp], slot_value:r[ix.slot_value], p_slot:r[ix.p_above_slot], gp:r[ix.goals_prevented], sk:r[ix.gp_skill], mp:r[ix.model_pct], d90:r[ix.d90], clear:r[ix.clear], age:r[ix.age],
    p90_prev:r[ix.p90_prev], slot_prev:r[ix.slot_prev], team_prev:r[ix.team_prev]}))};
  E.years = [...new Set(E.rows.map(r => r.year))].sort();
  E.teams = [...new Set(E.rows.map(r => r.team))].sort((a,b) => short(a).localeCompare(short(b)));
  if(!E.years.includes(ST.year)) ST.year = E.years[E.years.length-1];
  render(main);
};

function filtered(){
  const q = ST.q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  let rows = E.rows.filter(r => r.year === ST.year && (ST.pos === "all" ? r.pos !== "GK" : r.pos === ST.pos) && (ST.team === "all" || r.team === ST.team) && slotOn(r) && (ST.arch === "all" || PP.badgesFor(r.id, r.year, r.team).some(b => b[0] === ST.arch))
    && (r.mins || 0) >= (ST.view === "p90" || ST.view === "tiers" ? Math.max(900, ST.minMins) : ST.minMins)
    && (!q || (r.name||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").includes(q)));
  const gkv = r => r.pos === "GK" ? r.sk : r.rating;          // keepers by shot-stopping skill (owner, 2026-10-17)
  const by = {value: r => gkv(r), tiers: r => r.pos === "GK" || r.lo == null ? null : r.rating, p90: r => r.pos === "GK" ? (r.sk == null ? null : r.sk/Math.max(1,r.mins)*90) : r.p90, contract: r => r.slot_value,
    rising: r => r.clear === 1 ? r.d90 : null, falling: r => r.clear === -1 ? -r.d90 : null}[ST.view];
  rows = rows.filter(r => by(r) != null);
  if(ST.sort){ const [k, dir] = ST.sort; rows.sort((a,b) => ((a[k] ?? -1e9) - (b[k] ?? -1e9)) * dir); }
  else rows.sort((a,b) => by(b) - by(a));
  return rows;
}

function render(main){
  const yrs = E.years, have = new Set(E.rows.filter(r => r.year === ST.year && r.pos !== "GK").map(r => r.slot || "none")), slots = SLOTS.filter(([k]) => have.has(k));
  if(ST.slot !== "all" && !have.has(ST.slot)) ST.slot = "all";
  const sel = (id, opts, cur, label) => `<label class="fsel"><span class="r-small">${label}</span><select id="${id}">${opts.map(([v,t]) => `<option value="${v}"${String(v)===String(cur)?" selected":""}>${esc(t)}</option>`).join("")}</select></label>`;
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Players</h1>
      <p class="r-note standfirst">Every MLS player since 2020, valued by the possession model: goals added above a replacement-level player at the same position. Pick a view, filter, and follow any name to the player's page.</p></section>
    <section class="exswarm"><div class="fig-cap"><span class="r-label" id="swcap">${swcap()}</span><span class="r-small">Goals above replacement. Keepers are rated by goals prevented: choose Goalkeeper below. Hover a dot.</span></div><div class="chart" id="swarm"></div></section>
    <section class="exctl">
      <div class="seg exviews" role="group" aria-label="View">${VIEWS.map(([k,l]) => `<button type="button" data-v="${k}" aria-pressed="${k===ST.view}">${l}</button>`).join("")}</div>
      <div class="exfilters">
        ${sel("exyear", yrs.slice().reverse().map(y => [y,y]), ST.year, "Season")}
        ${sel("expos", [["all","All positions"], ...POSO.map(p => [p, PP.POS[p]])], ST.pos, "Position")}
        ${sel("exteam", [["all","All clubs"], ...E.teams.map(t => [t, short(t)])], ST.team, "Club")}
        ${sel("exslot", [["all","All contracts"], ...slots], ST.slot, "Contract")}
        ${PP.data.arch ? sel("exarch", [["all","All archetypes"], ...PP.data.arch.defs.filter(d => d.shown).map(d => [d.key, d.name])], ST.arch, "Archetype") : ""}
        ${sel("exmin", [[0,"Any minutes"],[450,"450+"],[900,"900+"],[1800,"1,800+"]], ST.minMins, "Minutes")}
        <label class="fsel fq"><span class="r-small">Name</span><input id="exq" type="search" placeholder="Search" value="${esc(ST.q)}" autocomplete="off"></label>
      </div>
      <p class="r-small" id="exnote"></p>
    </section>
    <section id="exlist"></section></div>`;
  $$(".exviews button").forEach(b => b.addEventListener("click", () => { ST.view = b.dataset.v; ST.sort = null; ST.n = 50; $$(".exviews button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); save(); list(); }));
  $("#exyear").addEventListener("change", e => { ST.year = +e.target.value; ST.n = 50; save(); render(main); });
  $("#expos").addEventListener("change", e => { ST.pos = e.target.value; ST.n = 50; save(); list(); });
  $("#exteam").addEventListener("change", e => { ST.team = e.target.value; ST.n = 50; list(); });
  if($("#exarch")) $("#exarch").addEventListener("change", e => { ST.arch = e.target.value; ST.n = 50; save(); list(); });
  $("#exslot").addEventListener("change", e => { ST.slot = e.target.value; ST.n = 50; save(); $("#swcap").textContent = swcap(); drawSwarm($("#swarm")); list(); });
  $("#exmin").addEventListener("change", e => { ST.minMins = +e.target.value; ST.n = 50; save(); list(); });
  $("#exq").addEventListener("input", e => { ST.q = e.target.value; ST.n = 50; list(); });
  PP.chart($("#swarm"), drawSwarm); PP.bindTips($("#swarm"));
  list();
}

function list(){
  const rows = filtered(), v = ST.view, el = $("#exlist"), show = rows.slice(0, ST.n);
  if(v === "tiers") return tierList(rows, el);
  const notes = {value:"Season total, goals above replacement.", p90:"Per 90 minutes; 900+ minutes.", contract:"Value against what a typical player on the same contract type returns in the same minutes.",
    rising:"Value per 90 against the previous season, where this season's 90% range sits wholly above last season's (900+ minutes, one club each season).", falling:"Value per 90 against the previous season, where this season's range sits wholly below last season's."};
  const preNote = ST.year < 2024 && ST.slot !== "all" ? " Before 2024 contracts are inferred from salary, so only Designated Players and TAM / GAM can be told apart; everyone else counts as Senior roster." : "";
  const slotNote = (v === "rising" || v === "falling") ? " Contracts play no part in the change: both seasons are measured against a replacement at the same position, whatever the player is paid. The contract filter uses this season's contract." : "";
  // keepers: shot-stopping skill, the season's goals prevented shrunk by its reliability (24, owner 2026-10-17)
  const gkNote = ST.pos === "GK" && (v === "value" || v === "p90") ? " Keepers: shot-stopping, the goals saved beyond an average keeper after allowing for luck; each keeper's page has this season's raw goals prevented." : "";
  $("#exnote").textContent = `${PP.int(rows.length)} players. ${notes[v]}${gkNote}${slotNote}${preNote}`;
  const all = rows.filter(r => r.pos !== "GK"), d0 = Math.min(-1, ...all.map(r => r.lo ?? r.rating ?? 0)), d1 = Math.max(1, ...all.map(r => r.hi ?? r.rating ?? 0));
  const th = (k, l, n) => `<th class="${n?"n":""}${ST.sort && ST.sort[0]===k?" sorted":""}"><button type="button" data-k="${k}">${l}${ST.sort && ST.sort[0]===k ? (ST.sort[1] < 0 ? " ▾" : " ▴") : ""}</button></th>`;
  const head = {value:[["rating","Value",1],["p90","Per 90",1],["attack","Attack",1],["defence","Winning it",1],["mins","Minutes",1],["slot_value","Against type",1]],
    p90:[["p90","Per 90",1],["rating","Value",1],["mins","Minutes",1],["mp","Percentile",1]],
    contract:[["slot_value","Against type",1],["p_slot","Chance beats typical",1],["comp","Pay",1],["rating","Value",1]],
    rising:[["d90","Change per 90",1],["p90","Per 90 now",1],["mins","Minutes",1]], falling:[["d90","Change per 90",1],["p90","Per 90 now",1],["mins","Minutes",1]]}[v];
  const cell = (r, k) => { switch(k){
    case "rating": return r.pos === "GK" ? `<b>${sgn(r.sk,1)}</b>` : `<span class="valcell">${v==="value"?PP.ibar(r.rating, r.lo, r.hi, d0, d1):""}<b>${sgn(r.rating)}</b></span>`;
    case "p90": return r.pos === "GK" ? sgn((r.sk||0)/Math.max(1,r.mins)*90,3) : num(r.p90,3);
    case "attack": case "defence": return r[k] != null ? sgn(r[k]) : "–";
    case "mins": return PP.int(r.mins||0);
    case "slot_value": return r.slot_value != null ? `<b>${sgn(r.slot_value)}</b>` : "–";
    case "p_slot": return r.p_slot != null ? pctShort(r.p_slot) : "–";
    case "comp": return r.comp ? money(r.comp) : "–";
    case "mp": return r.mp != null ? pctile(r.mp) : "–";
    case "d90": return `<span class="tri ${r.d90>=0?"up":"down"}" aria-hidden="true"></span> <b>${sgn(r.d90,3)}</b>`;
    default: return ""; } };
  if(ST.pos === "GK") head.forEach(h => { if(h[0] === "rating") h[1] = "Shot-stopping"; if(h[0] === "p90") h[1] = "Shot-stopping per 90"; });
  /* Labels before 2024 are inferred from salary (DP reliably, TAM / GAM less so), so a change into a 2024 season is tagged only when a DP is involved. */
  const moved = r => [r.team_prev && r.team_prev !== r.team ? "new club" : "", r.slot_prev && r.slot && r.slot_prev !== r.slot && (r.year > 2024 || r.slot_prev === "DP" || r.slot === "DP") ? "new contract" : ""].filter(Boolean).map(t => `<span class="tag">${t}</span>`).join("");
  const lastYr = r => (v === "rising" || v === "falling") && r.p90_prev != null ? `<small class="prevline">${r.year-1}: ${num(r.p90_prev,3)} per 90 at ${esc(short(r.team_prev||r.team))}, ${esc(PP.SLOT[r.slot_prev]||r.slot_prev||"no contract on record")}${moved(r)}</small>` : "";
  const rowsH = show.map((r,i) => `<tr><td class="n rk">${i+1}</td><td class="who"><a href="#player-${r.id}-${r.year}">${esc(r.name)}</a>${PP.badgeMini(PP.badgesFor(r.id, r.year, r.team))}<small>${chip(r.team)}${esc(short(r.team))}, ${(PP.POS[r.pos]||"position not recorded").toLowerCase()}${r.slot?`, ${esc(PP.SLOT[r.slot]||r.slot)}`:""}</small>${lastYr(r)}</td>${head.map(([k]) => `<td class="n">${cell(r,k)}</td>`).join("")}</tr>`).join("");
  const listH = show.map((r,i) => `<a class="lrow" href="#player-${r.id}-${r.year}"><span class="rk">${i+1}</span><span class="nm">${esc(r.name)}${PP.badgeMini(PP.badgesFor(r.id, r.year, r.team))}</span><span class="val">${cell(r, head[0][0])}</span><span class="meta">${chip(r.team)}${esc(short(r.team))}, ${(PP.POS[r.pos]||"–").toLowerCase()}${ST.slot !== "all" && r.slot ? `, ${esc(PP.SLOT[r.slot]||r.slot)}` : ""}</span>${(v === "rising" || v === "falling") && r.p90_prev != null ? `<span class="meta prev">${r.year-1}: ${num(r.p90_prev,3)} per 90${moved(r)}</span>` : ""}</a>`).join("");
  el.innerHTML = rows.length ? `<div class="board-table tbl-wrap"><table class="board extable"><thead><tr><th class="n">#</th><th>Player</th>${head.map(([k,l,n]) => th(k,l,n)).join("")}</tr></thead><tbody>${rowsH}</tbody></table></div>
    <div class="board-list exlist2">${listH}</div>
    ${rows.length > ST.n ? `<div style="margin-top:var(--s-4)"><button type="button" class="btn btn-secondary" id="exmore">Show ${Math.min(50, rows.length - ST.n)} more</button></div>` : ""}`
    : `<div class="missing"><b>No players match</b><span>Loosen a filter: fewer minutes, all positions, all clubs, all contracts or all archetypes.</span></div>`;
  $$(".extable th button").forEach(b => b.addEventListener("click", () => { const k = b.dataset.k; ST.sort = ST.sort && ST.sort[0] === k ? [k, -ST.sort[1]] : [k, -1]; list(); }));
  const more = $("#exmore"); if(more) more.addEventListener("click", () => { ST.n += 50; list(); });
}

/* ---------- Tiers (pilot) ----------
   Players in rating order; a tier runs until the first player the model is confident (ST.tconf) is
   below the tier's best, who then starts the next tier. Confidence from the two 90% ranges, read as
   normal (the ranges are close to symmetric: upper / lower half-width 1.1 at the median). */
const Phi = z => { const t = 1/(1+0.2316419*Math.abs(z)), d = 0.3989423*Math.exp(-z*z/2), p = d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z > 0 ? 1-p : p; };
const sdOf = r => Math.max(0.05, (r.hi - r.lo) / 3.29);
function makeTiers(rows, conf){
  const out = []; let lead = null;
  rows.slice().sort((a,b) => b.rating - a.rating).forEach(r => {
    const p = lead ? Phi((lead.rating - r.rating) / Math.hypot(sdOf(lead), sdOf(r))) : 1;
    if(!lead || p >= conf){ lead = r; out.push({lead:r, rows:[r]}); } else out[out.length-1].rows.push(r);
  });
  return out;
}
function tierList(rows, el){
  if(ST.pos === "GK"){ el.innerHTML = `<div class="missing"><b>Keepers are not tiered yet</b><span>Their shot-stopping ranges are on each keeper's page; tiers cover outfield players in this pilot.</span></div>`; return; }
  if(rows.length < 5){ el.innerHTML = `<div class="missing"><b>Too few players to tier</b><span>Loosen a filter: all positions, all clubs or all contracts.</span></div>`; return; }
  const T = makeTiers(rows, ST.tconf), confs = [[0.8,"80%"],[0.9,"90%"],[0.95,"95%"]];
  const key = r => PP.surname(r.name).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  el.innerHTML = `<div class="tierctl"><span class="r-small">Start a new tier when the model is</span><div class="seg" role="group" aria-label="Confidence needed to separate tiers">${confs.map(([c,l]) => `<button type="button" data-c="${c}" aria-pressed="${c===ST.tconf}">${l}</button>`).join("")}</div><span class="r-small">sure a player is below the tier's best.</span></div>
    <div class="fig-cap"><span class="r-label">${T.length} tiers among ${PP.int(rows.length)} players, ${ST.year}</span><span class="r-small">Each dot is a player, with the 90% range of the tier's best drawn above its lane. Hover a dot.</span></div>
    <div class="chart" id="tierladder"></div>
    <div class="tiers">${T.map((t,i) => { const lo = t.rows[t.rows.length-1].rating, hi = t.lead.rating;
      return `<section class="tier" aria-labelledby="tier-h${i}"><div class="tier-head"><h3 class="r-heading" id="tier-h${i}">Tier ${i+1}</h3><span class="r-small">${t.rows.length} player${t.rows.length>1?"s":""}, ${sgn(lo)} to ${sgn(hi)} goals above replacement</span></div>
        <div class="tier-grid">${t.rows.slice().sort((a,b) => key(a).localeCompare(key(b))).map(r => `<a class="tchip" href="#player-${r.id}-${r.year}"><span class="nm">${esc(r.name)}${PP.badgeMini(PP.badgesFor(r.id, r.year, r.team))}</span><span class="meta">${chip(r.team)}${esc(short(r.team))}, ${(PP.POS[r.pos]||"–").toLowerCase()}</span><span class="v num">${sgn(r.rating)}</span></a>`).join("")}</div></section>`; }).join("")}</div>
    <p class="r-small tiernote">Pilot. Names are alphabetical within a tier because the order inside a tier is not meaningful: every player in it is within reach of its best player once match-to-match luck is allowed for. The ranges cover that luck only, not uncertainty in the model itself, so true tiers are, if anything, wider. Filters apply: choose a position or contract type to tier within it.</p>`;
  $$(".tierctl button").forEach(b => b.addEventListener("click", () => { ST.tconf = +b.dataset.c; save(); list(); }));
  PP.chart($("#tierladder"), e => drawLadder(e, T)); PP.bindTips($("#tierladder"));
}
function drawLadder(el, T){
  const W = el.clientWidth; if(!W) return;
  const lane = 30, m = {l:W<520?52:72, r:16, t:6, b:26}, H = m.t + T.length*lane + m.b; el.innerHTML = "";
  const all = T.flatMap(t => t.rows), lo = Math.floor(Math.min(-1, ...all.map(r => r.rating))), hi = Math.ceil(Math.max(2, ...all.map(r => r.rating)));
  const sx = v => m.l + (v-lo)/(hi-lo)*(W-m.l-m.r);
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`${T.length} tiers of players by value above replacement`},el);
  const step = (hi-lo) > 8 ? 2 : 1;
  for(let v = Math.ceil(lo/step)*step; v <= hi; v += step){ S("line",{x1:sx(v),x2:sx(v),y1:m.t,y2:H-m.b,class:v===0?"g-base":"g-line"},svg); text(svg, sx(v), H-8, (v>0?"+":v<0?"−":"")+Math.abs(v), "t-axis", {"text-anchor":"middle"}); }
  T.forEach((t,k) => { const y = m.t + k*lane + lane/2, a = t.rows[t.rows.length-1].rating, b = t.lead.rating;
    S("rect",{x:sx(a)-5,y:y-lane/2+3,width:Math.max(10,sx(b)-sx(a)+10),height:lane-6,rx:4,class:"tier-band"},svg);
    text(svg, m.l-10, y+4, `Tier ${k+1}`, "t-lab2", {"text-anchor":"end"});
    S("line",{x1:sx(t.lead.lo),x2:sx(t.lead.hi),y1:y-lane/2+4,y2:y-lane/2+4,class:"tier-range"},svg);
    t.rows.forEach(r => { const jit = ((r.id * 9301 + 49297) % 233280) / 233280 - 0.5, lead = r === t.lead;
      S("circle",{cx:sx(r.rating),cy:y + jit*(lane-14),r:lead?4.5:3,fill:lead?"var(--signal)":"var(--dot)",stroke:lead?"var(--paper)":"none","stroke-width":1.5,
        "data-tip":`<b>${esc(r.name)}</b>, ${esc(short(r.team))}<br>${sgn(r.rating)} goals above replacement<br>range ${num(r.lo)} to ${num(r.hi)}${lead?`<br>Best in tier ${k+1}`:""}`},svg); });
  });
}

function swcap(){ return `Every outfield player of ${ST.year} with 900+ minutes, by position${ST.slot === "all" ? "" : `, ${ST.slot === "none" ? "players with no contract on record" : slotName() + (ST.slot === "Homegrown" ? " players" : "s")} highlighted`}`; }

function drawSwarm(el){
  const W = el.clientWidth; if(!W) return;
  const POS6 = POSO.filter(p => p !== "GK"), rows = E.rows.filter(r => r.year === ST.year && r.mins >= 900 && r.pos !== "GK"), lane = 34, m = {l:W<520?44:130,r:16,t:8,b:26}, H = m.t + POS6.length*lane + m.b; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Value of every player with 900+ minutes in ${ST.year}, by position`},el);
  const val = r => r.pos === "GK" ? r.sk : r.rating, vs = rows.map(val).filter(v => v != null), lo = Math.floor(Math.min(-2, ...vs)), hi = Math.ceil(Math.max(2, ...vs)), sx = v => m.l + (v-lo)/(hi-lo)*(W-m.l-m.r);
  for(let v = Math.ceil(lo/2)*2; v <= hi; v += 2){ S("line",{x1:sx(v),x2:sx(v),y1:m.t,y2:H-m.b,class:v===0?"g-base":"g-line"},svg); text(svg, sx(v), H-8, (v>0?"+":v<0?"−":"")+Math.abs(v), "t-axis", {"text-anchor":"middle"}); }
  POS6.forEach((p,k) => { const y = m.t + k*lane + lane/2, rs = rows.filter(r => r.pos === p && val(r) != null).sort((a,b) => val(b) - val(a));
    text(svg, m.l-10, y+4, W < 520 ? p.replace("CM_DM","CM") : PP.POS[p], "t-lab2", {"text-anchor":"end"});
    const hl = ST.slot !== "all", lead = hl ? rs.filter(slotOn) : rs;
    (hl ? [...rs.filter(r => !slotOn(r)), ...lead] : rs).forEach((r,i) => { const jit = ((r.id * 9301 + 49297) % 233280) / 233280 - 0.5; const top = hl ? slotOn(r) : i < 2, dim = hl && !top;
      S("circle",{cx:sx(val(r)),cy:y + jit*(lane-12),r:top?4.5:3,fill:top?"var(--signal)":"var(--dot)",opacity:dim?0.35:1,stroke:top?"var(--paper)":"none","stroke-width":1.5,"data-tip":`<b>${esc(r.name)}</b>, ${esc(short(r.team))}<br>${r.pos==="GK"?`${sgn(r.sk,1)} goals of shot-stopping`:`${sgn(r.rating)} goals above replacement`}<br>${PP.int(r.mins)} minutes`},svg); });
    const t0 = lead[0]; if(t0 && W >= 520) text(PP.svgA(svg, t0.id), sx(val(t0)) + (sx(val(t0)) > W-110 ? -8 : 8), y - 6, PP.surname(t0.name), "t-lab halo", {"text-anchor": sx(val(t0)) > W-110 ? "end" : "start"});
  });
}
})();
