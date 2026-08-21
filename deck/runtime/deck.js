// Deck runtime — turns a talk manifest into a Reveal.js deck.
//
// Slides are venue-agnostic modules in ../slides/. A talk is a manifest in
// ../talks/ that lists slide ids, per-talk props, per-talk speaker notes and a
// minutes budget. One slide can therefore appear in many talks, framed
// differently, without ever being copied.
//
//   presentations/index.html?talk=iass2026
//   presentations/index.html?talk=acadia2026
//
// Slide module contract:
//   export const meta     = { title, defaultMinutes }
//   export const defaults = { ...props }
//   export const beats    = [{ name, p }]        // ordered, ascending p
//   export function html(props) -> string        // slide innerHTML
//   export async function mount(root, props) -> { render(p), refresh?() }

import { createBeatDriver } from "./beat-driver.js";
import { CHANNEL, MSG, PARAM } from "./present-protocol.js";
import { renderProps } from "./markdown.js";

const params = new URLSearchParams(location.search);
const TALK_ID = params.get("talk") || "acadia2026";
const PRINTING = params.has("print-pdf");
const EXPORTING = params.has("export");

// Deterministic randomness while exporting.
//
// The title's flow field seeds itself from Math.random, so two export runs would
// otherwise differ in every particle and the deck would never diff cleanly
// against a previous export. Replaced before any scene mounts, so everything
// downstream draws the same picture every time.
if (EXPORTING) {
  let seed = 0x2f6e2b1 >>> 0;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
// Set by Backstage's Present button.
const WANT_FULLSCREEN = params.has("present");
const WANT_SPEAKER = params.has("speaker");
// Render a single talk entry, chrome-free — used for Backstage thumbnails.
const ONLY_ID = params.get("only");
// Render a bare skeleton with module defaults only — the skeleton palette.
const SKELETON = params.get("skeleton");
// Record how long each slide is actually on screen, and post it when you leave.
const REHEARSING = params.has("rehearse");

/**
 * Fullscreen and opening the speaker window both require a user gesture in THIS
 * document — a click in the opener doesn't count, and a popup opened without one
 * gets blocked. So when launched from Backstage we show a single start curtain
 * and do both from that one click.
 */
function installStartCurtain(deck) {
  if (!WANT_FULLSCREEN && !WANT_SPEAKER) return;

  const curtain = document.createElement("div");
  curtain.className = "deck-curtain";
  curtain.innerHTML = `
    <div class="deck-curtain__inner">
      <p class="deck-curtain__title">Ready to present</p>
      <p class="deck-curtain__sub">Click anywhere, or press any key</p>
      <p class="deck-curtain__keys">→ ↓ scroll · S speaker view · Esc overview</p>
    </div>`;
  document.body.appendChild(curtain);

  let started = false;
  // The presenter console needs to know whether the show has actually begun:
  // until the curtain lifts, this window is still a title card and its notes
  // are not the notes of anything being presented.
  window.__deckStarted = false;
  async function start() {
    if (started) return;
    started = true;
    window.__deckStarted = true;
    window.dispatchEvent(new Event("deck:started"));
    curtain.remove();
    if (WANT_FULLSCREEN) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn("deck: fullscreen refused", err);
      }
    }
    if (WANT_SPEAKER) {
      try {
        // `window.RevealNotes` is the plugin FACTORY, which has no open(); the
        // instance Reveal built is the thing that can open the window. Calling
        // the factory silently did nothing.
        const notes = deck.getPlugin?.("notes");
        if (notes?.open) notes.open();
        else console.warn("deck: notes plugin unavailable — press S instead.");
      } catch (err) {
        console.warn("deck: speaker view refused", err);
      }
    }
    deck.focus?.();
  }

  curtain.addEventListener("click", start);
  window.addEventListener("keydown", start, { once: true });
  // The presenter console drives this window over a channel, not by clicking
  // it, so it needs a way to raise the curtain too. Fullscreen is deliberately
  // NOT attempted there: it requires a gesture in this window, which is the
  // whole reason the curtain exists — clicking the deck once is what makes it
  // full screen on the projector.
  window.__deckRaiseCurtain = () => {
    if (started) return;
    started = true;
    window.__deckStarted = true;
    window.dispatchEvent(new Event("deck:started"));
    curtain.remove();
    deck.focus?.();
  };
}

/** Resolve a manifest's optional beat subset against the slide's own beats. */
function resolveBeats(moduleBeats, requested) {
  const all = moduleBeats && moduleBeats.length ? moduleBeats : [{ name: "all", p: 1 }];
  if (!requested || !requested.length) return all;
  const byName = new Map(all.map((b) => [b.name, b]));
  const picked = requested.map((n) => byName.get(n)).filter(Boolean);
  if (!picked.length) {
    console.warn(`deck: no beats matched ${JSON.stringify(requested)}; using all.`);
    return all;
  }
  return picked.sort((a, b) => a.p - b.p);
}

const escapeHTML = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Speaker notes for one slide.
 *
 * Blank-line-separated blocks in the manifest become separate paragraphs, and a
 * single newline becomes a line break — a wall of text is unreadable on stage.
 * A timing line is prepended automatically: this slide's budget and where you
 * should be on the clock by the end of it, so you can tell at a glance whether
 * you are running long without doing arithmetic mid-sentence.
 */
function buildNotes(entry, minutes, elapsed, target) {
  const aside = document.createElement("aside");
  aside.className = "notes";

  const mmss = (m) => `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, "0")}`;
  const timing =
    `<p><strong>⏱ ${minutes} min · by end ${mmss(elapsed)}` +
    (target ? ` / ${target}:00` : "") +
    `</strong></p>`;

  // Lines beginning "- " become real list items: on stage you scan a list, you
  // do not read a paragraph. Anything else stays a paragraph, and a line
  // starting "⚠" is emphasised as an aside rather than something to read out.
  const body = String(entry.notes || "")
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) return "";
      if (lines.every((l) => l.startsWith("- "))) {
        return `<ul>${lines.map((l) => `<li>${escapeHTML(l.slice(2))}</li>`).join("")}</ul>`;
      }
      if (lines.length === 1 && lines[0].startsWith("⚠")) {
        return `<p><em>${escapeHTML(lines[0])}</em></p>`;
      }
      return `<p>${lines.map(escapeHTML).join("<br>")}</p>`;
    })
    .join("");

  aside.innerHTML = timing + body;
  return aside;
}

/**
 * Typography — one number rescales the whole deck (see css/deck-overrides.css),
 * and an optional family switch for talks that should match the paper.
 *
 *   "typography": { "scale": 1.25, "family": "dmsans" }
 */
function applyTypography(talk) {
  const typo = talk.typography || {};
  if (typo.scale) document.documentElement.style.setProperty("--type-scale", String(typo.scale));
  if (typo.family) document.body.dataset.fonts = typo.family;
}

/** True when the chrome's bottom bar will print a slide counter itself. */
function chromeShowsNumber(talk) {
  const cfg = talk.chrome || {};
  if (cfg.enabled === false || cfg.bottom === false) return false;
  const right = cfg.right ?? "{slide} / {total}";
  return /\{slide\}|\{total\}/.test(right);
}

/**
 * Slide chrome — a logo strip at the top and a footnote/meta bar at the bottom,
 * built once and updated per slide so they land in exactly the same place every
 * time. A slide opts out with `"chrome": false` (title and hero usually do).
 *
 *   talk.chrome = {
 *     logos: [{src, alt} | {text}],
 *     left: "…", right: "…",         // {slide} {total} {title} {venue} tokens
 *     top: true, bottom: true,
 *     logoHeight: 34
 *   }
 */
function installChrome(deck, talk, records) {
  const cfg = talk.chrome || {};
  if (cfg.enabled === false) return () => {};

  const wantTop = cfg.top !== false && (cfg.logos?.length || cfg.topRight);
  const wantBottom = cfg.bottom !== false;
  if (!wantTop && !wantBottom) return () => {};

  const root = document.documentElement;
  const topH = wantTop ? (cfg.topHeight ?? 76) : 0;
  const bottomH = wantBottom ? (cfg.bottomHeight ?? 56) : 0;
  // In `--u`, not px: the chrome has to grow with the slide like everything
  // else, or it shrinks to a sliver on a 4K display (see --u in deck-overrides).
  const u = (n) => `calc(${n} * var(--u))`;
  root.style.setProperty("--chrome-top", u(topH));
  root.style.setProperty("--chrome-bottom", u(bottomH));
  if (cfg.logoHeight) root.style.setProperty("--chrome-logo-h", u(cfg.logoHeight));

  const fill = (tpl, i, n) =>
    String(tpl ?? "")
      .replace(/\{slide\}/g, String(i + 1))
      .replace(/\{total\}/g, String(n))
      .replace(/\{title\}/g, talk.title || "")
      .replace(/\{venue\}/g, talk.venue || "");

  let top = null;
  if (wantTop) {
    top = document.createElement("div");
    top.className = "deck-chrome deck-chrome--top";
    // `height` and `offsetY` are optional and per logo. A compound mark and a
    // plain wordmark set to the same box height do not read as the same size,
    // and a wordmark with a descender centres optically above its own bounding
    // box — both need nudging per asset, not per bar.
    const logos = (cfg.logos || [])
      .map((l) => {
        if (!l.src) return `<span class="deck-logos__text">${l.text || ""}</span>`;
        const style = [
          l.height ? `height:calc(${l.height} * var(--u))` : "",
          l.offsetY ? `transform:translateY(calc(${l.offsetY} * var(--u)))` : "",
        ].filter(Boolean).join(";");
        return `<img src="${l.src}" alt="${l.alt || ""}"` +
          (style ? ` style="${style}">` : ">");
      })
      .join("");
    top.innerHTML =
      `<div class="deck-logos">${logos}</div>` +
      `<span class="deck-chrome__spacer"></span>` +
      `<span class="deck-chrome__right" data-role="top-right"></span>` +
      (cfg.rule === false ? "" : `<span class="deck-chrome__rule"></span>`);
    document.body.appendChild(top);
  }

  let bottom = null;
  if (wantBottom) {
    bottom = document.createElement("div");
    bottom.className = "deck-chrome deck-chrome--bottom";
    bottom.innerHTML =
      `<span class="deck-chrome__left" data-role="left"></span>` +
      `<span class="deck-footnote" data-role="footnote"></span>` +
      `<span class="deck-chrome__spacer"></span>` +
      `<span class="deck-chrome__right" data-role="right"></span>` +
      (cfg.rule === false ? "" : `<span class="deck-chrome__rule"></span>`);
    document.body.appendChild(bottom);
  }

  function update() {
    const i = deck.getIndices().h ?? 0;
    const rec = records[i];
    const n = records.length;
    // Per-slide chrome: `false` for none, `"top"` or `"bottom"` for one bar,
    // anything else (or absent) for both. A title slide usually wants the logos
    // but not a running footer and a slide number.
    const mode = rec?.entry?.chrome;
    const showTop = mode !== false && mode !== "bottom";
    const showBottom = mode !== false && mode !== "top";
    top?.classList.toggle("is-on", showTop);
    bottom?.classList.toggle("is-on", showBottom);
    // Reclaim the padding when a bar is off, so full-bleed slides stay full-bleed.
    // Same `--u` scaling as the initial assignment — this toggle runs on every
    // slide change and would otherwise stamp plain px back over it.
    root.style.setProperty("--chrome-top", showTop && wantTop ? u(topH) : "0px");
    root.style.setProperty("--chrome-bottom", showBottom && wantBottom ? u(bottomH) : "0px");
    if (!showTop && !showBottom) return;

    if (top && showTop) {
      top.querySelector('[data-role="top-right"]').textContent = fill(cfg.topRight, i, n);
    }
    if (bottom && showBottom) {
      bottom.querySelector('[data-role="left"]').textContent = fill(cfg.left, i, n);
      bottom.querySelector('[data-role="right"]').textContent = fill(
        cfg.right ?? "{slide} / {total}", i, n,
      );
      bottom.querySelector('[data-role="footnote"]').innerHTML = rec?.entry?.footnote
        ? `<sup>†</sup>${String(rec.entry.footnote).replace(/</g, "&lt;")}`
        : "";
    }
  }

  deck.on("slidechanged", update);
  deck.on("ready", update);
  update();
  return update;
}

/**
 * Rehearsal recorder — measures how long each slide is actually on screen and
 * posts the run when the window closes. Backstage shows it against the budget,
 * which is the honest way to find out a 15-minute talk is really 21.
 */
function installRehearsalRecorder(deck, records) {
  const spent = new Map(); // slide id -> seconds
  let currentId = null;
  let since = performance.now();
  const started = new Date().toISOString();

  const flush = () => {
    if (currentId) {
      const secs = (performance.now() - since) / 1000;
      spent.set(currentId, (spent.get(currentId) || 0) + secs);
    }
    since = performance.now();
  };

  const idAt = (indexh) => records[indexh]?.entry?.id || null;

  currentId = idAt(deck.getIndices().h);
  deck.on("slidechanged", (ev) => {
    flush();
    currentId = idAt(ev.indexh ?? 0);
  });

  const badge = document.createElement("div");
  badge.className = "deck-rehearse";
  document.body.appendChild(badge);
  const t0 = performance.now();
  setInterval(() => {
    const total = (performance.now() - t0) / 1000;
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(Math.floor(total % 60)).padStart(2, "0");
    badge.textContent = `● REC  ${mm}:${ss}`;
  }, 1000);

  const send = () => {
    flush();
    const slides = [...spent.entries()].map(([id, seconds]) => ({
      id,
      seconds: Math.round(seconds * 10) / 10,
    }));
    const total = slides.reduce((sum, s) => sum + s.seconds, 0);
    const body = JSON.stringify({ talk: TALK_ID, started, slides, total: Math.round(total) });
    // sendBeacon survives the page closing; fetch would be cancelled.
    navigator.sendBeacon?.("/api/rehearsals", new Blob([body], { type: "application/json" }));
  };

  window.addEventListener("pagehide", send);
  window.addEventListener("beforeunload", send);
}

async function build() {
  let talk;
  let entries;

  if (SKELETON) {
    // Preview a bare skeleton with only its module defaults — no talk content.
    talk = { title: `${SKELETON} (skeleton)` };
    entries = [{ id: "SKEL", use: SKELETON, name: SKELETON, props: {} }];
    document.body.classList.add("is-thumb");
  } else {
    try {
      const res = await fetch(`talks/${TALK_ID}.json`);
      if (!res.ok) throw new Error(`talks/${TALK_ID}.json — ${res.status}`);
      talk = await res.json();
    } catch (err) {
      document.body.innerHTML =
        `<div class="deck-error"><h1>Could not load talk</h1><p>${err.message}</p></div>`;
      return;
    }

    // Skeletons live in slides/*.js and hold layout + animation only. Every bit
    // of content — props, notes, minutes, beats — comes from the talk, so the
    // same skeleton can say different things in different talks.
    entries = talk.slides || [];

    // Thumbnail mode: render exactly one entry, chrome-free.
    if (ONLY_ID) {
      entries = entries.filter((e) => e.id === ONLY_ID);
      document.body.classList.add("is-thumb");
    }
  }

  document.title = talk.title || TALK_ID;
  document.body.dataset.theme = talk.theme || "default";
  applyTypography(talk);

  const slidesEl = document.querySelector(".reveal .slides");
  const records = [];
  let budget = 0;
  let budgetSoFar = 0; // running total, so each slide's notes can show the clock

  for (const entry of entries) {
    let mod;
    try {
      mod = await import(`../slides/${entry.use}.js`);
    } catch {
      // Not an error: manifests describe the whole talk up front and scenes land
      // one at a time. Anything unbuilt renders as a walkable placeholder.
      mod = await import("../slides/placeholder.js");
      console.info(`deck: "${entry.use}" not built yet — using placeholder.`);
    }

    // Props are authored in Markdown; the skeletons receive HTML.
    const props = renderProps({
      slideId: entry.use, ...(mod.defaults || {}), ...(entry.props || {}),
    });
    const beats = resolveBeats(mod.beats, entry.beats);
    const minutes = entry.minutes ?? mod.meta?.defaultMinutes ?? 1;
    budget += minutes;

    const section = document.createElement("section");
    section.dataset.slide = entry.use;
    section.dataset.sid = entry.id || "";
    section.dataset.name = entry.name || "";
    section.dataset.minutes = String(minutes);
    // Carry the website's own section classes and id onto the Reveal slide, so
    // the per-section wash backgrounds and every `.section--x` rule in
    // css/site.css apply untouched.
    if (mod.sectionClass) section.classList.add(...mod.sectionClass.split(/\s+/));
    if (mod.sectionId) section.id = mod.sectionId;
    section.innerHTML = mod.html(props);

    // One fragment per beat *transition* — Reveal then gives us the right
    // number of keypress steps, and `getIndices().f` tells us which beat we're on.
    for (let i = 1; i < beats.length; i++) {
      const f = document.createElement("span");
      f.className = "fragment deck-beat";
      f.dataset.beat = beats[i].name;
      section.appendChild(f);
    }

    budgetSoFar += minutes;
    section.appendChild(buildNotes(entry, minutes, budgetSoFar, talk.targetMinutes));

    slidesEl.appendChild(section);
    records.push({ entry, mod, props, beats, section, minutes, scene: null, driver: null });
  }

  // Duration budget — surfaced in speaker view and the console.
  const target = talk.targetMinutes;
  const over = target != null && budget > target;
  const first = records[0];
  if (first) {
    let summary = `Budget: ${budget.toFixed(1)} min across ${records.length} slides.`;
    if (target != null) {
      summary += over
        ? ` ⚠ ${(budget - target).toFixed(1)} min OVER the ${target} min slot.`
        : ` ${(target - budget).toFixed(1)} min of slack in the ${target} min slot.`;
    }
    let aside = first.section.querySelector("aside.notes");
    if (!aside) {
      aside = document.createElement("aside");
      aside.className = "notes";
      first.section.appendChild(aside);
    }
    aside.insertAdjacentHTML("afterbegin", `<p><strong>${summary}</strong></p>`);
  }
  const banner = `deck: ${talk.title} — ${budget.toFixed(1)} min / ${records.length} slides`;
  if (over) {
    console.warn(`${banner} — OVER the ${target} min slot by ${(budget - target).toFixed(1)} min.`);
  } else {
    console.info(`%c${banner}`, "font-weight:bold");
  }
  console.table(records.map((r) => ({ slide: r.entry.use, minutes: r.minutes, beats: r.beats.length })));

  // ---- Mounting -----------------------------------------------------------
  // Scenes mount lazily on first view so we don't spin up every canvas at once.
  async function ensureMounted(rec) {
    if (rec.scene || !rec.mod.mount) return rec;
    try {
      // Ported sections keep the website's early-return paths (missing assets,
      // reduced motion), which yield no scene. Fall back to a no-op so the slide
      // still renders its static markup instead of throwing.
      rec.scene = (await rec.mod.mount(rec.section, rec.props)) || { render() {} };
      rec.driver = createBeatDriver(rec.scene, rec.beats, {
        // A talk can override, but a skeleton whose beat *is* an animation —
        // one that has to be followed, not just arrived at — declares its own
        // pace in `meta.beatDuration` rather than relying on every manifest to
        // remember to set it.
        duration: rec.entry.beatDuration ?? rec.mod.meta?.beatDuration ?? 0.6,
        // Same reasoning for the curve: a beat that walks through a sequence
        // wants even spacing, not an ease that crowds the middle.
        ease: rec.entry.beatEase ?? rec.mod.meta?.beatEase,
      });
      // Backstage previews open on the finished slide, not its first beat.
      // This has to happen at mount: it used to rely on the props push that
      // follows, which can be left queued behind a gallery full of live iframes.
      rec.driver.goTo(ONLY_ID ? rec.beats.length - 1 : 0, { animate: false });
    } catch (err) {
      console.error(`deck: slide "${rec.entry.use}" failed to mount.`, err);
      rec.scene = { render() {} };
      rec.driver = createBeatDriver(rec.scene, rec.beats);
    }
    return rec;
  }

  const recordFor = (indexh) => records[indexh];

  /**
   * Fit-to-slide.
   *
   * The website is scrollable, so a section may legitimately be taller than the
   * viewport — the hero is. A slide cannot scroll, so content that would overflow
   * gets scaled down to fit rather than clipped. Styling is untouched; only the
   * final size changes.
   *
   * Applies to `.section--full` style slides (a `.container` child). The pinned
   * stages are authored to fill exactly 100% and are left alone.
   */
  function fitToSlide(section) {
    const inner = section.querySelector(":scope > .container");
    if (!inner) return;
    inner.style.transform = "none";
    const cs = getComputedStyle(section);
    const padY = parseFloat(cs.paddingTop || 0) + parseFloat(cs.paddingBottom || 0);
    const avail = section.clientHeight - padY;
    const needed = inner.getBoundingClientRect().height;
    if (needed > avail && avail > 0 && needed > 0) {
      inner.style.transformOrigin = "center center";
      inner.style.transform = `scale(${(avail / needed).toFixed(4)})`;
    }
  }

  // ---- Reveal -------------------------------------------------------------
  const deck = new window.Reveal({
    // UNSCALED: a slide is the viewport. This is what lets the website's
    // responsive CSS — every vw/vh clamp and every `min-height:100vh` stage —
    // resolve exactly as it does on the real site. Present full-screen on a 16:9
    // display and you get the site's own 16:9 composition.
    // Print mode needs concrete page dimensions, so it opts back into 1920x1080.
    width: PRINTING ? 1920 : "100%",
    height: PRINTING ? 1080 : "100%",
    margin: 0,
    minScale: 1,
    maxScale: 1,
    hash: true,
    // Reveal writes this as an INLINE style on the current slide, which beats
    // any selector — with the default "block" the website's
    // `.section { display:flex; align-items:center }` silently stops centering.
    // Flex here lets each ported section lay itself out exactly as on the site.
    display: "flex",
    // Slides are full-bleed and size themselves. Reveal's vertical centering
    // computes a top offset from natural content height, which fights a
    // height:100% child — visibly so in print/PDF layout.
    center: false,
    // Slide transitions stay plain; the motion that matters is inside the scenes.
    transition: "fade",
    transitionSpeed: "fast",
    controls: false,
    progress: true,
    // The chrome's footer already prints "{slide} / {total}"; showing Reveal's
    // own counter as well puts two numbers in the same corner.
    slideNumber: chromeShowsNumber(talk) ? false : "c/t",
    // PowerPoint-style keys. Reveal maps Up/Down to *vertical* slides by
    // default, which this deck doesn't use; remap them to plain prev/next so
    // they step beats exactly like Left/Right. Space, Backspace, PgUp and PgDn
    // already behave this way out of the box.
    keyboard: {
      38: () => deck.prev(), // Up
      40: () => deck.next(), // Down
    },
    // A backup PDF wants one page per slide showing the finished frame, not a
    // page per intermediate beat.
    pdfSeparateFragments: false,
    plugins: [window.RevealNotes].filter(Boolean),
  });

  // Reveal's event objects carry `indexh`, but getIndices() returns `{h,v,f}`,
  // and only getIndices() knows the fragment index. Always read the beat from
  // getIndices() so backwards navigation (Reveal restores every fragment) lands
  // on the last beat rather than the first.
  const currentBeat = () => (deck.getIndices().f ?? -1) + 1;

  /** Arriving at a slide: mount, re-measure, snap to whichever beat Reveal restored. */
  async function arrive(indexh) {
    const rec = recordFor(indexh);
    if (!rec) return;
    await ensureMounted(rec);
    fitToSlide(rec.section);
    rec.driver?.refresh();
    const beat = currentBeat();
    rec.driver?.goTo(beat, { animate: false });
    // Sections that open with a load-in stagger (the website's `.js-anim`
    // reveal) replay it on arrival — but only when landing on the first beat,
    // so stepping backwards into a finished slide doesn't restart it.
    if (beat === 0) rec.scene?.enter?.();
    records.forEach((other) => {
      if (other !== rec) other.scene?.leave?.();
    });
  }

  /** Stepping within a slide: tween to the new beat. No re-measure. */
  function stepBeat() {
    const rec = recordFor(deck.getIndices().h);
    rec?.driver?.goTo(currentBeat(), { animate: true });
  }

  deck.on("ready", async (ev) => {
    if (PRINTING) {
      // Print mode: mount everything at its final beat.
      for (const rec of records) await ensureMounted(rec);
      // `ready` fires BEFORE Reveal restacks slides into .pdf-page wrappers, so
      // anything measured now is stale and the scatter collapses to the centre.
      // Let layout settle, then re-measure and render the final frame.
      await new Promise((r) => setTimeout(() => requestAnimationFrame(r), 400));
      for (const rec of records) {
        rec.driver?.refresh();
        rec.driver?.goTo(rec.beats.length - 1, { animate: false });
      }
      document.body.dataset.printReady = "1"; // export tooling can wait on this
      return;
    }
    await arrive(ev.indexh ?? 0);
    // Pre-warm the next slide so its first paint isn't a blank canvas.
    if (records[1]) ensureMounted(records[1]);
  });

  deck.on("slidechanged", async (ev) => {
    await arrive(ev.indexh ?? 0);
    const nextRec = records[(ev.indexh ?? 0) + 1];
    if (nextRec) ensureMounted(nextRec);
  });

  // ---- export bridge -------------------------------------------------------
  //
  // Everything the PPTX/PDF exporter needs, and nothing the live deck uses.
  // Exposed only under ?export=1 so it cannot be mistaken for a public API.
  if (EXPORTING) {
    const settleFrames = (n = 3) =>
      new Promise((res) => {
        const tick = (k) => (k <= 0 ? res() : requestAnimationFrame(() => tick(k - 1)));
        tick(n);
      });

    let enteredAt = 0;

    window.__deckExport = {
      /**
       * Ready to be driven. Deliberately does NOT mount every slide up front.
       *
       * Pre-mounting looked like a way to avoid lazy-import stalls mid-capture,
       * but a slide that is not the current one is `display:none`, so anything
       * measuring itself at mount measures zero — `environment` sizes its three
       * canvases then, and every one came out 0x0 and exported blank. Slides
       * mount on arrival here exactly as they do in the live deck.
       */
      async ready() {
        await settleFrames(4);
        return true;
      },

      /**
       * The capture plan: one entry per slide, each with the progress values
       * that deserve a frame.
       *
       * A beat is one keypress. `captureStops` lets a skeleton say that a single
       * press makes several things appear in turn — the three bars of the
       * training slide, say — so each appearance can become its own slide in a
       * format that cannot animate.
       */
      plan({ maxSubsteps = 24, beatFrames = 1 } = {}) {
        return records.map((rec, i) => {
          const declared = rec.mod.captureStops || {};
          const held = rec.mod.captureHold || {};
          const frames = [];
          rec.beats.forEach((beat, bi) => {
            // A build that runs on a clock rather than on `p`: the scene's own
            // `enter()` plays it, and seeking p does nothing. Declared as
            // elapsed milliseconds since the slide was entered.
            const holds = held[beat.name];
            if (Array.isArray(holds) && holds.length) {
              holds.slice(0, maxSubsteps).forEach((ms, k) =>
                frames.push({ beat: bi, name: beat.name, p: beat.p, hold: ms,
                              sub: k, subs: Math.min(holds.length, maxSubsteps) }));
              return;
            }
            let sub = declared[beat.name];
            // `beatFrames` densifies every beat for flipbook playback: PowerPoint
            // cannot tween two pictures, so smoothness there comes from sampling
            // the tween finely and letting the slides advance themselves. Merged
            // with any declared stops rather than replacing them, so the moments
            // a skeleton called out are still landed on exactly.
            if (beatFrames > 1) {
                const from = bi ? rec.beats[bi - 1].p : beat.p;
                const dense = Array.from({ length: beatFrames }, (_, k) =>
                  from + ((beat.p - from) * (k + 1)) / beatFrames);
                const declaredPs = Array.isArray(sub) ? sub : [];
                sub = [...new Set([...declaredPs, ...dense])].sort((a, b) => a - b);
            }
            if (typeof sub === "number") {
              // A count: spread that many stops across the beat's own span.
              const from = bi ? rec.beats[bi - 1].p : rec.beats[0].p;
              const n = Math.min(sub, maxSubsteps);
              sub = Array.from({ length: n }, (_, k) => from + ((beat.p - from) * (k + 1)) / n);
            }
            const stops = Array.isArray(sub) && sub.length ? sub.slice(0, maxSubsteps) : [beat.p];
            stops.forEach((p, k) =>
              frames.push({ beat: bi, name: beat.name, p, hold: 0,
                            sub: k, subs: stops.length }));
          });
          return {
            index: i,
            id: rec.entry.id,
            use: rec.entry.use,
            sectionId: rec.section.id,
            name: rec.entry.name || rec.mod.meta?.title || rec.entry.use,
            minutes: rec.minutes,
            notes: rec.entry.notes || "",
            frames,
          };
        });
      },

      /**
       * Put slide `i` at progress `p` and hold it there.
       *
       * `arrive` must be set on a slide's FIRST frame and only that one, for two
       * reasons that pull in opposite directions:
       *
       *   Some scenes paint nothing from `render(p)` at all — training's is
       *   `render(p) { scrollP = p; }` and every pixel is drawn by an rAF loop
       *   that `enter()` starts. Freezing that loop to make the capture still
       *   left a blank canvas at every progress value.
       *
       *   But `enter()` also replays the load-in stagger, which fades the copy
       *   up from zero. Calling it per frame would catch half-faded text, so it
       *   is called once and the loop is simply left running for the rest of
       *   the slide's frames.
       */
      async show(i, p, { settle = 0, arrive = false, hold = 0 } = {}) {
        const rec = records[i];
        if (!rec) return false;
        if (deck.getIndices().h !== i) {
          deck.slide(i, 0);
          await settleFrames(2);
        }
        await ensureMounted(rec);
        if (arrive) {
          fitToSlide(rec.section);
          rec.driver?.refresh();
          records.forEach((o) => { if (o !== rec) o.scene?.leave?.(); });
          rec.scene?.enter?.();
          enteredAt = performance.now();
          // Some skeletons size themselves from their own bounding box and were
          // mounted a moment ago; nudge anything listening for a resize now the
          // slide is actually on screen.
          window.dispatchEvent(new Event("resize"));
          // Long enough for the load-in stagger to land. Counted in frames
          // rather than milliseconds because the ambient loops advance per
          // frame — though measured against a wall-clock wait this made no
          // real difference, so do not expect it to buy determinism. Roughly a
          // dozen frames still vary between runs; see the module docstring.
          await settleFrames(54); // ~0.9s at 60fps
        }
        rec.driver?.seek(p);
        if (hold) {
          // Let the scene's own clock reach the moment this frame is for. The
          // loop is left running throughout — pausing it is what would stop the
          // build advancing at all.
          const wait = hold - (performance.now() - enteredAt);
          if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        }
        await settleFrames(3);
        if (settle) await new Promise((r) => setTimeout(r, settle));
        await settleFrames(2);
        return true;
      },

      /**
       * Run a scene's own arrival animation for `ms`, then freeze it.
       *
       * Some slides say something only after their last beat and without a
       * press — the framework's human-in-the-loop mark fades in a second later.
       * A frame taken at p = 1 alone would never show it.
       */
      async settleAfter(i, ms) {
        const rec = records[i];
        if (!rec) return false;
        rec.scene?.enter?.();
        await new Promise((r) => setTimeout(r, ms));
        rec.scene?.leave?.();
        await settleFrames(2);
        return true;
      },
    };
  }

  // ---- presenter channel ---------------------------------------------------
  //
  // With ?present=1 the deck broadcasts where it is, and accepts navigation
  // back. That is what lets the landing page act as a presenter console: the
  // slides go to a popup you throw full-screen on the projector, and the page
  // you opened it from keeps the speaker notes and the arrow keys.
  //
  // BroadcastChannel rather than window.opener, so the console survives the
  // popup being closed and reopened, and so either page can be refreshed
  // without losing the link.
  // A single-slide render (?only=) can follow the presented deck beat for beat,
  // by listening on the same channel the console does. Without this the mirror
  // shows every slide at its final beat, which is worse than no mirror: it
  // disagrees with the projector for every press but the last.
  if (ONLY_ID && params.has(PARAM.follow) && "BroadcastChannel" in window) {
    const follow = new BroadcastChannel(CHANNEL);
    follow.onmessage = (ev) => {
      const m = ev.data || {};
      if (m.type !== MSG.state || m.id !== ONLY_ID) return;
      const rec = records[0];
      if (!rec?.driver) return;
      // Beats can be a per-talk subset, so clamp rather than assume the index
      // means the same thing in both decks.
      rec.driver.goTo(Math.min(m.beat ?? 0, rec.driver.length - 1), { animate: false });
    };
    follow.postMessage({ type: MSG.hello });
  }

  if (params.has(PARAM.present) && "BroadcastChannel" in window) {
    const channel = new BroadcastChannel(CHANNEL);

    const send = () => {
      const h = deck.getIndices().h ?? 0;
      const rec = recordFor(h);
      channel.postMessage({
        type: MSG.state,
        talk: TALK_ID,
        started: window.__deckStarted !== false,
        slide: h,
        slides: records.length,
        beat: rec?.driver?.index ?? 0,
        beats: rec?.driver?.length ?? 1,
        id: rec?.entry?.id || "",
        name: rec?.entry?.name || rec?.mod?.meta?.title || "",
        minutes: rec?.minutes ?? 0,
        notes: rec?.entry?.notes || "",
      });
    };

    channel.onmessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type === MSG.hello) return send();
      if (msg.type !== MSG.nav) return;
      window.__deckRaiseCurtain?.();
      if (msg.dir === "next") deck.next();
      else if (msg.dir === "prev") deck.prev();
      else if (msg.dir === "slide") deck.slide(msg.slide ?? 0, msg.beat ?? 0);
    };

    ["ready", "slidechanged", "fragmentshown", "fragmenthidden"].forEach((e) =>
      deck.on(e, () => setTimeout(send, 0)));
    window.addEventListener("deck:started", () => setTimeout(send, 0));
    window.addEventListener("pagehide", () =>
      channel.postMessage({ type: MSG.gone, talk: TALK_ID }));
  }

  deck.on("fragmentshown", stepBeat);
  deck.on("fragmenthidden", stepBeat);

  window.addEventListener("resize", () => {
    const rec = recordFor(deck.getIndices().h);
    if (!rec) return;
    fitToSlide(rec.section);
    rec.driver?.refresh();
  });

  // Mouse-wheel / trackpad navigation, PowerPoint style.
  //
  // Reveal's own `mouseWheel` option reads the deprecated `wheelDelta`, which is
  // undefined in Firefox (the comparison silently becomes NaN and nothing
  // moves), and hard-throttles at 1000ms. This uses `deltaY`, and swallows
  // trackpad inertia during the cooldown so one flick advances one beat.
  const WHEEL_THRESHOLD = 30; // ignore sub-notch jitter
  const WHEEL_COOLDOWN = 700; // > the 600ms beat tween, so beats never skip
  let wheelUnlockAt = 0;
  let wheelAccum = 0;

  document.addEventListener(
    "wheel",
    (event) => {
      const now = Date.now();
      if (now < wheelUnlockAt) {
        wheelAccum = 0; // discard inertia rather than queueing another step
        return;
      }
      wheelAccum += event.deltaY;
      if (Math.abs(wheelAccum) < WHEEL_THRESHOLD) return;
      wheelUnlockAt = now + WHEEL_COOLDOWN;
      const forward = wheelAccum > 0;
      wheelAccum = 0;
      if (forward) deck.next();
      else deck.prev();
    },
    { passive: true },
  );

  /**
   * Live preview channel for Backstage.
   *
   * A thumbnail is an iframe of this page, which loads the talk from disk — so
   * an edit that has not been saved yet could never show up. Backstage instead
   * pushes the in-progress props here and the slide is rebuilt in place, so the
   * preview tracks what you are typing rather than what is on disk.
   */
  function installPreviewBridge() {
    if (!ONLY_ID) return;

    // Once the arrows have been used, a props edit must not yank the preview
    // back to the end; before that, it should still open on the finished slide.
    let stepped = false;

    /** Tell Backstage which beat is showing, so it can label and gate its arrows. */
    function postBeatState() {
      const rec = records[0];
      if (!rec?.driver) return;
      try {
        window.parent?.postMessage(
          {
            type: "backstage:beat-state",
            only: ONLY_ID,
            index: rec.driver.index,
            total: rec.driver.length,
            name: rec.beats?.[rec.driver.index]?.name || "",
          },
          "*",
        );
      } catch {
        /* not framed */
      }
    }

    async function rebuild(msg) {
      const rec = records[0];
      if (!rec) return;
      // Hold the beat being inspected across a props edit — jumping back to the
      // end every keystroke would fight whoever is stepping through the scene.
      const held = stepped && rec.driver ? rec.driver.index : null;
      rec.props = renderProps({
        slideId: rec.entry.use,
        ...(rec.mod.defaults || {}),
        ...(msg.props || {}),
      });
      if (msg.beats !== undefined) rec.beats = resolveBeats(rec.mod.beats, msg.beats);

      rec.scene?.leave?.();
      rec.section.innerHTML = rec.mod.html(rec.props);
      for (let i = 1; i < rec.beats.length; i++) {
        const marker = document.createElement("span");
        marker.className = "fragment deck-beat";
        rec.section.appendChild(marker);
      }
      rec.scene = (await rec.mod.mount(rec.section, rec.props)) || { render() {} };
      rec.driver = createBeatDriver(rec.scene, rec.beats);
      fitToSlide(rec.section);
      rec.driver.refresh();
      // Previews open on the finished slide, not its first beat.
      const land = held === null ? rec.beats.length - 1 : Math.min(held, rec.beats.length - 1);
      rec.driver.goTo(land, { animate: false });
      rec.scene.enter?.();
      postBeatState();
    }

    /**
     * Beat stepping, driven by Backstage's preview arrows. The scene mounts
     * lazily, so make sure it exists before asking its driver to move.
     */
    async function stepBeat(msg) {
      const rec = records[0];
      if (!rec) return;
      await ensureMounted(rec);
      if (!rec.driver) return;
      if (msg.action === "next") { rec.driver.next(); stepped = true; }
      else if (msg.action === "prev") { rec.driver.prev(); stepped = true; }
      else if (msg.action === "goto") { rec.driver.goTo(Number(msg.index) || 0); stepped = true; }
      // "state" falls through: a plain request to report where we are.
      postBeatState();
    }

    window.addEventListener("message", (event) => {
      if (event.data?.type === "backstage:preview") {
        rebuild(event.data).catch((err) => console.warn("deck: preview rebuild failed", err));
      }
      if (event.data?.type === "backstage:beat") {
        stepBeat(event.data).catch((err) => console.warn("deck: beat step failed", err));
      }
    });
    // Announce readiness — Backstage may have edits queued before we loaded.
    try {
      window.parent?.postMessage({ type: "backstage:preview-ready", only: ONLY_ID }, "*");
    } catch {
      /* not framed */
    }
  }

  await deck.initialize();
  installPreviewBridge();
  window.deck = deck; // handy from the console during rehearsal
  // Thumbnails render a single slide; the chrome would dominate at that size.
  if (!ONLY_ID && !SKELETON) installChrome(deck, talk, records);
  if (!PRINTING) installStartCurtain(deck);
  if (REHEARSING) installRehearsalRecorder(deck, records);
}

build();
