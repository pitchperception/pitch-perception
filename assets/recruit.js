/* Pitch Perception: Recruiting (signing grades, scouting abroad). Data: data/recruiting.json (59 / 60 outputs). */
(function(){
"use strict";
const pctMove = p => p >= 0.995 ? ">99%" : p < 0.005 ? "<1%" : p < 0.1 ? `${(p*100).toFixed(1)}%` : `${Math.round(p*100)}%`;
const {$, $$, S, text, esc, sgn, num, pct, pctShort, pctile, money, short, full, chip} = PP;
let rP = null, RC = null;
const load = () => rP || (rP = fetch("data/recruiting.json").then(r => { if(!r.ok) throw new Error(`recruiting.json returned ${r.status}`); return r.json(); }));
const TEAMN = {"Salt Lake":"Real Salt Lake","Kansas City":"Sporting Kansas City","Columbus":"Columbus Crew","San Jose":"San Jose Earthquakes","Minnesota":"Minnesota United","New England":"New England Revolution","Philadelphia":"Philadelphia Union","Portland":"Portland Timbers","Orlando":"Orlando City","Toronto":"Toronto FC","Vancouver":"Vancouver Whitecaps","Atlanta":"Atlanta United","Austin":"Austin FC","Charlotte":"Charlotte FC","Cincinnati":"FC Cincinnati","Colorado":"Colorado Rapids","Dallas":"FC Dallas","Nashville":"Nashville SC","San Diego":"San Diego FC","Miami":"Inter Miami CF","Los Angeles":"Los Angeles FC","Galaxy":"LA Galaxy","New York":"Red Bull New York","NYCFC":"New York City FC","LA Galaxy":"LA Galaxy","LAFC":"Los Angeles FC","Inter Miami":"Inter Miami CF","Montréal":"CF Montreal","Montreal":"CF Montreal","D.C. United":"DC United","DC United":"DC United","Sporting KC":"Sporting Kansas City","St. Louis":"St. Louis City","Chicago":"Chicago Fire FC","Seattle":"Seattle Sounders FC","Houston":"Houston Dynamo FC"};
const club = t => { if(!t) return null; if(PP.CLUB[t]) return t; if(TEAMN[t]) return TEAMN[t]; return Object.keys(PP.CLUB).find(k => PP.short(k) === t || k.startsWith(t)) || null; };
const GRP = {CB:"centre backs", FB:"fullbacks", MID:"midfielders", ATT:"attackers"};
const S2 = {tab:"signings", year:null, sort:"grade", sc:{league:"all", pos:"all", age:"all", arch:"all", sort:"pct", q:"", hide:false, n:60}};
let SB = null;   // scouted players' badges, from data/scouts/index.json (78)
const loadSB = () => SB ? Promise.resolve(SB) : Promise.all([PP.data.scouts ? PP.data.scouts : fetch("data/scouts/index.json").then(r => r.ok ? r.json() : null).catch(() => null), PP.loadArch()])
  .then(([d]) => { SB = {}; if(d){ PP.data.scouts = d; const bi = d.cols.indexOf("badges"); d.rows.forEach(r => { if(bi >= 0 && r[bi] && r[bi].length) SB[r[0]] = r[bi]; }); } return SB; });

PP.pages.recruiting = async (main, h) => {
  if(h && h.includes("-scouting")) S2.tab = "scouting"; else if(h && h.includes("-signings")) S2.tab = "signings";
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Recruiting</h1><p class="r-small">Loading.</p></section></div>`;
  try { RC = RC || await load(); await Promise.all([loadSB(), PP.loadMarket()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The recruiting data did not load</h1><p>${esc(e.message)}</p></section></div>`; return; }
  render(main);
};

function render(main){
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Recruiting</h1>
    <p class="r-note standfirst">Two questions clubs ask before a signing: will a player be worth the contract in MLS, and who abroad would be? Both answers come from the same possession model, applied to the leagues players arrive from.</p>
    <div class="seg rtabs" role="tablist" aria-label="Recruiting">${[["signings","Signing grades"],["scouting","Scouting abroad"]].map(([k,l]) => `<button type="button" role="tab" data-t="${k}" aria-pressed="${k===S2.tab}" aria-selected="${k===S2.tab}">${l}</button>`).join("")}</div></section>
    <div id="rbody"></div></div>`;
  $$(".rtabs button").forEach(b => b.addEventListener("click", () => { S2.tab = b.dataset.t; history.replaceState(null, "", "#recruiting-" + S2.tab); render(main); }));
  S2.tab === "signings" ? signings() : scouting();
}

/* ---------------- signing grades ---------------- */
function signings(){
  const SG = RC.signings, el = $("#rbody");
  if(!SG || !SG.signings || !SG.signings.length){ el.innerHTML = `<div class="missing"><b>No signing grades</b><span>The grader has not been run.</span></div>`; return; }
  const yrs = [...new Set(SG.signings.map(r => r.first_season))].sort((a,b) => b-a);
  if(!yrs.includes(S2.year)) S2.year = yrs[0];
  const rows = SG.signings.filter(r => r.first_season === S2.year).slice().sort((a,b) => S2.sort === "actual" ? ((b.actual_pts_per_season ?? -9) - (a.actual_pts_per_season ?? -9)) : ((b.exp_pts ?? -9) - (a.exp_pts ?? -9)));
  const idx = new Set((PP.data.index || []).map(r => r[0]));
  const lo = Math.min(-1, ...rows.map(r => r.exp_lo ?? 0)), hi = Math.max(1, ...rows.map(r => r.exp_hi ?? 0));
  const rbar = (v, l, h) => { const p = x => (Math.max(lo, Math.min(hi, x)) - lo) / (hi - lo) * 100, z = p(0); return `<span class="ibar" aria-hidden="true"><span class="z" style="left:${z}%"></span><span class="b${v<0?" neg":""}" style="left:${v<0?p(v):z}%;width:${Math.abs(p(v)-z)}%"></span><span class="w" style="left:${p(l)}%;width:${p(h)-p(l)}%"></span><span class="wc" style="left:${p(l)}%"></span><span class="wc" style="left:calc(${p(h)}% - 2px)"></span></span>`; };
  const bt = SG.backtest, cal = bt.calibration || [];
  const tr = rows.map(r => { const t = club(r.mls_team);
    return `<tr><td class="who">${idx.has(r.ws_player_id) ? `<a href="#player-${r.ws_player_id}">${esc(r.name)}</a>` : `<b>${esc(r.name)}</b>`}<small>${t ? `${chip(t)}${esc(short(t))}` : esc(r.mls_team||"")}, from ${esc(r.prev_team || "–")}${r.group ? ` (${esc(r.group)})` : ""}</small></td>
      <td>${esc(PP.SLOT[r.designation] || r.designation || "–")}</td><td class="n">${r.age_debut == null ? "–" : Math.round(r.age_debut)}</td>
      <td class="n">${r.a_hat == null ? "–" : PP.int(r.a_hat)}</td><td class="n">${r.q_pct == null ? "–" : pctile(r.q_pct)}</td>
      <td><span class="valcell">${rbar(r.exp_pts, r.exp_lo, r.exp_hi)}<b>${sgn(r.exp_pts)}</b></span></td><td class="n">${pctShort(r.p_beat)}</td>
      <td class="n">${r.actual_pts_per_season == null ? "–" : `<b>${sgn(r.actual_pts_per_season)}</b><small class="r-small"> ${PP.int(r.mins_mls||0)} min</small>`}</td></tr>`; }).join("");
  const calChart = cal.length ? `<div class="tbl-wrap"><table class="dtable" style="max-width:620px"><thead><tr><th>Grade, fifths</th><th class="n">Signings</th><th class="n">Expected</th><th class="n">Delivered</th><th class="n">Beat the typical</th></tr></thead>
    <tbody>${cal.map(c => `<tr><td>${["Lowest","Second","Middle","Fourth","Highest"][c.quintile-1] || c.quintile}</td><td class="n">${c.n}</td><td class="n">${sgn(c.predicted)}</td><td class="n">${sgn(c.actual)}</td><td class="n">${pctShort(c.beat)}</td></tr>`).join("")}</tbody></table></div>
    <p class="r-small">Expected and delivered are points a season against a typical player on the same contract type, averaged within each fifth of the grade.</p>` : "";
  el.innerHTML = `<section class="band" style="padding-top:var(--s-4)">
    <div class="band-head"><h2 class="r-title">Foreign signings, graded when they signed</h2><p>The grade is the value against the contract type that could be expected from what was known at signing: expected minutes and quality per 90 from salary, age, position, where the player came from and the last season there. The bar is expected points a season against a typical player on the same contract type, with the range eight in ten past signings fell in.</p></div>
    <div class="row" style="margin-bottom:var(--s-4)"><div class="seg sgyear" role="group" aria-label="Arrival season">${yrs.map(y => `<button type="button" data-y="${y}" aria-pressed="${y===S2.year}">${y} arrivals</button>`).join("")}</div>
      <div class="seg sgsort" role="group" aria-label="Order"><button type="button" data-s="grade" aria-pressed="${S2.sort!=="actual"}">By grade</button><button type="button" data-s="actual" aria-pressed="${S2.sort==="actual"}">By results so far</button></div></div>
    <div class="tbl-wrap"><table class="board extable"><thead><tr><th>Player</th><th>Contract type</th><th class="n">Age</th><th class="n">Expected minutes</th><th class="n">Expected quality</th><th>Expected against type</th><th class="n">Chance beats it</th><th class="n">So far</th></tr></thead><tbody>${tr}</tbody></table></div>
    <p class="r-small" style="margin-top:var(--s-3)">${rows.length} foreign signings who debuted in ${S2.year}. Expected quality is a percentile among past foreign signings. "So far" is points a season against the typical player on the same contract type${S2.year === yrs[0] ? "; for this year's arrivals it covers part of a season and is noisy" : ""}.</p>
  </section>
  <section class="band"><div class="band-head"><h2 class="r-title">How well the grades work</h2>
    <p>Back-tested on ${bt.n} foreign signings from 2020–24, each graded by models that never saw the debut season: the grade correlates <b>${bt.r.toFixed(2)}</b> (95% interval ${bt.ci[0].toFixed(2)} to ${bt.ci[1].toFixed(2)}) with the value delivered against the contract type. Of the signings graded in the lowest fifth, ${pct(cal[0] && cal[0].beat)} beat the typical player on their contract; of the highest fifth, ${pct(cal.length && cal[cal.length-1].beat)}.</p>
    <p>What is predictable is mostly whether a signing will play: expected minutes correlate ${SG.components.availability_r.toFixed(2)} with what happened. Quality per 90 beyond what the salary implies is harder (${SG.components.quality_r.toFixed(2)}), even with the last season abroad rated by this site's model.</p></div>
    ${trust()}
    ${calChart}
    <h3 class="r-heading" style="margin-top:var(--s-6)">Where signings come from</h3>
    <div class="tbl-wrap"><table class="dtable" style="max-width:720px"><thead><tr><th>Came from</th><th class="n">Signings</th><th class="n">Points against type a season</th><th class="n">Beat the typical</th><th class="n">Median minutes a season</th></tr></thead>
    <tbody>${(SG.market||[]).map(g => `<tr><td>${esc(g.group)}</td><td class="n">${PP.int(g.n)}</td><td class="n">${sgn(g.pts)}</td><td class="n">${pctShort(g.beat)}</td><td class="n">${PP.int(g.mins)}</td></tr>`).join("")}</tbody></table></div>
  </section>`;
  $$(".sgyear button").forEach(b => b.addEventListener("click", () => { S2.year = +b.dataset.y; signings(); }));
  $$(".sgsort button").forEach(b => b.addEventListener("click", () => { S2.sort = b.dataset.s; signings(); }));
}

/* how much to trust a grade or a projection: shown on both tabs */
function trust(){
  const ev = (RC.scouting || {}).evidence, bt = (RC.signings || {}).backtest || {}, cal = bt.calibration || [];
  const top = cal.length ? cal[cal.length-1].beat : null, bot = cal.length ? cal[0].beat : null;
  return `<div class="trust"><h3 class="r-heading">How much to trust these numbers</h3><ul class="mlist">
    <li><b>They separate groups better than individuals.</b> ${top != null ? `A top-fifth grade has meant about a ${pct(top)} chance of beating the typical player on the same contract, a bottom-fifth grade about ${pct(bot)}: a real edge, not a verdict on one player.` : ""} One season abroad is a small sample, and moving countries, clubs and coaches adds noise no model sees.</li>
    ${ev ? `<li><b>Our rating abroad does carry the signal.</b> Across ${PP.int(ev.n)} past foreign signings, our rating of the last season abroad correlated ${num(ev.raw_ours,2)} with how they did in MLS, WhoScored's match rating ${num(ev.raw_ws,2)}. Added to the same basics (age, position, league, minutes, salary), ours lifts the prediction to r ${num(ev.r_base_ours,2)} against ${num(ev.r_base_ws,2)} for WhoScored's, and both together reach ${num(ev.r_both,2)}. In a test fixed before it was run, ours adds to WhoScored's${ev.ours_adds ? "" : " (not confirmed)"}; WhoScored's adds nothing clear to ours.</li>` : ""}
    ${PP.data.market ? (() => { const M = PP.data.market; return `<li><b>MLS-move likelihood describes past moves, not interest.</b> Across ${PP.int(M.n)} player-seasons in these leagues since 2017/18, ${(M.base_rate*100).toFixed(1)}% made an MLS debut in the year their season ended or the next. The model (age, nationality, league, position, time at the club, tested on seasons it never saw) ranks well (AUC ${num(M.auc,2)}, against ${num(M.auc_baseline,2)} for league and age alone): the tenth it rated most likely moved ${(M.top_decile*100).toFixed(1)}% of the time, the bottom tenth ${(M.bottom_decile*100).toFixed(1)}%. Nationality matters most: players with US or Canadian nationality moved ${(M.us_can_rate*100).toFixed(0)}% of the time. It cannot see a player's wishes, wages or agent.</li>`; })() : ""}
    <li><b>It learned only from players MLS clubs chose to sign.</b> Profiles unlike any past signing (age, league or rating outside that range) are flagged as unusual and projected with less confidence.</li>
    <li><b>Ranges are honest but wide.</b> Each projection carries the range eight in ten past signings fell in; projections sit nearer the middle than the real best and worst will.</li>
  </ul></div>`;
}

/* ---------------- scouting ---------------- */
function scouting(){
  const SC = RC.scouting, el = $("#rbody"), f = S2.sc;
  if(!SC || !SC.players || !SC.players.length){ el.innerHTML = `<div class="missing"><b>The scouting database is being built</b><span>It appears once the feeder-league scrape and ratings finish.</span></div>`; return; }
  const leagues = [...new Set(SC.players.map(p => p.league))].sort(), v = SC.validation || {};
  const cov = {}; (SC.coverage||[]).forEach(c => { (cov[c.league] = cov[c.league] || []).push(`${String(c.season_label).replace("-","/")} (${c.matches} matches)`); });
  const sel = (id, opts, cur, label) => `<label class="fsel"><span class="r-small">${label}</span><select id="${id}">${opts.map(([k,t]) => `<option value="${k}"${String(k)===String(cur)?" selected":""}>${esc(t)}</option>`).join("")}</select></label>`;
  el.innerHTML = `<section class="band" style="padding-top:var(--s-4)">
    <div class="band-head"><h2 class="r-title">Players abroad who project well in MLS</h2>
      <p>Every outfield player with 900+ minutes over the last two seasons in the feeder leagues covered, rated with the same possession model as MLS players and projected into MLS: the expected rank among 2026 MLS regulars at the position, with the range eight in ten past signings fell in. Select a name for the full profile.</p>
      <p class="r-small">The projection learned from ${v.n ?? "–"} past foreign signings: age, position, league, appearances and goals alone predict their MLS quality at r ${num(v.r_S0,2)}; adding our rating of their last season abroad and their match ratings there (WhoScored's, used as an input but not shown) raises it to r ${num(v.r_S1,2)}. No salary is known for a player not yet signed, which is why this is lower than the signing grades. Covered: ${Object.entries(cov).map(([l,s]) => `${esc(l)} ${s.join(" and ")}`).join("; ")}. Goalkeepers are not projected.</p></div>
    <div class="exfilters" style="margin-bottom:var(--s-4)">
      ${sel("sclg", [["all","All leagues"], ...leagues.map(l => [l,l])], f.league, "League")}
      ${sel("scpos", [["all","All positions"],["CB","Centre backs"],["FB","Fullbacks"],["MID","Midfielders"],["ATT","Attackers"]], f.pos, "Position")}
      ${sel("scage", [["all","Any age"],["21","21 or under"],["23","23 or under"],["25","25 or under"],["28","28 or under"]], f.age, "Age")}
      ${PP.data.arch ? sel("scarch", [["all","All archetypes"], ...PP.data.arch.defs.filter(d => d.shown && d.side !== "keeper").map(d => [d.key, d.name])], f.arch, "Archetype") : ""}
      ${sel("scsort", [["pct","Projected MLS rank"],["hi","Upside (top of range)"],["age","Youngest"],["mins","Most minutes"]].concat(PP.data.market ? [["move","Most likely to move to MLS"],["contract","Contract ending soonest"]] : []), f.sort, "Order")}
      <label class="fsel fq"><span class="r-small">Player or club</span><input id="scq" type="search" value="${esc(f.q)}" placeholder="Search" autocomplete="off"></label>
      <label class="fchk"><input type="checkbox" id="schide"${f.hide?" checked":""}> Hide unusual profiles</label>
    </div>
    <div id="sclist"></div></section>`;
  const draw = () => {
    const q = f.q.trim().toLowerCase();
    let rows = SC.players.filter(p => (f.league === "all" || p.league === f.league) && (f.pos === "all" || p.pos_group === f.pos) && (f.age === "all" || (p.age != null && p.age <= +f.age)) && (!f.hide || !p.outside_support) && (f.arch === "all" || (SB[p.ws_player_id] || []).some(b => b[0] === f.arch))
      && (!q || (p.name||"").toLowerCase().includes(q) || (p.club||"").toLowerCase().includes(q)));
    const MKp = (PP.data.market || {}).players || {}, mk = p => MKp[String(Math.round(p.ws_player_id))];
    const key = {pct: p => -(p.mls_pct ?? -1), hi: p => -(p.pct_hi ?? -1), age: p => p.age ?? 99, mins: p => -(p.mins ?? 0),
      move: p => { const m = mk(p); return m && !m.in_mls && !m.ex_mls && m.p_move != null ? -m.p_move : 99; }, contract: p => { const m = mk(p); return (m && PP.contractEnd(m.contract)) || 9e15; }}[f.sort];
    rows.sort((a,b) => key(a) - key(b));
    const show = rows.slice(0, f.n);
    const pbar = (p, l, h) => `<span class="ibar" aria-hidden="true" style="width:120px"><span class="w" style="left:${(l??0)*100}%;width:${((h??0)-(l??0))*100}%"></span><span class="b" style="left:0;width:${(p??0)*100}%;background:var(--pct-${Math.min(5,Math.floor((p??0)*5)+1)})"></span></span>`;
    $("#sclist").innerHTML = `<div class="board-table tbl-wrap"><table class="board extable"><thead><tr><th class="n">#</th><th>Player</th><th class="n">Age</th><th class="n">Minutes</th><th class="n">Our rating /90</th>${PP.data.market ? `<th>Value</th><th class="n">MLS move chance</th>` : ""}<th>Projected MLS rank at position</th></tr></thead><tbody>
      ${show.map((p,i) => `<tr><td class="n rk">${i+1}</td><td class="who"><a href="#scout-${p.ws_player_id}">${esc(p.name)}</a>${PP.badgeMini(SB[p.ws_player_id] || [])}<small>${esc(p.club)}, ${esc(p.league)}, ${esc(GRP[p.pos_group] ? GRP[p.pos_group].replace(/s$/,"") : p.pos)}${p.outside_support ? ` <span class="tag">unusual profile</span>` : ""}</small></td>
        <td class="n">${p.age == null ? "–" : Math.round(p.age)}</td><td class="n">${PP.int(p.mins)}</td><td class="n">${p.prev_mpv == null ? "–" : sgn(p.prev_mpv,3)}</td>
        ${PP.data.market ? (() => { const m = mk(p); return `<td>${m && m.band ? esc(m.band) : "–"}${m && PP.contractText(m.contract) ? `<small class="r-small"> to ${esc(PP.contractText(m.contract))}</small>` : ""}</td><td class="n">${!m ? "–" : m.in_mls ? `<span class="tag">in MLS</span>` : m.ex_mls ? `<span class="tag">ex-MLS</span>` : m.p_move != null ? `${pctMove(m.p_move)}` : "–"}</td>`; })() : ""}
        <td><span class="valcell">${pbar(p.mls_pct, p.pct_lo, p.pct_hi)}<b>${p.mls_pct == null ? "–" : pctile(p.mls_pct)}</b><small class="r-small">range ${Math.round((p.pct_lo??0)*100)}–${Math.round((p.pct_hi??0)*100)}</small></span></td></tr>`).join("")}</tbody></table></div>
      <div class="board-list exlist2">${show.map((p,i) => `<a class="lrow" href="#scout-${p.ws_player_id}"><span class="rk">${i+1}</span><span class="nm">${esc(p.name)}${PP.badgeMini(SB[p.ws_player_id] || [])}</span><span class="val num">${p.mls_pct == null ? "–" : pctile(p.mls_pct)}</span><span class="meta">${esc(p.club)}, ${p.age == null ? "" : Math.round(p.age)+", "}${esc(GRP[p.pos_group]||"")}</span></a>`).join("")}</div>
      <p class="r-small" style="margin-top:var(--s-3)">${PP.int(rows.length)} players match. An unusual profile (age or ratings outside what MLS clubs have signed) is shown but projected with less confidence.${PP.data.market ? ` Value: Transfermarkt's market value, shown as a band. MLS move: the share of players like this (age, nationality, league, position, time at the club) who made an MLS debut in the year their season ended or the next; ${(PP.data.market.base_rate*100).toFixed(1)}% of all players in these leagues did. It describes past moves, not a player's interest.` : ""}</p>
      ${rows.length > f.n ? `<button type="button" class="btn btn-secondary" id="scmore">Show ${Math.min(60, rows.length - f.n)} more</button>` : ""}
      ${trust()}`;
    const more = $("#scmore"); if(more) more.addEventListener("click", () => { f.n += 60; draw(); });
  };
  [["sclg","league"],["scpos","pos"],["scage","age"],["scarch","arch"],["scsort","sort"]].forEach(([id,k]) => { const el = $("#"+id); if(el) el.addEventListener("change", e => { f[k] = e.target.value; f.n = 60; draw(); }); });
  $("#scq").addEventListener("input", e => { f.q = e.target.value; f.n = 60; draw(); });
  $("#schide").addEventListener("change", e => { f.hide = e.target.checked; f.n = 60; draw(); });
  draw();
}
})();
