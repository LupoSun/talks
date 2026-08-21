// Beat driver — the deck's replacement for ScrollTrigger.
//
// The project website drives each scene's `render(p)` with a scrubbed scroll
// position. On stage you want the presenter, not the scrollbar, to control
// pacing: a keypress advances from one named beat to the next and `p` is
// TWEENED between them over a real duration.
//
// Scenes are unchanged in shape — they still expose `render(p)`, `refresh()`
// and a list of beats. Only the thing pushing `p` differs.

const DEFAULT_DURATION = 0.6;
const DEFAULT_EASE = "power2.inOut";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * @param {{ render: (p:number)=>void, refresh?: ()=>void }} scene
 * @param {Array<{name:string, p:number}>} beats  ordered, ascending p
 * @param {{duration?:number, ease?:string}} [opts]
 */
export function createBeatDriver(scene, beats, opts = {}) {
  const stops = beats && beats.length ? beats : [{ name: "all", p: 1 }];
  const duration = opts.duration ?? DEFAULT_DURATION;
  const ease = opts.ease ?? DEFAULT_EASE;

  let index = 0;
  let p = stops[0].p;
  let tween = null;

  function apply(v) {
    p = v;
    scene.render(v);
  }

  function stopTween() {
    if (tween) {
      tween.kill();
      tween = null;
    }
  }

  /** Jump/tween to a beat by index. `animate:false` snaps (arrival, print, resize). */
  function goTo(target, { animate = true } = {}) {
    const i = Math.max(0, Math.min(target, stops.length - 1));
    index = i;
    const to = stops[i].p;
    stopTween();

    if (!animate || !window.gsap || prefersReducedMotion()) {
      apply(to);
      return;
    }
    // Tween a proxy scalar and feed the scene — identical to how ScrollTrigger
    // fed it `self.progress`, just time-driven instead of scroll-driven.
    const proxy = { v: p };
    tween = window.gsap.to(proxy, {
      v: to,
      duration,
      ease,
      onUpdate: () => apply(proxy.v),
      onComplete: () => {
        tween = null;
        apply(to); // land exactly on the beat
      },
    });
  }

  /**
   * Snap to an arbitrary progress, without changing which beat we are "on".
   *
   * The export tooling needs frames from *inside* a beat: where one press makes
   * several things appear in turn, each appearance has to become its own
   * PowerPoint slide, and only a raw `p` can address the moment between them.
   * Nothing in the live deck calls this — stepping is always beat to beat.
   */
  function seek(v) {
    stopTween();
    apply(Math.max(0, Math.min(1, v)));
  }

  function next() {
    goTo(index + 1);
  }
  function prev() {
    goTo(index - 1);
  }

  /** Re-measure after a resize/slide change, holding the current beat. */
  function refresh() {
    scene.refresh?.();
    stopTween();
    apply(stops[index].p);
  }

  return {
    goTo,
    seek,
    next,
    prev,
    refresh,
    get index() {
      return index;
    },
    get progress() {
      return p;
    },
    get length() {
      return stops.length;
    },
    get stops() {
      return stops;
    },
    destroy: stopTween,
  };
}
