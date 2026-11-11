/* Frammenti — the fifteen effects behind the words (ported from the Apps Script page, re-tuned for the dark). */
(function (){
let sheet = null, stage = null;
function fxNear(full){
  const sel = full ? ".near.full" : ".near:not(.full)";
  let n = sheet.querySelector(sel);
  if (!n){
    n = document.createElement("div");
    n.className = full ? "near full" : "near";
    sheet.appendChild(n);
  }
  return n;
}



function fxCanvas(host, init, draw, opt){
  const cv = document.createElement("canvas");
  cv.className = "fx";
  host.appendChild(cv);

  const ctx = cv.getContext("2d");
  const dpr = Math.min((host.offsetWidth * host.offsetHeight > 900000) ? 1 : 1.25, window.devicePixelRatio || 1);
  let w = 0, h = 0, state = null, raf = 0, alive = true;

  

  function size(){
    w = Math.max(1, Math.round(host.offsetWidth  || sheet.offsetWidth  || 760));
    h = Math.max(1, Math.round(host.offsetHeight || sheet.offsetHeight || 640));
    cv.width  = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width  = w + "px";
    cv.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state = init(w, h);
  }
  size();

  let ro = null;
  try { ro = new ResizeObserver(size); ro.observe(host); } catch (e){}

  const t0 = performance.now();
  const keep = opt && opt.keep;
  const fade = opt && opt.fade;
  function frame(t){
    if (!alive) return;
    

    if (fade){
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0," + fade + ")";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    } else if (!keep) ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h, (t - t0) / 1000, state);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return function stop(){
    alive = false;
    cancelAnimationFrame(raf);
    if (ro) ro.disconnect();
    cv.remove();
  };
}



function fxWash(stage, css, cls){
  const d = document.createElement("div");
  d.className = "wash" + (cls ? " " + cls : "");
  d.style.background = css;
  stage.appendChild(d);
  return d;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

 
function bandX(w){
  return Math.random() < .5 ? rnd(4, w * .22) : rnd(w * .78, w - 4);
}



function fxSprite(size, paint){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  x.translate(size / 2, size / 2);
  paint(x, size);
  return c;
}





function fxBlurs(src, levels){
  const out = [src];
  for (let i = 1; i < levels; i++) out.push(fxSoften(src, 1 + i * 1.25, 0));
  return out;
}



function fxGlow(stops){
  return fxSprite(64, function (x){
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 32);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, 32, 0, 6.3); x.fill();
  });
}





function nHash(x, y, s){
  let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (s | 0) * 1274126177;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177) | 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function vnoise(x, y, s){
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = nHash(xi, yi, s),     b = nHash(xi + 1, yi, s);
  const c = nHash(xi, yi + 1, s), d = nHash(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}



function fbm(x, y, s, oct){
  let v = 0, amp = .5, f = 1;
  for (let i = 0; i < (oct || 5); i++){
    v += amp * vnoise(x * f, y * f, s + i * 37);
    f *= 2.03;
    amp *= .5;
  }
  return v;
}



function vnoiseP(x, y, s, per){
  const wrap = function (v){ return ((v % per) + per) % per; };
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v2 = yf * yf * (3 - 2 * yf);
  const x0 = wrap(xi), x1 = wrap(xi + 1);
  const y0 = wrap(yi), y1 = wrap(yi + 1);
  const a = nHash(x0, y0, s), b = nHash(x1, y0, s);
  const c = nHash(x0, y1, s), d = nHash(x1, y1, s);
  return (a * (1 - u) + b * u) * (1 - v2) + (c * (1 - u) + d * u) * v2;
}

function fbmP(x, y, s, oct, per){
  let v = 0, amp = .5, f = 1, pp = per;
  for (let i = 0; i < oct; i++){
    v += amp * vnoiseP(x * f, y * f, s + i * 37, pp);
    f *= 2;
    amp *= .5;
    pp *= 2;
  }
  return v;
}



function bakeCloud(size, seed, tint, thresh){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const img = x.createImageData(size, size);
  const d = img.data;
  const PER = 4;
  const sc = PER / size;

  const dens = new Float32Array(size * size);
  let lo = 1e9, hi = -1e9;
  for (let j = 0; j < size; j++){
    for (let i = 0; i < size; i++){
      const v = fbmP(i * sc, j * sc, seed, 5, PER);
      dens[j * size + i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  const span = (hi - lo) || 1;
  for (let k = 0; k < dens.length; k++) dens[k] = (dens[k] - lo) / span;

  const th = thresh == null ? .46 : thresh;
  const inv = 1 / (1 - th);
  const at = function (i, j){
    let a = i | 0, b = j | 0;
    a = ((a % size) + size) % size;
    b = ((b % size) + size) % size;
    return dens[b * size + a];
  };

  for (let j = 0; j < size; j++){
    for (let i = 0; i < size; i++){
      const k = j * size + i;
      let v = (dens[k] - th) * inv;
      if (v <= 0){ d[k * 4 + 3] = 0; continue; }
      if (v > 1) v = 1;
      const a = Math.pow(v, .52);

      

      let block = 0, wsum = 0;
      for (let q = 1; q <= 7; q++){
        const o = q * size * .026;
        const wq = 1 / q;
        const m = (at(i - o * .82, j - o) - th) * inv;
        block += (m > 0 ? (m > 1 ? 1 : m) : 0) * wq;
        wsum += wq;
      }
      block /= wsum;
      let lit = 1 - block * 1.02;
      if (lit < 0) lit = 0; else if (lit > 1) lit = 1;
      lit = lit * lit * (3 - 2 * lit);

      

      const k2 = .60 + .40 * lit;
       
      d[k * 4]     = tint[0] * k2;
      d[k * 4 + 1] = tint[1] * (k2 * .97 + .03);
      d[k * 4 + 2] = tint[2] * (k2 * .90 + .10);
      d[k * 4 + 3] = a * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}



function bakeDrop(size, squash){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const R = size * .40;
  const cx = size / 2, cy = size / 2;

  x.save();
  x.translate(cx, cy);
  x.scale(1, squash || 1);
  x.translate(-cx, -cy);

   
  const sh = x.createRadialGradient(cx + R * .12, cy + R * .20, R * .5,
                                    cx + R * .12, cy + R * .20, R * 1.22);
  sh.addColorStop(0,  "rgba(28,48,80,.20)");
  sh.addColorStop(.7, "rgba(28,48,80,.07)");
  sh.addColorStop(1,  "rgba(28,48,80,0)");
  x.fillStyle = sh;
  x.beginPath(); x.arc(cx + R * .12, cy + R * .20, R * 1.22, 0, 6.3); x.fill();

  

  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, 6.3); x.clip();
  const body = x.createLinearGradient(cx - R * .9, cy - R * .9, cx + R * .9, cy + R * .9);
  body.addColorStop(0,   "rgba(22,42,74,.22)");
  body.addColorStop(.30, "rgba(120,148,186,.06)");
  body.addColorStop(.58, "rgba(255,255,255,.03)");
  body.addColorStop(.84, "rgba(255,255,255,.22)");
  body.addColorStop(1,   "rgba(255,255,255,.58)");
  x.fillStyle = body;
  x.fillRect(cx - R, cy - R, R * 2, R * 2);
  x.restore();

   
  let rim = null;
  if (x.createConicGradient){
    rim = x.createConicGradient(-Math.PI * .75, cx, cy);
    rim.addColorStop(0,   "rgba(16,34,64,.50)");
    rim.addColorStop(.16, "rgba(40,66,104,.34)");
    rim.addColorStop(.34, "rgba(150,178,214,.16)");
    rim.addColorStop(.50, "rgba(255,255,255,.95)");
    rim.addColorStop(.66, "rgba(214,232,252,.44)");
    rim.addColorStop(.84, "rgba(60,90,132,.28)");
    rim.addColorStop(1,   "rgba(16,34,64,.50)");
  }
  x.strokeStyle = rim || "rgba(90,120,162,.46)";
  x.lineWidth = R * .30;
  x.globalAlpha = .40;
  x.beginPath(); x.arc(cx, cy, R * .86, 0, 6.3); x.stroke();
  x.globalAlpha = 1;
  x.lineWidth = R * .13;
  x.beginPath(); x.arc(cx, cy, R * .93, 0, 6.3); x.stroke();

   
  const pin = x.createRadialGradient(cx - R * .34, cy - R * .40, 0,
                                     cx - R * .34, cy - R * .40, R * .26);
  pin.addColorStop(0,  "rgba(255,255,255,1)");
  pin.addColorStop(.42, "rgba(255,255,255,.52)");
  pin.addColorStop(1,  "rgba(255,255,255,0)");
  x.fillStyle = pin;
  x.beginPath(); x.arc(cx - R * .34, cy - R * .40, R * .26, 0, 6.3); x.fill();

  x.restore();
  return c;
}






const PHI = 2.39996323;

function roseMix(a, b, f){
  return [Math.round(a[0] + (b[0] - a[0]) * f),
          Math.round(a[1] + (b[1] - a[1]) * f),
          Math.round(a[2] + (b[2] - a[2]) * f)];
}
function roseRGB(c, a){
  return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
}



function rosePetal(x, L, W, roll){
  x.beginPath();
  x.moveTo(0, 0);
  x.bezierCurveTo(W * .58, -L * .04, W * 1.02, -L * .40, W * .88, -L * .76);
  x.bezierCurveTo(W * .74, -L * 1.02, W * .28, -L * 1.07, roll * W * .10, -L * .93);
  x.bezierCurveTo(-W * .28, -L * 1.07, -W * .74, -L * 1.02, -W * .88, -L * .76);
  x.bezierCurveTo(-W * 1.02, -L * .40, -W * .58, -L * .04, 0, 0);
  x.closePath();
}



function crescent(x, r, span, thick, phase){
  const a0 = phase - span / 2, a1 = phase + span / 2;
  x.beginPath();
  x.arc(0, 0, r + thick, a0, a1, false);
  x.arc(0, 0, r, a1, a0, true);
  x.closePath();
}

 
const ROSE_WHORLS = [
  { n: 5, r: .10, L: 1.00, W: .56, roll: -1, open: 1.00, lift: .00, turn: .00 },
  { n: 5, r: .08, L: .80, W: .50, roll:  1, open: .88, lift: .08, turn: .62 },
  { n: 5, r: .06, L: .60, W: .44, roll: -1, open: .70, lift: .18, turn: 1.24 },
  { n: 4, r: .04, L: .44, W: .38, roll:  1, open: .48, lift: .30, turn: 1.86 }
];



function drawRose(x, cx, cy, R, rot, open, pal, seed){
  const o = clamp01(open);
  x.save();
  x.translate(cx, cy);

  for (let wi = 0; wi < ROSE_WHORLS.length; wi++){
    const W = ROSE_WHORLS[wi];
    const wo = clamp01((o - W.lift) / (1 - W.lift + .0001));
    const spread = .26 + .74 * wo * W.open;

    for (let i = 0; i < W.n; i++){
      const jitter = nHash(wi * 31 + i, seed | 0, 7);
      const a = rot + W.turn + (i / W.n) * 6.283 + (jitter - .5) * .22;
      const L = R * W.L * (.66 + .34 * spread) * (.92 + jitter * .16);
      const wd = R * W.W * (.74 + .26 * spread) * (.92 + jitter * .16);
      const rr = R * W.r * spread;

      x.save();
      x.rotate(a);
      x.translate(0, -rr);
      

      x.transform(1, 0, W.roll * (1 - spread) * .30, 1, 0, 0);

      const inner = roseMix(pal[0], pal[1], .30 + wi * .12);
      const outer = roseMix(pal[1], pal[2], .26 + wo * .52);
      const g = x.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0,   roseRGB(roseMix(inner, pal[0], .45), .99));
      g.addColorStop(.40, roseRGB(inner, .99));
      g.addColorStop(.82, roseRGB(outer, .98));
      g.addColorStop(1,   roseRGB(roseMix(outer, [255, 255, 255], .40), .94));
      x.fillStyle = g;
      rosePetal(x, L, wd, W.roll);
      x.fill();

       
      x.strokeStyle = roseRGB(roseMix(outer, [255, 255, 255], .62), .34);
      x.lineWidth = Math.max(.7, R * .016);
      x.beginPath();
      x.moveTo(-wd * .84, -L * .74);
      x.bezierCurveTo(-wd * .70, -L * 1.00, -wd * .26, -L * 1.05, W.roll * wd * .10, -L * .92);
      x.bezierCurveTo(wd * .26, -L * 1.05, wd * .70, -L * 1.00, wd * .84, -L * .74);
      x.stroke();

       
      x.fillStyle = roseRGB(roseMix(pal[0], [0, 0, 0], .55), .10);
      rosePetal(x, L * .62, wd * .58, W.roll);
      x.fill();

      x.restore();
    }
  }

   
  const hn = 13;
  let ph = rot + 2.40;
  for (let k = 0; k < hn; k++){
    const u = k / (hn - 1);
    const r = R * (.30 - .275 * u) * (.40 + .60 * o);
    const th = R * (.085 - .062 * u) * (.44 + .56 * o);
    if (r < .4 || th < .3) break;
    ph += .84 + u * .30;
    const c = roseMix(roseMix(pal[1], pal[0], .25 + u * .70), [0, 0, 0], u * .22);
    x.fillStyle = roseRGB(c, .99);
    crescent(x, r, 2.55 - u * .55, th, ph);
    x.fill();
    x.strokeStyle = roseRGB(roseMix(c, [255, 255, 255], .50), .30);
    x.lineWidth = Math.max(.5, R * .008);
    x.beginPath();
    x.arc(0, 0, r + th, ph - 1.2, ph + 1.2, false);
    x.stroke();
  }

   
  const hg = x.createRadialGradient(0, 0, 0, 0, 0, R * .10);
  hg.addColorStop(0,  roseRGB(roseMix(pal[0], [0, 0, 0], .62), .92));
  hg.addColorStop(1,  roseRGB(pal[0], 0));
  x.fillStyle = hg;
  x.beginPath(); x.arc(0, 0, R * .10, 0, 6.3); x.fill();

  x.restore();
}




 
function hslRose(hue, dark, mid, light){
  function hsl(h, s, l){
    h = ((h % 360) + 360) % 360 / 360;
    const q = l < .5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = function (t){
      t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
  }
  return [hsl(hue, .78, dark || .20), hsl(hue + 4, .72, mid || .46), hsl(hue + 10, .80, light || .72)];
}

const ROSE_PAL = {
  crimson: [[86, 8, 24],   [190, 26, 56],  [240, 104, 118]],
  blush:   [[128, 44, 66], [224, 124, 150],[255, 202, 216]],
  gold:    [[122, 66, 8],  [238, 166, 44], [255, 228, 152]],
  violet:  [[54, 24, 86],  [138, 66, 186], [222, 168, 248]],
  white:   [[96, 100, 116],[218, 222, 232],[255, 255, 255]],
  ember:   [[96, 14, 6],   [218, 72, 20],  [255, 172, 74]],
  ice:     [[68, 100, 140],[168, 206, 240],[238, 250, 255]],
  night:   [[24, 28, 60],  [74, 90, 164],  [164, 184, 242]],
  ash:     [[34, 32, 38],  [96, 92, 102],  [176, 172, 182]],
  

  black:   [[2, 2, 3],     [10, 9, 13],    [27, 25, 32]],
  wine:    [[38, 4, 14],   [104, 14, 36],  [168, 52, 76]],
  char:    [[3, 2, 2],     [16, 10, 9],    [70, 26, 16]],
  dusk:    [[104, 46, 60], [204, 136, 148],[246, 214, 214]],
  dried:   [[84, 52, 42],  [164, 120, 104],[224, 200, 182]]
};



function roseAtlas(pal, steps, size){
  const n = steps || 12, S = size || 200, out = [];
  for (let i = 0; i < n; i++){
    const c = document.createElement("canvas");
    c.width = c.height = S;
    drawRose(c.getContext("2d"), S / 2, S / 2, S * .46, 0, (i + 1) / n, pal, 7);
    out.push(c);
  }
  return out;
}

function stampRose(x, atlas, cx, cy, R, rot, open, alpha, filter){
  const i = Math.min(atlas.length - 1, Math.max(0, Math.round(clamp01(open) * atlas.length) - 1));
  const c = atlas[i];
  const D = R * 2 / .92;
  x.save();
  if (alpha != null) x.globalAlpha = alpha;
  if (filter) x.filter = filter;
  x.translate(cx, cy);
  x.rotate(rot);
  x.drawImage(c, -D / 2, -D / 2, D, D);
  x.restore();
}



function stampRoseSoft(x, atlas, cx, cy, R, rot, open, alpha){
  const f = clamp01(open) * (atlas.length - 1);
  const i = Math.floor(f), k = f - i;
  const D = R * 2 / .92;
  const A = alpha == null ? 1 : alpha;
  x.save();
  x.translate(cx, cy);
  x.rotate(rot);
  x.globalAlpha = A;
  x.drawImage(atlas[i], -D / 2, -D / 2, D, D);
  if (k > .004 && i + 1 < atlas.length){
    x.globalAlpha = A * k;
    x.drawImage(atlas[i + 1], -D / 2, -D / 2, D, D);
  }
  x.restore();
}



function petalSprite(pal, size, sheen){
  const S = size || 128;
  const sh = sheen == null ? .45 : sheen;    
  return fxSprite(S, function (x){
    const L = S * .44, W = S * .26;
    const g = x.createLinearGradient(0, L * .5, 0, -L);
    g.addColorStop(0,   roseRGB(pal[0], .98));
    g.addColorStop(.42, roseRGB(pal[1], .98));
    g.addColorStop(.88, roseRGB(pal[2], .96));
    g.addColorStop(1,   roseRGB(roseMix(pal[2], [255, 255, 255], sh), .90));
    x.translate(0, L * .5);
    x.fillStyle = g;
    rosePetal(x, L * 1.5, W, -1);
    x.fill();
    x.strokeStyle = roseRGB(roseMix(pal[0], [0, 0, 0], .3), .16);
    x.lineWidth = S * .008;
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(W * .12, -L * .8, 0, -L * 1.36);
    x.stroke();
  });
}



function vineMake(x0, y0, dir, budget, w, h, seed){
  const segs = [], thorns = [], buds = [], leaves = [];
  let px = x0, py = y0, a = dir, d = 0, i = 0;
  const wob = nHash(seed | 0, 11, 3) * 6.28;
  while (d < budget){
    a += Math.sin(d * .012 + wob) * .10 + (nHash(i, seed | 0, 5) - .5) * .13;
    const len = 13 + nHash(i, seed | 0, 9) * 9;
    const nx = px + Math.cos(a) * len;
    const ny = py + Math.sin(a) * len;
    if (nx < -70 || nx > w + 70 || ny < -70 || ny > h + 70) break;
    const u = d / budget;
    segs.push({ x1: px, y1: py, x2: nx, y2: ny, d: d, wd: 4.6 * (1 - u * .66) + 1.0 });
    if (i % 4 === 2) thorns.push({ x: nx, y: ny, a: a, d: d, s: 1 - u * .5,
                                   side: (i % 8 === 2 ? 1 : -1) });
    if (i % 7 === 3) leaves.push({ x: nx, y: ny, a: a, d: d, s: 1 - u * .4,
                                   side: (i % 14 === 3 ? 1 : -1) });
    if (i % 15 === 7 && u > .10) buds.push({ x: nx, y: ny, d: d, r: 24 + nHash(i, seed | 0, 3) * 22 });
    px = nx; py = ny; d += len; i++;
  }
  return { segs: segs, thorns: thorns, leaves: leaves, buds: buds, len: d || 1 };
}



function thornPath(x, t, g){
  const L = 17 * t.s * g;
  const nx = -Math.sin(t.a) * t.side, ny = Math.cos(t.a) * t.side;
  x.beginPath();
  x.moveTo(t.x + Math.cos(t.a) * 3, t.y + Math.sin(t.a) * 3);
  x.quadraticCurveTo(t.x + nx * L * .7 + Math.cos(t.a) * 2,
                     t.y + ny * L * .7 + Math.sin(t.a) * 2,
                     t.x + nx * L - Math.cos(t.a) * L * .55,
                     t.y + ny * L - Math.sin(t.a) * L * .55);
  x.quadraticCurveTo(t.x + nx * L * .3, t.y + ny * L * .3,
                     t.x - Math.cos(t.a) * 4, t.y - Math.sin(t.a) * 4);
  x.closePath();
}

function leafPath(x, l, g){
  const L = 21 * l.s * g;
  const ang = l.a + l.side * 1.0;
  const c = Math.cos(ang + Math.PI / 2), sn = Math.sin(ang + Math.PI / 2);
  const P = function (px, py){ return [l.x + px * c - py * sn, l.y + px * sn + py * c]; };
  const p0 = P(0, 0), p1 = P(L * .40, -L * .26), p2 = P(L * .40, -L * .74), p3 = P(0, -L);
  const p4 = P(-L * .40, -L * .74), p5 = P(-L * .40, -L * .26);
  x.beginPath();
  x.moveTo(p0[0], p0[1]);
  x.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  x.bezierCurveTo(p4[0], p4[1], p5[0], p5[1], p0[0], p0[1]);
  x.closePath();
}

function vineDraw(x, v, prog, ink, leafInk){
  x.lineCap = "round";
  x.strokeStyle = ink;
  for (const s of v.segs){
    if (s.d > prog) break;
    x.lineWidth = s.wd;
    x.beginPath();
    x.moveTo(s.x1, s.y1);
    x.lineTo(s.x2, s.y2);
    x.stroke();
  }
  x.fillStyle = ink;
  for (const t of v.thorns){
    if (t.d > prog) break;
    const g = clamp01((prog - t.d) / 26);
    const L = 17 * t.s * g, nx = -Math.sin(t.a) * t.side, ny = Math.cos(t.a) * t.side;
    x.beginPath();
    x.moveTo(t.x + Math.cos(t.a) * 3, t.y + Math.sin(t.a) * 3);
    x.quadraticCurveTo(t.x + nx * L * .7 + Math.cos(t.a) * 2,
                       t.y + ny * L * .7 + Math.sin(t.a) * 2,
                       t.x + nx * L - Math.cos(t.a) * L * .55,
                       t.y + ny * L - Math.sin(t.a) * L * .55);
    x.quadraticCurveTo(t.x + nx * L * .3, t.y + ny * L * .3,
                       t.x - Math.cos(t.a) * 4, t.y - Math.sin(t.a) * 4);
    x.closePath();
    x.fill();
  }
  x.fillStyle = leafInk || ink;
  for (const l of v.leaves){
    if (l.d > prog) break;
    const g = clamp01((prog - l.d) / 34);
    const L = 21 * l.s * g;
    if (L < 1) continue;
    const ang = l.a + l.side * 1.0;
    x.save();
    x.translate(l.x, l.y);
    x.rotate(ang + Math.PI / 2);
    x.beginPath();
    x.moveTo(0, 0);
    x.bezierCurveTo(L * .40, -L * .26, L * .40, -L * .74, 0, -L);
    x.bezierCurveTo(-L * .40, -L * .74, -L * .40, -L * .26, 0, 0);
    x.closePath();
    x.fill();
    x.restore();
  }
}

const EMBER_GLOW = fxGlow([
  [0,   "rgba(255,252,236,1)"],
  [.14, "rgba(255,206,110,1)"],
  [.42, "rgba(252,132,32,.60)"],
  [1,   "rgba(214,60,12,0)"]
]);

const STAR_GLOW = fxGlow([
  [0,  "rgba(255,255,255,1)"],
  [.3, "rgba(214,232,255,.80)"],
  [1,  "rgba(214,232,255,0)"]
]);

const MOTE_GLOW = fxGlow([
  [0, "rgba(255,251,240,1)"],
  [1, "rgba(255,232,186,0)"]
]);

function flakeSprite(kind){
  const SETS = [
    { arms: [[-18, 15], [-30, 12], [-41, 9]], tip: 0, w: 4.0, hub: 5.5 },
    { arms: [[-14, 10], [-26, 15], [-38, 10], [-46, 6]], tip: 1, w: 3.2, hub: 4.2 },
    { arms: [[-24, 18], [-40, 12]], tip: 2, w: 5.0, hub: 7.0 }
  ];
  const S = SETS[kind % SETS.length];
  return fxSprite(128, function (x){
    x.strokeStyle = "rgba(255,255,255,1)";
    x.fillStyle = "rgba(255,255,255,1)";
    x.lineCap = "round";
    x.lineJoin = "round";
    for (let i = 0; i < 6; i++){
      x.save();
      x.rotate(i * Math.PI / 3);
      x.lineWidth = S.w;
      x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -52); x.stroke();
      x.lineWidth = S.w * .76;
      for (let k = 0; k < S.arms.length; k++){
        const at = S.arms[k][0], len = S.arms[k][1];
        x.beginPath();
        x.moveTo(0, at); x.lineTo(len, at - len * .9);
        x.moveTo(0, at); x.lineTo(-len, at - len * .9);
        x.stroke();
      }
      if (S.tip === 1){
        x.beginPath();
        x.moveTo(0, -52); x.lineTo(7, -44); x.lineTo(0, -38); x.lineTo(-7, -44);
        x.closePath(); x.fill();
      } else if (S.tip === 2){
        x.lineWidth = S.w * .7;
        x.beginPath(); x.moveTo(-8, -46); x.lineTo(0, -52); x.lineTo(8, -46); x.stroke();
      }
      x.restore();
    }
    x.beginPath(); x.arc(0, 0, S.hub, 0, 6.3); x.fill();
  });
}




function fxGlassDrops(near, opt){
  const o = opt || {};
  const spr = o.tint ? [bakeDew(128, 1, o.tint), bakeDew(128, .92, o.tint), bakeDew(128, 1.06, o.tint)]
                     : [bakeDrop(128, 1), bakeDrop(128, .92), bakeDrop(128, 1.06)];
  return fxCanvas(near,
    function (w, h){
      const n = Math.round((w * h) / (o.dense || 5200));
      const p = [];
      for (let i = 0; i < n; i++){
        p.push({ x: rnd(4, w - 4), y: rnd(4, h - 4),
                 r: Math.pow(Math.random(), 2.3) * (o.big || 13) + 1.5,
                 s: spr[(Math.random() * 3) | 0],
                 v: 0, run: 0, wob: rnd(0, 6.3), trail: [] });
      }
      return { p: p, last: 0, w: w, h: h };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;

      for (const d of st.p){
        if (d.run === 0){
           
          const chance = (d.r - 3.4) * .0016 * (o.fast ? 6 : 1);
          if (chance > 0 && Math.random() < chance) d.run = 1;
        } else {
          d.v += (o.fast ? 1150 : 430) * dt * (.40 + d.r / 14);
          const ny = d.y + d.v * dt;
          d.trail.push({ x: d.x, y: d.y, r: d.r * rnd(.10, .24), a: .90 });
          if (d.trail.length > 52) d.trail.shift();
          d.x += Math.sin(t * 3 + d.wob) * 14 * dt;
          d.y = ny;

           
          for (const q of st.p){
            if (q === d || q.run !== 0) continue;
            if (Math.abs(q.x - d.x) < d.r * .9 && Math.abs(q.y - d.y) < d.r * 1.1){
              d.r = Math.min(o.big || 13, Math.sqrt(d.r * d.r + q.r * q.r * .75));
              q.r = rnd(1.6, 3);
              q.x = rnd(4, w - 4);
              q.y = rnd(4, h - 4);
            }
          }
          if (d.y - d.r > h){
            d.y = rnd(-40, -6);
            d.x = rnd(4, w - 4);
            d.r = Math.pow(Math.random(), 2.3) * (o.big || 13) + 1.5;
            d.v = 0; d.run = 0; d.trail.length = 0;
          }
        }

        for (let k = 0; k < d.trail.length; k++){
          const q = d.trail[k];
          q.a -= dt * .30;
          if (q.a <= 0) continue;
          const sz = q.r * 2;
          ctx.save();
          ctx.globalAlpha = q.a * .7;
          ctx.drawImage(d.s, q.x - sz / 2, q.y - sz / 2, sz, sz);
          ctx.restore();
        }

        const sz = d.r * 2.4;
        const stretch = d.run ? 1 + Math.min(.9, d.v / 700) : 1;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.drawImage(d.s, -sz / 2, -sz * stretch / 2, sz, sz * stretch);
        ctx.restore();
      }
    });
}




const BLOOM_HALO = fxGlow([
  [0,   "rgba(255,246,248,1)"],
  [.26, "rgba(255,218,228,.62)"],
  [.62, "rgba(244,178,198,.26)"],
  [1,   "rgba(226,150,176,0)"]
]);

const DUST_GLOW = fxGlow([
  [0, "rgba(255,252,250,1)"],
  [1, "rgba(255,236,242,0)"]
]);



function fxBloomRose(stage, palName, spin){
  const pal = ROSE_PAL[palName];
  const at = roseAtlas(pal, 22, 330);
  const RP = .22;
  const soft = at.map(function (c){ return fxSoften(c, 7, RP); });
  const PET = petalSprite(pal, 96);
  const SP = .3;
  const shade = petalShade(96, 4, SP);
  return fxCanvas(stage,
    function (w, h){
      const dust = [];
      for (let i = 0; i < (w < 520 ? 10 : 18); i++){
        dust.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(4, 9), v: rnd(5, 14),
                    ph: rnd(0, 6.3), a: rnd(.25, .55), tw: rnd(.6, 1.4) });
      }
      return { petals: [], shed: 0, next: 13, dust: dust, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const R  = Math.min(w, h) * .235;
      const cx = w * .5, cy = h * .44;

      const u = clamp01((t - .5) / 19);
      const open = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2.6) / 2;
      const breathe = 1 + Math.sin(t * .42) * .014 + Math.sin(t * .77 + 1.3) * .008;
      const rr = R * (.30 + .70 * open) * breathe;
      const rot = t * (spin || .030);

      const hs = R * (2.5 + open * 1.9) * breathe;
      ctx.save();
      ctx.globalAlpha = .2 + open * .3;
      ctx.drawImage(BLOOM_HALO, cx - hs / 2, cy - hs / 2, hs, hs);
      ctx.restore();

      stampRoseSoft(ctx, at, cx, cy, rr, rot, open, .5);
      stampRoseSoft(ctx, soft, cx, cy, rr * (1 + 2 * RP), rot, open, .55);

       
      if (t >= st.next && st.shed < 22){
        st.shed++;
        st.next = t + rnd(1.6, 3.2);
        const a = rnd(0, 6.3);
        const p = flutterNew(cx + Math.cos(a) * rr * .75, cy + Math.sin(a) * rr * .65, rnd(30, 44));
        p.drift = Math.cos(a) * rnd(6, 16);
        st.petals.push(p);
      }
      for (let i = st.petals.length - 1; i >= 0; i--){
        const p = st.petals[i];
        flutterStep(p, dt);
        if (p.y > h + 40){ st.petals.splice(i, 1); continue; }
        const a = clamp01(p.age / .6);
        const S = p.s * (1 + 2 * SP);
        ctx.save();
        ctx.translate(p.x + 14, p.y + 20);
        ctx.rotate(p.rot);
        ctx.scale(1, p.flip);
        ctx.globalAlpha = .13 * a;
        ctx.drawImage(shade, -S / 2, -S / 2, S, S);
        ctx.restore();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, p.flip);
        ctx.globalAlpha = .92 * a;
        ctx.drawImage(PET, -p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      }

      for (const d of st.dust){
        d.y -= d.v * dt;
        if (d.y < -12){ d.y = h + 12; d.x = rnd(0, w); }
        const sz = d.r * 2;
        ctx.globalAlpha = d.a * (.3 + open * .7) * (.55 + .45 * Math.sin(t * d.tw + d.ph));
        ctx.drawImage(GOLD_MOTE, d.x + Math.sin(d.y * .012 + d.ph) * 16 - sz / 2, d.y - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    });
}




 




function fxPetalRain(host, opt){
  const o = opt || {};
  const names = o.pals || ["crimson", "blush", "white"];
  const sets = names.map(function (n){ return fxBlurs(petalSprite(ROSE_PAL[n], 128, o.sheen), 4); });
  return fxCanvas(host,
    function (w, h){
      const sharp = o.sharp;
      const n = sharp ? Math.round(h / 110) + 3 : Math.round((w * h) / 12500) + 8;
      const p = [];
      for (let i = 0; i < n; i++){
        const depth = Math.random();
        p.push({ x: sharp ? bandX(w) : rnd(0, w), y: rnd(-h * .4, h * 1.1),
                 depth: depth,
                 s: (sharp ? .18 : .16) + depth * (sharp ? .30 : .64),
                 v: 16 + depth * 52, sw: rnd(14, 54), ph: rnd(0, 6.3),
                 rot: rnd(0, 6.3), rv: rnd(-1.5, 1.5),
                 tumble: rnd(.8, 2.2),
                 lod: Math.min(3, Math.round((1 - depth) * 3)),
                 set: sets[(Math.random() * sets.length) | 0],
                 a: (sharp ? .40 : .26) + depth * .52 });
      }
      return { p: p, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      

      const gust = (vnoise(t * .16, 2.3, 17) - .45) * 70;
      for (const q of st.p){
        q.y += q.v * dt;
        q.x += gust * (.4 + q.depth) * dt;
        q.rot += (q.rv + gust * .004) * dt;
        if (q.y > h + 70 || q.x < -90 || q.x > w + 90){
          q.y = rnd(-140, -50); q.x = o.sharp ? bandX(w) : rnd(-40, w + 40);
        }
        const turn = Math.cos(t * q.tumble + q.ph);
        const sz = 128 * q.s;
        ctx.save();
        ctx.globalAlpha = q.a * (.62 + .38 * Math.abs(turn));
        ctx.translate(q.x + Math.sin(t * .5 + q.ph) * q.sw, q.y);
        ctx.rotate(q.rot);
        ctx.scale(Math.max(.12, Math.abs(turn)), 1);
        ctx.drawImage(q.set[q.lod], -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
    });
}



function fxBokehPetals(host, pals){
  const PP = .35;
  const spr = pals.map(function (n){ return fxSoften(petalSprite(ROSE_PAL[n], 128), 9, PP); });
  return fxCanvas(host,
    function (w, h){
      const p = [];
      for (let i = 0; i < 4; i++){
        p.push({ x: bandX(w), y: rnd(-h, h), s: rnd(150, 230), v: rnd(26, 40), rot: rnd(0, 6.3),
                 rv: rnd(-.4, .4), ph: rnd(0, 6.3), k: i % spr.length });
      }
      return { p: p, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      for (const q of st.p){
        q.y += q.v * dt; q.rot += q.rv * dt;
        if (q.y > h + q.s){ q.y = -q.s; q.x = bandX(w); }
        const S = q.s * (1 + 2 * PP);
        ctx.save();
        ctx.globalAlpha = .34;
        ctx.translate(q.x + Math.sin(t * .3 + q.ph) * 30, q.y);
        ctx.rotate(q.rot);
        ctx.scale(Math.max(.3, Math.abs(Math.cos(t * .5 + q.ph))), 1);
        ctx.drawImage(spr[q.k], -S / 2, -S / 2, S, S);
        ctx.restore();
      }
    });
}











function fxVortex(stage, palName){
  const sets = [fxBlurs(petalSprite(ROSE_PAL[palName], 128), 4),
                fxBlurs(petalSprite(ROSE_PAL.blush, 128), 4),
                fxBlurs(petalSprite(ROSE_PAL.white, 128), 4)];
  return fxCanvas(stage,
    function (w, h){
      const n = Math.round((w * h) / 12000), p = [];
      const R = Math.max(w, h) * .78;
      for (let i = 0; i < n; i++){
        const depth = Math.random();
        const pick = Math.random();
        p.push({ r: Math.sqrt(Math.random()) * R, a: rnd(0, 6.3),
                 s: .22 + depth * .62, sp: (.10 + depth * .30) * (Math.random() < .12 ? -1 : 1),
                 pull: 8 + depth * 26, rot: rnd(0, 6.3), rv: rnd(-1.2, 1.2),
                 lod: Math.min(3, Math.round((1 - depth) * 3)), ph: rnd(0, 6.3), tb: rnd(.8, 2),
                 set: sets[pick < .6 ? 0 : pick < .85 ? 1 : 2],
                 a2: .22 + depth * .56, R: R });
      }
      const silk = [];
      for (let i = 0; i < 6; i++) silk.push({ a0: i / 6 * 6.283 + rnd(-.3, .3), k: rnd(.9, 1.3), ph: rnd(0, 6.3) });
      return { p: p, silk: silk, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const cx = w * .5, cy = h * .48;
      const Rs = Math.max(w, h) * .7;

      

      ctx.save();
      ctx.lineCap = "round";
      for (const s of st.silk){
        const a0 = s.a0 + t * .09;
        const alpha = .5 + .5 * Math.sin(t * .35 + s.ph);
        for (let pass = 0; pass < 2; pass++){
          ctx.beginPath();
          for (let i = 0; i <= 60; i++){
            const f = i / 60;
            const r = Rs * (1 - f * .85);
            const a = a0 + f * 3.4 * s.k;
            const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .82;
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.strokeStyle = pass ? "rgba(255,255,255," + (.42 * alpha).toFixed(3) + ")"
                                 : "rgba(140,96,190," + (.07 * alpha).toFixed(3) + ")";
          ctx.lineWidth = pass ? 1 : 5;
          ctx.stroke();
        }
      }
      ctx.restore();

      for (const q of st.p){
        q.a += q.sp * dt * (1 + 60 / (q.r + 40));
        q.r -= q.pull * dt;
        q.rot += q.rv * dt;
        if (q.r < 12){ q.r = q.R; q.a = rnd(0, 6.3); }
        const sz = 128 * q.s;
        ctx.save();
        ctx.globalAlpha = q.a2 * clamp01(q.r / 60);
        ctx.translate(cx + Math.cos(q.a) * q.r, cy + Math.sin(q.a) * q.r * .82);
        ctx.rotate(q.a + Math.PI / 2 + q.rot * .2);
        ctx.scale(Math.max(.18, Math.abs(Math.cos(t * q.tb + q.ph))), 1);
        ctx.drawImage(q.set[q.lod], -sz / 2, -sz / 2, sz, sz);
        ctx.restore();
      }
    });
}





function fxDewRose(stage, palName){
  const pal = ROSE_PAL[palName];
  const rose = roseAtlas(pal, 1, 320)[0];
  const RP = .15;
  const near = fxSoften(rose, 2.6, RP), far = fxSoften(rose, 6, RP);
  return fxCanvas(stage,
    function (){ return {}; },
    function (ctx, w, h, t, st){
      const R = Math.max(w, h) * .46;
      const D = R * 2 / .92 * (1 + 2 * RP);
      const focus = .5 + .5 * Math.sin(t * .16);
      ctx.save();
      ctx.translate(w * .40, h * .50);
      ctx.rotate(.3 + t * .012);
      ctx.globalAlpha = .3;
      ctx.drawImage(far, -D / 2, -D / 2, D, D);
      ctx.globalAlpha = .26 * focus;
      ctx.drawImage(near, -D / 2, -D / 2, D, D);
      ctx.restore();
      const lift = ctx.createRadialGradient(w * .30, h * .24, 0, w * .5, h * .5, Math.max(w, h) * .7);
      lift.addColorStop(0, "rgba(255,236,240,.05)");
      lift.addColorStop(1, "rgba(255,236,240,0)");
      ctx.fillStyle = lift;
      ctx.fillRect(0, 0, w, h);
    });
}



function bakeDew(size, squash, tint){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const R = size * .40, cx = size / 2, cy = size / 2;
  const T = tint || [150, 70, 96];
  x.save();
  x.translate(cx, cy); x.scale(1, squash || 1); x.translate(-cx, -cy);

  const sh = x.createRadialGradient(cx + R * .10, cy + R * .22, R * .55, cx + R * .10, cy + R * .22, R * 1.2);
  sh.addColorStop(0, roseRGB(T, .16));
  sh.addColorStop(1, roseRGB(T, 0));
  x.fillStyle = sh;
  x.beginPath(); x.arc(cx + R * .1, cy + R * .22, R * 1.2, 0, 6.3); x.fill();

  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, 6.3); x.clip();
  const body = x.createRadialGradient(cx, cy + R * .45, R * .1, cx, cy, R * 1.05);
  body.addColorStop(0,   "rgba(255,255,255,.62)");
  body.addColorStop(.45, roseRGB(roseMix(T, [255, 255, 255], .6), .16));
  body.addColorStop(.85, roseRGB(T, .14));
  body.addColorStop(1,   roseRGB(roseMix(T, [0, 0, 0], .35), .42));
  x.fillStyle = body;
  x.fillRect(cx - R, cy - R, R * 2, R * 2);
  const top = x.createLinearGradient(cx, cy - R, cx, cy);
  top.addColorStop(0, roseRGB(roseMix(T, [0, 0, 0], .45), .34));
  top.addColorStop(1, roseRGB(T, 0));
  x.fillStyle = top;
  x.fillRect(cx - R, cy - R, R * 2, R);
  x.restore();

  x.strokeStyle = "rgba(255,255,255,.55)";
  x.lineWidth = R * .07;
  x.beginPath(); x.arc(cx, cy, R * .9, Math.PI * .15, Math.PI * .85); x.stroke();

  const pin = x.createRadialGradient(cx - R * .34, cy - R * .40, 0, cx - R * .34, cy - R * .40, R * .28);
  pin.addColorStop(0,  "rgba(255,255,255,1)");
  pin.addColorStop(.4, "rgba(255,255,255,.55)");
  pin.addColorStop(1,  "rgba(255,255,255,0)");
  x.fillStyle = pin;
  x.beginPath(); x.arc(cx - R * .34, cy - R * .40, R * .28, 0, 6.3); x.fill();
  x.restore();
  return c;
}








function fxFrostRose(stage){
  const RP = .2;
  const warm = roseAtlas(ROSE_PAL.blush, 1, 260)[0], cold = roseAtlas(ROSE_PAL.ice, 1, 260)[0];
  const warmS = fxSoften(warm, 5, RP), coldS = fxSoften(cold, 5, RP);
  const FLAKE = fxGlow([
    [0,   "rgba(255,255,255,1)"],
    [.42, "rgba(240,248,255,.85)"],
    [.7,  "rgba(140,170,210,.26)"],
    [1,   "rgba(140,170,210,0)"]
  ]);

  

  function fern(x0, y0, a0, L, gen, d0, out){
    const n = gen ? 5 : 8;
    let px = x0, py = y0, a = a0;
    const bend = rnd(-.05, .05);
    for (let i = 0; i < n; i++){
      a += bend + rnd(-.06, .06);
      const len = L / n;
      const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
      const d = d0 + i * len;
      out.push({ x1: px, y1: py, x2: nx, y2: ny, d: d, w: Math.max(.45, (1.5 - gen * .5) * (1 - i / n * .6)) });
       
      if (gen < 2 && i > 0 && i < n - 1){
        const k = 1 - i / n;
        for (const sd of [-1, 1]){
          if (Math.random() < .9) fern(nx, ny, a + sd * 1.047 * rnd(.85, 1), L * (.42 * k + .08), gen + 1, d + len, out);
        }
      }
      px = nx; py = ny;
    }
  }

  return fxCanvas(stage,
    function (w, h){
      const dpr = Math.min(1.25, window.devicePixelRatio || 1);
      const bed = document.createElement("canvas");
      bed.width = Math.max(1, Math.round(w * dpr)); bed.height = Math.max(1, Math.round(h * dpr));
      const bx = bed.getContext("2d");
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bx.lineCap = "round";
      const narrow = w < 520;
      const segs = [];
      const reach = Math.min(w * (narrow ? .2 : .24), 220);
      const roots = [[0, 0, .78], [w, 0, 2.36], [0, h, -.78], [w, h, -2.36]];
      for (let i = 0; i < (narrow ? 3 : 5); i++){
        const y = rnd(h * .15, h * .9), left = i % 2 === 0;
        roots.push([left ? 0 : w, y, (left ? 0 : Math.PI) + rnd(-.5, .5)]);
      }
      for (const r of roots){
        const k = r[2];
        for (let j = 0; j < 2; j++) fern(r[0], r[1], k + rnd(-.45, .45), reach * rnd(.55, 1), 0, rnd(0, 40), segs);
      }
      segs.sort(function (a, b){ return a.d - b.d; });
      const p = [];
      const n = Math.round((w * h) / 9000);
      for (let i = 0; i < n; i++){
        const depth = Math.random();
        p.push({ x: rnd(0, w), y: rnd(-h, h), r: 1.2 + depth * 3.4, v: 10 + depth * 30,
                 sw: rnd(10, 40), ph: rnd(0, 6.3), a: .45 + depth * .5 });
      }
      return { bed: bed, bx: bx, segs: segs, at: 0, p: p, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const R = Math.min(w, h) * .23;
      const cx = w * .5, cy = h * .46;
      const freeze = clamp01((t - 1) / 22);
      const D = R * 2 / .92 * (1 + 2 * RP);
      const rot = -t * .015;

       
      const fr = ctx.createRadialGradient(cx, cy, Math.min(w, h) * .3, cx, cy, Math.max(w, h) * .75);
      fr.addColorStop(0, "rgba(255,255,255,0)");
      fr.addColorStop(1, "rgba(250,253,255," + (.5 * freeze).toFixed(3) + ")");
      ctx.fillStyle = fr;
      ctx.fillRect(0, 0, w, h);

       
      const Ds = R * 2 / .92;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.globalAlpha = .2;
      ctx.drawImage(warm, -Ds / 2, -Ds / 2, Ds, Ds);
      ctx.globalAlpha = .24 * freeze;
      ctx.drawImage(cold, -Ds / 2, -Ds / 2, Ds, Ds);
      ctx.globalAlpha = .26;
      ctx.drawImage(warmS, -D / 2, -D / 2, D, D);
      ctx.globalAlpha = .3 * freeze;
      ctx.drawImage(coldS, -D / 2, -D / 2, D, D);
      ctx.restore();

       
      const grow = 30 * t;
      const bx = st.bx;
      while (st.at < st.segs.length && st.segs[st.at].d <= grow){
        const s = st.segs[st.at++];
        bx.strokeStyle = "rgba(140,168,204,.20)";
        bx.lineWidth = s.w + 1.4;
        bx.beginPath(); bx.moveTo(s.x1 + .5, s.y1 + .6); bx.lineTo(s.x2 + .5, s.y2 + .6); bx.stroke();
        bx.strokeStyle = "rgba(255,255,255,.95)";
        bx.lineWidth = s.w;
        bx.beginPath(); bx.moveTo(s.x1, s.y1); bx.lineTo(s.x2, s.y2); bx.stroke();
      }
      ctx.drawImage(st.bed, 0, 0, w, h);

       
      for (let k = 0; k < 6; k++){
        const s = st.segs[(Math.floor(t * .7 + k * 97.3) * 131 + k * 17) % Math.max(1, st.at)];
        if (!s) continue;
        const g = Math.sin((t * .7 + k * .37) % 1 * Math.PI);
        const gs = 6 + g * 10;
        ctx.globalAlpha = g * .9;
        ctx.drawImage(FLAKE, s.x2 - gs / 2, s.y2 - gs / 2, gs, gs);
      }

      for (const q of st.p){
        q.y += q.v * dt;
        if (q.y > h + 6){ q.y = -6; q.x = rnd(0, w); }
        const gs = q.r * 4;
        ctx.globalAlpha = q.a * (.35 + .65 * freeze);
        ctx.drawImage(FLAKE, q.x + Math.sin(t * .5 + q.ph) * q.sw - gs / 2, q.y - gs / 2, gs, gs);
      }
      ctx.globalAlpha = 1;
    });
}





function fxRoseShadow(stage){
  return fxCanvas(stage,
    function (w, h){
      const v = [];
      for (let i = 0; i < 3; i++){
        v.push(vineMake(rnd(-40, w * .3), h + 20, -Math.PI / 2 + rnd(-.6, .2),
                        h * rnd(.9, 1.4), w, h, i * 71 + 13));
      }
      const sil = document.createElement("canvas");
      sil.width = w; sil.height = h;
      const sx = sil.getContext("2d");
      const R = Math.min(w, h) * .40;
      const flat = [[26, 30, 44], [26, 30, 44], [26, 30, 44]];
      for (const vv of v) vineDraw(sx, vv, vv.len, "rgba(26,30,44,1)", "rgba(26,30,44,1)");
      drawRose(sx, w * .30, h * .30, R * .62, .5, .92, flat, 3);
      drawRose(sx, w * .74, h * .60, R * .46, -.4, .84, flat, 9);
      const cut = [fxSoften(sil, 3.5, 0), fxSoften(sil, 9, 0)];
      const soft = cut.map(function (sh){
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const cx = c.getContext("2d");
        const g = cx.createRadialGradient(w * .42, h * .36, 0, w * .5, h * .5, Math.max(w, h) * .78);
        g.addColorStop(0, "rgba(255,232,196,.46)");
        g.addColorStop(.45, "rgba(236,196,150,.22)");
        g.addColorStop(1, "rgba(200,150,120,0)");
        cx.fillStyle = g;
        cx.fillRect(0, 0, w, h);
        cx.globalCompositeOperation = "destination-out";
        cx.drawImage(sh, 0, 0, w, h);
        return c;
      });
      const flecks = [];
      for (let i = 0; i < 9; i++){
        flecks.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(30, 90), ph: rnd(0, 6.3), sp: rnd(.15, .35) });
      }
      return { soft: soft, flecks: flecks };
    },
    function (ctx, w, h, t, st){
      const sway = Math.sin(t * .11);
      const mix = .5 + .5 * Math.sin(t * .09);

      ctx.save();
      ctx.translate(w * .5 + sway * w * .10, h * .5);
      ctx.transform(1, 0, sway * .34, 1, 0, 0);
      ctx.translate(-w * .5, -h * .5);
      ctx.globalAlpha = .54 * (1 - mix);
      ctx.drawImage(st.soft[0], 0, 0, w, h);
      ctx.globalAlpha = .54 * mix;
      ctx.drawImage(st.soft[1], 0, 0, w, h);
      ctx.restore();

       
      for (const f of st.flecks){
        const x = f.x + Math.sin(t * f.sp + f.ph) * 40 + sway * w * .06;
        const y = f.y + Math.cos(t * f.sp * .8 + f.ph) * 26;
        const a = .5 + .5 * Math.sin(t * f.sp * 2.1 + f.ph * 2);
        const g = ctx.createRadialGradient(x, y, 0, x, y, f.r);
        g.addColorStop(0, "rgba(255,236,200," + (.22 * a).toFixed(3) + ")");
        g.addColorStop(1, "rgba(255,246,222,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - f.r, y - f.r, f.r * 2, f.r * 2);
      }

      const beam = ctx.createLinearGradient(0, 0, w, h);
      beam.addColorStop(0,   "rgba(255,236,206,.10)");
      beam.addColorStop(.5,  "rgba(255,230,200,.04)");
      beam.addColorStop(1,   "rgba(240,238,246,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, w, h);
    });
}

 




 
function fxResample(src, w, h){
  const c = document.createElement("canvas");
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}



function fxSoften(src, k, pad){
  const p = pad || 0;
  const W = Math.round(src.width * (1 + 2 * p)), H = Math.round(src.height * (1 + 2 * p));
  let cur = document.createElement("canvas");
  cur.width = W; cur.height = H;
  cur.getContext("2d").drawImage(src, (W - src.width) / 2, (H - src.height) / 2);
  const tw = Math.max(2, Math.round(W / k)), th = Math.max(2, Math.round(H / k));
  let w = W, h = H;
  while (w > tw || h > th){
    w = Math.max(tw, Math.round(w / 2)); h = Math.max(th, Math.round(h / 2));
    cur = fxResample(cur, w, h);
  }
  while (w < W || h < H){
    w = Math.min(W, w * 2); h = Math.min(H, h * 2);
    cur = fxResample(cur, w, h);
  }
  return cur;
}



function fxSpare(ctx, w, h, k){
  const half = Math.min(w * .5, 330);
  const g = ctx.createLinearGradient(w / 2 - half, 0, w / 2 + half, 0);
  g.addColorStop(0,   "rgba(0,0,0,0)");
  g.addColorStop(.3,  "rgba(0,0,0," + k + ")");
  g.addColorStop(.7,  "rgba(0,0,0," + k + ")");
  g.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

 
function bakePuff(size, seed, rgb){
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const x = c.getContext("2d");
  const img = x.createImageData(size, size), d = img.data;
  const half = size / 2;
  for (let j = 0; j < size; j++){
    for (let i = 0; i < size; i++){
      const k = (j * size + i) * 4;
      const dx = (i - half) / half, dy = (j - half) / half;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= 1){ d[k + 3] = 0; continue; }
      const n = fbm(i / size * 3.4, j / size * 3.4, seed, 4);
      const edge = 1 - r * r * (3 - 2 * r);
      const a = clamp01((n - .24) * 2.5) * edge;
      d[k] = rgb[0]; d[k + 1] = rgb[1]; d[k + 2] = rgb[2];
      d[k + 3] = Math.round(Math.pow(a, 1.25) * 255);
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

 
function puffDraw(x, p, spr, s){
  const life = p.age / p.life;
  if (life >= 1) return false;
  const size = (p.r0 + p.grow * (1 - Math.exp(-p.age / p.tau))) * s;
  x.globalAlpha = p.a * clamp01(p.age / p.fin) * Math.pow(1 - life, 1.4);
  const c = Math.cos(p.rot), sn = Math.sin(p.rot);
  x.setTransform(c, sn, -sn, c, p.x * s, p.y * s);
  x.drawImage(spr[p.k], -size / 2, -size / 2, size, size);
  return true;
}



function flutterStep(p, dt){
  p.age += dt;
  p.ph += p.w * dt;
  p.vy = Math.min(p.term, p.vy + 30 * dt);
  p.y += p.vy * dt * (.7 + .6 * Math.abs(Math.sin(p.ph)));
  p.xc += p.drift * dt;
  const swing = clamp01(p.age / 1.2);
  p.x = p.xc + Math.sin(p.ph) * p.amp * swing;
  p.rot = p.r0 + Math.cos(p.ph) * .75 * swing + p.spin * p.age;
  p.flip = .28 + .72 * Math.abs(Math.cos(p.ph * .5 + p.fp));
}

function flutterNew(x, y, size){
  return { x: x, y: y, xc: x, vy: rnd(0, 6), term: rnd(28, 44), ph: rnd(0, 6.3),
           w: rnd(1.3, 2.1), amp: rnd(18, 42), drift: rnd(-6, 10), r0: rnd(0, 6.3),
           rot: 0, spin: rnd(-.25, .25), fp: rnd(0, 6.3), flip: 1, s: size, age: 0 };
}



function petalShade(size, k, pad){
  const S = size || 96;
  const c = fxSprite(S, function (x){
    const L = S * .44, W = S * .26;
    x.translate(0, L * .5);
    x.fillStyle = "rgba(20,22,34,1)";
    rosePetal(x, L * 1.5, W, -1);
    x.fill();
  });
  return fxSoften(c, k || 4, pad || 0);
}

 
const GOLD_MOTE = fxGlow([
  [0,   "rgba(255,240,206,1)"],
  [.35, "rgba(246,200,120,.55)"],
  [1,   "rgba(240,186,100,0)"]
]);



function fxInkWater(stage){
  const INK = [[222, 188, 124], [236, 226, 210], [206, 104, 132]];
  const SPOTS = [[-.04, .08], [1.04, .5], [.02, .96], [.98, .02], [-.03, .55], [1.03, .97]];

  function newPool(st, w, h, t, first){
    const m = Math.min(w, h);
    let at = SPOTS[st.spot++ % SPOTS.length];
    return { x: w * at[0], y: h * at[1], t0: t, rings: [], next: first ? .2 : 0,
             count: (w < 520 ? 11 : 14) + ((Math.random() * 4) | 0),
             scale: m * (w < 520 ? .075 : .085), life: rnd(55, 70), seed: rnd(0, 99),
             

             vx: rnd(-1, 1), vy: rnd(-1, 1), spin: Math.random() < .5 ? -1 : 1 };
  }

  return fxCanvas(stage,
    function (w, h){
      const st = { pools: [], spot: 0, last: 0 };
      return st;
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const narrow = w < 520;
      const want = narrow ? 2 : 3;

       
      if (st.pools.length < want && (!st.pools.length || t - st.pools[st.pools.length - 1].t0 > 2.4)){
        st.pools.push(newPool(st, w, h, t, !st.pools.length));
      }

      ctx.lineJoin = "round";
      for (let pi = st.pools.length - 1; pi >= 0; pi--){
        const P = st.pools[pi];
        const age = t - P.t0;
        if (age > P.life){ st.pools.splice(pi, 1); continue; }

        

        if (P.rings.length < P.count && age >= P.next){
          const r0 = P.scale * rnd(.55, 1.05);
          for (const g of P.rings) g.area += r0 * r0;
          const k = P.rings.length;
          const c = k % 3 === 0 ? 0 : (Math.random() < .18 ? 2 : 1);
          P.rings.push({ area: r0 * r0, r: 0, ink: r0 * r0 * rnd(1.2, 2.2), c: c,
                         a: c === 0 ? rnd(.55, .7) : rnd(.32, .45), wob: rnd(0, 99) });
          P.next = age + rnd(.45, .75);
        }

        const fade = clamp01(age / 1.2) * clamp01((P.life - age) / 6);
        const swirl = 56 * clamp01((age - 5) / 40);
        const S = .0036;
        let tw = clamp01((age - 3) / 34);
        tw = P.spin * 2.4 * tw * tw * (3 - 2 * tw);
        const Vx = P.x + P.vx * P.scale * 2.2, Vy = P.y + P.vy * P.scale * 2.2;
        const sig2 = 2 * Math.pow(P.scale * 3.4, 2);

        for (const g of P.rings){
          const target = Math.sqrt(g.area);
          g.r += (target - g.r) * Math.min(1, dt * 3.2);
          if (g.r < 1) continue;
          const lw = Math.max(1, Math.min(18, g.ink / (6.283 * g.r)));
          const n = Math.max(48, Math.min(200, Math.round(g.r * .8)));
          ctx.beginPath();
          for (let i = 0; i <= n; i++){
            const th = i / n * 6.2832;
            const ct = Math.cos(th), sn = Math.sin(th);
            const rr = g.r * (1 + .035 * (vnoise(ct * 1.6 + g.wob, sn * 1.6, 3) - .5));
            let x = P.x + ct * rr, y = P.y + sn * rr;
            if (tw){
              const ex = x - Vx, ey = y - Vy;
              const an = tw * Math.exp(-(ex * ex + ey * ey) / sig2);
              const ca = Math.cos(an), sa = Math.sin(an);
              x = Vx + ex * ca - ey * sa; y = Vy + ex * sa + ey * ca;
            }
            if (swirl > .5){
              const dx = vnoise(x * S + P.seed, y * S + t * .012, 11) - .5;
              const dy = vnoise(x * S + 40 + P.seed, y * S - t * .012, 12) - .5;
              x += dx * swirl * 2; y += dy * swirl * 2;
            }
            if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          }
          ctx.closePath();
           
          ctx.strokeStyle = roseRGB(INK[g.c], (g.a * fade * .16).toFixed(3));
          ctx.lineWidth = lw * 2.4 + 2;
          ctx.stroke();
          ctx.strokeStyle = roseRGB(INK[g.c], (g.a * fade).toFixed(3));
          ctx.lineWidth = lw;
          ctx.stroke();
        }
      }
      fxSpare(ctx, w, h, .62);
    });
}



function fxChroma(stage){
  const ORDER = ["white", "blush", "crimson", "wine", "dusk"];
  const SEQ = [0, 1, 2, 3, 4, 3, 2, 1];
  const HOLD = 6, MOVE = 4, STEP = HOLD + MOVE;
  const RP = .35, PP = .3;    

  const look = ORDER.map(function (n){
    const pal = ROSE_PAL[n];
    const rose = roseAtlas(pal, 1, 300)[0];
    const pet = petalSprite(pal, 128);
    return { far: fxSoften(rose, 16, RP), mid: fxSoften(rose, 5, RP),
             petal: fxSoften(pet, 2.5, PP), petalFar: fxSoften(pet, 7, PP), tint: pal[1] };
  });

  const prism = (function (){
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0,   "rgba(255,120,150,0)");
    g.addColorStop(.22, "rgba(255,150,150,.9)");
    g.addColorStop(.38, "rgba(255,212,140,.9)");
    g.addColorStop(.52, "rgba(170,236,190,.9)");
    g.addColorStop(.68, "rgba(140,200,255,.9)");
    g.addColorStop(.84, "rgba(186,150,255,.9)");
    g.addColorStop(1,   "rgba(186,150,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 64);
    x.globalCompositeOperation = "destination-in";
    const m = x.createLinearGradient(0, 0, 256, 0);
    m.addColorStop(0, "rgba(0,0,0,0)");
    m.addColorStop(.35, "rgba(0,0,0,1)");
    m.addColorStop(.65, "rgba(0,0,0,1)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = m;
    x.fillRect(0, 0, 256, 64);
    return c;
  })();

   
  function phase(t, lag){
    const pos = Math.max(0, t - lag) / STEP;
    const i = Math.floor(pos);
    const f = (pos - i) * STEP;
    let k = clamp01((f - HOLD) / MOVE);
    k = k * k * (3 - 2 * k);
    return { a: look[SEQ[i % SEQ.length]], b: look[SEQ[(i + 1) % SEQ.length]], k: k };
  }

  function drawPair(x, ph, key, cx, cy, D, rot, alpha){
    const A = ph.a[key], B = ph.b[key];
    x.save();
    x.translate(cx, cy);
    x.rotate(rot);
    x.globalAlpha = alpha;
    x.drawImage(A, -D / 2, -D / 2, D, D);
    if (ph.k > .004){
      x.globalAlpha = alpha * ph.k;
      x.drawImage(B, -D / 2, -D / 2, D, D);
    }
    x.restore();
  }

  function tintOf(ph){ return roseMix(ph.a.tint, ph.b.tint, ph.k); }

  return fxCanvas(stage,
    function (w, h){
      const p = [];
      const n = w < 520 ? 6 : 9;
      for (let i = 0; i < n; i++){
        const depth = Math.random();
        p.push({ x: rnd(0, w), y: rnd(-h * .2, h), depth: depth,
                 vx: -rnd(4, 10) * (.5 + depth), vy: rnd(7, 14) * (.5 + depth),
                 rot: rnd(0, 6.3), vr: rnd(-.3, .3), ph: rnd(0, 6.3), sw: rnd(.4, .9),
                 lag: rnd(0, 5) });
      }
      return { p: p, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const m = Math.min(w, h);
      const narrow = w < 520;

       
      const corners = [[0, 0, 0], [w, h, 3.5], [0, h, 2], [w, 0, 1.2]];
      for (const c of corners){
        const ph = phase(t, c[2]);
        const tc = tintOf(ph);
        const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], m * .75);
        g.addColorStop(0, roseRGB(tc, .20));
        g.addColorStop(.55, roseRGB(tc, .06));
        g.addColorStop(1, roseRGB(tc, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

       
      ctx.save();
      ctx.globalAlpha = .075 + .035 * Math.sin(t * .23);
      ctx.translate(w * (.62 + .05 * Math.sin(t * .05)), h * .32);
      ctx.rotate(-.62);
      ctx.drawImage(prism, -Math.max(w, h) * .75, -m * .11, Math.max(w, h) * 1.5, m * .22);
      ctx.restore();

      const RF = 1 + 2 * RP;

       
      const br = 1 + Math.sin(t * .31) * .02;
      drawPair(ctx, phase(t, 0), "far", -w * .02, h * .01,
               m * (narrow ? .62 : .84) * br * RF / .92, .3 + t * .008, .9);
      drawPair(ctx, phase(t, 3.5), "far", w * 1.03, h * 1.0,
               m * (narrow ? .7 : .96) * br * RF / .92, -.6 - t * .006, .9);

       
      drawPair(ctx, phase(t, 2), "mid", w * .04, h * .95,
               m * (narrow ? .26 : .34) * RF / .92, 1.1 + t * .012, .85);
      drawPair(ctx, phase(t, 1.2), "mid", w * .985, h * .34,
               m * (narrow ? .18 : .24) * RF / .92, -.4 - t * .01, .8);

       
      for (const q of st.p){
        q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
        if (q.y > h + 80 || q.x < -80){ q.y = rnd(-120, -40); q.x = rnd(w * .1, w + 60); }
        const turn = Math.cos(t * q.sw + q.ph);
        const sz = (26 + q.depth * 46) * (narrow ? .8 : 1) * (1 + 2 * PP);
        const ph = phase(t, q.lag);
        const key = q.depth > .55 ? "petal" : "petalFar";
        ctx.save();
        ctx.translate(q.x + Math.sin(t * .4 + q.ph) * 16, q.y);
        ctx.rotate(q.rot);
        ctx.scale(Math.max(.15, Math.abs(turn)), 1);
        ctx.globalAlpha = .5 + q.depth * .4;
        ctx.drawImage(ph.a[key], -sz / 2, -sz / 2, sz, sz);
        if (ph.k > .004){
          ctx.globalAlpha = (.5 + q.depth * .4) * ph.k;
          ctx.drawImage(ph.b[key], -sz / 2, -sz / 2, sz, sz);
        }
        ctx.restore();
      }
    });
}



function fxPyre(stage){
  const smoke = [0, 1, 2].map(function (v){ return bakePuff(96, 41 + v * 5, [86, 76, 72]); });
  const charRose = roseAtlas(ROSE_PAL.char, 1, 300)[0];
  const ashRose  = roseAtlas(ROSE_PAL.ash, 1, 300)[0];
  const EP = .25;
  const rimGlow  = fxSoften(roseAtlas(ROSE_PAL.ember, 1, 300)[0], 4, EP);
  const spots = [];
  for (let i = 0; i < 11; i++) spots.push({ a: rnd(0, 6.3), r: rnd(.15, .85), ph: rnd(0, 6.3), sp: rnd(1.5, 4), s: rnd(.08, .16) });
  const halo = fxGlow([
    [0,   "rgba(255,206,130,.95)"],
    [.28, "rgba(255,140,56,.55)"],
    [.62, "rgba(220,80,30,.16)"],
    [1,   "rgba(160,40,20,0)"]
  ]);
  const L = .5;

  return fxCanvas(stage,
    function (w, h){
      const low = document.createElement("canvas");
      low.width = Math.max(1, Math.round(w * L));
      low.height = Math.max(1, Math.round(h * L));
      const ash = [];
      const n = w < 520 ? 14 : 24;
      for (let i = 0; i < n; i++){
        ash.push({ x: rnd(0, w), y: rnd(0, h), vy: -rnd(6, 18), sw: rnd(10, 30), ph: rnd(0, 6.3),
                   rot: rnd(0, 6.3), vr: rnd(-1.2, 1.2), fl: rnd(1, 2.6), s: rnd(2, 5) });
      }
      return { low: low, lx: low.getContext("2d"), sparks: [], ash: ash, puffs: [],
               spark: 0, puff: 0, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const narrow = w < 520;
      const m = Math.min(w, h);
      const flick = .78 + .22 * vnoise(t * 2.4, 1.7, 5);
      const R = m * (narrow ? .2 : .23);
      const cx = w * (narrow ? .9 : .885), cy = h * (narrow ? .975 : .94);

       
      const g = ctx.createRadialGradient(w * .62, h * 1.14, 0, w * .62, h * 1.14, Math.max(w, h) * .9);
      g.addColorStop(0,   "rgba(255,150,70," + (.30 * flick).toFixed(3) + ")");
      g.addColorStop(.42, "rgba(255,176,116," + (.12 * flick).toFixed(3) + ")");
      g.addColorStop(1,   "rgba(255,190,140,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

       
      st.puff -= dt;
      if (st.puff <= 0 && st.puffs.length < 90){
        st.puff = narrow ? .5 : .32;
        const fromRose = Math.random() < .55;
        st.puffs.push({ x: fromRose ? cx + rnd(-R * .5, R * .5) : rnd(0, w),
                        y: fromRose ? cy - R * .3 : h + 30,
                        vx: rnd(-8, 4), vy: -rnd(16, 30),
                        r0: 40, grow: rnd(90, 170), tau: rnd(3, 5),
                        a: rnd(.05, .09), fin: 1.2, life: rnd(9, 13),
                        rot: rnd(0, 6.3), vr: rnd(-.15, .15), k: (Math.random() * 3) | 0, age: 0 });
      }
      const lx = st.lx;
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.clearRect(0, 0, st.low.width, st.low.height);
      for (let i = st.puffs.length - 1; i >= 0; i--){
        const p = st.puffs[i];
        p.age += dt;
        p.x += (p.vx + Math.sin(p.age * .7 + p.rot) * 6) * dt; p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (!puffDraw(lx, p, smoke, L)) st.puffs.splice(i, 1);
      }
      lx.setTransform(1, 0, 0, 1, 0, 0);
      lx.globalAlpha = 1;
      fxSpare(lx, st.low.width, st.low.height, .6);
      ctx.drawImage(st.low, 0, 0, w, h);

      

      const burn = clamp01((t - 3) / 48) * .78;
      const rot = .4 + t * .005;
      const D = R * 2 / .92;
      ctx.save();
      ctx.globalAlpha = .8 * flick;
      ctx.drawImage(halo, cx - R * 1.9, cy - R * 1.9, R * 3.8, R * 3.8);
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      const GD = D * 1.07 * (1 + 2 * EP);
      ctx.globalAlpha = (.95 - burn * .45) * flick;
      ctx.drawImage(rimGlow, -GD / 2, -GD / 2, GD, GD);
      ctx.globalAlpha = .98;
      ctx.drawImage(charRose, -D / 2, -D / 2, D, D);
      ctx.globalAlpha = burn;
      ctx.drawImage(ashRose, -D / 2, -D / 2, D, D);
       
      for (const sp of spots){
        const glow = .5 + .5 * Math.sin(t * sp.sp + sp.ph);
        const gs = R * sp.s * (1.6 + glow);
        ctx.globalAlpha = (.35 + .5 * glow) * (1 - burn * .7) * flick;
        ctx.drawImage(EMBER_GLOW, Math.cos(sp.a) * R * sp.r - gs / 2, Math.sin(sp.a) * R * sp.r - gs / 2, gs, gs);
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = (.16 + .12 * (1 - burn)) * flick;
      ctx.drawImage(halo, cx - R * 1.2, cy - R * 1.2, R * 2.4, R * 2.4);
      ctx.restore();

       
      st.spark -= dt;
      while (st.spark <= 0 && st.sparks.length < 150){
        st.spark += 1 / (narrow ? 7 : 12);
        const fromRose = Math.random() < .55;
        const a = rnd(Math.PI * 1.05, Math.PI * 1.95);
        st.sparks.push({ x: fromRose ? cx + Math.cos(a) * R * rnd(.2, .8) : rnd(0, w),
                         y: fromRose ? cy + Math.sin(a) * R * rnd(.2, .8) : h + 6,
                         vx: rnd(-22, 22), vy: -rnd(70, 150), age: 0, life: rnd(1.8, 4.2),
                         s: rnd(.8, 2.2), ph: rnd(0, 6.3) });
      }
      for (let i = st.sparks.length - 1; i >= 0; i--){
        const s = st.sparks[i];
        s.age += dt;
        if (s.age > s.life || s.y < -20){ st.sparks.splice(i, 1); continue; }
        s.vx += (vnoise(s.x * .012, t * .9, 3) - .5) * 220 * dt;
        s.vy -= 12 * dt;
        s.vx *= Math.pow(.5, dt);
        s.x += s.vx * dt; s.y += s.vy * dt;
        const heat = 1 - s.age / s.life;
        const tw = .65 + .35 * Math.sin(t * 19 + s.ph);
        const a = clamp01(heat * 1.6) * tw;
        ctx.strokeStyle = "rgba(255," + Math.round(96 + 120 * heat) + "," + Math.round(30 + 70 * heat * heat) + "," + (a * .8).toFixed(3) + ")";
        ctx.lineWidth = s.s * (.5 + heat * .6);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * .06, s.y - s.vy * .06);
        ctx.stroke();
        const gs = s.s * (3 + heat * 6);
        ctx.globalAlpha = a;
        ctx.drawImage(EMBER_GLOW, s.x - gs / 2, s.y - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
      }

       
      ctx.fillStyle = "rgba(92,86,84,.42)";
      for (const f of st.ash){
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
        if (f.y < -12){ f.y = h + 12; f.x = rnd(0, w); }
        const fx = f.x + Math.sin(t * .5 + f.ph) * f.sw;
        ctx.save();
        ctx.translate(fx, f.y);
        ctx.rotate(f.rot);
        ctx.scale(Math.max(.2, Math.abs(Math.cos(t * f.fl + f.ph))), 1);
        ctx.beginPath();
        ctx.moveTo(-f.s, -f.s * .3);
        ctx.lineTo(f.s * .2, -f.s * .7);
        ctx.lineTo(f.s, f.s * .2);
        ctx.lineTo(-f.s * .3, f.s * .6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
}



function fxRoseGarden(stage){
  const ATL = [roseAtlas(ROSE_PAL.crimson, 12, 120), roseAtlas(ROSE_PAL.blush, 12, 120),
               roseAtlas(ROSE_PAL.white, 12, 120)];
  const PET = [petalSprite(ROSE_PAL.crimson, 64), petalSprite(ROSE_PAL.blush, 64)];

  const beam = (function (){
    const c = document.createElement("canvas");
    c.width = 64; c.height = 512;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0,  "rgba(255,244,214,0)");
    g.addColorStop(.5, "rgba(255,244,214,1)");
    g.addColorStop(1,  "rgba(255,244,214,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 512);
    x.globalCompositeOperation = "destination-in";
    const m = x.createLinearGradient(0, 0, 0, 512);
    m.addColorStop(0, "rgba(0,0,0,1)");
    m.addColorStop(.55, "rgba(0,0,0,.45)");
    m.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = m;
    x.fillRect(0, 0, 64, 512);
    return c;
  })();

   
  function climb(side, w, h, seed, far){
    const band = Math.min(w * (far ? .24 : .18), far ? 190 : 150);
    const home = side < 0 ? band * .42 : w - band * .42;
    let px = side < 0 ? rnd(2, band * .7) : w - rnd(2, band * .7);
    let py = h + 16, a = -Math.PI / 2, d = 0, i = 0;
    const budget = h * rnd(far ? .7 : .5, far ? 1.05 : .95);
    const segs = [], leaves = [], thorns = [], flowers = [];
    const wob = nHash(seed, 3, 1) * 6.3;
    while (d < budget && py > h * .03){
      const want = -Math.PI / 2 + Math.max(-1, Math.min(1, (home - px) / band)) * .55;
      a += (want - a) * .14 + (nHash(i, seed, 5) - .5) * .2 + Math.sin(d * .018 + wob) * .05;
      const len = 10 + nHash(i, seed, 9) * 5;
      const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
      const u = d / budget;
      segs.push({ x1: px, y1: py, x2: nx, y2: ny, d: d, wd: (far ? 2.2 : 3.1) * (1 - u * .68) + .55 });
      if (i % 3 === 1) thorns.push({ x: nx, y: ny, a: a, d: d, s: (1 - u * .5) * (far ? .45 : .62),
                                     side: (i % 6 === 1 ? 1 : -1) });
      if (i % 5 === 3) leaves.push({ x: nx, y: ny, a: a, d: d, s: (1 - u * .35) * (far ? .75 : 1),
                                     side: (i % 10 === 3 ? 1 : -1) });
      if (i % 9 === 6 && u > .18){
        const sd = (i % 18 === 6) ? 1 : -1;
        const nrm = a + sd * Math.PI / 2;
        const off = rnd(10, 18);
        flowers.push({ sx: nx, sy: ny, x: nx + Math.cos(nrm) * off, y: ny + Math.sin(nrm) * off,
                       d: d, r: rnd(11, 17) * (far ? .8 : 1),
                       open: Math.random() < .35 ? rnd(.22, .4) : rnd(.75, 1),
                       pal: Math.random() < .5 ? 0 : Math.random() < .7 ? 1 : 2,
                       rot: rnd(0, 6.3), ph: rnd(0, 6.3), next: rnd(6, 16) });
      }
      px = nx; py = ny; d += len; i++;
    }
    flowers.push({ sx: px, sy: py, x: px + Math.cos(a) * 9, y: py + Math.sin(a) * 9, d: d,
                   r: rnd(17, 23) * (far ? .8 : 1), open: rnd(.85, 1), pal: far ? 1 : 0,
                   rot: rnd(0, 6.3), ph: rnd(0, 6.3), next: rnd(6, 16) });
    return { segs: segs, leaves: leaves, thorns: thorns, flowers: flowers, len: d || 1,
             far: far, seg: 0, done: { leaf: 0, thorn: 0 }, rate: rnd(.85, 1.1), prog: 0 };
  }

  const INK  = ["rgba(48,62,42,.9)",  "rgba(120,140,128,.42)"];
  const LEAF = [["rgba(40,70,44,.92)", "rgba(104,140,88,.88)"],
                ["rgba(130,156,136,.40)", "rgba(170,190,168,.34)"]];

   
  function leaf3(x, l, g, far){
    if (g <= .02) return;
    const L = 15 * l.s * g;
    const ang = l.a + l.side * .95;
    x.save();
    x.translate(l.x, l.y);
    x.rotate(ang);
    x.strokeStyle = INK[far];
    x.lineWidth = .9;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(L * .9, 0); x.stroke();
    const parts = [[L * .9, 0, 0, 1], [L * .45, 0, -.9, .78], [L * .45, 0, .9, .78]];
    for (const p of parts){
      x.save();
      x.translate(p[0], p[1]);
      x.rotate(p[2]);
      const s = L * p[3];
      const gr = x.createLinearGradient(0, 0, s, 0);
      gr.addColorStop(0, LEAF[far][0]);
      gr.addColorStop(1, LEAF[far][1]);
      x.fillStyle = gr;
      x.beginPath();
      x.moveTo(0, 0);
      x.bezierCurveTo(s * .3, -s * .42, s * .78, -s * .36, s, 0);
      x.bezierCurveTo(s * .78, s * .36, s * .3, s * .42, 0, 0);
      x.closePath();
      x.fill();
      if (!far){
        x.strokeStyle = "rgba(210,228,190,.32)";
        x.lineWidth = .6;
        x.beginPath(); x.moveTo(s * .08, 0); x.lineTo(s * .86, 0); x.stroke();
      }
      x.restore();
    }
    x.restore();
  }

  return fxCanvas(stage,
    function (w, h){
      const dpr = Math.min(1.25, window.devicePixelRatio || 1);
      const bed = document.createElement("canvas");
      bed.width = Math.max(1, Math.round(w * dpr));
      bed.height = Math.max(1, Math.round(h * dpr));
      const bx = bed.getContext("2d");
      bx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bx.lineCap = "round";
      const narrow = w < 520;
      const vines = [];
      let seed = 7;
      for (const side of [-1, 1]){
        vines.push(climb(side, w, h, seed++, 1));
        if (!narrow) vines.push(climb(side, w, h, seed++, 1));
        vines.push(climb(side, w, h, seed++, 0));
        if (!narrow) vines.push(climb(side, w, h, seed++, 0));
      }
      vines.sort(function (a, b){ return b.far - a.far; });
      const motes = [];
      for (let i = 0; i < (narrow ? 16 : 30); i++){
        motes.push({ x: rnd(0, w), y: rnd(0, h * .8), vx: rnd(-4, 4), vy: rnd(-3, 3),
                     s: rnd(3, 8), ph: rnd(0, 6.3), tw: rnd(.6, 1.6) });
      }
      return { bed: bed, bx: bx, vines: vines, motes: motes, fall: [], last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const grow = 1 - Math.pow(1 - clamp01(t / 16), 2.2);

       
      ctx.save();
      for (let k = 0; k < 3; k++){
        const bw = Math.max(w, h) * (.10 + k * .05);
        ctx.globalAlpha = (.22 - k * .05) * (.75 + .25 * Math.sin(t * .21 + k * 1.7));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.translate(w * (.08 + k * .2), -h * .05);
        ctx.rotate(-.5);
        ctx.drawImage(beam, -bw / 2, 0, bw, Math.max(w, h) * 1.4);
      }
      ctx.restore();

       
      const bx = st.bx;
      for (const V of st.vines){
        V.prog = grow * V.len * V.rate * (V.far ? 1.08 : 1);
        bx.strokeStyle = INK[V.far];
        while (V.seg < V.segs.length && V.segs[V.seg].d <= V.prog){
          const q = V.segs[V.seg++];
          bx.lineWidth = q.wd;
          bx.beginPath(); bx.moveTo(q.x1, q.y1); bx.lineTo(q.x2, q.y2); bx.stroke();
        }
        bx.fillStyle = INK[V.far];
        while (V.done.thorn < V.thorns.length && V.thorns[V.done.thorn].d + 20 <= V.prog){
          thornPath(bx, V.thorns[V.done.thorn++], 1);
          bx.fill();
        }
        while (V.done.leaf < V.leaves.length && V.leaves[V.done.leaf].d + 40 <= V.prog){
          leaf3(bx, V.leaves[V.done.leaf++], 1, V.far);
        }
      }
      ctx.drawImage(st.bed, 0, 0, w, h);

       
      for (const V of st.vines){
        ctx.fillStyle = INK[V.far];
        for (let i = V.done.thorn; i < V.thorns.length && V.thorns[i].d <= V.prog; i++){
          thornPath(ctx, V.thorns[i], clamp01((V.prog - V.thorns[i].d) / 20));
          ctx.fill();
        }
        for (let i = V.done.leaf; i < V.leaves.length && V.leaves[i].d <= V.prog; i++){
          leaf3(ctx, V.leaves[i], clamp01((V.prog - V.leaves[i].d) / 40), V.far);
        }
      }

       
      for (const V of st.vines){
        for (const f of V.flowers){
          if (f.d > V.prog) continue;
          const o = clamp01((V.prog - f.d) / 120 + (t > 16 ? (t - 16) / 6 : 0));
          const e = o < .5 ? 2 * o * o : 1 - Math.pow(-2 * o + 2, 2.4) / 2;
          ctx.strokeStyle = INK[V.far];
          ctx.lineWidth = V.far ? .8 : 1.2;
          ctx.beginPath(); ctx.moveTo(f.sx, f.sy); ctx.lineTo(f.x, f.y); ctx.stroke();
          const nod = Math.sin(t * .5 + f.ph) * .05;
          stampRoseSoft(ctx, ATL[f.pal], f.x + nod * 6, f.y, f.r * (.3 + .7 * e) * (1 + nod * .2),
                        f.rot + nod, e * f.open, V.far ? .45 : .95);

          if (!V.far && e > .97 && f.open > .7 && st.fall.length < 10){
            f.next -= dt;
            if (f.next <= 0){
              f.next = rnd(9, 20);
              const p = flutterNew(f.x, f.y, rnd(14, 20));
              p.pal = f.pal === 0 ? 0 : 1;
              p.drift = (f.x < w / 2 ? 1 : -1) * rnd(2, 8);
              st.fall.push(p);
            }
          }
        }
      }

       
      for (let i = st.fall.length - 1; i >= 0; i--){
        const p = st.fall[i];
        flutterStep(p, dt);
        if (p.y > h + 30){ st.fall.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = .85;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, p.flip);
        ctx.drawImage(PET[p.pal], -p.s / 2, -p.s / 2, p.s, p.s);
        ctx.restore();
      }

       
      for (const q of st.motes){
        q.x += (q.vx + Math.sin(t * .3 + q.ph) * 3) * dt;
        q.y += (q.vy + Math.cos(t * .27 + q.ph) * 3) * dt;
        if (q.x < -10) q.x = w + 10; else if (q.x > w + 10) q.x = -10;
        if (q.y < -10) q.y = h * .8; else if (q.y > h * .85) q.y = -5;
        ctx.globalAlpha = .55 * (.5 + .5 * Math.sin(t * q.tw + q.ph)) * clamp01(t / 3);
        ctx.drawImage(GOLD_MOTE, q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalAlpha = 1;
    });
}



function fxWither(stage){
  const N = 24;
  const fresh = roseAtlas(ROSE_PAL.dusk, 10, 260);
  const dried = roseAtlas(ROSE_PAL.dried, 10, 260);
  const PF = petalSprite(ROSE_PAL.dusk, 96), PD = petalSprite(ROSE_PAL.dried, 96);
  const SP = .3;
  const shade = petalShade(96, 4, SP);
  const roseShade = fxSoften(roseAtlas(ROSE_PAL.black, 1, 200)[0], 7, .3);

  return fxCanvas(stage,
    function (w, h){
      return { p: [], shed: 0, next: 2.2, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const narrow = w < 520;
      const m = Math.min(w, h);
      const R0 = m * (narrow ? .16 : .18);
      const cx = w * (narrow ? .12 : .12), cy = h * (narrow ? .11 : .14);

      const shed = st.shed / N;
      const wither = clamp01(t / 70);
      const R = R0 * (1 - .22 * shed);
      const droop = .25 + .35 * shed + Math.sin(t * .4) * .02;

       
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * .9);
      g.addColorStop(0,  "rgba(255,226,196,.34)");
      g.addColorStop(.5, "rgba(255,232,210,.10)");
      g.addColorStop(1,  "rgba(255,236,220,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

       
      ctx.save();
      ctx.strokeStyle = "rgba(64,54,48,.82)";
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.8, R0 * .05);
      ctx.beginPath();
      ctx.moveTo(-20, cy + R0 * 2.6);
      ctx.bezierCurveTo(cx * .2, cy + R0 * 1.6, cx * .7, cy + R0 * 1.4, cx, cy + R * .5);
      ctx.stroke();
      ctx.translate(cx * .42, cy + R0 * 1.55);
      ctx.rotate(.9 + Math.sin(t * .5) * .04);
      ctx.scale(.7, .7);
      const lg = ctx.createLinearGradient(0, 0, R0 * .9, 0);
      lg.addColorStop(0, "rgba(70,74,52,.85)");
      lg.addColorStop(1, roseRGB(roseMix([120, 120, 84], [150, 120, 90], wither), .8));
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(R0 * .25, -R0 * .26, R0 * .7, -R0 * .2, R0 * .9, R0 * .06);
      ctx.bezierCurveTo(R0 * .6, R0 * .2, R0 * .25, R0 * .2, 0, 0);
      ctx.fill();
      ctx.restore();

       
      const open = 1 - .45 * shed;
      ctx.save();
      ctx.globalAlpha = .16;
      const sD = R * 2 / .92 * 1.6;
      ctx.drawImage(roseShade, cx + R * .28 - sD / 2, cy + R * .4 - sD / 2, sD, sD);
      ctx.restore();
      stampRoseSoft(ctx, fresh, cx, cy, R, droop, open, .97);
      if (wither > .01) stampRoseSoft(ctx, dried, cx, cy, R, droop, open, .97 * wither);

       
      if (t >= st.next && st.shed < N){
        st.shed++;
        st.next = t + rnd(1.8, 3.6);
        const a = rnd(-.4, Math.PI + .4);
        const p = flutterNew(cx + Math.cos(a) * R * .7, cy + Math.sin(a) * R * .55, rnd(26, 38) * (narrow ? .8 : 1));
        p.drift = rnd(4, 16);
        p.born = t;
        p.rest = false;
        p.restY = h - rnd(12, 64);
        st.p.push(p);
      }

      for (const p of st.p){
        if (!p.rest){
          flutterStep(p, dt);
          if (p.y >= p.restY){
            p.rest = true;
            p.y = p.restY;
            p.flip = rnd(.42, .58);
            p.restAt = t;
          }
        }
        const k = clamp01(wither + (t - p.born) / 40);
        const lie = p.rest ? clamp01((t - p.restAt) / 40) : 0;
        const alpha = .92 - .35 * lie;
        const lift = p.rest ? .15 : 1;
        const S = p.s * (1 + 2 * SP);

        ctx.save();
        ctx.translate(p.x + 12 * lift, p.y + 18 * lift);
        ctx.rotate(p.rot);
        ctx.scale(1, p.flip);
        ctx.globalAlpha = .15;
        ctx.drawImage(shade, -S / 2, -S / 2, S, S);
        ctx.restore();

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, p.flip);
        ctx.globalAlpha = alpha;
        ctx.drawImage(PF, -p.s / 2, -p.s / 2, p.s, p.s);
        if (k > .01){
          ctx.globalAlpha = alpha * k;
          ctx.drawImage(PD, -p.s / 2, -p.s / 2, p.s, p.s);
        }
        ctx.restore();
      }
    });
}



function fxRipplesDeep(stage){
  const PP = .3;
  const petal = petalSprite(ROSE_PAL.blush, 96);
  const petalSoft = fxSoften(petal, 5, PP);
  const petalSharp = fxSoften(petal, 1, PP);
  const shade = petalShade(96, 4, PP);

  function ring(ctx, x, y, r, lw, a){
    const hi = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    hi.addColorStop(0,  "rgba(255,255,255," + a.toFixed(3) + ")");
    hi.addColorStop(.5, "rgba(255,255,255," + (a * .3).toFixed(3) + ")");
    hi.addColorStop(1,  "rgba(255,255,255," + (a * .08).toFixed(3) + ")");
    ctx.strokeStyle = hi;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke();
    const lo = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    lo.addColorStop(0,  "rgba(44,66,104," + (a * .06).toFixed(3) + ")");
    lo.addColorStop(.5, "rgba(44,66,104," + (a * .18).toFixed(3) + ")");
    lo.addColorStop(1,  "rgba(44,66,104," + (a * .46).toFixed(3) + ")");
    ctx.strokeStyle = lo;
    ctx.lineWidth = lw * 1.1;
    ctx.beginPath(); ctx.arc(x, y, r + lw * 1.15, 0, 6.2832); ctx.stroke();
  }

  return fxCanvas(stage,
    function (w, h){
      return { drops: [], waves: [], floats: [], next: .4, n: 0, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      const narrow = w < 520;

       
      for (let k = 0; k < 2; k++){
        const lx = w * (.5 + .38 * Math.sin(t * .05 + k * 2.4));
        const ly = h * (.5 + .34 * Math.cos(t * .043 + k * 1.3));
        const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * .45);
        g.addColorStop(0, "rgba(255,255,255,.16)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      

      if (t >= st.next && st.drops.length < 2){
        let x, y;
        if (st.n === 0){ x = w * .3; y = h * .34; }
        else if (st.n === 1){ x = w * .7; y = h * .64; }
        else {
          for (let tries = 0; tries < 8; tries++){
            x = rnd(w * .1, w * .9); y = rnd(h * .12, h * .9);
            let ok = true;
            for (const f of st.floats){ if (Math.hypot(f.x - x, f.y - y) < 130){ ok = false; break; } }
            if (ok) break;
          }
        }
        st.drops.push({ x: x, y: y, age: 0, fall: 1.6, rot: rnd(0, 6.3), s: rnd(30, 40) * (narrow ? .85 : 1) });
        st.n++;
        st.next = t + (st.n === 1 ? 2.2 : rnd(2.8, 4.6));
      }

       
      for (let i = st.waves.length - 1; i >= 0; i--){
        const v = st.waves[i];
        const age = t - v.t0;
        if (age < 0) continue;
        if (age > v.life){ st.waves.splice(i, 1); continue; }
        const fade = Math.pow(1 - age / v.life, 1.3);
        const lead = age * v.speed;
        for (let k = 0; k < 4; k++){
          const r = lead - k * (12 + age * 3);
          if (r <= 2) continue;
          const a = Math.min(1, v.A * 1.15 * fade * (1 / (1 + r / 300)) * (1 - k * .2));
          ring(ctx, v.x, v.y, r, 1.8 + r * .01 + k * .3, a);
        }
      }

       
      for (let i = st.floats.length - 1; i >= 0; i--){
        const f = st.floats[i];
        f.age += dt;
        if (f.age > f.life){ st.floats.splice(i, 1); continue; }
        f.x += f.vx * dt; f.rot += f.vr * dt;
        const a = clamp01(f.age / .2) * clamp01((f.life - f.age) / 4);
        const bob = 1 + Math.sin(f.age * 2.2) * .025 * Math.exp(-f.age * .15) + .04 * Math.exp(-f.age * 3);
        const S = f.s * (1 + 2 * PP) * bob;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rot);
        ctx.globalAlpha = .14 * a;
        ctx.drawImage(shade, -S / 2 + 2, -S / 2 + 3, S, S);
        ctx.globalAlpha = .95 * a;
        ctx.drawImage(petalSharp, -S / 2, -S / 2, S, S);
        ctx.restore();
      }

      

      for (let i = st.drops.length - 1; i >= 0; i--){
        const d = st.drops[i];
        d.age += dt;
        const e = clamp01(d.age / d.fall);
        const near = Math.pow(1 - e, 2);
        if (e >= 1){
          st.drops.splice(i, 1);
          st.waves.push({ x: d.x, y: d.y, t0: t, life: 8.5, speed: 46, A: 1 });
          st.waves.push({ x: d.x, y: d.y, t0: t + .5, life: 6, speed: 40, A: .45 });
          st.floats.push({ x: d.x, y: d.y, s: d.s, rot: d.rot, vr: rnd(-.12, .12), vx: rnd(-3, 3),
                           age: 0, life: rnd(15, 20) });
          continue;
        }
        const rot = d.rot + near * 1.4;
        const S = d.s * (1 + 2 * PP) * (1 + near * 1.8);
        const So = d.s * (1 + 2 * PP) * (1 + near * .5);
        ctx.save();
        ctx.translate(d.x + near * 34, d.y + near * 46);
        ctx.rotate(rot);
        ctx.globalAlpha = .14 * e;
        ctx.drawImage(shade, -So / 2, -So / 2, So, So);
        ctx.restore();
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(rot);
        ctx.globalAlpha = clamp01(e * 2.5) * .95;
        ctx.drawImage(near > .25 ? petalSoft : petalSharp, -S / 2, -S / 2, S, S);
        ctx.restore();
      }
    });
}


/* ---- */
function fxAurora(stage) {
  const strip = (function (){
    const c = document.createElement("canvas");
    c.width = 4; c.height = 256;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0,   "rgba(170,110,230,0)");
    g.addColorStop(.35, "rgba(160,110,226,.55)");
    g.addColorStop(.7,  "rgba(70,200,190,.8)");
    g.addColorStop(.92, "rgba(90,230,160,1)");
    g.addColorStop(.97, "rgba(200,255,230,1)");
    g.addColorStop(1,   "rgba(90,230,160,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    return c;
  })();
  const L = .4;
  return fxCanvas(stage,
    function (w, h){
      const low = document.createElement("canvas");
      low.width = Math.max(1, Math.round(w * L)); low.height = Math.max(1, Math.round(h * L));
      const stars = [];
      for (let i = 0; i < (w < 520 ? 26 : 50); i++){
        const y = Math.pow(Math.random(), 1.6) * h * .3;
        stars.push({ x: rnd(0, w), y: y, s: rnd(1.5, 4), ph: rnd(0, 6.3), tw: rnd(.5, 2) });
      }
      return { low: low, lx: low.getContext("2d"), stars: stars };
    },
    function (ctx, w, h, t, st){
      const lx = st.lx, W = st.low.width, H = st.low.height;
      lx.clearRect(0, 0, W, H);

       
      const sky = ctx.createLinearGradient(0, 0, 0, h * .52);
      sky.addColorStop(0,   "rgba(10,18,40,.94)");
      sky.addColorStop(.3,  "rgba(18,32,62,.80)");
      sky.addColorStop(.62, "rgba(54,78,118,.30)");
      sky.addColorStop(1,   "rgba(120,140,170,0)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h * .52);
      for (const q of st.stars){
        ctx.globalAlpha = (.35 + .65 * (.5 + .5 * Math.sin(t * q.tw + q.ph))) * (1 - q.y / (h * .3)) ;
        ctx.drawImage(STAR_GLOW, q.x - q.s / 2, q.y - q.s / 2, q.s, q.s);
      }
      ctx.globalAlpha = 1;
      const curtains = [
        { base: .26, hgt: .24, seed: 3, sp: .045, a: 1.15 },
        { base: .33, hgt: .2,  seed: 9, sp: .065, a: .75 }
      ];
      for (const c of curtains){
        for (let x = -2; x < W + 2; x += 1){
          const fx = x / W;
           
          const by = H * (c.base + Math.sin(fx * 3.1 + t * .13 + c.seed) * .07
                                 + (fbm(fx * 2.4 + t * c.sp, c.seed, c.seed, 3) - .5) * .16);
          const hh = H * c.hgt * (.65 + .7 * fbm(fx * 2.6 + 10, t * .05, c.seed + 4, 2));
           
          const ray = Math.pow(vnoise(fx * 110 + t * .5, t * .9, c.seed + 2), 1.5) * .75
                    + vnoise(fx * 26 - t * .3, t * .4, c.seed + 5) * .45;
          const lit = Math.pow(clamp01(fbm(fx * 3.2 - t * c.sp * 1.5, t * .07, c.seed + 9, 3) * 1.7 - .3), 1.4);
          const a = Math.min(1, c.a * lit * ray);
          if (a < .01) continue;
          lx.globalAlpha = a;
          lx.drawImage(strip, x, by - hh, 1.2, hh);
        }
      }
      lx.globalAlpha = 1;
       
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(st.low, 0, 0, w, h);
      ctx.restore();
    });
}








function fxShatter(stage, isGold) {
  const host = fxNear(window.innerWidth <= 720);
  const lines = [];
  const GLINT = isGold ? fxGlow([[0, "rgba(255,252,230,1)"], [.3, "rgba(255,214,110,.75)"], [1, "rgba(255,170,40,0)"]])
                       : fxGlow([[0, "rgba(255,255,255,1)"], [.35, "rgba(220,236,255,.7)"], [1, "rgba(200,220,255,0)"]]);
  const cracks = fxCanvas(host,
    function (w, h) {
      const nodes = [];
      lines.length = 0;
      nodes.push({ x: 0, y: 0, a: rnd(0.2, 1.3), gen: 0, delay: 0 });
      nodes.push({ x: w, y: 0, a: rnd(1.8, 2.9), gen: 0, delay: 0 });
      nodes.push({ x: w, y: h, a: rnd(3.3, 4.4), gen: 0, delay: 0 });
      nodes.push({ x: 0, y: h, a: rnd(4.9, 6.0), gen: 0, delay: 0 });
      nodes.push({ x: w/2, y: 0, a: rnd(1.0, 2.0), gen: 0, delay: rnd(0.2, 0.5) });
      nodes.push({ x: 0, y: h/2, a: rnd(-0.5, 0.5), gen: 0, delay: rnd(0.2, 0.5) });
      nodes.push({ x: w, y: h/2, a: rnd(2.6, 3.6), gen: 0, delay: rnd(0.2, 0.5) });

      let head = 0;
      const safeX = w * 0.5;
      const safeRadiusX = w * 0.30;
      while (head < nodes.length && nodes.length < 350) {
        const n = nodes[head++];
        if (n.gen > 8) continue;
        if (Math.abs(n.x - safeX) < safeRadiusX) continue;
        const splits = Math.floor(rnd(1, 3));
        for (let i = 0; i < splits; i++) {
          let angle = n.a + (Math.random() < 0.5 ? rnd(-0.8, -0.2) : rnd(0.2, 0.8));
          const len = rnd(25, 75) * (1 - n.gen / 12);
          const nx = n.x + Math.cos(angle) * len;
          const ny = n.y + Math.sin(angle) * len;
          const delay = n.delay + rnd(0.05, 0.15);
          lines.push({ x1: n.x, y1: n.y, x2: nx, y2: ny, t: delay, drawn: false, gen: n.gen });
          nodes.push({ x: nx, y: ny, a: angle, gen: n.gen + 1, delay: delay });
        }
      }
      return { lines: lines };
    },
    function (ctx, w, h, t, st) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const l of st.lines) {
        if (!l.drawn && t > l.t) {
          l.drawn = true;
          if (isGold) {
            ctx.beginPath();
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
            ctx.strokeStyle = "rgba(255, 200, 50, 0.85)";
            ctx.shadowColor = "rgba(255, 140, 0, 0.6)";
            ctx.shadowBlur = 8;
            ctx.lineWidth = Math.max(0.4, 3.0 - l.gen * 0.3);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = Math.max(0.1, 1.2 - l.gen * 0.2);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(l.x1, l.y1);
            ctx.lineTo(l.x2, l.y2);
            ctx.strokeStyle = "rgba(28, 36, 50, 0.4)";
            ctx.lineWidth = Math.max(0.5, 2.5 - l.gen * 0.3);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(l.x1 - 0.8, l.y1 - 0.8);
            ctx.lineTo(l.x2 - 0.8, l.y2 - 0.8);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = Math.max(0.2, 1.2 - l.gen * 0.2);
            ctx.stroke();
          }
        }
      }
    }, { keep: true }
  );

  

  const glints = fxCanvas(host,
    function (){ return { g: [], next: 1.2, last: 0 }; },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      if (t >= st.next && lines.length){
        st.next = t + rnd(.5, 1.4);
        const start = lines[(Math.random() * lines.length) | 0];
        const path = [start];
        let cur = start;
        for (let k = 0; k < 6; k++){
          const nx = lines.filter(function (l){ return Math.abs(l.x1 - cur.x2) < .5 && Math.abs(l.y1 - cur.y2) < .5; });
          if (!nx.length) break;
          cur = nx[(Math.random() * nx.length) | 0];
          path.push(cur);
        }
        st.g.push({ path: path, age: 0, dur: .45 * path.length + .3 });
      }
      for (let i = st.g.length - 1; i >= 0; i--){
        const g = st.g[i];
        g.age += dt;
        const f = g.age / g.dur;
        if (f >= 1){ st.g.splice(i, 1); continue; }
        const at = f * g.path.length;
        const l = g.path[Math.min(g.path.length - 1, Math.floor(at))];
        const u = at - Math.floor(at);
        const x = l.x1 + (l.x2 - l.x1) * u, y = l.y1 + (l.y2 - l.y1) * u;
        const s = (isGold ? 18 : 14) * Math.sin(f * Math.PI);
        ctx.globalAlpha = Math.sin(f * Math.PI);
        ctx.drawImage(GLINT, x - s / 2, y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    });

  return function stop(){ cracks(); glints(); };
}



function fxGoldLeaf(stage){
  return fxCanvas(stage,
    function (w, h){
      const f = [];
      for (let i = 0; i < (w < 520 ? 12 : 22); i++){
        const pts = [];
        const n = 5 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n; k++){ const a = k / n * 6.283; pts.push([Math.cos(a) * rnd(.55, 1), Math.sin(a) * rnd(.55, 1)]); }
        f.push({ x: rnd(0, w), y: rnd(0, h), s: rnd(3, 8), vy: rnd(4, 12), sw: rnd(10, 30), ph: rnd(0, 6.3),
                 rot: rnd(0, 6.3), vr: rnd(-.6, .6), fl: rnd(.6, 1.6), pts: pts });
      }
      return { f: f, last: 0 };
    },
    function (ctx, w, h, t, st){
      const dt = Math.min(.085, t - st.last); st.last = t;
      for (const q of st.f){
        q.y += q.vy * dt; q.rot += q.vr * dt;
        if (q.y > h + 10){ q.y = -10; q.x = rnd(0, w); }
        const turn = Math.cos(t * q.fl + q.ph);
        const shine = Math.pow(Math.abs(turn), 6);
        ctx.save();
        ctx.translate(q.x + Math.sin(t * .4 + q.ph) * q.sw, q.y);
        ctx.rotate(q.rot);
        ctx.scale(Math.max(.15, Math.abs(turn)), 1);
        ctx.fillStyle = roseRGB(roseMix([176, 122, 30], [255, 236, 170], shine), .85);
        ctx.beginPath();
        for (let k = 0; k < q.pts.length; k++){
          const p = q.pts[k];
          if (k) ctx.lineTo(p[0] * q.s, p[1] * q.s); else ctx.moveTo(p[0] * q.s, p[1] * q.s);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
}




/* ============================================================
   THE THEMES, on the dark: each wash is a faint coloured light in the velvet
   ============================================================ */
const THEMES = {
  fioritura: { label: "Fioritura", build: function (stage){
      fxWash(stage, "radial-gradient(70% 60% at 50% 46%, rgba(132,26,58,.30) 0%, rgba(70,12,30,.16) 55%, transparent 100%)");
      return [fxBloomRose(stage, "crimson")]; } },
  cromatica: { label: "Cromatica", build: function (stage){
      fxWash(stage, "radial-gradient(80% 70% at 50% 50%, rgba(96,46,96,.20), transparent 80%)");
      return [fxChroma(stage)]; } },
  petali: { label: "Petali", build: function (stage){
      fxWash(stage, "linear-gradient(172deg, rgba(118,32,60,.24) 0%, rgba(46,12,26,.12) 60%, transparent 100%)");
      return [fxPetalRain(stage), fxPetalRain(fxNear(), { sharp: true }),
              fxBokehPetals(fxNear(), ["blush", "white", "blush"])]; } },
  spine: { label: "Sfiorire", build: function (stage){
      fxWash(stage, "linear-gradient(168deg, rgba(104,58,46,.22) 0%, rgba(40,20,16,.10) 60%, transparent 100%)");
      return [fxWither(stage)]; } },
  roseto: { label: "Roseto", build: function (stage){
      fxWash(stage, "radial-gradient(90% 80% at 50% 100%, rgba(46,90,58,.24) 0%, rgba(20,40,26,.10) 55%, transparent 100%)");
      return [fxRoseGarden(stage)]; } },
  vortice: { label: "Vortice", build: function (stage){
      fxWash(stage, "radial-gradient(70% 70% at 50% 48%, rgba(86,44,118,.30) 0%, rgba(40,20,56,.12) 60%, transparent 100%)");
      return [fxVortex(stage, "violet")]; } },
  rugiada: { label: "Rugiada", build: function (stage){
      fxWash(stage, "linear-gradient(168deg, rgba(86,46,70,.24) 0%, rgba(30,16,26,.10) 60%, transparent 100%)");
      return [fxDewRose(stage, "wine"), fxGlassDrops(fxNear(true), { dense: 2600, big: 8, tint: [236, 170, 196] })]; } },
  brace: { label: "Brace", fire: true, build: function (stage){
      fxWash(stage, "linear-gradient(0deg, rgba(132,44,12,.32) 0%, rgba(50,14,6,.14) 45%, transparent 78%)");
      return [fxPyre(stage)]; } },
  gelo: { label: "Gelo", build: function (stage){
      fxWash(stage, "linear-gradient(174deg, rgba(60,94,140,.28) 0%, rgba(20,32,54,.14) 60%, transparent 100%)");
      return [fxFrostRose(stage)]; } },
  dolore: { label: "Dolore", build: function (stage){
      fxWash(stage, "linear-gradient(180deg, rgba(64,74,96,.22) 0%, transparent 72%)");
      return [fxShatter(stage, false),
              fxPetalRain(stage, { pals: ["wine", "crimson", "wine"], sharp: false, sheen: .1 })]; } },
  kintsugi: { label: "Kintsugi", build: function (stage){
      fxWash(stage, "radial-gradient(80% 70% at 50% 50%, rgba(124,92,30,.22) 0%, transparent 76%)");
      return [fxShatter(stage, true), fxGoldLeaf(stage)]; } },
  inchiostro: { label: "Inchiostro", build: function (stage){
      fxWash(stage, "radial-gradient(90% 80% at 50% 50%, rgba(44,32,66,.26) 0%, transparent 82%)");
      return [fxInkWater(stage)]; } },
  risonanza: { label: "Risonanza", build: function (stage){
      fxWash(stage, "linear-gradient(176deg, rgba(30,74,104,.28) 0%, rgba(10,30,50,.14) 60%, transparent 100%)");
      return [fxRipplesDeep(stage)]; } },
  aurora: { label: "Aurora", build: function (stage){
      fxWash(stage, "linear-gradient(180deg, rgba(10,34,44,.34) 0%, transparent 62%)");
      return [fxAurora(stage)]; } },
  ombra: { label: "Ombra", build: function (stage){
      fxWash(stage, "radial-gradient(70% 60% at 50% 40%, rgba(84,62,40,.16) 0%, transparent 76%)");
      return [fxRoseShadow(stage)]; } },
  nessuno: { label: "Nessuno", build: function (){ return []; } }
};

const THEME_ALIAS = {
  fioritura:"fioritura", fiore:"fioritura", bloom:"fioritura", blooming:"fioritura", rosa:"fioritura", rose:"fioritura", cvijet:"fioritura", amore:"fioritura", love:"fioritura", ljubav:"fioritura",
  cromatica:"cromatica", colori:"cromatica", colours:"cromatica", colors:"cromatica", arcobaleno:"cromatica", rainbow:"cromatica", boje:"cromatica", sogni:"cromatica", dreams:"cromatica", snovi:"cromatica",
  petali:"petali", petalo:"petali", petals:"petali", latice:"petali", pioggia:"petali", caduta:"petali",
  spine:"spine", sfiorire:"spine", appassire:"spine", sfiorita:"spine", wither:"spine", withering:"spine", shed:"spine", venuti:"spine", spina:"spine", thorns:"spine", thorn:"spine", trnje:"spine", dolore:"spine", pain:"spine", hurt:"spine", bol:"spine",
  roseto:"roseto", giardino:"roseto", garden:"roseto", vrt:"roseto", speranza:"roseto", hope:"roseto", nada:"roseto", crescita:"roseto",
  vortice:"vortice", vortex:"vortice", spirale:"vortice", spiral:"vortice", vrtlog:"vortice", tempesta:"vortice", storm:"vortice", oluja:"vortice",
  rugiada:"rugiada", dew:"rugiada", rosa2:"rugiada", rosada:"rugiada", rosa_mattino:"rugiada", lacrime:"rugiada", tears:"rugiada", suze:"rugiada", solitudine:"rugiada", solitude:"rugiada",
  brace:"brace", fuoco:"brace", fire:"brace", embers:"brace", vatra:"brace", passione:"brace", passion:"brace", strast:"brace",
  gelo:"gelo", ghiaccio:"gelo", frost:"gelo", ice:"gelo", led:"gelo", inverno:"gelo", winter:"gelo", zima:"gelo", neve:"gelo",
  ombra:"ombra", ombre:"ombra", shadow:"ombra", shadows:"ombra", sjena:"ombra", sjene:"ombra", notte:"ombra", night:"ombra", ricordo:"ombra", memory:"ombra",dolore:"dolore", vetro:"dolore", shattered:"dolore", broken:"dolore",
  kintsugi:"kintsugi", oro:"kintsugi", gold:"kintsugi", mended:"kintsugi",
  inchiostro:"inchiostro", ink:"inchiostro", macchia:"inchiostro",
  risonanza:"risonanza", ripples:"risonanza", acqua:"risonanza", water:"risonanza",
  aurora:"aurora", borealis:"aurora", luci:"aurora", lights:"aurora",
  nessuno:"nessuno", none:"nessuno", "":"nessuno"
};

function themeKey(v){
  const k = String(v == null ? "" : v).trim().toLowerCase();
  return THEME_ALIAS[k] || (THEMES[k] ? k : "nessuno");
}


let fxStops = [];
function mountTheme(song){
  unmountTheme();
  const key = themeKey(song && song.theme);
  const th = THEMES[key] || THEMES.nessuno;
  try {
    const stops = th.build(stage) || [];
    fxStops = stops.filter(function (f){ return typeof f === "function"; });
  } catch (e){
    console.warn("[frammenti] theme failed:", key, e);
    fxStops = [];
  }
  sheet.classList.toggle("fire", !!th.fire);
  return key;
}
function unmountTheme(){
  for (const stop of fxStops){ try { stop(); } catch (e){} }
  fxStops = [];
  if (stage) stage.textContent = "";
  if (sheet){
    const nears = sheet.querySelectorAll(".near");
    for (let i = 0; i < nears.length; i++) nears[i].remove();
    sheet.classList.remove("fire");
  }
}
window.FX = {
  init: function (sh, st){ sheet = sh; stage = st; },
  mount: mountTheme,
  unmount: unmountTheme,
  key: themeKey,
  names: Object.keys(THEMES)
};

})();
