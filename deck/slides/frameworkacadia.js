// Framework (ACADIA) — the paper's teaching-to-teaming pipeline, built live.
//
// The shared `framework` skeleton shows this figure as a single flat PNG that
// only slides vertically; a bitmap has no parts, so nothing in it can be
// revealed piece by piece. This one is the real SVG, prepared by
// tools/export_acadia_framework_assets.py, with the stages in named groups and
// the cycle loop rebuilt as twelve gradient arcs — `#cycle-seg-N`, in flow
// order — because Illustrator had flattened it to a 505x503 bitmap.
//
// Two things about this figure are not like the IASS one:
//
//   `_7` (AI co-design) lives *inside* `_1`. The DEMONSTRATION card is split by
//   a dashed rule: the designer builds in the top half, and the bottom half is
//   the same person co-designing with the trained policy. So the slide reveals
//   it last — the loop closes and the partner appears in the panel the human
//   started in, which is the argument of the paper in one move.
//
//   The ring's drawing order is not the argument's order. Its arcs are emitted
//   clockwise from 292 deg, but the story starts at DEMONSTRATION on the ring's
//   left. RING_PHASES below re-schedules them into the three hand-offs the loop
//   actually carries.

import { clamp01, loadText } from "./_shared.js";

const BASE = "assets-static/framework-acadia";

// In flow order, which is neither the order the groups are named nor the order
// they are painted. `raw` is the grey RAW DATA band, split out of `_3` by the
// exporter so CURATION has ground to stand on before CORRECTION lands on it.
const STAGES = ["_1", "raw", "_2", "_3", "_4", "_5", "_7"];

// The stages that get a line in the copy, in the order the lines are written,
// with the colour of that stage's own card. This is the single source of truth
// for both the chip colours and which line lights when: keying the colours off
// `:nth-child` instead means dropping one line silently recolours every line
// after it. `raw` and `_4` are deliberately absent — they are on the diagram
// but not in the list.
const LISTED = [
  ["_1", "#68c9e5"], // demonstration
  ["_2", "#ef658e"], // curation
  ["_3", "#fc7524"], // correction
  ["_5", "#087f5b"], // model
  ["_7", "#868e96"], // AI co-design
];

export const meta = { title: "Framework (ACADIA)", defaultMinutes: 1.75 };
export const sectionClass = "section--framework";
export const sectionId = "framework-acadia";

export const defaults = {
  eyebrow: "Framework",
  headline: "One loop, from teaching to teaming.",
  body: "",
  // Named, not numbered: unlike the IASS figure these cards carry titles rather
  // than badges, so the title is what ties a line to its card — and the chip
  // beside it carries that card's own colour.
  //
  // One line each, and none of them wraps: at this size the text column holds
  // about 40 characters, and a second line halves the rhythm the colour chips
  // give the list. The full sentences live in the speaker notes.
  stages:
    "- **Demonstration** — build in the browser\n" +
    "- **Curation** — keep what is worth keeping\n" +
    "- **Correction** — fix what failed\n" +
    "- **Model** — a flow policy trains on it\n" +
    "- **AI co-design** — back as a partner",
  stagesFoot: "The designer is present at every stage.",
};

export const beats = [
  { name: "demonstration", p: 0.16 },
  { name: "curation", p: 0.32 },
  { name: "correction", p: 0.50 },
  { name: "mix", p: 0.62 },
  { name: "model", p: 0.78 },
  { name: "codesign", p: 1.0 },
];

// When each stage begins and finishes arriving, indexed like STAGES. The band
// leads its card slightly so the ground is there before the card lands on it.
const ARRIVE = [
  [0.02, 0.16], // _1  demonstration
  // The band comes *after* correction, on the tail of that same beat: curation
  // and correction land as two separate cards, and only then does the grey
  // ground fade in behind both to say they are one thing — raw data. It paints
  // behind them regardless of when it arrives, being earlier in the document.
  [0.42, 0.50], // raw the RAW DATA band
  [0.22, 0.32], // _2  curation
  [0.36, 0.50], // _3  correction
  [0.52, 0.62], // _4  filtered valid data mix
  [0.64, 0.78], // _5  model
  [0.82, 0.96], // _7  AI co-design
];

// The human-in-the-loop figure is not on a beat. It arrives on its own once the
// loop has closed — the last thing the slide says, without a press, while the
// cycle is already breathing.
const HUMAN_DELAY = 0.35; // seconds after the loop closes
const HUMAN_FADE = 0.7;
// Finishes as the arc reaches it, not after: the head is the arc's own tip, and
// at [0.30, 0.36] it was still at 26% when the last segment had fully landed.
const ARROW = [0.24, 0.31]; // the arrowhead, as the loop arrives at curation

// The loop, re-scheduled into the three hand-offs it carries.
//
// Arcs are emitted clockwise from 292 deg, so index order runs
// curation -> model -> demonstration; the argument runs the other way round the
// top. Each phase names its arcs explicitly and draws them in the order given.
//
//   segs 16-23  156-268 deg  out of the demonstration card, to the arrowhead
//   segs 0-2    292-334 deg  away from curation, down into the data-mix pill
//   segs 3-5    334-16 deg   out of the pill, down into the model card
//   segs 6-15   16-156 deg   round the bottom and back into the demonstration
//
// Each leg ends *inside* the card it is arriving at, never short of it and never
// through it. The ring meets the pill at 328 deg and the model card's left edge
// at 27.4 deg, so the legs stop at 334 and 16 — both occluded by the thing they
// arrive at, which is what makes them read as arriving. This is also why the
// figure is exported with 24 arcs rather than 12: at 28 deg apart there is no
// boundary near the pill at all.
const RING_PHASES = [
  { segs: [16, 17, 18, 19, 20, 21, 22, 23], from: 0.20, to: 0.32 },
  { segs: [0, 1, 2], from: 0.52, to: 0.62 },
  { segs: [3, 4, 5], from: 0.64, to: 0.78 },
  { segs: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15], from: 0.82, to: 1.0 },
];

// Once the loop closes the cycle breathes in flow order, to say it keeps
// running. `_1` sits it out: `_7` is drawn inside its card and would not scale
// with it, so swelling `_1` would visibly peel the two apart.
const BREATH_ORDER = [2, 3, 4, 5, 6]; // indices into STAGES: _2 _3 _4 _5 _7
const BREATH_STAGGER = 0.42;
const BREATH_DUR = 0.9;
const BREATH_REST = 0.8;
const BREATH_SCALE = 0.03;
const BREATH_CYCLE = BREATH_ORDER.length * BREATH_STAGGER + BREATH_REST;

const smooth = (v, a, b) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** How much of segment `i` is drawn at slide progress `v`. */
function segAt(i, v) {
  for (const phase of RING_PHASES) {
    const k = phase.segs.indexOf(i);
    if (k < 0) continue;
    const span = (phase.to - phase.from) / phase.segs.length;
    return smooth(v, phase.from + k * span, phase.from + (k + 1) * span);
  }
  return 0;
}

/** Whether the whole loop is drawn — the cue for the cards to start breathing. */
const ringClosed = (v) => v >= RING_PHASES[RING_PHASES.length - 1].to - 0.001;

export function html(p) {
  return `
    <div class="framework-stage">
      <div class="container framework-stage__inner">
        <div class="framework-copy">
          <p class="eyebrow" style="--section-accent: var(--accent-framework);">${p.eyebrow}</p>
          <h2 class="headline headline--lg">${p.headline}</h2>
          <p class="body framework-head__sub">${p.body}</p>
          <div class="fwa-stages" id="fwa-stages">${p.stages}</div>
          <p class="fwa-foot" id="fwa-foot">${p.stagesFoot}</p>
        </div>
        <div class="framework-viewport">
          <div class="fwa-figure" id="fwa-figure" role="img"
            aria-label="Teaching-to-teaming loop: designers demonstrate in the browser, curation keeps the valid episodes, correction fixes the failures, the combined data mix trains a flow-based policy, and the policy returns to the same browser as a co-design partner, with the human in the loop throughout."></div>
        </div>
      </div>
    </div>
  `;
}

export async function mount(root, props) {
  const host = root.querySelector("#fwa-figure");
  const stageEls = [...root.querySelectorAll("#fwa-stages .pt")];
  const footEl = root.querySelector("#fwa-foot");
  if (!host) return { render() {}, refresh() {} };

  let markup;
  try {
    markup = await loadText(`${BASE}/framework.svg`);
  } catch (err) {
    console.warn("framework-acadia: framework.svg missing — run tools/export_acadia_framework_assets.py", err);
    return { render() {}, refresh() {} };
  }

  host.innerHTML = markup.replace(/^[\s\S]*?<svg/i, "<svg");
  const svg = host.querySelector("svg");
  if (!svg) return { render() {}, refresh() {} };

  const stages = STAGES.map((id) => svg.querySelector(`[id="${id}"]`)).filter(Boolean);
  const human = svg.querySelector('[id="_6.2"]');
  const arrow = svg.querySelector('[id="_6.1"] polygon');
  const segs = [...svg.querySelectorAll(".cycle-seg")];

  // Prime the loop for drawing: each arc fully retracted into its own start.
  const lens = segs.map((s) => s.getTotalLength());
  segs.forEach((s, i) => {
    s.style.strokeDasharray = `${lens[i]}`;
    s.style.strokeDashoffset = `${lens[i]}`;
  });

  // Each line takes its chip colour and its cue from the same LISTED row, so a
  // line added or removed in the copy cannot drift out of step with the figure.
  const listedIdx = LISTED.map(([id]) => STAGES.indexOf(id));
  stageEls.forEach((el, k) => {
    const row = LISTED[k];
    if (row) el.style.setProperty("--fwa-c", row[1]);
  });

  function setLit(arrived, closed) {
    stageEls.forEach((el, k) => {
      el.classList.toggle("is-lit", (arrived[listedIdx[k]] ?? 0) > 0.5);
    });
    if (footEl) footEl.classList.toggle("is-lit", closed);
  }

  // What breathing is allowed to scale, per stage.
  //
  // Not the stage group, and not the one child that carries the shadow either.
  // This figure wraps each stage in a single <g>, so both of those pick up the
  // connectors that reach *out* of the card — the grey arrow climbing from the
  // model to the correction card, and the dashed blue rule dividing the
  // demonstration card — and swelling those reads as the arrow sliding rather
  // than the card breathing.
  //
  // The rule is geometric, so it needs no per-figure list: a card's contents sit
  // inside the card, and a connector does not. Anything reaching more than a few
  // pixels beyond the card's own box is left alone.
  const OUTSIDE_TOL = 8; // px of overhang still counted as "on the card"

  function scaleTargets(g) {
    const rects = [...g.querySelectorAll("rect[rx]")];
    if (!rects.length) return { els: [g], origin: null };
    const area = (e) => { const b = e.getBoundingClientRect(); return b.width * b.height; };
    const card = rects.reduce((a, b) => (area(a) > area(b) ? a : b));
    const cb = card.getBoundingClientRect();

    // The subtree the old lookup would have scaled — the wrapper, usually.
    let node = g.querySelector("[filter]") || g.firstElementChild;
    while (node && node.parentElement !== g) node = node.parentElement;
    const holder = node || g;

    const kids = [...holder.children];
    const els = (kids.length ? kids : [holder]).filter((el) => {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) return false;
      return b.left >= cb.left - OUTSIDE_TOL && b.right <= cb.right + OUTSIDE_TOL &&
             b.top >= cb.top - OUTSIDE_TOL && b.bottom <= cb.bottom + OUTSIDE_TOL;
    });
    return { els: els.length ? els : [holder], card };
  }

  // The swell is written as an SVG transform attribute, not a CSS one.
  //
  // CSS `transform-origin` on an SVG element depends on `transform-box`, and
  // when that does not bind the scale happens about the viewBox origin instead
  // of the card — which translates every piece about 16px sideways rather than
  // swelling it in place. `translate(c) scale(s) translate(-c)` as an attribute
  // is in user units by definition and cannot be misread. Any transform the
  // element already carries is kept, composed after ours.
  const pt = svg.createSVGPoint();
  function toParent(el, x, y) {
    const m = el.parentNode.getScreenCTM();
    if (!m) return null;
    pt.x = x; pt.y = y;
    return pt.matrixTransform(m.inverse());
  }

  let bodies = stages.map(() => []);
  function measureBodies() {
    if (!svg.getScreenCTM()) return false;
    bodies = stages.map((g) => {
      const { els, card } = scaleTargets(g);
      const cb = (card || g).getBoundingClientRect();
      const out = [];
      for (const el of els) {
        const c = toParent(el, cb.left + cb.width / 2, cb.top + cb.height / 2);
        if (!c) continue;
        out.push({ el, cx: c.x, cy: c.y, base: el.getAttribute("transform") || "" });
      }
      return out;
    });
    return true;
  }
  let measured = measureBodies();

  const arrived = stages.map(() => 0);
  const breath = stages.map(() => 0);
  function paintStage(i) {
    const t = arrived[i];
    stages[i].style.opacity = String(t);
    stages[i].style.transform = `translateY(${(1 - t) * 8}px)`;
    const k = 1 + BREATH_SCALE * breath[i];
    for (const b of bodies[i]) {
      if (k === 1) {
        if (b.base) b.el.setAttribute("transform", b.base);
        else b.el.removeAttribute("transform");
      } else {
        b.el.setAttribute("transform",
          `translate(${b.cx.toFixed(3)} ${b.cy.toFixed(3)}) scale(${k.toFixed(5)}) ` +
          `translate(${(-b.cx).toFixed(3)} ${(-b.cy).toFixed(3)})${b.base ? ` ${b.base}` : ""}`);
      }
    }
  }

  function paintHuman(t) {
    if (human) human.style.opacity = String(clamp01(t));
  }

  let breathing = false;

  function render(p) {
    const v = clamp01(p);

    stages.forEach((g, i) => {
      arrived[i] = smooth(v, ARRIVE[i][0], ARRIVE[i][1]);
      paintStage(i);
    });

    segs.forEach((s, i) => {
      const done = segAt(i, v);
      s.style.strokeDashoffset = `${lens[i] * (1 - done)}`;
      // A fully retracted dash still leaves an antialiased speck at each end of
      // the arc, which reads as stray dots hanging in empty space long before
      // the loop has any business being visible. Take it out of the paint.
      s.style.visibility = done > 0.001 ? "visible" : "hidden";
    });

    if (arrow) arrow.style.opacity = String(smooth(v, ARROW[0], ARROW[1]));

    breathing = ringClosed(v);
    // Stepping back off the last beat takes the figure with it; while the loop
    // is closed the rAF loop below owns this.
    if (!breathing) paintHuman(0);
    setLit(arrived, breathing);
  }

  // --- breathing, live only once the loop has closed ------------------------
  let raf = 0;
  let running = false;
  let t0 = 0;

  function frame(now) {
    if (breathing) {
      if (!t0) t0 = now;
      const since = (now - t0) / 1000;
      paintHuman((since - HUMAN_DELAY) / HUMAN_FADE);
      const t = since % BREATH_CYCLE;
      BREATH_ORDER.forEach((stage, k) => {
        const u = (t - k * BREATH_STAGGER) / BREATH_DUR;
        const b = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
        if (b !== breath[stage]) {
          breath[stage] = b;
          paintStage(stage);
        }
      });
    } else if (t0) {
      t0 = 0;
      breath.fill(0);
      paintHuman(0);
      stages.forEach((_, i) => paintStage(i));
    }
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    t0 = 0;
    breath.fill(0);
    paintHuman(0);
    stages.forEach((_, i) => paintStage(i));
  }

  render(0);
  return {
    render,
    refresh() {
      // The figure may not have been laid out when the scene mounted, and the
      // origins are measured from real geometry.
      if (!measured) measured = measureBodies();
    },
    enter: start,
    leave: stop,
  };
}
