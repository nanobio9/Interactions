// Interactive figures for the conical boundary page.
// Shared by every language version; the few user-visible strings come from the
// page's <script id="strings" type="application/json"> block.
const STR = JSON.parse(document.getElementById('strings').textContent);
const S = key => STR[key] ?? key;

// ── Format angle as π fraction if close to a simple one ──────────────────────
function piLabel(deg) {
  const r = deg / 180; // r = theta/pi
  // Try denominators 1..16
  const DMAX = 16;
  let bestNum = null, bestDen = null, bestErr = 1;
  for (let d = 1; d <= DMAX; d++) {
    const n = Math.round(r * d);
    if (n <= 0) continue;
    const err = Math.abs(r - n/d);
    if (err < bestErr) { bestErr = err; bestNum = n; bestDen = d; }
  }
  // Only show fraction if within 0.15° of the rational
  if (bestErr * 180 < 0.15) {
    // Simplify by gcd
    function gcd(a,b){return b===0?a:gcd(b,a%b);}
    const g = gcd(bestNum, bestDen);
    const n = bestNum/g, d = bestDen/g;
    if (d === 1) return n === 1 ? 'π' : `${n}π`;
    if (n === 1) return `π/${d}`;
    return `${n}π/${d}`;
  }
  // Fallback: decimal multiple of π
  return `${r.toFixed(3)}π`;
}

// ── Legendre P_nu(x) via hypergeometric series ────────────────────────────────
function legendreP(nu, x) {
  if (x >= 1.0 - 1e-14) return 1.0;
  const z = (1 - x) / 2;
  let sum = 0, term = 1;
  for (let j = 0; j < 300; j++) {
    sum += term;
    const next = term * ((-nu + j) * (nu + 1 + j)) / ((j+1)*(j+1)) * z;
    if (Math.abs(next) < 1e-14*(Math.abs(sum)+1e-30) && j > 5) break;
    term = next;
  }
  return sum;
}

function findRoots(beta, nRoots) {
  const x = Math.cos(beta);
  const f = nu => legendreP(nu, x);
  const SCAN = 3000, nuMax = 22, dnu = nuMax/SCAN;
  const roots = [];
  let prev = f(0.02), prevNu = 0.02;
  for (let i = 1; i <= SCAN && roots.length < nRoots; i++) {
    const nu = 0.02 + i*dnu, cur = f(nu);
    if (prev*cur < 0) {
      let lo = prevNu, hi = nu, flo = prev;
      for (let it = 0; it < 70; it++) {
        const mid = (lo+hi)/2;
        if (Math.abs(hi-lo)<1e-11) { roots.push(mid); break; }
        const fm = f(mid);
        if (flo*fm<0){hi=mid;}else{lo=mid;flo=fm;}
      }
    }
    prev=cur; prevNu=nu;
  }
  return roots;
}

function findZerosOf(nu, beta) {
  const zeros = [];
  const SCAN = 600;
  let prevTh = 0.001, prevVal = legendreP(nu, Math.cos(prevTh));
  for (let i = 1; i <= SCAN; i++) {
    const th = (i/SCAN)*beta, val = legendreP(nu, Math.cos(th));
    if (prevVal*val < 0) {
      let lo = prevTh, hi = th, flo = prevVal;
      for (let it = 0; it < 60; it++) {
        const mid = (lo+hi)/2;
        if (Math.abs(hi-lo)<1e-10) { zeros.push(mid*180/Math.PI); break; }
        const fm = legendreP(nu, Math.cos(mid));
        if (flo*fm<0){hi=mid;}else{lo=mid;flo=fm;}
      }
    }
    prevTh=th; prevVal=val;
  }
  zeros.push(beta*180/Math.PI);
  return zeros;
}

// ── Colours / theme ───────────────────────────────────────────────────────────
const COLORS = ['#2c5f8a','#c0392b','#27ae60','#8e44ad'];
const isDark  = window.matchMedia('(prefers-color-scheme: dark)').matches;
const paperBg = isDark ? '#1a1a1a' : '#ffffff';
const plotBg  = isDark ? '#252525' : '#f8f9fa';
const gridC   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
const fontC   = isDark ? '#e8e8e8' : '#1a1a1a';
const mutedC  = isDark ? '#777'    : '#aaa';

// Tick arrays at 15° intervals
function thetaTicks(maxDeg, step=15) {
  const vals = [], texts = [];
  for (let d = 0; d <= maxDeg + 0.01; d += step) {
    vals.push(d); texts.push(d + '°');
  }
  return {tickvals: vals, ticktext: texts};
}

// Top axis: cos theta, ticks at multiples of 0.25
function cosTicks(maxDeg) {
  const cosVals = [1.0, 0.75, 0.5, 0.25, 0.0, -0.25, -0.5, -0.75, -1.0];
  const tickvals=[], ticktext=[];
  for (const c of cosVals) {
    const d = Math.acos(Math.max(-1,Math.min(1,c)))*180/Math.PI;
    if (d <= maxDeg+0.5) { tickvals.push(d); ticktext.push(c.toFixed(2)); }
  }
  return {tickvals, ticktext};
}

function axisStyle(title, range, tickvals, ticktext) {
  return {
    title, range,
    tickvals, ticktext,
    gridcolor: gridC, gridwidth: 1,
    zeroline: false,
    color: fontC, tickfont:{color:fontC,size:10}, titlefont:{color:fontC,size:11},
  };
}

function baseLayout(xTitle, yTitle, xRange, yRange, step=15) {
  const {tickvals:xv, ticktext:xt} = thetaTicks(xRange[1], step);
  return {
    paper_bgcolor: paperBg, plot_bgcolor: plotBg,
    margin:{t:45,r:20,b:50,l:55},
    font:{color:fontC,size:11},
    xaxis: axisStyle(xTitle, xRange, xv, xt),
    yaxis: axisStyle(yTitle, yRange, null, null),
    legend:{font:{color:fontC},bgcolor:'rgba(0,0,0,0)',x:0.01,y:0.99},
    showlegend: true,
  };
}

// ── Panel 1: Spectrum ─────────────────────────────────────────────────────────
const betaArrDeg = Array.from({length:171},(_,i)=>5+i);
const K=4, spectra=Array.from({length:K},()=>[]);
for (const bd of betaArrDeg) {
  const roots = findRoots(bd*Math.PI/180, K);
  for (let k=0;k<K;k++) spectra[k].push(roots[k]??NaN);
}

const t1 = spectra.map((nus,k)=>({
  x:betaArrDeg, y:nus, mode:'lines',
  name:`ν<sub>${k+1}</sub>`, line:{color:COLORS[k],width:2.2},
}));
for (let n=1;n<=4;n++)
  t1.push({x:[5,175],y:[n,n],mode:'lines',showlegend:false,
            line:{color:mutedC,width:1,dash:'dot'}});
t1.push({x:[90,90],y:[0,4.9],mode:'lines',showlegend:false,
         line:{color:mutedC,width:1,dash:'dash'}});

const lay1 = baseLayout(S('axisBeta'),S('axisNu'),[5,175],[0,5],15);
lay1.margin.t = 25;
lay1.annotations = [
  {x:91,y:4.75,text:'β = 90°',showarrow:false,font:{size:10,color:mutedC},xanchor:'left'},
  ...[1,2,3,4].map(n=>({x:4,y:n+0.13,text:`ν=${n}`,showarrow:false,
                          font:{size:9,color:mutedC},xanchor:'right'}))
];
Plotly.newPlot('plot1',t1,lay1,{responsive:true,displayModeBar:false});

// ── Panel 2: Eigenfunctions ───────────────────────────────────────────────────
const NTHETA = 400;

function makeEfTraces(roots, allZeros, xMaxDeg, scaled) {
  const traces = roots.map((nu,k) => {
    const thEnd = scaled ? (xMaxDeg*Math.PI/180) : Math.PI;
    const thetas = Array.from({length:NTHETA+1},(_,i)=>(i/NTHETA)*thEnd);
    return {
      x: thetas.map(t=>t*180/Math.PI),
      y: thetas.map(t=>legendreP(nu,Math.cos(t))),
      mode:'lines',
      name: scaled ? `k=${k+1}, ν=${nu.toFixed(3)}` : null,
      showlegend: scaled,
      line:{color:COLORS[k],width:2},
    };
  });
  // zero baseline
  traces.push({x:[0,xMaxDeg],y:[0,0],mode:'lines',showlegend:false,
               line:{color:mutedC,width:1,dash:'dot'}});
  return traces;
}

function makeEfLayout(betaDeg, xMaxDeg, step) {
  const {tickvals:xv,ticktext:xt} = thetaTicks(xMaxDeg, step);
  const {tickvals:cv,ticktext:ct} = cosTicks(xMaxDeg);
  const lay = {
    paper_bgcolor:paperBg, plot_bgcolor:plotBg,
    margin:{t:48,r:20,b:50,l:55},
    font:{color:fontC,size:11},
    xaxis: {
      ...axisStyle(S('axisTheta'), [0,xMaxDeg], xv, xt),
    },
    xaxis2: {
      overlaying:'x', side:'top',
      tickvals:cv, ticktext:ct,
      title:'cos θ', range:[0,xMaxDeg],
      gridcolor:'rgba(0,0,0,0)',
      color:fontC,tickfont:{color:fontC,size:9},titlefont:{color:fontC,size:10},
    },
    yaxis: axisStyle('P<sub>ν</sub>(cos θ)',[-1.3,1.35],null,null),
    legend:{font:{color:fontC},bgcolor:'rgba(0,0,0,0)',x:0.01,y:0.99},
    showlegend:true,
  };

  // All zeros → vertical mesh lines
  // (will be set per-call)
  return lay;
}

function applyShapesAnnotations(lay, allZeros, betaDeg, xMaxDeg) {
  lay.shapes = [
    // conductor line
    {type:'line',x0:betaDeg,x1:betaDeg,y0:-1.3,y1:1.3,
     line:{color:'#c0392b',width:1.8,dash:'dash'}},
    // zero mesh lines
    ...allZeros.flatMap((zeros,k)=>
      zeros.map(z=>({
        type:'line',x0:z,x1:z,y0:-1.25,y1:1.25,
        line:{color:COLORS[k],width:0.8,dash:'dot'},
      })))
  ];
  // Annotations: beta label + zero degree labels (interior zeros only)
  const anchor = betaDeg < xMaxDeg*0.85 ? 'left' : 'right';
  lay.annotations = [
    {x:betaDeg,y:1.28,text:'θ=β',showarrow:false,
     font:{size:10,color:'#c0392b'},xanchor:anchor},
    ...allZeros.flatMap((zeros,k)=>
      zeros.slice(0,-1).map(z=>({
        x:z, y:-1.22,
        text: `${z.toFixed(1)}°`,
        showarrow:false, font:{size:8,color:COLORS[k]}, xanchor:'center',
      })))
  ];
}

function updateEigenfunctions(betaDeg) {
  const beta = betaDeg*Math.PI/180;
  const roots = findRoots(beta, 3);
  const allZeros = roots.map(nu=>findZerosOf(nu,beta));

  // Top plot: scaled
  const step = betaDeg <= 60 ? 10 : betaDeg <= 120 ? 15 : 30;
  const tracesT = makeEfTraces(roots, allZeros, betaDeg, true);
  const layT = makeEfLayout(betaDeg, betaDeg, step);
  applyShapesAnnotations(layT, allZeros, betaDeg, betaDeg);
  Plotly.react('plot2T', tracesT, layT, {responsive:true,displayModeBar:false});

  // Bottom plot: fixed 0–180
  const tracesB = makeEfTraces(roots, allZeros, 180, false);
  const layB = makeEfLayout(betaDeg, 180, 15);
  applyShapesAnnotations(layB, allZeros, betaDeg, 180);
  Plotly.react('plot2B', tracesB, layB, {responsive:true,displayModeBar:false});

  document.getElementById('nuRow').innerHTML =
    `<b>β = ${betaDeg}°</b>&emsp;` +
    roots.map((r,k)=>`ν<sub>${k+1}</sub> = ${r.toFixed(4)}`).join('&emsp;');
}

const slider = document.getElementById('betaSlider');
slider.addEventListener('input', () => {
  const b = +slider.value;
  document.getElementById('betaVal').textContent = `β = ${b}°`;
  updateEigenfunctions(b);
});
updateEigenfunctions(+slider.value);
