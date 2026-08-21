// Project information — ported from project_website (index.html #project +
// js/sections/project.js @ 0e05d7c), copy verbatim.
//
// Two deliberate departures from the website. The BibTeX expand/copy buttons
// are gone: nobody transcribes a citation off a projected slide, and they cost
// the two paper cards a third of their height. And the four cards share one
// grid rather than stacking two rows of two, so the closing slide uses the
// width it has — see the `#project` block in deck-overrides.css.

import { makeStagger } from "./_shared.js";

export const meta = { title: "Papers & code", defaultMinutes: 1 };
export const sectionClass = "section section--full section--project";
export const sectionId = "project";
export const defaults = {
  eyebrow: "Project Information",
  headline: "Papers, code &amp; contact.",
  lede: "The IASS paper focuses on capturing structural intuition through flow-based imitation and human-gated correction. The ACADIA paper extends the same infrastructure into a browser-based teaching-to-teaming co-design framework. Both papers are built on GooGym2D, an open-source, graph-based structural design environment with FEM validation.",
};

export const beats = [{ name: "all", p: 1 }];

export function html(p) {
  return `
    <div class="container project__inner">
      <p class="eyebrow js-anim" style="--section-accent: var(--accent-project);">${p.eyebrow}</p>
      <h2 class="headline headline--lg js-anim">${p.headline}</h2>
      <p class="lede js-anim">${p.lede}</p>

      <div class="project-grid">
        <div class="project-papers">
          <article class="paper-card js-anim">
            <span class="paper-card__venue">IASS 2026</span>
            <h3 class="paper-card__title">Capturing Structural Intuition: Human-Gated Imitation Learning for Structural Design with Flow Matching</h3>
            <p class="paper-card__authors">Tao Sun, Shaoyi Wang, Simon Schleicher, Ramon E. Weber</p>
            <p class="paper-card__note">Proceedings of the IASS Annual Symposium 2026 · PDF coming soon.</p>
          </article>

          <article class="paper-card js-anim">
            <span class="paper-card__venue">ACADIA 2026</span>
            <h3 class="paper-card__title">From Teaching to Teaming: Human-AI Co-Design Environment for Architectural and Structural Design</h3>
            <p class="paper-card__authors">Tao Sun, Shaoyi Wang, Simon Schleicher, Ramon E. Weber</p>
            <p class="paper-card__note">Proceedings of ACADIA 2026 · PDF coming soon.</p>
          </article>
        </div>

        <div class="project-links">
          <a class="info-card info-card--link js-anim" href="https://github.com/LupoSun/GooGym2D" target="_blank" rel="noopener">
            <span class="info-card__label">Code</span>
            <span class="info-card__value">github.com/LupoSun/GooGym2D</span>
            <span class="info-card__sub">Environment, training, web player &amp; assist mode.</span>
          </a>

          <div class="info-card js-anim">
            <span class="info-card__label">Contact</span>
            <a class="info-card__value" href="mailto:tao_sun@berkeley.edu">tao_sun@berkeley.edu</a>
            <span class="info-card__sub">Tao Sun · University of California, Berkeley</span>
            <span class="info-card__social">
              <a href="https://scholar.google.com/citations?user=MQ8mvtAAAAAJ&hl=en" target="_blank" rel="noopener">Google Scholar</a>
              <a href="https://taosun.net" target="_blank" rel="noopener">Website</a>
              <a href="https://www.linkedin.com/in/tao-sun-lupo/" target="_blank" rel="noopener">LinkedIn</a>
            </span>
            </div>
        </div>
      </div>
    </div>
  `;
}

export async function mount(root) {
  const enter = makeStagger(root, { y: 28, duration: 0.7, stagger: 0.1 });

  return { render() {}, refresh() {}, enter };
}
