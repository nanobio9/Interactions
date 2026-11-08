// Interactive figure for "Force-Center and Center-of-Mass Frames".
// Shared by every language version; all user-visible text comes from the
// page's <script id="strings" type="application/json"> block.
//
// Relative orbit (force-center frame), semi-latus rectum α = 1:
//   r(θ) = α / (1 + ε cos θ),  a = α / (1 − ε²),  b = a √(1 − ε²)
// Position at eccentric anomaly E (focus at the origin, periapsis on +x):
//   r = a (cos E − ε,  √(1 − ε²) sin E)
// Time enters through Kepler's equation  M = E − ε sin E,  M = 2π t / T.
// Center-of-mass frame, q = m₁/m₂ ≤ 1:
//   r₁ =  m₂/(m₁+m₂) r =  r/(1+q),   r₂ = −m₁/(m₁+m₂) r = −q r/(1+q)
(() => {
  const ALPHA = 1;               // semi-latus rectum
  const PERIOD = 8;              // seconds of screen time per orbit
  const SAMPLES = 240;           // points on each static orbit
  const PAD = 30;                // canvas padding (CSS px)
  const TAU = 2 * Math.PI;
  const $ = id => document.getElementById(id);

  const STR = JSON.parse($('strings').textContent);
  const S = key => STR[key] ?? key;

  const fc = $('fc-canvas'), cm = $('cm-canvas');
  const qIn = $('q'), eIn = $('ecc'), qOut = $('q-o'), eOut = $('ecc-o'), playBtn = $('play');

  // The motion is the content, so the page always starts playing; the
  // Pause button stops it (WCAG 2.2.2).
  const state = { q: +qIn.value, ecc: +eIn.value, M: 2.4, playing: true };

  // ---------- physics ----------
  function eccentricAnomaly(M, e) {
    M = ((M % TAU) + TAU) % TAU;
    let E = e > 0.8 ? Math.PI : M;
    for (let i = 0; i < 50; i++) {
      const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
      E -= d;
      if (Math.abs(d) < 1e-12) break;
    }
    return E;
  }

  function relPos(E, e) {
    const a = ALPHA / (1 - e * e);
    return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
  }

  function orbit(e, k) {            // static relative orbit scaled by k
    const pts = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const [x, y] = relPos(TAU * i / SAMPLES, e);
      pts.push([k * x, k * y]);
    }
    return pts;
  }

  // ---------- drawing helpers ----------
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'ink', 'muted', 'grid', 'axis', 'accent', 'b1', 'b2', 'ext'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
  }

  function fitCanvas(cv) {
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  // World → screen transform fitting all point sets into the canvas.
  function makeView(w, h, sets) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const pts of sets) for (const [x, y] of pts) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const s = Math.min((w - 2 * PAD) / (x1 - x0), (h - 2 * PAD) / (y1 - y0));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { s, X: x => w / 2 + (x - cx) * s, Y: y => h / 2 - (y - cy) * s };
  }

  function axes(ctx, v, w, h) {
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, v.Y(0)); ctx.lineTo(w, v.Y(0));
    ctx.moveTo(v.X(0), 0); ctx.lineTo(v.X(0), h);
    ctx.stroke();
  }

  function path(ctx, v, pts, color) {
    ctx.save();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(v.X(x), v.Y(y)) : ctx.moveTo(v.X(x), v.Y(y))));
    ctx.stroke();
    ctx.restore();
  }

  function dot(ctx, x, y, rad, color) {
    ctx.fillStyle = color; ctx.strokeStyle = colors.bg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill(); ctx.stroke();
  }

  function crossMark(ctx, x, y, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6);
    ctx.moveTo(x - 6, y + 6); ctx.lineTo(x + 6, y - 6);
    ctx.stroke();
  }

  // Text of the form "base_sub" is drawn with a real subscript (TeX style:
  // italic base, smaller upright subscript, lowered), since Unicode
  // subscript digits fall back to mismatched fonts in most serif faces.
  function parts(text, font) {
    const [base, sub] = text.split('_');
    const px = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)[1]);
    const subFont = font.replace(/italic\s*/, '').replace(/[\d.]+px/, Math.round(px * 0.7) + 'px');
    return { base, sub, px, subFont };
  }

  function measure(ctx, text, font) {
    const { base, sub, subFont } = parts(text, font);
    ctx.font = font;
    let w = ctx.measureText(base).width;
    if (sub) { ctx.font = subFont; w += 1 + ctx.measureText(sub).width; }
    return w;
  }

  function label(ctx, text, x, y, color, font) {
    const { base, sub, px, subFont } = parts(text, font);
    const w = measure(ctx, text, font);
    const by = y + px * 0.3;            // baseline that centers the x-height on y
    const pieces = [[base, font, x - w / 2, by]];
    if (sub) {
      ctx.font = font;
      pieces.push([sub, subFont, x - w / 2 + ctx.measureText(base).width + 1, by + px * 0.25]);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = colors.bg; ctx.fillStyle = color;
    for (const [t, f, tx, ty] of pieces) { ctx.font = f; ctx.strokeText(t, tx, ty); }
    for (const [t, f, tx, ty] of pieces) { ctx.font = f; ctx.fillText(t, tx, ty); }
  }

  // Label placed beside (x, y) in screen direction d (unit), clearing the
  // anchor by `gap` px whatever the text width.
  function labelAt(ctx, text, x, y, d, gap, color, font) {
    const hw = measure(ctx, text, font) / 2, hh = 8;
    const off = gap + Math.abs(d[0]) * hw + Math.abs(d[1]) * hh;
    label(ctx, text, x + d[0] * off, y + d[1] * off, color, font);
  }

  function arrow(ctx, x0, y0, x1, y1, color) {
    const ang = Math.atan2(y1 - y0, x1 - x0), hl = 10;
    const len = Math.hypot(x1 - x0, y1 - y0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    ctx.lineTo(x1 - Math.cos(ang) * Math.min(hl * 0.6, len), y1 - Math.sin(ang) * Math.min(hl * 0.6, len));
    ctx.stroke();
    if (len < hl) return;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hl * Math.cos(ang - 0.4), y1 - hl * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - hl * Math.cos(ang + 0.4), y1 - hl * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
  }

  function scaleBar(ctx, v, h) {
    const L = ALPHA * v.s, x = 14, y = h - 14;
    ctx.strokeStyle = colors.muted; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y); ctx.lineTo(x + L, y); ctx.lineTo(x + L, y - 4);
    ctx.stroke();
    ctx.font = 'italic 14px "Times New Roman", serif';
    ctx.fillStyle = colors.muted; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(S('alpha'), x + L + 6, y - 2);
  }

  const SERIF = 'italic 17px "Times New Roman", serif';
  const SERIF_BOLD = 'bold 17px "Times New Roman", serif';
  const SANS = '13px system-ui, sans-serif';

  // ---------- frames ----------
  function drawForceCenter(rel, rhat) {
    const { ctx, w, h } = fitCanvas(fc);
    const pts = orbit(state.ecc, 1);
    const v = makeView(w, h, [pts, [[0, 0]]]);
    axes(ctx, v, w, h);
    path(ctx, v, pts, colors.accent);

    const ox = v.X(0), oy = v.Y(0), px = v.X(rel[0]), py = v.Y(rel[1]);
    const u = [rhat[0], -rhat[1]];    // screen-space r̂
    const n = [-u[1], u[0]];
    arrow(ctx, ox, oy, px, py, colors.accent);
    dot(ctx, ox, oy, 6, colors.ext);
    dot(ctx, px, py, 6, colors.accent);

    labelAt(ctx, S('forceCenter'), ox, oy, [-n[0], -n[1]], 10, colors.ext, SANS);
    labelAt(ctx, S('r'), (ox + px) / 2, (oy + py) / 2, n, 4, colors.accent, SERIF_BOLD);
    scaleBar(ctx, v, h);
  }

  function drawCenterOfMass(rel, rhat) {
    const { ctx, w, h } = fitCanvas(cm);
    const k1 = 1 / (1 + state.q), k2 = -state.q / (1 + state.q);
    const pts1 = orbit(state.ecc, k1), pts2 = orbit(state.ecc, k2);
    const v = makeView(w, h, [pts1, pts2]);
    axes(ctx, v, w, h);
    path(ctx, v, pts1, colors.b1);
    path(ctx, v, pts2, colors.b2);

    const x1 = v.X(k1 * rel[0]), y1 = v.Y(k1 * rel[1]);
    const x2 = v.X(k2 * rel[0]), y2 = v.Y(k2 * rel[1]);
    const ox = v.X(0), oy = v.Y(0);
    const u = [rhat[0], -rhat[1]];    // screen-space r̂
    const n = [-u[1], u[0]];

    // m₂ – m₁ separation is the relative coordinate r
    ctx.save();
    ctx.strokeStyle = colors.muted; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.restore();

    // dot radius ∝ (mass)^(1/3), heaviest body = 8 px
    const r1 = Math.max(3, 8 * Math.cbrt(state.q)), r2 = 8;
    dot(ctx, x2, y2, r2, colors.b2);
    dot(ctx, x1, y1, r1, colors.b1);
    crossMark(ctx, ox, oy, colors.ext);

    labelAt(ctx, S('m1'), x1, y1, u, r1 + 4, colors.b1, SERIF);
    labelAt(ctx, S('m2'), x2, y2, [-u[0], -u[1]], r2 + 4, colors.b2, SERIF);
    labelAt(ctx, S('cm'), ox, oy, n, 10, colors.ext, SANS);
    scaleBar(ctx, v, h);
  }

  function render() {
    const E = eccentricAnomaly(state.M, state.ecc);
    const rel = relPos(E, state.ecc);
    const len = Math.hypot(rel[0], rel[1]);
    const rhat = [rel[0] / len, rel[1] / len];
    drawForceCenter(rel, rhat);
    drawCenterOfMass(rel, rhat);
  }

  // ---------- controls & animation ----------
  function syncControls() {
    state.q = +qIn.value; state.ecc = +eIn.value;
    qOut.textContent = state.q.toFixed(2);
    eOut.textContent = state.ecc.toFixed(2);
    playBtn.textContent = S(state.playing ? 'pause' : 'play');
  }

  qIn.addEventListener('input', () => { syncControls(); render(); });
  eIn.addEventListener('input', () => { syncControls(); render(); });
  playBtn.addEventListener('click', () => {
    state.playing = !state.playing;
    syncControls();
    if (state.playing) start();
  });

  let last = null, raf = 0;
  function tick(now) {
    if (!state.playing) { raf = 0; last = null; return; }
    if (last !== null) state.M = (state.M + TAU * Math.min(now - last, 100) / 1000 / PERIOD) % TAU;
    last = now;
    render();
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf) raf = requestAnimationFrame(tick); }

  new ResizeObserver(() => render()).observe(fc);
  new ResizeObserver(() => render()).observe(cm);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); render(); });

  readColors();
  syncControls();
  render();
  start();

  window.addEventListener('DOMContentLoaded', () => {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
  });
})();
