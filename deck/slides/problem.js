// Problem — ported from project_website (index.html #problem + js/sections/problem.js @ 0e05d7c).
// Markup and copy verbatim; the `.js-anim` reveal replays on slide entry.

import { makeStagger } from "./_shared.js";

export const meta = { title: "The problem", defaultMinutes: 1.5 };
export const sectionClass = "section section--full section--canvas";
export const sectionId = "problem";
export const defaults = {
  eyebrow: "The problem",
  headline: "Some design knowledge lives in the doing.",
  lede: "Engineers do more than calculate. They read load paths, sense proportion, weigh constructability, and make small commitments before every criterion can be formalized. Most computational tools ask them to define the design space first. This project asks whether AI can learn from the way designers actually move through it.",
};

export const beats = [{ name: "all", p: 1 }];

export function html(p) {
  return `
    <div class="container">
      <p class="eyebrow js-anim" style="--section-accent: var(--accent-problem);">${p.eyebrow}</p>
      <h2 class="headline headline--lg js-anim">${p.headline}</h2>
      <p class="lede js-anim">${p.lede}</p>
    </div>
  `;
}

export async function mount(root) {
  const enter = makeStagger(root, { y: 32, duration: 0.8, stagger: 0.15 });
  return { render() {}, refresh() {}, enter };
}
