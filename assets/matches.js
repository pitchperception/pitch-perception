/* Pitch Perception: Matches list and match pages. Data: data/matches.json (every 2026 match). */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, short, full, chip, clubTag} = PP;
let mP = null, M = null, FILTER = "all", RP = null, LOGD = null, SORT = "time", WK = null;
const load = () => mP || (mP = fetch("data/matches.json").then(r => { if(!r.ok) throw new Error(`matches.json returned ${r.status}`); return r.json(); }));
const STAKE = (s, conf) => ({"top 7":"a top-seven finish","playoffs":"the playoffs","1st in conference":`first place in the ${conf}`,"Supporters' Shield":"the Supporters' Shield","MLS Cup":"MLS Cup"}[s] || s);
const kickDate = m => m.kickoff_utc ? new Date(m.kickoff_utc.replace("Z",":00Z")) : new Date(m.date+"T23:00:00Z");
const dayKey = d => d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",timeZone:"America/New_York"}).replace(",", "");
const timeOf = d => d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).replace(" AM"," am").replace(" PM"," pm") + " ET";
const src = s => s === "lineups" ? `<span class="src"><i class="st confirmed"></i>Confirmed lineups</span>` : s === "availability" ? `<span class="src"><i class="st likely"></i>Likely lineups from the availability report</span>` : `<span class="src"><i class="st model"></i>Team strength only; no lineup news yet</span>`;
const pbar = (m, big) => { const [h, a] = PP.pairKit(m.home, m.away); return `<div class="pbar${big?" big":""}" role="img" aria-label="${esc(short(m.home))} ${pct(m.pH)}, draw ${pct(m.pD)}, ${esc(short(m.away))} ${pct(m.pA)}"><i style="width:${m.pH*100}%;background:${h}"></i><i style="width:${m.pD*100}%;background:var(--mid)"></i><i style="width:${m.pA*100}%;background:${a}"></i></div>`; };
/* watchability, quality and importance (FiveThirtyEight's old match ratings; 29): restored on v3, owner 2026-10-09; pre-match
   only: live.js hides them (.prematch, .stk-watch) once a match has kicked off (owner, 2026-10-24), and the forecast,
   stakes and likely lineups (.prematch-sec) at full time (owner, 2026-10-27). The forecast's expected
   goals are not shown (owner, 2026-10-24: they read as the match's own xG once it starts); live.js still uses them. */
const r0 = v => Math.round(v);
const watchChip = m => m.watchability == null ? "" : `<span class="wbadge" data-tip="${esc(`Watchability ${r0(m.watchability)}: the average of quality ${r0(m.quality)} (how strong both teams are) and importance ${r0(m.importance)} (how much the result moves their season goals)`)}"><b class="num">${r0(m.watchability)}</b> watchability</span>`;
const WATCH_NOTE = "Watchability follows FiveThirtyEight's old match ratings: the average of quality (how strong both teams are, from the strength rating) and importance (how much the result moves each side's chances of its season goals in the playoff simulation). Both run from 0 to 100.";
const motwCard = m => {
  const d = M.detail[String(m.id)] || {}, k = kickDate(m);
  const sw = ["home","away"].map(s => d["stake_"+s] && d["if_win_"+s] != null ? {team: m[s], stake: d["stake_"+s], w: d["if_win_"+s], l: d["if_loss_"+s]} : null)
    .filter(Boolean).sort((a,b) => (b.w - b.l) - (a.w - a.l))[0];
  return `<section class="band motw" aria-labelledby="motw-h"><div class="band-head"><h2 class="r-title" id="motw-h">Match of the week</h2><p>The most watchable match still to play this matchday: both sides strong, and a lot riding on it.</p></div>
    <a class="motw-card" href="#match-${m.id}">
      <span class="r-label">${dayKey(k)}, ${timeOf(k)}</span>
      <div class="motw-teams">${clubTag(m.home, true)}<span class="v">v</span>${clubTag(m.away, true)}</div>
      <div class="probs">${pbar(m, true)}<div class="plab"><span><b>${pctShort(m.pH)}</b> ${esc(short(m.home))} win</span><span>${pctShort(m.pD)} draw</span><span><b>${pctShort(m.pA)}</b> ${esc(short(m.away))} win</span></div></div>
      <div class="motw-figs"><div><b class="r-figure">${r0(m.watchability)}</b><span class="r-small">watchability</span></div><div><b class="num">${r0(m.quality)}</b><span class="r-small">quality</span></div><div><b class="num">${r0(m.importance)}</b><span class="r-small">importance</span></div></div>
      ${sw ? `<p class="r-small">${esc(short(sw.team))}: ${pct(sw.w)} chance of ${STAKE(sw.stake, confOf(sw.team)+"ern Conference")} with a win, ${pct(sw.l)} with a defeat.</p>` : ""}
    </a></section>`;
};
/* live forecast record (96, owner 2026-10-09): what the site said before kickoff, written down at the time */
const logged = id => ((LOGD && LOGD.rows) || {})[String(id)] || null;
PP.recordedBefore = id => { const L = logged(id); return L ? L[L.length - 1] : null; };    // the last row before kickoff (live.js, at full time)
const whenET = iso => { const d = new Date(iso); return `${dayKey(d)}, ${timeOf(d)}`; };
/* plain words on the fan pages (2026-10-27): counts and chances here; the scoring rules (log loss, Brier) and the interval
   are on the Method page (#method-record). The verdict follows the 95% interval of the log-loss gap that 96 writes. */
const recordLine = () => {
  if(!LOGD || !LOGD.started) return "";
  const sc = LOGD.score || {}, since = dayKey(new Date(LOGD.started));
  const tail = ` <a href="data/forecast_log.csv">Download the full record</a> or read <a href="#method-record">how we check it</a>.`;
  if(!sc.n) return `<p class="r-small">Since ${since}, every forecast on this site is written down before kickoff and never changed.${tail} Forecasts for earlier matches were worked out afterwards.</p>`;
  const ci = sc.log_loss_gap_ci95, mix = "simply going by the league's usual mix of home wins, draws and away wins";
  const fav = sc.favourite_won != null ? ` The favourite won ${sc.favourite_won} of them; the forecasts' own chances said about ${Math.round(sc.favourite_expected)}.` : "";
  const verdict = !ci ? "" : ci[1] < 0 ? ` So far the forecasts have done better than ${mix}; it is too early to say by how much.`
                : ci[0] > 0 ? ` So far the forecasts have done worse than ${mix}.` : ` It is too early to tell whether the forecasts do better than ${mix}.`;
  return `<p class="r-small">Since ${since}, every forecast on this site has been written down before kickoff and never changed. ${sc.n} of those match${sc.n === 1 ? " has" : "es have"} been played.${fav}${verdict}${tail}</p>`;
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
    const upRow = (m, hot) => `<a class="fx fxl${hot ? " is-motw" : ""}" href="#match-${m.id}"${PP.live && PP.live.inWindow(m) ? ` data-live="${m.id}"` : ""}><span class="time">${timeOf(kickDate(m))}</span>
      <div class="teams"><span>${clubTag(m.home, true)}</span><span>${clubTag(m.away, true)}</span></div>
      <div class="probs">${pbar(m)}
        <div class="plab"><span><b>${pctShort(m.pH)}</b> win</span><span>${pctShort(m.pD)} draw</span><span><b>${pctShort(m.pA)}</b> win</span></div></div>
      <div class="stake"><span class="prematch">${hot ? `<span class="motw-tag">Match of the week</span>` : ""}${watchChip(m)}${src(m.source)}${m.watchability!=null?`<span class="r-small">Quality ${r0(m.quality)}, importance ${r0(m.importance)}</span>`:""}</span></div></a>`;
    const pastRow = m => { const d = M.detail[String(m.id)] || {}, th = (d.top_home||[])[0], ta = (d.top_away||[])[0];
      return `<div class="fx fxl fxp" data-href="#match-${m.id}" role="link" tabindex="0"><span class="score num">${m.g_home}–${m.g_away}</span>
      <div class="teams"><span>${clubTag(m.home, true)}</span><span>${clubTag(m.away, true)}</span></div>
      <div class="xgpair num"><span>xG ${num(m.xg_home,2)}</span><span>xG ${num(m.xg_away,2)}</span></div>
      <div class="stake r-small">${th && ta ? `Most value added: ${PP.plink(th[0], th[1])} (${sgn(th[2],2)}) and ${PP.plink(ta[0], ta[1])} (${sgn(ta[2],2)})` : ""}</div></div>`; };
    if(FILTER === "all"){ weekView(group, upRow, pastRow); return; }
    const motw = null;
    const upAll = all.filter(m => m.status === "upcoming" && kickDate(m) > now - 2*3600e3 && f(m));      // ranked across every remaining match
    const upGroups = SORT === "watch" ? [["Most watchable first", upAll.slice().sort((a,b) => (b.watchability ?? -1) - (a.watchability ?? -1)).slice(0, FILTER === "all" ? 24 : 12)]] : group(up);
    $("#mlist").innerHTML = `${motw ? motwCard(motw) : ""}<section class="band" style="padding-top:0"><div class="band-head"><h2 class="r-title">Coming up</h2><p>Win, draw and defeat chances from the forecast, with lineup news where it exists. Kickoff times are Eastern. ${WATCH_NOTE}</p>
      <div class="seg msort" role="group" aria-label="Order matches"><button type="button" data-sort="time" aria-pressed="${SORT !== "watch"}">By kickoff</button><button type="button" data-sort="watch" aria-pressed="${SORT === "watch"}">Most watchable</button></div></div>
      <div class="fixtures">${upGroups.map(([k, arr]) => `<div class="fx-day">${k}</div>${arr.map(upRow).join("")}`).join("") || `<p class="r-small">No matches scheduled.</p>`}</div></section>
      <section class="band"><div class="band-head"><h2 class="r-title">Results</h2><p>Scores, expected goals, and the player who added the most value on each side. Open a result for its match report.</p></div>
      <div class="fixtures">${group(past).map(([k, arr]) => `<div class="fx-day">${k}</div>${arr.map(pastRow).join("")}`).join("")}</div></section>`;
    if(PP.live) PP.live.list($("#mlist"), M.matches);
  };
  /* matchdays: the league's official rounds, numbered as the matchday review pages number them (75's md from 141; owner,
     2026-10-24). Until then the page grouped matches by its own rule (a new round after a day without matches, numbered
     only from six matches), which fell a round behind the league after the five-match Matchday 16. A rescheduled game sits
     in the round being played when it is played; a round played only Tuesday to Thursday is midweek. Days are US Eastern.
     A match without a round (none expected; 87 checks) is shown on its own as an extra. */
  const ymd = m => kickDate(m).toLocaleDateString("en-CA", {timeZone: "America/New_York"});
  const dShort = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", {day: "numeric", month: "short", timeZone: "UTC"});
  const dRange = (a, b) => { if(a === b) return dShort(a); const [da, ma] = dShort(a).split(" "), [db, mb] = dShort(b).split(" "); return ma === mb ? `${da} to ${db} ${mb}` : `${dShort(a)} to ${dShort(b)}`; };
  const slates = (() => {
    const by = new Map();
    all.forEach(m => { const k = m.md != null ? "s" + m.md : "x" + m.id; if(!by.has(k)) by.set(k, []); by.get(k).push(m); });
    return [...by.entries()].map(([key, ms]) => {
      // a round's dates are its main dates (within two days of its median date); a game played away from them, a
      // rescheduled one, is named separately
      const ds = ms.map(ymd).sort(), med = ds[Math.floor(ds.length / 2)], away = (a, b) => Math.abs(new Date(a + "T12:00:00Z") - new Date(b + "T12:00:00Z")) / 864e5;
      const core = ds.filter(d => away(d, med) <= 2), days = [...new Set(core.map(d => new Date(d + "T12:00:00Z").getUTCDay()))], n = ms[0].md != null ? ms[0].md : null;
      return {key, n, kind: n == null ? "Extra" : days.every(d => d >= 2 && d <= 4) ? "Midweek" : "Weekend", first: core[0], last: core[core.length - 1],
              resched: [...new Set(ds.filter(d => away(d, med) > 2))], matches: ms};
    }).sort((a, b) => (a.n ?? 1e9) - (b.n ?? 1e9) || a.first.localeCompare(b.first));
  })();
  if(!WK || !slates.some(x => x.key === WK)){
    const nx = slates.find(x => x.n && x.matches.some(m => m.status !== "played" && kickDate(m) > now - 2*3600e3));
    WK = (nx || slates[slates.length - 1]).key;
  }
  const weekView = (group, upRow, pastRow) => {
    const i = slates.findIndex(x => x.key === WK), w = slates[i];
    const ups = w.matches.filter(m => m.status !== "played");
    const motw = ups.filter(m => m.watchability != null && kickDate(m) > now - 2*3600e3).sort((a,b) => b.watchability - a.watchability)[0] || null;
    const st = x => x.matches.every(m => m.status === "played") ? "done" : x.matches.some(m => m.status === "played") ? "part" : "up";
    const strip = `<div class="wkstrip" role="group" aria-label="Matchdays">${slates.map(x => `<button type="button" class="wkb ${st(x)}${x.key === WK ? " on" : ""}" aria-pressed="${x.key === WK}" data-wk="${x.key}" title="${x.n ? `${x.kind} matchday ${x.n}` : "Extra match"}"><b>${x.n ? "MD" + x.n : "Extra"}</b><span>${dShort(x.first)}</span></button>`).join("")}</div>`;
    const head = `<div class="wkhead"><button type="button" class="wknav" data-step="-1"${i === 0 ? " disabled" : ""} aria-label="Previous matchday">‹</button>
      <div><h2 class="r-title">${w.n ? `Matchday ${w.n}` : "Extra match" + (w.matches.length > 1 ? "es" : "")} <span class="mdk">${w.kind}</span></h2>
        <p class="r-small">${dRange(w.first, w.last)}, ${w.matches.length} match${w.matches.length === 1 ? "" : "es"}${w.resched.length ? `, including ${w.resched.length === 1 ? "a rescheduled game" : "rescheduled games"} on ${w.resched.map(dShort).join(", ").replace(/, ([^,]*)$/, " and $1")}` : ""}. Kickoff times are Eastern.</p></div>
      <button type="button" class="wknav" data-step="1"${i === slates.length - 1 ? " disabled" : ""} aria-label="Next matchday">›</button></div>`;
    const row = m => m.status === "played" ? pastRow(m) : upRow(m, motw && m.id === motw.id);
    const groups = SORT === "watch" && ups.length ? [["Most watchable first", w.matches.slice().sort((a,b) => (b.watchability ?? -1) - (a.watchability ?? -1))]] : group(w.matches);
    $("#mlist").innerHTML = `${strip}${head}
      ${motw ? motwCard(motw) : ""}
      <section class="band" style="padding-top:0"><div class="band-head"><p>${WATCH_NOTE}</p>${ups.length ? `<div class="seg msort" role="group" aria-label="Order matches"><button type="button" data-sort="time" aria-pressed="${SORT !== "watch"}">By kickoff</button><button type="button" data-sort="watch" aria-pressed="${SORT === "watch"}">Most watchable</button></div>` : ""}</div>
      <div class="fixtures">${groups.map(([k, arr]) => `<div class="fx-day">${k}</div>${arr.map(row).join("")}`).join("")}</div></section>`;
    const sw = $(".wkstrip"), on = $(".wkb.on"); if(sw && on) sw.scrollLeft = on.offsetLeft - sw.clientWidth / 2 + on.clientWidth / 2;
    if(PP.live) PP.live.list($("#mlist"), M.matches);       // live scores and chances on rows being played (live.js)
  };
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Matches</h1><p class="r-note standfirst">Every 2026 match: the forecast before it, and what happened after. Open a match for lineups, stakes and who made the difference.</p>${recordLine()}
    <label class="fsel" style="justify-self:start"><span class="r-small">Club</span><select id="mteam"><option value="all">All clubs</option>${teams.map(t => `<option value="${esc(t)}"${t===FILTER?" selected":""}>${esc(full(t))}</option>`).join("")}</select></label></section>
    <div id="mlist"></div></div>`;
  $("#mteam").addEventListener("change", e => { FILTER = e.target.value; draw(); });
  $("#mlist").addEventListener("click", e => {
    const b = e.target.closest("[data-sort]"); if(b){ SORT = b.dataset.sort; draw(); return; }
    const k = e.target.closest("[data-wk]"); if(k){ WK = k.dataset.wk; draw(); return; }
    const st = e.target.closest("[data-step]"); if(st && !st.disabled){ const j = slates.findIndex(x => x.key === WK) + Number(st.dataset.step); if(slates[j]){ WK = slates[j].key; draw(); } }
  });
  PP.bindTips($("#mlist"));
  draw();
};

/* ---------------- post-match report (82_weekly.py) ---------------- */
const POSW = {CB:"centre back", FB:"fullback", CM_DM:"central midfielder", AM:"attacking midfielder", W:"winger", ST:"striker", GK:"keeper"};
function report(m, R, wk){
  const [gh, ga] = R.g, hw = gh > ga, aw = ga > gh, win = hw ? 0 : aw ? 2 : 1, W = hw ? m.home : aw ? m.away : null, L = hw ? m.away : m.home;
  // "before kickoff" (owner, 2026-10-27): the recorded forecast wherever the live record has one (82), else reconstructed
  const pc = R.xg_probs[win], pre = R.pre && R.pre[win] != null ? R.pre[win] : null, recon = R.pre && R.pre[3] === "reconstructed", recd = R.pre && R.pre[3] === "recorded";
  const chances = `${num(R.xg[0],2)} expected goals to ${num(R.xg[1],2)}`;
  const lede = W ? `${esc(short(W))} ${hw ? "beat" : "won at"} ${esc(short(L))} ${Math.max(gh,ga)}–${Math.min(gh,ga)}${pc >= 0.5 ? `, and the chances agreed: ${chances}. On those chances they win ${pct(pc)} of the time.` : pc >= 0.35 ? `, from chances that were close: ${chances}. On those chances they win ${pct(pc)} of the time.` : `, despite the chances: ${chances}. On those chances they win only ${pct(pc)} of the time.`}${pre != null ? ` Before kickoff the ${recd ? "recorded " : ""}forecast gave them ${pct(pre)}${recon ? " (reconstructed)" : ""}.` : ""}`
    : `${esc(short(m.home))} and ${esc(short(m.away))} drew ${gh}–${ga}. The chances: ${chances}; on those a draw happens ${pct(pc)} of the time.${pre != null ? ` Before kickoff the ${recd ? "recorded " : ""}forecast gave a draw ${pct(pre)}${recon ? " (reconstructed)" : ""}.` : ""}`;
  const bar3 = (p, label) => `<div class="mrbar"><span class="r-label">${label}</span>${pbar({home:m.home, away:m.away, pH:p[0], pD:p[1], pA:p[2]}, true)}
    <div class="plab"><span><b>${pct(p[0])}</b> ${esc(short(m.home))}</span><span>${pct(p[1])} draw</span><span><b>${pct(p[2])}</b> ${esc(short(m.away))}</span></div></div>`;
  const tops = side => { const arr = R.top[side] || [], team = side === "home" ? m.home : m.away, mx = Math.max(0.05, ...arr.map(x => Math.abs(x[4]||0))), kp = (R.keepers||[]).find(k => k[2] === (side === "home" ? 0 : 1));
    return `<div class="mtop"><h3 class="r-heading">${clubTag(team, true)}</h3>${arr.map(x => `<a class="prow" href="#player-${x[0]}"><span class="nm">${esc(x[1]||"")}${PP.badgeMini(PP.badgesFor(x[0], 2026, team))}</span><span class="tr"><i style="width:${Math.max(2,Math.abs(x[4])/mx*100)}%;background:${x[4]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(x[4],2)}</span><span class="r-small">${esc(POSW[x[2]]||"")}, ${PP.int(x[3])} min</span></a>`).join("")}
      ${kp ? `<p class="r-small" style="margin-top:var(--s-2)">In goal: <a href="#player-${kp[0]}">${esc(kp[1])}</a>, ${sgn(kp[3],2)} goals prevented against the shots faced.</p>` : ""}</div>`; };
  const moms = (R.moments || []).map(x => { const team = x[1] === 0 ? m.home : m.away;
    return `<div class="mom"><span class="num min">${x[0]}'</span><span class="who">${chip(team)}<a href="#player-${x[2]}">${esc(x[3]||"")}</a></span><span class="act">${esc(x[4])}</span><span class="v num">${sgn(x[5],2)}</span></div>`; }).join("");
  const ch = R.chain;
  return `<div class="wrap"><section class="plate pplate mplate" aria-label="The result against the chances">
      <div class="pp-left"><span class="r-label">Match report</span><p class="r-note mlede">${lede}</p>${wk ? `<a class="btn-text" href="#matchday-${wk.md}">The matchday in review: Matchday ${wk.md}</a>` : ""}</div>
      <div class="pp-right">${R.pre && R.pre[0] != null ? bar3(R.pre, `Before kickoff${recd ? ", as recorded" : recon ? " (reconstructed from the model)" : ""}`) : ""}${bar3(R.xg_probs, "On the chances: every shot scored with its expected-goal probability")}</div>
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

PP.drawRace = drawRace;          // the live page draws the same chart from the live poller's shots (live.js)

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
  const liveOn = !played && PP.live && PP.live.inWindow(m);       // live score, events and chances while it is on (live.js)
  if(!played){
    const side = s => d["stake_"+s] && d["if_win_"+s] != null ? `<div class="ind"><span class="r-label">${esc(short(m[s]))}</span><span class="v">${STAKE(d["stake_"+s], conf(m[s])+"ern Conference")}</span><span class="r-small">${pct(d["if_win_"+s])} with a win, ${pct(d["if_loss_"+s])} with a defeat.</span></div>` : "";
    // what is at stake (owner, 2026-10-09: restyled to match the rest of the site): each side's most affected season goal,
    // its chance with a defeat and with a win on one 0-100% track, and the swing between them
    const goalName = (st, team) => ({"top 7": "A top-seven finish", "playoffs": "The playoffs", "1st in conference": `First in the ${conf(team)}`,
      "Supporters' Shield": "The Supporters' Shield", "MLS Cup": "MLS Cup"}[st] || st);
    const stakeRow = s => { const st = d["stake_"+s], w = d["if_win_"+s], l = d["if_loss_"+s]; if(!st || w == null || l == null) return "";
      const lo = Math.min(w, l), hi = Math.max(w, l);
      return `<div class="stk"><div class="stk-h"><div class="who">${clubTag(m[s], true)}<span class="stk-g">${esc(goalName(st, m[s]))}</span></div>
          <div class="stk-sw"><b class="num">${Math.round(Math.abs(w - l) * 100)}</b><span class="r-small">point swing</span></div></div>
        <div class="stk-tr" role="img" aria-label="${esc(short(m[s]))}: ${pct(w)} chance with a win, ${pct(l)} with a defeat"><i style="left:${lo*100}%;width:${Math.max(0.5, (hi - lo)*100)}%"></i><u class="l" style="left:${l*100}%"></u><u class="w" style="left:${w*100}%"></u></div>
        <div class="stk-lab"><span><u class="l"></u>With a defeat <b class="num">${pctShort(l)}</b></span><span><u class="w"></u>With a win <b class="num">${pctShort(w)}</b></span></div></div>`; };
    const watchFigs = m.watchability != null ? `<div class="motw-figs stk-watch"><div><b class="r-figure">${r0(m.watchability)}</b><span class="r-small">watchability</span></div><div><b class="num">${r0(m.quality)}</b><span class="r-small">quality</span></div><div><b class="num">${r0(m.importance)}</b><span class="r-small">importance</span></div></div>
      <p class="r-small stk-watch">Watchability averages quality (how strong both teams are) and importance (how much the result moves their season goals), after FiveThirtyEight's old match ratings.</p>` : "";
    const outs = s => { const o = d["out_"+s], q = d["questionable_"+s]; return o || q ? `<p class="r-small"><b>${esc(short(m[s]))}</b>${o ? `: out, ${esc(o.split("; ").join(", "))}` : ""}${q ? `${o?"; ":": "}doubtful, ${esc(q.split("; ").join(", "))}` : ""}.</p>` : ""; };
    body = `<div class="wrap prematch-sec"><section class="plate pplate mplate">
        <div class="pp-left"><span class="r-label">The forecast</span>
          ${pbar(m, true)}
          <div class="mprob num"><span><b class="r-figure" style="font-size:var(--t-36)">${pctShort(m.pH)}</b><br>${esc(short(m.home))} win</span><span><b class="r-figure" style="font-size:var(--t-36)">${pctShort(m.pD)}</b><br>draw</span><span style="text-align:right"><b class="r-figure" style="font-size:var(--t-36)">${pctShort(m.pA)}</b><br>${esc(short(m.away))} win</span></div>
          <p class="r-small">${src(m.source)}${d.strength_pH != null && m.source !== "elo" ? ` Without the lineup news: ${pctShort(d.strength_pH)} home win, ${pctShort(d.strength_pD)} draw, ${pctShort(d.strength_pA)} away win.` : ""}</p>
          ${recordNote(m, false)}
        </div>
        <div class="pp-right"><span class="r-label">What is at stake</span>${stakeRow("home")}${stakeRow("away")}${watchFigs}</div>
      </section></div>
      <section class="band prematch-sec" id="mxi"><div class="wrap"><div class="band-head"><h2 class="r-title">${["lineups", "confirmed", "sheet"].includes(d.xi_kind) ? "The lineups" : "Likely lineups"}</h2><p>${d.xi_kind === "availability" ? "Built from each club's recent starting elevens, adjusted for the league's availability report." : ["lineups", "confirmed", "sheet"].includes(d.xi_kind) ? "The confirmed starting elevens, in the positions on the team sheet." : "Each club's most likely eleven from its recent matches."} Each player is drawn by their value above replacement this season. Click a player for their page.</p></div>
        <div class="chart" id="duel"></div>${outs("home")}${outs("away")}</div></section>`;
  } else {
    const I = await PP.loadRounds(), wn = I ? PP.roundOfMatch(I, id) : null;
    let R = null;
    if(wn){ try { R = (await PP.loadRound(wn)).reports[id]; } catch(e){ R = null; } }
    if(location.hash.slice(1) !== h) return;
    if(R){ RP = {m, R}; body = report(m, R, I.matchdays.find(w => w.md === wn)); }
  }
  if(played && !body){
    const list = (arr, t) => { const mx = Math.max(0.05, ...arr.map(x => Math.abs(x[2]||0)));
      return `<div class="mtop"><h3 class="r-heading">${clubTag(t, true)}</h3>${arr.map(x => `<a class="prow" href="#player-${x[0]}"><span class="nm">${esc(x[1]||"")}</span><span class="tr"><i style="width:${Math.max(2,Math.abs(x[2])/mx*100)}%;background:${x[2]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(x[2],2)}</span><span class="r-small">${PP.int(x[3])} min</span></a>`).join("")}</div>`; };
    body = `<section class="band" id="mtops"><div class="wrap"><div class="band-head"><h2 class="r-title">Who made the difference</h2><p>Each player's contribution to the match: their share of the value their team created and won back, above what a replacement player would have added in their minutes. These add up to their season rating.</p></div>
      <div class="mtops">${list(d.top_home||[], m.home)}${list(d.top_away||[], m.away)}</div></div></section>`;
  }
  const h2h = (d.h2h || []).filter(x => x[0] < (played ? "9999" : m.date) && !(played && x[0] === m.date && x[1] === m.home)).slice(0,5);
  body += `<section class="band" id="mform"><div class="wrap"><div class="band-head"><h2 class="r-title">The two clubs</h2><p>Team strength (half results, half chances) through 2026, and their recent meetings.</p></div>
    <div class="trajwrap"><figure class="tfig"><div class="chart" id="melo"></div><div class="legend"><span><i class="lg-line" style="--c:${PP.kit(m.home)}"></i>${esc(short(m.home))}</span><span><i class="lg-line${PP.pairKit(m.home, m.away)[2] ? " dash" : ""}" style="--c:${PP.pairKit(m.home, m.away)[1]}"></i>${esc(short(m.away))}</span></div></figure>
    <div><h3 class="r-heading">Recent meetings</h3>${h2h.length ? `<div class="h2h">${h2h.map(x => `<div class="h2r"><span class="r-small">${new Date(x[0]+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</span><span>${esc(short(x[1]))} <b class="num">${x[3]}–${x[4]}</b> ${esc(short(x[2]))}</span></div>`).join("")}</div>` : `<p class="r-small">No meetings in our data.</p>`}</div></div></div></section>`;
  main.innerHTML = head + (liveOn ? `<div id="mlivebox"></div>` : "") + body;
  if(liveOn) PP.live.page(m, $("#mlivebox"));
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
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"group","aria-label":`Lineups: ${short(m.home)} against ${short(m.away)}`},el);
  // each player links to his page (owner, 2026-10-10), when he has one
  const pages = PP._pageIds || (PP._pageIds = new Set((PP.data.index || []).map(r => r[0])));
  // home defends the left (bottom in portrait), away the right (top)
  let P;
  if(portrait){ P = (L, Wd) => ({x: Wd/68*W, y: H - L/105*H});
    S("rect",{x:0,y:0,width:W,height:H,rx:4,class:"pitch-ground"},svg);
    const R = (L0, W0, l, w) => S("rect",{x:W0/68*W,y:H-(L0+l)/105*H,width:w/68*W,height:l/105*H,class:"pitch-line"},svg);
    R(0,0,105,68); S("line",{x1:0,x2:W,y1:H/2,y2:H/2,class:"pitch-line"},svg); S("circle",{cx:W/2,cy:H/2,r:9.15/68*W,class:"pitch-line"},svg); R(0,13.84,16.5,40.32); R(88.5,13.84,16.5,40.32);
  } else { const b = PP.pitchBase(svg, W, H, false); PP.pitchLines(svg, b.sx, b.sy); P = (L, Wd) => ({x: b.sx(L), y: b.sy(Wd)}); }
  const place = (xi, home) => xi.forEach(p => {
    const L = home ? 4 + (1 - p.y) * 46 : 101 - (1 - p.y) * 46, Wd = home ? (portrait ? 6 + p.x*56 : 6 + (1-p.x)*56) : (portrait ? 62 - p.x*56 : 6 + p.x*56);
    const rated = p.value != null, c = P(L, Wd), v = p.value || 0, rr = Math.max(8, Math.min(16, 8 + Math.abs(v)*2.6)), f = rated ? PP.valueFill(v, 5) : "var(--paper)";
    const pk = PP.pairKit(m.home, m.away), id = p.ws_player_id, linked = id != null && (!pages.size || pages.has(id));
    const g = linked ? S("a",{href:`#player-${id}`,class:"xi-link","aria-label":`${p.player}, ${short(home ? m.home : m.away)}: open their page`},svg) : svg;
    S("circle",{cx:c.x,cy:c.y,r:rr,fill:f,stroke:home ? pk[0] : pk[1],"stroke-width":2.5,"stroke-dasharray":!home && pk[2] ? "3 2" : "","data-tip":`<b>${esc(p.player)}</b>, ${esc(short(home ? m.home : m.away))}<br>${rated ? `${sgn(v,2)} this season` : "No MLS rating yet"}${p.kind && p.kind !== "same" ? `<br>${p.kind === "changed" ? "Change from the usual eleven" : esc(p.kind)}` : ""}${linked ? `<br>Click for their page` : ""}`},g);
    text(g, c.x, c.y+4, rated ? sgn(v,1) : "–", "t-axis", {"text-anchor":"middle",style:`fill:${rated ? PP.inkOn(f) : "var(--ink-3)"};font-weight:650;font-size:10.5px`});
    text(g, c.x, c.y+rr+12, p.player ? PP.surname(p.player) : "?", "t-lab halo-w", {"text-anchor":"middle",style:"font-size:11px"});
  });
  place(xh, true); place(xa, false);
  const shp = f => { if(f == null) return null; const s = String(f); if(s.includes("-")) return s; const dg = s.split(".")[0].replace(/\D/g, ""); return dg ? dg.split("").join("-") : null; };
  const fh = shp(d.formation_home), fa = shp(d.formation_away);
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
