// Training — ported from project_website (index.html #teaching-training +
// js/sections/training.js @ 0e05d7c). Markup, copy and canvas motion verbatim.
//
// This scene runs a continuous rAF loop and reads an external `scrollP`; the
// deck simply writes beat progress into that same variable, so the flow-field
// and truss assembly behave exactly as on the site.

// This slide's last beat is a sequence the audience has to follow — three bars
// placed in a numbered order — so it runs long and evenly rather than at the
// deck's default 0.6s ease-in-out, which delivered all three inside half a
// second and lost the order they were placed in.
export const meta = {
  title: "Training",
  defaultMinutes: 2,
  beatDuration: 2.4,
  beatEase: "none",
};
export const sectionClass = "section--training";
export const sectionId = "teaching-training";
export const defaults = {
  // The paper's flow-matching equations (5) and (6), placed where each belongs:
  // the interpolation path annotates the vector field it describes, and the
  // objective sits with the argument in the copy. Set false to hide both.
  showEquations: true,
  eqPathLabel: "interpolation path",
  eqTargetLabel: "target field",
  eqLossLabel: "objective",
  capNoise: "noise",
  capField: "vector field",
  capChunks: "action chunks",
  eyebrow: "Training",
  headline: "Flow matching turns noise into actions.",
  body: "For any design, there is never one correct answer.",
  body2: "Flow matching provides a way to represent this multi-modality and lets the policy learn a distribution of plausible design actions, so the same start can lead to different structurally sensible options instead of one averaged compromise.",
  body3: "Each query predicts several bars together (action chunks), helping the model express short design intentions rather than reacting one placement at a time.",
};

// Where a single press reveals things one after another, so a format that
// cannot animate still gets a slide per appearance. See runtime/deck.js.
//
// `assemble = clamp01((p - 0.46) / 0.52)` drives the truss, and each bar's badge
// completes 0.1 of that ramp after its bar lands — so bar 1 is finished at
// a = 0.36, bar 2 at 0.68, bar 3 at 1.0. Converted back to p, those are the
// three moments the audience is meant to read.
export const captureStops = {
  chunks: [0.647, 0.814, 1.0],
};

export const beats = [
  { name: "noise", p: 0.10 },
  { name: "field", p: 0.45 },
  { name: "chunks", p: 1.0 },
];

export function html(p) {
  return `
    <div class="training-stage">
      <div class="container training-stage__inner">
        <header class="training-head">
          <p class="eyebrow" style="--section-accent: var(--accent-teaching-training);">${p.eyebrow}</p>
          <h2 class="headline headline--lg">${p.headline}</h2>
          <p class="body training-head__sub">${p.body}</p>
          <p class="body training-head__sub">${p.body2}</p>
          <p class="body training-head__sub">${p.body3}</p>
        </header>

        <div class="training-diagram" id="training-diagram" aria-hidden="true">
          <canvas id="training-canvas"></canvas>
          <span class="training-cap training-cap--noise">${p.capNoise}</span>
          <span class="training-cap training-cap--field">${p.capField}</span>
          <span class="training-cap training-cap--chunks">${p.capChunks}</span>
${p.showEquations === false ? "" : `
          <div class="training-eqs">
            <figure class="training-eq">
              <img src="assets-static/equations/flow_path.svg" loading="lazy" decoding="async"
                alt="Interpolation path: a linear blend from a noise sample to a demonstration action chunk.">
              <figcaption>${p.eqPathLabel}</figcaption>
            </figure>
            <figure class="training-eq">
              <img src="assets-static/equations/flow_target.svg" loading="lazy" decoding="async"
                alt="Target vector field along the path: the straight-line displacement from the noise sample to the demonstration chunk.">
              <figcaption>${p.eqTargetLabel}</figcaption>
            </figure>
            <figure class="training-eq">
              <img src="assets-static/equations/flow_loss.svg" loading="lazy" decoding="async"
                alt="Training objective: over flow time, noise samples and demonstrations, match the learned vector field to the target one.">
              <figcaption>${p.eqLossLabel}</figcaption>
            </figure>
          </div>`}
        </div>
      </div>
    </div>
  `;
}

// Training — pinned, scroll-driven beat (flow matching).
//
// Story (sketch ③): random NOISE on the left is carried rightward through a
// learned VECTOR FIELD (continuously flowing dash-particles) and resolves into
// a small ACTION-CHUNK graph (stylized 3-node truss) on the right.
//
//   p 0.00-0.12  noise strip fizzes in
//   p 0.08-0.40  vector field fills with flowing particles
//   p 0.50-0.95  particles converge; action-chunk graph assembles (nodes + bars)
//
// The flow loops on its own rAF (so it keeps "flowing" without scrolling);
// scroll progress only gates reveal/assembly. Pure client-side, no assets.

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smooth(v, a, b) {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Rounded-rect path (avoids relying on ctx.roundRect for older engines).
function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Formation-plot placement-order colour: linear dark→light over MAX_BARS steps,
// so a 3-bar chunk uses only the first three (darkest) colours — matching the
// paper figures.
function placementColor(idx, maxBars, dark, light) {
  const t = maxBars > 1 ? idx / (maxBars - 1) : 0;
  const a = hexToRgb(dark);
  const b = hexToRgb(light);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

export function mount(root, props) {
  const full = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const section = root;
  if (!section) return;

  const stage = section.querySelector(".training-stage");
  const diagram = section.querySelector("#training-diagram");
  const canvas = section.querySelector("#training-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Canvas 2D does not resolve CSS custom properties. Assigning a font string
  // containing `var(...)` is rejected outright and the context silently keeps
  // its default `10px sans-serif` — which is what the placement-order badges
  // were drawn in, at every size we thought we were setting. Resolve the family
  // here instead, and read it off the canvas rather than :root: the deck sets
  // --font-aeonik on <body> per talk, so :root would report the wrong face.
  const badgeFamily =
    getComputedStyle(canvas).getPropertyValue("--font-aeonik").trim() || "sans-serif";

  const caps = {
    noise: section.querySelector(".training-cap--noise"),
    field: section.querySelector(".training-cap--field"),
    chunks: section.querySelector(".training-cap--chunks"),
  };

  const COL = {
    barDark: cssVar("--bridge-bar-dark", "#0420bf"),
    barLight: cssVar("--bridge-bar-light", "#9beaf2"),
    node: cssVar("--bridge-node-free", "#d2f25e"),
    nodeStart: cssVar("--bridge-node-start", "#f26b83"),
    nodeEdge: cssVar("--bridge-node-edge", "#2c2c2c"),
    flow: cssVar("--accent-teaching-training", "#4dabf7"),
    ink: cssVar("--ink", "#1b1f24"),
  };
  const MAX_BARS = 20; // canonical placement-order scale (matches formation plots)

  let W = 0, H = 0, dpr = 1;
  let particles = [];

  // Layout (CSS px), recomputed on resize.
  let geo = {};
  function layout() {
    // Composition lives in the right half (heading copy sits top-left and stays
    // legible via the head scrim). Caption x-anchors in styles.css mirror these.
    const cy = H * 0.5;
    const half = Math.min(H * 0.24, 180);
    geo = {
      cy,
      half,
      stripX: W * 0.42,
      stripW: Math.max(14, W * 0.04),
      flowStart: W * 0.48,
      targetX: W * 0.92,
      flowEnd: W * 0.88,
      s: Math.min(H * 0.13, 120), // truss scale
    };
  }

  function resize() {
    const r = diagram.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    seedParticles();
  }

  function field(x, y, t) {
    const ny = (y - geo.cy) / geo.half;
    const nx = x / W;
    const base = Math.max(1.1, W * 0.0016);
    const vx = base * (0.85 + 0.35 * Math.cos(ny * 1.6 + t * 0.4));
    const vy =
      base * 0.7 * Math.sin(nx * 6.0 + ny * 1.4 + t * 0.8) - ny * base * 0.18;
    return [vx, vy];
  }

  function spawn(p) {
    p.x = geo.flowStart + Math.random() * (W * 0.02);
    p.y = geo.cy + (Math.random() * 2 - 1) * geo.half * 0.95;
    p.len = 6 + Math.random() * 10;
    p.a = 0.35 + Math.random() * 0.45;
  }

  function seedParticles() {
    const n = Math.round(clamp01(W / 1400) * 160) + 90;
    particles = [];
    for (let i = 0; i < n; i++) {
      const p = {};
      spawn(p);
      p.x = geo.flowStart + Math.random() * (geo.flowEnd - geo.flowStart);
      particles.push(p);
    }
  }

  // --- Action-chunk truss (stylized, in bridge colors) ---
  function nodes() {
    const { targetX, cy, s } = geo;
    return [
      { x: targetX + s * 0.15, y: cy - s * 0.95, n: 1 }, // top
      { x: targetX - s * 0.55, y: cy + s * 0.15, n: 2 }, // left
      { x: targetX + s * 0.75, y: cy + s * 0.85, n: 3 }, // bottom-right
    ];
  }

  function drawTruss(a) {
    if (a <= 0) return;
    const N = nodes();
    // [i, j, placementOrder, t0, t1] — bars coloured by placement order.
    // Sequential, and deliberately not overlapping. Bars 2 and 3 used to run
    // together (0.45-0.72 against 0.60-0.86), so the order they were placed in
    // — the whole point of numbering them — was gone in the blur. Each bar now
    // finishes and gets its badge before the next one starts.
    const bars = [
      [0, 1, 0, 0.02, 0.26], // bar 1: 1-2
      [1, 2, 1, 0.34, 0.58], // bar 2: 2-3
      [0, 2, 2, 0.66, 0.90], // bar 3: 1-3
    ];
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, geo.s * 0.11);
    for (const [i, j, order, t0, t1] of bars) {
      const f = clamp01((a - t0) / (t1 - t0));
      if (f <= 0) continue;
      const A = N[i], B = N[j];
      ctx.strokeStyle = placementColor(order, MAX_BARS, COL.barDark, COL.barLight);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(A.x + (B.x - A.x) * f, A.y + (B.y - A.y) * f);
      ctx.stroke();
    }

    const nodeT = [0.05, 0.25, 0.5];
    const rNode = Math.max(5, geo.s * 0.14);
    N.forEach((nd, i) => {
      const f = smooth(a, nodeT[i], nodeT[i] + 0.12);
      if (f <= 0) return;
      ctx.globalAlpha = f;
      const r = rNode * (0.6 + 0.4 * f);
      ctx.beginPath();
      ctx.arc(nd.x, nd.y, r, 0, Math.PI * 2);
      // The first node placed is the start/support point -> pink.
      ctx.fillStyle = nd.n === 1 ? COL.nodeStart : COL.node;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = COL.nodeEdge;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Placement-order badges: white rounded squares centred on each bar's
    // midpoint, revealed as the bar finishes drawing.
    // Badge size relative to the node radius. Larger than the website's 0.2:
    // there the numbers only had to read at desk distance, here they carry the
    // "one bar at a time, in this order" point across a lecture hall.
    const boxSize = Math.max(10, geo.s * 0.28);
    const rad = boxSize * 0.28;
    ctx.lineWidth = Math.max(1, geo.s * 0.022);
    // Only ever three single digits here, and lining figures have no descender,
    // so the numeral can fill most of the plate instead of being sized for a
    // two-digit worst case that never arrives.
    ctx.font = `600 ${Math.round(boxSize * 0.86)}px ${badgeFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const [i, j, order, , t1] of bars) {
      const boxA = clamp01((a - t1) / 0.1);
      if (boxA <= 0) continue;
      const A = N[i], B = N[j];
      const mx = (A.x + B.x) / 2;
      const my = (A.y + B.y) / 2;
      ctx.globalAlpha = boxA;
      roundRectPath(ctx, mx - boxSize / 2, my - boxSize / 2, boxSize, boxSize, rad);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "rgba(44,44,44,0.55)";
      ctx.stroke();
      ctx.fillStyle = COL.ink;
      ctx.fillText(String(order + 1), mx, my + boxSize * 0.04);
    }
    ctx.globalAlpha = 1;
  }

  function drawNoise(alpha, t) {
    if (alpha <= 0) return;
    const { stripX, stripW, cy, half } = geo;
    const cols = 4;
    const cell = stripW / cols;           // square cells
    const rows = Math.max(1, Math.round((half * 2) / cell));
    const top = cy - (rows * cell) / 2;   // centre the square grid in the band
    ctx.globalAlpha = alpha;
    // Cheap deterministic-ish flicker keyed to a slow time step.
    const seed = Math.floor(t * 6);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = Math.sin((r * 12.9898 + c * 78.233 + seed) * 1.0) * 43758.5;
        const g = k - Math.floor(k);
        const v = Math.round(40 + g * 200);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(stripX + c * cell, top + r * cell, cell + 0.6, cell + 0.6);
      }
    }
    ctx.globalAlpha = 1;
  }

  let scrollP = 0;
  let t = 0;
  let running = false;
  let rafId = 0;

  function render() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);

    const p = scrollP;
    const noiseA = smooth(p, 0, 0.12);
    const flowA = smooth(p, 0.08, 0.4) * (1 - 0.55 * smooth(p, 0.72, 1));
    // Linear, not smoothstepped: the beat driver already eases this tween, and
    // easing it a second time squeezes the assembly into the middle — the three
    // bars landed 0.2s apart inside a 1.9s beat. Linear here lets their spacing
    // in `bars` survive to the screen.
    const assemble = clamp01((p - 0.46) / 0.52);

    drawNoise(noiseA, t);

    // Flowing particles (dash/comet segments along the velocity field).
    if (flowA > 0.01) {
      ctx.strokeStyle = COL.flow;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, W * 0.0018);
      for (const pt of particles) {
        const [vx, vy] = field(pt.x, pt.y, t);
        pt.x += vx;
        pt.y += vy;
        if (
          pt.x > geo.flowEnd ||
          pt.y < geo.cy - geo.half * 1.15 ||
          pt.y > geo.cy + geo.half * 1.15
        ) {
          spawn(pt);
        }
        // Fade near both ends of the band.
        const edge =
          smooth(pt.x, geo.flowStart, geo.flowStart + W * 0.05) *
          (1 - smooth(pt.x, geo.flowEnd - W * 0.08, geo.flowEnd));
        const sp = Math.hypot(vx, vy);
        ctx.globalAlpha = flowA * pt.a * edge;
        ctx.beginPath();
        ctx.moveTo(pt.x - (vx / sp) * pt.len, pt.y - (vy / sp) * pt.len);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    drawTruss(assemble);

    if (caps.noise) caps.noise.style.opacity = String(noiseA);
    if (caps.field) caps.field.style.opacity = String(smooth(p, 0.1, 0.35));
    if (caps.chunks) caps.chunks.style.opacity = String(smooth(p, 0.55, 0.82));

    if (running) rafId = requestAnimationFrame(render);
  }

  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(render);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(rafId);
  }

  resize();

  // ---- Reduced-motion / small-screen fallback: static final frame ----
  if (!full || window.innerWidth < 760) {
    scrollP = 1;
    t = 2;
    render(); // single frame (running=false, so no loop)
    Object.values(caps).forEach((c) => c && (c.style.opacity = "1"));
    return;
  }

  window.addEventListener("resize", resize);
  return {
    render(p) { scrollP = p; },
    refresh: resize,
    enter: start,
    leave: stop,
  };
}
