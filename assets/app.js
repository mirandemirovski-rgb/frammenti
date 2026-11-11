/* Frammenti di Sogni e Speranze — Miran Demirovski
   The page: songs from the sheet (through the Apps Script saved copy), the
   index, the reading view, the dedication, the drawn rose and its light. */
(function (){
"use strict";

/* ============================================================
   SETTINGS
   ============================================================ */
const EXEC = "https://script.google.com/macros/s/AKfycbwpBi5VEcV7HJpK4-XgiOlL2Q4ehE0OA_78nKsBxPl6Vucwu_9X0xuir9HHCef9nEPlrg/exec";
const STORE = "frammenti.songs.v2";
const SLOW = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = matchMedia("(pointer: fine)").matches;
const $ = (id) => document.getElementById(id);

const TITLES = [
  "Frammenti di Sogni e Speranze",
  "Fragments of Dreams and Hope",
  "Između sna i nade"
];
const LANG_WORD = { it: "italiano", hr: "hrvatski", en: "english", nap: "napoletano" };

/* A song joins by its title (lower case, punctuation removed). The lines must
   be exactly one per line of the song, or the rose does not appear. */
const DEDICATIONS = {
  "la mia casa": {
    to: "Dedicated to Niko",
    lang: "en",
    lines: [
      "Your heart is my bed",
      "I turn, and feel your heart beating",
      "What better way",
      "could there be",
      "than to fall asleep",
      "upon your chest",
      "Your hands are my roof",
      "You shelter me from storms and from the cold",
      "When I feel them holding me tight",
      "even time stands still",
      "like that clock hanging on the wall",
      "of our thoughts",
      "always united, always true",
      "And if we find ourselves in the middle of any room",
      "the soul begins its dance",
      "and we dance to the rhythm of our love",
      "never noticing if it rains outside",
      "I look through the windows of your eyes",
      "and see nothing but a pale blue sky",
      "And tired, after the last dance",
      "I want only your lips to be my couch",
      "to rest upon until the night arrives",
      "while the darkness slowly descends",
      "With you",
      "I feel safe, I feel loved",
      "You are and always will be",
      "My home"
    ]
  },
  "un sole immenso": {
    to: "Dedicated to Lina",
    lang: "nap",
    lines: [
      "'O tiempo fa cagnà 'e ccose",
      "E cagnano sempe 'e pressa",
      "Te truove dint'a n'ata vita",
      "Senza capì ca nun è 'a stessa",
      "Ma",
      "Ccà",
      "A 'o fianco mio",
      "A me dà sempe curaggio",
      "Ce stive tu",
      "Pure quanno",
      "Tutto pareva ca jeva a peggio",
      "Ccà cu mme",
      "Ce stive tu",
      "Bella",
      "Comme Napule 'e state",
      "'O sole mio immenzo",
      "Na luce",
      "Ca me fa brillà",
      "E forse nun 'o ddico cu 'e pparole",
      "Ma si' nu sullievo p' 'o core mio",
      "Tenerte a 'o fianco mio",
      "Conta cchiù d'ogne cosa a 'o munno",
      "Nu sustegno ca me salva",
      "D' 'o dulore cchiù prufunno",
      "Dint'a chesta vita",
      "Ca 'o tiempo pare ca vo' sfidà",
      "'Ncopp'a te",
      "Aggio pututo sempe cuntà",
      "Chesto",
      "Nun m' 'o scordo maje",
      "Chistu bene",
      "Ca sulo tu me faje",
      "I' surrido",
      "quanno surride tu",
      "E sto male",
      "quanno staje male tu",
      "'O sole mio immenzo",
      "Bella d'anema e core",
      "Pe' mme",
      "Si' 'a meglio amica",
      "E chesto",
      "'O tiempo",
      "Nun 'o ccagnarrà maje."
    ]
  }
};

/* ============================================================
   LANGUAGE — detected from the words, as before
   ============================================================ */
const LEX = {
  hr: "je sam su nije sto što svijet srce srca kroz gdje nikad ako vec već jos još cu ću ce će nece neće moje moja moj tvoje tvoja tvoj ovo ova ovaj nas nam sve svaka zid nebo noc noć nocas noćas kisa kiša zivot život dodji dođi oprosti tuzno tužno place plače lice snove vise više kad kada bude strah ruke bez samo jer ali ili niti nista ništa covjek čovjek ljubav dusa duša tisina tišina kap mokrom pijeska sramote pohvala borba vjetar medalje hrabrost izgubili razbij oslobodi pustinje oluje andjele anđele pakao raj nade nadam",
  it: "che non di il la le lo un una per con come sono piu più dove quando cuore vita notte stelle luna senza questo questa tutto tutti ancora nel nella della del dei delle alla sulla mai poi gia già essere fare sai so ho hai mi ti ci vi anche solo cosi così perche perché quello quella loro suo sua mio mia tuo tua ogni tra fra sotto sopra verso dopo prima mentre bacio sogni speranza dolore lacrima occhi bocca mano mani parole vento mare cielo sole giorno buio luce silenzio ombra rimorsi paura amore",
  en: "the and you of my that with have been what when every still just there like your into from about could would never always myself again over down out too much drew burned maps prove lost mirror door echo thunder wound scar sorrow empty glasses shadow filled light sacred starting tearing painting future different colors understand feel heart broken breath breathe sky stolen think changing wrong finally catching"
};
const SETS = {};
Object.keys(LEX).forEach((k) => { SETS[k] = new Set(LEX[k].split(/\s+/).filter(Boolean)); });
const LANG_ALIAS = {
  it: "it", ita: "it", italiano: "it", italian: "it", italiana: "it",
  hr: "hr", cro: "hr", croato: "hr", croata: "hr", hrvatski: "hr", croatian: "hr",
  en: "en", eng: "en", inglese: "en", english: "en"
};
function normLang(v){ return LANG_ALIAS[String(v || "").trim().toLowerCase()] || ""; }
function detectLang(text){
  const words = text.toLowerCase().match(/[a-zà-ÿčćšžđ']+/g) || [];
  const score = { hr: 0, it: 0, en: 0 };
  for (const w of words){
    if (SETS.hr.has(w)) score.hr++;
    if (SETS.it.has(w)) score.it++;
    if (SETS.en.has(w)) score.en++;
  }
  if (/[čćšžđ]/i.test(text)) score.hr += 12;
  if (/[àèéìòù]|[a-z]'/i.test(text)) score.it += 4;
  return Object.keys(score).reduce((a, b) => (score[b] > score[a] ? b : a), "it");
}
function fold(x){
  return String(x).toLowerCase().replace(/đ/g, "d").normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function slugOf(t){ return fold(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "testo"; }

function normalise(raw){
  const seen = new Map();
  return (raw || []).map((s) => {
    const lines = (s.l || []).map((x) => String(x == null ? "" : x).trim());
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    while (lines.length && !lines[0]) lines.shift();
    const title = String(s.t || "").trim();
    const lang = normLang(s.lang) || detectLang(lines.join(" "));
    let slug = slugOf(title);
    const n = (seen.get(slug) || 0) + 1;
    seen.set(slug, n);
    if (n > 1) slug += "-" + n;
    return { title: title, lines: lines, lang: lang, theme: s.theme || "", slug: slug };
  }).filter((s) => s.title && s.lines.length);
}

/* ============================================================
   THE SONGS — the last copy at once, the fresh one from Google
   ============================================================ */
const COLL = new Intl.Collator("it", { sensitivity: "base", numeric: true });
let ALL = [], BY_SLUG = new Map(), FILTER = "", VERSION = "";
const elIndex = $("index"), elCount = $("count"), elWait = $("waiting"), elFail = $("failed"), elQ = $("q"), elClear = $("clear");

function setSongs(raw, version){
  const list = normalise(raw);
  if (!list.length) return false;
  VERSION = version || "";
  ALL = list.sort((a, b) => COLL.compare(a.title, b.title));
  BY_SLUG = new Map(ALL.map((s) => [s.slug, s]));
  elWait.hidden = true;
  elFail.hidden = true;
  renderIndex();
  route(true);
  return true;
}

function readStore(){
  try { const v = JSON.parse(localStorage.getItem(STORE) || "null"); return v && Array.isArray(v.songs) ? v : null; }
  catch (e){ return null; }
}
function writeStore(data){
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e){}
}

function viaFetch(){
  const ctl = ("AbortController" in window) ? new AbortController() : null;
  const bail = setTimeout(() => { if (ctl) ctl.abort(); }, 25000);
  return fetch(EXEC + "?songs=1", { redirect: "follow", credentials: "omit", signal: ctl ? ctl.signal : undefined })
    .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .finally(() => clearTimeout(bail));
}
function viaScript(){
  return new Promise((resolve, reject) => {
    const name = "__frammenti" + Date.now();
    const s = document.createElement("script");
    const bail = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, 25000);
    function cleanup(){ clearTimeout(bail); try { delete window[name]; } catch (e){ window[name] = undefined; } s.remove(); }
    window[name] = (data) => { cleanup(); resolve(data); };
    s.onerror = () => { cleanup(); reject(new Error("script")); };
    s.src = EXEC + "?songs=1&callback=" + name;
    document.head.appendChild(s);
  });
}
function fresh(){
  return viaFetch().catch(() => viaScript());
}

function load(){
  const kept = readStore();
  if (kept) setSongs(kept.songs, String(kept.v || ""));
  let tries = 0;
  function attempt(){
    tries++;
    fresh().then((data) => {
      const songs = data && (Array.isArray(data) ? data : data.songs);
      if (!songs || !songs.length) throw new Error("empty");
      const v = String((data && data.v) || "");
      if (!kept || v !== VERSION || !ALL.length) setSongs(songs, v);
      writeStore({ v: v, songs: songs });
    }).catch((err) => {
      console.warn("[frammenti] songs:", err && err.message);
      if (tries < 2){ setTimeout(attempt, 1800); return; }
      if (!ALL.length){ elWait.hidden = true; elFail.hidden = false; }
    });
  }
  attempt();
}
$("retry").addEventListener("click", () => { elFail.hidden = true; elWait.hidden = false; load(); });

/* ============================================================
   THE INDEX — letters and titles, with a dotted leader to the language
   ============================================================ */
function visible(){
  if (!FILTER) return ALL;
  const q = fold(FILTER);
  return ALL.filter((s) => fold(s.title).includes(q));
}

const SVGNS = "http:\/\/www.w3.org\/2000\/svg";
const INKED = new Set();               /* letters the pen has already drawn this visit */
const inkSeer = ("IntersectionObserver" in window) ? new IntersectionObserver((en) => {
  en.forEach((e) => {
    if (!e.isIntersecting) return;
    const g = e.target;
    INKED.add(g.dataset.letter);
    g.classList.add("inked");
    inkSeer.unobserve(g);
  });
}, { threshold: .35, rootMargin: "0px 0px -8% 0px" }) : null;

function renderIndex(){
  const list = visible();
  if (inkSeer) inkSeer.disconnect();
  elIndex.textContent = "";
  if (FILTER && !list.length){
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Nessun titolo contiene «" + FILTER.trim() + "».";
    elIndex.appendChild(p);
  }
  const present = new Map();
  let grp = null, ul = null, letter = "";
  for (const s of list){
    let L = fold(s.title).charAt(0).toUpperCase();
    if (!/[A-Z]/.test(L)) L = "#";
    if (L !== letter){
      letter = L;
      grp = document.createElement("section");
      grp.className = "grp";
      grp.id = "lettera-" + (L === "#" ? "altri" : L);
      grp.dataset.letter = L;
      grp.setAttribute("aria-label", L === "#" ? "Altri" : L);
      const h = document.createElement("h3");
      h.className = "ini";
      h.setAttribute("aria-hidden", "true");
      const svg = document.createElementNS(SVGNS, "svg");
      svg.setAttribute("viewBox", "0 0 52 62");
      svg.setAttribute("focusable", "false");
      const tx = document.createElementNS(SVGNS, "text");
      tx.setAttribute("x", "1");
      tx.setAttribute("y", "52");
      tx.textContent = L;
      svg.appendChild(tx);
      h.appendChild(svg);
      ul = document.createElement("ul");
      grp.append(h, ul);
      elIndex.appendChild(grp);
      if (SLOW || INKED.has(L)) grp.classList.add("inked", "still");
      else if (inkSeer) inkSeer.observe(grp);
      else grp.classList.add("inked");
    }
    present.set(L, (present.get(L) || 0) + 1);
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.className = "song";
    a.href = "#/" + s.slug;
    a.dataset.slug = s.slug;
    const t = document.createElement("span");
    t.className = "t";
    t.textContent = s.title;
    const lead = document.createElement("span");
    lead.className = "lead";
    lead.setAttribute("aria-hidden", "true");
    const lg = document.createElement("span");
    lg.className = "lg";
    lg.textContent = LANG_WORD[s.lang] || "";
    lg.setAttribute("lang", s.lang === "hr" ? "hr" : s.lang === "en" ? "en" : "it");
    a.append(t, lead, lg);
    li.appendChild(a);
    ul.appendChild(li);
  }
  elCount.textContent = !ALL.length ? ""
    : FILTER ? list.length + " di " + ALL.length
    : ALL.length + (ALL.length === 1 ? " testo" : " testi");
  railFill(present);
}

/* ============================================================
   THE ALPHABET — a thin A to Z at the side, to glide to a letter
   ============================================================ */
const rail = document.createElement("nav");
rail.className = "abc";
rail.id = "abc";
rail.setAttribute("aria-label", "Vai alla lettera");
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach((L) => {
  const a = document.createElement("a");
  a.href = "#lettera-" + L;
  a.dataset.l = L;
  a.textContent = L;
  rail.appendChild(a);
});
document.body.appendChild(rail);

function railFill(present){
  rail.querySelectorAll("a").forEach((a) => {
    const n = present.get(a.dataset.l) || 0;
    a.classList.toggle("off", !n);
    if (n){
      a.removeAttribute("aria-disabled");
      a.removeAttribute("tabindex");
      a.setAttribute("aria-label", "Lettera " + a.dataset.l + ", " + n + (n === 1 ? " testo" : " testi"));
    } else {
      a.setAttribute("aria-disabled", "true");
      a.setAttribute("tabindex", "-1");
      a.setAttribute("aria-label", "Lettera " + a.dataset.l + ", nessun testo");
    }
  });
  railNow();
}

function railGo(L, smooth){
  const g = document.getElementById("lettera-" + L);
  if (!g) return;
  g.scrollIntoView({ behavior: smooth && !SLOW ? "smooth" : "auto", block: "start" });
}

rail.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  if (a.classList.contains("off")) return;
  railGo(a.dataset.l, true);
  const first = document.querySelector("#lettera-" + a.dataset.l + " a.song");
  if (first && e.detail === 0) first.focus({ preventScroll: true });   /* keyboard: carry the focus there */
});

/* on a phone the finger can slide along the letters, as in a contacts list */
(function (){
  let on = false, lastL = "";
  function at(e){
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const a = el && el.closest && el.closest(".abc a");
    rail.querySelectorAll("a.touch").forEach((x) => x.classList.remove("touch"));
    if (!a || a.classList.contains("off")) return;
    a.classList.add("touch");
    if (a.dataset.l !== lastL){ lastL = a.dataset.l; railGo(lastL, false); }
  }
  rail.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    on = true; lastL = "";
    try { rail.setPointerCapture(e.pointerId); } catch (err){}
    at(e);
  });
  rail.addEventListener("pointermove", (e) => { if (on) at(e); });
  function end(){ on = false; setTimeout(() => rail.querySelectorAll("a.touch").forEach((x) => x.classList.remove("touch")), 380); }
  rail.addEventListener("pointerup", end);
  rail.addEventListener("pointercancel", end);
})();

/* the letter you are reading in is lit on the rail */
let railQueued = false;
function railNow(){
  railQueued = false;
  const groups = elIndex.querySelectorAll(".grp");
  let cur = "";
  const line = innerHeight * .32;
  groups.forEach((g) => { if (g.getBoundingClientRect().top <= line) cur = g.dataset.letter; });
  if (!cur && groups.length) cur = groups[0].dataset.letter;
  rail.querySelectorAll("a").forEach((a) => a.classList.toggle("now", a.dataset.l === cur));
}
window.addEventListener("scroll", () => { if (!railQueued){ railQueued = true; requestAnimationFrame(railNow); } }, { passive: true });
if ("IntersectionObserver" in window){
  new IntersectionObserver((en) => {
    document.body.classList.toggle("in-index", en[0].isIntersecting);
  }, { threshold: 0, rootMargin: "-30% 0px -30% 0px" }).observe($("indice"));
}

elIndex.addEventListener("click", (e) => {
  const a = e.target.closest("a.song");
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  e.preventDefault();
  const s = BY_SLUG.get(a.dataset.slug);
  if (s) openSong(s, a, true);
});

let qTimer = 0;
elQ.addEventListener("input", () => {
  clearTimeout(qTimer);
  qTimer = setTimeout(() => {
    FILTER = elQ.value;
    elClear.hidden = !FILTER;
    renderIndex();
  }, 60);
});
elClear.addEventListener("click", () => { elQ.value = ""; FILTER = ""; elClear.hidden = true; renderIndex(); elQ.focus(); });

/* ============================================================
   READING
   ============================================================ */
const veil = $("veil"), sheet = $("sheet"), stage = $("stage"), frost = $("frost");
const elTtl = $("sheetTitle"), elLang = $("sheetLang"), elBody = $("sheetBody");
const elRose = $("roseGift"), elDed = $("dedica");
const elNext = $("nextSong"), elNextT = $("nextTitle"), elShare = $("share");
if (window.FX) FX.init(sheet, stage);

let current = null, origin = null, lastFocus = null, pushed = false, hideTimer = 0, openTimer = 0;

function neighbour(s, dir){
  const list = visible().length ? visible() : ALL;
  if (list.length < 2) return null;
  let i = list.indexOf(s);
  if (i < 0) i = ALL.indexOf(s);
  return list[(i + dir + list.length) % list.length];
}

function fillSheet(s){
  current = s;
  elTtl.textContent = s.title;
  elTtl.setAttribute("lang", s.lang === "hr" ? "hr" : s.lang === "en" ? "en" : "it");
  elLang.textContent = LANG_WORD[s.lang] || "";
  elBody.textContent = "";
  elBody.setAttribute("lang", s.lang === "hr" ? "hr" : s.lang === "en" ? "en" : "it");
  let para = document.createElement("p"), n = 0, p = 0;
  for (const line of s.lines){
    if (!line){
      if (para.childNodes.length){ elBody.appendChild(para); para = document.createElement("p"); p++; }
      continue;
    }
    const span = document.createElement("span");
    span.className = "ln";
    span.style.setProperty("--i", n++);
    span.style.setProperty("--p", p);
    span.textContent = line;
    para.appendChild(span);
  }
  if (para.childNodes.length) elBody.appendChild(para);
  dedicationFor(s);
  if (window.FX){ veil.dataset.theme = FX.mount(s); }
  const nx = neighbour(s, 1);
  elNext.hidden = !nx;
  if (nx){ elNextT.textContent = nx.title; elNext.href = "#/" + nx.slug; }
  frost.scrollTop = 0;
  document.title = s.title + " — Miran Demirovski";
}

function flyFrom(src){
  /* the title leaves its line in the index and settles at the top of the page */
  if (SLOW || !src) return;
  const from = src.querySelector(".t") || src;
  const a = from.getBoundingClientRect();
  const b = elTtl.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const k = Math.min(a.height / b.height, a.width / b.width);
  const dx = a.left - b.left - (b.width * k - a.width) / 2 * 0;
  elTtl.animate([
    { transform: "translate(" + (a.left - b.left) + "px," + (a.top - b.top) + "px) scale(" + k + ")", opacity: .4 },
    { transform: "none", opacity: 1 }
  ], { duration: 900, easing: "cubic-bezier(.2,.8,.2,1)" });
  void dx;
}

function openSong(s, src, push){
  if (!s) return;
  clearTimeout(hideTimer);
  const wasOpen = !veil.hidden;
  lastFocus = src || document.activeElement;
  origin = src;
  frost.classList.remove("reading");
  fillSheet(s);
  if (push){
    const url = "#/" + s.slug;
    if (wasOpen) history.replaceState({ song: s.slug }, "", url);
    else { history.pushState({ song: s.slug }, "", url); pushed = true; }
  }
  if (wasOpen){ void frost.offsetWidth; frost.classList.add("reading"); return; }
  veil.hidden = false;
  document.documentElement.classList.add("lock");
  void veil.offsetWidth;
  frost.scrollTop = 0;          /* only now: while the page was hidden the browser ignored it */
  requestAnimationFrame(() => {
    veil.classList.add("on");
    flyFrom(src);
    frost.classList.add("reading");
    frost.focus({ preventScroll: true });
  });
  clearTimeout(openTimer);
  openTimer = setTimeout(() => { if (!veil.hidden) document.body.classList.add("song-open"); }, 650);
  pauseHero(true);
}

function closeSheet(fromHistory){
  if (veil.hidden) return;
  if (!fromHistory && pushed && history.state && history.state.song){ history.back(); return; }
  if (!fromHistory) history.replaceState(null, "", location.pathname + location.search);
  pushed = false;
  clearTimeout(openTimer);
  dedicationClear();
  document.body.classList.remove("song-open");
  veil.classList.remove("on");
  frost.classList.remove("reading");
  document.title = "Frammenti di Sogni e Speranze — Miran Demirovski";
  hideTimer = setTimeout(() => {
    frost.scrollTop = 0;        /* leave it at the top for the next song */
    veil.hidden = true;
    if (window.FX) FX.unmount();
    current = null;
    document.documentElement.classList.remove("lock");
    const back = lastFocus && lastFocus.isConnected ? lastFocus
      : (origin && origin.dataset && document.querySelector('a.song[data-slug="' + origin.dataset.slug + '"]'));
    if (back) back.focus({ preventScroll: true });
    pauseHero(false);
  }, SLOW ? 10 : 560);
}

let switching = false, pendingDir = 0;
function goSong(dir){
  if (veil.hidden || !current) return;
  if (switching){ pendingDir = dir; return; }
  const next = neighbour(current, dir);
  if (!next) return;
  switching = true;
  const away = frost.animate([
    { opacity: 1, transform: "translateX(0px)" },
    { opacity: 0, transform: "translateX(" + (-dir * 40) + "px)" }
  ], { duration: SLOW ? 1 : 220, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" });
  away.onfinish = () => {
    try {
      frost.classList.remove("reading");
      fillSheet(next);
      history.replaceState({ song: next.slug }, "", "#/" + next.slug);
      const a = elIndex.querySelector('a.song[data-slug="' + next.slug + '"]');
      if (a){ origin = lastFocus = a; }
      void frost.offsetWidth;
      frost.classList.add("reading");
    } catch (e){ console.warn("[frammenti] next song:", e); }
    const back = frost.animate([
      { opacity: 0, transform: "translateX(" + (dir * 40) + "px)" },
      { opacity: 1, transform: "translateX(0px)" }
    ], { duration: SLOW ? 1 : 480, easing: "cubic-bezier(.16,.84,.26,1)" });
    away.cancel();
    const done = () => {
      switching = false;
      const d = pendingDir; pendingDir = 0;
      if (d && !veil.hidden) goSong(d);
    };
    back.onfinish = done; back.oncancel = done;
  };
}

$("close").addEventListener("click", () => closeSheet(false));
$("sidePrev").addEventListener("click", () => goSong(-1));
$("sideNext").addEventListener("click", () => goSong(1));
elNext.addEventListener("click", (e) => { e.preventDefault(); goSong(1); });
document.addEventListener("keydown", (e) => {
  if (veil.hidden) return;
  if (e.key === "Escape"){ e.preventDefault(); closeSheet(false); }
  else if (e.key === "ArrowRight"){ e.preventDefault(); goSong(1); }
  else if (e.key === "ArrowLeft"){ e.preventDefault(); goSong(-1); }
  else if (e.key === "Tab"){
    /* keep the focus inside the open song */
    const f = [...veil.querySelectorAll("button:not([hidden]), a[href]:not([hidden])")].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  }
});

/* gestures: sideways for the next song, a pull down from the top to close */
(function (){
  let x0 = 0, y0 = 0, t0 = 0, top0 = false, on = false;
  frost.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1){ on = false; return; }
    on = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); top0 = frost.scrollTop <= 0;
  }, { passive: true });
  frost.addEventListener("touchend", (e) => {
    if (!on) return; on = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0, dt = Date.now() - t0;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 900){ goSong(dx < 0 ? 1 : -1); return; }
    if (top0 && frost.scrollTop <= 0 && dy > 130 && Math.abs(dy) > Math.abs(dx) * 1.6) closeSheet(false);
  }, { passive: true });
})();

/* share one poem */
elShare.addEventListener("click", () => {
  if (!current) return;
  const url = location.origin + location.pathname + "#/" + current.slug;
  const data = { title: current.title + " — Miran Demirovski", url: url };
  if (navigator.share){ navigator.share(data).catch(() => {}); return; }
  const done = () => { elShare.textContent = "Link copiato"; setTimeout(() => { elShare.textContent = "Condividi"; }, 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => prompt("Copia il link:", url));
  else prompt("Copia il link:", url);
});

/* the address: #/title opens that song, so a single poem can be shared */
function route(initial){
  const h = decodeURIComponent(location.hash || "");
  const m = h.match(/^#\/(.+)$/);
  if (m){
    const s = BY_SLUG.get(m[1]);
    if (s){ if (!current || current.slug !== s.slug) openSong(s, elIndex.querySelector('a.song[data-slug="' + s.slug + '"]'), false); return; }
    if (initial && !ALL.length) return;    /* songs not here yet: wait for them */
  }
  if (!veil.hidden) closeSheet(true);
}
window.addEventListener("popstate", () => { pushed = false; route(false); });
window.addEventListener("hashchange", () => route(false));

/* ============================================================
   THE DEDICATION — the small red rose under a title
   ============================================================ */
const TURN_STEP = 185, TURN_RIDE = 1400;
let DED = null, dedTimer = 0;
function dedKey(t){ return String(t || "").toLowerCase().replace(/[^a-zà-ɏ]+/g, " ").replace(/\s+/g, " ").trim(); }
function dedicationClear(){
  clearTimeout(dedTimer);
  DED = null;
  elRose.hidden = true;
  elRose.classList.remove("given");
  elRose.setAttribute("aria-expanded", "false");
  elDed.classList.remove("on");
  elDed.hidden = true;
  elDed.textContent = "";
  elBody.classList.remove("en", "settled", "bi", "rearm");
}
/* a short apostrophe word ('o, 'e, p', si') never ends a line: it holds the next word */
function keepTogether(line){
  const w = String(line).split(" ");
  let out = "";
  for (let i = 0; i < w.length; i++){
    out += w[i];
    if (i < w.length - 1){
      const short = /^(?:['\u2019]\p{L}{1,2}|\p{L}{1,2}['\u2019])$/u.test(w[i])
        || (w[i].length === 1 && /^['\u2019]/.test(w[i + 1]));
      out += short ? "\u00A0" : " ";
    }
  }
  return out;
}
function dedicationFor(s){
  dedicationClear();
  const d = DEDICATIONS[dedKey(s.title)];
  if (!d) return;
  const lines = elBody.querySelectorAll(".ln");
  const tr = d.lines || d.en;
  if (!tr || tr.length !== lines.length) return;
  for (let i = 0; i < lines.length; i++){
    const ln = lines[i];
    const it = document.createElement("span");
    it.className = "face fc-it";
    it.textContent = ln.textContent;
    const en = document.createElement("span");
    en.className = "face fc-en";
    en.setAttribute("lang", d.lang || "en");
    en.textContent = keepTogether(tr[i]);
    ln.textContent = "";
    ln.classList.add("dual");
    ln.append(it, en);
  }
  DED = d;
  elBody.classList.add("bi", "settled");
  elRose.hidden = false;
}
function turnLanguage(){
  if (!DED) return;
  clearTimeout(dedTimer);
  elBody.classList.add("rearm");
  elBody.classList.remove("settled");
  void elBody.offsetWidth;
  elBody.classList.remove("rearm");
  const turned = elBody.classList.toggle("en");
  if (current) elLang.textContent = turned ? (LANG_WORD[DED.lang] || DED.lang || "") : (LANG_WORD[current.lang] || "");
  const n = elBody.querySelectorAll(".ln").length;
  dedTimer = setTimeout(() => elBody.classList.add("settled"), SLOW ? 10 : n * TURN_STEP + TURN_RIDE);
}
elRose.addEventListener("click", () => {
  if (!DED) return;
  if (!elRose.classList.contains("given")){
    elRose.classList.add("given");
    elRose.setAttribute("aria-expanded", "true");
    elDed.textContent = DED.to;
    elDed.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => elDed.classList.add("on")));
    dedTimer = setTimeout(turnLanguage, 1600);
    return;
  }
  turnLanguage();
});

/* ============================================================
   THE HERO — the rose, the title in three languages, the light
   ============================================================ */
const hero = $("hero"), tw = document.querySelector("#title .tw");
let heroSeen = true, songOpen = false, rose = null;

function buildTitle(text){
  const frag = document.createDocumentFragment();
  const words = text.split(" ");
  let k = 0;
  words.forEach((w, wi) => {
    const wd = document.createElement("span");
    wd.className = "wd";
    for (const ch of w){
      const sp = document.createElement("span");
      sp.className = "lt";
      sp.style.setProperty("--k", k++);
      sp.textContent = ch;
      wd.appendChild(sp);
    }
    frag.appendChild(wd);
    if (wi < words.length - 1) frag.appendChild(document.createTextNode(" "));
  });
  return frag;
}
tw.appendChild(buildTitle(TITLES[0]));
tw.querySelectorAll(".lt").forEach((el) => el.classList.add("now"));

let titleAt = 0, titleTimer = 0;
function turnTitle(){
  if (!heroSeen || songOpen || document.hidden){ titleTimer = setTimeout(turnTitle, 3000); return; }
  const outs = [...tw.querySelectorAll(".lt")];
  outs.forEach((el, i) => { el.classList.remove("now", "in"); el.style.transitionDelay = (i * 12) + "ms"; el.classList.add("out"); });
  setTimeout(() => {
    titleAt = (titleAt + 1) % TITLES.length;
    const next = TITLES[titleAt];
    $("title").setAttribute("aria-label", next);
    tw.textContent = "";
    tw.appendChild(buildTitle(next));
    const ins = [...tw.querySelectorAll(".lt")];
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ins.forEach((el, i) => { el.style.transitionDelay = (i * 16) + "ms"; el.classList.add("in"); });
    }));
    titleTimer = setTimeout(turnTitle, 12000);
  }, 520 + outs.length * 12);
}
if (!SLOW) titleTimer = setTimeout(turnTitle, 11000);

/* petals of line, let go by the rose */
const petalHost = $("petals");
const PETALS = [
  ["M0,0 C-8,-6 -12,-19 -8,-29 C-4,-37 6,-37 10,-29 C14,-19 9,-6 0,0 Z", "M0,-3 C-2,-12 -1,-22 2,-29"],
  ["M0,0 C-11,-4 -15,-15 -12,-24 C-9,-31 -1,-33 5,-29 C12,-24 12,-11 0,0 Z", "M-1,-4 C-4,-12 -5,-20 -3,-27"],
  ["M0,0 C-6,-8 -8,-20 -3,-30 C1,-36 9,-33 10,-25 C11,-15 6,-6 0,0 Z", "M1,-4 C0,-13 1,-21 4,-28"]
];
let petalTimer = 0, petalsAlive = 0;
function spawnPetal(){
  if (!rose || SLOW) return;
  if (!heroSeen || songOpen || document.hidden || petalsAlive >= 4) return;
  const hostR = hero.getBoundingClientRect();
  const roseR = $("roseHost").getBoundingClientRect();
  const hp = rose.headPoint();
  const sx = roseR.left - hostR.left + hp[0] + (Math.random() - .5) * 90 * rose.scale() / 2;
  const sy = roseR.top - hostR.top + hp[1] + (Math.random() - .3) * 50 * rose.scale() / 2;
  const NS = "http:\/\/www.w3.org\/2000\/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "lp");
  svg.setAttribute("viewBox", "-16 -40 32 44");
  const shape = PETALS[(Math.random() * PETALS.length) | 0];
  shape.forEach((d) => { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.appendChild(p); });
  petalHost.appendChild(svg);
  petalsAlive++;
  const side = Math.random() < .5 ? -1 : 1;
  const dist = hostR.height * (.45 + Math.random() * .35);
  const drift = side * (60 + Math.random() * 160);
  const s = .8 + Math.random() * .7;
  const r0 = Math.random() * 360, r1 = r0 + side * (140 + Math.random() * 260);
  const rx = (Math.random() < .5 ? -1 : 1) * (240 + Math.random() * 300);
  const dur = 9000 + Math.random() * 5000;
  const a = svg.animate([
    { transform: "translate(" + sx + "px," + sy + "px) rotate(" + r0 + "deg) rotateX(0deg) scale(" + s + ")", opacity: 0 },
    { opacity: .9, offset: .12 },
    { transform: "translate(" + (sx + drift * .45) + "px," + (sy + dist * .45) + "px) rotate(" + ((r0 + r1) / 2) + "deg) rotateX(" + (rx / 2) + "deg) scale(" + s + ")", opacity: .75, offset: .5 },
    { transform: "translate(" + (sx + drift) + "px," + (sy + dist) + "px) rotate(" + r1 + "deg) rotateX(" + rx + "deg) scale(" + s + ")", opacity: 0 }
  ], { duration: dur, easing: "cubic-bezier(.3,.1,.5,1)", fill: "both" });
  a.onfinish = () => { svg.remove(); petalsAlive--; };
}
function petalLoop(){
  spawnPetal();
  petalTimer = setTimeout(petalLoop, 2600 + Math.random() * 2200);
}

/* a line of light follows the pointer across the hero, then comes apart into
   petals of line that fall. On a phone a tap lets a few petals go. */
function trail(){
  if (SLOW) return;
  const cv = $("trail"), cx = cv.getContext("2d");
  const SHAPES = PETALS.map((sh) => sh.map((d) => new Path2D(d)));
  const LIFE = 1250, DISSOLVE = 430, GAP = 30;
  let pts = [], petals = [], raf = 0, W = 0, H = 0, dpr = 1, last = 0, run = 0;
  function size(){
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = hero.clientWidth; H = hero.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener("resize", size);
  function kick(){ if (!raf){ last = performance.now(); raf = requestAnimationFrame(draw); } }
  function petal(x, y, vx, vy){
    if (petals.length > 80) return;
    petals.push({ x: x, y: y, vx: vx, vy: vy,
      rot: Math.random() * 6.283, vr: (Math.random() - .5) * 2.4,
      flip: Math.random() * 6.283, vf: 1.6 + Math.random() * 2.6,
      s: .62 + Math.random() * .5, sh: SHAPES[(Math.random() * SHAPES.length) | 0],
      sway: Math.random() * 6.283, born: performance.now(), life: 2600 + Math.random() * 2000 });
  }
  function local(e){ const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

  hero.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || songOpen) return;
    const p = local(e), now = performance.now();
    const prev = pts[pts.length - 1];
    let vx = 0, vy = 0;
    if (prev){ const dt = Math.max(8, now - prev.t); vx = (p[0] - prev.x) / dt * 1000; vy = (p[1] - prev.y) / dt * 1000; }
    pts.push({ x: p[0], y: p[1], t: now, vx: vx, vy: vy, gone: false });
    if (pts.length > 110) pts.shift();
    kick();
  });

  let down = null;
  hero.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    down = { p: local(e), t: performance.now(), x: e.clientX, y: e.clientY };
  });
  hero.addEventListener("pointerup", (e) => {
    if (!down || e.pointerType === "mouse") return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = performance.now() - down.t;
    const p = down.p; down = null;
    if (moved > 10 || held > 450 || songOpen) return;      /* a scroll, not a tap */
    if (e.target.closest && e.target.closest("a, button")) return;
    const n = 6 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++){
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.2;
      const sp = 40 + Math.random() * 70;
      petal(p[0] + (Math.random() - .5) * 10, p[1] + (Math.random() - .5) * 10, Math.cos(a) * sp, Math.sin(a) * sp);
    }
    kick();
  });
  hero.addEventListener("pointercancel", () => { down = null; });

  function draw(now){
    raf = 0;
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    cx.clearRect(0, 0, W, H);
    pts = pts.filter((p) => now - p.t < LIFE);

    /* the line comes apart where it is oldest: each piece becomes a petal */
    for (const p of pts){
      if (p.gone || now - p.t < DISSOLVE) continue;
      p.gone = true;
      const i = pts.indexOf(p), q = pts[i - 1];
      run += q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
      if (run >= GAP){
        run = 0;
        petal(p.x, p.y, p.vx * .18 + (Math.random() - .5) * 26, p.vy * .12 - 14 - Math.random() * 18);
      }
    }

    cx.lineCap = "round"; cx.lineJoin = "round";
    for (let i = 1; i < pts.length; i++){
      const a = pts[i - 1], b = pts[i];
      const age = (now - b.t) / LIFE;
      const melt = Math.max(0, (now - b.t - DISSOLVE) / (LIFE - DISSOLVE));
      const al = Math.pow(1 - age, 1.6) * .6 * Math.pow(1 - melt, 1.8);
      if (al < .01) continue;
      cx.strokeStyle = "rgba(240,217,166," + al.toFixed(3) + ")";
      cx.lineWidth = .9 + (1 - age) * .55;
      cx.beginPath();
      if (i > 1){
        const z = pts[i - 2];
        cx.moveTo((z.x + a.x) / 2, (z.y + a.y) / 2);
        cx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      } else { cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); }
      cx.stroke();
    }

    /* the petals: they flutter (a turn seen edge-on), drift, and fall slowly */
    petals = petals.filter((f) => now - f.born < f.life && f.y < H + 40);
    for (const f of petals){
      f.vy = Math.min(46, f.vy + 30 * dt);
      f.vx *= Math.pow(.35, dt);
      f.x += (f.vx + Math.sin(now / 900 + f.sway) * 16) * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
      f.flip += f.vf * dt;
      const k = (now - f.born) / f.life;
      const al = Math.min(1, (now - f.born) / 180) * (k > .55 ? 1 - (k - .55) / .45 : 1) * .85;
      const squash = Math.max(.14, Math.abs(Math.cos(f.flip)));
      cx.save();
      cx.translate(f.x, f.y);
      cx.rotate(f.rot);
      cx.scale(f.s, f.s * squash);
      cx.lineWidth = .9 / f.s;
      cx.strokeStyle = "rgba(226,196,138," + al.toFixed(3) + ")";
      cx.stroke(f.sh[0]);
      cx.strokeStyle = "rgba(226,196,138," + (al * .55).toFixed(3) + ")";
      cx.stroke(f.sh[1]);
      cx.restore();
    }
    if (pts.length || petals.length) raf = requestAnimationFrame(draw);
  }
}

function pauseHero(on){
  songOpen = on;
}

if ("IntersectionObserver" in window){
  new IntersectionObserver((en) => { heroSeen = en[0].isIntersecting; }, { threshold: .05 }).observe(hero);
}

function startRose(){
  if (!window.FrammentiRose || !(window.ROSE_LINES || window.ROSE_DATA)) return;
  try {
    rose = FrammentiRose.mount($("roseHost"), {
      instant: SLOW,
      still: SLOW,
      delay: .15,
      isPaused: () => !heroSeen || songOpen || document.hidden,
      onDone: () => {
        if (SLOW) return;
        setTimeout(petalLoop, 600);
      }
    });
  } catch (e){ console.warn("[frammenti] rose:", e); }
}

/* the year of the rights widens on its own */
(function (){ const y = new Date().getFullYear(); if (y > 2026) $("copyYear").textContent = "2026–" + y; })();

startRose();
trail();
load();
})();
