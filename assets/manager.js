/* Pitch Perception: managers. Data: data/managers.json (event_model/91_managers.py). Routes: #managers, #manager-<slug>.
   The score: expected-goal difference per match above what the manager's XIs' pre-season player ratings predict,
   shrunk toward zero by matches managed, with a 90% range. Style, formations, substitutions and squad use per season. */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pctile, short, full, chip} = PP;
let mgrP = null;
const loadManagers = () => mgrP || (mgrP = fetch("data/managers.json").then(r => { if(!r.ok) throw new Error(`managers.json returned ${r.status}`); return r.json(); }));
PP.loadManagers = loadManagers;
const MINN = 30;      // percentiles and the index use managers with 30+ matches in the score's seasons (2021-26)
const STYLE = [       // key, label, how to read the raw value, invert (lower raw = more of the trait)
  ["poss", "Possession", v => `${Math.round(v*100)}% of passes`, false],
  ["fwd_per_pass", "Directness", v => `${num(v,1)} m forward per completed pass`, false],
  ["ppda", "Pressing", v => `${num(v,1)} opponent passes per defensive action (lower is more pressing)`, true],
  ["def_height", "Defensive line height", v => `wins the ball ${num(v,0)} m from their own goal on average`, false],
  ["crosses", "Crossing", v => `${num(v,1)} crosses per match`, false],
  ["sp_share", "Set-piece reliance", v => `${Math.round(v*100)}% of non-penalty xG from set pieces`, false],
  ["xg_per_shot", "Chance quality", v => `${num(v,3)} xG per non-penalty shot`, false]];
const scoreWords = sc => sc.lo > 0 ? "Clearly above what their squads predict" : sc.hi < 0 ? "Clearly below what their squads predict" : "Within the range of what their squads predict";

/* ---------------- index ---------------- */
PP.pages.managers = async main => {
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Managers</h1><p class="r-small">Loading.</p></section></div>`;
  let M; try { [M] = await Promise.all([loadManagers(), PP.loadImages()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The managers' data did not load</h1><p>${esc(e.message)}.</p></section></div>`; return; }
  const cur = M.managers.filter(m => m.current).sort((a,b) => (b.score ? b.score.value : -9) - (a.score ? a.score.value : -9));
  const past = M.managers.filter(m => !m.current && m.score && m.score.n >= MINN).sort((a,b) => b.score.value - a.score.value);
  const all = M.managers.filter(m => m.score), d0 = Math.min(-0.6, ...all.map(m => m.score.lo)), d1 = Math.max(0.6, ...all.map(m => m.score.hi));
  const since = m => { const st = m.stints.filter(s => s.team === m.current); return st.length ? st[0].first : null; };
  const row = (m, i, club) => { const sc = m.score;
    return `<a class="mgrow" href="#manager-${m.slug}"><span class="rk">${i+1}</span><span class="nm">${club ? `${PP.crestImg(club, 22) || chip(club)}` : ""}<b>${esc(m.name)}</b>${club ? `<span class="r-small">${esc(short(club))}${since(m) ? `, since ${PP.dateLong(since(m))} ${since(m).slice(0,4)}` : ""}</span>` : `<span class="r-small">${m.teams.map(t => esc(short(t))).join(", ")}</span>`}</span>
      <span class="num">${sc ? sc.n : 0}</span><span class="val">${sc ? `${PP.ibar(sc.value, sc.lo, sc.hi, d0, d1)}<b>${sgn(sc.value)}</b>` : `<span class="r-small">no matches with ratings</span>`}</span></a>`; };
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Managers</h1>
      <p class="r-note" style="max-width:66ch">How each MLS manager's teams have done against what their players predict, and how they play. The score is expected-goal difference per match above what the starting elevens' pre-season player ratings predict, 2021&ndash;26 regular seasons, pulled toward zero for managers with few matches. The bar is the 90% range.</p>
      <p class="r-small" style="max-width:66ch">${esc(M.reading === "plain" ? "Steady within a season (reliability 0.64), but it carries over only modestly from one season to the next, so read it as how their teams have performed, not a fixed trait." : M.reading)}</p></section>
    <section class="band"><div class="band-head"><h2 class="r-title">Current managers</h2><p>The 30 clubs' managers at their latest match. Matches count only 2021&ndash;26, the seasons with player ratings to compare against.</p></div>
      <div class="mlist"><div class="mghead"><span></span><span>Manager</span><span>Matches</span><span>xG per match above the squad</span></div>${cur.map((m,i) => row(m, i, m.current)).join("")}</div></section>
    <section class="band"><div class="band-head"><h2 class="r-title">Former managers</h2><p>Managers with ${MINN}+ matches since 2021 who are no longer at an MLS club.</p></div>
      <div class="mlist"><div class="mghead"><span></span><span>Manager</span><span>Matches</span><span>xG per match above the squad</span></div>${past.map((m,i) => row(m, i, null)).join("")}</div></section></div>`;
  $$(".ibar", main).forEach(PP.bindTips);
};

/* ---------------- profile ---------------- */
let MS = null;
PP.pages.manager = async (main, h) => {
  const sl = h.slice(8), want = (sl.match(/-(\d{4})-(.+)$/) || []);
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Manager</h1><p class="r-small">Loading.</p></section></div>`;
  let M; try { [M] = await Promise.all([loadManagers(), PP.loadImages()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The managers' data did not load</h1><p>${esc(e.message)}.</p></section></div>`; return; }
  const m = M.managers.find(x => sl === x.slug || sl.startsWith(x.slug + "-"));
  if(!m){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">No manager with this link</h1><a class="btn-text" href="#managers">All managers</a></section></div>`; return; }
  const key = s => `${s.season}-${PP.slug(s.team)}`;
  const pick = sl.length > m.slug.length ? sl.slice(m.slug.length + 1) : null;
  const st = m.stints.find(s => key(s) === pick) || m.stints[m.stints.length - 1];
  MS = {M, m, st};
  main.innerHTML = mIdentity() + mPlate() + mStyle() + mShape() + mStints();
  $$(".mseason button", main).forEach(b => b.addEventListener("click", () => { location.hash = `#manager-${m.slug}-${b.dataset.k}`; }));
  PP.chart($("#msignal"), drawSignal);
  ["#msignal", ".mstyle", ".mforms"].forEach(q => $$(q).forEach(PP.bindTips));
};

function mIdentity(){
  const {m, st} = MS, cur = m.current;
  const tot = m.stints.reduce((a, s) => [a[0]+s.record[0], a[1]+s.record[1], a[2]+s.record[2]], [0,0,0]);
  const facts = [["Current club", cur ? full(cur) : "None in MLS"], ["MLS matches since 2020", PP.int(m.matches)], ["Record", tot.join("–")],
    ["Clubs", m.teams.map(t => short(t)).join(", ")]];
  const crest = cur ? PP.crestImg(cur, 112) : "";
  const key = s => `${s.season}-${PP.slug(s.team)}`;
  return `<div class="wrap"><section class="pid${crest ? " has-ph" : ""}" aria-labelledby="mname">
    ${crest ? `<div class="pid-ph pid-crest">${crest}</div>` : ""}
    <a class="pclub" href="#managers">Managers</a>
    <h1 class="r-name" id="mname">${esc(m.name)}</h1>
    <dl class="pfacts">${facts.map(([k,v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${m.stints.length > 1 ? `<div class="seg pseason mseason" role="group" aria-label="Season">${m.stints.map(s => `<button type="button" data-k="${key(s)}" aria-pressed="${s === st}">${s.season}${m.teams.length > 1 ? " " + esc(short(s.team)) : ""}</button>`).join("")}</div>` : ""}
  </section></div>`;
}

function mPlate(){
  const {M, m, st} = MS, sc = m.score;
  const big = sc ? `<span class="r-label">Manager score, 2021&ndash;26</span><span class="r-figure">${sgn(sc.value)}</span>
      <div class="sub-fig"><span>expected goals per match above what their starting elevens' pre-season ratings predict</span>${sc.n >= MINN && sc.pct != null ? `<span>${pctile(sc.pct)} percentile of managers with ${MINN}+ matches</span>` : `<span>${sc.n} matches: too few to rank against other managers</span>`}</div>
      <div class="sig-cap"><span class="r-label">${esc(scoreWords(sc))}</span><span class="r-small">90% range ${sgn(sc.lo)} to ${sgn(sc.hi)}</span></div><div class="chart" id="msignal"></div>`
    : `<span class="r-label">Manager score</span><span class="r-figure">–</span><div class="sub-fig"><span>No matches in 2021&ndash;26, the seasons the score covers.</span></div>`;
  const ppm = st.ppm != null && st.xppm != null ? `<span class="v num">${num(st.ppm,2)} points per match</span><span class="r-small">${st.xppm != null ? `Expected from the players they fielded: ${num(st.xppm,2)}` : ""}</span>` : `<span class="v num">${st.ppm != null ? num(st.ppm,2) : "–"}</span><span class="r-small">No expectation for ${st.season}.</span>`;
  return `<div class="wrap"><section class="plate pplate" aria-label="Manager score"><div class="pp-left">${big}
      <div class="indicators">
        <div class="ind"><span class="r-label">${st.season}, ${esc(short(st.team))}</span>${ppm}</div>
        <div class="ind"><span class="r-label">Record</span><span class="v num">${st.record.join("–")}</span><span class="r-small">${st.matches} regular-season matches, ${PP.dateLong(st.first)} to ${PP.dateLong(st.last)} ${st.last.slice(0,4)}</span></div>
        <div class="ind"><span class="r-label">That season, above the squad</span><span class="v num">${st.resid != null ? sgn(st.resid) + " xG per match" : "–"}</span><span class="r-small">Unshrunk; one season is noisy.</span></div>
      </div></div>
    <div class="pp-right"><p class="r-note">${esc(note(m, st))}</p>
      <p class="r-small">How it works: the starting elevens' pre-season player ratings (last season, plus contract-type and previous-league estimates for newcomers; nothing from the season being played) predict each match's expected-goal difference, and the score is how far their matches beat that prediction. It is steady within a season but carries over only modestly from one season to the next (a correlation of about 0.2), so it describes how their teams have done more than it predicts how their next team will do. Expected points use the same prediction: the predicted expected-goal difference of each match is turned into win, draw and defeat chances by a model fitted on MLS matches from other seasons, and expected points are three times the win chance plus the draw chance, averaged over their matches.</p></div>
  </section></div>`;
}
function note(m, st){
  const s = st.style, top = STYLE.map(([k, l, , inv]) => [l, s[k] && s[k][1] != null ? (inv ? 1 - s[k][1] : s[k][1]) : null]).filter(x => x[1] != null).sort((a,b) => Math.abs(b[1]-0.5) - Math.abs(a[1]-0.5)).slice(0, 2);
  const f = (st.formations || [])[0];
  const traits = top.map(([l, p]) => `${p >= 0.5 ? "high" : "low"} ${l.toLowerCase()} (${pctile(p)} percentile)`).join(" and ");
  return `In ${st.season} at ${short(st.team)}, ${m.name.split(" ").slice(-1)[0]}'s side stood out for ${traits}${f ? `, mostly in a ${f[0].split("").join("-")} (${Math.round(f[1]*100)}% of minutes)` : ""}.`;
}
function drawSignal(el){
  const sc = MS.m.score; if(!sc) return; const W = el.clientWidth; if(!W) return; const H = 64; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Manager score ${sgn(sc.value)}, range ${sgn(sc.lo)} to ${sgn(sc.hi)}`},el);
  const lo = Math.min(-0.6, sc.lo - 0.05), hi = Math.max(0.6, sc.hi + 0.05), m = {l:8, r:8}, ay = 28, sx = v => m.l + (v-lo)/(hi-lo)*(W-m.l-m.r);
  S("line",{x1:m.l,x2:W-m.r,y1:ay,y2:ay,class:"g-line"},svg);
  for(let v = Math.ceil(lo*5)/5; v <= hi + 1e-9; v += 0.2){ S("line",{x1:sx(v),x2:sx(v),y1:ay+4,y2:ay+8,class:"g-base"},svg); text(svg, sx(v), ay+22, Math.abs(v) < 1e-9 ? "0" : sgn(v,1), "t-axis", {"text-anchor":"middle"}); }
  S("line",{x1:sx(0),x2:sx(0),y1:ay-12,y2:ay+8,stroke:"var(--mid)","stroke-width":2},svg);
  S("rect",{x:sx(sc.lo),y:ay-8,width:Math.max(2,sx(sc.hi)-sx(sc.lo)),height:16,rx:2,fill:"var(--band)","data-tip":`90% range: ${sgn(sc.lo)} to ${sgn(sc.hi)} xG per match`},svg);
  S("rect",{x:sx(sc.value)-6.5,y:ay-6.5,width:13,height:13,fill:"var(--signal)",stroke:"var(--raised)","stroke-width":2,transform:`rotate(45 ${sx(sc.value)} ${ay})`,"data-tip":`<b>${sgn(sc.value)}</b> xG per match above the squad`},svg);
}

function mStyle(){
  const {st} = MS, s = st.style;
  const band = p => Math.min(5, Math.floor(p * 5) + 1);
  const rows = STYLE.map(([k, l, fmt, inv]) => { const v = s[k]; if(!v || v[0] == null || v[1] == null) return "";
    const p = inv ? 1 - v[1] : v[1];
    return `<div class="pctrow" data-tip="${esc(`<b>${l}</b><br>${fmt(v[0])}${v[2] != null ? ` (${st.season} league average ${fmt(v[2])})` : ""}<br>${pctile(p)} percentile of manager-seasons since 2020, each against its season's league average`)}"><span class="pl">${l}</span><span class="pt" role="img" aria-label="${l}: ${pctile(p)}"><b style="width:${Math.max(1, p*100)}%;background:var(--pct-${band(p)})"></b><i style="left:${p*100}%"></i><u></u></span><span class="pv num">${pctile(p)}</span></div>`; }).join("");
  const sb = st.subs, sq = st.squad;
  return `<section class="band" aria-labelledby="mst-h"><div class="wrap"><div class="band-head"><h2 class="r-title" id="mst-h">How their team plays</h2><p>${st.season}, ${esc(short(st.team))}: each trait as a percentile of all manager-seasons since 2020 with 10+ matches (0 lowest, 100 highest). Each season is measured against that season's league average, because the league as a whole has changed: passes travel about a quarter less far forward than in 2020&ndash;22, and teams press less. Hover for the measure behind it.</p></div>
    <div class="mgrid"><div class="pctbars mstyle">${rows}</div>
      <div class="facts2">
        <div><span class="r-label">Substitutions</span><span class="v num">${sb.per_match != null ? num(sb.per_match,1) : "–"} per match</span><span class="r-small">First change around minute ${sb.first_minute ?? "–"}${sb.first_trailing != null && sb.first_not_trailing != null ? ` (minute ${sb.first_trailing} when behind, ${sb.first_not_trailing} otherwise)` : ""}; ${sb.before_60 != null ? num(sb.before_60,1) : "–"} before the hour per match.</span></div>
        <div><span class="r-label">Squad use</span><span class="v num">${sq.starters_used} players started</span><span class="r-small">${sq.xi_changes != null ? num(sq.xi_changes,1) : "–"} changes to the starting eleven per match; ${sq.u22_minutes != null ? Math.round(sq.u22_minutes*100) + "%" : "–"} of minutes to players 22 and under.</span></div>
      </div></div></div></section>`;
}

function mShape(){
  const {st} = MS, fs = st.formations || [];
  const nice = f => f.split("").join("-");
  return `<section class="band" aria-labelledby="msh-h"><div class="wrap"><div class="band-head"><h2 class="r-title" id="msh-h">Shapes</h2><p>Share of minutes in each formation in ${st.season} (as recorded by Opta), and how often the shape changed during a match: ${st.shape_changes != null ? num(st.shape_changes,1) : "–"} changes per match.</p></div>
    <div class="mforms">${fs.map(([f, sh]) => `<div class="mform" data-tip="${esc(`<b>${nice(f)}</b><br>${Math.round(sh*100)}% of minutes`)}"><span class="fshape">${nice(f)}</span><span class="fb"><i style="width:${Math.max(1, sh*100)}%"></i></span><span class="num">${Math.round(sh*100)}%</span></div>`).join("") || `<p class="r-small">No formations recorded.</p>`}</div></div></section>`;
}

function mStints(){
  const {m} = MS;
  return `<section class="band" aria-labelledby="mss-h"><div class="wrap"><div class="band-head"><h2 class="r-title" id="mss-h">Season by season</h2><p>Regular-season matches with WhoScored data since 2020. "Above the squad" is the season's unshrunk figure; points expected come from the same pre-season ratings.</p></div>
    <div class="tbl-wrap"><table class="dtable"><thead><tr><th>Season</th><th>Club</th><th class="n">Matches</th><th class="n">Record</th><th class="n">Points per match</th><th class="n">Expected</th><th class="n">Above the squad, xG per match</th></tr></thead>
    <tbody>${m.stints.slice().reverse().map(s => `<tr${s === MS.st ? ' class="cur"' : ""}><td>${s.season}</td><td><a href="#team-${PP.slug(s.team)}-${s.season}">${esc(short(s.team))}</a></td><td class="n">${s.matches}</td><td class="n">${s.record.join("–")}</td><td class="n">${s.ppm != null ? num(s.ppm,2) : "–"}</td><td class="n">${s.xppm != null ? num(s.xppm,2) : "–"}</td><td class="n">${s.resid != null ? sgn(s.resid) : "–"}</td></tr>`).join("")}</tbody></table></div></div></section>`;
}

/* ---------------- team page card ---------------- */
PP.managerCard = async (team, year) => {
  let M; try { M = await loadManagers(); } catch(e){ return ""; }
  const hits = M.managers.flatMap(m => m.stints.filter(s => s.team === team && s.season === year).map(s => ({m, s}))).sort((a,b) => a.s.first < b.s.first ? -1 : 1);
  if(!hits.length) return "";
  return `<section class="band" aria-labelledby="tmg-h"><div class="wrap"><div class="band-head"><h2 class="r-title" id="tmg-h">The manager${hits.length > 1 ? "s" : ""}</h2><p>${hits.length > 1 ? `${hits.length} managers took charge in ${year}.` : `${year}.`} The score is expected goals per match above what the starting elevens' pre-season ratings predict, 2021&ndash;26.</p></div>
    <div class="mcards">${hits.map(({m, s}) => { const sc = m.score, f = (s.formations || [])[0];
      return `<a class="mcard" href="#manager-${m.slug}-${s.season}-${PP.slug(s.team)}"><span class="r-label">${s.matches} matches, ${s.record.join("–")}</span><b class="mn">${esc(m.name)}</b>
        <span class="num">${sc ? `${sgn(sc.value)} xG per match above the squad (range ${sgn(sc.lo)} to ${sgn(sc.hi)})` : "No score yet"}</span>
        <span class="r-small">${f ? `Mostly ${f[0].split("").join("-")}` : ""}${s.ppm != null ? `${f ? "; " : ""}${num(s.ppm,2)} points per match` : ""}</span><span class="r-small more">Full profile</span></a>`; }).join("")}</div></div></section>`;
};
})();
