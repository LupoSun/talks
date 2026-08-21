// Framework — ported from project_website (index.html #framework +
// js/sections/framework.js @ 0e05d7c). Markup, copy and motion verbatim.
//
// Website beat map, preserved:
//   p 0.00-0.33  fly in from below → centered
//   p 0.33-0.66  hold centered
//   p 0.66-1.00  fly out the top
//
// On a slide there is no "scroll past", so the deck stops at the centered hold:
// arriving shows the copy, and one keypress flies the flowchart in.

import { clamp01, easeInOut, makeStagger } from "./_shared.js";

export const meta = { title: "Framework", defaultMinutes: 2 };
export const sectionClass = "section--framework";
export const sectionId = "framework";

export const defaults = {
  eyebrow: "Framework",
  headline: "One loop, from teaching to teaming.",
  body: "The pieces form a single human-in-the-loop cycle. Designers demonstrate and curate examples; a flow-based policy trains on them; a designer replays and corrects where it fails; and the improved policy returns to the browser as a co-design partner.",
};

export const beats = [
  { name: "copy", p: 0.0 },
  { name: "flowchart", p: 0.45 },
];

export function html(p) {
  return `
    <div class="framework-stage">
      <div class="container framework-stage__inner">
        <div class="framework-copy">
          <p class="eyebrow js-anim" style="--section-accent: var(--accent-framework);">${p.eyebrow}</p>
          <h2 class="headline headline--lg js-anim">${p.headline}</h2>
          <p class="body js-anim framework-head__sub">${p.body}</p>
        </div>
        <div class="framework-viewport" aria-hidden="true">
          <img class="framework-flow"
            src="assets/framework/flowchart.png"
            loading="lazy"
            decoding="async"
            alt="Teaching-to-teaming framework: demonstration, curation, training, and correction feed a flow-based policy that returns to the browser for human-AI co-design, with the human kept in the loop.">
        </div>
      </div>
    </div>
  `;
}

export async function mount(root) {
  const stage = root.querySelector(".framework-stage");
  const flow = root.querySelector(".framework-flow");
  const enterCopy = makeStagger(root, { selector: ".framework-copy .js-anim", y: 28, duration: 0.7 });
  if (!stage || !flow) return { render() {}, refresh() {}, enter: enterCopy };

  let off = 0; // travel distance (px) to clear the stage top/bottom
  function refresh() {
    const h = stage.getBoundingClientRect().height || window.innerHeight;
    off = h * 0.62;
  }
  refresh();

  const PEAK = 1.2; // slight magnification while centered

  function render(p) {
    let y, s;
    if (p < 0.33) {
      const t = easeInOut(p / 0.33);
      y = off * (1 - t);
      s = 1 + (PEAK - 1) * t;
    } else if (p < 0.66) {
      y = 0;
      s = PEAK;
    } else {
      const t = easeInOut((p - 0.66) / 0.34);
      y = -off * t;
      s = PEAK - (PEAK - 1) * t;
    }
    const op = clamp01(p / 0.1) * (1 - clamp01((p - 0.9) / 0.1));
    flow.style.transform = `translateY(${y}px) scale(${s})`;
    flow.style.opacity = String(op);
  }

  return { render, refresh, enter: enterCopy };
}
