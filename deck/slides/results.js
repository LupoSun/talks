// Results — ported from project_website (index.html #results +
// js/sections/results.js @ 0e05d7c). Both beats (training curves, then span
// generalization) verbatim, including the chart and the panning formation wall.

export const meta = { title: "Results", defaultMinutes: 2.5 };
export const sectionClass = "section--results";
export const sectionId = "results";
// One stop per training round, so → walks the story round by round instead of
// revealing the whole chart at once.
//
// `draw(reveal)` finishes round i at `reveal = (i+1)/ROUNDS`, and the scene maps
// `reveal = p / 0.4`, so round i lands exactly at `p = 0.4 * (i+1) / ROUNDS`.
const ROUNDS = 5; // Initial + Round 1..4 — see assets/results/curves.json
const roundBeats = Array.from({ length: ROUNDS }, (_, i) => ({
  name: i === 0 ? "initial" : `round-${i}`,
  p: Number(((0.4 * (i + 1)) / ROUNDS).toFixed(4)),
}));

export const defaults = {
  // `bodyColumns: 2` flows talking points into two columns — half the
  // height, and it uses width the 16:9 frame already has. Only sensible
  // when the copy is points; a paragraph in two columns reads worse.
  bodyColumns: 1,
  eyebrow: "Results &middot; Training",
  eyebrow2: "Results &middot; Generalization",
  headline: "Targeted correction makes the policy better.",
  headline2: "Trained on three spans.",
  genHead1: "Trained on three spans.",
  genSub1: "The policy learned from bridges at 8 m, 10 m, and 12 m.",
  genHead2: "Then asked to bridge the in-between.",
  genSub2: "We queried widths from 7 m to 13 m, including spans no designer had demonstrated.",
  genHead3: "It generalizes across spans.",
  genSub3: "The generated bridges adapt their depth, bracing, and geometry to new widths.",
  body: "The model improves because the human does not add random examples. Each round corrects the states the policy actually visits and struggles with. The selected policy reaches 36.5% width-balanced success across the three trained spans.",
  body2: "The policy learned from bridges at 8 m, 10 m, and 12 m.",
};

export const beats = [
  ...roundBeats, // 0.08 · 0.16 · 0.24 · 0.32 · 0.40
  { name: "spans", p: 0.56 },
  { name: "unseen", p: 0.78 },
  { name: "wall", p: 1.0 },
];

export function html(p) {
  return `
    <div class="results-stage">
      <div class="container results-stage__inner">

        <div class="results-beat results-beat--train" id="results-train">
          <header class="results-head${Number(p.bodyColumns) > 1 ? " is-wide" : ""}">
            <p class="eyebrow" style="--section-accent: var(--accent-results);">${p.eyebrow}</p>
            <h2 class="headline headline--lg">${p.headline}</h2>
            <p class="body results-head__sub${Number(p.bodyColumns) > 1 ? " pt-cols" : ""}">${p.body}</p>
          </header>

          <div class="results-chart" id="results-chart">
            <canvas id="results-curve-canvas" role="img" aria-label="Line chart: width-balanced policy success rate rising across five training rounds, from 21% to a peak of 36.5%."></canvas>
            <div class="results-readout" id="results-readout">
              <span class="results-readout__num" id="results-best-num">0%</span>
              <span class="results-readout__cap" id="results-best-cap">width-balanced success</span>
            </div>
            <ul class="results-legend" id="results-legend" aria-hidden="true"></ul>
          </div>
        </div>

        <div class="results-beat results-beat--gen" id="results-gen">
          <header class="results-head results-head--gen">
            <p class="eyebrow" style="--section-accent: var(--accent-results);">${p.eyebrow2}</p>
            <h2 class="headline headline--lg" id="gen-headline">${p.headline2}</h2>
            <p class="body results-head__sub${Number(p.bodyColumns) > 1 ? " pt-cols" : ""}" id="gen-sub">${p.body2}</p>
          </header>

          <div class="gen-arena" id="gen-arena" aria-hidden="true">
            <div class="gen-spans" id="gen-spans">
              <div class="gen-span" style="--gap: 38%;"><span class="gen-span__cap">8 m</span></div>
              <div class="gen-span" style="--gap: 50%;"><span class="gen-span__cap">10 m</span></div>
              <div class="gen-span" style="--gap: 62%;"><span class="gen-span__cap">12 m</span></div>
            </div>

            <div class="gen-marks" id="gen-marks"></div>

            <div class="gen-formation" id="gen-formation">
              <div class="gen-track" id="gen-track"></div>
            </div>
          </div>
        </div>

      </div>
    </div>
  `;
}

// Results — pinned, scroll-driven beat with two sub-beats.
//
//   Beat A (training) 0.00-0.42  the success-vs-step curve reveals round by round;
//                                a "best so far" readout counts up 21% -> 36.5%.
//   crossfade        0.42-0.50  beat A fades out, beat B fades in.
//   Beat B (general) 0.50-1.00  per the sketch ①→④:
//       ① three trained spans (8/10/12 m) appear      (q 0.00-0.30)
//       ② "?" markers bloom in the gaps                (q 0.14-0.44)
//       ③ a mosaic of designs blooms from each span    (q 0.30-0.55)
//       ④ the mosaics form a wall that pans + a stat    (q 0.55-1.00)
//
// Assets from project_website/assets/results/ (see tools/export_results_assets.py).

const BASE = "assets/results";

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---- Beat A: chart -------------------------------------------------------

function buildLegend(legendEl, metrics) {
  legendEl.innerHTML = "";
  metrics.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="results-legend__chip" style="--c: ${m.color};"></span>${m.label}`;
    legendEl.appendChild(li);
  });
}

function makeChart(canvas, curves) {
  const ctx = canvas.getContext("2d");
  const pad = { l: 46, r: 16, t: 18, b: 30 };
  const yMax = 0.5;
  const xMin = curves.step_min;
  const xMax = curves.step_max;
  const colorFor = Object.fromEntries(curves.metrics.map((m) => [m.key, m.color]));

  let W = 0;
  let H = 0;
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const sx = (step) => pad.l + ((step - xMin) / (xMax - xMin || 1)) * (W - pad.l - pad.r);
  const sy = (rate) => pad.t + (1 - rate / yMax) * (H - pad.t - pad.b);

  function drawGrid() {
    ctx.lineWidth = 1;
    ctx.font = "11px Inter, sans-serif";
    ctx.textBaseline = "middle";
    for (let r = 0; r <= 0.5 + 1e-6; r += 0.1) {
      const y = sy(r);
      ctx.strokeStyle = "rgba(83,88,98,0.12)";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(W - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(83,88,98,0.7)";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(r * 100)}%`, pad.l - 8, y);
    }
    ctx.fillStyle = "rgba(83,88,98,0.55)";
    ctx.textAlign = "center";
    ctx.fillText("checkpoint step →", (pad.l + W - pad.r) / 2, H - 10);
  }

  function line(steps, vals, color, alpha, width) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < steps.length; i++) {
      const x = sx(steps[i]);
      const y = sy(vals[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // reveal: 0..1 over all five rounds.
  function draw(reveal) {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    const rounds = curves.rounds;
    for (let i = 0; i < rounds.length; i++) {
      const rd = rounds[i];
      const ai = clamp01(reveal * rounds.length - i);
      if (ai <= 0) continue;
      const ease = easeInOut(ai);
      // Width series: faint context.
      ["8", "10", "12"].forEach((k) => {
        line(rd.steps, rd.series[k], colorFor[k], ease * 0.16 * rd.alpha, 1);
      });
      // Balanced: the hero curve, later rounds more present.
      const balAlpha = ease * (0.5 + 0.5 * (i / (rounds.length - 1)));
      line(rd.steps, rd.series.balanced, colorFor.balanced, balAlpha, 2.4);
      // Best-balanced milestone dot.
      if (ai > 0.45) {
        const dotA = clamp01((ai - 0.45) / 0.4);
        const x = sx(rd.best.step);
        const y = sy(rd.best.value);
        ctx.globalAlpha = dotA;
        ctx.fillStyle = colorFor.balanced;
        ctx.strokeStyle = "rgba(10,13,18,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  return { resize, draw };
}

// ---- Beat B: formation wall ---------------------------------------------

// Bucket the unseen widths into the 4 gap regions around the trained spans:
// before 8, between 8-10, between 10-12, after 12. Each becomes one "?".
function groupByGap(perWidth, trained) {
  const [t1, t2, t3] = trained; // 8, 10, 12
  const groups = [
    { region: "extrapolation", widths: [] },
    { region: "interpolation", widths: [] },
    { region: "interpolation", widths: [] },
    { region: "extrapolation", widths: [] },
  ];
  perWidth.forEach((w) => {
    if (w.width < t1) groups[0].widths.push(w);
    else if (w.width < t2) groups[1].widths.push(w);
    else if (w.width < t3) groups[2].widths.push(w);
    else groups[3].widths.push(w);
  });
  return groups.filter((g) => g.widths.length);
}

// One "?" per group; --x is set later in refresh() from the actual span gaps.
function buildMarks(marksEl, groups) {
  marksEl.innerHTML = "";
  return groups.map((_g, i) => {
    const el = document.createElement("div");
    el.className = "gen-mark";
    el.textContent = "?";
    marksEl.appendChild(el);
    return { el, order: i };
  });
}

function buildTrack(trackEl, groups) {
  trackEl.innerHTML = "";
  const cols = [];
  groups.forEach((g) => {
    const groupEl = document.createElement("div");
    groupEl.className = "gen-group";
    g.widths.forEach((w) => {
      const col = document.createElement("div");
      col.className = `gen-col gen-col--${w.region === "extrapolation" ? "extrap" : "interp"}`;
      const cells = document.createElement("div");
      cells.className = "gen-col__cells";
      w.files.forEach((file) => {
        const cell = document.createElement("div");
        cell.className = "gen-cell";
        const img = document.createElement("img");
        img.src = `${BASE}/${file}`;
        img.alt = "";
        img.loading = "lazy";
        cell.appendChild(img);
        cells.appendChild(cell);
      });
      const label = document.createElement("span");
      label.className = "gen-col__label";
      label.textContent = `${(+w.width).toFixed(w.width % 1 ? 1 : 0)} m`;
      col.appendChild(cells);
      col.appendChild(label);
      groupEl.appendChild(col);
      cols.push(col);
    });
    trackEl.appendChild(groupEl);
  });
  return cols;
}

export async function mount(root, props) {
  const full = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const section = root;
  if (!section) return;

  const stage = section.querySelector(".results-stage");
  const beatTrain = section.querySelector("#results-train");
  const beatGen = section.querySelector("#results-gen");
  const canvas = section.querySelector("#results-curve-canvas");
  const legendEl = section.querySelector("#results-legend");
  const bestNum = section.querySelector("#results-best-num");
  const bestCap = section.querySelector("#results-best-cap");
  const genHeadline = section.querySelector("#gen-headline");
  const genSub = section.querySelector("#gen-sub");
  const arenaEl = section.querySelector("#gen-arena");
  const spansEl = section.querySelector("#gen-spans");
  const marksEl = section.querySelector("#gen-marks");
  const formationEl = section.querySelector("#gen-formation");
  const trackEl = section.querySelector("#gen-track");

  let curves, manifest;
  try {
    [curves, manifest] = await Promise.all([
      loadJSON(`${BASE}/curves.json`),
      loadJSON(`${BASE}/manifest.json`),
    ]);
  } catch (err) {
    console.warn("results: assets missing, leaving static.", err);
    // Reveal both beats' copy so the section isn't blank (.results-beat--gen is opacity:0 in CSS).
    beatTrain.style.opacity = "1";
    beatGen.style.opacity = "1";
    return;
  }

  // The per-round beat list is derived from ROUNDS at module load, before the
  // data is fetched — if the export ever gains or loses a round they silently
  // stop lining up, so say so loudly rather than drift.
  if ((curves.rounds || []).length !== ROUNDS) {
    console.warn(
      `results: curves.json has ${curves.rounds?.length} rounds but the beat list ` +
        `assumes ${ROUNDS}. Update ROUNDS in slides/results.js.`,
    );
  }

  buildLegend(legendEl, curves.metrics);
  const chart = makeChart(canvas, curves);
  const groups = groupByGap(manifest.per_width, manifest.trained);
  const marks = buildMarks(marksEl, groups);
  const cols = buildTrack(trackEl, groups);

  /**
   * Layout x of `el` relative to `ancestor`, accumulated through the
   * offsetParent chain.
   *
   * A single `offsetLeft` is not enough here: `.gen-track` carries
   * `will-change: transform`, which makes it a containing block, so the
   * browser reports it — not `.gen-formation` — as the groups' offsetParent.
   * Reading `g.offsetLeft` alone therefore gives a track-relative number and
   * silently drops the track's own offset within the arena.
   */
  function offsetWithin(el, ancestor) {
    let x = 0;
    for (let n = el; n && n !== ancestor; n = n.offsetParent) x += n.offsetLeft;
    return x;
  }

  // Each mark gets a START x (equidistant in the gaps between the trained squares)
  // and an END x (the horizontal centre of its formation group, at pan=0). The
  // mark travels start→end before the formation appears.
  function positionMarks() {
    const arena = arenaEl.getBoundingClientRect();
    const spanEls = spansEl.querySelectorAll(".gen-span");
    if (spanEls.length < 3 || arena.width === 0) return;
    const r = [...spanEls].map((s) => s.getBoundingClientRect());
    const gap = ((r[1].left - r[0].right) + (r[2].left - r[1].right)) / 2;
    const startPx = [
      r[0].left - gap / 2,
      (r[0].right + r[1].left) / 2,
      (r[1].right + r[2].left) / 2,
      r[2].right + gap / 2,
    ];
    const groupEls = [...trackEl.children]; // .gen-group, layout (transform-free) positions
    const clampPct = (v) => Math.max(2, Math.min(98, v));
    marks.forEach((m, i) => {
      m.startX = ((startPx[i] - arena.left) / arena.width) * 100;
      const g = groupEls[i];
      // Layout x of the group's centre within the arena, plus the track's
      // resting translate of +panRange/2. Both terms matter: without the walk
      // the marks sit ~50px left of their columns, and without panRange/2 they
      // drift on a wall wide enough to pan.
      m.endX = g
        ? clampPct(
            ((offsetWithin(g, formationEl) + g.offsetWidth / 2 + panRange / 2) / arena.width) * 100,
          )
        : m.startX;
      m.el.style.setProperty("--x", `${m.startX}%`);
    });
  }

  const bestChain = curves.rounds.map((r) => r.best.value);

  function setBest(reveal) {
    const n = bestChain.length;
    const ri = Math.min(n - 1, Math.floor(reveal * n));
    const frac = clamp01(reveal * n - ri);
    const prev = ri > 0 ? bestChain[ri - 1] : 0;
    const cur = prev + (bestChain[ri] - prev) * frac;
    bestNum.textContent = `${(cur * 100).toFixed(1)}%`;
    // The readout interpolates FROM round ri-1 TO round ri, so at frac 0 the
    // number showing is round ri-1's. Captioning it `rounds[ri]` would print
    // "Round 1" over Initial's 21.0%. That never showed before because no beat
    // landed on a boundary; every per-round beat now does, so the label has to
    // follow the value.
    const labelIdx = Math.max(0, Math.min(n - 1, frac > 0.001 ? ri : ri - 1));
    bestCap.textContent =
      reveal > 0.02 ? `width-balanced · ${curves.rounds[labelIdx].label}` : "width-balanced success";
  }

  // ---- Reduced-motion / small-screen fallback: static, both beats shown ----
  if (!full || window.innerWidth < 760) {
    beatTrain.classList.add("results-beat--static");
    beatGen.classList.add("results-beat--static");
    beatTrain.style.opacity = "1";
    beatGen.style.opacity = "1";
    requestAnimationFrame(() => {
      chart.resize();
      chart.draw(1);
    });
    setBest(1);
    spansEl.style.opacity = "1";
    marks.forEach((m) => (m.el.style.opacity = "0"));
    formationEl.style.opacity = "1";
    cols.forEach((c) => {
      c.style.opacity = "1";
      c.style.transform = "none";
    });
    genHeadline.textContent = props.genHead3;
    genSub.textContent = props.genSub3;
    return;
  }

  // Pan geometry for the wall. The track is centred (see deck-overrides.css), so
  // its resting transform is +panRange/2 — that puts a wall which overflows at
  // its left edge, and leaves a wall which fits exactly centred.
  let panRange = 0;
  function refresh() {
    chart.resize();
    const viewW = formationEl.getBoundingClientRect().width || stage.getBoundingClientRect().width;
    const trackW = trackEl.scrollWidth;
    panRange = Math.max(0, trackW - viewW);
    // panRange must be known first: the marks' targets are group centres, which
    // are shifted by that resting transform.
    positionMarks();
  }
  refresh();

  function render(p) {
    // --- Beat cross-fade ---
    const aOut = clamp01((p - 0.42) / 0.06);
    const bIn = clamp01((p - 0.44) / 0.06);
    beatTrain.style.opacity = String(1 - aOut);
    beatGen.style.opacity = String(bIn);

    // --- Beat A: chart reveal + readout count-up ---
    const reveal = clamp01(p / 0.4);
    chart.draw(reveal);
    setBest(reveal);

    // --- Beat B: q is local progress through the generalization story ---
    const q = clamp01((p - 0.5) / 0.5);

    // ① spans appear, ③ then fade once the marks are up
    const spansIn = easeInOut(clamp01(q / 0.1));
    const spansOut = easeInOut(clamp01((q - 0.28) / 0.12));
    spansEl.style.opacity = String(spansIn * (1 - spansOut));

    // ② marks appear in the gaps → ④ travel to their formation-group centres
    //    → ⑤ fade out as the formation appears.
    const marksMove = easeInOut(clamp01((q - 0.4) / 0.18));
    const marksFade = clamp01((q - 0.6) / 0.12);
    for (const m of marks) {
      const appear = easeInOut(clamp01((q - (0.14 + m.order * 0.02)) / 0.12));
      const x = m.startX + (m.endX - m.startX) * marksMove;
      m.el.style.setProperty("--x", `${x}%`);
      m.el.style.setProperty("--sc", String(0.4 + 0.6 * appear));
      m.el.style.opacity = String(appear * (1 - marksFade));
    }

    // ⑤ all columns bloom together as the marks fade, ⑥ then the wall pans
    formationEl.style.opacity = String(clamp01((q - 0.6) / 0.08));
    const bloom = easeInOut(clamp01((q - 0.6) / 0.16));
    for (let i = 0; i < cols.length; i++) {
      cols[i].style.opacity = String(bloom);
      cols[i].style.transform = `scale(${0.45 + 0.55 * bloom})`;
    }
    // Travel from +panRange/2 (flush left) to -panRange/2 (flush right) around
    // the centred resting position. When the wall fits, panRange is 0 and this
    // is a no-op that leaves it centred instead of parked against one edge.
    const pan = easeInOut(clamp01((q - 0.8) / 0.2));
    trackEl.style.transform = `translateX(${panRange / 2 - panRange * pan}px)`;

    // headline / sub copy track the phase
    // Three phases of copy, props-driven so a talk can run in another language.
    let head = props.genHead1;
    let sub = props.genSub1;
    if (q >= 0.6) {
      head = props.genHead3;
      sub = props.genSub3;
    } else if (q >= 0.14) {
      head = props.genHead2;
      sub = props.genSub2;
    }
    if (genHeadline.textContent !== head) genHeadline.textContent = head;
    if (genSub.textContent !== sub) genSub.textContent = sub;
    // Dip opacity to 0 at each text swap (q≈0.14 and q≈0.6) so the copy
    // crossfades instead of snapping; full opacity away from the boundaries.
    const dip = (b) => Math.min(1, Math.abs(q - b) / 0.05);
    const txtOp = Math.min(dip(0.14), dip(0.6));
    genHeadline.style.opacity = String(txtOp);
    genSub.style.opacity = String(txtOp);
  }

  window.addEventListener("resize", refresh);
  return { render, refresh };
}
