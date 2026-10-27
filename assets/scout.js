/* Pitch Perception: scouting profiles (#scout-<id>), players abroad in the scouting database.
   Data: data/scouts/sNN.json, one shard per id % 32 (78_scout_pages.py). */
(function(){
"use strict";
const {$, $$, esc, sgn, num, pct, pctile} = PP;
const NS = 32, shards = {};
const GRP = {CB:"centre backs", FB:"fullbacks", MID:"midfielders", ATT:"attackers"};
const POSW = {DC:"Centre back", DL:"Left back", DR:"Right back", DML:"Left wing-back", DMR:"Right wing-back", DMC:"Defensive midfielder", MC:"Central midfielder",
  AMC:"Attacking midfielder", AML:"Left winger", AMR:"Right winger", ML:"Left midfielder", MR:"Right midfielder", FW:"Striker", FWL:"Left forward", FWR:"Right forward"};
const POS6 = {CB:"centre backs", FB:"fullbacks", CM_DM:"central midfielders", AM:"attacking midfielders", W:"wingers", ST:"strikers"};
const SK = [["On the ball","Passes and carries, valued by how much they moved the chance of a goal"],["Shooting","Chance quality of the shots taken (expected goals), not whether they went in"],
  ["Receiving","Getting on the end of passes in valuable places"],["Ball security","Value lost by giving the ball away (higher is better)"],["Winning the ball","Danger removed by winning the ball, beyond what a replacement would win back in the same minutes and danger"]];
const LG = {"england-premier-league":"Premier League","germany-bundesliga":"Bundesliga","spain-laliga":"LaLiga","italy-serie-a":"Serie A","france-ligue-1":"Ligue 1",
  "germany-2-bundesliga":"2. Bundesliga","england-championship":"Championship","england-league-one":"League One","netherlands-eredivisie":"Eredivisie","turkey-super-lig":"Süper Lig",
  "belgium-jupiler-pro-league":"Belgian Pro League","scotland-premiership":"Scottish Premiership","portugal-liga-portugal":"Liga Portugal","sweden-allsvenskan":"Allsvenskan",
  "norway-eliteserien":"Eliteserien","argentina-liga-profesional":"Argentina Liga Profesional","russia-premier-league":"Russian Premier League","brazil-brasileirão":"Brazil Série A",
  "china-super-league":"Chinese Super League","denmark-superliga":"Danish Superliga"};
const lgName = s => LG[s] || String(s || "–").replace(/^[a-z]+-/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
const surname = n => { const p = String(n).split(" "); return p.length > 1 ? p.slice(1).join(" ") : n; };
/* likely MLS contract type if they signed (event_model/recruiting/63, owner 2026-10-08). 63's test fixed in advance decides
   what is shown: its model, or, when the model fails the test (every night since 2026-10-17), the shares among past
   foreign signings of the player's age group, which the card then says (owner's OK, 2026-10-27) */
const CT = [["DP","Designated Player","var(--pct-5)"],["U22","U22 Initiative","var(--pct-4)"],["TAM/GAM","TAM / GAM","var(--pct-3)"],["Other","Senior or other","var(--pct-1)"]];
const ctInd = (c, age, meta) => { if(!c) return "";
  const M = (meta && meta.contract) || {}, shares = M.source === "age-group shares", young = age != null && age <= 22;
  const yrs = M.first && M.last ? `${M.first}&ndash;${String(M.last).slice(-2)}` : "past seasons";
  const n = shares ? (M.age_groups || {})[young ? "22_or_under" : "23_or_over"] : M.n;
  const i = c.indexOf(Math.max(...c)), top = CT[i];
  const bar = `<span class="ctbar" role="img" aria-label="${CT.map((k,j) => `${k[1]} ${Math.round(c[j]*100)}%`).join(", ")}">${CT.map((k,j) => c[j] >= 0.005 ? `<i style="width:${c[j]*100}%;background:${k[2]}" data-tip="${esc(`<b>${k[1]}</b><br>${Math.round(c[j]*100)}%`)}"></i>` : "").join("")}</span>`;
  const how = shares
    ? `How the ${n != null ? PP.int(n) + " " : ""}foreign signings of ${yrs} aged ${young ? "22 or under" : "23 or over"} signed in MLS. Every player in the age group shows the same shares: a model that also used league, ratings and output did not beat them in a test fixed in advance, so they are not an estimate for this player. Transfer fees are not known.`
    : M.source === "model" ? `If they signed in MLS: estimated by a model learned from ${n != null ? PP.int(n) + " " : ""}foreign signings of ${yrs} by age, league, ratings and output; it cannot see the transfer fee.`
    : `From the contract types past foreign signings were given in MLS; transfer fees are not known.`;
  return `<div class="ind ctind"><span class="r-label">${shares ? "How players this age signed" : "Likely contract type"}</span><span class="v">${top[1]}, ${Math.round(c[i]*100)}%</span>${bar}
    <span class="r-small">${(() => { const t = [CT.filter((k,j) => j !== i && c[j] >= 0.05).map(k => `${k[1]} ${Math.round(c[CT.indexOf(k)]*100)}%`).join(", "), age != null && age > 22 ? "too old for U22" : ""].filter(Boolean).join("; ");
      return t ? t.charAt(0).toUpperCase() + t.slice(1) + ". " : ""; })()}${how}</span></div>`; };
/* when the scouting data were updated, the latest match counted in the player's league, and the next weekly update
   (owner, 2026-10-27: "make it clear when recruiting data is updated or valid until"); data/scouts/*.json "meta" (78) */
const dataLine = (meta, league) => { if(!meta || !meta.built) return "";
  const last = (meta.latest || {})[league], due = meta.next_update, late = due && new Date().toISOString().slice(0,10) > due;
  return `<p class="r-small pdata">Scouting data updated ${PP.dayShort(meta.built)}${last ? `, with ${esc(league)} matches to ${PP.dateLong(last)}` : ""}. ${due ? (late ? `The weekly update due ${PP.dayShort(due)} has not run yet, so later matches are not counted.` : `Next update due ${PP.dayShort(due)}.`) : ""}</p>`; };
let ST = null;
const rangeText = (lo, hi) => hi >= 0.995 ? `${pctile(lo)} percentile to the very top` : lo <= 0.005 ? `the very bottom to the ${pctile(hi)} percentile` : `${pctile(lo)} to ${pctile(hi)} percentile`;

const load = s => shards[s] || (shards[s] = fetch(`data/scouts/s${String(s).padStart(2,"0")}.json`).then(r => { if(!r.ok) throw new Error(`scouting profile file returned ${r.status}`); return r.json(); }));

PP.pages.scout = async (main, h) => {
  const id = +String(h).split("-")[1];
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Scouting profile</h1><p class="r-small">Loading.</p></section></div>`;
  let D; try { [D] = await Promise.all([load(id % NS), PP.loadArch(), PP.loadMarket()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The scouting profile did not load</h1><p>${esc(e.message)}. Reload the page; if it persists, the site needs republishing.</p></section></div>`; return; }
  if(location.hash.slice(1) !== h) return;
  const rec = D.players[String(id)];
  if(!rec){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-name">Not in the scouting database</h1><p class="r-note">This player is not among the outfield players with 900+ minutes in the leagues we scout. <a href="#recruiting-scouting">Back to Scouting abroad</a>.</p></section></div>`; return; }
  const scout = rec.seasons.filter(s => s.scout && s.mins >= 450).sort((a,b) => b.mins - a.mins);
  const sorted = rec.seasons.filter(s => s.scout).sort((a,b) => String(b.season).localeCompare(String(a.season)));
  ST = {rec, meta: D.meta || null, list: sorted, s: (sorted.find(s => s.zones && s.mins >= 900) || scout[0] || sorted[0] || null), zoneMode:"t"};
  document.title = `${rec.name} | Recruiting | Pitch Perception`;
  render(main);
};

function render(main){
  const {rec, s} = ST, P = rec.projection;
  const MK = PP.data.market && PP.data.market.players[String(rec.id)];
  const facts = [["Club", rec.club], MK && MK.club_now && MK.club_now !== rec.club ? ["Club now", MK.club_now] : null, ["League", rec.league], ["Position", POSW[rec.pos] || rec.pos || "Not recorded"], rec.age != null ? ["Age", String(Math.round(rec.age))] : null,
    MK && MK.nat ? ["Nationality", MK.nat.split("|").join(", ")] : null,
    ["Minutes", `${PP.int(rec.mins)} (${rec.seasons_used > 1 ? "last two seasons" : rec.season_label})`], rec.goals != null ? ["Goals", String(Math.round(rec.goals))] : null,
    MK && MK.band ? ["Market value", `${MK.band} (Transfermarkt)`] : null, MK && PP.contractText(MK.contract) ? ["Contract until", PP.contractText(MK.contract)] : null].filter(Boolean);
  const mv = !MK ? `<span class="v">Not available</span><span class="r-small">Not matched to a Transfermarkt profile.</span>`
    : MK.in_mls ? `<span class="v">In MLS now</span><span class="r-small">Transfermarkt lists ${esc(MK.club_now || "an MLS club")} as the current club.</span>`
    : MK.ex_mls ? `<span class="v">Played in MLS before</span><span class="r-small">The likelihood model covers first moves only, so no estimate for a return.</span>`
    : MK.p_move == null ? `<span class="v">Not available</span>` : `<span class="v">${(MK.p_move*100).toFixed(MK.p_move < 0.1 ? 1 : 0)}%</span><span class="r-small">${PP.moveWords(MK.x_league)}: ${(MK.p_move*100).toFixed(1)}% of players like this made an MLS debut in the year their season ended or the next, against ${(MK.p_move/MK.x_league*100).toFixed(1)}% for a typical ${esc(rec.league)} player. A measure of past moves by similar players (age, nationality, league, position, time at the club), not of this player's own interest.</span>`;
  const grp = GRP[rec.pos_group] || "players";
  const rng = `<span class="ibar" aria-hidden="true" style="width:100%;max-width:340px;height:14px"><span class="w" style="left:${P.pct_lo*100}%;width:${(P.pct_hi-P.pct_lo)*100}%"></span><span class="b" style="left:0;width:${P.pct*100}%;background:var(--pct-${Math.min(5,Math.floor(P.pct*5)+1)})"></span></span>`;
  const why = s ? `${esc(surname(rec.name))} added ${sgn(s.rating)} goals over a replacement-level player in the ${esc(s.league)} ${esc(s.season)} in ${PP.int(s.mins)} minutes, ${s.attack >= s.defence ? `most of it with the ball (${sgn(s.attack)}, against ${sgn(s.defence)} winning it back)` : `most of it by winning the ball back (${sgn(s.defence)}, against ${sgn(s.attack)} with the ball)`}. Replacement level is the league's own, so this compares ${esc(surname(rec.name))} with that league, not with MLS.` : "";
  const seasonSeg = ST.list.filter(x => x.zones).length > 1 ? `<div class="seg sseason" role="group" aria-label="Season abroad">${ST.list.filter(x => x.zones).map(x => `<button type="button" data-k="${esc(x.key)}" aria-pressed="${x === s}">${esc(x.season)}${ST.list.filter(y => y.zones && y.season === x.season).length > 1 ? `, ${esc(x.team)}` : ""}</button>`).join("")}</div>` : "";
  main.innerHTML = `<div class="wrap"><section class="pid" aria-labelledby="pname">
      <a class="pclub" href="#recruiting-scouting">Scouting abroad</a>
      <h1 class="r-name" id="pname">${esc(rec.name)}</h1>
      ${s && s.badges && PP.data.arch ? PP.badgeChips(s.badges, s.pos, `the ${s.league} ${s.season}`) : ""}
      <dl class="pfacts">${facts.map(([k,v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      ${dataLine(ST.meta, rec.league)}
      ${seasonSeg}
    </section></div>
    <div class="wrap"><section class="plate pplate" aria-label="Projection">
      <div class="pp-left">
        <span class="r-label">Projected in MLS</span>
        <span class="r-figure">${pctile(P.pct)}</span>
        <div class="sub-fig"><span>percentile among 2026 MLS regular ${grp}, if signed now</span><span class="num">${num(P.q,3)} goals per 90 expected (80% range ${num(P.lo,3)} to ${num(P.hi,3)})</span></div>
        <div class="sig-cap"><span class="r-label">80% range</span><span class="r-small">${rangeText(P.pct_lo, P.pct_hi)}</span></div>
        ${rng}
        <div class="indicators">
          <div class="ind"><span class="r-label">Rating abroad</span>${s ? `<span class="v num">${sgn(s.p90,3)} per 90</span><span class="r-small">${s.pct != null ? `${pctile(s.pct)} percentile of ${POS6[s.pos] || "players at the position"} in the ${esc(s.league)}, ${esc(s.season)}` : (s.mins < 900 ? `No league percentile: that needs 900+ minutes in the season (${PP.int(s.mins)} so far)` : `Too few rated players at the position in that league-season for a percentile`)}.</span>` : `<span class="v">Not available</span>`}</div>
          ${(() => { const n = ST.list.find(x => x.season > (s ? s.season : "") && x.mins > 0); return n ? `<div class="ind"><span class="r-label">This season so far</span><span class="v num">${sgn(n.p90,3)} per 90</span><span class="r-small">${esc(n.league)} ${esc(n.season)}, ${PP.int(n.mins)} minutes at ${esc(n.team)}: too few for league percentiles (they need 900), but counted in the projection.</span></div>` : ""; })()}
          <div class="ind"><span class="r-label">Profile</span>${P.outside ? `<span class="v">Unusual</span><span class="r-small">Age or ratings outside what MLS clubs have signed before, so the projection rests on few comparable players.</span>` : `<span class="v">Typical</span><span class="r-small">Within the range of past foreign signings, so the projection has examples to learn from.</span>`}</div>
          <div class="ind"><span class="r-label">MLS move</span>${mv}</div>
          ${ctInd(rec.contract, rec.age, ST.meta)}
          <div class="ind"><span class="r-label">How sure</span><span class="v">${P.pct_hi - P.pct_lo > 0.4 ? "Wide range" : "Moderate range"}</span><span class="r-small">Eight in ten past signings with a projection like this landed ${P.pct_hi >= 0.995 ? `at or above the ${pctile(P.pct_lo)} percentile` : `between the ${pctile(P.pct_lo)} and ${pctile(P.pct_hi)} percentile`}.</span></div>
        </div>
      </div>
      <div class="pp-right">
        <div class="fig-cap"><span class="r-label">Where the value came from, per 90 minutes${s ? `, ${esc(s.league)} ${esc(s.season)}` : ""}</span>
          <div class="seg zmode" role="group" aria-label="Which value"><button type="button" data-m="t" aria-pressed="true">All</button><button type="button" data-m="a" aria-pressed="false">With the ball</button><button type="button" data-m="d" aria-pressed="false">Winning it</button></div></div>
        <div class="chart" id="sfinger"></div><div id="szleg" class="zleg"></div>
        <p class="r-note pp-why">${why}</p>
      </div>
    </section></div>
    ${skillsBand()}
    ${compsBand()}
    ${seasonsBand()}`;
  $$(".sseason button").forEach(b => b.addEventListener("click", () => { ST.s = ST.list.find(x => x.key === b.dataset.k && x.zones) || ST.s; render(main); }));
  $$(".zmode button").forEach(b => b.addEventListener("click", () => { ST.zoneMode = b.dataset.m; $$(".zmode button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); drawFinger($("#sfinger")); }));
  PP.chart($("#sfinger"), drawFinger); PP.zoneLegend($("#szleg"), PP.ZMAX, "goals per 90"); PP.bindTips($("#sfinger"));
  if($(".pid .bdgs")) PP.bindTips($(".pid .bdgs"));
  PP.bindDisclosures && PP.bindDisclosures(main);
}

function drawFinger(el){
  const s = ST.s, z = s && s.zones;
  if(!z){ el.innerHTML = `<div class="missing"><b>Not available</b><span>No located actions for this season.</span></div>`; return; }
  const a = z.a || Array(96).fill(0), d = z.d || Array(96).fill(0), mode = ST.zoneMode;
  PP.zoneMap(el, a.map((v,i) => (mode === "a" ? v : mode === "d" ? d[i] : v + d[i]) / 1e4), {maxW:640, whose:"the player's", label:`Where ${ST.rec.name} added value on the pitch`});
}

function skillsBand(){
  const s = ST.s; if(!s || !s.skills) return "";
  const has = s.skills.some(x => x[0] != null);
  const rows = SK.map(([l, d], i) => { const [p, v] = s.skills[i]; return `<div title="${esc(d)}"><span>${l}</span><span class="tr">${p != null ? `<span class="fl" style="width:${Math.max(2,p*100)}%;background:var(--pct-${Math.min(5,Math.floor(p*5)+1)})"></span>` : ""}</span><span class="p">${p != null ? pctile(p) : "–"}</span></div>`; }).join("");
  const pr = s.partners || [];
  const mx = Math.max(1e-9, ...pr.map(p => Math.abs(p[3])));
  const partners = pr.length ? `<div class="partners"><h3 class="r-heading">Most valuable connections</h3><p class="r-small">Completed passes with each teammate, either way, and the value those passes added, ${esc(s.league)} ${esc(s.season)}.</p>
    ${pr.map(p => `<div class="prow static"><span class="nm">${esc(p[1] || "Teammate")}</span><span class="tr"><i style="width:${Math.max(2, Math.abs(p[3])/mx*100)}%;background:${p[3]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(p[3])}</span><span class="r-small">${PP.int(p[2])} passes</span></div>`).join("")}</div>` : "";
  return `<section class="band" aria-labelledby="sk-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="sk-h">Skills in the ${esc(s.league)}</h2><p>Each skill per 90 minutes as a percentile among ${POS6[s.pos] || "players at the position"} with 900+ minutes in the ${esc(s.league)} ${esc(s.season)}, valued by the same possession model as MLS players.</p></div>
    <div class="scgrid"><div>${has ? `<div class="skill-list">${rows}</div>` : `<div class="missing"><b>No percentiles</b><span>Fewer than ten rated players at the position in this league-season, or under 900 minutes.</span></div>`}
      <p class="r-small" style="margin-top:var(--s-3)">Shooting counts chance quality, not finishing: finishing barely repeats from one season to the next.</p></div>${partners}</div>
  </div></section>`;
}

function compsBand(){
  const {rec} = ST, C = rec.comparables || [], L = rec.plays_like || [];
  const crow = c => `<tr><td class="who">${c.linked ? `<a href="#player-${c.id}">${esc(c.name)}</a>` : `<b>${esc(c.name)}</b>`}<small>from ${esc(c.prev_team || "–")}, ${esc(lgName(c.prev_league))}</small></td>
    <td class="n">${c.age != null ? Math.round(c.age) : "–"}</td><td class="n">${sgn(c.prev_mpv,3)}</td><td>${esc(c.mls_team || "–")}, ${c.first_season}</td>
    <td><span class="valcell"><span class="ibar" aria-hidden="true" style="width:90px"><span class="b" style="left:0;width:${(c.q_pct||0)*100}%;background:var(--pct-${Math.min(5,Math.floor((c.q_pct||0)*5)+1)})"></span></span><b>${pctile(c.q_pct)}</b></span></td></tr>`;
  const comps = C.length ? `<div class="tbl-wrap"><table class="board extable cmp"><thead><tr><th>Past signing</th><th class="n">Age</th><th class="n">Rating abroad /90</th><th>MLS club, first season</th><th>How it went</th></tr></thead><tbody>${C.map(crow).join("")}</tbody></table></div>
    <p class="r-small" style="margin-top:var(--s-3)">The five foreign signings since 2014 at the same position group nearest in age and rating abroad, preferring the same kind of league. "How it went" is their MLS quality per 90 over the first two seasons as a percentile among all ${GRP[rec.pos_group] || "players"} signed from abroad. ${(() => { const hits = C.filter(c => (c.q_pct||0) >= 0.5).length; return `${hits} of ${C.length} finished in the top half.`; })()}</p>`
    : `<div class="missing"><b>No comparable signings</b><span>No past foreign signing at this position had a rating abroad on record.</span></div>`;
  const plays = L.length ? `<div class="plays">${L.map(p => `<a class="pcard" href="${p.linked ? `#player-${p.id}-${p.year}` : "#players"}"><span class="nm">${esc(p.name)}</span><span class="meta">${PP.chip(p.team)}${esc(PP.short(p.team))}, ${p.year}</span></a>`).join("")}</div>
    <p class="r-small">Nearest by the five skills above, each measured against the player's own league and position, among MLS regulars at the same position in 2025–26. A style match, not a quality match.</p>` : "";
  return `<section class="band" aria-labelledby="cmp-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="cmp-h">Past signings who looked similar</h2><p>How players with a similar profile abroad have done after moving to MLS: the best guide to the range of outcomes, wider than any single projection.</p></div>
    ${comps}
    ${plays ? `<h3 class="r-heading" style="margin-top:var(--s-6)">Closest styles in MLS</h3>${plays}` : ""}
  </div></section>`;
}

function seasonsBand(){
  const all = ST.rec.seasons.slice().sort((a,b) => String(b.season).localeCompare(String(a.season)) || b.mins - a.mins);
  const rows = all.map(s => `<tr${s === ST.s ? ' class="cur"' : ""}><td>${esc(s.season)}</td><td>${esc(s.league)}</td><td>${esc(s.team)}</td><td>${esc(POS6[s.pos] ? POS6[s.pos].replace(/s$/,"") : "–")}</td><td class="n">${PP.int(s.mins)}</td>
    <td class="n">${sgn(s.rating)}</td><td class="n">${num(s.p90,3)}</td><td class="n">${sgn(s.attack)}</td><td class="n">${sgn(s.defence)}</td><td class="n">${s.pct != null ? pctile(s.pct) : "–"}</td></tr>`).join("");
  return `<section class="band" aria-labelledby="ss-h"><div class="wrap">
    <div class="band-head"><h2 class="r-title" id="ss-h">Every season abroad we have rated</h2><p>Value above each league's own replacement level, so seasons in different leagues are not directly comparable. Short spells are noisy.</p></div>
    <div class="tbl-wrap"><table class="dtable"><thead><tr><th>Season</th><th>League</th><th>Club</th><th>Position</th><th class="n">Minutes</th><th class="n">Value</th><th class="n">Per 90</th><th class="n">With the ball</th><th class="n">Winning it</th><th class="n">League percentile</th></tr></thead><tbody>${rows}</tbody></table></div>
    <ul class="mlist" style="margin-top:var(--s-5)">
      <li>Projections learned from past foreign signings, so they inherit those players' circumstances: the model has only seen players MLS clubs chose to sign.</li>
      <li>Ratings abroad use MLS-fitted models (expected goals, possession values), applied as they are; expected goals fit the scouted leagues closely (goals ÷ expected goals 0.99 on average).</li>
      <li>Off-ball movement, marking and shape are invisible in event data, here as in MLS.</li>
    </ul>
  </div></section>`;
}
})();
