/* Pitch Perception: shared pitch, zone-map and possession-chain charts (homepage, player pages). */
(function(){
"use strict";
const {S, text, esc, sgn, num} = PP;
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const surname = n => { const p = String(n||"").split(" "); return p.length > 1 ? p.slice(1).join(" ") : (n||""); };
PP.surname = surname;
PP.ZMAX = 0.03;   // goals per 90 per zone at which the value scale saturates (99th percentile of 900+ minute players)

/* pitch ground, 12 x 8 zone grid and markings; attack left to right */
PP.pitchBase = (svg, W, H, grid=true) => {
  const sx = x => x/105*W, sy = y => H - y/68*H;
  S("rect",{x:0,y:0,width:W,height:H,rx:4,class:"pitch-ground"},svg);
  if(grid){ for(let i=1;i<12;i++) S("line",{x1:sx(i*8.75),y1:0,x2:sx(i*8.75),y2:H,class:"zone-line"},svg);
            for(let j=1;j<8;j++) S("line",{x1:0,y1:sy(j*8.5),x2:W,y2:sy(j*8.5),class:"zone-line"},svg); }
  return {sx, sy};
};
PP.pitchLines = (svg, sx, sy) => {
  const R = (x,y,w,h) => S("rect",{x:sx(x),y:sy(y+h),width:sx(x+w)-sx(x),height:sy(y)-sy(y+h),class:"pitch-line"},svg);
  R(0,0,105,68); S("line",{x1:sx(52.5),y1:sy(0),x2:sx(52.5),y2:sy(68),class:"pitch-line"},svg);
  S("circle",{cx:sx(52.5),cy:sy(34),r:sx(9.15)-sx(0),class:"pitch-line"},svg);
  R(0,13.84,16.5,40.32); R(88.5,13.84,16.5,40.32); R(0,24.84,5.5,18.32); R(99.5,24.84,5.5,18.32);
};

/* zone map: 96 values (goals per 90), diverging scale through --mid */
PP.zoneMap = (el, cells, opts={}) => {
  const W = Math.min(el.clientWidth, opts.maxW || 900); if(!W) return; const H = Math.round(W*68/105);
  el.innerHTML = "";
  const svg = S("svg",{width:W,height:H+18,viewBox:`0 0 ${W} ${H+18}`,role:"img","aria-label":opts.label||"Value added by pitch zone"},el);
  const {sx, sy} = PP.pitchBase(svg, W, H, false), cw = W/12, ch = H/8;
  let best = -1, bv = -Infinity;
  cells.forEach((v,z) => { if(v > bv){ bv = v; best = z; } });
  const zmax = opts.zmax || PP.ZMAX, unit = opts.unit || "goals per 90", whose = opts.whose || "his";
  cells.forEach((v,z) => {
    const ix = Math.floor(z/8), iy = z%8, x = ix*cw, y = H-(iy+1)*ch, f = PP.valueFill(v, zmax);
    S("rect",{x:x+1,y:y+1,width:cw-2,height:ch-2,fill:f,rx:1.5,"data-tip":`<b>${sgn(v,3)} ${unit}</b><br>${Math.round(ix*8.75)}–${Math.round((ix+1)*8.75)} m from ${whose} own goal line${opts.tipExtra?"<br>"+opts.tipExtra:""}`},svg);
    if(z === best && v > 0.002 && cw > 30){ text(svg, x+cw/2, y+ch/2+4, sgn(v,3), "t-axis", {"text-anchor":"middle",style:`fill:${PP.inkOn(f)};font-weight:650`}); }
  });
  PP.pitchLines(svg, sx, sy);
  text(svg, 0, H+14, "Own goal", "t-axis", {});
  text(svg, W, H+14, "Attacking", "t-axis", {"text-anchor":"end"});
};
PP.zoneLegend = (el, zmax, unit) => {
  if(!el) return;
  const steps = 41, Z = zmax || PP.ZMAX, lo = -Z, hi = Z;
  el.innerHTML = `<div class="ramp" style="height:10px">${Array.from({length:steps},(_,i)=>`<i style="background:${PP.valueFill(lo+(hi-lo)*i/(steps-1), Z)}"></i>`).join("")}</div>
    <div class="ramp-labels num"><span>${sgn(lo,2)}</span><span>0</span><span>${sgn(hi,2)} ${unit || "goals per 90"}</span></div>`;
};

/* possession chain: steps = [{key, player, action, x, y, ex, ey, vb, va, delta, goal}] */
PP.chainPitch = (el, ch, opts={}) => {
  const W = Math.min(el.clientWidth, opts.maxW || 900); if(!W) return; const H = Math.round(W*68/105);
  el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":`Pitch diagram of a ${ch.steps.length}-action possession`},el);
  const {sx, sy} = PP.pitchBase(svg, W, H, true); PP.pitchLines(svg, sx, sy);
  const segs = [], focus = opts.focus;
  ch.steps.forEach(s => {
    let ex = s.ex, ey = s.ey; if(s.goal || s.xg != null){ ex = 105; ey = 34; }
    if(ex == null || ey == null) return;
    const carry = s.action === "carry", l = S("line",{x1:sx(s.x),y1:sy(s.y),x2:sx(ex),y2:sy(ey),class:"chain"+(carry?" carry":""),"data-key":s.key},svg);
    if(focus != null && s.key !== focus) l.classList.add("dim");
    segs.push({l, len:Math.hypot(sx(ex)-sx(s.x), sy(ey)-sy(s.y))});
  });
  ch.steps.forEach((s,i) => {
    const mine = focus != null && s.key === focus, big = s.goal || i === 0 || mine;
    const n = S("circle",{cx:sx(s.x),cy:sy(s.y),r:big?(mine?6.5:6):4,class:"node","data-key":s.key},svg);
    if(focus != null && !mine) n.classList.add("dim");
    S("circle",{cx:sx(s.x),cy:sy(s.y),r:11,class:"hit","data-key":s.key,"data-tip":`<b>${i+1}. ${esc(s.player)}</b>, ${esc(s.action)}<br>${s.xg!=null?`Shot worth ${s.xg.toFixed(2)} xG`:`Possession worth ${num(s.vb,3)} before, ${num(s.va,3)} after`}<br>Changed it by ${sgn(s.delta,3)}`},svg);
  });
  const last = ch.steps[ch.steps.length-1];
  if(last && last.goal) S("rect",{x:sx(105)-5,y:sy(34)-5,width:10,height:10,fill:"var(--signal)",transform:`rotate(45 ${sx(105)} ${sy(34)})`},svg);
  const lab = (s, dy, anchor) => text(PP.svgA(svg, s.id), Math.min(W-4, Math.max(4, sx(s.x))), sy(s.y)+dy, surname(s.player), "t-lab halo-w", {"text-anchor":anchor||"middle"});
  (opts.labels || [0, ch.steps.length-1]).forEach((i,k) => { const s = ch.steps[i]; if(s) lab(s, s.y > 60 ? 20 : -12, sx(s.x) > W-60 ? "end" : sx(s.x) < 60 ? "start" : "middle"); });
  if(opts.animate && !reduced()){
    const total = segs.reduce((a,x) => a + x.len, 0) || 1; let delay = 0;
    segs.forEach(({l, len}) => { const dur = Math.max(18, 900*len/total); l.style.strokeDasharray = len; l.style.strokeDashoffset = len;
      l.animate([{strokeDashoffset:len},{strokeDashoffset:0}],{duration:dur,delay,easing:"linear",fill:"forwards"}).onfinish = () => { l.style.strokeDasharray = ""; l.style.strokeDashoffset = ""; };
      delay += dur; });
  }
};
PP.chainSteps = (el, ch, opts={}) => {
  const W = Math.min(el.clientWidth, opts.maxW || 900); if(!W) return; const H = opts.height || 190;
  el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Value each action added to the possession, with the possession's running value"},el);
  const st = ch.steps, n = st.length, m = {l:40,r:12,t:16,b:30}, iw = W-m.l-m.r, ih = H-m.t-m.b, focus = opts.focus;
  const after = st.map(s => s.xg != null ? s.xg : s.va), deltas = st.map(s => s.delta || 0);
  const top = Math.max(0.05, ...after.filter(v=>v!=null), ...deltas), bot = Math.min(0, ...deltas, ...after.filter(v=>v!=null));
  const raw = (top - bot) / 4, step = [0.01,0.02,0.05,0.1,0.2,0.25,0.5,1].find(v => v >= raw) || 1;
  const y1 = Math.ceil(top/step)*step, y0 = Math.min(0, Math.floor(bot/step)*step);
  const sy = v => m.t + ih - (v-y0)/(y1-y0)*ih, band = iw/n, bx = i => m.l + i*band, bw = Math.max(3, Math.min(20, band*0.6));
  for(let v = y0; v <= y1+1e-9; v += step){ S("line",{x1:m.l,x2:m.l+iw,y1:sy(v),y2:sy(v),class:Math.abs(v)<1e-9?"g-base":"g-line"},svg); text(svg, m.l-8, sy(v)+4, (v<-1e-9?"−":"")+Math.abs(v).toFixed(2), "t-axis", {"text-anchor":"end"}); }
  const bars = [];
  st.forEach((s,i) => {
    const d = deltas[i], x = bx(i) + band/2 - bw/2, yA = sy(Math.max(0,d)), yB = sy(Math.min(0,d)), h = Math.max(1, yB - yA);
    const b = S("rect",{x,y:d>=0?yB-h:yA,width:bw,height:h,fill:d>0?"var(--turf)":d<0?"var(--flare)":"var(--mid)","data-key":s.key},svg); bars.push(b);
    if(focus != null && s.key !== focus) b.classList.add("dim");
    S("rect",{x:bx(i),y:m.t,width:band,height:ih,class:"hit","data-key":s.key,"data-tip":`<b>${i+1}. ${esc(s.player)}</b>, ${esc(s.action)}<br>Changed the possession by ${sgn(d,3)}<br>${s.xg!=null?"Shot worth":"Possession now worth"} ${num(after[i],3)}`},svg);
  });
  let dp = `M${m.l},${sy(st[0].vb)}`; st.forEach((s,i) => { if(after[i] != null) dp += `H${bx(i)+band/2}V${sy(after[i])}`; }); dp += `H${bx(n-1)+band}`;
  S("path",{d:dp,fill:"none",stroke:"var(--signal)","stroke-width":2,"stroke-linejoin":"round"},svg);
  const lv = after[n-1];
  if(lv != null) text(svg, bx(n-1)+band/2-bw/2-6, Math.max(m.t+10, sy(lv)-8), st[n-1].xg != null ? `Shot worth ${lv.toFixed(2)}` : `Possession ends`, "t-lab halo", {"text-anchor":"end"});
  text(svg, m.l, H-8, "Action 1", "t-axis", {}); text(svg, m.l+iw, H-8, `Action ${n}${st[n-1].goal?", the goal":""}`, "t-axis", {"text-anchor":"end"});
  if(opts.annotate !== false && W >= 560){
    const bi = deltas.slice(0,-1).reduce((bi, v, i) => v > deltas[bi] ? i : bi, 0);
    if(deltas[bi] > 0.03){ const xx = bx(bi)+band/2-bw/2, ym = (sy(0)+sy(deltas[bi]))/2; text(PP.svgA(svg, st[bi].id), xx-8, ym+4, `${surname(st[bi].player)}'s ${st[bi].action}: ${sgn(deltas[bi],2)}`, "t-anno halo", {"text-anchor":"end"}); }
  }
  if(opts.animate && !reduced()) bars.forEach((b,i) => b.animate([{opacity:.12},{opacity:1}],{duration:200,delay:i*(900/n),easing:"ease-out",fill:"backwards"}));
};
PP.focusChain = (root, key) => PP.$$("[data-key]", root).forEach(e => { if(!e.classList.contains("hit")) e.classList.toggle("dim", key != null && e.dataset.key !== String(key)); });

/* a chain as exported (71 / 82) -> the chart format; labels the first, last and biggest step */
PP.chainFrom = c => {
  const st = c.steps.map(s => ({key:s.player, id:s.id, player:s.player, action:s.action, x:s.x, y:s.y, ex:s.end_x, ey:s.end_y, vb:s.v_before, va:s.v_after, xg:s.xg, delta:s.delta, goal:s.goal}));
  const big = st.slice(0,-1).reduce((bi, s, i) => (s.delta||0) > (st[bi].delta||0) ? i : bi, 0);
  return {steps: st, labels: [0, st.length-1].concat(big ? [big] : [])};
};

/* an eleven on a pitch (team of the week). xi: [{x, y, player, team, value, slot, id}], x 0 = left flank .. 1 = right,
   y 1 = own goal .. 0 = attack. Landscape (attacking right); upright below 520 px. Circle fill = value, ring = club. */
PP.drawEleven = (el, xi, opts={}) => {
  const W = Math.min(el.clientWidth, opts.maxW || 760); if(!W) return;
  const portrait = W < 520, H = portrait ? Math.round(W*105/68) : Math.round(W*68/105); el.innerHTML = "";
  const svg = S("svg",{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":opts.label || "Team of the week"},el);
  let sx, sy;
  if(portrait){
    S("rect",{x:0,y:0,width:W,height:H,rx:4,class:"pitch-ground"},svg);
    const R = (L0, W0, l, w) => S("rect",{x:W0/68*W,y:H-(L0+l)/105*H,width:w/68*W,height:l/105*H,class:"pitch-line"},svg);
    R(0,0,105,68); S("line",{x1:0,x2:W,y1:H/2,y2:H/2,class:"pitch-line"},svg); S("circle",{cx:W/2,cy:H/2,r:9.15/68*W,class:"pitch-line"},svg);
    R(0,13.84,16.5,40.32); R(88.5,13.84,16.5,40.32); R(0,24.84,5.5,18.32); R(99.5,24.84,5.5,18.32);
  } else { const b = PP.pitchBase(svg, W, H, false); PP.pitchLines(svg, b.sx, b.sy); sx = b.sx; sy = b.sy; }
  const at = p => { const L = 6 + (1 - p.y) * 88; return portrait ? {cx: (6 + p.x * 56)/68*W, cy: H - L/105*H} : {cx: sx(L), cy: sy(6 + (1 - p.x) * 56)}; };
  const maxV = opts.maxV || 1;
  xi.forEach(p => { const c = at(p), v = p.value || 0, rr = Math.max(13, Math.min(W/(portrait?14:22), 13 + Math.abs(v) / maxV * 8)), f = PP.valueFill(v, maxV);
    // each player opens his page, and his club's crest sits on the ring (owner, 2026-10-15)
    const g = p.id != null ? S("a",{href:`#player-${p.id}`,class:"xi-link","aria-label":`${p.player}, ${PP.short(p.team)}: open his page`},svg) : svg;
    S("circle",{cx:c.cx,cy:c.cy,r:rr+3,fill:PP.kit(p.team),opacity:.9},g);
    S("circle",{cx:c.cx,cy:c.cy,r:rr,fill:f,stroke:"var(--paper)","stroke-width":1.5,"data-tip":opts.tip ? opts.tip(p) : `<b>${PP.esc(p.player)}</b>, ${PP.esc(PP.short(p.team))}<br>${PP.sgn(v,2)}`},g);
    text(g, c.cx, c.cy+4, PP.sgn(v, 2), "t-axis", {"text-anchor":"middle",style:`fill:${PP.inkOn(f)};font-weight:650;font-size:${portrait?10:11}px;pointer-events:none`});
    PP.svgCrest(g, p.team, c.cx+rr*0.7-8, c.cy-rr*0.7-8, 16);
    text(g, c.cx, c.cy+rr+15, PP.surname(p.player), "t-lab halo-w", {"text-anchor":"middle"});
  });
};
})();
