// Framework (IASS) — the paper's pipeline figure, assembled one stage at a time.
//
// The shared `framework` skeleton shows the ACADIA teaching-to-teaming loop as a
// single flat PNG that only slides vertically; nothing in it can be revealed
// piece by piece, because a bitmap has no parts. IASS has its own figure, and it
// exported as real SVG with the five stages in named groups, so here the diagram
// is built live: each stage lands on its own beat and the cycle draws itself
// between them.
//
// Asset: assets-static/framework-iass/framework.svg, prepared by
// tools/export_iass_framework_assets.py — which also rebuilds the cycle loop as
// twelve gradient arcs, because Illustrator had flattened it to an 81x80 bitmap.
// Those arcs are what make the loop drawable; `#cycle-seg-N` is one twelfth of
// it, in flow order.

import { clamp01, loadText } from "./_shared.js";

const BASE = "assets-static/framework-iass";
const STAGES = ["_1", "_2", "_3", "_4", "_5"];

export const meta = { title: "Framework (IASS)", defaultMinutes: 2.25 };
export const sectionClass = "section--framework";
export const sectionId = "framework-iass";

// The copy column is the stage list, and nothing else.
//
// It used to be a prose paragraph *plus* a caption that swapped itself out on
// every beat — which told the same five things twice, filled the column exactly,
// and still left the audience unable to see the five stages together. On a slide
// whose whole argument is "these five things are one loop", the list is the
// point, so it stands the whole time and each line lights as its card lands.
//
// The lines say what happens, not what the stage is called: the diagram already
// prints DEMONSTRATIONS, TRAIN POLICY and the rest on the cards themselves. The
// number is what ties a line to its card.
export const defaults = {
  eyebrow: "Framework",
  headline: "One loop, from demonstration to correction.",
  body: "",
  //
  // One line each, and none of them wraps: the text column is 486px, which is
  // about 42 characters. A second line halves the vertical rhythm the numbers
  // give the list, and everything cut here is already said in the notes.
  stages:
    "- Designers **demonstrate** in the browser\n" +
    "- A flow policy **trains** on the best demos\n" +
    "- The policy builds alone; **FEA judges**\n" +
    "- Designers **take over** where it failed\n" +
    "- Corrections feed the **next round**",
  // Shown once the ring closes: the one thing the loop's shape cannot say.
  stagesFoot: "Six rounds, in this study.",
};

// One beat per stage, then a sixth where the loop closes.
export const beats = [
  { name: "demonstrations", p: 0.16 },
  { name: "train", p: 0.32 },
  { name: "rollout", p: 0.48 },
  { name: "review", p: 0.64 },
  { name: "aggregate", p: 0.82 },
  { name: "loop", p: 1.0 },
];

// When each stage begins and finishes arriving.
const ARRIVE = [
  [0.02, 0.16],
  [0.18, 0.32],
  [0.34, 0.48],
  [0.50, 0.64],
  [0.66, 0.82],
];
const HUMAN = [0.50, 0.64]; // the designer joins at "review"
const ARROW = [0.90, 1.0]; // the arrowhead closing the cycle

// How much of the loop is drawn at each point in the slide.
//
// Not a single sweep across the whole slide: most of the ring runs *behind* the
// cards, so an even sweep spends its time invisible and then dumps the last
// visible arc all at once. These knots pin the loop to the hand-off it is
// drawing, so each arc emerges from one card and arrives at the next exactly as
// that next card lands. The fractions are where the ring crosses the card edges
// — 0.25 is inside stage 4's left edge, 0.62 inside stage 5's top edge.
// Once the loop closes, stages 2-5 breathe in turn — the recurring half of the
// cycle, in flow order. Stage 1 sits it out: the demonstrations are collected
// once, not every round, and pulsing it would say otherwise.
const BREATH_ORDER = [1, 2, 3, 4]; // indices into STAGES, i.e. _2 _3 _4 _5
const BREATH_STAGGER = 0.5; // seconds between one card and the next
const BREATH_DUR = 0.9; // seconds for a card to swell and settle
const BREATH_REST = 0.7; // beat of stillness before the wave comes round again
const BREATH_SCALE = 0.03; // 3% — legible across a hall, calm on a laptop
const BREATH_CYCLE = BREATH_ORDER.length * BREATH_STAGGER + BREATH_REST;

const RING_KNOTS = [
  [0.00, 0.00],
  [0.48, 0.00], // "rollout": stage 3 has landed, the loop is about to leave it
  [0.64, 0.25], // "review": the 3 -> 4 arc has crossed the gap into stage 4
  [0.82, 0.62], // "aggregate": the 4 -> 5 arc has come down into stage 5
  [1.00, 1.00], // "loop": round the bottom and back into stage 3
];

const smooth = (v, a, b) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Captions the artwork centres optically, paired with what they are centred on.
//
// Illustrator bakes centring into a left-anchored x measured in the original
// face — CMU Serif, which is not installed anywhere here. Under any substitute
// the caption drifts by half the width difference: GOLDEN DEMOS lands 4.7 units
// left of its card. Re-centred from real rendered metrics, so it is exact at
// whatever size the slide is projected.
const RECENTRE = [["_1", "GOLDEN DEMOS"]];

const area = (el) => {
  const b = el.getBoundingClientRect();
  return b.width * b.height;
};

function recentreCaptions(svg) {
  const box = svg.getBoundingClientRect();
  const vb = svg.viewBox?.baseVal?.width || 0;
  const scale = vb ? box.width / vb : 0;
  if (!scale) return false; // not laid out yet; try again on refresh

  for (const [sid, label] of RECENTRE) {
    const stage = svg.querySelector(`[id="${sid}"]`);
    if (!stage) continue;
    const text = [...stage.querySelectorAll("text")].find((t) => t.textContent.trim() === label);
    const cards = [...stage.querySelectorAll("rect[rx][stroke]")];
    if (!text || !cards.length || text.dataset.centred) continue;
    const card = cards.reduce((a, b) => (area(a) > area(b) ? a : b));
    const cb = card.getBoundingClientRect();
    const tb = text.getBoundingClientRect();
    const dx = (cb.x + cb.width / 2 - (tb.x + tb.width / 2)) / scale;
    text.dataset.centred = "1";
    if (Math.abs(dx) < 0.05) continue;
    text.setAttribute("transform", `${text.getAttribute("transform") || ""} translate(${dx.toFixed(3)} 0)`);
  }
  return true;
}

/** Piecewise ring progress through RING_KNOTS, eased within each leg. */
function ringAt(v) {
  for (let i = 1; i < RING_KNOTS.length; i++) {
    const [p0, r0] = RING_KNOTS[i - 1];
    const [p1, r1] = RING_KNOTS[i];
    if (v <= p1) return r0 + (r1 - r0) * smooth(v, p0, p1);
  }
  return 1;
}

// Layout is the shared `framework` skeleton's: copy left, diagram right, using
// the same site.css classes so the two slides sit identically in the deck.
export function html(p) {
  return `
    <div class="framework-stage">
      <div class="container framework-stage__inner">
        <div class="framework-copy">
          <p class="eyebrow" style="--section-accent: var(--accent-framework);">${p.eyebrow}</p>
          <h2 class="headline headline--lg">${p.headline}</h2>
          <p class="body framework-head__sub">${p.body}</p>
          <div class="fwi-stages" id="fwi-stages">${p.stages}</div>
          <p class="fwi-foot" id="fwi-foot">${p.stagesFoot}</p>
        </div>
        <div class="framework-viewport">
          <div class="fwi-figure" id="fwi-figure" role="img"
            aria-label="Five-stage loop: demonstrations, train policy, rollout and evaluate, review and correction, dataset aggregation, feeding back into training."></div>
        </div>
      </div>
    </div>
  `;
}

export async function mount(root, props) {
  const host = root.querySelector("#fwi-figure");
  const stageEls = [...root.querySelectorAll("#fwi-stages .pt")];
  const footEl = root.querySelector("#fwi-foot");
  if (!host) return { render() {}, refresh() {} };

  let markup;
  try {
    markup = await loadText(`${BASE}/framework.svg`);
  } catch (err) {
    console.warn("framework-iass: framework.svg missing — run tools/export_iass_framework_assets.py", err);
    return { render() {}, refresh() {} };
  }

  // Strip the XML prolog; innerHTML wants a fragment, not a document.
  host.innerHTML = markup.replace(/^[\s\S]*?<svg/i, "<svg");
  const svg = host.querySelector("svg");
  if (!svg) return { render() {}, refresh() {} };

  // The figure's image hrefs are relative to the SVG's own folder, so it stays
  // viewable on its own. Inlined here they would resolve against /deck instead.
  for (const img of svg.querySelectorAll("image")) {
    for (const attr of ["href", "xlink:href"]) {
      const v = img.getAttribute(attr);
      if (v && !/^(data:|https?:|\/)/.test(v)) img.setAttribute(attr, `${BASE}/${v}`);
    }
  }

  const stages = STAGES.map((id) => svg.querySelector(`#${CSS.escape(id)}`)).filter(Boolean);
  const human = svg.querySelector("#\\_6\\.2") || svg.querySelector('[id="_6.2"]');
  const arrow = svg.querySelector('[id="_6.1"] polygon');
  const segs = [...svg.querySelectorAll(".cycle-seg")];

  // Prime the loop for drawing: each arc fully retracted into its own start.
  const lens = segs.map((s) => s.getTotalLength());
  const total = lens.reduce((a, b) => a + b, 0);
  const before = [];
  lens.reduce((acc, l, i) => ((before[i] = acc), acc + l), 0);
  segs.forEach((s, i) => {
    s.style.strokeDasharray = `${lens[i]}`;
    s.style.strokeDashoffset = `${lens[i]}`;
  });

  // A line lights when its own card has actually landed, rather than on a beat
  // index — the copy and the diagram then cannot drift apart if the arrival
  // timings are ever retuned.
  function setLit(arrived, ringDrawn) {
    stageEls.forEach((el, i) => el.classList.toggle("is-lit", (arrived[i] ?? 0) > 0.5));
    if (footEl) footEl.classList.toggle("is-lit", ringDrawn > 0.98);
  }

  // The card body inside each stage — the child that carries the drop shadow.
  //
  // Two stages also hold the arrow that arrives at them from stage 1 (_2.1 and
  // _5.1, both reaching well outside their own card). Swelling the whole stage
  // group swells those arrows too, which reads as the arrow sliding rather than
  // the card breathing. The scale belongs on the body alone.
  const bodies = stages.map((g) => {
    let node = g.querySelector("[filter]");
    while (node && node.parentElement !== g) node = node.parentElement;
    const body = node || g;
    body.style.transformBox = "fill-box";
    body.style.transformOrigin = "50% 50%";
    return body;
  });

  // Arrival and breathing both drive `transform`, so one writer owns it.
  const arrived = stages.map(() => 0);
  const breath = stages.map(() => 0);
  function paintStage(i) {
    const t = arrived[i];
    // Arrival lifts the whole stage, arrow included; breathing swells only the card.
    stages[i].style.opacity = String(t);
    stages[i].style.transform = `translateY(${(1 - t) * 8}px)`;
    bodies[i].style.transform = `scale(${1 + BREATH_SCALE * breath[i]})`;
  }

  let breathing = false;

  function render(p) {
    const v = clamp01(p);

    stages.forEach((g, i) => {
      arrived[i] = smooth(v, ARRIVE[i][0], ARRIVE[i][1]);
      paintStage(i);
    });

    const ring = ringAt(v);
    const drawn = ring * total;
    segs.forEach((s, i) => {
      const done = clamp01((drawn - before[i]) / lens[i]);
      s.style.strokeDashoffset = `${lens[i] * (1 - done)}`;
      // A fully retracted dash still leaves an antialiased speck at each end of
      // the arc, which reads as two stray dots hanging in empty space before the
      // loop has any business being visible. Take the arc out of the paint.
      s.style.visibility = done > 0.001 ? "visible" : "hidden";
    });

    if (human) human.style.opacity = String(smooth(v, HUMAN[0], HUMAN[1]));
    if (arrow) arrow.style.opacity = String(smooth(v, ARROW[0], ARROW[1]));

    // The cards only breathe once the loop is whole.
    breathing = ring > 0.999;
    setLit(arrived, ring);
  }

  // --- breathing, live only once the loop has closed ------------------------
  let raf = 0;
  let running = false;
  let t0 = 0;

  function frame(now) {
    if (breathing) {
      if (!t0) t0 = now;
      const t = ((now - t0) / 1000) % BREATH_CYCLE;
      BREATH_ORDER.forEach((stage, k) => {
        const u = (t - k * BREATH_STAGGER) / BREATH_DUR;
        // A half sine: out and back, with no corner at either end.
        const b = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
        if (b !== breath[stage]) {
          breath[stage] = b;
          paintStage(stage);
        }
      });
    } else if (t0) {
      // Stepping back off the last beat: settle every card and stop.
      t0 = 0;
      breath.fill(0);
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
    stages.forEach((_, i) => paintStage(i));
  }

  let centred = recentreCaptions(svg);
  render(0);
  return {
    render,
    refresh() {
      // The figure may not have been laid out when the scene mounted.
      if (!centred) centred = recentreCaptions(svg);
    },
    enter: start,
    leave: stop,
  };
}
