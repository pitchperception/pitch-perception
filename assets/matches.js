/* Pitch Perception: Matches list and match pages. Data: data/matches.json (every 2026 match). */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, short, full, chip, clubTag} = PP;
let mP = null, M = null, FILTER = "all", RP = null, LOGD = null;
const load = () => mP || (mP = fetch("data/matches.json").then(r => { if(!r.ok) throw new Error(`matches.json returned ${r.status}`); return r.json(); }));
const STAKE = (s, conf) => ({"top 7":"a top-seven finish","playoffs":"the playoffs","1st in conference":`first place in the ${conf}`,"Supporters' Shield":"the Supporters' Shield","MLS Cup":"MLS Cup"}[s] || s);
const kickDate = m => m.kickoff_utc ? new Date(m.kickoff_utc.replace("Z",":00Z")) : new Date(m.date+"T23:00:00Z");
const dayKey = d => d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",timeZone:"America/New_York"}).replace(",", "");
const timeOf = d => d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).replace(" AM"," am").replace(" PM"," pm") + " ET";
const src = s => s === "lineups" ? `<span class="src"><i class="st confirmed"></i>Confirmed lineups</span>` : s === "availability" ? `<span class="src"><i class="st likely"></i>Likely lineups from the availability report</span>` : `<span class="src"><i class="st model"></i>Team strength only; no lineup news yet</span>`;
const pbar = (m, big) => { const [h, a] = PP.pairKit(m.home, m.away); return `<div class="pbar${big?" big":""}" role="img" aria-label="${esc(short(m.home))} ${pct(m.pH)}, draw ${pct(m.pD)}, ${esc(short(m.away))} ${pct(m.pA)}"><i style="width:${m.pH*100}%;background:${h}"></i><i style="width:${m.pD*100}%;background:var(--mid)"></i><i style="width:${m.pA*100}%;background:${a}"></i></div>`; };
/* live forecast record (96, owner 2026-10-09): what the site said before kickoff, written down at the time */
const logged = id => ((LOGD && LOGD.rows) || {})[String(id)] || null;
const whenET = iso => { const d = new Date(iso); return `${dayKey(d)}, ${timeOf(d)}`; };
const recordLine = () => {
  if(!LOGD || !LOGD.started) return "";
  const sc = LOGD.score || {}, since = dayKey(new Date(LOGD.started));
  const tail = ` Every forecast is written down before kickoff and never changed: <a href="data/forecast_log.csv">the full record</a>.`;
  return sc.n ? `<p class="r-small">Live record since ${since}: ${sc.n} match${sc.n === 1 ? "" : "es"} forecast before kickoff, average log loss ${num(sc.log_loss,3)} against ${num(sc.baseline_log_loss,3)} for simply predicting the league's usual home, draw and away rates (lower is better).${tail}</p>`
                : `<p class="r-small">From ${since}, the forecasts here are a live record.${tail} Earlier forecasts on this site are reconstructed with today's model.</p>`;
};
const recordNote = (m, played) => {
  const L = logged(m.id); if(!L) return played ? `<p class="r-small">Reconstructed: this match came before the live record began.</p>` : "";
  const r = L[L.length-1];
  return `<p class="r-small">${played ? "The forecast recorded before kickoff" : "Recorded"} on ${whenET(r[0])}: ${pctShort(r[1])} home win, ${pctShort(r[2])} draw, ${pctShort(r[3])} away win${L.length > 1 ? ` (updated ${L.length - 1} time${L.length > 2 ? "s" : ""} before kickoff)` : ""}.</p>`;
};
const confOf = t => ((((PP.data.home||{}).race||{}).teams||[]).find(x => x.team === t) || {}).conference || "";

async function ready(main, title){
  if(M) return true;
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">${title}</h1><p class="r-small">Loading matches.</p></section></div>`;
  try { M = await load(); try { const r = await fetch("data/forecast_log.json"); LOGD = r.ok ? await r.json() : null; } catch(e){ LOGD = null; } return true; }
  catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The match data did not load</h1><p>${esc(e.message)}. Reload the page; if it persists, the site needs republishing.</p></section></div>`; return false; }
}

/* ---------------- list ---------------- */
PP.pages.matches = async main => {
  if(!(await ready(main, "Matches"))) return;
  if(location.hash.slice(1) !== "matches") return;
  const now = Date.now(), all = M.matches.slice().sort((a,b) => kickDate(a) - kickDate(b));
  const teams = [...new Set(all.flatMap(m => [m.home, m.away]))].sort((a,b) => short(a).localeCompare(short(b)));
  const draw = () => {
    const f = m => FILTER === "all" || m.home === FILTER || m.away === FILTER;
    const up = all.filter(m => m.status === "upcoming" && kickDate(m) > now - 2*3600e3 && f(m)).slice(0, FILTER === "all" ? 24 : 12);
    const past = all.filter(m => m.status === "played" && f(m)).reverse().slice(0, FILTER === "all" ? 24 : 34);
    const group = arr => { const g = []; arr.forEach(m => { const k = dayKey(kickDate(m)); if(!g.length || g[g.length-1][0] !== k) g.push([k, []]); g[g.length-1][1].push(m); }); return g; };
    const upRow = m => `<a class="fx fxl" href="#match-${m.id}"><span class="time">${timeOf(kickDate(m))}</span>
      <div class="teams"><span>${clubTag(m.home, true)}</span><span>${clubTag(m.away, true)}</span></div>
      <div class="probs">${pbar(m)}
        <div class="plab"><span><b>${pctShort(m.pH)}</b> win</span><span>${pctShort(m.pD)} draw</span><span><b>${pctShort(m.pA)}</b> win</span></div></div>
      <div class="stake">${src(m.source)}<span class="r-small">Expected goals ${num(m.xg_home,2)} to ${num(m.xg_away,2)}${m.importance!=null?`; importance ${Math.round(m.importance)} of 100`:""}</span></div></a>`;
    const pastRow = m => { const d = M.detail[String(m.id)] || {}, th = (d.top_home||[])[0], ta = (d.top_away||[])[0];
      return `<a class="fx fxl fxp" href="#match-${m.id}"><span class="score num">${m.g_home}–${m.g_away}</span>
      <div class="teams"><span>${clubTag(m.home, true)}</span><span>${clubTag(m.away, true)}</span></div>
      <div class="xgpair num"><span>xG ${num(m.xg_home,2)}</span><span>xG ${num(m.xg_away,2)}</span></div>
      <div class="stake r-small">${th && ta ? `Most value added: ${esc(th[1])} (${sgn(th[2],2)}) and ${esc(ta[1])} (${sgn(ta[2],2)})` : ""}</div></a>`; };
    $("#mlist").innerHTML = `<section class="band" style="padding-top:0"><div class="band-head"><h2 class="r-title">Coming up</h2><p>Win, draw and defeat chances from the forecast, with lineup news where it exists. Kickoff times are Eastern.</p></div>
      <div class="fixtures">${group(up).map(([k, arr]) => `<div class="fx-day">${k}</div>${arr.map(upRow).join("")}`).join("") || `<p class="r-small">No matches scheduled.</p>`}</div></section>
      <section class="band"><div class="band-head"><h2 class="r-title">Results</h2><p>Scores, expected goals, and the player who added the most value on each side. Open a result for its match report.</p></div>
      <div class="fixtures">${group(past).map(([k, arr]) => `<div class="fx-day">${k}</div>${arr.map(pastRow).join("")}`).join("")}</div></section>`;
  };
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Matches</h1><p class="r-note standfirst">Every 2026 match: the forecast before it, and what happened after. Open a match for lineups, stakes and who made the difference.</p>${recordLine()}
    <label class="fsel" style="justify-self:start"><span class="r-small">Club</span><select id="mteam"><option value="all">All clubs</option>${teams.map(t => `<option value="${esc(t)}"${t===FILTER?" selected":""}>${esc(full(t))}</option>`).join("")}</select></label></section>
    <div id="mlist"></div></div>`;
  $("#mteam").addEventListener("change", e => { FILTER = e.target.value; draw(); });
  draw();
};

/* ---------------- post-match report (82_weekly.py) ---------------- */
const POSW = {CB:"centre back", FB:"fullback", CM_DM:"central midfielder", AM:"attacking midfielder", W:"winger", ST:"striker", GK:"keeper"};
function report(m, R, wk){
  const [gh, ga] = R.g, hw = gh > ga, aw = ga > gh, win = hw ? 0 : aw ? 2 : 1, W = hw ? m.home : aw ? m.away : null, L = hw ? m.away : m.home;
  const pc = R.xg_probs[win], pre = R.pre && R.pre[win] != null ? R.pre[win] : null, recon = R.pre && R.pre[3] === "reconstructed";
  const chances = `${num(R.xg[0],2)} expected goals to ${num(R.xg[1],2)}`;
  const lede = W ? `${esc(short(W))} ${hw ? "beat" : "won at"} ${esc(short(L))} ${Math.max(gh,ga)}–${Math.min(gh,ga)}${pc >= 0.5 ? `, and the chances agreed: ${chances}. On those chances they win ${pct(pc)} of the time.` : pc >= 0.35 ? `, from chances that were close: ${chances}. On those chances they win ${pct(pc)} of the time.` : `, despite the chances: ${chances}. On those chances they win only ${pct(pc)} of the time.`}${pre != null ? ` Before kickoff the forecast gave them ${pct(pre)}${recon ? " (reconstructed)" : ""}.` : ""}`
    : `${esc(short(m.home))} and ${esc(short(m.away))} drew ${gh}–${ga}. The chances: ${chances}; on those a draw happens ${pct(pc)} of the time.${pre != null ? ` Before kickoff the forecast gave a draw ${pct(pre)}${recon ? " (reconstructed)" : ""}.` : ""}`;
  const bar3 = (p, label) => `<div class="mrbar"><span class="r-label">${label}</span>${pbar({home:m.home, away:m.away, pH:p[0], pD:p[1], pA:p[2]}, true)}
    <div class="plab"><span><b>${pct(p[0])}</b> ${esc(short(m.home))}</span><span>${pct(p[1])} draw</span><span><b>${pct(p[2])}</b> ${esc(short(m.away))}</span></div></div>`;
  const tops = side => { const arr = R.top[side] || [], team = side === "home" ? m.home : m.away, mx = Math.max(0.05, ...arr.map(x => Math.abs(x[4]||0))), kp = (R.keepers||[]).find(k => k[2] === (side === "home" ? 0 : 1));
    return `<div class="mtop"><h3 class="r-heading">${clubTag(team, true)}</h3>${arr.map(x => `<a class="prow" href="#player-${x[0]}"><span class="nm">${esc(x[1]||"")}${PP.badgeMini(PP.badgesFor(x[0], 2026, team))}</span><span class="tr"><i style="width:${Math.max(2,Math.abs(x[4])/mx*100)}%;background:${x[4]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(x[4],2)}</span><span class="r-small">${esc(POSW[x[2]]||"")}, ${PP.int(x[3])} min</span></a>`).join("")}
      ${kp ? `<p class="r-small" style="margin-top:var(--s-2)">In goal: <a href="#player-${kp[0]}">${esc(kp[1])}</a>, ${sgn(kp[3],2)} goals prevented against the shots faced.</p>` : ""}</div>`; };
  const moms = (R.moments || []).map(x => { const team = x[1] === 0 ? m.home : m.away;
    return `<div class="mom"><span class="num min">${x[0]}'</span><span class="who">${chip(team)}<a href="#player-${x[2]}">${esc(x[3]||"")}</a></span><span class="act">${esc(x[4])}</span><span class="v num">${sgn(x[5],2)}</span></div>`; }).join("");
  const ch = R.chain;
  return `<div class="wrap"><section class="plate pplate mplate" aria-label="The result against the chances">
      <div class="pp-left"><span class="r-label">Match report</span><p class="r-note mlede">${lede}</p>${wk ? `<a class="btn-text" href="#week-${wk.week}">The week in review: ${esc(PP.weekRange(wk))}</a>` : ""}</div>
      <div class="pp-right">${R.pre && R.pre[0] != null ? bar3(R.pre, `Before kickoff${recon ? " (reconstructed from the model)" : ""}`) : ""}${bar3(R.xg_probs, "On the chances: every shot scored with its expected-goal probability")}</div>
    </section></div>
    <section class="band" id="mracesec"><div class="wrap"><div class="band-head"><h2 class="r-title">The chances, minute by minute</h2><p>Expected goals added up through the match; filled circles are goals. Hover a shot.</p></div><div class="chart" id="mrace"></div></div></section>
    <section class="band" id="mtops"><div class="wrap"><div class="band-head"><h2 class="r-title">Who made the difference</h2><p>Each player's contribution to the match above what a replacement player would have added in the same minutes; these add up to the season rating.</p></div>
      <div class="mtops">${tops("home")}${tops("away")}</div></div></section>
    ${moms ? `<section class="band"><div class="wrap"><div class="band-head"><h2 class="r-title">The moments that mattered</h2><p>The single actions that most raised a side's chance of scoring, or most lowered the opponent's.</p></div><div class="moms">${moms}</div></div></section>` : ""}
    ${ch ? `<section class="band"><div class="wrap"><div class="band-head"><h2 class="r-title">The move of the match</h2><p>${esc(short(ch.team))}, ${ch.minute} minutes in: ${ch.n_actions} actions${any(ch) ? `, ending in a goal` : ""}, each valued by how much it changed the chance that the possession would end in a goal.</p></div>
      <figure style="margin:0;display:grid;gap:var(--s-3)"><div class="fig-cap"><span class="legend"><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain"></line></svg>Pass</span><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain carry"></line></svg>Carry</span></span><button type="button" class="btn-text" id="mplay">Play the move</button></div>
      <div class="chart" id="mpitch"></div><div class="chart" id="msteps"></div></figure></div></section>` : ""}`;
}
const any = ch => (ch.steps || []).some(s => s.goal);
function drawRace(el, m, R){
  const W = el.clientWidth; if(!W) return; const H = 250, mg = {l:40, r:W < 520 ? 70 : 110, t:14, b:30}; el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Expected goals through the match: ${short(m.home)} ${num(R.xg[0],2)}, ${short(m.away)} ${num(R.xg[1],2)}`},el);
  const shots = R.shots || [], end = Math.max(95, ...shots.map(s => s[0] + 2)), cum = [0, 0], series = [[[0,0]], [[0,0]]], pts = [];
  shots.slice().sort((a,b) => a[0] - b[0]).forEach(s => { cum[s[1]] += s[2]; series[s[1]].push([s[0], cum[s[1]]]); pts.push({...s, y: cum[s[1]]}); });
  const ymax = Math.max(1, Math.ceil(Math.max(cum[0], cum[1]) * 2) / 2), sx = v => mg.l + v/end*(W-mg.l-mg.r), sy = v => H-mg.b - v/ymax*(H-mg.t-mg.b);
  for(let v = 0; v <= ymax + 1e-9; v += ymax > 2.5 ? 1 : 0.5){ S("line",{x1:mg.l,x2:W-mg.r,y1:sy(v),y2:sy(v),class:v===0?"g-base":"g-line"},svg); text(svg, mg.l-6, sy(v)+4, num(v,1), "t-axis", {"text-anchor":"end"}); }
  [0,15,30,45,60,75,90].forEach(v => text(svg, sx(v), H-10, v + "'", "t-axis", {"text-anchor":"middle"}));
  S("line",{x1:sx(45),x2:sx(45),y1:mg.t,y2:H-mg.b,class:"g-line","stroke-dasharray":"3 3"},svg);
  const [ch, ca, dash] = PP.pairKit(m.home, m.away), col = [ch, ca];
  series.forEach((sr, k) => { const d = sr.map(([x, y], i) => i ? `H${sx(x)}V${sy(y)}` : `M${sx(x)},${sy(y)}`).join("") + `H${sx(end)}`;
    S("path",{d, fill:"none", stroke:col[k], "stroke-width":2.5, "stroke-dasharray": k === 1 && dash ? "6 4" : null},svg);
    text(svg, sx(end)+6, sy(cum[k])+4, `${short(k ? m.away : m.home)} ${num(cum[k],2)}`, "t-lab", {}); });
  pts.forEach(p => S("circle",{cx:sx(p[0]), cy:sy(p.y), r:p[3] ? 6 : 3, fill:p[3] ? col[p[1]] : "var(--paper)", stroke:col[p[1]], "stroke-width":p[3] ? 2 : 1.5,
    "data-tip":`<b>${p[3] ? "Goal" : "Shot"}</b>, ${p[0]}'<br>${esc(p[4]||"")}, ${esc(short(p[1] ? m.away : m.home))}<br>${num(p[2],2)} expected goals`},svg));
}

/* ---------------- match page ---------------- */
PP.pages.match = async (main, h) => {
  const id = h.split("-")[1];
  if(!(await ready(main, "Match"))) return;
  if(location.hash.slice(1) !== h) return;
  const m = M.matches.find(x => String(x.id) === id), d = M.detail[id] || {};
  if(!m){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">No match with this link</h1><a class="btn-text" href="#matches">All matches</a></section></div>`; return; }
  const k = kickDate(m), played = m.status === "played", conf = confOf;
  RP = null;
  const head = `<div class="wrap"><section class="pid mhead">
    <span class="r-label">${dayKey(k)}, ${timeOf(k)}</span>
    <h1 class="mteams"><a href="#team-${PP.slug(m.home)}" class="mt">${chip(m.home)}<span class="r-name">${esc(short(m.home))}</span></a>
      <span class="mscore num">${played ? `${m.g_home}–${m.g_away}` : "v"}</span>
      <a href="#team-${PP.slug(m.away)}" class="mt">${chip(m.away)}<span class="r-name">${esc(short(m.away))}</span></a></h1>
    ${played ? `<p class="dateline">Expected goals ${num(m.xg_home,2)} to ${num(m.xg_away,2)}.</p>${recordNote(m, true)}` : ""}
  </section></div>`;
  let body = "";
  if(!played){
    const side = s => d["stake_"+s] && d["if_win_"+s] != null ? `<div class="ind"><span class="r-label">${esc(short(m[s]))}</span><span class="v">${STAKE(d["stake_"+s], conf(m[s])+"ern Conference")}</span><span class="r-small">${pct(d["if_win_"+s])} with a win, ${pct(d["if_loss_"+s])} with a defeat.</span></div>` : "";
    const outs = s => { const o = d["out_"+s], q = d["questionable_"+s]; return o || q ? `<p class="r-small"><b>${esc(short(m[s]))}</b>${o ? `: out, ${esc(o.split("; ").join(", "))}` : ""}${q ? `${o?"; ":": "}doubtful, ${esc(q.split("; ").join(", "))}` : ""}.</p>` : ""; };
    body = `<div class="wrap"><section class="plate pplate mplate">
        <div class="pp-left"><span class="r-label">The forecast</span>
          ${pbar(m, true)}
          <div class="mprob num"><span><b class="r-figure" style="font-size:var(--t-36)">${pctShort(m.pH)}</b><br>${esc(short(m.home))} win</span><span><b class="r-figure" style="font-size:var(--t-36)">${pctShort(m.pD)}</b><br>draw</span><span style="text-align:right"><b class="r-figure" style="font-size:var(--t-36)">${pctShort(m.pA)}</b><br>${esc(short(m.away))} win</span></div>
          <p class="r-small">Expected goals ${num(m.xg_home,2)} to ${num(m.xg_away,2)}. ${src(m.source)}${d.elo_pH != null && m.source !== "elo" ? ` Without the lineup news: ${pctShort(d.elo_pH)}, ${pctShort(d.elo_pD)}, ${pctShort(d.elo_pA)}.` : ""}</p>
          ${recordNote(m, false)}
        </div>
        <div class="pp-right"><span class="r-label">What is at stake</span><div class="indicators">${side("home")}${side("away")}</div>${m.importance!=null?`<p class="r-small">Importance ${Math.round(m.importance)} of 100 among the remaining matches.</p>`:""}</div>
      </section></div>
      <section class="band" id="mxi"><div class="wrap"><div class="band-head"><h2 class="r-title">${d.xi_kind === "lineups" || d.xi_kind === "confirmed" ? "The lineups" : "Likely lineups"}</h2><p>${d.xi_kind === "availability" ? "Built from each club's recent starting elevens, adjusted for the league's availability report." : d.xi_kind === "lineups" || d.xi_kind === "confirmed" ? "The confirmed starting elevens." : "Each club's most likely eleven from its recent matches."} Each player is drawn by his value above replacement this season.</p></div>
        <div class="chart" id="duel"></div>${outs("home")}${outs("away")}</div></section>`;
  } else {
    const I = await PP.loadWeeks(), wn = I ? PP.weekOfMatch(I, id) : null;
    let R = null;
    if(wn){ try { R = (await PP.loadWeek(wn)).reports[id]; } catch(e){ R = null; } }
    if(location.hash.slice(1) !== h) return;
    if(R){ RP = {m, R}; body = report(m, R, I.weeks.find(w => w.week === wn)); }
  }
  if(played && !body){
    const list = (arr, t) => { const mx = Math.max(0.05, ...arr.map(x => Math.abs(x[2]||0)));
      return `<div class="mtop"><h3 class="r-heading">${clubTag(t, true)}</h3>${arr.map(x => `<a class="prow" href="#player-${x[0]}"><span class="nm">${esc(x[1]||"")}</span><span class="tr"><i style="width:${Math.max(2,Math.abs(x[2])/mx*100)}%;background:${x[2]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(x[2],2)}</span><span class="r-small">${PP.int(x[3])} min</span></a>`).join("")}</div>`; };
    body = `<section class="band" id="mtops"><div class="wrap"><div class="band-head"><h2 class="r-title">Who made the difference</h2><p>Each player's contribution to the match: his share of the value his team created and won back, above what a replacement player would have added in his minutes. These add up to his season rating.</p></div>
      <div class="mtops">${list(d.top_home||[], m.home)}${list(d.top_away||[], m.away)}</div></div></section>`;
  }
  const h2h = (d.h2h || []).filter(x => x[0] < (played ? "9999" : m.date) && !(played && x[0] === m.date && x[1] === m.home)).slice(0,5);
  body += `<section class="band" id="mform"><div class="wrap"><div class="band-head"><h2 class="r-title">The two clubs</h2><p>Team strength (half results, half chances) through 2026, and their recent meetings.</p></div>
    <div class="trajwrap"><figure class="tfig"><div class="chart" id="melo"></div><div class="legend"><span><i class="lg-line" style="--c:${PP.kit(m.home)}"></i>${esc(short(m.home))}</span><span><i class="lg-line${PP.pairKit(m.home, m.away)[2] ? " dash" : ""}" style="--c:${PP.pairKit(m.home, m.away)[1]}"></i>${esc(short(m.away))}</span></div></figure>
    <div><h3 class="r-heading">Recent meetings</h3>${h2h.length ? `<div class="h2h">${h2h.map(x => `<div class="h2r"><span class="r-small">${new Date(x[0]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</span><span>${esc(short(x[1]))} <b class="num">${x[3]}–${x[4]}</b> ${esc(short(x[2]))}</span></div>`).join("")}</div>` : `<p class="r-small">No meetings in our data.</p>`}</div></div></div></section>`;
  main.innerHTML = head + body;
  if(!played) PP.chart($("#duel"), el => drawDuel(el, m, d));
  PP.chart($("#melo"), el => drawElo2(el, m));
  if($("#mrace")) PP.chart($("#mrace"), el => drawRace(el, RP.m, RP.R));
  if(RP && RP.R.chain && $("#mpitch")){ const ch = PP.chainFrom(RP.R.chain); PP.chart($("#mpitch"), el => PP.chainPitch(el, ch, {labels: ch.labels})); PP.chart($("#msteps"), el => PP.chainSteps(el, ch, {}));
    $("#mplay").addEventListener("click", () => { PP.chainPitch($("#mpitch"), ch, {labels: ch.labels, animate: true}); PP.chainSteps($("#msteps"), ch, {animate: true}); }); }
  ["#duel","#melo","#mrace","#mpitch","#msteps"].forEach(q => { if($(q)) PP.bindTips($(q)); });
  document.title = `${short(m.home)} v ${short(m.away)} | Pitch Perception`;
};

function drawDuel(el, m, d){
  const W = Math.min(el.clientWidth, 980); if(!W) return;
  const xh = d.xi_home || [], xa = d.xi_away || [];
  if(!xh.length && !xa.length){ el.innerHTML = `<div class="missing"><b>No lineups yet</b><span>Lineups appear once there is recent team-sheet or availability information.</span></div>`; return; }
  const portrait = W < 560, H = portrait ? Math.round(W*105/68) : Math.round(W*68/105); el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Lineups: ${short(m.home)} against ${short(m.away)}`},el);
  // home defends the left (bottom in portrait), away the right (top)
  let P;
  if(portrait){ P = (L, Wd) => ({x: Wd/68*W, y: H - L/105*H});
    S("rect",{x:0,y:0,width:W,height:H,rx:4,class:"pitch-ground"},svg);
    const R = (L0, W0, l, w) => S("rect",{x:W0/68*W,y:H-(L0+l)/105*H,width:w/68*W,height:l/105*H,class:"pitch-line"},svg);
    R(0,0,105,68); S("line",{x1:0,x2:W,y1:H/2,y2:H/2,class:"pitch-line"},svg); S("circle",{cx:W/2,cy:H/2,r:9.15/68*W,class:"pitch-line"},svg); R(0,13.84,16.5,40.32); R(88.5,13.84,16.5,40.32);
  } else { const b = PP.pitchBase(svg, W, H, false); PP.pitchLines(svg, b.sx, b.sy); P = (L, Wd) => ({x: b.sx(L), y: b.sy(Wd)}); }
  const place = (xi, home) => xi.forEach(p => {
    const L = home ? 4 + (1 - p.y) * 46 : 101 - (1 - p.y) * 46, Wd = home ? (portrait ? 6 + p.x*56 : 6 + (1-p.x)*56) : (portrait ? 62 - p.x*56 : 6 + p.x*56);
    const c = P(L, Wd), v = p.value || 0, rr = Math.max(8, Math.min(16, 8 + Math.abs(v)*2.6)), f = PP.valueFill(v, 5);
    const pk = PP.pairKit(m.home, m.away);
    S("circle",{cx:c.x,cy:c.y,r:rr,fill:f,stroke:home ? pk[0] : pk[1],"stroke-width":2.5,"stroke-dasharray":!home && pk[2] ? "3 2" : "","data-tip":`<b>${esc(p.player)}</b>, ${esc(short(home ? m.home : m.away))}<br>${sgn(v,2)} this season${p.kind && p.kind !== "same" ? `<br>${p.kind === "changed" ? "Change from the usual eleven" : esc(p.kind)}` : ""}`},svg);
    text(svg, c.x, c.y+4, sgn(v,1), "t-axis", {"text-anchor":"middle",style:`fill:${PP.inkOn(f)};font-weight:650;font-size:10.5px`});
    text(svg, c.x, c.y+rr+12, PP.surname(p.player), "t-lab halo-w", {"text-anchor":"middle",style:"font-size:11px"});
  });
  place(xh, true); place(xa, false);
  const fh = d.formation_home, fa = d.formation_away;
  if(!portrait){ text(svg, 8, 16, `${short(m.home)}${fh?`, ${fh}`:""}`, "t-lab halo-w", {}); text(svg, W-8, 16, `${short(m.away)}${fa?`, ${fa}`:""}`, "t-lab halo-w", {"text-anchor":"end"}); }
  else { text(svg, 8, H-8, short(m.home), "t-lab halo-w", {}); text(svg, 8, 16, short(m.away), "t-lab halo-w", {}); }
}

function drawElo2(el, m){
  const W = el.clientWidth; if(!W) return; const H = 220; el.innerHTML = "";
  const th = (M.elo_traj||{})[m.home] || [], ta = (M.elo_traj||{})[m.away] || [];
  if(th.length < 2 || ta.length < 2){ el.innerHTML = `<p class="r-small">Not enough matches to draw.</p>`; return; }
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Strength rating of both clubs through 2026"},el);
  const all = th.concat(ta), t0 = new Date(all.reduce((a,b) => a[0] < b[0] ? a : b)[0]+"T12:00:00Z"), day = d => (new Date(d+"T12:00:00Z") - t0)/864e5, D1 = Math.max(...all.map(x => day(x[0]))) || 1;
  const m2 = {l:44,r:60,t:10,b:24}, iw = W-m2.l-m2.r, ih = H-m2.t-m2.b, vals = all.map(x => x[1]), y0 = Math.floor((Math.min(...vals)-10)/20)*20, y1 = Math.ceil((Math.max(...vals)+10)/20)*20;
  const sx = d => m2.l + d/D1*iw, sy = v => m2.t + ih - (v-y0)/(y1-y0)*ih;
  for(let v = y0; v <= y1; v += (y1-y0 > 120 ? 40 : 20)){ S("line",{x1:m2.l,x2:m2.l+iw,y1:sy(v),y2:sy(v),class:"g-line"},svg); text(svg, m2.l-8, sy(v)+4, PP.int(v), "t-axis", {"text-anchor":"end"}); }
  const [ch, ca, close] = PP.pairKit(m.home, m.away);
  [[th, m.home, ch, ""],[ta, m.away, ca, close ? "6 4" : ""]].forEach(([tr, t, c, dash]) => { S("path",{d:tr.map((x,i) => (i?"L":"M")+sx(day(x[0]))+","+sy(x[1])).join(""),fill:"none",stroke:c,"stroke-width":2,"stroke-linejoin":"round","stroke-dasharray":dash},svg);
    const L = tr[tr.length-1]; S("circle",{cx:sx(day(L[0])),cy:sy(L[1]),r:4,fill:c,stroke:"var(--paper)","stroke-width":2},svg); text(svg, sx(day(L[0]))+8, sy(L[1])+4, PP.int(L[1]), "t-lab", {}); });
  [["03-01","Mar"],["05-01","May"],["07-01","Jul"],["09-01","Sep"]].forEach(([d,l]) => { const dd = day("2026-"+d); if(dd > 0 && dd < D1) text(svg, sx(dd), H-6, l, "t-axis", {"text-anchor":"middle"}); });
}
})();
