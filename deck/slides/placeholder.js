// Placeholder — stands in for a slide whose scene hasn't been built yet.
//
// deck.js falls back to this whenever `slides/<use>.js` is missing, so a talk
// manifest can describe the FULL arc of the paper from day one and stay
// unchanged as scenes land. Building a scene later means adding the file —
// never editing the manifests.

export const meta = { title: "Placeholder", defaultMinutes: 1 };
export const sectionClass = "section section--full section--canvas";

export const defaults = { eyebrow: "", headline: "", body: "" };

export const beats = [{ name: "all", p: 1 }];

export function html(p) {
  return `
    <div class="container slide--placeholder">
      <p class="eyebrow">${p.eyebrow || "Not yet ported"}</p>
      <h2 class="headline headline--lg">${p.headline || p.slideId || "Untitled slide"}</h2>
      ${p.body ? `<p class="lede">${p.body}</p>` : ""}
      <p class="placeholder-tag">scene not ported yet — <code>slides/${p.slideId}.js</code></p>
    </div>
  `;
}

export async function mount() {
  return { render() {}, refresh() {} };
}
