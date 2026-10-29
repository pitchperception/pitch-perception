/* Pitch Perception: the matchday in review (#matchday = the latest complete matchday, #matchday-<n>), one page per MLS
   matchday since 2026-10-15 (owner; weekly before). Old #week and #week-<n> links open the matching matchday.
   Data: data/matchdays/index.json and md<n>.json (82_weekly.py). Also used by match pages (post-match reports) and the homepage. */
(function(){
"use strict";
const {$, $$, esc, sgn, num, pct, short, full, chip, clubTag} = PP;
let iP = null; const wkP = {};
PP.loadRounds = () => iP || (iP = fetch("data/matchdays/index.json").then(r => r.ok ? r.json() : null).catch(() => null));
PP.loadRound = n => wkP[n] || (wkP[n] = fetch(`data/matchdays/md${String(n).padStart(2,"0")}.json`).then(r => { if(!r.ok) throw new Error(`matchday ${n} returned ${r.status}`); return r.json(); }));
PP.latestRound = I => (I.matchdays.filter(w => w.complete).slice(-1)[0] || I.matchdays.slice(-1)[0]);
PP.roundOfMatch = (I, id) => (I.matchdays.find(w => w.matches.includes(+id)) || {}).md;
const dm = d => new Date(d+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",timeZone:"UTC"});
PP.weekRange = w => { if(w.first === w.last) return dm(w.first); const a = dm(w.first).split(" "), b = dm(w.last); return a[1] === b.split(" ")[1] ? `${a[0]} to ${b}` : `${dm(w.first)} to ${b}`; };
const POSW = {CB:"centre back", FB:"fullback", CM_DM:"central midfielder", AM:"attacking midfielder", W:"winger", ST:"striker", GK:"keeper"};
const surname = n => { const p = String(n||"").split(" "); return p.length > 1 ? p.slice(1).join(" ") : (n||""); };
const mlab = r => `${esc(short(r.home))} ${r.g[0]}–${r.g[1]} ${esc(short(r.away))}`;
let CH = null, chFocus = null;

PP.pages.matchday = async (main, h) => {
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">The matchday in review</h1><p class="r-small">Loading.</p></section></div>`;
  const I = await PP.loadRounds();
  if(!I || !I.matchdays.length){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The matchday data did not load</h1><p>Reload the page; if it persists, the site needs republishing.</p></section></div>`; return; }
  const mm = /^matchday-(\d+)$/.exec(h), n = mm ? +mm[1] : PP.latestRound(I).md, meta = I.matchdays.find(w => w.md === n);
  if(!meta){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-name">No such matchday</h1><p class="r-note"><a href="#matchday">The latest matchday</a></p></section></div>`; return; }
  let W; try { [W] = await Promise.all([PP.loadRound(n), PP.loadArch()]); }
  catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">This matchday did not load</h1><p>${esc(e.message)}</p></section></div>`; return; }
  if(location.hash.slice(1) !== h) return;
  render(main, I, W, meta);
};
/* links from before 2026-10-15: #week opens the latest matchday, #week-<n> the matchday that held most of that week */
PP.pages.week = async (main, h) => {
  const I = await PP.loadRounds(), mm = /^week-(\d+)$/.exec(h), md = mm && I && I.legacy_weeks ? I.legacy_weeks[mm[1]] : null;
  location.replace(md ? `#matchday-${md}` : "#matchday");
};

function render(main, I, W, meta){
  const i = I.matchdays.findIndex(w => w.md === meta.md), prev = I.matchdays[i-1], next = I.matchdays[i+1], R = W.reports;
  const P = W.players || [], top = P[0], K = (W.keepers || [])[0];
  const nav = `<div class="wknav">${prev ? `<a class="btn-text" href="#matchday-${prev.md}">Previous matchday</a>` : "<span></span>"}
    <label class="fsel"><span class="sr">Matchday</span><select id="wksel">${I.matchdays.slice().reverse().map(w => `<option value="${w.md}"${w.md===meta.md?" selected":""}>Matchday ${w.md}: ${esc(PP.weekRange(w))}${w.complete?"":" (in progress)"}</option>`).join("")}</select></label>
    ${next ? `<a class="btn-text" href="#matchday-${next.md}">Next matchday</a>` : "<span></span>"}</div>`;
  const potw = top ? (() => { const [id, nm, team, pos, mins, nmatch, v] = top, bd = PP.badgesFor(id, 2026, team);
    return `<div class="pp-left"><span class="r-label">Player of the matchday</span>
      <h2 class="r-title potw-name"><a href="#player-${id}">${esc(nm)}</a></h2>
      <div class="pfacts-inline">${clubTag(team, true)}<span>${esc(POSW[pos] || "")}</span></div>
      <span class="r-figure">${sgn(v,2)}</span>
      <div class="sub-fig"><span>goals above replacement in ${nmatch === 1 ? "one match" : `${PP.WORDS[nmatch] || nmatch} matches`} (${PP.int(mins)} minutes), the most in MLS this matchday</span></div>
      ${bd.length ? PP.badgeChips(bd, pos, 2026) : ""}
      ${K ? `<div class="ind" style="margin-top:var(--s-4)"><span class="r-label">Keeper of the matchday</span><span class="v"><a href="#player-${K[0]}">${esc(K[1])}</a></span><span class="r-small">${esc(short(K[2]))}: ${sgn(K[4],2)} goals prevented in ${K[3] === 1 ? "one match" : `${K[3]} matches`}, against the post-shot expected goals faced.</span></div>` : ""}
    </div>`; })() : `<div class="pp-left"><span class="r-label">Player of the matchday</span><p class="r-note">No matches played yet.</p></div>`;
  const mx = Math.max(0.05, ...P.map(p => Math.abs(p[6])));
  const plist = P.map((p, k) => `<a class="wkrow" href="#player-${p[0]}"><span class="rk">${k+1}</span><span class="nm">${esc(p[1])}${PP.badgeMini(PP.badgesFor(p[0], 2026, p[2]))}</span><span class="meta">${chip(p[2])}${esc(short(p[2]))}, ${esc(POSW[p[3]] || "")}, ${p[5] === 1 ? "1 match" : `${p[5]} matches`}</span><span class="tr"><i style="width:${Math.max(2, Math.abs(p[6])/mx*100)}%;background:${p[6]>=0?"var(--turf)":"var(--flare)"}"></i></span><span class="v num">${sgn(p[6],2)}</span></a>`).join("");
  const card = (label, head, body, href) => `<a class="award" href="${href}"><span class="r-label">${label}</span><b>${head}</b><span class="r-small">${body}</span></a>`;
  // a card that opens the match but names a player, whose name opens his page (no link inside a link)
  const cardP = (label, head, body, href) => `<div class="award" data-href="${href}" role="link" tabindex="0"><span class="r-label">${label}</span><b>${head}</b><span class="r-small">${body}</span></div>`;
  const aw = [];
  if(W.performance){ const p = W.performance, r = R[p.match]; aw.push(cardP("Performance of the matchday", PP.plink(p.id, p.player), `${sgn(p.value,2)} goals above replacement in ${PP.int(p.mins)} minutes${r ? `, ${mlab(r)}` : ""}.`, `#match-${p.match}`)); }
  if(W.upset){ const r = R[W.upset.match], w = r.g[0] > r.g[1] ? r.home : r.away; aw.push(card("Upset of the matchday", `${esc(short(w))} win`, `${mlab(r)}. Before kickoff they had a ${pct(W.upset.p)} chance of winning${r.pre && r.pre[3] === "recorded" ? ", as recorded" : r.pre && r.pre[3] === "reconstructed" ? " (reconstructed)" : ""}.`, `#match-${W.upset.match}`)); }
  if(W.robbery){ const r = R[W.robbery.match], w = r.g[0] > r.g[1] ? r.home : r.away; aw.push(card("Against the run of play", `${esc(short(w))} win anyway`, `${mlab(r)}, from ${num(r.xg[0],1)} expected goals to ${num(r.xg[1],1)}. On those chances they win ${pct(W.robbery.p)} of the time.`, `#match-${W.robbery.match}`)); }
  if(W.club) aw.push(card("Club of the matchday", esc(full(W.club.team)), `${sgn(W.club.xgd,2)} expected-goal difference in ${W.club.n === 1 ? "one match" : `${W.club.n} matches`}, the best this matchday.`, `#team-${PP.slug(W.club.team)}`));
  if(W.chances){ const r = R[W.chances.match]; aw.push(card("Most chances", mlab(r), `${num(W.chances.xg,1)} expected goals between them, the most in any match this matchday.`, `#match-${W.chances.match}`)); }
  const res = W.matches.map(id => { const r = R[id]; if(!r) return ""; const win = r.g[0] > r.g[1] ? 0 : r.g[1] > r.g[0] ? 2 : 1;
    const note = win === 1 ? `On the chances a draw ${pct(r.xg_probs[1])}` : `On the chances, ${esc(short(win === 0 ? r.home : r.away))} win ${pct(r.xg_probs[win])}`;
    return `<a class="fx fxl fxp" href="#match-${id}"><span class="score num">${r.g[0]}–${r.g[1]}</span><div class="teams"><span>${clubTag(r.home, true)}</span><span>${clubTag(r.away, true)}</span></div>
      <div class="xgpair num"><span>xG ${num(r.xg[0],2)}</span><span>xG ${num(r.xg[1],2)}</span></div><div class="stake r-small">${note}</div></a>`; }).join("");
  const mv = W.movers, mvList = (arr, up) => arr.map(x => `<div class="wkmv"><a href="#team-${PP.slug(x[0])}">${chip(x[0])}${esc(short(x[0]))}</a><span class="num">${pct(x[1])}</span><span class="num ${up?"pos":"neg"}"><span class="tri ${up?"up":"down"}" aria-hidden="true"></span>${Math.abs(Math.round(x[2]*100))} points</span></div>`).join("");
  const chR = W.chain && R[W.chain] && R[W.chain].chain;
  CH = chR ? PP.chainFrom(chR) : null; chFocus = null;
  const chainBand = chR ? `<section class="band" id="wkchain" aria-labelledby="wkc-h"><div class="wrap"><div class="band-head"><h2 class="r-title" id="wkc-h">Chain of the matchday: ${chR.n_players >= 11 ? "all eleven" : PP.WORDS[chR.n_players] || chR.n_players} ${esc(short(chR.team))} players touched this goal</h2><p>${esc(short(chR.home))} ${String(chR.score).replace(/\s*:\s*/,"–")} ${esc(short(chR.away))}, ${chR.minute} minutes in. ${chR.n_actions} actions, each valued by how much it changed the chance that the possession would end in a goal.</p></div>
      <figure style="margin:0;display:grid;gap:var(--s-3)"><div class="fig-cap"><span class="legend"><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain"></line></svg>Pass</span><span><svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" class="chain carry"></line></svg>Carry</span></span><button type="button" class="btn-text" id="wkplay">Play the chain</button></div>
      <div class="chart" id="wkpitch"></div><div class="chart" id="wksteps"></div></figure></div></section>` : "";
  const left = (meta.scheduled || meta.n) - meta.n;
  const moved = (W.moved || []).map(([id, o]) => { const r = R[id]; return r ? `${esc(short(r.home))} v ${esc(short(r.away))} (rescheduled from Matchday ${o})` : ""; }).filter(Boolean);
  main.innerHTML = `<div class="wrap"><section class="pid"><span class="kicker">The matchday in review</span><h1 class="r-name">Matchday ${meta.md}</h1>
      <p class="r-note standfirst">${esc(PP.weekRange(meta))}: ${meta.n === 1 ? "one match" : `${PP.int(meta.n)} matches`}${W.complete ? "" : ` so far, ${left === 1 ? "one" : PP.int(left)} still to play`}${moved.length ? `, including ${moved.join(" and ")}` : ""}. Every player is valued by what he added in his minutes, against a replacement-level player at the same position: the same measure as the season ratings, added up for the matchday.</p>${nav}</section></div>
    <div class="wrap"><section class="plate pplate" aria-label="Player and team of the matchday">${potw}
      <div class="pp-right"><div class="fig-cap"><span class="r-label">Team of the matchday</span><span class="r-small">${esc(W.formation || "4-3-3")}, the shape that fits the matchday's best performers; the crest and ring show the club. Select a player to open his page.</span></div><div class="chart" id="totw"></div></div></section></div>
    <section class="band" aria-labelledby="wkp-h"><div class="wrap"><div class="wkgrid">
      <div><div class="band-head"><h2 class="r-title" id="wkp-h">Players of the matchday</h2><p>Goals above replacement across the matchday's matches.</p></div><div class="wklist">${plist}</div></div>
      <div><div class="band-head"><h2 class="r-title">The matchday in five</h2><p>Select any of them for the full story.</p></div><div class="awards">${aw.join("")}</div></div></div></div></section>
    ${chainBand}
    <section class="band" aria-labelledby="wkr-h"><div class="wrap"><div class="wkgrid">
      <div><div class="band-head"><h2 class="r-title" id="wkr-h">Results</h2><p>Each result beside the chances: how often the winner would win with the shots both sides took. Select one for its match report.</p></div><div class="fixtures">${res}</div></div>
      <div>${mv && (mv.up.length || mv.down.length) ? `<div class="band-head"><h2 class="r-title">Playoff race</h2><p>The biggest changes in playoff chances over the matchday, from the forecast as it stood before and after the round.</p></div>
        ${mv.up.length ? `<h3 class="r-heading">Up</h3><div class="mvlist">${mvList(mv.up, true)}</div>` : ""}${mv.down.length ? `<h3 class="r-heading" style="margin-top:var(--s-4)">Down</h3><div class="mvlist">${mvList(mv.down, false)}</div>` : ""}` : ""}</div></div></div></section>`;
  $("#wksel").addEventListener("change", e => { location.hash = `#matchday-${e.target.value}`; });
  PP.chart($("#totw"), el => PP.drawEleven(el, W.xi || [], {maxV: 1, label: `Team of the matchday, Matchday ${meta.md}`,
    tip: p => `<b>${esc(p.player)}</b>, ${esc(short(p.team))}<br>${p.keeper ? `${sgn(p.value,2)} goals prevented` : `${sgn(p.value,2)} goals above replacement`}${p.mins ? `<br>${PP.int(p.mins)} minutes` : ""}`}));
  PP.bindTips($("#totw")); $$(".plate .bdgs").forEach(PP.bindTips);
  if(CH){ PP.chart($("#wkpitch"), el => PP.chainPitch(el, CH, {labels: CH.labels})); PP.chart($("#wksteps"), el => PP.chainSteps(el, CH, {}));
    ["#wkpitch","#wksteps"].forEach(q => PP.bindTips($(q)));
    $("#wkplay").addEventListener("click", () => { PP.chainPitch($("#wkpitch"), CH, {labels: CH.labels, animate: true}); PP.chainSteps($("#wksteps"), CH, {animate: true}); }); }
  document.title = `Matchday ${meta.md} in review | Pitch Perception`;
}
})();
