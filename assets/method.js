/* Pitch Perception: Method. Data: data/method.json (40_method_illustration.py), data/trends.json (meta). */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, money, short, full} = PP;
let mP = null, tP = null, sP = null, MD = null, SN = null, HZ = 91;
const load = () => mP || (mP = fetch("data/method.json").then(r => { if(!r.ok) throw new Error(`method.json returned ${r.status}`); return r.json(); }));
const loadS = () => sP || (sP = fetch("data/sensitivity.json").then(r => r.ok ? r.json() : null).catch(() => null));
const loadT = () => tP || (tP = fetch("data/trends.json").then(r => r.ok ? r.json() : null).catch(() => null));

/* "What the number means" (owner, 2026-10-09). Zone values come from the fitted chain (method.json grid); the example is
   the season's top-rated player (home.json leaders), so every figure follows the data. */
const meaning = (G, EX) => {
  if(!G || !G.zones) return "";
  const zv = (xs, ys) => { const z = G.zones.filter(q => xs.includes(q.x) && ys.includes(q.y)); return z.reduce((t,q) => t + q.v, 0) / Math.max(1, z.length); };
  const mid = zv([5,6],[3,4]), edge = zv([9],[3,4]), box = zv([10],[3,4]), front = zv([11],[3,4]);
  const pc = v => `${Math.max(1, Math.round(v * 100))}%`;
  const ex = EX ? `<p><b>How to read ${PP.sgn(EX.rating)}.</b> ${esc(EX.player)}'s actions in ${EX.year} added about ${num(EX.rating,1)} goals of expected-goal difference beyond what a replacement-level ${(PP.POS[EX.pos]||"player").toLowerCase()} would have added in the same ${PP.int(EX.mins)} minutes${EX.points != null ? `, worth about ${num(EX.points,1)} points in the table` : ""}. The 90% range, ${PP.sgn(EX.lo,1)} to ${PP.sgn(EX.hi,1)}, shows how much luck could have moved it.</p>` : "";
  return `<section class="band mtext" id="m-meaning"><div class="band-head"><h2 class="r-title">What the number means</h2>
    <p>Every rating on this site is in goals.</p>
    <p>Each spot on the pitch has a value: the chance that the team with the ball scores next, minus the chance it concedes next. In MLS that is about ${pc(mid)} of a goal in the centre circle, ${pc(edge)} just outside the box, ${pc(box)} in the middle of the box and ${pc(front)} right in front of goal.</p>
    <p>Every action is credited with the change it makes. A pass that moves the ball from midfield into the middle of the box adds about ${num(box - mid, 2)} goals, shared between the passer and the player who got there to receive it. Losing the ball costs the swing. A season's credit, set against what a replacement-level player at the same position adds in the same minutes and scaled against real match results, is the rating.</p>
    ${ex}
    <p><b>Not counted:</b> finishing (the rating pays for chances, not conversion), and defending without the ball, such as positioning and marking, which event data cannot see.</p></div></section>`;
};

PP.pages.method = async main => {
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">How it works</h1><p class="r-small">Loading.</p></section></div>`;
  let T; try { [MD, T, SN] = await Promise.all([load(), loadT(), loadS(), PP.loadArch()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The method data did not load</h1><p>${esc(e.message)}</p></section></div>`; return; }
  let EX = null;
  try {
    const L0 = ((PP.data.home || {}).leaders || [])[0];
    if(L0){
      const id = L0.ws_player_id, u = `data/players/p${String(id % 128).padStart(3,"0")}.json`;
      const rec = ((await (await fetch(u)).json()).players || {})[String(id)];
      const yr = +String((PP.data.home || {}).as_of || "").slice(0,4);
      const ss = rec && (rec.seasons || []).find(x => x.year === yr);
      EX = {...L0, year: yr, points: ss ? ss.points_vs_repl : null};
    }
  } catch(e){ EX = null; }
  const hh = location.hash.slice(1);
  if(hh !== "method" && !hh.startsWith("method-")) return;
  const A = MD.attack, D = MD.defence, C = MD.contrast, W = MD.weights, G = MD.grid, meta = (T && T.meta) || {};
  const bm = (meta.slot_benchmarks || []).slice().sort((a,b) => b.benchmark - a.benchmark);
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">How it works</h1>
    <p class="r-note standfirst">Pitch Perception uses a possession-value model: a match is treated as a chain of possessions moving through the pitch, every action is valued by how much it changes the chance that the possession ends in a goal, at either end, and a player's rating is the sum of those changes against a replacement-level player at the same position.</p></section>
${meaning(G, EX)}

  <section class="band mtext" id="m-origins"><div class="band-head"><h2 class="r-title">Where the method comes from</h2>
    <p>Valuing football actions by how much they change a possession's chance of ending in a goal is a well-established idea in football analytics; Pitch Perception did not invent it. Modelling possession as a chain of states, a Markov model, goes back at least to Sarah Rudd's work in 2011. Karun Singh's expected threat (xT) made the zone-based version widely known. Academic models such as VAEP (KU Leuven, 2019) value every on-ball action, and American Soccer Analysis publishes its goals added for MLS. Expected goals, the value of a shot, is a standard idea too.</p>
    <p>This site is an independent implementation of that family of models, fitted to MLS event data. The choices made in building it are its own: the grid of pitch zones; ball-winning measured against the danger each player faced rather than counted; attack and ball-winning weighted by how well they predict match results, with ball-winning then counted at half that weight (an independent test, how each team does with a player on and off the pitch, favours less, and halving costs almost nothing in predicting results); ratings against a replacement-level player at each position and season; ranges from resampling matches; and every piece tested on seasons the models never saw. Where a choice follows someone else's convention it is borrowed openly: crediting the receiver of a completed pass as well as the passer follows American Soccer Analysis, which divides the value by how likely the pass was to be completed; here it is split equally.</p></div></section>

  <section class="band mtext" id="m-chain"><div class="band-head"><h2 class="r-title">The pitch as a chain of states</h2>
    <p>A state is where the ball is (one of 96 zones, or a set piece) and who has it. From every state the event data shows how often the team keeps the ball, loses it or shoots, and where the ball goes next. Solving those probabilities together gives every state a value: the goals the team in possession can expect to score minus concede before the possession ends. Select any zone.</p></div>
    <div class="mgrid"><figure class="tfig"><div class="chart" id="mzones"></div><div id="mzleg" class="zleg"></div></figure><div class="mpanel" id="mpanel"></div></div></section>

  ${A ? `  <section class="band mtext" id="m-attack"><div class="band-head"><h2 class="r-title">Valuing a real move</h2>
    <p>${esc(short(A.team))} against ${esc(short(A.team === A.home ? A.away : A.home))}, ${PP.dateLong(A.date)} (finished ${esc(String(A.score).replace(/\s*:\s*/,"–"))}), ${A.minute} minutes in. ${esc(A.steps[0].player)} wins the ball from ${esc(A.lost_by)}, and ${A.steps.length - 1} actions later ${esc(A.steps[A.steps.length-1].player)} scores. Every action earns the change in value it causes. A completed pass is split equally between passer and receiver; a shot earns its expected-goal value minus the value of the place it was taken from.</p></div>
    <div class="chart" id="mpitch"></div><div class="chart" id="msteps"></div>
    <div class="tbl-wrap"><table class="dtable"><thead><tr><th class="n">#</th><th>Player</th><th>Action</th><th class="n">Value before</th><th class="n">After</th><th class="n">Change</th><th>Credit</th></tr></thead><tbody>
      ${A.steps.map((s,i) => `<tr><td class="n">${i+1}</td><td>${esc(s.player)}</td><td>${esc(s.action)}</td><td class="n">${num(s.v_before,3)}</td><td class="n">${s.xg != null ? `${num(s.xg,3)} xG` : num(s.v_after,3)}</td><td class="n"><b>${sgn(s.delta,3)}</b></td><td>${s.credits.map(c => `${esc(PP.surname(c.player))} ${sgn(c.value,3)} <span class="r-small">${esc(c.role)}</span>`).join("<br>")}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="r-small">Credit from this move: ${A.totals.map(t => `${esc(t.player)} ${sgn(t.value,3)}`).join(", ")}. The build-up passes add little because they move the ball between zones of similar value; the value jumps when the ball reaches the box. Over a season the credits are added up, set against a replacement-level player at the same position and scaled to goals (attack weight ${W.w_off.toFixed(2)}).</p></section>` : ""}

  <section class="band mtext" id="m-defence"><div class="band-head"><h2 class="r-title">Winning the ball back</h2>
    <p>${esc(D.attacker)} (${esc(short(D.attacking_team))}) tries a ${esc(D.attacker_action)} inside the box, ${PP.dateLong(D.date)}, ${D.minute} minutes in, and ${esc(D.defender)} (${esc(short(D.defender_team))}) wins it with a ${esc(D.action)}. Before the tackle the attack was worth ${num(D.danger_before,3)}; afterwards his own side's possession was worth ${num(D.own_value_after,3)}. The swing, ${num(D.swing,3)}, is shared: half to the defender, half charged to the attacker.</p>
    <p>Volume alone would reward defenders whose team is under siege, so ball-winning is judged against the danger that came into a defender's zones while he was on the pitch. ${esc(D.defender)} faced danger worth ${num(D.season.exp_value,1)} in ${PP.int(D.season.mins)} minutes of ${D.season.year} and won back ${num(D.season.regain,2)} of it (${(D.season.eff*100).toFixed(1)}%), against ${(D.season.repl_eff*100).toFixed(1)}% for a replacement-level ${D.pos === "CB" ? "centre back" : "fullback"}. Scaled to goals (ball-winning weight ${W.w_def.toFixed(2)}), that is ${sgn(D.season.defence,2)}.</p></div>
    <div class="tbl-wrap"><table class="dtable" style="max-width:820px"><thead><tr><th>Two centre backs, 2025</th><th class="n">Minutes</th><th class="n">Danger faced</th><th class="n">Won back</th><th class="n">Share</th><th class="n">Winning it, goals</th></tr></thead>
      <tbody>${C.players.map(p => `<tr><td>${esc(p.player)} <span class="r-small">${esc(short(p.team))}</span></td><td class="n">${PP.int(p.mins)}</td><td class="n">${num(p.exp_value,1)}</td><td class="n">${num(p.regain,2)}</td><td class="n">${(p.eff*100).toFixed(1)}%</td><td class="n"><b>${sgn(p.defence,2)}</b></td></tr>`).join("")}</tbody></table></div>
    <p class="r-small">The first wins more of the ball in total, because more danger comes his way; the second wins a bigger share of what reaches him, and rates higher. A replacement-level centre back wins ${(C.repl_eff*100).toFixed(1)}%.</p></section>

  <section class="band mtext" id="m-rating"><div class="band-head"><h2 class="r-title">From actions to a rating</h2>
    <p><b>Value above replacement</b> is a season's attack plus ball-winning, in goals of match expected-goal difference, against a replacement-level player at the same position and season. Replacement level is what the players who actually fill in produce (measured below), set per position and season, so league-wide changes (such as the rise in recorded clearances in 2025, an Opta coding change) do not inflate a whole position.</p>
    <p>Attack and ball-winning are weighted (${W.w_off.toFixed(2)} and ${W.w_def.toFixed(2)}) starting from how strongly each predicts match results when summed over the players who started, fitted on 2021–25. On that test ball-winning is the stronger predictor, but a second, independent check rates it lower, so the published ball-winning weight is half the fitted one (why, below). Fouls are reported but not counted: once a player's exposure is allowed for, they carried no individual signal. Penalties won are treated the same way. The pass or run before the foul earns what it is worth to reach the penalty spot in open play, and the rest of the penalty's value is shown, not counted, for the player who was fouled, because winning penalties barely repeats from one half-season to the next.</p>
    <p>Every rating has a 90% range from resampling the season's matches 1,000 times: how much the season's numbers could have differed with the same player. A regular's range typically spans about 3 goals, so close rankings are ties: see the Tiers view on the Players page.</p></div></section>

${SN ? weightsSection(SN) : ""}

${PP.data.arch ? archSection(PP.data.arch) : ""}

  <section class="band mtext" id="m-slot"><div class="band-head"><h2 class="r-title">Against the contract type</h2>
    <p>MLS roster building is a scarcity problem: three Designated Player places and a handful of U22 and allocation-money signings, paid for whether or not the player plays. So the fair comparison for a player is with others on the same type of contract: does a Designated Player produce like a Designated Player? Value against the contract type is a player's rating minus the median season of everyone on that type of contract, 2020–25, pro-rated to the part of the season it was held. The chance of beating it comes from the same resampling as the player's range. How much a player is paid within a type does not enter: a $2m Designated Player and a $20m one face the same bar, because the scarce thing is the place, not the money. ${T && T.points_per_goal ? `A goal of a team's season expected-goal difference has been worth about ${num(T.points_per_goal,2)} points in the table (2021–25).` : ""}</p></div>
    ${bm.length ? `<div class="tbl-wrap"><table class="dtable" style="max-width:720px"><thead><tr><th>Contract type</th><th class="n">Typical season, goals</th><th class="n">Per 90, regulars</th><th class="n">Median pay</th><th class="n">Player-seasons</th></tr></thead><tbody>${bm.map(b => `<tr><td>${esc(PP.SLOT[b.slot]||b.slot)}</td><td class="n">${num(b.benchmark,2)}</td><td class="n">${num(b.benchmark_p90,3)}</td><td class="n">${money(b.median_pay)}</td><td class="n">${PP.int(b.n)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <p class="r-small">TAM / GAM combines TAM players with senior-roster players paid above the maximum budget charge. 2024–26 contract types are the official MLS designations; 2020–23 are inferred from Designated Player history and salary, so U22, Homegrown and Supplemental cannot be identified before 2024.</p></section>

  <section class="band mtext" id="m-forecast"><div class="band-head"><h2 class="r-title">Forecasts</h2>
    <p>Match forecasts start from a team-strength rating built half on results and half on chances (each match's expected goals), with home advantage and margin, turned into expected goals with a Poisson model. It replaced a results-only Elo rating on 7 October 2026, after a test fixed in advance showed it predicted 2021–25 matches slightly better (see the Playoff race page). Where the starting lineups or the league's availability report are known, each side's expected goals are adjusted for who plays, using players' ratings this season and last, keepers' shot-stopping and bench strength. The rest of the season is simulated 20,000 times; each simulated season seeds its own bracket in the 2025 playoff format. The weekly forecast history is reconstructed: the same model applied to the results known at each date.</p></div></section>

  <section class="band mtext" id="m-tests"><div class="band-head"><h2 class="r-title">How it was tested</h2></div>
    <ul class="mlist">
      <li><b>Lineup test.</b> Last season's ratings, summed over who actually started, predict this season's match expected-goal difference (r about 0.20 on 2021–25), better than the previous model (0.10). On 2014–19 matches held back for confirmation it scores 0.17.</li>
      <li><b>Within-team test.</b> When a club fields a stronger-than-usual lineup by these ratings, it produces a better-than-usual expected-goal difference (r about 0.10): the ratings separate individual players, not just teams.</li>
      <li><b>Is the ball-winning number the player or his team?</b> Tested three ways, pre-registered: within a team, more ball won from the same danger goes with better results; it separates players within a team after allowing for attack; and for 168 players who changed clubs it followed the player about as strongly as attack did. It measures the defender, mixed with some team context.</li>
      <li>Every number is out of sample: each season is valued by models fitted on other seasons.</li>
    </ul></section>

  <section class="band mtext" id="m-caveats"><div class="band-head"><h2 class="r-title">What it cannot see</h2></div>
    <ul class="mlist">
      <li><b>Off-ball movement, marking and shape</b> are invisible in event data. Getting open is credited only through receiving the ball.</li>
      <li><b>Ball-winning carries a lot of weight.</b> It is what predicts results, but it means defensive midfielders and centre backs rank higher than on most public leaderboards, and attackers who do not win the ball lose value. Part of what it rewards may be off-ball and team defending that happens to end with this player winning the ball.</li>
      <li><b>Ranges cover luck, not the model.</b> A player's 90% range shows how much the season could have differed with the same player. It does not include doubt about the model's own choices (the weights, replacement level, the zone values), so the real uncertainty is somewhat wider.</li>
      <li><b>Goalkeepers</b> are rated separately, by goals prevented. Shot-stopping barely repeats from one season to the next (year-to-year correlation about 0.18), so a single season describes more than it predicts. Distribution is repeatable but showed no link to goals conceded.</li>
      <li><b>Finishing is not a skill here.</b> Shots earn their chance quality, not whether they went in; finishing barely repeats from season to season (about 0.05).</li>
      <li><b>2026 is a partial season</b>, so its ranges are wider.</li>
    </ul></section>

  <section class="band mtext" id="m-data"><div class="band-head"><h2 class="r-title">The data</h2>
    <p>Event data from WhoScored (Opta) for every regular-season match since 2020, with expected goals from a shot model fitted to MLS for this site; lineups and shots from Sofascore; salaries from the MLS Players Association; Transfermarkt for scouted players' market values (shown as bands), contracts and nationalities. Regular season only. Pitch Perception is independent and is not affiliated with or endorsed by Major League Soccer.</p></div></section>
  </div>`;
  PP.chart($("#mzones"), drawZones); PP.zoneLegend($("#mzleg"), 0.18, "goals");
  if(A){
    const st = A.steps.map(s => ({key:s.player, player:s.player, action:s.action, x:s.x, y:s.y, ex:s.end_x, ey:s.end_y, vb:s.v_before, va:s.v_after, xg:s.xg, delta:s.delta, goal:s.goal}));
    const ch = {steps: st};
    PP.chart($("#mpitch"), el => PP.chainPitch(el, ch, {labels:[0, st.length-1, st.reduce((bi,s,i) => (s.delta||0) > (st[bi].delta||0) ? i : bi, 0)], maxW:900}));
    PP.chart($("#msteps"), el => PP.chainSteps(el, ch, {maxW:900}));
  }
  if(SN) PP.chart($("#msens"), drawSens);
  if(hh.startsWith("method-")){ const el = $(`#m-${hh.slice(7)}`); if(el) requestAnimationFrame(() => el.scrollIntoView()); }
  ["#mzones","#mpitch","#msteps","#msens"].forEach(q => { if($(q)) PP.bindTips($(q)); });
  panel();
};

/* archetype badges (80_archetypes.py): the legend */
function archSection(A){
  const shown = A.defs.filter(d => d.shown), groups = [["attack","With the ball"],["defence","Winning it back"],["both","All-round"],["keeper","Goalkeepers"]];
  const POSW = {GK:"keepers", CB:"centre backs", FB:"fullbacks", CM_DM:"central midfielders", AM:"attacking midfielders", W:"wingers", ST:"strikers"};
  const who = d => d.positions.length >= 6 ? "Any outfield position" : d.positions.map(p => POSW[p]).join(", ").replace(/^./, c => c.toUpperCase());
  const card = d => `<div class="arch"><span class="bdg-roundel lg">${PP.badgeSvg(d.key, 26)}</span><b>${esc(d.name)}</b>
    <p>${esc(d.text.replace("{pos}", "players at the same position"))}</p>
    <span class="r-small">${who(d)}. Repeats the next season ${Math.round(d.repeat*100)}% of the time, against ${Math.round(d.base*100)}% by chance (${d.n_pairs} players with two seasons${d.n_pairs < 40 ? ", a small sample" : ""}). ${d.n_current ? `<a href="#players-${d.key}">${d.n_current} hold it in ${A.season}</a>` : `None in ${A.season} so far`}.</span></div>`;
  return `<section class="band mtext" id="m-archetypes"><div class="band-head"><h2 class="r-title">Archetypes</h2>
    <p>Each badge marks what a player does best, measured against players at the same position in the same season (${PP.int(A.min_minutes)}+ minutes), from the skills breakdown on every player page. A player shows every badge earned, strongest first (ordered by how far each clears its own bar, so a two-skill badge competes fairly with a one-skill badge). Badges rest only on skills with a real signal: aerial duels, being dribbled past and fouls stay mostly noise within a position even over a full season, and so does dribbling for most players, so nothing is built on them. Many other single skills are still noisy over one season (each player page marks which, at his minutes), so a badge must also prove that it repeats. Goals are never used: finishing does not repeat, so Goal Threat is about the number and quality of chances, and a Poacher is a forward who does a lot with few touches.</p>
    <p>A badge is only shown if the players who hold it are at least twice as likely as chance to hold it again the next season. Interceptions and loose-ball recoveries failed that on their own, so the ball-winning badges count tackles, interceptions and recoveries together; for keepers, claiming and sweeping failed it and has no badge. Players abroad in the scouting database earn the same badges, measured against their own league.</p></div>
    ${groups.map(([g, l]) => { const ds = shown.filter(d => d.side === g); return ds.length ? `<h3 class="r-heading" style="margin-top:var(--s-5)">${l}</h3><div class="arch-grid">${ds.map(card).join("")}</div>` : ""; }).join("")}
  </section>`;
}

/* how firmly the data fix the attack / ball-winning balance (77_weight_sensitivity.py) */
function weightsSection(N){
  const P = N.prediction, R = N.rankings_2025, at = k => P.find(x => x.k === k), rk = k => R.find(x => x.k === k), sp = N.spread_2025;
  const pk = N.published_k || 1, pub = at(pk), fit = at(1), quarter = at(0.25), dbl = at(2), C = N.change, L = N.levels;
  const lab = k => k === pk ? "As published" : k === 1 ? "Fitted (best on lineups)" : `×${k} of fitted`;
  const rows = [0.25, 0.5, 0.75, 1, 1.5, 2].map(k => { const x = rk(k), p = at(k); return `<tr${k===pk?' class="cur"':""}><td>${lab(k)}</td><td class="n">${num(p.w_def,2)}</td><td class="n">${p.r_dev.toFixed(3)}</td><td class="n">${k===pk?"–":x.spearman.toFixed(2)}</td><td class="n">${x.top20_kept} of 20</td><td class="n">${x.top50_pos.CB}</td><td class="n">${x.top50_pos.CM_DM}</td><td class="n">${x.top50_pos.W + x.top50_pos.ST}</td></tr>`; }).join("");
  const POSW = {CB:"centre backs", FB:"fullbacks", CM_DM:"central midfielders", AM:"attacking midfielders", W:"wingers", ST:"strikers"};
  const lev = L ? Object.keys(POSW).filter(p => L.att[p] != null).map(p => `<tr><td>${POSW[p].replace(/^./, c => c.toUpperCase())}</td><td class="n">${Math.round(L.att[p]*100)}th</td><td class="n">${Math.round(L.def[p]*100)}th</td></tr>`).join("") : "";
  return `<section class="band mtext" id="m-weights"><div class="band-head"><h2 class="r-title">The weights, and why ball-winning counts half</h2>
    <p>Attack is counted in goals (weight ${num(N.w_off,2)}); ball-winning in balls won per chance to win one, scaled to goals. The ball-winning weight that best predicts results from who starts is ${num(N.w_def_fit || N.w_def,2)}. We publish half of it, ${num(N.w_def,2)}.</p>
    <p>Why half. The lineup test, which sets the weights, can barely tell them apart: from half to double the fitted weight it predicts almost equally well (${pub.r_dev.toFixed(3)} at half, ${fit.r_dev.toFixed(3)} fitted, ${dbl.r_dev.toFixed(3)} at double), though a quarter is clearly worse (${sgn(quarter.d_dev,3)}). The second check is independent of every model: how a team's expected goals change with a player on the pitch against off it, over 2020–25.${C ? ` It clearly prefers less weight on ball-winning: the rating's agreement with it rose from ${C.onoff.net.old.toFixed(3)} to ${C.onoff.net.new.toFixed(3)} with the change (95% interval of the gain ${sgn(C.onoff.net.new_minus_old_ci[0],3)} to ${sgn(C.onoff.net.new_minus_old_ci[1],3)}), and with career adjusted plus-minus from ${C.rapm.old.toFixed(2)} to ${C.rapm.new.toFixed(2)}.` : ""} Half is the weight both checks accept. Owner's decision, 8 October 2026; until then the fitted weight was published.</p>
    <p>Ball-winning still matters: it varies between regulars about as much as attack does (2025 standard deviations ${num(sp.defence_sd,2)} and ${num(sp.attack_sd,2)} goals), and players who win the ball back where it is dangerous still rate highly.</p></div>
    <figure class="tfig" style="max-width:820px"><div class="fig-cap"><span class="r-label">Lineup test by ball-winning weight</span><span class="r-small">Correlation of predicted with actual match expected-goal difference, by multiple of the fitted weight. Hover a point.</span></div><div class="chart" id="msens"></div>
      <div class="legend"><span><i class="lg-line"></i>2021–25, each season held out (${PP.int(N.n_dev)} matches)</span><span><i class="lg-line dash"></i>2026, never used in fitting (${PP.int(N.n_2026)})</span></div></figure>
    <div class="tbl-wrap"><table class="dtable" style="max-width:820px"><thead><tr><th>Ball-winning weight</th><th class="n">Weight</th><th class="n">Lineup test r</th><th class="n">Rank agreement, 2025</th><th class="n">Top 20 kept</th><th class="n">Centre backs in top 50</th><th class="n">Central midfielders</th><th class="n">Wingers and strikers</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="r-small">Rank agreement is the correlation between the rankings of 2025 outfield players (900+ minutes) under each weight and as published.</p>
    ${lev ? `<h3 class="r-heading" style="margin-top:var(--s-6)">Replacement level: what the players who fill in produce</h3>
    <p>A replacement-level player is the kind a club can call on when a regular is out. We measure them directly: players under 900 minutes in a season, in their matches of 60 minutes or more (mostly starts). Against that season's regulars at the position, they sit at these percentiles, averaged over 2020–25 and steadied toward the all-position level where data are thin. Until 8 October 2026 the 25th percentile was assumed everywhere; the real level is higher, so values above replacement are now smaller and more honest.</p>
    <div class="tbl-wrap"><table class="dtable" style="max-width:520px"><thead><tr><th>Position</th><th class="n">Attack</th><th class="n">Ball-winning</th></tr></thead><tbody>${lev}</tbody></table></div>` : ""}
  </section>`;
}
function drawSens(el){
  const N = SN, W = el.clientWidth; if(!W) return; const H = 210, m = {l:44, r:16, t:12, b:34}; el.innerHTML = "";
  const P = N.prediction, ks = P.map(p => p.k), x0 = 0, x1 = Math.max(...ks), vals = P.flatMap(p => [p.r_dev, p.r_2026]);
  const y0 = Math.floor(Math.min(...vals)*20)/20, y1 = Math.ceil(Math.max(...vals)*20)/20;
  const sx = k => m.l + (k-x0)/(x1-x0)*(W-m.l-m.r), sy = v => m.t + (1-(v-y0)/(y1-y0))*(H-m.t-m.b);
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Lineup test correlation by multiple of the published ball-winning weight"},el);
  for(let v = y0; v <= y1 + 1e-9; v += 0.05){ S("line",{x1:m.l,x2:W-m.r,y1:sy(v),y2:sy(v),class:"g-line"},svg); text(svg, m.l-6, sy(v)+4, v.toFixed(2), "t-axis", {"text-anchor":"end"}); }
  ks.forEach(k => text(svg, sx(k), H-16, k === 1 ? "×1" : `×${k}`, "t-axis", {"text-anchor":"middle"}));
  const pk = N.published_k || 1;
  text(svg, W-m.r, H-2, "Multiple of the fitted ball-winning weight", "t-axis", {"text-anchor":"end"});
  S("line",{x1:sx(pk),x2:sx(pk),y1:m.t,y2:H-m.b,class:"g-base"},svg);
  [["r_dev","var(--signal)",""],["r_2026","var(--ink-3)","4 3"]].forEach(([key,col,dash]) => {
    S("path",{d:P.map((p,i) => `${i?"L":"M"}${sx(p.k)},${sy(p[key])}`).join(""),fill:"none",stroke:col,"stroke-width":2,"stroke-dasharray":dash},svg);
    P.forEach(p => S("circle",{cx:sx(p.k),cy:sy(p[key]),r:p.k===pk?5:3.5,fill:col,stroke:"var(--paper)","stroke-width":1.5,"data-tip":`<b>${p.k===pk?"As published":p.k===1?"Fitted":`×${p.k}`}</b> (weight ${num(p.w_def,2)})<br>${key==="r_dev"?"2021–25":"2026"}: r ${p[key].toFixed(3)}${key==="r_dev"&&p.d_dev!=null?`<br>vs fitted ${sgn(p.d_dev,3)} (${sgn(p.d_dev_ci[0],3)} to ${sgn(p.d_dev_ci[1],3)})`:""}`},svg));
  });
}

function drawZones(el){
  const G = MD.grid, W = Math.min(el.clientWidth, 760); if(!W) return; const H = Math.round(W*68/105);
  el.innerHTML = "";
  const svg = S("svg",{width:W,height:H+18,viewBox:`0 0 ${W} ${H+18}`,role:"img","aria-label":"The pitch's 96 zones coloured by the value of possession there; select one"},el);
  const {sx, sy} = PP.pitchBase(svg, W, H, false), cw = W/12, ch = H/8, sel = G.zones[HZ];
  const keep = Object.fromEntries(sel.keep), kmax = Math.max(...Object.values(keep));
  G.zones.forEach(z => { const x = z.x*cw, y = H-(z.y+1)*ch, isSel = z.z === HZ, k = keep[z.z];
    const f = PP.valueFill(z.v, 0.18);
    const r = S("rect",{x:x+1,y:y+1,width:cw-2,height:ch-2,rx:1.5,fill:f,stroke:isSel?"var(--ink)":(k!=null?"var(--signal)":"none"),"stroke-width":isSel?2.5:(k!=null?Math.max(1,3*k/kmax):0),style:"cursor:pointer","data-tip":`<b>${num(z.v,3)} goals</b><br>${Math.round(z.x*8.75)}–${Math.round((z.x+1)*8.75)} m from own goal line<br>Seen ${PP.int(z.n)} times`},svg);
    r.addEventListener("click", () => { HZ = z.z; drawZones(el); panel(); });
    if(cw > 34 && (isSel || z.v > 0.04)) text(svg, x+cw/2, y+ch/2+4, num(z.v,2), "t-axis", {"text-anchor":"middle",style:`fill:${PP.inkOn(f)};font-weight:650;pointer-events:none`}); });
  PP.pitchLines(svg, sx, sy);
  text(svg, 0, H+14, "Own goal", "t-axis", {}); text(svg, W, H+14, "Attacking", "t-axis", {"text-anchor":"end"});
}
function panel(){
  const G = MD.grid, z = G.zones[HZ], third = z.x < 4 ? "own third" : z.x < 8 ? "middle third" : "attacking third";
  const top = z.keep.slice().sort((a,b) => b[1]-a[1])[0];
  $("#mpanel").innerHTML = `<span class="r-label">Selected zone</span><span class="r-figure" style="font-size:var(--t-48)">${num(z.v,3)}</span>
    <p class="r-small">goals: what a team with the ball here can expect to score minus concede before its possession ends.</p>
    <p>This zone is in the ${third}, ${Math.round(z.x*8.75)}–${Math.round((z.x+1)*8.75)} metres from the team's own goal line. From here the next action:</p>
    <div class="funnel"><div class="fn"><span>keeps the ball</span><span class="tr"><i style="width:${z.p_keep*100}%"></i></span><span class="num">${pct(z.p_keep)}</span></div>
      <div class="fn"><span>loses it</span><span class="tr"><i style="width:${z.p_lose*100}%;background:var(--flare)"></i></span><span class="num">${pct(z.p_lose)}</span></div>
      <div class="fn"><span>is a shot</span><span class="tr"><i style="width:${Math.max(0.5,z.p_shot*100)}%;background:var(--turf)"></i></span><span class="num">${pct(z.p_shot)}</span></div></div>
    <p class="r-small">${z.xg_per_shot ? `Shots from here are worth ${num(z.xg_per_shot,2)} expected goals on average. ` : ""}Outlined zones are where the ball goes next when the team keeps it; the thicker the outline, the more often. Seen ${PP.int(z.n)} times in 2020–25. Set pieces have their own states: a corner is worth ${num(G.special.corner,3)}, a penalty ${num(G.special.penalty,2)}.</p>`;
}
})();
