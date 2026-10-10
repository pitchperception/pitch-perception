/* Pitch Perception: shared helpers, routing, search, theme. Pages register renderers on PP.pages. */
(function(){
"use strict";
const PP = window.PP = {pages:{}, data:{}};

/* ---------- DOM / format ---------- */
const $ = PP.$ = (s, r=document) => r.querySelector(s);
const $$ = PP.$$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const NS = "http://www.w3.org/2000/svg";
PP.S = function(tag, attrs, parent){const e=document.createElementNS(NS,tag); if(attrs) for(const k in attrs) if(attrs[k]!=null) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e;};
PP.text = function(parent, x, y, txt, cls, extra){const t=PP.S("text",Object.assign({x,y,class:cls},extra||{}),parent); t.textContent=txt; return t;};
PP.tok = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
PP.esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const MINUS = "−";
PP.sgn = (v,d=2) => v==null||!isFinite(v) ? "–" : Math.abs(v) < 0.5*Math.pow(10,-d) ? (0).toFixed(d) : (v>0?"+":MINUS)+Math.abs(v).toFixed(d);
PP.num = (v,d=2) => v==null||!isFinite(v) ? "–" : (v<0 && Math.abs(v) >= 0.5*Math.pow(10,-d) ? MINUS : "")+Math.abs(v).toFixed(d);
PP.int = v => Math.round(v).toLocaleString("en-US");
PP.pct = p => p==null ? "–" : p>=0.995 ? "over 99%" : p<0.005 ? "under 1%" : Math.round(p*100)+"%";
PP.pctShort = p => p==null ? "–" : p>=0.995 ? ">99%" : p<0.005 ? "<1%" : Math.round(p*100)+"%";
PP.pp = d => (d>0?"+":d<0?MINUS:"")+Math.abs(Math.round(d*100)); // percentage points
PP.ord = n => {const s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]);};
PP.pctile = p => p>=0.995 ? "top" : p<0.005 ? "bottom" : PP.ord(Math.round(p*100));
PP.WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];
PP.ordWord = n => (["","first","second","third","fourth","fifth","sixth","seventh","eighth","ninth","tenth","eleventh","twelfth"][n]) || PP.ord(n);
PP.money = v => v==null ? "–" : v>=1e6 ? "$"+(v/1e6).toFixed(v>=1e7?1:2).replace(/\.?0+$/,"")+"m" : "$"+Math.round(v).toLocaleString("en-US");
PP.dateLong = iso => new Date(iso+"T12:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"long",timeZone:"UTC"});
PP.kick = iso => { // "2026-10-10T17:00Z" -> {day:"Saturday 10 October", time:"1:00 pm ET"}
  const d=new Date(iso.replace("Z",":00Z")); if(isNaN(d)) return null;
  const day=d.toLocaleDateString("en-GB",{weekday:"long",month:"long",day:"numeric",timeZone:"America/New_York"}).replace(",", "");
  const time=d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).replace(" AM"," am").replace(" PM"," pm");
  return {day, time:time+" ET", date:d};
};
PP.POS = {GK:"Goalkeeper",CB:"Centre back",FB:"Fullback",CM_DM:"Central midfielder",AM:"Attacking midfielder",W:"Winger",ST:"Striker"};
PP.POSPL = {GK:"goalkeepers",CB:"centre backs",FB:"fullbacks",CM_DM:"central midfielders",AM:"attacking midfielders",W:"wingers",ST:"strikers"};
PP.SLOT = {"DP":"Designated Player","U22":"U22 Initiative","TAM/GAM":"TAM / GAM","Senior":"Senior roster","Supplemental":"Supplemental roster","Homegrown":"Homegrown"};

/* ---------- clubs ---------- */
PP.CLUB = {"Atlanta United":["ATL","#80000a"],"Austin FC":["ATX","#00b140"],"Charlotte FC":["CLT","#1a85c8"],"Chicago Fire FC":["CHI","#d52b1e"],"FC Cincinnati":["CIN","#f05323"],"Colorado Rapids":["COL","#960a2c"],"Columbus Crew":["CLB","#fedd00"],"FC Dallas":["DAL","#e81f3e"],"DC United":["DC","#d61018"],"Houston Dynamo FC":["HOU","#ff6b00"],"Inter Miami CF":["MIA","#f7b5cd"],"LA Galaxy":["LA","#1a4a9c"],"Los Angeles FC":["LAFC","#c39e6d"],"Minnesota United":["MIN","#8cd2f4"],"CF Montreal":["MTL","#0033a1"],"Nashville SC":["NSH","#ece83a"],"New England Revolution":["NE","#c63323"],"New York City FC":["NYC","#6cace4"],"Red Bull New York":["RBNY","#ed1e36"],"Orlando City":["ORL","#633492"],"Philadelphia Union":["PHI","#b19b69"],"Portland Timbers":["POR","#2b7a3b"],"Real Salt Lake":["RSL","#b30838"],"San Diego FC":["SD","#00a3e0"],"San Jose Earthquakes":["SJ","#0067b1"],"Seattle Sounders FC":["SEA","#5d9741"],"Sporting Kansas City":["SKC","#93b1d7"],"St. Louis City":["STL","#dd004a"],"Toronto FC":["TOR","#b81137"],"Vancouver Whitecaps":["VAN","#9dc2ea"]};
PP.SHORT = {"Atlanta United":"Atlanta","Austin FC":"Austin","Charlotte FC":"Charlotte","Chicago Fire FC":"Chicago","FC Cincinnati":"Cincinnati","Colorado Rapids":"Colorado","Columbus Crew":"Columbus","FC Dallas":"Dallas","DC United":"D.C. United","Houston Dynamo FC":"Houston","Inter Miami CF":"Inter Miami","LA Galaxy":"LA Galaxy","Los Angeles FC":"LAFC","Minnesota United":"Minnesota","CF Montreal":"Montréal","Nashville SC":"Nashville","New England Revolution":"New England","New York City FC":"NYCFC","Red Bull New York":"Red Bulls","Orlando City":"Orlando","Philadelphia Union":"Philadelphia","Portland Timbers":"Portland","Real Salt Lake":"Real Salt Lake","San Diego FC":"San Diego","San Jose Earthquakes":"San Jose","Seattle Sounders FC":"Seattle","Sporting Kansas City":"Sporting KC","St. Louis City":"St. Louis","Toronto FC":"Toronto","Vancouver Whitecaps":"Vancouver"};
PP.FULL = {"CF Montreal":"CF Montréal"};
PP.short = t => PP.SHORT[t] || t;
PP.full = t => PP.FULL[t] || t;
PP.slug = t => PP.short(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
PP.teamBySlug = s => Object.keys(PP.CLUB).find(t => PP.slug(t)===s);

/* colour maths (OKLab), kit-safe club colours per theme */
const hexRgb = h => {h=h.replace("#",""); if(h.length===3) h=h.split("").map(c=>c+c).join(""); return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255);};
const s2l = c => c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4);
const l2s = c => {c=Math.max(0,Math.min(1,c)); return c<=0.0031308 ? 12.92*c : 1.055*Math.pow(c,1/2.4)-0.055;};
function toLab(h){const [r,g,b]=hexRgb(h).map(s2l); let l=0.4122214708*r+0.5363325363*g+0.0514459929*b, m=0.2119034982*r+0.6806995451*g+0.1073969566*b, s=0.0883024619*r+0.2817188376*g+0.6299787005*b; l=Math.cbrt(l); m=Math.cbrt(m); s=Math.cbrt(s); return [0.2104542553*l+0.7936177850*m-0.0040720468*s, 1.9779984951*l-2.4285922050*m+0.4505937099*s, 0.0259040371*l+0.7827717662*m-0.8086757660*s];}
function fromLab([L,a,b]){const l=Math.pow(L+0.3963377774*a+0.2158037573*b,3), m=Math.pow(L-0.1055613458*a-0.0638541728*b,3), s=Math.pow(L-0.0894841775*a-1.2914855480*b,3); const r=4.0767416621*l-3.3077115913*m+0.2309699292*s, g=-1.2684380046*l+2.6097574011*m-0.3413193965*s, bb=-0.0041960863*l-0.7034186147*m+1.7076147010*s; return "#"+[r,g,bb].map(x=>Math.round(l2s(x)*255).toString(16).padStart(2,"0")).join("");}
PP.mix = (h1,h2,t) => {const a=toLab(h1), b=toLab(h2); return fromLab(a.map((v,i)=>v+(b[i]-v)*t));};
const lum = h => {const [r,g,b]=hexRgb(h).map(s2l); return 0.2126*r+0.7152*g+0.0722*b;};
PP.contrast = (a,b) => {const x=lum(a), y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
PP.inkOn = fill => {const a=PP.tok("--ink"), b=PP.tok("--paper"); return PP.contrast(a,fill)>=PP.contrast(b,fill)?a:b;};
const kitCache = {};
PP.kit = team => {
  const base = (PP.CLUB[team]||["","#8792A8"])[1], ground = PP.tok("--paper"), key = team+ground;
  if(kitCache[key]) return kitCache[key];
  const dark = lum(ground) < 0.2; let [L,a,b] = toLab(base), x = base, n = 0;
  while(PP.contrast(x, ground) < 3 && n++ < 80){ L += dark ? 0.01 : -0.01; x = fromLab([L,a,b]); }
  return kitCache[key] = x;
};
PP.labDist = (a, b) => { const x = toLab(a), y = toLab(b); return Math.hypot(x[0]-y[0], x[1]-y[1], x[2]-y[2]); };
/* head-to-head colours: home keeps its kit; an away kit too close to it is lightened toward the ground */
PP.pairKit = (home, away) => { const h = PP.kit(home), a = PP.kit(away); return PP.labDist(h, a) < 0.12 ? [h, PP.mix(a, PP.tok("--paper"), 0.5), true] : [h, a, false]; };
PP.chip = team => `<i class="chip" data-team="${PP.esc(team)}" style="--c:${PP.kit(team)}" aria-hidden="true"></i>`;
PP.clubTag = (team, full) => `<span class="club">${PP.chip(team)}${PP.esc(full ? PP.full(team) : PP.short(team))}</span>`;
PP.valueFill = (v, max) => PP.mix(PP.tok("--mid"), v>=0 ? PP.tok("--turf-4") : PP.tok("--flare-4"), Math.min(1, Math.sqrt(Math.abs(v)/max)));

/* interval bar (value above replacement, 90% range) on a shared domain */
PP.ibar = (v, lo, hi, d0, d1) => {
  const p = x => (Math.max(d0, Math.min(d1, x)) - d0) / (d1 - d0) * 100, z = p(0);
  const neg = v < 0, w = (lo!=null && hi!=null) ? `<span class="w" style="left:${p(lo)}%;width:${p(hi)-p(lo)}%"></span><span class="wc" style="left:${p(lo)}%"></span><span class="wc" style="left:calc(${p(hi)}% - 2px)"></span>` : "";
  return `<span class="ibar" aria-hidden="true"><span class="z" style="left:${z}%"></span><span class="b${neg?" neg":""}" style="left:${neg?p(v):z}%;width:${Math.abs(p(v)-z)}%"></span>${w}</span>`;
};

/* ---------- tooltip ---------- */
const tip = document.createElement("div"); tip.className = "tip"; tip.setAttribute("role","tooltip");
document.addEventListener("DOMContentLoaded", () => document.body.appendChild(tip));
PP.showTip = (html, x, y) => {tip.innerHTML = html; tip.classList.add("on"); const r = tip.getBoundingClientRect(); let L = x+14, T = y+14; if(L+r.width > innerWidth-8) L = x-r.width-14; if(T+r.height > innerHeight-8) T = y-r.height-14; tip.style.left = Math.max(8,L)+"px"; tip.style.top = Math.max(8,T)+"px";};
PP.hideTip = () => tip.classList.remove("on");
PP.bindTips = root => {
  if(!root || root.dataset.tips) return; root.dataset.tips = "1";
  root.addEventListener("pointermove", e => {const t = e.target.closest("[data-tip]"); if(t && root.contains(t)) PP.showTip(t.getAttribute("data-tip"), e.clientX, e.clientY); else PP.hideTip();});
  root.addEventListener("pointerleave", PP.hideTip);
  root.addEventListener("pointerdown", e => {const t = e.target.closest("[data-tip]"); if(t && root.contains(t)) PP.showTip(t.getAttribute("data-tip"), e.clientX, e.clientY);});
};
addEventListener("scroll", PP.hideTip, {passive:true});

/* ---------- disclosure ---------- */
PP.bindDisclosures = root => $$("[data-disc]", root).forEach(b => b.addEventListener("click", () => {
  const p = document.getElementById(b.getAttribute("aria-controls")); const o = b.getAttribute("aria-expanded") !== "true";
  b.setAttribute("aria-expanded", String(o)); p.classList.toggle("open", o); p.setAttribute("aria-hidden", String(!o));
  if(o && p.dataset.onopen && PP[p.dataset.onopen]) PP[p.dataset.onopen](p);
}));

document.addEventListener("click", e => { const r = e.target.closest("[data-href]"); if(r && !e.target.closest("a,button")) location.hash = r.dataset.href; });

/* ---------- logo ---------- */
PP.drawLogo = svg => {   /* the 12 x 8 grid mark; since 2026-10-08 the masthead uses the owner's logo image instead */
  if(!svg || svg.tagName.toLowerCase() !== "svg") return;
  svg.innerHTML = "";
  for(let i=0;i<12;i++) for(let j=0;j<8;j++) PP.S("rect",{x:1+i*2.4,y:1+j*2.4,width:1.1,height:1.1,fill:"var(--on-navy-2)",opacity:.55},svg);
  PP.S("polyline",{points:"3,13.5 9,11 14,15 20,7 26.5,9.5",fill:"none",stroke:"var(--sig-on-navy)","stroke-width":1.8,"stroke-linejoin":"round","stroke-linecap":"round"},svg);
  PP.S("rect",{x:24.5,y:7.5,width:4,height:4,fill:"var(--on-navy)",transform:"rotate(45 26.5 9.5)"},svg);
};

/* ---------- theme ---------- */
const root = document.documentElement;
PP.setTheme = (t, save) => {
  if(t === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
  $$(".theme-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === t)));
  if(save){ try{ localStorage.setItem("pp-theme", t); }catch(e){} }
  PP.redraw();
};
try{ const t = localStorage.getItem("pp-theme"); if(t && t !== "system") root.setAttribute("data-theme", t); }catch(e){}
try{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => PP.redraw()); }catch(e){}

/* ---------- charts that redraw on resize / theme ---------- */
const drawers = new Map(); let raf = 0;
PP.chart = (el, fn) => { if(!el) return; drawers.set(el, fn); fn(el); ro.observe(el); };
const ro = new ResizeObserver(entries => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => entries.forEach(e => { const fn = drawers.get(e.target); if(fn && e.target.isConnected && e.target.dataset.w != String(e.target.clientWidth)){ e.target.dataset.w = e.target.clientWidth; fn(e.target); } })); });
PP.redraw = () => { drawers.forEach((fn, el) => { if(el.isConnected) fn(el); }); $$("[data-kitchip]").forEach(e => e.style.setProperty("--c", PP.kit(e.dataset.kitchip))); PP.repaintChips(); };
PP.repaintChips = () => { $$(".chip[data-team]").forEach(e => e.style.setProperty("--c", PP.kit(e.dataset.team))); $$("[data-kitbg]").forEach(e => e.style.background = PP.kit(e.dataset.kitbg)); };

/* ---------- archetype badges (data/archetypes.json from 80_archetypes.py; symbols on a 24-unit grid) ---------- */
PP.BADGE_ICONS = {"distributor": "<circle cx=\"5\" cy=\"12\" r=\"2.3\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M8.5 10.5L19 5M15.81 4.76L19 5L17.38 7.76\"/><path d=\"M8.5 12L20 12M17.29 10.3L20 12L17.29 13.7\"/><path d=\"M8.5 13.5L19 19M17.38 16.24L19 19L15.81 19.24\"/>", "ball_playing_cb": "<path d=\"M3 20H21\" opacity=\".45\"/><circle cx=\"5\" cy=\"20\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"20\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"19\" cy=\"20\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M12 17L19 5M16.17 6.49L19 5L19.1 8.2\"/>", "overlapper": "<path d=\"M4 3V21\" opacity=\".45\"/><path d=\"M9 21V11Q9 5 16 5\"/><path d=\"M15.79 3.3L18.5 5L15.79 6.7\"/><path d=\"M16 5H18.5\"/>", "carrier": "<circle cx=\"9\" cy=\"12\" r=\"3.2\"/><path d=\"M2 9H4.5M1.5 12H4.5M2 15H4.5\"/><path d=\"M13.5 12L21.5 12M18.79 10.3L21.5 12L18.79 13.7\"/>", "poacher": "<path d=\"M4.5 10V4H19.5V10\"/><path d=\"M4.5 4L7 7H17L19.5 4\" opacity=\".45\"/><circle cx=\"12\" cy=\"19\" r=\"2.2\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M12 15.8V9.5\"/><path d=\"M9.6 11.8L12 9.3L14.4 11.8\"/>", "space_finder": "<rect x=\"10.5\" y=\"3\" width=\"10.5\" height=\"10.5\" rx=\"1.5\" stroke-dasharray=\"2.2 2\"/><circle cx=\"5\" cy=\"19\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M7 17L14.5 9.5M11.38 10.22L14.5 9.5L13.78 12.62\"/>", "dead_ball": "<path d=\"M7 21V3.5\"/><path d=\"M7 3.5L17 7L7 10.5Z\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M3 21H21\" opacity=\".45\"/><path d=\"M11.5 21A4.5 4.5 0 0 0 7 16.5\"/>", "press_resistant": "<rect x=\"5.5\" y=\"10.5\" width=\"13\" height=\"10\" rx=\"2\"/><path d=\"M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3\"/><circle cx=\"12\" cy=\"15.5\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/>", "no_nonsense_cb": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"1\"/><path d=\"M3 9.7H21M3 14.3H21M12 5V9.7M7.5 9.7V14.3M16.5 9.7V14.3M12 14.3V19\"/>", "last_line": "<path d=\"M4 21V15H20V21\" opacity=\".45\"/><path d=\"M12 18C12 11 14 7 19 4.5\"/><path d=\"M15.81 4.23L19 4.5L17.36 7.25\"/>", "ball_winner": "<circle cx=\"12\" cy=\"15\" r=\"2.8\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M3 20L8.3 16.4M5.1 16.52L8.3 16.4L7.01 19.33\"/><path d=\"M21 20L15.7 16.4M16.99 19.33L15.7 16.4L18.9 16.52\"/><path d=\"M12 4.5V8M7.2 6.3L8.9 9M16.8 6.3L15.1 9\"/>", "high_presser": "<path d=\"M13.5 2.5L5.5 13.5H11.5L9.5 21.5L18.5 9.5H12.5L13.5 2.5Z\"/>", "box_to_box": "<path d=\"M7 2.5V4.5H17V2.5M7 21.5V19.5H17V21.5\"/><path d=\"M12 7V17\"/><path d=\"M10.52 9.37L12 7L13.48 9.37\"/><path d=\"M13.48 14.63L12 17L10.52 14.63\"/>", "engine": "<circle cx=\"12\" cy=\"12\" r=\"5.6\"/><circle cx=\"12\" cy=\"12\" r=\"2\" /><path d=\"M18.60 12.00L21.00 12.00\"/><path d=\"M16.67 16.67L18.36 18.36\"/><path d=\"M12.00 18.60L12.00 21.00\"/><path d=\"M7.33 16.67L5.64 18.36\"/><path d=\"M5.40 12.00L3.00 12.00\"/><path d=\"M7.33 7.33L5.64 5.64\"/><path d=\"M12.00 5.40L12.00 3.00\"/><path d=\"M16.67 7.33L18.36 5.64\"/>", "shot_stopper": "<path d=\"M8 21V14L5.6 9.6A1.4 1.4 0 0 1 8.1 8.3L9.5 11V4.6a1.4 1.4 0 0 1 2.8 0V10.5V3.6a1.4 1.4 0 0 1 2.8 0V10.5V4.8a1.4 1.4 0 0 1 2.8 0V15c0 3.6-2.4 6-5.6 6Z\"/>", "sweeper_keeper": "<path d=\"M4 21V17H20V21\" opacity=\".45\"/><circle cx=\"12\" cy=\"19\" r=\"1.7\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M12 15.5V5\"/><path d=\"M9.3 7.4L12 4.5L14.7 7.4\"/>", "playmaking_keeper": "<circle cx=\"5\" cy=\"19\" r=\"2\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M6.5 17.2Q9 6 18 5\" stroke-dasharray=\"2.2 2\"/><circle cx=\"19.5\" cy=\"5\" r=\"2.2\"/>", "goal_threat": "<circle cx=\"12\" cy=\"12\" r=\"8.5\"/><circle cx=\"12\" cy=\"12\" r=\"4.6\"/><circle cx=\"12\" cy=\"12\" r=\"1.6\" fill=\"currentColor\" stroke=\"none\"/>"};
PP.badgeSvg = (k, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PP.BADGE_ICONS[k] || ""}</svg>`;
let archP = null;
PP.loadArch = () => archP || (archP = fetch("data/archetypes.json").then(r => r.ok ? r.json() : null).catch(() => null)
  .then(d => { if(d) d.byKey = Object.fromEntries(d.defs.map(x => [x.key, x])); PP.data.arch = d; return d; }));
PP.badgesFor = (id, year, team) => { const A = PP.data.arch; return A ? (A.badges[`${id}|${year}|${team}`] || []) : []; };
PP.badgeTip = (k, pos, pct, year) => { const A = PP.data.arch, d = A && A.byKey[k]; if(!d) return "";
  const txt = d.text.replace("{pos}", A.pos_plural[pos] || "players at the position");
  return `<b>${PP.esc(d.name)}</b><br>${PP.esc(txt)}${pct != null ? `<br>${PP.pctile(pct)} percentile in ${year}.` : ""}<br>Repeats the next season ${Math.round(d.repeat*100)}% of the time (by chance ${Math.round(d.base*100)}%).`; };
PP.badgeChips = (list, pos, year) => list.length ? `<div class="bdgs" aria-label="Archetypes">${list.map(([k, p]) => { const d = PP.data.arch.byKey[k]; return d ? `<a class="bdg" href="#method-archetypes" data-tip="${PP.esc(PP.badgeTip(k, pos, p, year))}"><span class="bdg-roundel">${PP.badgeSvg(k, 17)}</span>${PP.esc(d.name)}</a>` : ""; }).join("")}</div>` : "";
PP.badgeMini = list => list.length ? `<span class="bdg-row">${list.map(([k]) => { const d = PP.data.arch && PP.data.arch.byKey[k]; return d ? `<span class="bdg-mini" title="${PP.esc(d.name)}" role="img" aria-label="${PP.esc(d.name)}">${PP.badgeSvg(k, 12)}</span>` : ""; }).join("")}</span>` : "";

/* ---------- Transfermarkt in the scouting hub (62_tm_market.py): value bands, contracts, MLS-move likelihood ---------- */
let mkP = null;
/* official MLS headshots and club crests as data URIs (build_images.py; credited in the footer). Crests in one
   file; headshots in shards by id % 64, so a player page fetches about a dozen. Missing files just mean no image. */
let imgP = null; const photoP = {};
PP.loadImages = () => imgP || (imgP = fetch("data/images.json").then(r => r.ok ? r.json() : null).catch(() => null).then(d => {
  PP.data.images = d || {crests:{}, photo_shards:0};
  const c = document.getElementById("imgcredit"); if(c && d && d.credit) c.textContent = d.credit + ".";    // follows the headshot switch
  return PP.data.images; }));
PP.loadPhoto = async id => { const n = (await PP.loadImages()).photo_shards; if(!n) return null;      // 0 = headshots switched off
  const u = `data/photos/h${String(id % n).padStart(2,"0")}.json`;
  if(!photoP[u]) photoP[u] = fetch(u).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return (await photoP[u])[String(id)] || null; };
PP.headshot = (src, team, size) => src ? `<span class="hshot" style="--c:${PP.kit(team)};width:${size}px;height:${size}px"><img src="${src}" alt="" decoding="async"></span>` : "";
PP.crestImg = (team, size) => { const u = PP.data.images && PP.data.images.crests[team]; return u ? `<img class="crest" src="${u}" alt="" width="${size}" height="${size}">` : ""; };
PP.loadMarket = () => mkP || (mkP = fetch("data/scouts/market.json").then(r => r.ok ? r.json() : null).catch(() => null).then(d => { d = d && !d.pending ? d : null; PP.data.market = d; return d; }));
PP.contractText = c => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(c || "").trim()); return m ? new Date(Date.UTC(+m[3], +m[2]-1, +m[1])).toLocaleDateString("en-GB", {month:"long", year:"numeric", timeZone:"UTC"}) : (c && c !== "-" ? String(c) : null); };
PP.contractEnd = c => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(c || "").trim()); return m ? Date.UTC(+m[3], +m[2]-1, +m[1]) : null; };
PP.moveWords = x => x == null ? null : x >= 3 ? "Much more likely than most" : x >= 1.5 ? "More likely than most" : x >= 0.67 ? "About as likely as most" : "Less likely than most";

/* ---------- routing ---------- */
const SECTIONS = [["today","Today"],["players","Players"],["teams","Teams"],["race","Playoff race"],["matches","Matches"],["week","Weekly"],["recruiting","Recruiting"],["method","Method"]];
const TABS = [["today","Today"],["players","Players"],["teams","Teams"],["race","Race"],["more","More"]];
PP.route = () => {
  const h = (location.hash || "#today").slice(1);
  let section = h.split("-")[0];
  if(section === "player") section = "players";
  if(section === "team" || section === "manager" || section === "managers") section = "teams";
  if(section === "match") section = "matches";
  if(section === "scout") section = "recruiting";
  if(!PP.pages[section] && !PP.pages[h.split("-")[0]]) section = "today";
  $$(".mnav a, .tabbar a").forEach(a => { if(a.dataset.s === section || (a.dataset.s === "more" && ["matches","week","recruiting","method","more"].includes(section))) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current"); });
  drawers.clear();
  const main = $("#main"); main.innerHTML = "";
  const page = PP.pages[h.split("-")[0]] || PP.pages[section];
  page(main, h);
  document.title = (section === "today" ? "Pitch Perception" : (SECTIONS.find(s=>s[0]===section)||["","Pitch Perception"])[1] + " | Pitch Perception");
};
addEventListener("hashchange", () => { PP.route(); window.scrollTo(0,0); });

/* ---------- contact, corrections, rights holders, privacy (owner, 2026-10-09) ---------- */
PP.CONTACT = {email: "MLSPitchPerception@gmail.com", x: "MLSPerception"};
PP.pages.contact = main => {
  const C = PP.CONTACT;
  main.innerHTML = `<div class="wrap"><section class="pid"><h1 class="r-name">Contact</h1>
    <p class="r-note standfirst">Pitch Perception is an independent, non-commercial MLS project. It is not affiliated with or endorsed by Major League Soccer, its clubs or its data providers.</p></section>
  <section class="band mtext"><div class="band-head">
    <h2 class="r-title">Get in touch</h2>
    <p>Email <a href="mailto:${C.email}">${C.email}</a> or find the project on X at <a href="https://x.com/${C.x}" target="_blank" rel="noopener">@${C.x}</a>.</p>
    <h2 class="r-title">Corrections</h2>
    <p>If a number looks wrong, email the page's link and what you expected. Every figure on the site is checked against the model's own records each time the site is built, so a mistake is most likely in the data or the model, and it will be looked into and fixed openly.</p>
    <h2 class="r-title">Rights holders</h2>
    <p>Player photos and club crests are shown to identify players and clubs. If you hold rights to anything on this site and want it removed, email and it will be taken down promptly.</p>
    <h2 class="r-title">Privacy</h2>
    <p>The site has no accounts, no advertising and no cookies. Visits are counted with Cloudflare Web Analytics and GoatCounter, which record page views in aggregate (the page, the referring site, country, and browser and device type) without cookies, without storing IP addresses and without identifying or following individual visitors. Your choice of Paper or Night theme is saved in your own browser only. The site is hosted on GitHub Pages, whose servers, like any web host's, see visitors' IP addresses to deliver pages. Nothing is sold or shared. Questions: <a href="mailto:${C.email}">${C.email}</a>.</p>
  </div></section></div>`;
};
PP.pages.more = main => { main.innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-name">More</h1><nav class="settled" style="font-size:var(--t-17);gap:var(--s-3)">${SECTIONS.slice(4).concat([["contact","Contact"]]).map(([k,l])=>`<a href="#${k}">${l}</a>`).join("")}</nav></section></div>`; };
PP.pages.player = (main, h) => {
  const id = +h.split("-")[1], p = (PP.data.index || []).find(r => r[0] === id);
  if(!p){ PP.pages.players(main); return; }
  const [ , name, team, pos, mins, rating] = p;
  main.innerHTML = `<div class="wrap"><section class="holding">
    <div class="r-label">${PP.clubTag(team, true)}</div><h1 class="r-name">${PP.esc(name)}</h1>
    <dl class="facts"><div><dt>Position</dt><dd>${PP.POS[pos]||pos}</dd></div><div><dt>Minutes, 2026</dt><dd class="num">${PP.int(mins)}</dd></div>
    ${pos!=="GK"?`<div><dt>Value above replacement, 2026</dt><dd class="num">${PP.sgn(rating)} goals</dd></div>`:""}</dl>
    ${holdingNote("his full page, with the skills breakdown and every season,", "Stage 4")}</section></div>`;
};
PP.pages.team = (main, h) => {
  const team = PP.teamBySlug(h.slice(5)); if(!team){ PP.pages.teams(main); return; }
  const r = ((PP.data.home||{}).race||{teams:[]}).teams.find(t => t.team === team);
  main.innerHTML = `<div class="wrap"><section class="holding">
    <div class="r-label">${PP.clubTag(team)}${r?` <span style="margin-left:8px">${r.conference}ern Conference</span>`:""}</div><h1 class="r-name">${PP.esc(PP.full(team))}</h1>
    ${r?`<dl class="facts"><div><dt>Points</dt><dd class="num">${r.points} from ${r.played}</dd></div><div><dt>Chance of the playoffs</dt><dd>${PP.pct(r.p_playoffs)}</dd></div><div><dt>Chance of MLS Cup</dt><dd>${PP.pct(r.p_champion)}</dd></div></dl>`:""}
    ${holdingNote("the team's page, roster and contract types", "Stage 5")}</section></div>`;
};

/* ---------- search ---------- */
PP.initSearch = () => {
  const input = $("#q"), box = $("#qres"), mast = $(".mast"); let items = [], active = -1;
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const render = () => {
    const q = norm(input.value.trim());
    if(!q){ box.hidden = true; return; }
    const teams = Object.keys(PP.CLUB).filter(t => norm(t).includes(q) || norm(PP.short(t)).includes(q)).slice(0,3).map(t => ({href:"#team-"+PP.slug(t), html:`${PP.chip(t)}<span class="nm">${PP.esc(PP.full(t))}</span><span class="meta">Team</span>`}));
    const cur = (PP.data.home || {}).season || 2026;
    const players = (PP.data.index || []).filter(r => r[1] && norm(r[1]).includes(q)).sort((a,b) => (norm(a[1]).startsWith(q)?0:1)-(norm(b[1]).startsWith(q)?0:1) || b[4]-a[4] || b[6]-a[6]).slice(0, 8-teams.length)
      .map(r => ({href:"#player-"+r[0], html:`<span class="nm">${PP.esc(r[1])}</span><span class="meta">${PP.chip(r[2])}${PP.esc(PP.short(r[2]))}, ${(PP.POS[r[3]]||r[3]||"player").toLowerCase()}${r[4] < cur ? `, ${r[4]}` : ""}</span>`}));
    const room = 8 - teams.length - players.length;
    const abroad = room > 0 ? ((PP.data.scouts || {}).rows || []).filter(r => r[1] && norm(r[1]).includes(q)).sort((a,b) => (norm(a[1]).startsWith(q)?0:1)-(norm(b[1]).startsWith(q)?0:1) || (b[5]||0)-(a[5]||0)).slice(0, room)
      .map(r => ({href:"#scout-"+r[0], html:`<span class="nm">${PP.esc(r[1])}</span><span class="meta">${PP.esc(r[2])}, ${PP.esc(r[3])}, scouting</span>`})) : [];
    items = teams.concat(players, abroad); active = items.length ? 0 : -1;
    box.innerHTML = items.length ? items.map((it,i) => `<a href="${it.href}" class="${i===active?"active":""}" role="option">${it.html}</a>`).join("") : `<div class="empty">No player or team matches “${PP.esc(input.value.trim())}”.</div>`;
    box.hidden = false;
  };
  const go = () => { if(active >= 0){ location.hash = items[active].href; close(); } };
  const close = () => { box.hidden = true; input.value = ""; mast.classList.remove("searching"); input.blur(); };
  input.addEventListener("input", render);
  input.addEventListener("keydown", e => {
    if(e.key === "ArrowDown"){ active = Math.min(items.length-1, active+1); e.preventDefault(); }
    else if(e.key === "ArrowUp"){ active = Math.max(0, active-1); e.preventDefault(); }
    else if(e.key === "Enter"){ go(); return; }
    else if(e.key === "Escape"){ close(); return; }
    else return;
    $$("a", box).forEach((a,i) => a.classList.toggle("active", i === active));
  });
  box.addEventListener("click", e => { if(e.target.closest("a")) setTimeout(close, 0); });
  document.addEventListener("click", e => { if(!e.target.closest(".msearch") && !e.target.closest(".sbtn")) { box.hidden = true; mast.classList.remove("searching"); } });
  document.addEventListener("keydown", e => { if(e.key === "/" && document.activeElement !== input && !/input|textarea/i.test(document.activeElement.tagName)){ e.preventDefault(); mast.classList.add("searching"); input.focus(); } });
  $(".sbtn").addEventListener("click", () => { mast.classList.toggle("searching"); if(mast.classList.contains("searching")) input.focus(); });
};

/* ---------- boot ---------- */
PP.boot = async () => {
  PP.loadImages();                                   // crests + headshot setting (also sets the footer image credit)
  PP.drawLogo($("#logo"));
  addEventListener("scroll", () => $(".mast").classList.toggle("scrolled", scrollY > 8), {passive:true});
  $$(".theme-seg button").forEach(b => b.addEventListener("click", () => PP.setTheme(b.dataset.t, true)));
  let saved = "system"; try{ saved = localStorage.getItem("pp-theme") || "system"; }catch(e){}
  $$(".theme-seg button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.t === saved)));
  try{
    const r = await fetch("data/home.json"); if(!r.ok) throw new Error(r.status);
    PP.data.home = await r.json();
    try{ const ri = await fetch("data/index.json"); PP.data.index = ri.ok ? await ri.json() : []; }catch(e){ PP.data.index = []; }
  }catch(e){
    $("#main").innerHTML = `<div class="wrap"><section class="holding"><h1 class="r-title">The data did not load</h1><p>Pitch Perception could not read <b>data/home.json</b> (${PP.esc(e.message)}). Reload the page; if it persists, the site needs republishing.</p></section></div>`;
    return;
  }
  PP.initSearch();
  fetch("data/scouts/index.json").then(r => r.ok ? r.json() : null).then(d => { PP.data.scouts = d; }).catch(() => {});
  PP.route();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => PP.redraw());
};
})();
