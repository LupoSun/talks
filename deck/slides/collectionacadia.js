// Collection (ACADIA) — the demonstration beat, in the real Bridge Designer.
//
// Identical to the shared `collection` skeleton in every respect but one: the
// window the replay plays inside. That skeleton wraps it in a generic macOS
// frame with a "BridgeDesigner" title bar — a stand-in inherited from the
// website, and the one part of the slide that does not show what the ACADIA
// paper is actually about, which is a tool fifty people opened in a browser tab.
//
// The drawing needed no work at all. Both skeletons replay through
// `window.BridgeRenderer.drawScene` — the web player's own renderer — and the
// sky and ground it paints are already the app's own colours. So this only
// swaps the chrome: a screenshot of the running app with its drawing area
// blanked, and the live canvas positioned exactly over that rect.
//
// Shell and rect come from tools/export_acadia_collection_assets.py, which
// measures the rect off the screenshot rather than having it typed in here.

import { clamp01, easeInOut, loadJSON } from "./_shared.js";

const BASE = "assets/collection";
const SHELL = "assets-static/collection-acadia";

export const meta = { title: "Demonstration (ACADIA)", defaultMinutes: 2.5 };
export const sectionClass = "section--collection";
export const sectionId = "teaching-collection-acadia";

export const defaults = {
  eyebrow: "Demonstration",
  headline: "Designers show the AI how they design.",
  body:
    "Each bridge begins as a sequence of human decisions in the browser. Across 323 seed " +
    "demonstrations for 3 spans, the dataset captures different ways of solving the same " +
    "structural problem: deep trusses, flatter profiles, symmetric moves, and stranger but " +
    "still valid geometries.",
  statsLabel: "Demonstration count",
  statsTotal: 323,
  statsBreakdown: [
    { num: 99, cap: "8 m" },
    { num: 123, cap: "10 m" },
    { num: 101, cap: "12 m" },
  ],
  widthFilter: null,
  mosaicLimit: 0,
};

// One frame per bar placed. `drawStep` floors `(p - 0.24) / 0.32 * 15` over the
// recording's 15 states, so these are mid-bucket values — they land on each bar
// exactly once, where evenly-spaced endpoints would skip the first and repeat
// the last. The final stop is the beat's own p, i.e. the settled bridge.
export const captureStops = {
  build: [0.2507, 0.272, 0.2933, 0.3147, 0.336, 0.3573, 0.3787, 0.4, 0.4213, 0.4427, 0.464, 0.4853, 0.5067, 0.528, 0.56],
};

export const beats = [
  { name: "gui", p: 0.24 },
  { name: "build", p: 0.56 },
  { name: "mosaic", p: 0.8 },
  { name: "stats", p: 1.0 },
];

export function html(p) {
  const widths = (p.statsBreakdown || [])
    .map(
      (b) =>
        `<li><span class="stats-panel__w-num" data-count-to="${b.num}">0</span>` +
        `<span class="stats-panel__w-cap">${b.cap}</span></li>`,
    )
    .join("");

  return `
    <div class="collection-stage">
      <div class="container collection-stage__inner">
        <header class="collection-head">
          <p class="eyebrow" style="--section-accent: var(--accent-teaching-collection);">${p.eyebrow}</p>
          <h2 class="headline headline--lg">${p.headline}</h2>
          <p class="body collection-head__sub">${p.body}</p>
        </header>

        <div class="collection-canvas" id="collection-canvas">
          <div class="os-window os-window--wide wp-window" id="collection-gui">
            <div class="os-window__bar">
              <span class="os-dot os-dot--close"></span>
              <span class="os-dot os-dot--min"></span>
              <span class="os-dot os-dot--max"></span>
              <span class="os-window__label">Bridge Designer</span>
            </div>
            <div class="os-window__body os-window__body--dark wp-window__body">
              <img class="wp-window__shell" src="${SHELL}/shell.png" alt=""
                decoding="async" aria-hidden="true">
              <canvas id="collection-gui-canvas" class="wp-window__canvas"
                width="800" height="800"
                aria-label="The Bridge Designer web app, with a bridge being placed bar by bar"></canvas>
            </div>
          </div>

          <div class="mosaic" id="collection-mosaic" aria-hidden="true"></div>
        </div>

        <aside class="stats-panel" id="collection-stats">
          <p class="stats-panel__title">${p.statsLabel}</p>
          <div class="stats-panel__total">
            <span class="stats-panel__num" data-count-to="${p.statsTotal}">0</span>
          </div>
          ${widths ? `<ul class="stats-panel__widths">${widths}</ul>` : ""}
        </aside>
      </div>
    </div>
  `;
}

// --- verbatim from the website scene ---------------------------------------

function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function computeScatter(n, rect) {
  const maxRx = rect.width * 0.44;
  const maxRy = rect.height * 0.44;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out = [];
  for (let i = 0; i < n; i++) {
    const frac = 0.4 + 0.6 * Math.sqrt((i + 0.5) / n);
    const angle = i * golden;
    const jitter = (rand(i) - 0.5) * 0.16;
    out.push({
      tx: Math.cos(angle) * (frac + jitter) * maxRx,
      ty: Math.sin(angle) * (frac + jitter) * maxRy,
      rot: (rand(i + 7) - 0.5) * 24,
      sc: 0.7 + rand(i + 31) * 0.5,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------

export async function mount(root, props) {
  const stage = root.querySelector(".collection-stage");
  const guiWindow = root.querySelector("#collection-gui");
  const canvas = root.querySelector("#collection-gui-canvas");

  // Where the app's canvas sits inside its own screenshot. Read from the
  // manifest rather than hard-coded, so re-shooting the app cannot silently
  // leave the live canvas sitting a few pixels off its own frame.
  try {
    const shell = await loadJSON(`${SHELL}/manifest.json`);
    const a = shell.area;
    guiWindow.style.setProperty("--wp-x", `${a.x * 100}%`);
    guiWindow.style.setProperty("--wp-y", `${a.y * 100}%`);
    guiWindow.style.setProperty("--wp-w", `${a.w * 100}%`);
    guiWindow.style.setProperty("--wp-h", `${a.h * 100}%`);
    guiWindow.style.setProperty("--wp-aspect", String(shell.shellAspect));
  } catch (err) {
    console.warn("collection-acadia: shell manifest missing — run "
      + "tools/export_acadia_collection_assets.py", err);
  }
  const mosaicEl = root.querySelector("#collection-mosaic");
  const head = root.querySelector(".collection-head");
  const statsPanel = root.querySelector("#collection-stats");
  const statNums = root.querySelectorAll("[data-count-to]");

  let manifest, states, constants;
  try {
    [manifest, states, constants] = await Promise.all([
      loadJSON(`${BASE}/manifest.json`),
      loadJSON(`${BASE}/gui/states.json`),
      loadJSON(`${BASE}/gui/constants.json`),
    ]);
  } catch (err) {
    console.warn("collection: assets missing, leaving static.", err);
    if (head) head.style.opacity = "1";
    if (statsPanel) statsPanel.style.opacity = "1";
    statNums.forEach((el) => (el.textContent = el.dataset.countTo));
    return { render() {}, refresh() {} };
  }

  let entries = manifest.mosaic || [];
  if (props.widthFilter != null) {
    entries = entries.filter((e) => e.chasm_width === props.widthFilter);
  }
  if (props.mosaicLimit > 0) entries = entries.slice(0, props.mosaicLimit);

  mosaicEl.innerHTML = "";
  const cards = entries.map((entry) => {
    const card = document.createElement("div");
    card.className = "mosaic__card";
    const img = document.createElement("img");
    img.src = `${BASE}/${entry.file}`;
    img.alt = "";
    img.loading = "lazy";
    card.appendChild(img);
    mosaicEl.appendChild(card);
    return card;
  });

  const hasRenderer = Boolean(window.BridgeRenderer);
  const nSteps = states.length;
  let drawnStep = -1;

  function drawStep(step) {
    if (!hasRenderer) return;
    const idx = Math.max(0, Math.min(step, nSteps - 1));
    if (idx === drawnStep) return;
    drawnStep = idx;
    window.BridgeRenderer.drawScene(canvas, states[idx], constants, { bars: states[idx].bars });
  }

  const setNum = (el, v) => (el.textContent = String(Math.round(v)));

  const headEl = root.querySelector(".collection-head");
  const canvasArea = root.querySelector("#collection-canvas");

  /**
   * How far the window slides right to clear the copy.
   *
   * The website's 24% of stage width put it at 1421 on a 1920 slide, when the
   * space left by the copy runs 544 to 1824 and is centred at 1184 — 237px too
   * far over. That factor was tuned against the website's own copy column, not
   * this one, so it is replaced by the distance actually needed: from where the
   * window rests (centred in its area) to the middle of what the copy leaves.
   */
  function guiShift() {
    if (!headEl || !canvasArea) return stage.getBoundingClientRect().width * 0.24;
    const area = canvasArea.getBoundingClientRect();
    const head = headEl.getBoundingClientRect();
    if (!area.width) return 0;
    const free = (head.right + area.right) / 2;
    return free - (area.left + area.width / 2);
  }

  let scatter = computeScatter(cards.length, stage.getBoundingClientRect());
  let guiX = guiShift();

  function refresh() {
    const rect = stage.getBoundingClientRect();
    scatter = computeScatter(cards.length, rect);
    guiX = guiShift();
  }

  function render(p) {
    const enter = easeInOut(clamp01(p / 0.12));

    let xf = 0;
    if (p < 0.24) xf = easeInOut(clamp01((p - 0.12) / 0.12));
    else if (p < 0.56) xf = 1;
    else xf = 1 - easeInOut(clamp01((p - 0.56) / 0.12));

    const guiFade = clamp01((p - 0.68) / 0.1);
    const guiOpacity = enter * (1 - guiFade);
    const guiScale = enter * (1 - 0.08 * guiFade);
    guiWindow.style.opacity = String(guiOpacity);
    guiWindow.style.transform = `translateX(${guiX * xf}px) scale(${guiScale})`;

    drawStep(Math.floor(clamp01((p - 0.24) / 0.32) * nSteps));

    if (head) {
      const headIn = clamp01((p - 0.12) / 0.1);
      const headOut = clamp01((p - 0.56) / 0.1);
      head.style.opacity = String(headIn * (1 - headOut));
    }

    const emerge = clamp01((p - 0.68) / 0.1);
    const fly = easeInOut(clamp01((p - 0.78) / 0.22));
    for (let i = 0; i < cards.length; i++) {
      const s = scatter[i];
      const card = cards[i];
      card.style.opacity = String(emerge);
      card.style.setProperty("--tx", `${s.tx * fly}px`);
      card.style.setProperty("--ty", `${s.ty * fly}px`);
      card.style.setProperty("--rot", `${s.rot * fly}deg`);
      card.style.setProperty("--sc", String(s.sc * emerge));
      card.style.setProperty("--shadowA", String(fly));
    }

    statsPanel.style.opacity = String(clamp01((p - 0.8) / 0.12));
    const so = easeInOut(clamp01((p - 0.8) / 0.18));
    statNums.forEach((el) => setNum(el, Number(el.dataset.countTo) * so));
  }

  return { render, refresh };
}
