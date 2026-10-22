// Interactive figure for "Why Lagrange multipliers?".
// Shared by every language version; all user-visible text comes from the
// page's <script id="strings" type="application/json"> block.
(() => {
  const A = 2, B = 1;            // ellipse semi-axes
  const VIEW = 2.7;              // half-width of the plane view (world units)
  const DEG = Math.PI / 180;
  const $ = id => document.getElementById(id);

  const STR = JSON.parse($('strings').textContent);
  const S = (key, vars = {}) => (STR[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

  const state = { theta: 30, phi: -20, indep: 'x', t: 60 * DEG, grad: true, tan: true, levels: true };
  let model = null;

  // ---------- math ----------
  const quad = (Q, v) => Q[0][0] * v[0] * v[0] + 2 * Q[0][1] * v[0] * v[1] + Q[1][1] * v[1] * v[1];
  const mul = (Q, v) => [Q[0][0] * v[0] + Q[0][1] * v[1], Q[1][0] * v[0] + Q[1][1] * v[1]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const norm = v => Math.hypot(v[0], v[1]);

  function buildModel() {
    const th = state.theta * DEG, ph = state.phi * DEG;
    const c = Math.cos(th), s = Math.sin(th);
    const gxy = c * s * (1 / (A * A) - 1 / (B * B));
    const G = [[c * c / (A * A) + s * s / (B * B), gxy], [gxy, s * s / (A * A) + c * c / (B * B)]];
    const c2 = Math.cos(2 * ph), s2 = Math.sin(2 * ph);
    const M = [[c2, s2], [s2, -c2]];
    const detG = G[0][0] * G[1][1] - G[0][1] ** 2;
    const detM = M[0][0] * M[1][1] - M[0][1] ** 2;
    const tr = M[0][0] * G[1][1] + M[1][1] * G[0][0] - 2 * M[0][1] * G[0][1];
    // det(M − λG) = 0 ⇒ detG λ² − tr λ + detM = 0
    const disc = Math.sqrt(Math.max(0, tr * tr - 4 * detG * detM));
    const lams = [(tr + disc) / (2 * detG), (tr - disc) / (2 * detG)];
    const extrema = [];
    lams.forEach((lam, k) => {
      const r0 = [M[0][0] - lam * G[0][0], M[0][1] - lam * G[0][1]];
      const r1 = [M[1][0] - lam * G[1][0], M[1][1] - lam * G[1][1]];
      const row = norm(r0) >= norm(r1) ? r0 : r1;
      let v = [-row[1], row[0]];
      const n = Math.sqrt(quad(G, v));
      v = [v[0] / n, v[1] / n];
      if (v[0] < -1e-12 || (Math.abs(v[0]) <= 1e-12 && v[1] < 0)) v = [-v[0], -v[1]];
      const kind = k === 0 ? 'max' : 'min';
      extrema.push({ kind, lam, r: v }, { kind, lam, r: [-v[0], -v[1]] });
    });
    return { c, s, G, M, detG, lams, extrema };
  }

  const point = t => {
    const u = A * Math.cos(t), v = B * Math.sin(t);
    return [u * model.c - v * model.s, u * model.s + v * model.c];
  };
  const tangent = t => {
    const du = -A * Math.sin(t), dv = B * Math.cos(t);
    const T = [du * model.c - dv * model.s, du * model.s + dv * model.c];
    const n = norm(T);
    return [T[0] / n, T[1] / n];
  };
  const tOf = r => {
    const u = r[0] * model.c + r[1] * model.s, v = -r[0] * model.s + r[1] * model.c;
    return Math.atan2(v / B, u / A);
  };
  const F = r => quad(model.M, r);
  const gradF = r => mul(model.M, r).map(x => 2 * x);
  const gradG = r => mul(model.G, r).map(x => 2 * x);

  // Validity of the local representation: with indep as independent variable we need ∂g/∂(dep) ≠ 0
  function repInfo(r, indep) {
    const i = indep === 'x' ? 0 : 1, j = 1 - i;
    const g = gradG(r);
    const ratio = Math.abs(g[j]) / norm(g);           // = |component of unit tangent along indep|
    const slope = Math.abs(g[j]) < 1e-12 ? Infinity : -g[i] / g[j];
    const branch = g[j] >= 0 ? '+' : '−';
    let cls = 'ok', text = S('statusOk');
    if (ratio < 0.02) { cls = 'bad'; text = S('statusBad'); }
    else if (ratio < 0.25) { cls = 'warn'; text = S('statusWarn'); }
    return { ratio, slope, branch, cls, text };
  }

  // Domain half-width, the two branches and the breakdown points for the given independent variable
  function branchSetup(indep) {
    const i = indep === 'x' ? 0 : 1, j = 1 - i;
    const G = model.G, Gii = G[i][i], Gjj = G[j][j], Gij = G[0][1];
    const m = Math.sqrt(Gjj / model.detG);
    const make = (sv, w) => (i === 0 ? [sv, w] : [w, sv]);
    const dep = (sv, sign) => {
      const d = Math.max(0, Gij * Gij * sv * sv - Gjj * (Gii * sv * sv - 1));
      return (-Gij * sv + sign * Math.sqrt(d)) / Gjj;
    };
    const turning = [m, -m].map(sv => make(sv, -Gij * sv / Gjj));
    return { i, j, m, make, dep, turning };
  }

  // ---------- drawing helpers ----------
  let colors = {};
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const k of ['ink', 'muted', 'grid', 'axis', 'b1', 'b2', 'bad', 'gradF', 'gradG', 'level', 'level-hi', 'ext', 'surface', 'line'])
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

  function arrow(ctx, x0, y0, x1, y1, color, label) {
    const ang = Math.atan2(y1 - y0, x1 - x0), hl = 10;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(ang) * hl * 0.6, y1 - Math.sin(ang) * hl * 0.6); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - hl * Math.cos(ang - 0.4), y1 - hl * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - hl * Math.cos(ang + 0.4), y1 - hl * Math.sin(ang + 0.4));
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x1 + Math.cos(ang) * 16, y1 + Math.sin(ang) * 16);
    }
  }

  function marker(ctx, x, y, kind, size = 7) {
    ctx.fillStyle = colors.ext; ctx.strokeStyle = colors.surface; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (kind === 'max') { ctx.moveTo(x, y - size); ctx.lineTo(x + size, y + size * 0.75); ctx.lineTo(x - size, y + size * 0.75); }
    else { ctx.moveTo(x, y + size); ctx.lineTo(x + size, y - size * 0.75); ctx.lineTo(x - size, y - size * 0.75); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  function ring(ctx, x, y, color, r = 7) {
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.stroke();
  }

  // ---------- plane plot ----------
  const plane = $('plane');
  let planeTf = null;

  function drawPlane() {
    const { ctx, w, h } = fitCanvas(plane);
    const sc = Math.min(w, h) / (2 * VIEW), cx = w / 2, cy = h / 2;
    const X = x => cx + x * sc, Y = y => cy - y * sc;
    planeTf = { sc, cx, cy };

    // grid and axes
    ctx.lineWidth = 1; ctx.strokeStyle = colors.grid;
    for (let k = -Math.floor(VIEW); k <= Math.floor(VIEW); k++) {
      if (k === 0) continue;
      ctx.beginPath(); ctx.moveTo(X(k), 0); ctx.lineTo(X(k), h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Y(k)); ctx.lineTo(w, Y(k)); ctx.stroke();
    }
    ctx.strokeStyle = colors.axis; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(w, Y(0)); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), h); ctx.stroke();
    ctx.fillStyle = colors.muted; ctx.font = 'italic 14px "Times New Roman", serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('x', w - 6, Y(0) - 4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('y', X(0) + 6, 4);

    // level curves of F (hyperbolas)
    const ph = state.phi * DEG, cp = Math.cos(ph), sp = Math.sin(ph);
    const toXY = (p, q) => [p * cp - q * sp, p * sp + q * cp];
    const hyper = (cval, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
      const k = Math.sqrt(Math.abs(cval)), T = Math.asinh(2 * VIEW / k);
      for (const sg of [1, -1]) {
        ctx.beginPath();
        for (let n = 0; n <= 160; n++) {
          const tau = -T + 2 * T * n / 160;
          const [p, q] = cval > 0 ? [sg * k * Math.cosh(tau), k * Math.sinh(tau)] : [k * Math.sinh(tau), sg * k * Math.cosh(tau)];
          const [x, y] = toXY(p, q);
          n === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y));
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    };
    if (state.levels) {
      for (const cval of [-4, -2.5, -1.5, -0.6, 0.6, 1.5, 2.5, 4]) hyper(cval, colors.level, 1, []);
      ctx.strokeStyle = colors.level; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      for (const sg of [1, -1]) {
        const [x0, y0] = toXY(-2 * VIEW, -sg * 2 * VIEW), [x1, y1] = toXY(2 * VIEW, sg * 2 * VIEW);
        ctx.beginPath(); ctx.moveTo(X(x0), Y(y0)); ctx.lineTo(X(x1), Y(y1)); ctx.stroke();
      }
      ctx.setLineDash([]);
      for (const lam of model.lams) hyper(lam, colors['level-hi'], 1.6, [7, 4]);
    }

    // constraint ellipse, colored by branch for the current independent variable
    const N = 360;
    ctx.lineWidth = 3.2; ctx.lineCap = 'round';
    for (let n = 0; n < N; n++) {
      const t0 = 2 * Math.PI * n / N, t1 = 2 * Math.PI * (n + 1) / N;
      const p0 = point(t0), p1 = point(t1), pm = point((t0 + t1) / 2);
      ctx.strokeStyle = repInfo(pm, state.indep).branch === '+' ? colors.b1 : colors.b2;
      ctx.beginPath(); ctx.moveTo(X(p0[0]), Y(p0[1])); ctx.lineTo(X(p1[0]), Y(p1[1])); ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // breakdown points
    const bs = branchSetup(state.indep);
    for (const tp of bs.turning) ring(ctx, X(tp[0]), Y(tp[1]), colors.bad, 8);

    // extrema
    for (const e of model.extrema) marker(ctx, X(e.r[0]), Y(e.r[1]), e.kind, 7);

    // point P
    const P = point(state.t), T = tangent(state.t);
    if (state.tan) {
      ctx.strokeStyle = colors.muted; ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]);
      const L = 1.4;
      ctx.beginPath(); ctx.moveTo(X(P[0] - L * T[0]), Y(P[1] - L * T[1])); ctx.lineTo(X(P[0] + L * T[0]), Y(P[1] + L * T[1])); ctx.stroke();
      ctx.setLineDash([]);
    }
    if (state.grad) {
      const L = 0.85;
      const gG = gradG(P), gF = gradF(P), nG = norm(gG), nF = norm(gF);
      arrow(ctx, X(P[0]), Y(P[1]), X(P[0] + L * gG[0] / nG), Y(P[1] + L * gG[1] / nG), colors.gradG, '∇g');
      if (nF > 1e-9) arrow(ctx, X(P[0]), Y(P[1]), X(P[0] + L * gF[0] / nF), Y(P[1] + L * gF[1] / nF), colors.gradF, '∇F');
    }
    ctx.fillStyle = colors.ink; ctx.strokeStyle = colors.surface; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(P[0]), Y(P[1]), 6.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.font = 'italic 600 15px "Times New Roman", serif'; ctx.fillStyle = colors.ink;
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText('P', X(P[0]) + 8, Y(P[1]) - 6);
  }

  // ---------- 1D plot ----------
  const oned = $('oned');
  function drawOned() {
    const { ctx, w, h } = fitCanvas(oned);
    const bs = branchSetup(state.indep);
    const iv = state.indep, dv = iv === 'x' ? 'y' : 'x';
    const ml = 40, mr = 12, mt = 12, mb = 26;
    const smax = bs.m * 1.1;
    const fmin = model.lams[1], fmax = model.lams[0], pad = 0.12 * (fmax - fmin);
    const X = s => ml + (s + smax) / (2 * smax) * (w - ml - mr);
    const Y = f => mt + (fmax + pad - f) / (fmax - fmin + 2 * pad) * (h - mt - mb);

    ctx.strokeStyle = colors.axis; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ml, Y(0)); ctx.lineTo(w - mr, Y(0)); ctx.moveTo(X(0), mt); ctx.lineTo(X(0), h - mb); ctx.stroke();
    ctx.strokeStyle = colors.grid; ctx.setLineDash([3, 3]);
    for (const f of [fmin, fmax]) { ctx.beginPath(); ctx.moveTo(ml, Y(f)); ctx.lineTo(w - mr, Y(f)); ctx.stroke(); }
    for (const s of [-bs.m, bs.m]) { ctx.beginPath(); ctx.moveTo(X(s), mt); ctx.lineTo(X(s), h - mb); ctx.stroke(); }
    ctx.setLineDash([]);

    ctx.fillStyle = colors.muted; ctx.font = '12px system-ui, sans-serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmax.toFixed(2), ml - 5, Y(fmax)); ctx.fillText(fmin.toFixed(2), ml - 5, Y(fmin));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText((-bs.m).toFixed(2), X(-bs.m), h - mb + 5); ctx.fillText(bs.m.toFixed(2), X(bs.m), h - mb + 5);
    ctx.font = 'italic 14px "Times New Roman", serif';
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(iv, w - mr, Y(0) - 3);

    const N = 300;
    for (const [sign, col] of [[1, colors.b1], [-1, colors.b2]]) {
      ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.beginPath();
      for (let n = 0; n <= N; n++) {
        const sv = bs.m * Math.cos(Math.PI * n / N);
        const r = bs.make(sv, bs.dep(sv, sign));
        n === 0 ? ctx.moveTo(X(sv), Y(F(r))) : ctx.lineTo(X(sv), Y(F(r)));
      }
      ctx.stroke();
    }
    for (const tp of bs.turning) ring(ctx, X(tp[bs.i]), Y(F(tp)), colors.bad, 6);
    for (const e of model.extrema) marker(ctx, X(e.r[bs.i]), Y(e.lam), e.kind, 6);
    const P = point(state.t);
    ctx.fillStyle = colors.ink; ctx.strokeStyle = colors.surface; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(P[bs.i]), Y(F(P)), 5.5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();

    const vars = { iv, dv, args: iv === 'x' ? 'x, y(x)' : 'x(y), y' };
    $('oned-title').textContent = S('onedTitle', vars);
    $('oned-cap').textContent = S('onedCaption', vars);
  }

  // ---------- readouts ----------
  const fmt = (v, d = 3) => (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  const fmtPt = r => `(${fmt(r[0], 2)}, ${fmt(r[1], 2)})`;
  const chip = info => `<span class="chip ${info.cls}">${info.text}</span>`;
  const slopeText = (info, indep) => {
    const dv = indep === 'x' ? 'y' : 'x';
    const s = Number.isFinite(info.slope) && Math.abs(info.slope) < 1e4 ? fmt(info.slope, 2) : '∞';
    return `d${dv}/d${indep} = ${s}`;
  };

  function updatePanels() {
    const P = point(state.t), T = tangent(state.t);
    const gF = gradF(P), gG = gradG(P);
    const nF = norm(gF);
    const ang = nF < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, dot(gF, gG) / (nF * norm(gG))))) / DEG;
    const info = repInfo(P, state.indep);
    const lamEst = dot(gF, gG) / dot(gG, gG);
    const iv = state.indep;
    $('readout').innerHTML = `
      <dt>${S('rPosition')}</dt><dd>${fmtPt(P)}</dd>
      <dt>F(P)</dt><dd>${fmt(F(P))}</dd>
      <dt>${S('rAngle')}</dt><dd>${fmt(ang, 1)}°　${Math.min(ang, 180 - ang) < 0.5 ? `<span class="chip ok">${S('rParallel')}</span>` : ''}</dd>
      <dt>${S('rRate')}</dt><dd>${fmt(dot(gF, T))}</dd>
      <dt>∇F·∇g / |∇g|²</dt><dd>${fmt(lamEst)}　<span style="color:var(--muted)">${S('rLambdaNote')}</span></dd>
      <dt>${S('rIndep', { iv })}</dt><dd>${chip(info)}　${slopeText(info, iv)}</dd>`;

    let bad = { x: 0, y: 0 };
    $('ext-body').innerHTML = model.extrema.map((e, k) => {
      const ix = repInfo(e.r, 'x'), iy = repInfo(e.r, 'y');
      if (ix.cls !== 'ok') bad.x++;
      if (iy.cls !== 'ok') bad.y++;
      return `<tr data-k="${k}">
        <td>${S(e.kind)}</td><td>${fmtPt(e.r)}</td><td>${fmt(e.lam)}</td>
        <td class="${iv === 'x' ? 'cur' : ''}">${chip(ix)} <span style="color:var(--muted)">${slopeText(ix, 'x')}</span></td>
        <td class="${iv === 'y' ? 'cur' : ''}">${chip(iy)} <span style="color:var(--muted)">${slopeText(iy, 'y')}</span></td>
        <td><span class="chip ok">${S('found')}</span></td></tr>`;
    }).join('');
    $('th-x').className = iv === 'x' ? 'cur' : '';
    $('th-y').className = iv === 'y' ? 'cur' : '';
    const desc = n => (n === 0 ? S('allOk') : S(n === 1 ? 'someBadOne' : 'someBad', { n }));
    $('summary').textContent = S('summary', {
      dx: desc(bad.x), dy: desc(bad.y), l1: fmt(model.lams[0]), l2: fmt(model.lams[1]),
    });

    const vars = { iv, dv: iv === 'x' ? 'y' : 'x' };
    $('lg-b1').textContent = S('branchPlus', vars);
    $('lg-b2').textContent = S('branchMinus', vars);
    $('lg-bad').textContent = S('breakdown', vars);
  }

  // ---------- state sync ----------
  function syncControls() {
    $('theta').value = state.theta; $('theta-o').textContent = state.theta + '°';
    $('phi').value = state.phi; $('phi-o').textContent = state.phi + '°';
    const tdeg = ((state.t / DEG) % 360 + 360) % 360;
    $('tpar').value = tdeg; $('tpar-o').textContent = tdeg.toFixed(0) + '°';
    document.querySelectorAll('[data-indep]').forEach(b => b.setAttribute('aria-pressed', b.dataset.indep === state.indep));
    $('show-grad').checked = state.grad; $('show-tan').checked = state.tan; $('show-lev').checked = state.levels;
  }

  function render() {
    model = buildModel();
    syncControls();
    drawPlane();
    drawOned();
    updatePanels();
  }

  // Changing θ keeps P's parameter t, so P rotates with the ellipse
  $('theta').addEventListener('input', e => { state.theta = +e.target.value; render(); });
  $('phi').addEventListener('input', e => { state.phi = +e.target.value; render(); });
  $('tpar').addEventListener('input', e => { state.t = +e.target.value * DEG; render(); });
  document.querySelectorAll('[data-indep]').forEach(b => b.addEventListener('click', () => { state.indep = b.dataset.indep; render(); }));
  $('show-grad').addEventListener('change', e => { state.grad = e.target.checked; render(); });
  $('show-tan').addEventListener('change', e => { state.tan = e.target.checked; render(); });
  $('show-lev').addEventListener('change', e => { state.levels = e.target.checked; render(); });
  document.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
    const [th, ph] = b.dataset.preset.split(',').map(Number);
    state.theta = th; state.phi = ph; render();
  }));
  $('ext-body').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-k]');
    if (!tr) return;
    state.t = tOf(model.extrema[+tr.dataset.k].r); render();
  });

  // Dragging P: project onto the nearest point of the ellipse
  function projectPointer(ev) {
    const rect = plane.getBoundingClientRect();
    const x = (ev.clientX - rect.left - planeTf.cx) / planeTf.sc;
    const y = -(ev.clientY - rect.top - planeTf.cy) / planeTf.sc;
    let best = 0, bd = Infinity;
    for (let n = 0; n < 720; n++) {
      const t = 2 * Math.PI * n / 720, p = point(t), d = (p[0] - x) ** 2 + (p[1] - y) ** 2;
      if (d < bd) { bd = d; best = t; }
    }
    let lo = best - Math.PI / 360, hi = best + Math.PI / 360;
    for (let k = 0; k < 30; k++) {
      const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
      const d = t => { const p = point(t); return (p[0] - x) ** 2 + (p[1] - y) ** 2; };
      d(m1) < d(m2) ? (hi = m2) : (lo = m1);
    }
    state.t = (lo + hi) / 2;
    render();
  }
  plane.addEventListener('pointerdown', ev => {
    plane.setPointerCapture(ev.pointerId); plane.classList.add('dragging'); projectPointer(ev);
  });
  plane.addEventListener('pointermove', ev => { if (plane.hasPointerCapture(ev.pointerId)) projectPointer(ev); });
  const endDrag = ev => { if (plane.hasPointerCapture(ev.pointerId)) plane.releasePointerCapture(ev.pointerId); plane.classList.remove('dragging'); };
  plane.addEventListener('pointerup', endDrag);
  plane.addEventListener('pointercancel', endDrag);

  new ResizeObserver(() => render()).observe(plane);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readColors(); render(); });

  readColors();
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
