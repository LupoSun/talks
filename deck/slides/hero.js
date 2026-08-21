// Hero — ported from project_website (index.html #hero + js/sections/hero.js @ 0e05d7c).
// Markup and copy verbatim; the ambient flow-field canvas is unchanged. Only the
// trigger differs: the load-in stagger replays on slide entry instead of page load.

import { createFlowField, makeStagger } from "./_shared.js";

export const meta = { title: "Hero", defaultMinutes: 0.5 };
export const sectionClass = "section section--full section--hero";
export const sectionId = "hero";
export const defaults = {
  headline: "Capturing structural design intuition for human-AI co-design.",
  lede: "Good structural design depends on judgment that is hard to write down: how a designer reads a design brief, conceptualizes a scheme, and knows when a structure feels right. We present a human-AI co-design framework that keeps the designer in the loop throughout training and deployment. The model learns implicit design knowledge directly from human demonstrations and collaborates with the designer through iterative back-and-forth on a shared artifact.",
};

export const beats = [{ name: "all", p: 1 }];

export function html(p) {
  return `
    <canvas class="hero__field" id="hero-field" aria-hidden="true"></canvas>
    <div class="container hero__inner">
      <h1 class="headline headline--xl js-anim">${p.headline}</h1>
      <p class="lede js-anim">${p.lede}</p>
      <p class="hero__tags js-anim">#StructuralDesign · #ImitationLearning · #FlowMatching · #HumanAICoDesign · #GenerativeDesign · #HCI</p>
    </div>
  `;
}

export async function mount(root) {
  const enterStagger = makeStagger(root, { y: 24 });
  // The ambient flow-field lives in _shared.js — the title slide uses it too.
  const field = createFlowField(root, root.querySelector("#hero-field"));

  return {
    render() {},
    refresh: () => field?.resize(),
    // Only runs while this slide is on screen; no background rAF behind the
    // other ten slides.
    enter() {
      field?.resize();
      field?.start();
      enterStagger();
    },
    leave: () => field?.stop(),
  };
}
