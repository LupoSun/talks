// Rollout & Evaluate (IASS) — the shared `curation` motion carrying the other
// half of the loop.
//
// Curation pans a gallery of successful demonstrations and lifts the ones worth
// keeping. Here the same movement says something else: the policy builds on its
// own, FEA judges every attempt, and what gets lifted are the failures a
// designer takes forward to the inspector. Most of the grid is pink, and that is
// the point of the slide.
//
// Data: assets-static/rollout-iass/, assembled by tools/export_iass_rollout_assets.py
// out of the seventy Figure 5 cells the outcomes slide already uses — so nothing
// has to be re-run against the policy. Each cell carries the paper's own verdict,
// and the slide paints that verdict as the cell's ground rather than leaving the
// evaluation implied.
//
// Beats: the grid is the whole slide, so it arrives with it and then pans.
// Curation opens on a gallery window that flies in, pulses and flies out again;
// that choreography belongs to the tool, and this slide is about the output.

export const meta = { title: "Rollout & Evaluate (IASS)", defaultMinutes: 2 };
export const sectionClass = "section--curation";
export const sectionId = "teaching-rollout-iass";
export const defaults = {
  eyebrow: "Rollout & Evaluate",
  headline: "Let the policy build, then judge every attempt.",
  body: "Evaluation is what turns a rollout into training signal.",
  body2: "The policy assembles a bridge on its own and a terminal finite element analysis decides whether it stands. Most do not — and those failures, not the successes, are what the designer takes into the inspector.",
  legFell: "collapsed",
  legStood: "stood",
  legPicked: "taken to the inspector",
};

export const beats = [
  { name: "grid", p: 0.12 },
  { name: "pan", p: 1.0 },
];

export function html(p) {
  return `
    <div class="curation-stage">
      <div class="container curation-stage__inner">
        <header class="curation-head">
          <p class="eyebrow" style="--section-accent: var(--accent-teaching-curation);">${p.eyebrow}</p>
          <h2 class="headline headline--lg">${p.headline}</h2>
          <p class="body curation-head__sub">${p.body}</p>
          <p class="body curation-head__sub">${p.body2}</p>
        </header>

        <ul class="rollout-legend" aria-hidden="true">
          <li><span class="rollout-legend__chip is-fell"></span>${p.legFell}</li>
          <li><span class="rollout-legend__chip is-stood"></span>${p.legStood}</li>
          <li><span class="rollout-legend__chip is-picked"></span>${p.legPicked}</li>
        </ul>

        <div class="formation" id="curation-formation" aria-hidden="true">
          <div class="formation__track" id="curation-track"></div>
        </div>
      </div>
    </div>
  `;
}

// Curation — pinned, scroll-driven beat.
//
// Gallery GUI lifecycle, then a horizontally-panning "formation with selection":
//   0.00-0.10  fly in (from left) + scale up to target
//   0.10-0.20  scale up (pulse)
//   0.20-0.30  scale down
//   0.30-0.40  fly out (to the right)
//   0.38-0.46  formation grid reveals
//   0.46-1.00  grid pans horizontally; selected demos lift + glow pink (staggered)
//
// Assets from project_website/assets/curation/ (see tools/export_curation_assets.py).

const BASE = "assets-static/rollout-iass";

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function buildCells(track, grid, rows) {
  track.innerHTML = "";
  track.style.setProperty("--rows", String(rows));
  const cells = [];
  grid.forEach((entry) => {
    const cell = document.createElement("div");
    // The verdict is the cell's ground, so the evaluation is visible rather than
    // implied — the audience should see the field of pink before anything lifts.
    cell.className = `formation__cell ${entry.success ? "is-stood" : "is-fell"}`;
    const img = document.createElement("img");
    img.src = `${BASE}/${entry.file}`;
    img.alt = "";
    img.loading = "lazy";
    cell.appendChild(img);
    track.appendChild(cell);
    cells.push(cell);
  });
  return cells;
}

export async function mount(root, props) {
  const full = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const section = root;
  if (!section) return;

  const stage = section.querySelector(".curation-stage");
  const legend = section.querySelector(".rollout-legend");
  const formation = section.querySelector("#curation-formation");
  const track = section.querySelector("#curation-track");

  let manifest;
  try {
    manifest = await loadJSON(`${BASE}/manifest.json`);
  } catch (err) {
    console.warn("rollout-iass: assets missing — run tools/export_iass_rollout_assets.py", err);
    return;
  }

  const rows = manifest.rows || 4;
  const cells = buildCells(track, manifest.grid || [], rows);
  // Which failures get lifted is decided by the exporter, not re-rolled here, so
  // the same rollouts are picked every time the deck is opened.
  const selectedIdx = manifest.lifted || [];

  // ---- Reduced-motion / small-screen fallback ----
  if (!full || window.innerWidth < 760) {
    formation.style.opacity = "1";
    track.style.transform = "none";
    selectedIdx.forEach((k) => cells[k].classList.add("is-lifted"));
    return;
  }

  let stageW = stage.getBoundingClientRect().width;
  let panBase = 0;   // track x at pan progress 0
  let panRange = 0;  // total horizontal travel
  let viewW = stageW;
  let selected = []; // { el, threshold }

  function refresh() {
    stageW = stage.getBoundingClientRect().width;

    // The track pans inside the .formation viewport.
    viewW = formation.getBoundingClientRect().width || stageW;
    const trackW = track.scrollWidth;
    const slack = Math.max(0, trackW - viewW);

    // Keep a buffer of content beyond BOTH edges at all times so the rail's
    // ends never enter view -> the pan never "feels like the end".
    const buf = viewW * 0.12;
    panRange = Math.max(0, slack - 2 * buf);
    panBase = -buf;

    // Sit the legend just above the band, from the track's real geometry: the
    // cell size is a clamp() on vmin, so computing this in CSS means restating
    // the clamp and hoping the two agree.
    if (legend) {
      const tb = track.getBoundingClientRect();
      // Against the legend's own offset parent, not the stage: which ancestor
      // establishes the containing block is not obvious from the markup, and
      // guessing it wrong puts the legend a few pixels into the band.
      const pb = (legend.offsetParent || stage).getBoundingClientRect();
      if (tb.height > 0) {
        legend.style.bottom = "auto";
        // Clear the lift, not just the track: a selected cell rises 16px and
        // scales 1.06, so a gap measured to the resting band gets eaten the
        // moment the first pick comes up under the legend.
        legend.style.top = `${Math.round(tb.top - pb.top - legend.offsetHeight - 42)}px`;
      }
    }

    // Lift the selected cells in a steady trickle across the whole pan, ordered
    // left-to-right by column. (Tying lift to a column "crossing the viewport
    // center" clusters at the start/end once the formation is full-bleed, since
    // most columns fall outside the narrowed center-crossing band.)
    const ordered = [...selectedIdx].sort(
      (a, b) => Math.floor(a / rows) - Math.floor(b / rows)
    );
    const n = ordered.length;
    selected = ordered.map((k, i) => ({
      el: cells[k],
      threshold: n > 1 ? (i + 0.5) / n : 0.5,
    }));
  }
  refresh();

  function render(p) {
    // Grid in, then pan. Nothing else competes for the slide.
    formation.style.opacity = String(clamp01(p / 0.12));
    const pan = clamp01((p - 0.12) / 0.88);
    track.style.transform = `translateX(${panBase - panRange * pan}px)`;

    // Staggered lift + glow as each selected column reaches center
    for (const s of selected) {
      s.el.classList.toggle("is-lifted", pan >= s.threshold);
    }
  }

  window.addEventListener("resize", refresh);
  return { render, refresh };
}
