// Shared helpers for ported website sections.
//
// The website reveals copy with a `.js-anim` opacity/y stagger triggered by
// ScrollTrigger on section enter. In a deck the equivalent trigger is *arriving
// at the slide*, so these return an `enter()` the runtime calls at that moment.

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.json();
}

/** Same, for assets a slide inlines rather than parses — an SVG figure. */
export async function loadText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  return res.text();
}

/**
 * Website `.js-anim` load-in stagger, replayable on slide entry.
 * Returns `enter()`; call it when the slide becomes current.
 */
export function makeStagger(root, opts = {}) {
  const items = root.querySelectorAll(opts.selector || ".js-anim");
  if (!items.length) return () => {};

  if (!window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return () => {};
  }

  const y = opts.y ?? 28;
  const duration = opts.duration ?? 0.8;
  const stagger = opts.stagger ?? 0.12;
  let tl = null;

  return function enter() {
    if (tl) tl.kill();
    window.gsap.set(items, { opacity: 0, y });
    tl = window.gsap
      .timeline({ defaults: { ease: "power3.out", duration } })
      .to(items, { opacity: 1, y: 0, stagger });
  };
}

// Open Color accents (the flowchart family) — each particle picks one.
// Exported because the title slide's inverted mode paints its background out of
// these same colours: the wash and the particles have to come from one list, or
// the two drift apart the first time a colour is changed.
export const FIELD_PALETTE = ["#32b4dc", "#f06595", "#0ca678", "#fd7e14", "#845ef7", "#82c91e", "#4dabf7"];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

/**
 * Ambient flow-field background, ported from the website hero and shared by any
 * slide that wants it (hero, title). Returns `{ start, stop, resize }`, or null
 * when there is nothing to animate.
 *
 * `opts.color` overrides each particle's own colour — the inverted title paints
 * the palette into the background instead and draws the particles white on top.
 * `opts.alpha` scales their opacity, since white on a deep ground and colour on
 * a pale one do not want the same weight.
 */
export function createFlowField(root, canvas, opts = {}) {
  if (!canvas || !window.gsap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return null;
  }
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, t = 0;
  let particles = [];
  let rafId = 0, running = false;
  const mouse = { x: 0, y: 0, active: false };

  function spawn(p, fresh) {
    p.x = Math.random() * W;
    p.y = Math.random() * H;
    p.life = 80 + Math.random() * 180;
    p.age = fresh ? Math.random() * p.life : 0;
    if (fresh) p.color = FIELD_PALETTE[(Math.random() * FIELD_PALETTE.length) | 0];
  }

  function seed() {
    const n = Math.round(clamp(W / 4.5, 200, 520));
    particles = [];
    for (let i = 0; i < n; i++) {
      const p = {};
      spawn(p, true);
      particles.push(p);
    }
  }

  function resize() {
    const r = root.getBoundingClientRect();
    W = r.width;
    H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
  }

  function angle(x, y) {
    const nx = x / W, ny = y / H;
    return (
      (Math.sin(nx * 3.0 + t * 0.25) +
        Math.cos(ny * 3.0 - t * 0.2) +
        Math.cos(nx * 1.7 - t * 0.18) +
        Math.sin(ny * 2.3 + t * 0.22)) *
      0.8
    );
  }

  function frame() {
    t += 0.016;
    ctx.clearRect(0, 0, W, H);
    const speed = Math.max(0.7, W * 0.0013);
    const tail = Math.max(18, W * 0.022);
    const R = Math.min(220, Math.max(W, H) * 0.18);
    ctx.lineCap = "round";
    ctx.lineWidth = 1.7;

    for (const p of particles) {
      const a = angle(p.x, p.y);
      let vx = Math.cos(a) * speed;
      let vy = Math.sin(a) * speed;
      let boost = 0;
      if (mouse.active) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y;
        const dist = Math.hypot(dx, dy) + 0.001;
        if (dist < R) {
          const f = 1 - dist / R;
          boost = f;
          const nx = dx / dist, ny = dy / dist;
          vx += -ny * speed * 4 * f + nx * speed * 2 * f;
          vy += nx * speed * 4 * f + ny * speed * 2 * f;
        }
      }
      p.x += vx;
      p.y += vy;
      p.age++;
      if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30 || p.age > p.life) {
        spawn(p, false);
        continue;
      }
      const lifeT = Math.min(p.age / 14, 1, (p.life - p.age) / 20);
      ctx.globalAlpha = clamp(
        (0.34 + 0.4 * boost) * Math.max(0, lifeT) * (opts.alpha ?? 1), 0, 0.95);
      ctx.strokeStyle = opts.color || p.color;
      const m = Math.hypot(vx, vy) || 1;
      ctx.beginPath();
      ctx.moveTo(p.x - (vx / m) * tail, p.y - (vy / m) * tail);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (running) rafId = requestAnimationFrame(frame);
  }

  function onMove(e) {
    const r = root.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
    mouse.active = true;
  }

  resize();
  window.addEventListener("resize", resize);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerleave", () => (mouse.active = false));

  return {
    resize,
    start() {
      if (running) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
}

/** Count a `[data-count-to]` element up from zero. Returns `enter()`. */
export function makeCountUp(el, opts = {}) {
  if (!el) return () => {};
  const target = parseFloat(el.dataset.countTo) || 0;
  const suffix = el.dataset.countSuffix || "";
  const format = (v) => (Number.isInteger(target) ? Math.round(v) : v.toFixed(1)) + suffix;

  if (!window.gsap) {
    el.textContent = format(target);
    return () => {};
  }

  return function enter() {
    const obj = { val: 0 };
    window.gsap.to(obj, {
      val: target,
      ease: "power1.out",
      duration: opts.duration ?? 1.4,
      delay: opts.delay ?? 0.2,
      onUpdate: () => (el.textContent = format(obj.val)),
    });
  };
}
