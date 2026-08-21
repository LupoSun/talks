// Markdown for slide copy.
//
// Slide props are authored by hand, in Backstage or in a talk's JSON, and the
// person editing them is writing a talk — not markup. `- point` and `**this**`
// are what they should be able to type; `<span class="pt">…<strong>…` is what
// the skeletons need. This converts the first into the second.
//
// Deliberately small: bullets, bold, italic, code. Not a Markdown
// implementation — a slide is a headline and a few points, and anything that
// wants more structure than this wants a different slide. Raw HTML in a prop is
// left alone, so the handful of places that need it still work.

/** Inline runs: **bold**, *italic* or _italic_, `code`. */
function inline(text) {
  return text
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>")
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:!?)]|$)/g, "$1<em>$2</em>");
}

const BULLET = /^\s*[-•]\s+(.*)$/;

/**
 * One prop's worth of Markdown.
 *
 * A block containing any `- ` line becomes talking points — each bullet a
 * `.pt` span, with following unindented text folded into the bullet above it so
 * a long point can be wrapped across lines in the source. A block with no
 * bullets is returned as a single inline-formatted run.
 */
export function mdToHtml(src) {
  if (typeof src !== "string" || !src.trim()) return src;

  const lines = src.split(/\r?\n/);
  if (!lines.some((l) => BULLET.test(l))) return inline(src.trim());

  const points = [];
  for (const line of lines) {
    const m = line.match(BULLET);
    if (m) {
      points.push(m[1].trim());
    } else if (line.trim() && points.length) {
      // A continuation of the point above, not a new one.
      points[points.length - 1] += ` ${line.trim()}`;
    }
  }
  return points.map((p) => `<span class="pt">${inline(p)}</span>`).join("");
}

/**
 * Every string in a props object, converted. Arrays are mapped (per-beat
 * caption lists), and anything that is not a string is passed through
 * untouched — `bodyColumns` is a number and `showEquations` a boolean.
 */
export function renderProps(props) {
  const out = {};
  for (const [key, value] of Object.entries(props || {})) {
    if (typeof value === "string") out[key] = mdToHtml(value);
    else if (Array.isArray(value)) out[key] = value.map((v) => (typeof v === "string" ? mdToHtml(v) : v));
    else out[key] = value;
  }
  return out;
}
