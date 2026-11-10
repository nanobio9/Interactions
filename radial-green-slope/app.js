// Interactive figure for "Discontinuity in Slope of the Radial Green Function".
// Shared by every language version; all user-visible text comes from the
// page's <script id="strings" type="application/json"> block.
//
// Exterior Dirichlet problem for a grounded sphere of radius a (= 1 here),
// Jackson Eq. (3.115):
//   g_l(r, r') = r_<^l / r_>^(l+1) − (1/a) (a² / r r')^(l+1)
// One-sided slopes at r = r' (a = 1):
//   left  = l / r'² + (l+1) / r'^(2l+3)
//   right = −(l+1) / r'² + (l+1) / r'^(2l+3)
//   jump  = right − left = −(2l+1) / r'²
(() => {
  const X_MAX = 8, Y_MAX = 0.8;       // fixed plot window: 0 ≤ r ≤ 8a, 0 ≤ g ≤ 0.8
  const TAN_HALF = 0.9;               // half-length (in r) of the drawn tangent lines
  const SAMPLES = 600;
  const M = { l: 50, r: 16, t: 26, b: 34 };   // plot margins (CSS px)
  const $ = id => document.getElementById(id);

  const STR = JSON.parse($('strings').textContent);
  const S = key => STR[key] ?? key;

  const cv = $('green-plot'), rpIn = $('rp'), rpOut = $('rp-o');
  const lButtons = [...document.querySelectorAll('[data-l]')];
  const state = { l: 1, rp: +rpIn.value };

  // ---------- physics (a = 1) ----------
  const g = (r, rp, l) => {
    const lo = Math.min(r, rp), hi = Math.max(r, rp);
    return lo ** l / hi ** (l + 1) - 1 / (r * rp) ** (l + 1);
  };
  const slopes = (rp, l) => {
    const img = (l + 1) / rp ** (2 * l + 3);
    return { left: l / rp ** 2 + img, right: -(l + 1) / rp ** 2 + img };
  };

  // ---------- drawing helpers ----------
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['bg', 'ink', 'muted', 'grid', 'axis', 'line', 'b1', 'b2', 'ext'])
      colors[k] = cs.getPropertyValue('--' + k).trim();
  }

  function fitCanvas() {
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

  // "base_sub" is drawn with a real subscript (italic base, smaller upright subscript)
  function mathLabel(ctx, text, x, y, color, px, align = 'left') {
    const [base, sub] = text.split('_');
    const fBase = `italic ${px}px "Times New Roman", serif`;
    const fSub = `${Math.round(px * 0.7)}px "Times New Roman", serif`;
    ctx.font = fBase; const wb = ctx.measureText(base).width;
    ctx.font = fSub; const ws = sub ? ctx.measureText(sub).width + 1 : 0;
    const x0 = align === 'center' ? x - (wb + ws) / 2 : align === 'right' ? x - wb - ws : x;
    ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = fBase; ctx.fillText(base, x0, y);
    if (sub) { ctx.font = fSub; ctx.fillText(sub, x0 + wb + 1, y + px * 0.25); }
  }

  function render() {
    const { ctx, w, h } = fitCanvas();
    const pw = w - M.l - M.r, ph = h - M.t - M.b;
    const X = r => M.l + (r / X_MAX) * pw;
    const Y = v => M.t + ph - (v / Y_MAX) * ph;
    const { l, rp } = state;

    // inside of the sphere (0 ≤ r < a): shaded, no curve
    ctx.save();
    ctx.globalAlpha = 0.18; ctx.fillStyle = colors.axis;
    ctx.fillRect(X(0), M.t, X(1) - X(0), ph);
    ctx.restore();
    ctx.save();
    ctx.translate((X(0) + X(1)) / 2, M.t + ph / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = colors.muted; ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(S('inside'), 0, 0);
    ctx.restore();

    // grid and axes
    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let r = 1; r <= X_MAX; r++) { ctx.moveTo(X(r), M.t); ctx.lineTo(X(r), M.t + ph); }
    for (let k = 1; k * 0.2 <= Y_MAX + 1e-9; k++) { ctx.moveTo(M.l, Y(k * 0.2)); ctx.lineTo(M.l + pw, Y(k * 0.2)); }
    ctx.stroke();
    ctx.strokeStyle = colors.axis; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(M.l, M.t); ctx.lineTo(M.l, M.t + ph); ctx.lineTo(M.l + pw, M.t + ph);
    ctx.stroke();

    ctx.fillStyle = colors.muted; ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let r = 0; r <= X_MAX; r++) ctx.fillText(String(r), X(r), M.t + ph + 6);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k * 0.2 <= Y_MAX + 1e-9; k++) ctx.fillText((k * 0.2).toFixed(1), M.l - 6, Y(k * 0.2));
    mathLabel(ctx, 'r / a', M.l + pw, M.t + ph + 30, colors.muted, 14, 'right');
    mathLabel(ctx, 'g_l', M.l + 6, M.t - 8, colors.muted, 15);

    // reference lines at r = a and r = r'
    ctx.save();
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.strokeStyle = colors.axis;
    ctx.beginPath(); ctx.moveTo(X(1), M.t); ctx.lineTo(X(1), M.t + ph); ctx.stroke();
    ctx.strokeStyle = colors.ext; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(X(rp), M.t); ctx.lineTo(X(rp), M.t + ph); ctx.stroke();
    ctx.restore();
    mathLabel(ctx, 'a', X(1) - 4, M.t + 12, colors.muted, 15, 'right');   // left of its line, so it never meets r′
    mathLabel(ctx, 'r′', X(rp) + 4, M.t + 12, colors.ext, 15);

    // everything below is clipped to the region outside the sphere
    ctx.save();
    ctx.beginPath(); ctx.rect(X(1), M.t, M.l + pw - X(1), ph); ctx.clip();

    const piece = (r0, r1, color) => {
      if (r1 <= r0) return;
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
      ctx.beginPath();
      const n = Math.max(2, Math.ceil(SAMPLES * (r1 - r0) / (X_MAX - 1)));
      for (let i = 0; i <= n; i++) {
        const r = r0 + (r1 - r0) * i / n;
        i ? ctx.lineTo(X(r), Y(g(r, rp, l))) : ctx.moveTo(X(r), Y(g(r, rp, l)));
      }
      ctx.stroke();
    };
    piece(1, rp, colors.b1);
    piece(rp, X_MAX, colors.b2);

    // one-sided tangents through (r', g(r', r'))
    const g0 = g(rp, rp, l), s = slopes(rp, l);
    ctx.save();
    ctx.setLineDash([6, 5]); ctx.lineWidth = 1.6; ctx.globalAlpha = 0.85;
    for (const [m, color] of [[s.left, colors.b1], [s.right, colors.b2]]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(X(rp - TAN_HALF), Y(g0 - m * TAN_HALF));
      ctx.lineTo(X(rp + TAN_HALF), Y(g0 + m * TAN_HALF));
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = colors.ext; ctx.strokeStyle = colors.bg; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(rp), Y(g0), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.restore();

    // readout
    const fmt = v => (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4).replace('-', '−');
    $('o-g').textContent = fmt(g0);
    $('o-sl').textContent = fmt(s.left);
    $('o-sr').textContent = fmt(s.right);
    $('o-jump').textContent = fmt(s.right - s.left);
    $('o-pred').textContent = fmt(-(2 * l + 1) / rp ** 2);
  }

  // ---------- controls ----------
  function sync() {
    state.rp = +rpIn.value;
    rpOut.textContent = state.rp.toFixed(2);
    for (const b of lButtons) b.setAttribute('aria-pressed', String(+b.dataset.l === state.l));
  }
  rpIn.addEventListener('input', () => { sync(); render(); });
  for (const b of lButtons) b.addEventListener('click', () => { state.l = +b.dataset.l; sync(); render(); });

  new ResizeObserver(() => render()).observe(cv);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); render(); });

  readColors();
  sync();
  render();

  window.addEventListener('DOMContentLoaded', () => {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
  });
})();
