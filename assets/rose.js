/* Frammenti — the rose.
   A rose hung head-down, seen through: its petals are a soft wine-red veil,
   the lines behind them still show, faintly. It has cracked, and the cracks
   are mended with gold; one piece has fallen. Drawn once by a pen — the stem
   out of the dark, the leaf, the petals, the hidden lines, then the gold
   poured into the cracks, then the fallen piece — and afterwards it lives:
   it breathes, it sways from where it hangs, the fallen piece floats. */
(function (){
"use strict";

/* ---------- small maths ---------- */
function seeded(s){ return function (){ s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function noise1(seed){
  const r = seeded(seed), v = [];
  for (let i = 0; i < 1024; i++) v.push(r() * 2 - 1);
  return function (x){
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return v[i & 1023] * (1 - u) + v[(i + 1) & 1023] * u;
  };
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* precomputed geometry: { box, s:[[kind, [x,y,...] in hundredths, weight in hundredths]], head, shard, split, fill } */
function unpack(P){
  return {
    box: { x0: P.box[0], y0: P.box[1], x1: P.box[2], y1: P.box[3] },
    head: P.head || [(P.box[0] + P.box[2]) / 2, (P.box[1] + P.box[3]) / 2],
    shard: P.shard || null,
    split: P.split || 1e9,
    fill: P.fill || null,
    hang: !!P.hang,
    strokes: P.s.map(function (r){
      const n = r[1], pts = [];
      for (let i = 0; i < n.length; i += 2) pts.push([n[i] / 100, n[i + 1] / 100]);
      return { kind: r[0], pts: pts, w: r[2] ? r[2] / 100 : 1 };
    })
  };
}

function pathLen(pts){ let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }

/* ---------- the pen ---------- */
const INK = {
  stem:   [214, 150, 160],
  thorn:  [214, 150, 160],
  leaf:   [222, 162, 170],
  lvein:  [230, 124, 144],
  sepal:  [222, 160, 168],
  outer:  [240, 214, 204],
  middle: [246, 226, 214],
  heart:  [250, 236, 222],
  ghost:  [228, 188, 192],
  vein:   [232, 124, 144],
  seam:   [255, 208, 116],
  seamg:  [255, 208, 116],
  shard:  [240, 214, 204],
  shardseam: [255, 208, 116]
};
const ALPHA  = { stem: .78, thorn: .78, leaf: .82, lvein: .5, sepal: .82, outer: .92, middle: .92, heart: .95,
                 ghost: .4, vein: .46, seam: 1, seamg: .5, shard: .92, shardseam: 1 };
const WEIGHT = { stem: .95, thorn: .8, leaf: .85, lvein: .4, sepal: .8, outer: 1.0, middle: .92, heart: .85,
                 ghost: .62, vein: .4, seam: 1.5, seamg: .95, shard: .95, shardseam: 1.5 };
const GLOW   = { ghost: .25, vein: .2, lvein: .25, seam: 1.5, seamg: .7, shardseam: 1.5 };
/* relative time per unit of line: the gold is poured slowly, the hidden lines come quickly */
const PACE   = { stem: .5, thorn: 1.2, leaf: .8, lvein: .25, sepal: 1.0, outer: .85, middle: 1.0, heart: 1.7,
                 ghost: .2, vein: .12, seam: 2.4, seamg: .7, shard: 1.0, shardseam: 2.2 };
const STATIC = { ghost: 1, vein: 1, seamg: 1 };        /* faint lines: drawn once, then breathe as one image */
const HEADK  = { outer: 1, middle: 1, heart: 1, seam: 1, ghost: 1, vein: 1, seamg: 1 };
const DRAW_SECONDS = 6.2;

function mount(host, opt){
  opt = opt || {};
  const geo = unpack(window.ROSE_LINES);
  const B = geo.box, HC = geo.head, SC = geo.shard;
  const nA = noise1(11), nB = noise1(23), nW = noise1(37), nS = noise1(51);
  const dA = noise1(61), dB = noise1(73);

  /* prepare strokes: tremor, arc length, timing */
  let t = opt.delay || 0;
  let sAcc = 0;
  let leafNo = -1, leafBase = null;
  /* long straight runs near the top are cut into short steps, so the fade can act along them */
  geo.strokes.forEach(s => {
    if (!geo.hang || s.pts.every(p => p[1] > B.y0 + (B.y1 - B.y0) * 0.17)) return;
    const out = [s.pts[0]];
    for (let i = 1; i < s.pts.length; i++){
      const a = s.pts[i - 1], b = s.pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.ceil(d / 3);
      for (let j = 1; j <= n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    s.pts = out;
  });
  const strokes = geo.strokes.map((s, idx) => {
    const pts = [];
    let L = 0;
    const amp = s.kind === "heart" ? 0.12 : (STATIC[s.kind] ? 0.1 : 0.22);
    for (let i = 0; i < s.pts.length; i++){
      if (i) L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
      const q = (sAcc + L) * 0.045;
      pts.push([s.pts[i][0] + nA(q) * amp, s.pts[i][1] + nB(q) * amp, L]);
    }
    sAcc += L + 40;
    if (s.kind === "leaf"){ if (!leafBase) leafNo++; leafBase = leafBase || [pts[0][0], pts[0][1]]; }
    const onLeaf = (s.kind === "leaf" || s.kind === "lvein") && leafBase;
    return { kind: s.kind, idx: idx, pts: pts, L: L, k: s.w, t0: 0, dur: 0, at: 0, seed: idx * 7.3, w: L * (PACE[s.kind] || 1),
             leaf: onLeaf ? leafNo : -1, base: onLeaf ? leafBase : null,
             head: !!HEADK[s.kind], still: !!STATIC[s.kind], shard: s.kind === "shard" || s.kind === "shardseam" };
  });
  /* the main lines one after another; the faint ones (leaf veins, hidden lines, petal veins,
     gold seen through the petals) all at once, in a short window of their own */
  const GAP = 0.03;
  const isMain = (s) => !(s.still || s.kind === "lvein");
  const mains = strokes.filter(isMain);
  const groups = [];
  strokes.forEach(s => { if (!isMain(s)){ const g = groups[groups.length - 1]; if (g && g.end === s.idx - 1){ g.list.push(s); g.end = s.idx; } else groups.push({ list: [s], end: s.idx }); } });
  const winOf = (g) => Math.min(1.5, 0.5 + g.list.length * 0.006);
  const sumW = mains.reduce((a, s) => a + s.w, 0);
  const left = (opt.seconds || DRAW_SECONDS) - mains.length * GAP - groups.reduce((a, g) => a + winOf(g) * .55, 0);
  const k = Math.max(0.2, left) / sumW;
  for (let i = 0; i < strokes.length; i++){
    const s = strokes[i];
    if (isMain(s)){ s.t0 = t; s.dur = Math.max(0.05, s.w * k); t += s.dur + GAP; continue; }
    const g = groups.find(q => q.list[0] === s);
    if (!g) continue;
    const win = winOf(g), n = g.list.length;
    g.list.forEach((q, j) => { q.t0 = t + (j / Math.max(1, n - 1)) * win * .5; q.dur = win * .5; });
    t += win * .55;
    i += n - 1;
  }
  const total = strokes.reduce((a, s) => Math.max(a, s.t0 + s.dur), 0);
  const firstStill = strokes.find(s => s.still);
  const fillAt = firstStill ? firstStill.t0 : total * .6;

  /* the layers: veil, glow, faint lines, live lines; the fallen piece apart, so it can float */
  const mk = (cls) => { const c = document.createElement("canvas"); c.className = cls; return c; };
  const wrap = document.createElement("div"); wrap.className = "rl";
  const fill = mk("rl-fill"), glow = mk("rl-glow"), still = mk("rl-still"), ink = mk("rl-ink");
  const sh = document.createElement("div"); sh.className = "rl-shard";
  const sfill = mk("rl-fill"), sglow = mk("rl-glow"), sink = mk("rl-ink");
  const nib = document.createElement("div"); nib.className = "rl-nib";
  wrap.append(fill, glow, still, ink);
  if (SC){ sh.append(sfill, sglow, sink); wrap.append(sh); }
  wrap.append(nib);
  host.appendChild(wrap);
  const CAN = SC ? [fill, glow, still, ink, sfill, sglow, sink] : [fill, glow, still, ink];

  const fx = fill.getContext("2d"), gx = glow.getContext("2d"), vx = still.getContext("2d"), x = ink.getContext("2d");
  const sfx = sfill.getContext("2d"), sgx = sglow.getContext("2d"), sx = sink.getContext("2d");
  let W = 0, H = 0, S = 1, OX = 0, OY = 0, dpr = 1;
  const pad = 6;
  let top = [ (B.x0 + B.x1) / 2, B.y0 ];
  const st0 = strokes.find(s => s.kind === "stem");
  if (st0) top = [st0.pts[0][0], B.y0];
  const fadeLen = (B.y1 - B.y0) * 0.17;

  const px = (p) => [OX + p[0] * S, OY + p[1] * S];
  const base = () => Math.max(0.7, Math.min(1.6, S * 0.62));

  function widthAt(s, u, L){
    const a = Math.min(1, u / 0.07), b = Math.min(1, (1 - u) / 0.12);
    const taper = Math.pow(Math.max(0, a), 0.6) * Math.pow(Math.max(0, b), 0.75);
    const press = 0.78 + 0.42 * (0.5 + 0.5 * nW(s.seed + L * 0.035));
    return base() * (WEIGHT[s.kind] || 1) * s.k * (0.25 + 0.75 * taper) * press;
  }
  function alphaAt(s, L, y){
    let fl = (ALPHA[s.kind] || .9) * (0.86 + 0.14 * nS(s.seed * 3 + L * 0.08));
    if (geo.hang) fl *= smooth(B.y0, B.y0 + fadeLen, y);      /* the stem comes out of the dark */
    return fl;
  }
  const rgba = (c, a) => "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + a.toFixed(3) + ")";

  /* the pen, while the rose is being drawn: segment by segment, never redrawn */
  function paintTo(s, upto){
    const P = s.pts, c = INK[s.kind];
    const ix = s.shard ? sx : (s.still ? vx : x), ig = s.shard ? sgx : gx;
    const gk = GLOW[s.kind] == null ? .5 : GLOW[s.kind];
    for (let i = Math.max(1, s.at); i <= upto && i < P.length; i++){
      const a = px(P[i - 1]), b = px(P[i]);
      const u = P[i][2] / Math.max(1e-6, s.L);
      const w = widthAt(s, u, P[i][2]);
      const fl = alphaAt(s, P[i][2], P[i][1]);
      if (fl < .01) continue;
      ix.strokeStyle = rgba(c, fl); ix.lineWidth = w;
      ix.beginPath(); ix.moveTo(a[0], a[1]); ix.lineTo(b[0], b[1]); ix.stroke();
      if (gk > 0){
        ig.strokeStyle = rgba(c, Math.min(1, gk * fl * .55)); ig.lineWidth = w * (gk > 1 ? 4 : 3.2);
        ig.beginPath(); ig.moveTo(a[0], a[1]); ig.lineTo(b[0], b[1]); ig.stroke();
      }
    }
    s.at = Math.max(s.at, Math.min(upto, P.length - 1));
  }

  /* the veil of the petals: one image, the head above `split`, the fallen piece below */
  const veil = new Image();
  let veilReady = false;
  function paintVeil(){
    if (!veilReady || !geo.fill) return;
    const F = geo.fill.box;
    const split = Math.min(geo.split, F[3]);
    const k = veil.naturalHeight / (F[3] - F[1]);
    const cut = Math.max(0, Math.min(veil.naturalHeight, (split - F[1]) * k));
    const a = px([F[0], F[1]]), b = px([F[2], split]);
    [fx, sfx].forEach(c => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, fill.width, fill.height); c.restore(); });
    fx.drawImage(veil, 0, 0, veil.naturalWidth, cut, a[0], a[1], b[0] - a[0], b[1] - a[1]);
    if (geo.hang){                                   /* the veil, too, comes out of the dark */
      const t0 = px([0, B.y0])[1], t1 = px([0, B.y0 + fadeLen])[1];
      const g = fx.createLinearGradient(0, t0, 0, t1);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      fx.save(); fx.globalCompositeOperation = "destination-out"; fx.fillStyle = g; fx.fillRect(0, t0 - 4, W, t1 - t0 + 4); fx.restore();
    }
    const c2 = px([F[2], F[3]]);
    if (veil.naturalHeight - cut > 1) sfx.drawImage(veil, 0, cut, veil.naturalWidth, veil.naturalHeight - cut, a[0], b[1], c2[0] - a[0], c2[1] - b[1]);
  }
  if (geo.fill){
    veil.onload = () => { veilReady = true; paintVeil(); };
    veil.src = geo.fill.src + (opt.version ? "?v=" + opt.version : "");
  }
  function veilOn(){ fill.classList.add("on"); sfill.classList.add("on"); }

  /* ---------- alive: once drawn, the rose breathes ----------
     The head opens and closes a little on a slow breath, its heart turns,
     every line drifts as if redrawn by a living hand, the leaf rises and
     falls, the whole flower sways from where it hangs, the glow pulses,
     light now and then runs through it, and the fallen piece floats. */
  const CH = 6;
  const BREATH = 7.4, SWAY = 10.4, SHAPE = 17, SHINE = 11, SHINE_RUN = 2.6, FLOAT = 6.8;
  let aliveT0 = 0, aliveOn = false, lastPaint = 0;
  const axis = (p) => ((p[0] - B.x0) * .78 + (p[1] - B.y0) * .62) / ((B.x1 - B.x0) * .78 + (B.y1 - B.y0) * .62);

  function breathAt(T){
    const ph = (T % BREATH) / BREATH;
    const v = ph < .46 ? Math.sin(ph / .46 * Math.PI / 2) : Math.cos((ph - .46) / .54 * Math.PI / 2);
    return v * v * 2 - 1;
  }

  function livePoint(s, p, T, br, ramp, shape){
    let X = p[0], Y = p[1];
    if (s.head){
      const dx = X - HC[0], dy = Y - HC[1];
      const r = Math.hypot(dx, dy);
      let ang = 0;
      if (s.kind === "heart") ang = 0.05 * br * ramp * Math.max(0, 1 - r / 24);
      const e = 1 + 0.018 * br * ramp * Math.min(1, r / 30);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      X = HC[0] + (dx * ca - dy * sa) * e;
      Y = HC[1] + (dx * sa + dy * ca) * e;
    } else if (s.base){
      const ang = 0.03 * br * ramp * (s.leaf % 2 ? 1 : -1);
      const dx = X - s.base[0], dy = Y - s.base[1];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      X = s.base[0] + dx * ca - dy * sa;
      Y = s.base[1] + dx * sa + dy * ca;
    }
    const amp = (s.head ? 0.36 : 0.24) * ramp * shape;
    const q = s.seed * 1.7 + p[2] * 0.035 + T * 0.16;
    X += dA(q) * amp;
    Y += dB(q + 31) * amp;
    return [OX + X * S, OY + Y * S];
  }

  function paintAlive(now){
    const T = (now - aliveT0) / 1000;
    const ramp = Math.min(1, T / 2.8);
    const br = breathAt(T);
    const shp = Math.sin(T / SHAPE * Math.PI * 2);
    const shape = 0.55 + 0.9 * Math.max(0, shp) * Math.max(0, shp);
    const sc = (T + 3) % SHINE;
    const band = sc < SHINE_RUN ? -0.25 + 1.5 * (1 - Math.pow(1 - sc / SHINE_RUN, 2)) : -9;

    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, ink.width, ink.height);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of strokes){
      if (s.still || s.shard) continue;
      const P = s.pts, c = INK[s.kind];
      for (let i = 0; i < P.length - 1; i += CH){
        const j = Math.min(P.length - 1, i + CH);
        const mid = P[(i + j) >> 1];
        const u = mid[2] / Math.max(1e-6, s.L);
        let w = widthAt(s, u, mid[2]) * 1.08;
        let al = Math.min(1, alphaAt(s, mid[2], mid[1]) * 1.12);
        if (al < .01) continue;
        let r = c[0], g = c[1], b = c[2];
        if (band > -1){
          const d = (axis(mid) - band) / 0.075;
          const boost = Math.exp(-d * d);
          if (boost > .02){
            r += (255 - r) * boost; g += (246 - g) * boost; b += (224 - b) * boost;
            w *= 1 + .45 * boost;
            al = Math.min(1, al + .35 * boost);
          }
        }
        x.strokeStyle = rgba([r, g, b], al);
        x.lineWidth = w;
        x.beginPath();
        let q = livePoint(s, P[i], T, br, ramp, shape);
        x.moveTo(q[0], q[1]);
        for (let m = i + 1; m <= j; m++){ q = livePoint(s, P[m], T, br, ramp, shape); x.lineTo(q[0], q[1]); }
        x.stroke();
      }
    }
    /* the veil and the faint lines breathe with the head, as one */
    const e = (1 + 0.016 * br * ramp).toFixed(4);
    if (!merged) still.style.transform = "scale(" + e + ")";
    /* the glow pulses with the breath; the rose sways from where it hangs; the fallen piece floats */
    glow.style.opacity = (0.3 + 0.14 * (br * .5 + .5) * ramp).toFixed(3);
    const sway = 1.1 * Math.sin(T / SWAY * Math.PI * 2) * ramp;
    wrap.style.transform = "rotate(" + sway.toFixed(3) + "deg)";
    if (SC){
      const f = T / FLOAT * Math.PI * 2;
      const dy = 3.2 * S * Math.sin(f) * ramp, dx = 1.4 * S * Math.sin(f * .5 + 1) * ramp;
      const rot = 2.6 * Math.sin(f * .7 + .4) * ramp;
      sh.style.transform = "translate(" + dx.toFixed(2) + "px," + dy.toFixed(2) + "px) rotate(" + rot.toFixed(3) + "deg)";
    }
  }

  function aliveLoop(now){
    raf = requestAnimationFrame(aliveLoop);
    if (opt.isPaused && opt.isPaused()) return;
    if (now - lastPaint < 40) return;          /* 25 drawings a second is enough for a slow breath */
    lastPaint = now;
    paintAlive(now);
  }
  /* once all is drawn, the faint lines join the veil: one layer less to move */
  let merged = false;
  function merge(){
    if (merged || !veilReady) return;
    fx.save(); fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalAlpha = 1; fx.drawImage(still, 0, 0); fx.restore();
    still.style.display = "none";
    merged = true;
  }
  function startAlive(){
    if (aliveOn || opt.still) return;
    if (fill.classList.contains("on")) setTimeout(merge, 3000);
    aliveOn = true;
    aliveT0 = performance.now();
    raf = requestAnimationFrame(aliveLoop);
  }

  function layout(){
    W = host.clientWidth; H = host.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    CAN.forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px"; });
    const bw = B.x1 - B.x0 + pad * 2, bh = B.y1 - B.y0 + (geo.hang ? pad : pad * 2);
    S = Math.min(W / bw, H / bh);
    OX = (W - bw * S) / 2 - (B.x0 - pad) * S;
    OY = geo.hang ? -B.y0 * S : (H - bh * S) / 2 - (B.y0 - pad) * S;
    [fx, gx, vx, x, sfx, sgx, sx].forEach(c => { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.lineCap = "round"; c.lineJoin = "round"; });
    const f = px(top), h = px(HC);
    wrap.style.transformOrigin = f[0].toFixed(1) + "px " + f[1].toFixed(1) + "px";
    fill.style.transformOrigin = still.style.transformOrigin = h[0].toFixed(1) + "px " + h[1].toFixed(1) + "px";
    if (SC){ const s = px(SC); sh.style.transformOrigin = s[0].toFixed(1) + "px " + s[1].toFixed(1) + "px"; }
    /* redraw what is already drawn */
    [gx, vx, x, sgx, sx].forEach(c => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.restore(); });
    strokes.forEach(s => { const k = s.at; s.at = 0; paintTo(s, k); });
    paintVeil();
    if (merged){ merged = false; merge(); }
    lastPaint = 0;
  }

  let raf = 0, done = false;
  layout();
  let ro = null;
  try { ro = new ResizeObserver(() => layout()); ro.observe(host); } catch (e){}

  const instant = !!opt.instant;
  const t0 = performance.now();
  const ease = (u) => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  if (instant) veilOn();

  function frame(now){
    const T = instant ? 1e9 : (now - t0) / 1000;
    let tip = null;
    if (T >= fillAt) veilOn();
    for (const s of strokes){
      if (T < s.t0) break;
      const u = Math.min(1, (T - s.t0) / s.dur);
      const target = ease(u) * s.L;
      let k = s.at;
      while (k < s.pts.length - 1 && s.pts[k + 1][2] <= target) k++;
      if (u >= 1) k = s.pts.length - 1;
      if (k > s.at) paintTo(s, k);
      if (u < 1) tip = px(s.pts[k]);
    }
    if (tip){
      nib.style.opacity = "1";
      nib.style.transform = "translate(" + tip[0].toFixed(1) + "px," + tip[1].toFixed(1) + "px)";
    } else nib.style.opacity = "0";
    if (T >= total){
      done = true;
      nib.style.opacity = "0";
      wrap.classList.add("drawn");
      if (opt.onDone) opt.onDone();
      setTimeout(startAlive, instant ? 0 : 700);
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    el: wrap,
    total: total,
    stop: function (){ cancelAnimationFrame(raf); if (ro) ro.disconnect(); },
    finish: function (){ cancelAnimationFrame(raf); strokes.forEach(s => paintTo(s, s.pts.length - 1)); veilOn(); nib.style.opacity = "0"; wrap.classList.add("drawn"); if (!done && opt.onDone){ done = true; opt.onDone(); } },
    snapshot: function (){ try { return ink.toDataURL("image/png"); } catch (e){ return ""; } },
    headPoint: function (){ return px(HC); },
    scale: function (){ return S; },
    alive: function (){ return aliveOn; }
  };
}

window.FrammentiRose = { mount: mount };
})();
