// Title — the opening slide of a talk.
//
// Inherits the website hero's design language (wash background, ambient
// flow-field, Aeonik display type) and adds the structure a conference title
// page actually needs: venue, paper title, subtitle, authors with affiliation
// markers, affiliations, date/location and optional links.
//
// Everything is a prop, so one skeleton serves every venue:
//   IASS   — structural blue wash, symposium theme, Turin dates
//   ACADIA — violet wash, different title and framing
//   invited talk — no venue line at all
//
// Divergence knobs beyond the copy:
//   wash    which background gradient (hero | environment | framework |
//           collection | curation | training | correction | codesign |
//           results | project), or any CSS colour/gradient
//   accent  the eyebrow / rule colour
//   align   "left" (default) or "center"
//   field   ambient particle background on/off
//   invert  flip it: the flow-field palette becomes the background, and the
//           type goes white on top of it
//   invertStyle     "aurora" (scattered radials, full spectrum) or "sweep"
//           (one directional gradient through a restricted set of hues)
//   invertHues      which palette entries the background is built from
//   invertParticles "white" or "palette"
//   subtitleWidth  the subtitle's measure. Per-talk because it depends on both
//           the wording and the face: 46ch is 966px in DM Sans and 690px in CMU
//           Serif, and what wants to be one line in one deck wants to be two in
//           another.

import { FIELD_PALETTE, createFlowField, makeStagger } from "./_shared.js";

export const meta = { title: "Title", defaultMinutes: 0.5 };
export const sectionClass = "section section--full section--title";
export const sectionId = "title";

export const beats = [{ name: "all", p: 1 }];

export const defaults = {
  venue: "",              // eyebrow, e.g. "IASS-IWSS 2026"
  paperTitle: "",         // the big line
  subtitle: "",           // one-line framing under the title
  authors: [],            // ["Tao Sun*", "Shaoyi Wang"] or [{name, marks}]
  affiliations: [],       // ["University of California, Berkeley"] — auto-numbered
  venueLong: "",          // "Annual Symposium of the IASS — R-Evolution of Shapes"
  location: "",
  date: "",
  links: [],              // [{label, value}] e.g. repo, contact
  wash: "hero",
  accent: "",             // defaults to the wash's own accent
  align: "left",
  field: true,
  invert: false,
  invertStyle: "aurora",
  invertHues: [],         // defaults to the whole flow-field palette
  invertParticles: "white",
  invertDepth: 0.45,      // how far each colour is carried toward the deep base
  subtitleWidth: "",      // any CSS length; defaults to the 46ch in the stylesheet
};

// --- inverted mode ---------------------------------------------------------
//
// Normally the slide is a pale wash with coloured particles drifting over it.
// Inverted, those same particle colours become the ground — one soft radial per
// colour, scattered so they read as an aurora rather than a rainbow band — and
// the particles come back as white on top.
//
// The colours are carried partway toward a deep base rather than used neat.
// Open Color mid-tones are too light to put white type on: #82c91e against
// white is about 1.8:1, which is unreadable at any size. At depth 0.45 every
// one of them clears 5:1.
const INVERT_BASE = "#0b1020";
const MESH_SPOTS = [
  [10, 18], [86, 12], [26, 82], [94, 64], [54, 36], [68, 96], [4, 58],
];

function mix(hex, base, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = h(hex);
  const [r2, g2, b2] = h(base);
  const m = (a, b) => Math.round(a * (1 - t) + b * t);
  return `#${[m(r1, r2), m(g1, g2), m(b1, b2)]
    .map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Scattered radials, one per hue — the blotchy, full-spectrum look.
function auroraWash(hues, depth) {
  const layers = hues.map((c, i) => {
    const [x, y] = MESH_SPOTS[i % MESH_SPOTS.length];
    return `radial-gradient(62% 62% at ${x}% ${y}%, ` +
      `${mix(c, INVERT_BASE, depth)} 0%, transparent 70%)`;
  });
  // The base shows through between the spots, so it is the deepest of them.
  return `${layers.join(", ")}, ${mix(hues[0], INVERT_BASE, depth + 0.35)}`;
}

// One directional gradient instead of scattered blooms, with a single low glow
// for depth. Deliberately a different *geometry*, not a recolour: two decks that
// both used scattered radials would still read as the same slide in two inks.
function sweepWash(hues, depth) {
  const stops = hues
    .map((c, i) => `${mix(c, INVERT_BASE, depth)} ${Math.round((i / (hues.length - 1)) * 100)}%`)
    .join(", ");
  const glow = mix(hues[0], INVERT_BASE, Math.max(0, depth - 0.18));
  return `radial-gradient(120% 85% at 12% 108%, ${glow} 0%, transparent 62%), ` +
    `linear-gradient(115deg, ${stops})`;
}

const WASHES = new Set([
  "hero", "environment", "framework", "project", "results",
  "teaching-collection", "teaching-curation", "teaching-training",
  "teaching-correction", "teaming-codesign",
]);

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

/** Authors may be plain strings or {name, marks:[1,2]} for affiliation markers. */
function renderAuthors(authors) {
  if (!authors?.length) return "";
  return authors
    .map((a) => {
      if (typeof a === "string") return `<span class="title-author">${esc(a)}</span>`;
      const marks = (a.marks || []).length
        ? `<sup class="title-mark">${(a.marks || []).join(",")}</sup>`
        : "";
      return `<span class="title-author">${esc(a.name)}${marks}</span>`;
    })
    .join('<span class="title-sep">·</span>');
}

function renderAffiliations(affiliations) {
  if (!affiliations?.length) return "";
  const numbered = affiliations.length > 1;
  return `<ul class="title-affils">${affiliations
    .map(
      (a, i) =>
        `<li>${numbered ? `<sup class="title-mark">${i + 1}</sup>` : ""}${esc(a)}</li>`,
    )
    .join("")}</ul>`;
}

export function html(p) {
  const when = [p.location, p.date].filter(Boolean).map(esc).join(" · ");
  const links = (p.links || [])
    .map(
      (l) =>
        `<span class="title-link"><span class="title-link__label">${esc(l.label)}</span>` +
        `<span class="title-link__value">${esc(l.value)}</span></span>`,
    )
    .join("");

  return `
    ${p.field ? `<canvas class="hero__field" id="title-field" aria-hidden="true"></canvas>` : ""}
    <div class="container title__inner title--${p.align === "center" ? "center" : "left"}">
      ${p.venue ? `<p class="eyebrow js-anim">${esc(p.venue)}</p>` : ""}
      <h1 class="headline headline--xl js-anim title__headline">${esc(p.paperTitle)}</h1>
      ${p.subtitle ? `<p class="lede js-anim title__subtitle">${esc(p.subtitle)}</p>` : ""}

      <div class="title-meta js-anim">
        ${p.authors?.length ? `<p class="title-authors">${renderAuthors(p.authors)}</p>` : ""}
        ${renderAffiliations(p.affiliations)}
        ${p.venueLong ? `<p class="title-venue">${esc(p.venueLong)}</p>` : ""}
        ${when ? `<p class="title-when">${when}</p>` : ""}
      </div>

      ${links ? `<div class="title-links js-anim">${links}</div>` : ""}
    </div>
  `;
}

export async function mount(root, props) {
  // Background + accent are set on the section itself so the whole slide picks
  // them up, exactly like the website's per-section washes.
  const wash = props.wash || "hero";
  const invert = !!props.invert;
  root.classList.toggle("title--invert", invert);
  const hues = props.invertHues?.length ? props.invertHues : FIELD_PALETTE;
  const buildWash = props.invertStyle === "sweep" ? sweepWash : auroraWash;
  root.style.setProperty(
    "--title-wash",
    invert ? buildWash(hues, props.invertDepth ?? 0.45)
           : WASHES.has(wash) ? `var(--wash-${wash})` : wash,
  );
  root.style.setProperty(
    "--section-accent",
    props.accent ||
      (invert ? "#fff"
              : WASHES.has(wash) ? `var(--accent-${wash})` : "var(--accent-hero)"),
  );

  if (props.subtitleWidth) {
    root.style.setProperty("--title-subtitle-w", props.subtitleWidth);
  }

  const enterStagger = makeStagger(root, { y: 24, duration: 0.8, stagger: 0.1 });
  const fieldOpts = !invert
    ? {}
    : props.invertParticles === "palette"
      ? { alpha: 1.5 }          // its own colours, lifted so they carry on a deep ground
      : { color: "#fff", alpha: 1.25 };
  const field = props.field
    ? createFlowField(root, root.querySelector("#title-field"), fieldOpts)
    : null;

  return {
    render() {},
    refresh: () => field?.resize(),
    enter() {
      field?.resize();
      field?.start();
      enterStagger();
    },
    leave: () => field?.stop(),
  };
}
