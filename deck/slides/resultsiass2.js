// Outcomes (IASS) — the paper's Figure 5, built round by round.
//
// This is the second half of the results story and picks up exactly where
// `resultsiass` leaves off: that slide plots the checkpoint sweeps and lands on
// "44% by round six", this one shows what those percentages are made of. Same
// section theme, same per-round colour ramp, so the two read as one page turning.
//
// Each row is a round: ten sampled rollouts laid out as a horizontal bar, the
// ones that fell first on pink, the ones that stood after them on green, and the
// measured success rate at the right end. As the rounds advance the green end of
// the bar grows, which is the whole argument in one shape.
//
// Data: assets-static/outcomes-iass/, sliced out of the paper's own Figure 5 by
// tools/export_iass_outcomes_assets.py. Note the cells are ordered failures-first
// here, where the paper puts successes first — the bar then grows towards the
// percentage instead of away from it.

import { clamp01, loadJSON } from "./_shared.js";

const BASE = "assets-static/outcomes-iass";

export const meta = { title: "Outcomes (IASS)", defaultMinutes: 2 };
export const sectionClass = "section--results";
export const sectionId = "results-iass-outcomes";

export const defaults = {
  eyebrow: "Results · Outcomes",
  headline: "What the percentages are made of.",
  body:
    "Ten rollouts sampled from each round's best checkpoint, drawn on the ground they earned: " +
    "pink where the bridge fell, green where it stood. The green end of the bar grows round by round.",
  failLabel: "collapsed",
  okLabel: "stood",
  footnote: "ten sampled rollouts per round · 10 m span",
};

// The rounds play themselves.
//
// Seven keypresses for seven rows made the slide feel like a spreadsheet being
// filled in. One beat now runs the whole build — rows landing top to bottom,
// each one's cells sweeping left to right — and hands over to the swell when it
// reaches the bottom. The presenter says the sentence once and the chart keeps
// up with it.
const REVEAL_SECONDS = 6.3; // the full build, Pre-DAgger through Round 6
const ROW_DUTY = 0.6; // fraction of each row's slot spent moving; the rest is a
// hold, so the rounds read as seven arrivals rather than one continuous sweep
const SETTLE_SECONDS = 0.5; // a breath between the build and the swell

// Once every round is on screen the bars breathe in turn, top row to bottom —
// the same rise read a second time, as motion instead of length.
const SWELL_STAGGER = 0.34; // seconds between one row and the next
const SWELL_DUR = 0.8; // seconds for a row to swell and settle
const SWELL_REST = 0.9; // pause before the wave runs again
const SWELL_SCALE = 0.035;
const SWELL_CYCLE = 7 * SWELL_STAGGER + SWELL_REST;

// A single beat: arriving at the slide is the cue, and the rest is timed.
// The build here runs on a clock, not on `p` — `enter()` plays it and `render`
// only holds the final state, so progress-valued stops did nothing and the
// export caught the chart half-built. Declared instead as elapsed milliseconds:
// seven rows over REVEAL_SECONDS, then SETTLE_SECONDS, then the swell.
export const captureHold = {
  rounds: [900, 1800, 2700, 3600, 4500, 5400, 6300, 8200],
};

export const beats = [{ name: "rounds", p: 1.0 }];

export function html(p) {
  return `
    <div class="results-stage">
      <div class="container results-stage__inner oc-split">
        <div class="oc-copy">
          <p class="eyebrow" style="--section-accent: var(--accent-results);">${p.eyebrow}</p>
          <h2 class="headline headline--lg">${p.headline}</h2>
          <p class="body oc-copy__sub">${p.body}</p>
          <div class="oc-legend" aria-hidden="true">
            <span class="oc-legend__item"><i class="oc-legend__chip is-fail"></i>${p.failLabel}</span>
            <span class="oc-legend__item"><i class="oc-legend__chip is-ok"></i>${p.okLabel}</span>
          </div>
        </div>

        <div class="oc-panel">
          <div class="oc-chart" id="oc-chart" role="img"
            aria-label="Sampled rollouts per correction round; the proportion that stood rises from 14% before correction to 44% by round six."></div>
          <p class="oc-foot">${p.footnote}</p>
        </div>
      </div>
    </div>
  `;
}

export async function mount(root, props) {
  const host = root.querySelector("#oc-chart");
  if (!host) return { render() {}, refresh() {} };

  let manifest;
  try {
    manifest = await loadJSON(`${BASE}/manifest.json`);
  } catch (err) {
    console.warn("outcomes-iass: manifest missing — run tools/export_iass_outcomes_assets.py", err);
    return { render() {}, refresh() {} };
  }

  const rows = manifest.rows || [];
  const built = [];

  host.innerHTML = "";
  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "oc-row";

    const label = document.createElement("span");
    label.className = "oc-row__label";
    label.textContent = row.label;

    const track = document.createElement("div");
    track.className = "oc-row__track";

    // Failures first: the bar then grows towards the percentage at its end.
    const ordered = [...row.cells].sort((a, b) => Number(a.success) - Number(b.success));
    const cells = ordered.map((c) => {
      const cell = document.createElement("div");
      cell.className = `oc-cell ${c.success ? "is-ok" : "is-fail"}`;
      const img = document.createElement("img");
      img.src = `${BASE}/${c.file}`;
      img.alt = "";
      img.loading = "lazy";
      cell.appendChild(img);
      track.appendChild(cell);
      return cell;
    });

    const pct = document.createElement("span");
    pct.className = "oc-row__pct";
    if (row.color) pct.style.color = row.color;
    pct.textContent = "0%";

    rowEl.append(label, track, pct);
    host.appendChild(rowEl);
    built.push({ rowEl, track, cells, pct, rate: row.rate ?? 0 });
  });

  // Rows land in order; within a row the cells sweep left to right.
  function paint(p) {
    const v = clamp01(p) * built.length;
    built.forEach((r, i) => {
      // Each row owns a slot of 1/n; it animates through ROW_DUTY of that slot
      // and then waits, which is what separates one round from the next.
      const t = clamp01((v - i) / ROW_DUTY);
      r.rowEl.style.opacity = String(t > 0 ? 1 : 0.18);
      r.cells.forEach((cell, ci) => {
        // Stagger across the row, with the last sliver of the beat reserved
        // for the number so it reads as the consequence of the cells.
        const span = 1 / (r.cells.length + 2);
        const c = clamp01((t - ci * span) / span);
        cell.style.opacity = String(c);
        cell.style.transform = `scale(${0.86 + 0.14 * c})`;
      });
      // The number lands once the last cell has: normalise over what is left
      // of the beat, or it tops out partway and reports the wrong rate.
      const start = (r.cells.length - 1) / (r.cells.length + 2);
      const shown = clamp01((t - start) / (1 - start));
      r.pct.textContent = `${Math.round(r.rate * 100 * shown)}%`;
      r.pct.style.opacity = String(shown);
    });
  }

  function setSwell(r, s) {
    const t = `scale(${1 + SWELL_SCALE * s})`;
    r.track.style.transform = t;
    r.pct.style.transform = t; // the number belongs to the bar, so it breathes with it
  }

  function resetSwell() {
    built.forEach((r) => setSwell(r, 0));
  }

  // --- the timed build, then the swell -------------------------------------
  let raf = 0;
  let running = false;
  let t0 = 0;

  function frame(now) {
    if (!t0) t0 = now;
    const elapsed = (now - t0) / 1000;

    if (elapsed < REVEAL_SECONDS) {
      paint(elapsed / REVEAL_SECONDS);
    } else {
      paint(1);
      const since = elapsed - REVEAL_SECONDS - SETTLE_SECONDS;
      if (since > 0) {
        const t = since % SWELL_CYCLE;
        built.forEach((r, i) => {
          const u = (t - i * SWELL_STAGGER) / SWELL_DUR;
          setSwell(r, u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0);
        });
      }
    }
    if (running) raf = requestAnimationFrame(frame);
  }

  paint(0);
  return {
    // With one beat the driver only ever asks for the finished state, which is
    // what a Backstage preview and a PDF export want. The build is `enter`'s job.
    render(p) {
      if (!running) paint(clamp01(p));
    },
    refresh() {},
    enter() {
      if (running) return;
      running = true;
      t0 = 0;
      resetSwell();
      raf = requestAnimationFrame(frame);
    },
    leave() {
      running = false;
      cancelAnimationFrame(raf);
      t0 = 0;
      resetSwell();
      paint(1);
    },
  };
}
