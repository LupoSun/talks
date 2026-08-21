// Results (IASS) — the paper's Figure 4: success-rate checkpoint sweeps across
// Pre-DAgger and six human-gated correction rounds, at a single 10 m span.
//
// This exists because the shared `results` skeleton renders the ACADIA study —
// five rounds across three spans, 36.5% width-balanced — which is a different
// experiment. Showing it under IASS copy would put the wrong numbers on screen.
//
// Data: assets-static/results-iass/curves.json, exported straight from the same
// sweep CSVs the paper figure is plotted from
// (tools/export_iass_results_assets.py). Best-per-round reproduces the paper's
// table exactly: 14 · 34 · 36 · 39 · 40 · 44 · 44 %.
//
// One beat per round, so the story can be walked round by round.

import { clamp01, easeInOut, loadJSON } from "./_shared.js";

const BASE = "assets-static/results-iass";
const ROUNDS = 7; // Pre-DAgger + Round 1..6

export const meta = { title: "Results (IASS)", defaultMinutes: 2.25 };
export const sectionClass = "section--results";
export const sectionId = "results-iass";

export const defaults = {
  // `bodyColumns: 2` flows talking points into two columns — half the
  // height, and it uses width the 16:9 frame already has. Only sensible
  // when the copy is points; a paragraph in two columns reads worse.
  bodyColumns: 1,
  eyebrow: "Results · Training",
  headline: "14% to 44% over six rounds.",
  body:
    "Before any correction, the policy trained on 100 demonstrations succeeds 14% of the time. " +
    "One round of human-gated correction more than doubles that. Later rounds keep adding, but " +
    "the gain comes from where the corrections land — not how many there are.",
  readoutCaption: "best checkpoint",
  axisCaption: "checkpoint step →",
};

// draw(reveal) completes round i at reveal = (i+1)/ROUNDS, and the scene maps
// reveal = p, so each round lands at p = (i+1)/ROUNDS.
export const beats = Array.from({ length: ROUNDS }, (_, i) => ({
  name: i === 0 ? "pre-dagger" : `round-${i}`,
  p: Number(((i + 1) / ROUNDS).toFixed(4)),
}));

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

          <div class="results-chart results-chart--rising" id="results-chart">
            <canvas id="results-curve-canvas" role="img"
              aria-label="Success-rate checkpoint sweeps across Pre-DAgger and six correction rounds at a 10 m span, rising from 14% to 44%."></canvas>
            <div class="results-readout" id="results-readout">
              <span class="results-readout__num" id="results-best-num">0%</span>
              <span class="results-readout__cap" id="results-best-cap">${p.readoutCaption}</span>
            </div>
            <ul class="results-legend" id="results-legend" aria-hidden="true"></ul>
          </div>
        </div>
      </div>
    </div>
  `;
}

function makeChart(canvas, curves, axisCaption) {
  const ctx = canvas.getContext("2d");
  const pad = { l: 46, r: 16, t: 18, b: 30 };
  const yMax = 0.5;
  const xMin = curves.step_min;
  const xMax = curves.step_max;
  const fallback = curves.metrics[0]?.color || "#236E8C";

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
    ctx.fillText(axisCaption, (pad.l + W - pad.r) / 2, H - 10);
  }

  function line(steps, vals, alpha, width, stroke) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = stroke;
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

  /** reveal 0..1 across all seven rounds. */
  function draw(reveal) {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    const rounds = curves.rounds;
    for (let i = 0; i < rounds.length; i++) {
      const rd = rounds[i];
      const ai = clamp01(reveal * rounds.length - i);
      if (ai <= 0) continue;
      const ease = easeInOut(ai);

      // Each round's sweep. Later rounds sit more prominently, so the eye
      // follows the progression rather than a tangle of equal-weight curves.
      const stroke = rd.color || fallback;
      line(rd.steps, rd.series.success, ease * (0.35 + 0.65 * (i / (rounds.length - 1))), 2.2, stroke);

      // Promoted checkpoint, drawn once the round's curve has arrived.
      if (ai > 0.45) {
        ctx.globalAlpha = clamp01((ai - 0.45) / 0.4);
        ctx.fillStyle = stroke;
        ctx.strokeStyle = "rgba(10,13,18,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx(rd.best.step), sy(rd.best.value), 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  return { resize, draw };
}

export async function mount(root, props) {
  const stage = root.querySelector(".results-stage");
  const canvas = root.querySelector("#results-curve-canvas");
  const legendEl = root.querySelector("#results-legend");
  const bestNum = root.querySelector("#results-best-num");
  const bestCap = root.querySelector("#results-best-cap");

  let curves;
  try {
    curves = await loadJSON(`${BASE}/curves.json`);
  } catch (err) {
    console.warn("results-iass: curves.json missing — run tools/export_iass_results_assets.py", err);
    return { render() {}, refresh() {} };
  }

  if ((curves.rounds || []).length !== ROUNDS) {
    console.warn(
      `results-iass: curves.json has ${curves.rounds?.length} rounds but the beat list ` +
        `assumes ${ROUNDS}. Update ROUNDS in slides/resultsiass.js.`,
    );
  }

  // Legend is the round ramp, matching the paper figure rather than a single
  // series swatch — the colour is what tells the rounds apart.
  legendEl.innerHTML = "";
  for (const rd of curves.rounds) {
    const li = document.createElement("li");
    const short = rd.label.replace("Round ", "R").replace("Pre-DAgger", "Pre");
    li.innerHTML = `<span class="results-legend__chip" style="--c: ${rd.color};"></span>${short}`;
    legendEl.appendChild(li);
  }

  const chart = makeChart(canvas, curves, props.axisCaption);
  const chain = curves.rounds.map((r) => r.best.value);

  function setBest(reveal) {
    const n = chain.length;
    const t = clamp01(reveal) * n;
    const ri = Math.min(n - 1, Math.floor(t));
    const frac = clamp01(t - ri);
    const prev = ri > 0 ? chain[ri - 1] : 0;
    bestNum.textContent = `${((prev + (chain[ri] - prev) * frac) * 100).toFixed(0)}%`;
    // At a landed beat the number belongs to round ri-1; captioning it `ri`
    // would print "Round 1" over Pre-DAgger's 14%.
    const labelIdx = Math.max(0, Math.min(n - 1, frac > 0.001 ? ri : ri - 1));
    bestCap.textContent =
      reveal > 0.02 ? `${props.readoutCaption} · ${curves.rounds[labelIdx].label}` : props.readoutCaption;
    // The number takes the round's own colour, so it reads against the curve.
    bestNum.style.color = curves.rounds[labelIdx].color || "";
  }

  function refresh() {
    chart.resize();
  }
  refresh();

  function render(p) {
    chart.draw(clamp01(p));
    setBest(clamp01(p));
  }

  window.addEventListener("resize", refresh);
  return { render, refresh };
}
