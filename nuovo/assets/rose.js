/* Frammenti — the line rose.
   The rose of the collection, drawn by one golden pen: the outlines of its
   petals with every hidden line removed, a new spiral heart, then the stem
   and leaves. Drawn once, progressively, with a pressure-shaped stroke and a
   slight hand tremor. */
(function (){
"use strict";

const NS = "http:\/\/www.w3.org\/2000\/svg";
const CX = 120, CY = 92;              /* the heart of the rose, in its own units */

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
function parseTransform(str){
  let m = new DOMMatrix();
  const re = /(translate|rotate|scale)\(([^)]+)\)/g;
  let t;
  while ((t = re.exec(str || ""))){
    const a = t[2].split(/[ ,]+/).map(Number);
    if (t[1] === "translate") m = m.translate(a[0], a[1] || 0);
    if (t[1] === "scale") m = m.scale(a[0], a.length > 1 ? a[1] : a[0]);
    if (t[1] === "rotate"){
      if (a.length === 3) m = m.translate(a[1], a[2]).rotate(a[0]).translate(-a[1], -a[2]);
      else m = m.rotate(a[0]);
    }
  }
  return m;
}
function rotAround(deg){ return HEAD.multiply(new DOMMatrix().translate(CX, CY).rotate(deg).translate(-CX, -CY)); }
/* the head seen a little from the side: squashed and turned */
const HEAD = new DOMMatrix().translate(CX, CY).rotate(-9).scale(1, .86).translate(-CX, -CY);
function headPt(x, y){ const p = HEAD.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; }

/* ---------- geometry: outlines with hidden lines removed ---------- */
function build(D){
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
  const pe = document.createElementNS(NS, "path");
  svg.appendChild(pe);
  document.body.appendChild(svg);
  const hit = document.createElement("canvas").getContext("2d");

  function sample(d, m, step){
    pe.setAttribute("d", d);
    const L = pe.getTotalLength();
    const n = Math.max(2, Math.ceil(L / step));
    const out = [];
    for (let i = 0; i <= n; i++){
      const q = pe.getPointAtLength(L * i / n);
      out.push([m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f]);
    }
    return out;
  }
  function shape(d, m){ const p = new Path2D(); p.addPath(new Path2D(d), m); return p; }
  function visibleRuns(pts, occ, minLen, gap){
    const runs = []; let cur = [], cutStart = false;
    const g = gap == null ? 1.15 : gap;
    function close(cutEnd){
      if (cur.length){ runs.push(trim(cur, cutStart ? g : 0, cutEnd ? g : 0)); }
      cur = [];
    }
    for (const p of pts){
      let hidden = false;
      for (let k = 0; k < occ.length && !hidden; k++) hidden = hit.isPointInPath(occ[k], p[0], p[1]);
      if (hidden){ if (cur.length) close(true); cutStart = true; }
      else cur.push(p);
    }
    close(false);
    return runs.filter(r => r.length > 1 && pathLen(r) >= (minLen || 1.6));
  }
  function trim(r, a, b){
    let i = 0, L = 0;
    while (i < r.length - 1 && L < a){ L += Math.hypot(r[i + 1][0] - r[i][0], r[i + 1][1] - r[i][1]); i++; }
    let j = r.length - 1; L = 0;
    while (j > i && L < b){ L += Math.hypot(r[j][0] - r[j - 1][0], r[j][1] - r[j - 1][1]); j--; }
    return r.slice(i, j + 1);
  }

  /* the heart: inner petals as cupped edges that bulge and hook inward at the end */
  const INNER = [
    { R: 3.4,  a0: 0.4, span: 4.8 },
    { R: 6.6,  a0: 2.9, span: 3.7 },
    { R: 9.8,  a0: 5.3, span: 3.3 },
    { R: 13.2, a0: 1.6, span: 3.0 },
    { R: 16.6, a0: 4.1, span: 2.7 },
    { R: 19.6, a0: 0.5, span: 2.2 }
  ];
  function innerArc(A, i){
    const pts = [], N = 96;
    for (let k = 0; k <= N; k++){
      const t = k / N, th = A.a0 + t * A.span;
      let r = A.R * (0.9 + 0.17 * Math.sin(Math.PI * Math.min(1, t / .9)));
      if (t > .86) r *= 1 - 0.32 * Math.pow((t - .86) / .14, 1.6);   /* the hook */
      if (t < .08) r *= 0.9 + 0.1 * (t / .08);                          /* tucked start */
      r *= 1 + 0.03 * Math.sin(th * 5 + i);
      pts.push(headPt(CX + r * Math.cos(th), CY + r * Math.sin(th)));
    }
    return pts;
  }
  const innerPts = INNER.map(innerArc);
  const heartDisc = new Path2D();
  innerPts.forEach((pts, i) => {
    if (i < 3) return;
    const w = new Path2D(); const c = headPt(CX, CY);
    w.moveTo(c[0], c[1]); pts.forEach(p => w.lineTo(p[0], p[1])); w.closePath();
    heartDisc.addPath(w);
  });
  { const c = new Path2D(); c.ellipse(CX, CY, 11.5, 11.5, 0, 0, Math.PI * 2); heartDisc.addPath(c, HEAD); }

  /* petals, back to front: outer whorl then middle whorl */
  const petals = [];
  D.outer.forEach(p => petals.push({ whorl: "outer", rot: p.r, m: rotAround(p.r), d: p.d }));
  D.middle.forEach(p => petals.push({ whorl: "middle", rot: p.r, m: rotAround(p.r), d: p.d }));
  petals.forEach(p => { p.shape = shape(p.d, p.m); });

  const strokes = [];
  function add(kind, runs, opt){ runs.forEach(r => strokes.push(Object.assign({ kind: kind, pts: r }, opt || {}))); }

  const heart = innerPts;

  /* middle whorl: hidden by later middle petals and by the heart */
  const mids = petals.filter(p => p.whorl === "middle");
  const outs = petals.filter(p => p.whorl === "outer");
  const midStrokes = [], outStrokes = [];
  mids.forEach((p, i) => {
    const occ = mids.slice(i + 1).map(q => q.shape).concat([heartDisc]);
    midStrokes.push({ rot: p.rot, runs: visibleRuns(sample(p.d, p.m, 0.55), occ) });
  });
  outs.forEach((p, i) => {
    const occ = outs.slice(i + 1).map(q => q.shape).concat(mids.map(q => q.shape), [heartDisc]);
    outStrokes.push({ rot: p.rot, runs: visibleRuns(sample(p.d, p.m, 0.55), occ) });
  });
  const headOcc = petals.map(p => p.shape);

  /* fold lines: an echo of each rim, a little inside it */
  const echo = [];
  const ctr = headPt(CX, CY);
  function echoes(list, k, keep, from){
    list.forEach((p, i) => {
      const pts = sample(p.d, p.m, 0.6);
      let far = 0;
      pts.forEach(q => { far = Math.max(far, Math.hypot(q[0] - ctr[0], q[1] - ctr[1])); });
      const inner = pts.filter(q => Math.hypot(q[0] - ctr[0], q[1] - ctr[1]) > far * keep)
        .map(q => [ctr[0] + (q[0] - ctr[0]) * k, ctr[1] + (q[1] - ctr[1]) * k]);
      const own = p.shape;
      const occ = from(i).concat([heartDisc]);
      const runs = [];
      let cur = [];
      inner.forEach(q => {
        const ok = hit.isPointInPath(own, q[0], q[1]) && !occ.some(o => hit.isPointInPath(o, q[0], q[1]));
        if (ok) cur.push(q); else { if (cur.length) runs.push(cur); cur = []; }
      });
      if (cur.length) runs.push(cur);
      runs.filter(r => pathLen(r) > 6).forEach(r => {
        const L = r.length, a = Math.floor(L * .12), b = Math.ceil(L * .78);
        echo.push({ rot: p.rot, whorl: p.whorl, pts: r.slice(a, b) });
      });
    });
  }
  echoes(mids, .9, .74, i => mids.slice(i + 1).map(q => q.shape));
  echoes(outs, .91, .8, i => outs.slice(i + 1).map(q => q.shape).concat(mids.map(q => q.shape)));

  /* the drawing order: the heart, then the petals turning around it, inner ring first */
  heart.forEach((pts, i) => strokes.push({ kind: "heart", pts: i === 0 ? pts : pts.slice().reverse() }));
  midStrokes.sort((a, b) => ((a.rot + 20) % 360) - ((b.rot + 20) % 360))
    .forEach(s => add("middle", s.runs));
  echo.filter(e => e.whorl === "middle").forEach(e => strokes.push({ kind: "fold", pts: e.pts }));
  outStrokes.sort((a, b) => ((a.rot + 20) % 360) - ((b.rot + 20) % 360))
    .forEach(s => add("outer", s.runs));
  echo.filter(e => e.whorl === "outer").forEach(e => strokes.push({ kind: "fold", pts: e.pts }));

  /* sepals sit behind the head */
  const sepalShapes = D.sepals.map(d => shape(d, new DOMMatrix()));
  D.sepals.forEach(d => add("sepal", visibleRuns(sample(d, new DOMMatrix(), 0.5), headOcc)));

  /* stem, behind sepals and head, drawn downward */
  const stemPts = sample(D.stem, new DOMMatrix(), 0.6);
  add("stem", visibleRuns(stemPts, headOcc.concat(sepalShapes)));

  /* leaves and thorns, from the top down */
  const leafItems = D.leaves.slice(0, 2).map(tr => ({ m: parseTransform(tr) }));
  leafItems.sort((a, b) => a.m.f - b.m.f);
  const thornItems = D.thorns.slice(0, 1).map(d => ({ d: d, y: sample(d, new DOMMatrix(), 4)[0][1] }));
  const lower = leafItems.map(l => ({ type: "leaf", y: l.m.f, l: l }))
    .concat(thornItems.map(t => ({ type: "thorn", y: t.y, t: t })))
    .sort((a, b) => a.y - b.y);
  lower.forEach(it => {
    if (it.type === "thorn"){ add("thorn", visibleRuns(sample(it.t.d, new DOMMatrix(), 0.4), [])); return; }
    const m = it.l.m, L = 64, Wd = 10.5, bend = -5;
    const P = (x, y) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
    const up = [], lo = [];
    for (let k = 0; k <= 60; k++){
      const t = k / 60, s = Math.sin(Math.PI * Math.pow(t, .82));
      const mid = bend * t * t;
      up.push(P(-L * t, mid - Wd * s * (1 - .22 * t)));
      lo.push(P(-L * t, mid + Wd * .86 * s * (1 - .3 * t)));
    }
    add("leaf", [up.concat(lo.slice().reverse().slice(1))]);
    const rib = [];
    for (let k = 0; k <= 30; k++){ const t = k / 30 * .9; rib.push(P(-L * t, bend * t * t)); }
    add("vein", [rib]);
    [.28, .46, .64].forEach((t0, j) => {
      const side = j % 2 ? 1 : -1, v = [];
      for (let k = 0; k <= 10; k++){
        const t = k / 10, x = -L * (t0 + t * .13), y0 = bend * Math.pow(t0 + t * .13, 2);
        v.push(P(x, y0 + side * Wd * .62 * t * (1 - .2 * t)));
      }
      add("vein", [v]);
    });
  });

  svg.remove();

  /* bounds */
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  strokes.forEach(s => s.pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }));
  return { strokes: strokes, box: { x0: x0, y0: y0, x1: x1, y1: y1 } };
}

/* precomputed geometry: { box:[x0,y0,x1,y1], s:[[kind, "x,y x,y ..."], ...] } in hundredths */
function unpack(P){
  return {
    box: { x0: P.box[0], y0: P.box[1], x1: P.box[2], y1: P.box[3] },
    strokes: P.s.map(function (r){
      const n = r[1], pts = [];
      for (let i = 0; i < n.length; i += 2) pts.push([n[i] / 100, n[i + 1] / 100]);
      return { kind: r[0], pts: pts };
    })
  };
}
function pack(geo){
  const B = geo.box;
  return { box: [B.x0, B.y0, B.x1, B.y1].map(function (v){ return Math.round(v * 100) / 100; }),
    s: geo.strokes.map(function (st){
      const flat = [];
      let last = null;
      st.pts.forEach(function (p, i){
        if (last && i < st.pts.length - 1 && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.75) return;
        flat.push(Math.round(p[0] * 100), Math.round(p[1] * 100));
        last = p;
      });
      return [st.kind, flat];
    }) };
}

function pathLen(pts){ let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }

/* ---------- the pen ---------- */
const INK = {
  heart:  [244, 222, 176],
  middle: [233, 204, 146],
  outer:  [217, 182, 118],
  sepal:  [196, 160, 98],
  stem:   [190, 154, 92],
  thorn:  [190, 154, 92],
  leaf:   [200, 165, 102],
  vein:   [176, 142, 86],
  fold:   [214, 178, 116]
};
const WEIGHT = { heart: .95, middle: 1.0, outer: 1.12, sepal: .95, stem: 1.2, thorn: .9, leaf: 1.0, vein: .55, fold: .55 };
const PACE = { heart: 2.2, middle: 1.0, outer: .85, sepal: 1.1, stem: .55, thorn: 1.4, leaf: .9, vein: .6, fold: .7 }; /* relative time per unit of line */
const DRAW_SECONDS = 4.6;

function mount(host, opt){
  opt = opt || {};
  const geo = window.ROSE_LINES ? unpack(window.ROSE_LINES) : build(window.ROSE_DATA);
  const nA = noise1(11), nB = noise1(23), nW = noise1(37), nS = noise1(51);
  const dA = noise1(61), dB = noise1(73);

  /* prepare strokes: tremor, arc length, timing */
  let t = opt.delay || 0;
  let sAcc = 0;
  let leafNo = -1, leafBase = null;
  const strokes = geo.strokes.map((s, idx) => {
    const pts = [];
    let L = 0;
    const amp = s.kind === "heart" ? 0.16 : 0.3;
    for (let i = 0; i < s.pts.length; i++){
      if (i) L += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
      const q = (sAcc + L) * 0.045;
      pts.push([s.pts[i][0] + nA(q) * amp, s.pts[i][1] + nB(q) * amp, L]);
    }
    sAcc += L + 40;
    if (s.kind === "leaf"){ leafNo++; leafBase = [pts[0][0], pts[0][1]]; }
    const onLeaf = (s.kind === "leaf" || s.kind === "vein") && leafBase;
    return { kind: s.kind, pts: pts, L: L, t0: 0, dur: 0, at: 0, seed: idx * 7.3, w: L * PACE[s.kind],
             leaf: onLeaf ? leafNo : -1, base: onLeaf ? leafBase : null,
             head: s.kind === "heart" || s.kind === "middle" || s.kind === "outer" || s.kind === "fold" };
  });
  const gaps = strokes.length * 0.03;
  const sumW = strokes.reduce((a, s) => a + s.w, 0);
  const k = Math.max(0.2, (opt.seconds || DRAW_SECONDS) - gaps) / sumW;
  strokes.forEach(s => { s.t0 = t; s.dur = Math.max(0.05, s.w * k); t += s.dur + 0.03; });
  const total = t;

  const wrap = document.createElement("div");
  wrap.className = "rl";
  const glow = document.createElement("canvas"); glow.className = "rl-glow";
  const ink = document.createElement("canvas");  ink.className = "rl-ink";
  const nib = document.createElement("div");     nib.className = "rl-nib";
  wrap.append(glow, ink, nib);
  host.appendChild(wrap);

  const gx = glow.getContext("2d"), x = ink.getContext("2d");
  let W = 0, H = 0, S = 1, OX = 0, OY = 0, dpr = 1;
  const B = geo.box, pad = 6;
  let stemFoot = [CX, B.y1];
  strokes.forEach(s => { if (s.kind === "stem"){ const p = s.pts[s.pts.length - 1]; stemFoot = [p[0], p[1]]; } });

  const px = (p) => [OX + p[0] * S, OY + p[1] * S];
  const base = () => Math.max(0.7, Math.min(1.6, S * 0.62));

  function widthAt(s, u, L){
    const a = Math.min(1, u / 0.07), b = Math.min(1, (1 - u) / 0.12);
    const taper = Math.pow(Math.max(0, a), 0.6) * Math.pow(Math.max(0, b), 0.75);
    const press = 0.78 + 0.42 * (0.5 + 0.5 * nW(s.seed + L * 0.035));
    return base() * WEIGHT[s.kind] * (0.22 + 0.78 * taper) * press;
  }
  function alphaAt(s, u, L){
    let fl = 0.86 + 0.14 * nS(s.seed * 3 + L * 0.08);
    if (s.kind === "stem" && u > .62) fl *= Math.max(0, 1 - (u - .62) / .38);
    return fl;
  }

  /* the pen, while the rose is being drawn: segment by segment, never redrawn */
  function paintTo(s, upto){
    const P = s.pts, c = INK[s.kind];
    for (let i = Math.max(1, s.at); i <= upto && i < P.length; i++){
      const a = px(P[i - 1]), b = px(P[i]);
      const u = P[i][2] / Math.max(1e-6, s.L);
      const w = widthAt(s, u, P[i][2]);
      const fl = alphaAt(s, u, P[i][2]);
      x.strokeStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + fl.toFixed(3) + ")";
      x.lineWidth = w;
      x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke();
      gx.strokeStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (.5 * fl).toFixed(3) + ")";
      gx.lineWidth = w * 3.2;
      gx.beginPath(); gx.moveTo(a[0], a[1]); gx.lineTo(b[0], b[1]); gx.stroke();
    }
    s.at = Math.max(s.at, Math.min(upto, P.length - 1));
  }

  /* ---------- alive: once drawn, the rose breathes ----------
     The head opens and closes a little on a slow breath, its heart turns,
     every line drifts as if redrawn by a living hand, the leaves rise and
     fall, the whole flower sways from the foot of its stem, the glow pulses,
     and now and then light runs through the gold. */
  const CH = 6;
  const BREATH = 7.4, SWAY = 9.6, SHAPE = 17, SHINE = 11, SHINE_RUN = 2.6;
  let aliveT0 = 0, aliveOn = false, lastPaint = 0;
  const axis = (p) => ((p[0] - B.x0) * .78 + (p[1] - B.y0) * .62) / ((B.x1 - B.x0) * .78 + (B.y1 - B.y0) * .62);

  function breathAt(T){
    /* slower in, softer out */
    const ph = (T % BREATH) / BREATH;
    const v = ph < .46 ? Math.sin(ph / .46 * Math.PI / 2) : Math.cos((ph - .46) / .54 * Math.PI / 2);
    return v * v * 2 - 1;
  }

  function livePoint(s, p, T, br, ramp, shape){
    let X = p[0], Y = p[1];
    if (s.head){
      const dx = X - CX, dy = Y - CY;
      const r = Math.hypot(dx, dy);
      let ang = 0;
      if (s.kind === "heart") ang = 0.05 * br * ramp * Math.max(0, 1 - r / 24);
      const e = 1 + 0.026 * br * ramp * Math.min(1, r / 30);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      X = CX + (dx * ca - dy * sa) * e;
      Y = CY + (dx * sa + dy * ca) * e;
    } else if (s.base){
      const dir = s.leaf % 2 ? 1 : -1;
      const ang = 0.03 * br * ramp * dir;
      const dx = X - s.base[0], dy = Y - s.base[1];
      const ca = Math.cos(ang), sa = Math.sin(ang);
      X = s.base[0] + dx * ca - dy * sa;
      Y = s.base[1] + dx * sa + dy * ca;
    }
    const amp = (s.head ? 0.42 : 0.26) * ramp * shape;
    const q = s.seed * 1.7 + p[2] * 0.035 + T * 0.16;
    X += dA(q) * amp;
    Y += dB(q + 31) * amp;
    return [OX + X * S, OY + Y * S];
  }

  function paintAlive(now){
    const T = (now - aliveT0) / 1000;
    const ramp = Math.min(1, T / 2.8);
    const br = breathAt(T);
    const sh = Math.sin(T / SHAPE * Math.PI * 2);
    const shape = 0.55 + 0.9 * Math.max(0, sh) * Math.max(0, sh);
    const sc = (T + 3) % SHINE;
    const band = sc < SHINE_RUN ? -0.25 + 1.5 * (1 - Math.pow(1 - sc / SHINE_RUN, 2)) : -9;

    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, ink.width, ink.height);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const s of strokes){
      const P = s.pts, c = INK[s.kind];
      for (let i = 0; i < P.length - 1; i += CH){
        const j = Math.min(P.length - 1, i + CH);
        const mid = P[(i + j) >> 1];
        const u = mid[2] / Math.max(1e-6, s.L);
        let w = widthAt(s, u, mid[2]) * 1.1;
        let al = Math.min(1, alphaAt(s, u, mid[2]) * 1.15);
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
        x.strokeStyle = "rgba(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + "," + al.toFixed(3) + ")";
        x.lineWidth = w;
        x.beginPath();
        let q = livePoint(s, P[i], T, br, ramp, shape);
        x.moveTo(q[0], q[1]);
        for (let m = i + 1; m <= j; m++){ q = livePoint(s, P[m], T, br, ramp, shape); x.lineTo(q[0], q[1]); }
        x.stroke();
      }
    }
    /* the glow pulses with the breath; the flower sways from the foot of its stem */
    glow.style.opacity = (0.3 + 0.14 * (br * .5 + .5) * ramp).toFixed(3);
    const sway = 0.85 * Math.sin(T / SWAY * Math.PI * 2) * ramp;
    wrap.style.transform = "rotate(" + sway.toFixed(3) + "deg)";
  }

  function aliveLoop(now){
    raf = requestAnimationFrame(aliveLoop);
    if (opt.isPaused && opt.isPaused()) return;
    if (now - lastPaint < 40) return;          /* 25 drawings a second is enough for a slow breath */
    lastPaint = now;
    paintAlive(now);
  }
  function startAlive(){
    if (aliveOn || opt.still) return;
    aliveOn = true;
    aliveT0 = performance.now();
    raf = requestAnimationFrame(aliveLoop);
  }

  function layout(){
    W = host.clientWidth; H = host.clientHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    [glow, ink].forEach(c => { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.width = W + "px"; c.style.height = H + "px"; });
    const bw = B.x1 - B.x0 + pad * 2, bh = B.y1 - B.y0 + pad * 2;
    S = Math.min(W / bw, H / bh);
    OX = (W - bw * S) / 2 - (B.x0 - pad) * S;
    OY = (H - bh * S) / 2 - (B.y0 - pad) * S;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); gx.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.lineCap = gx.lineCap = "round"; x.lineJoin = gx.lineJoin = "round";
    const f = px(stemFoot);
    wrap.style.transformOrigin = f[0].toFixed(1) + "px " + f[1].toFixed(1) + "px";
    /* redraw what is already drawn */
    strokes.forEach(s => { const k = s.at; s.at = 0; paintTo(s, k); });
    lastPaint = 0;
  }

  let raf = 0, done = false;
  layout();
  let ro = null;
  try { ro = new ResizeObserver(() => layout()); ro.observe(host); } catch (e){}

  const instant = !!opt.instant;
  const t0 = performance.now();
  const ease = (u) => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

  function frame(now){
    const T = instant ? 1e9 : (now - t0) / 1000;
    let tip = null;
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
    finish: function (){ cancelAnimationFrame(raf); strokes.forEach(s => paintTo(s, s.pts.length - 1)); nib.style.opacity = "0"; wrap.classList.add("drawn"); if (!done && opt.onDone){ done = true; opt.onDone(); } },
    snapshot: function (){ try { return ink.toDataURL("image/png"); } catch (e){ return ""; } },
    headPoint: function (){ return px([CX, CY]); },
    scale: function (){ return S; },
    alive: function (){ return aliveOn; }
  };
}

window.FrammentiRose = { mount: mount, build: build, pack: pack };
})();
