/* Pitch Perception: Method. Data: data/method.json (40_method_illustration.py), data/trends.json (meta). */
(function(){
"use strict";
const {$, $$, S, text, esc, sgn, num, pct, pctShort, money, short, full} = PP;
/* the live forecast record (96): how it is scored, in plain words, from forecast_log.json (2026-10-27: the scoring rules
   moved here from the Matches and Playoff race pages) */
const recordSection = FL => {
  const s = FL.score, b = FL.baseline_rates, typ = v => `${(Math.exp(-v) * 100).toFixed(1)}%`, ci = s.log_loss_gap_ci95 || [];
  return `<section class="band mtext" id="m-record"><div class="band-head"><h2 class="r-title">How we check the forecasts</h2>
    <p>Since ${PP.dateLong(FL.started.slice(0, 10))}, every match forecast on the site is written to a public log before kickoff and never changed: <a href="data/forecast_log.csv">forecast_log.csv</a> has one row each time a match's forecast changed, and <a href="data/forecast_scorecard.csv">forecast_scorecard.csv</a> the graded forecast and result of every played match. A forecast can change several times before a match as lineup news arrives; the last one before kickoff is the one graded.</p>
    <p>Two standard scores, both lower-is-better. <b>Log loss</b> measures how surprised the forecast was by what happened: the negative logarithm of the chance it gave the actual result, averaged over matches. Giving every result a one-in-three chance scores 1.099. <b>Brier score</b> adds up the squared gaps between the three chances and what happened (1 for the result, 0 for the others): 0 is perfect, and one in three for everything scores 0.667. Both are compared with always predicting the league's 2021–25 mix: ${pct(b[0])} home wins, ${pct(b[1])} draws, ${pct(b[2])} away wins.</p>
    <p>On the ${s.n} matches graded so far: log loss ${num(s.log_loss, 3)} against ${num(s.baseline_log_loss, 3)}, so the forecast gave the actual result a typical chance of ${typ(s.log_loss)} against ${typ(s.baseline_log_loss)} for the league's mix; Brier ${num(s.brier, 3)} against ${num(s.baseline_brier, 3)}.${ci.length ? ` Resampling the matches, the 95% range for the log-loss gap is ${sgn(ci[0], 3)} to ${sgn(ci[1], 3)}.` : ""}${s.favourite_won != null ? ` The favourite (the likelier of a home and an away win) won ${s.favourite_won} times; the forecasts' chances for it added up to ${num(s.favourite_expected, 1)}.` : ""}</p>
    <p>That is a small sample. It can show whether the forecasts have beaten the league's mix; it cannot show by how much, or settle a choice between two versions of the model: in tests on 2021–25 matches the edge over the mix was about 0.02 in log loss, and an edge that size takes roughly a thousand matches or more to show reliably.</p></div></section>`;
};
let mP = null, tP = null, sP = null, dP = null, MD = null, SN = null, DC = null, HZ = 91;
const load = () => mP || (mP = fetch("data/method.json").then(r => { if(!r.ok) throw new Error(`method.json returned ${r.status}`); return r.json(); }));
const loadS = () => sP || (sP = fetch("data/sensitivity.json").then(r => r.ok ? r.json() : null).catch(() => null));
const loadT = () => tP || (tP = fetch("data/trends.json").then(r => r.ok ? r.json() : null).catch(() => null));
const loadD = () => dP || (dP = fetch("data/decisions.json").then(r => r.ok ? r.json() : null).catch(() => null));   // 139: how we decide

/* "What the number means" (owner, 2026-10-09). Zone values come from the fitted chain (method.json grid); the example is
   the season's top-rated player (home.json leaders), so every figure follows the data. */
const meaning = (G, EX) => {
  if(!G || !G.zones) return "";
  const zv = (xs, ys) => { const z = G.zones.filter(q => xs.includes(q.x) && ys.includes(q.y)); return z.reduce((t,q) => t + q.v, 0) / Math.max(1, z.length); };
  const mid = zv([5,6],[3,4]), edge = zv([9],[3,4]), box = zv([10],[3,4]), front = zv([11],[3,4]);
  const pc = v => `${Math.max(1, Math.round(v * 100))}%`;
  const ex = EX ? `<p><b>How to read ${PP.sgn(EX.rating)}.</b> ${PP.plink(EX.ws_player_id, EX.player, EX.year)}'s actions in ${EX.year} added about ${num(EX.rating,1)} goals of expected-goal difference beyond what a replacement-level ${(PP.POS[EX.pos]||"player").toLowerCase()} would have added in the same ${PP.int(EX.mins)} minutes${EX.points != null ? `, worth about ${num(EX.points,1)} points in the table` : ""}. The 90% range, ${PP.sgn(EX.lo,1)} to ${PP.sgn(EX.hi,1)}, shows how much luck could have moved it.</p>` : "";
  return `<section class="band mtext" id="m-meaning"><div class="band-head"><h2 class="r-title">What the number means</h2>
    <p>Every rating on this site is in goals.</p>
    <p>Each spot on the pitch has a value: the expected goals of the next shot, counted for the team with the ball if it takes that shot and against it if the opponent does. In MLS that is about ${pc(mid)} of a goal in the centre circle, ${pc(edge)} just outside the box, ${pc(box)} in the middle of the box and ${pc(front)} right in front of goal.</p>
    <p>Every action is credited with the change it makes. A pass that moves the ball from midfield into the middle of the box adds about ${num(box - mid, 2)} goals, shared between the passer and the player who got there to receive it. Losing the ball costs the swing. A season's credit, set against what a replacement-level player at the same position adds in the same minutes and scaled against real match results, is the rating.</p>
    ${ex}
    <p><b>Not counted:</b> finishing (the rating pays for chances, not conversion), and defending without the ball, such as positioning and marking, which event data cannot see.</p></div></section>`;
};

PP.pages.method = async main => {
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">How it works</h1><p class="r-small">Loading.</p></section></div>`;
  let T; try { [MD, T, SN, , DC] = await Promise.all([load(), loadT(), loadS(), PP.loadArch(), loadD(), PP.loadRoles()]); } catch(e){ main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The method data did not load</h1><p>${esc(e.message)}</p></section></div>`; return; }
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
  let FL = null; try { const r = await fetch("data/forecast_log.json"); FL = r.ok ? await r.json() : null; } catch(e){ FL = null; }
  const hh = location.hash.slice(1);
  if(hh !== "method" && !hh.startsWith("method-")) return;
  const A = MD.attack, D = MD.defence, C = MD.contrast, W = MD.weights, G = MD.grid, TS = MD.tests || {}, meta = (T && T.meta) || {};
  const bm = (meta.slot_benchmarks || []).slice().sort((a,b) => b.benchmark - a.benchmark);
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">How it works</h1>
    <p class="r-note standfirst">Pitch Perception uses a possession-value model: a match is treated as a chain of possessions moving through the pitch, every action is valued by how much it changes the expected goals of the next shot, for the team with the ball or against it, and a player's rating is the sum of those changes against a replacement-level player at the same position.</p></section>
${meaning(G, EX)}

  <section class="band mtext" id="m-origins"><div class="band-head"><h2 class="r-title">Where the method comes from</h2>
    <p>Valuing football actions by how much they change a possession's chance of ending in a goal is a well-established idea in football analytics; Pitch Perception did not invent it. Modelling possession as a chain of states, a Markov model, goes back at least to Sarah Rudd's work in 2011. Karun Singh's expected threat (xT) made the zone-based version widely known. Academic models such as VAEP (KU Leuven, 2019) value every on-ball action, and American Soccer Analysis publishes its goals added for MLS. Expected goals, the value of a shot, is a standard idea too.</p>
    <p>This site is an independent implementation of that family of models, fitted to MLS event data. The choices made in building it are its own: the grid of pitch zones, split by how the ball arrived; ball-winning measured against what a replacement would win back from the danger each player faced; attack and ball-winning weighted by how well each predicts match results, in a study fixed in advance; ratings against a replacement-level player at each position and season; ranges from resampling matches; and every piece tested on seasons the models never saw. Where a choice follows someone else's convention it is borrowed openly: crediting the receiver of a completed pass as well as the passer follows American Soccer Analysis, which divides the value by how likely the pass was to be completed; here it is split equally.</p></div></section>

  <section class="band mtext" id="m-chain"><div class="band-head"><h2 class="r-title">The pitch as a chain of states</h2>
    <p>A state is where the ball is (one of 96 zones, or a set piece), who has it and, in open play, how it got there: the kind of action that delivered it, whether the possession began with a ball won back, and for a pass, which third of the pitch it came from. From every state the event data shows how often the team keeps the ball, loses it or shoots, and where the ball goes next. Solving those probabilities together gives every state a value: the expected goals of the next shot, positive if the team in possession takes it and negative if the opponent wins the ball and shoots first. Select any zone; its value and moves are those of all the ways the ball arrives there, together.</p></div>
    <div class="mgrid"><figure class="tfig"><div class="chart" id="mzones"></div><div id="mzleg" class="zleg"></div></figure><div class="mpanel" id="mpanel"></div></div></section>

  ${A ? `  <section class="band mtext" id="m-attack"><div class="band-head"><h2 class="r-title">Valuing a real move</h2>
    <p>${esc(short(A.team))} against ${esc(short(A.team === A.home ? A.away : A.home))}, ${PP.dateLong(A.date)} (finished ${esc(String(A.score).replace(/\s*:\s*/,"–"))}), ${A.minute} minutes in. ${esc(A.steps[0].player)} wins the ball from ${esc(A.lost_by)}, and ${A.steps.length - 1} actions later ${esc(A.steps[A.steps.length-1].player)} scores. Every action earns the change in value it causes. A completed pass is split equally between passer and receiver; a shot earns its expected-goal value minus the value of the place it was taken from.</p></div>
    <div class="chart" id="mpitch"></div><div class="chart" id="msteps"></div>
    <div class="tbl-wrap"><table class="dtable"><thead><tr><th class="n">#</th><th>Player</th><th>Action</th><th class="n">Value before</th><th class="n">After</th><th class="n">Change</th><th>Credit</th></tr></thead><tbody>
      ${A.steps.map((s,i) => `<tr><td class="n">${i+1}</td><td>${PP.plink(s.id, s.player)}</td><td>${esc(s.action)}</td><td class="n">${num(s.v_before,3)}</td><td class="n">${s.xg != null ? `${num(s.xg,3)} xG` : num(s.v_after,3)}</td><td class="n"><b>${sgn(s.delta,3)}</b></td><td>${s.credits.map(c => `${PP.plink(c.id, PP.surname(c.player))} ${sgn(c.value,3)} <span class="r-small">${esc(c.role)}</span>`).join("<br>")}</td></tr>`).join("")}
    </tbody></table></div>
    <p class="r-small">Credit from this move: ${A.totals.map(t => `${PP.plink(t.id, t.player)} ${sgn(t.value,3)}`).join(", ")}. The build-up passes add little because they move the ball between zones of similar value; the value jumps when the ball reaches the box. Over a season the credits are added up and set against a replacement-level player at the same position. They are already in goals of possession value${W.w_off === 1 ? ", so attack counts as it is" : `; in the rating, attack is weighted ${W.w_off.toFixed(2)} (see how much each part counts, below)`}.</p></section>` : ""}

  <section class="band mtext" id="m-defence"><div class="band-head"><h2 class="r-title">Winning the ball back</h2>
    <p>${PP.plink(D.attacker_id, D.attacker)} (${esc(short(D.attacking_team))}) tries a ${esc(D.attacker_action)} inside the box, ${PP.dateLong(D.date)}, ${D.minute} minutes in, and ${PP.plink(D.defender_id, D.defender)} (${esc(short(D.defender_team))}) wins it with a ${esc(D.action)}. Each value is from the side of the team with the ball. Before the ${esc(D.action)}, ${esc(short(D.attacking_team))}'s attack was worth ${num(D.danger_before,3)}; afterwards ${esc(short(D.defender_team))}'s possession, in its own box, was worth ${num(D.own_value_after,3)}. The swing is the two together, ${num(D.danger_before,3)} ${D.own_value_after < 0 ? "&minus;" : "+"} ${num(Math.abs(D.own_value_after),3)} = ${num(D.swing,3)}, and it is shared: half (${sgn(D.credit_defender,3)}) to ${esc(PP.surname(D.defender))} as ball-winning, half (${sgn(D.charge_attacker,3)}) charged to ${esc(PP.surname(D.attacker))}'s attack.</p>
    <p>Volume alone would reward defenders whose team is under siege, so ball-winning is judged against what a replacement would have won back in the same minutes, facing the same danger. <b>Danger faced</b> measures that exposure. For every action the opponents make while a player is on the pitch, it takes the value of their possession at that moment (when positive) and shares it among the defending team's players by how often each position wins the ball in that part of the pitch. An attack counts once for each of its actions, so a season's danger faced runs far higher than any count of goals: it measures exposure, not goals. Players do win more of the ball when more danger comes their way, but less than in proportion, so a replacement is credited with two parts: a fixed amount per 90 minutes, set where the league's fill-in players sit (see replacement level, below), and a share of each unit of danger, measured from players' own busier and quieter matches at the position that season.</p>
    <p>Over ${D.season.year}, ${esc(D.defender)}'s ball-winning credits, half of each swing like this one, add up to ${num(D.season.regain,2)}, from ${PP.int(D.season.mins)} minutes in which they faced danger of ${num(D.season.exp_value,1)}. A replacement-level ${D.pos === "CB" ? "centre back" : "fullback"} would have won back ${num(D.season.repl,2)}: ${num(D.season.repl_mins,2)} for the minutes (${num(D.season.a_r_p90,4)} per 90) and ${num(D.season.repl_danger,2)} for the danger (${num(D.season.beta,4)} of each unit). That leaves ${sgn(D.season.regain_opp_ar,3)} above replacement. ${W.w_def === 1 ? "Counted as it is" : `Weighted ${W.w_def.toFixed(2)} (see how much each part counts, below)`}, it is the ${sgn(D.season.defence,2)} for winning it back on their page.</p></div>
    <div class="tbl-wrap"><table class="dtable" style="max-width:900px"><thead><tr><th>Two centre backs, ${C.year || 2025}</th><th class="n">Minutes</th><th class="n">Danger faced</th><th class="n">Won back</th><th class="n">Replacement would win back</th><th class="n">Above replacement</th><th class="n">Winning it back${W.w_def === 1 ? "" : ` (&times; ${W.w_def.toFixed(2)})`}</th></tr></thead>
      <tbody>${C.players.map(p => `<tr><td>${PP.plink(p.id, p.player, C.year || 2025)} <span class="r-small">${esc(short(p.team))}</span></td><td class="n">${PP.int(p.mins)}</td><td class="n">${num(p.exp_value,1)}</td><td class="n">${num(p.regain,2)}</td><td class="n">${num(p.repl,2)}</td><td class="n">${sgn(p.regain_opp_ar,3)}</td><td class="n"><b>${sgn(p.defence,2)}</b></td></tr>`).join("")}</tbody></table></div>
    <p class="r-small">They won back about the same, but far more danger came the first one's way, so a replacement would have won back more in their place too, and the second rates higher. In ${C.year || 2025} a replacement-level centre back is credited ${num(C.a_r_p90,4)} per 90 plus ${num(C.beta,4)} of each unit of danger. Figures are rounded.</p></section>

  <section class="band mtext" id="m-rating"><div class="band-head"><h2 class="r-title">From actions to a rating</h2>
    <p><b>Value above replacement</b> is a season's attack plus ball-winning, in goals of match expected-goal difference, against a replacement-level player at the same position and season. Replacement level is what the players who actually fill in produce (measured below), set per position and season, so league-wide changes (such as the rise in recorded clearances in 2025, an Opta coding change) do not inflate a whole position.</p>
    <p>${W.w_def === 1 && W.w_off === 1 ? "Attack and ball-winning are both in the model's own units, goals of expected-goal difference, and both count as they are. How much ball-winning should count is the one choice the data have not pinned down (below)." : `The model values attack and ball-winning in goals of possession value. In the rating they are weighted by how much each predicts a team's match expected-goal difference: attack ${W.w_off.toFixed(2)} and ball-winning ${W.w_def.toFixed(2)} (below).`} Fouls are reported but not counted: once a player's exposure is allowed for, they carried no individual signal. Penalties won are treated the same way. The pass or run before the foul earns what it is worth to reach the penalty spot in open play, and the rest of the penalty's value is shown, not counted, for the player who was fouled, because winning penalties barely repeats from one half-season to the next.</p>
    <p>Every rating has a 90% range from resampling the season's matches 1,000 times: how much the season's numbers could have differed with the same player. ${TS.range ? `A regular's range (${PP.int(TS.range.min_minutes)}+ minutes, ${TS.range.seasons.replace("-", "–")}) typically spans about ${num(TS.range.median_width,1)} goals` : "A regular's range spans a couple of goals"}, so close rankings are ties: see the Tiers view on the Players page.</p></div></section>

${SN ? weightsSection(SN) : ""}

${PP.data.arch ? archSection(PP.data.arch, DC) : ""}
${PP.data.roles ? stylesSection(PP.data.roles) : ""}

  <section class="band mtext" id="m-slot"><div class="band-head"><h2 class="r-title">Against the contract type</h2>
    <p>MLS roster building is a scarcity problem: three Designated Player places and a handful of U22 and allocation-money signings, paid for whether or not the player plays. So the fair comparison for a player is with others on the same type of contract: does a Designated Player produce like a Designated Player? Value against the contract type is an outfield player's rating minus the typical full season on that type of contract (the median season of players who held it for at least 90% of a season, 2020–25), pro-rated to the part of the season they held it. The chance of beating it comes from the same resampling as the player's range. How much a player is paid within a type does not enter: a $2m Designated Player and a $20m one face the same bar, because the scarce thing is the place, not the money. ${T && T.points_per_goal ? `A goal of a team's season expected-goal difference has been worth about ${num(T.points_per_goal,2)} points in the table (2021–25).` : ""}</p></div>
    ${bm.length ? `<div class="tbl-wrap"><table class="dtable" style="max-width:720px"><thead><tr><th>Contract type</th><th class="n">Typical season, goals</th><th class="n">Per 90, regulars</th><th class="n">Median pay</th><th class="n">Player-seasons</th></tr></thead><tbody>${bm.map(b => `<tr><td>${esc(PP.SLOT[b.slot]||b.slot)}</td><td class="n">${num(b.benchmark,2)}</td><td class="n">${num(b.benchmark_p90,3)}</td><td class="n">${money(b.median_pay)}</td><td class="n">${PP.int(b.n)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <p class="r-small">TAM / GAM combines TAM players with senior-roster players paid above the maximum budget charge. 2024–26 contract types are the official MLS designations; 2020–23 are inferred from Designated Player history and salary, so U22, Homegrown and Supplemental cannot be identified before 2024 and their typical seasons use 2024–25. "Per 90, regulars" is the median per 90 among holders with 900+ minutes.</p></section>

  <section class="band mtext" id="m-forecast"><div class="band-head"><h2 class="r-title">Forecasts</h2>
    <p>Match forecasts start from a team-strength rating built half on results and half on chances (each match's expected goals), with home advantage and margin, turned into expected goals with a Poisson model. It replaced a results-only Elo rating on 7 October 2026, after a test fixed in advance showed it predicted 2021–25 matches slightly better (see the Playoff race page). Where the starting lineups or the league's availability report are known, each side's expected goals are adjusted for who plays, using players' ratings this season and last, keepers' shot-stopping and bench strength. The rest of the season is simulated 20,000 times; each simulated season seeds its own bracket in the 2025 playoff format. The weekly forecast history is reconstructed: today's team-strength model, refitted on the results known at each date, without the lineup adjustments (those exist only for the coming matches). It shows what this model would have said, not what was published at the time.</p></div></section>
  ${FL && FL.score && FL.score.n ? recordSection(FL) : ""}

  <section class="band mtext" id="m-tests"><div class="band-head"><h2 class="r-title">How it was tested</h2></div>
    <ul class="mlist">
      <li><b>Lineup test.</b> Last season's attack and ball-winning, added at face value and summed over who actually started, predict this season's match expected-goal difference${TS.lineup ? ` (r ${num(TS.lineup.r,2)} on ${TS.lineup.seasons.replace("-", "–")}, ${PP.int(TS.lineup.n_matches)} matches), better than the site's earlier model (${num(TS.lineup.r_gam,2)})` : ""}. Before the October 2026 changes to the pitch states and to ball-winning, the model scored 0.17 on 2014–19 matches held back for confirmation; the current version has not used them.</li>
      <li><b>Within-team test.</b> When a club fields a stronger-than-usual lineup by these ratings, it produces a better-than-usual expected-goal difference${TS.within_team ? `: r ${num(TS.within_team.r,2)} on ${TS.within_team.seasons.replace("-", "–")} (${PP.int(TS.within_team.n_matches)} matches; 95% range ${num(TS.within_team.ci[0],2)} to ${num(TS.within_team.ci[1],2)}) with the ratings as published, and ${num(TS.within_team.given_minutes.r,2)} once the starters' previous-season minutes are allowed for` : ": r about 0.10 when last measured, on 1 October 2026, before those changes"}. The ratings separate individual players, not just teams. The weights the site uses come from the same kind of comparison, within clubs in MLS and eleven other leagues (see how much each part counts, above), partly on these same MLS matches, so this is not a fully independent check.</li>
      <li><b>What a replacement would win back.</b> Two rules were tested before either was chosen, in a study fixed in advance: ball won rising in proportion to the danger a player faces (the earlier rule), and a fixed amount per 90 plus a share of each unit of danger (the rule used now). Predicting players' own matches that the fit had not seen, the second was 7.5% more accurate, in all six seasons, and 22% more accurate for 117 players who changed clubs.</li>
      <li>The pitch values and expected goals are out of sample: each season is valued by models fitted on other seasons, and 2026 by the fit on 2020–25. Replacement levels and the share of danger are set from each season's own players, as described above.</li>
    </ul></section>

${DC && DC.decisions ? decideSection(DC) : ""}

  <section class="band mtext" id="m-caveats"><div class="band-head"><h2 class="r-title">What it cannot see</h2></div>
    <ul class="mlist">
      <li><b>Off-ball movement, marking and shape</b> are invisible in event data. Getting open is credited only through receiving the ball.</li>
      <li><b>Ball-winning's weight is the least certain choice.</b> ${SN && SN.rankings_2025 ? (r => r ? `At ${num(r.w_def, r.w_def % 1 ? 2 : 0)} it accounts for ${Math.round(r.bw_share*100)}% of the differences between players at the same position; ` : "")(SN.rankings_2025.find(x => x.published)) : ""}${SN && SN.abroad && SN.abroad.status === "reported" ? `its 95% range runs from ${num(SN.abroad.ci95[0], 2)} to ${num(SN.abroad.ci95[1], 2)} (see the weights above).` : "the data allow anything from almost no weight to several times more (see the weights above)."} Part of what it rewards may also be off-ball and team defending that happens to end with this player winning the ball.</li>
      <li><b>Ranges cover luck, not the model.</b> A player's 90% range shows how much the season could have differed with the same player. It does not include doubt about the model's own choices (the weights, replacement level, the zone values), so the real uncertainty is somewhat wider.</li>
      <li><b>Goalkeepers</b> are rated separately, by shot-stopping. A season's goals prevented barely repeats (year-to-year correlation about 0.16): over a typical season of shots on target, only about a fifth of the difference between keepers is skill. So keepers are ranked by goals prevented shrunk by that share (shots / (shots + 500), chosen by a test fixed in advance on keepers in MLS and eleven other leagues), measured against an average keeper; each keeper's page also shows the season's raw figure. Distribution is repeatable but showed no link to goals conceded.</li>
      <li><b>Finishing is not a skill here.</b> Shots earn their chance quality, not whether they went in; finishing barely repeats from season to season (about 0.05).</li>
      <li><b>2026 is a partial season</b>, so its ranges are wider.</li>
    </ul></section>

  <section class="band mtext" id="m-data"><div class="band-head"><h2 class="r-title">The data</h2>
    <p>Event data, lineups and minutes from WhoScored (Opta) for every regular-season match since 2020 (bar one 2025 match it does not carry), with expected goals from a shot model fitted to those MLS shots for this site; team sheets, availability reports and kickoff times from the league's own match feed; salaries from the MLS Players Association; Transfermarkt for scouted players' market values (shown as bands), contracts and nationalities. Regular season only. Pitch Perception is independent and is not affiliated with or endorsed by Major League Soccer.</p></div></section>
  </div>`;
  PP.chart($("#mzones"), drawZones); PP.zoneLegend($("#mzleg"), 0.18, "goals");
  if(A){
    const st = A.steps.map(s => ({key:s.player, player:s.player, action:s.action, x:s.x, y:s.y, ex:s.end_x, ey:s.end_y, vb:s.v_before, va:s.v_after, xg:s.xg, delta:s.delta, goal:s.goal}));
    const ch = {steps: st};
    PP.chart($("#mpitch"), el => PP.chainPitch(el, ch, {labels:[0, st.length-1, st.reduce((bi,s,i) => (s.delta||0) > (st[bi].delta||0) ? i : bi, 0)], maxW:900}));
    PP.chart($("#msteps"), el => PP.chainSteps(el, ch, {maxW:900}));
  }
  if(hh.startsWith("method-")){ const el = $(`#m-${hh.slice(7)}`); if(el) requestAnimationFrame(() => el.scrollIntoView()); }
  ["#mzones","#mpitch","#msteps"].forEach(q => { if($(q)) PP.bindTips($(q)); });
  panel();
};

/* skills that stay noise within a position even over a full season (139, from 68's reliability), in words */
const NOISE_WORD = {penalties:"penalties won", aerials:"aerial duels", not_beaten:"being dribbled past", fouls:"fouls", dribbling:"dribbling",
  high_regains:"high regains", blocks:"blocks", clearances:"clearances", shooting:"shot selection", interceptions:"interceptions"};
function noiseList(D){
  const k = D && D.noise_skills ? D.noise_skills.never.filter(x => x !== "penalties").map(x => NOISE_WORD[x] || x) : [];
  return k.length ? (k.length === 1 ? k[0] : `${k.slice(0, -1).join(", ")} and ${k[k.length-1]}`) : "";
}

/* how we decide (139_how_we_decide.py): each choice settled by a test fixed before it ran, with its result */
function decideSection(D){
  const rows = D.decisions.map(d => `<tr><td><b>${esc(d.question)}</b><span class="r-small" style="display:block;margin-top:4px">${esc(d.test)}</span></td>
    <td>${esc(d.result)}</td><td><b>${esc(d.decision)}</b><span class="r-small" style="display:block;margin-top:4px">${esc(d.area)}, ${esc(d.date)}</span></td></tr>`).join("");
  return `<section class="band mtext" id="m-decide"><div class="band-head"><h2 class="r-title">How we decide</h2>
    <p>The main choices behind the ratings and forecasts, and the test that settled each one. Every test was written down before it ran, with its rule for passing fixed in advance; when a test fails, the change is not made, and the result is still shown here.</p></div>
    <div class="tbl-wrap"><table class="dtable wrap"><colgroup><col style="width:44%"><col style="width:30%"><col style="width:26%"></colgroup><thead><tr><th>The question, and the test fixed in advance</th><th>Result</th><th>Decision</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="r-small">Intervals are 95%. An error change below zero means the change predicted better: per possession for the pitch models, per match for the forecasts.</p></section>`;
}

/* archetype badges (80_archetypes.py): the legend */
/* how the two figures on every badge are built (owner, 2026-10-27), worked through on one badge with 80's own counts */
function repeatHow(A){
  const ex = A.defs.find(d => d.key === "distributor" && d.shown && d.n_again != null) || A.defs.find(d => d.shown && d.n_again != null);
  const p0 = v => `${Math.round(v*100)}%`;
  const eg = ex ? ` For ${esc(ex.name)}, ${PP.int(ex.n_again)} of ${PP.int(ex.n_pairs)} holders held it again (${p0(ex.repeat)}), against ${PP.int(ex.n_hold)} of ${PP.int(ex.n_elig)} players by chance (${p0(ex.base)}).` : "";
  return `<b>How a badge has to repeat.</b> Each badge is checked on every pair of seasons in a row in which a player had ${PP.int(A.min_minutes)}+ minutes in both (2020 and 2021, and so on up to last season and this one, which is still being played), at a position the badge covers in the second season. <i>Repeats the next season</i> is the share of the first season's holders who hold it again in the second. <i>By chance</i> is the share of all of those players who hold it in the second season, whether they held it before or not: how often a holder would keep it if holding it once said nothing about the player.${eg} A badge is shown only if the first rate is at least twice the second and the low end of its 95% range (a Wilson interval) still beats chance, which makes it hard for a badge resting on a handful of players to pass on luck. A player counts once for each pair of seasons, and the check is rerun with every update, so a badge close to the line can appear or disappear as this season fills in.`;
}
function archSection(A, D){
  const shown = A.defs.filter(d => d.shown), groups = [["attack","With the ball"],["defence","Winning it back"],["both","All-round"],["keeper","Goalkeepers"]];
  const POSW = {GK:"keepers", CB:"centre backs", FB:"fullbacks", CM_DM:"central midfielders", AM:"attacking midfielders", W:"wingers", ST:"strikers"};
  const who = d => d.positions.length >= 6 ? "Any outfield position" : d.positions.map(p => POSW[p]).join(", ").replace(/^./, c => c.toUpperCase());
  const card = d => `<div class="arch"><span class="bdg-roundel lg">${PP.badgeSvg(d.key, 26)}</span><b>${esc(d.name)}</b>
    <p>${esc(d.text.replace("{pos}", "players at the same position"))}</p>
    <span class="r-small">${who(d)}. ${needs(d)} ${d.n_again != null ? `Repeats the next season ${Math.round(d.repeat*100)}% of the time (${PP.int(d.n_again)} of ${PP.int(d.n_pairs)} holders${d.n_pairs < 40 ? ", a small sample" : ""}), against ${Math.round(d.base*100)}% by chance (${PP.int(d.n_hold)} of ${PP.int(d.n_elig)} players with two seasons).` : `Repeats the next season ${Math.round(d.repeat*100)}% of the time, against ${Math.round(d.base*100)}% by chance (${d.n_pairs} players with two seasons${d.n_pairs < 40 ? ", a small sample" : ""}).`} ${d.n_current ? `<a href="#players-${d.key}">${d.n_current} hold it in ${A.season}</a>` : `None in ${A.season} so far`}.</span></div>`;
  // what each badge needs (80): 900 minutes and, for a badge on a skill, the minutes at which that skill becomes reliable
  const fmt = m => PP.int(Math.max(A.min_minutes, Math.round(m/10)*10));
  const needs = d => { const r = d.reliable_from || {}, ps = d.positions.filter(p => p in r);
    if(!d.skill_rows || !d.skill_rows.length || !ps.length) return `Needs ${PP.int(A.min_minutes)}+ minutes.`;
    const ok = ps.filter(p => r[p] != null).map(p => r[p]), never = ps.filter(p => r[p] == null), lo = Math.min(...ok), hi = Math.max(...ok);
    const a = !ok.length ? "" : hi <= A.min_minutes ? `Needs ${PP.int(A.min_minutes)}+ minutes`
      : `Needs ${fmt(lo) !== fmt(hi) ? `${fmt(lo)} to ${fmt(hi)}+ minutes, depending on position` : `${fmt(hi)}+ minutes`}, when the skill becomes reliable`;
    return `${a}${never.length ? `${a ? "; " : ""}not within reach in one season for ${never.map(p => POSW[p]).join(" or ")}` : ""}.`; };
  return `<section class="band mtext" id="m-archetypes"><div class="band-head"><h2 class="r-title">Archetypes</h2>
    <p>Each badge marks what a player does best, measured against players at the same position in the same season (${PP.int(A.min_minutes)}+ minutes), from the skills breakdown on every player page. A player shows every badge earned, strongest first (ordered by how far each clears its own bar, so a two-skill badge competes fairly with a one-skill badge). Badges rest only on skills with a real signal${noiseList(D) ? `: ${noiseList(D)} stay mostly noise within a position even over a full season, so nothing is built on them` : ""}. Many other single skills are still noisy over one season (each player page marks which, at their minutes), so a badge must also prove that it repeats. Goals are never used: finishing does not repeat, so Goal Threat is about the number and quality of chances, and a Poacher is a forward who does a lot with few touches.</p>
    <p><b>How a player earns a badge, each season:</b> at least ${PP.int(A.min_minutes)} minutes at a position the badge covers; a value per 90 in the badge's skill in the top 15% (or 10%, where stated) of players at their position with ${PP.int(A.min_minutes)}+ minutes that season; and, for a badge built on a skill, that skill reliable at their minutes (0.5 or more), because below that a season's number is mostly noise. How many minutes that takes depends on the skill and the position, so each badge below says. <b>Early in a season</b>, a player's badges from last season stay on their page, marked with their year and a dashed outline, until this season has enough minutes to judge them.</p>
    <p>${repeatHow(A)} A player holds a badge built on a skill only if that skill is reliable at their minutes, so no badge rests on a row their page marks as mostly noise. Interceptions and loose-ball recoveries failed that on their own, so the ball-winning badges count tackles, interceptions and recoveries together${(A.defs.find(d => d.key === "sweeper_keeper") || {}).shown === false ? "; for keepers, claiming and sweeping failed it and has no badge" : ""}. Players abroad in the scouting database earn the same badges, measured against their own league.</p></div>
    ${groups.map(([g, l]) => { const ds = shown.filter(d => d.side === g); return ds.length ? `<h3 class="r-heading" style="margin-top:var(--s-5)">${l}</h3><div class="arch-grid">${ds.map(card).join("")}</div>` : ""; }).join("")}
  </section>`;
}

/* playing styles (142 roles, tested; 145 builds the site file) */
function stylesSection(R){
  const POSW = {CB:"Centre backs", FB:"Fullbacks", CM_DM:"Central midfielders", AM:"Attacking midfielders", W:"Wingers", ST:"Strikers"};
  const groups = Object.entries(R.roles).map(([pos, ds]) => { const sh = ds.filter(d => d.shown); return sh.length ? `<h3 class="r-heading" style="margin-top:var(--s-5)">${POSW[pos]}</h3>
    <dl class="rolelist">${sh.map(d => `<div><dt>${esc(d.name)}</dt><dd>${esc(d.text)}</dd></div>`).join("")}</dl>` : ""; }).join("");
  return `<section class="band mtext" id="m-styles"><div class="band-head"><h2 class="r-title">Playing styles</h2>
    <p>Badges say what a player does best by value. A playing style says how they play: where they get the ball and what they do with it, with no value or rating in it. Each style is a short list of things a player in that role does more (or less) of than others at their position: touches, progressive passes, carries, crosses, shots, headers, tackles, where on the pitch they play. The styles were written down before any were tested.</p>
    <p><b>How a player gets one.</b> Every number is taken per 90 minutes and adjusted for how much of the ball their team has (counts on the ball for their team's share, defending for the opponent's), the usual adjustment in public analytics, which comes from StatsBomb's possession-adjusted defensive numbers; then compared with other players at their position in the same season (${PP.int(R.min_minutes)}+ minutes at one club). Their score for a style is how far above or below typical they sit across its list, in standard deviations. Their style is the highest: shown when it reaches ${R.clear} and beats the next by ${R.margin}; when two are close, both are shown; when none reaches ${R.clear}, they are balanced.</p>
    <p><b>How the styles were tested.</b> Each had to be reliable within a season (one half of a player's matches agrees with the other) and repeat the next season at least twice as often as chance. Nineteen of 21 passed both; two centre-back styles (clearing and heading in their own third; stepping up to win the ball) did not repeat well enough and are not shown. A third test, whether a player keeps their style after changing clubs, had too few players to judge. A first look says styles carry over a move at about two-thirds of their usual strength, so a style is mostly the player's and partly their coach's (cutting inside, for wingers, much more the coach's). That test is fixed in advance and runs on fresh players after the 2026 season; it can take styles off the site.</p>
    <p><b>Teams.</b> Each club page shows where it sits on a scale from direct to possession, where its chances come from, and the three other clubs' seasons since 2020 it plays most like. Tactical labels (possession, direct, high press, counter-pressing, counter-attacking, low or mid block) were tested too: only possession and direct both held from one half of a season to the other and showed up in the chances a team created. They are the two ends of one scale, so the site shows the scale rather than the labels: a team's share of the passes and how far forward each completed pass goes, each against its season's league average. A high press held, but did not show up in the chances it should create; pressing high and sitting deep mostly measure how good a team is (better teams press higher), so neither is used as a label.</p>
    ${groups}
  </section>`;
}

/* the weights: rankings by ball-winning weight and the evidence on it (77_weight_sensitivity.py, rewritten for the 2026-10 release) */
function weightsSection(N){
  const R = N.rankings_2025 || [], WT = N.within_team, AB = N.abroad || {}, L = N.levels;
  const f2 = v => num(v, 2), wl = w => num(w, w % 1 ? 2 : 0);
  const rows = R.map(x => `<tr${x.published?' class="cur"':""}><td>${wl(x.w_def)}${x.published?" (as published)":""}</td><td class="n">${x.published?"–":x.spearman.toFixed(2)}</td><td class="n">${x.top20_kept} of 20</td><td class="n">${Math.round(x.bw_share*100)}%</td><td class="n">${x.top50_pos.CB}</td><td class="n">${x.top50_pos.CM_DM}</td><td class="n">${x.top50_pos.W + x.top50_pos.ST}</td></tr>`).join("");
  const POSW = {CB:"centre backs", FB:"fullbacks", CM_DM:"central midfielders", AM:"attacking midfielders", W:"wingers", ST:"strikers"};
  const bwL = L && (L.def_m2 || L.def);
  const lev = L ? Object.keys(POSW).filter(p => L.att[p] != null).map(p => `<tr><td>${POSW[p].replace(/^./, c => c.toUpperCase())}</td><td class="n">${Math.round(L.att[p]*100)}th</td><td class="n">${bwL && bwL[p] != null ? Math.round(bwL[p]*100) + "th" : "–"}</td></tr>`).join("") : "";
  const abroad = AB.status === "reported"
    ? `A second study, of lineups in eleven foreign leagues and fixed in advance, estimated ${f2(AB.estimate)} (${f2(AB.ci95[0])} to ${f2(AB.ci95[1])}); by its rule the weight is ${f2(AB.rule_A.W_DEF)}.`
    : `A second study, of lineups in eleven foreign leagues and fixed in advance, is under way to narrow it. Its rule keeps a weight of 1 unless the data pin down another value.`;
  return `<section class="band mtext" id="m-weights"><div class="band-head"><h2 class="r-title">${AB.attack ? "How much attack and ball-winning count" : "How much ball-winning counts"}</h2>
    ${AB.attack ? `<p>The model prices attack and ball-winning in goals of possession value, but nothing guarantees that a goal of each is worth a goal of match result. The weights convert them. They are estimated from a club's own lineups, which keeps team quality out: when a club fields players who rate higher, how much better do its matches go, in expected-goal difference? In MLS alone (2020–25) the answer is too uncertain to use: ball-winning ${f2(WT.ball_winning.estimate)} (95% range ${f2(WT.ball_winning.ci95[0])} to ${f2(WT.ball_winning.ci95[1])}), attack ${f2(WT.attack.estimate)} (${f2(WT.attack.ci95[0])} to ${f2(WT.attack.ci95[1])}). A second study, fixed in advance, added eleven foreign leagues, ${PP.int(AB.matches)} matches in all. Attack came out at ${f2(AB.attack.estimate)} (${f2(AB.attack.ci95[0])} to ${f2(AB.attack.ci95[1])}) and ball-winning at ${f2(AB.estimate)} (${f2(AB.ci95[0])} to ${f2(AB.ci95[1])}). The two were estimated together, and the site uses both: attack counts ${f2(N.w_off)}, ball-winning ${f2(N.w_def)}.</p>
    <p>Why ball-winning would count for more than its face value is not something the data show directly. One reading: the model credits only the moment the ball is won, and the pressure or positioning that forced the error, which event data do not record, travels with the players who win it back.</p>` : `<p>Attack counts as it is, in goals of possession value. How much ball-winning should count is harder to know. The cleanest evidence compares a club's own lineups, which keeps team quality out: there, ball-winning's weight comes out at ${f2(WT.ball_winning.estimate)}, with a 95% range from ${f2(WT.ball_winning.ci95[0])} to ${f2(WT.ball_winning.ci95[1])}, and attack's at ${f2(WT.attack.estimate)} (${f2(WT.attack.ci95[0])} to ${f2(WT.attack.ci95[1])}). That is too wide to set a weight from. ${abroad} The site counts ball-winning at ${wl(N.w_def)}.</p>`}
    <p>The table shows what the choice changes.${(lo => hi => lo && hi ? ` Ball-winning accounts for ${Math.round(lo.bw_share*100)}% of the differences between players at the same position at a weight of ${wl(lo.w_def)} and ${Math.round(hi.bw_share*100)}% at ${wl(hi.w_def)}; as it grows, centre backs move up the rankings.` : "")(R[0])(R[R.length-1])}</p></div>
    <div class="tbl-wrap"><table class="dtable" style="max-width:820px"><thead><tr><th>Ball-winning weight</th><th class="n">Rank agreement, 2025</th><th class="n">Top 20 kept</th><th class="n">Ball-winning's share of differences</th><th class="n">Centre backs in top 50</th><th class="n">Central midfielders</th><th class="n">Wingers and strikers</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="r-small">Rank agreement is the correlation between the rankings of 2025 outfield players (${PP.int(N.n_2025)} with 900+ minutes) under each weight and as published. The share is ball-winning's part of how far players' ratings per 90 differ from their position's average, 2020–26.${N.w_off === 1 ? "" : ` Attack is held at ${f2(N.w_off)} throughout.`}</p>
    ${lev ? `<h3 class="r-heading" style="margin-top:var(--s-6)">Replacement level: what the players who fill in produce</h3>
    <p>A replacement-level player is the kind a club can call on when a regular is out. We measure them directly: players under 900 minutes in a season, in their matches of 60 minutes or more (mostly starts). Against that season's regulars at the position, they sit at these percentiles (for ball-winning, by the measure above), averaged over 2020–25 and steadied toward the all-position level where data are thin. Until 8 October 2026 the 25th percentile was assumed everywhere; the real level is higher, so values above replacement are now smaller and more honest.</p>
    <div class="tbl-wrap"><table class="dtable" style="max-width:520px"><thead><tr><th>Position</th><th class="n">Attack</th><th class="n">Ball-winning</th></tr></thead><tbody>${lev}</tbody></table></div>` : ""}
  </section>`;
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
    <p class="r-small">goals: the expected goals of the next shot for a team with the ball here, counted against it when the opponent takes that shot.</p>
    <p>This zone is in the ${third}, ${Math.round(z.x*8.75)}–${Math.round((z.x+1)*8.75)} metres from the team's own goal line. From here the next action:</p>
    <div class="funnel"><div class="fn"><span>keeps the ball</span><span class="tr"><i style="width:${z.p_keep*100}%"></i></span><span class="num">${pct(z.p_keep)}</span></div>
      <div class="fn"><span>loses it</span><span class="tr"><i style="width:${z.p_lose*100}%;background:var(--flare)"></i></span><span class="num">${pct(z.p_lose)}</span></div>
      <div class="fn"><span>is a shot</span><span class="tr"><i style="width:${Math.max(0.5,z.p_shot*100)}%;background:var(--turf)"></i></span><span class="num">${pct(z.p_shot)}</span></div></div>
    <p class="r-small">${z.xg_per_shot ? `Shots from here are worth ${num(z.xg_per_shot,2)} expected goals on average. ` : ""}Outlined zones are where the ball goes next when the team keeps it; the thicker the outline, the more often. Seen ${PP.int(z.n)} times in 2020–25. Set pieces have their own states: a corner is worth ${num(G.special.corner,3)}, a penalty ${num(G.special.penalty,2)}.</p>`;
}
})();
