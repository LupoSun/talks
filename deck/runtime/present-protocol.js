// The contract between a presented deck and the talks page.
//
// One deck window shows the slides; another page shows the notes and drives it.
// They are separate documents, so everything they agree on has to be written
// down somewhere — and until this module existed it was written down four
// times, as string literals in two files that nothing checked against each
// other. Renaming the channel, or a field, silently broke the pairing.
//
// Both sides import this. See backstage/SYNC.md for the prose.

/** Same-origin channel. Both the console and any following mirror listen here. */
export const CHANNEL = "deck-present";

/**
 * The deck window's `window.open` target name.
 *
 * Not the channel — it happens to read the same, but it is a browser window
 * name, and its job is that pressing Present twice reuses the one window
 * instead of opening a second deck onto the same projector.
 */
export const WINDOW = "deck-present";

/** URL parameters the deck reads. Kept here because the console builds them. */
export const PARAM = {
  talk: "talk",        // which manifest to load
  present: "present",  // curtain + fullscreen-on-click + broadcast state
  only: "only",        // render a single slide, by entry id
  follow: "follow",    // with `only`: track the presented deck's beat
};

/** Message types on the channel. */
export const MSG = {
  /** console -> deck: "who is out there?" — answered with a `state`. */
  hello: "hello",
  /** deck -> console: where the deck is now. Shape below. */
  state: "state",
  /** console -> deck: `{ dir: "next" | "prev" | "slide", slide, beat }`. */
  nav: "nav",
  /** deck -> console: this window is going away. */
  gone: "gone",
};

/**
 * The `state` payload.
 *
 * `started` is the one worth explaining: a deck opened for presenting sits
 * behind a curtain until it is clicked, because fullscreen needs a gesture in
 * that window. Until then it is a title card, not a talk, and the console
 * should not be showing slide one's notes as though the talk were under way.
 *
 * @typedef {object} DeckState
 * @property {string}  talk     manifest id
 * @property {boolean} started  has the curtain lifted
 * @property {number}  slide    0-based index
 * @property {number}  slides   total
 * @property {number}  beat     0-based index within the slide
 * @property {number}  beats    total for this slide
 * @property {string}  id       entry id, e.g. "S04" — stable across reordering
 * @property {string}  name     human name
 * @property {number}  minutes  this slide's budget
 * @property {string}  notes    raw speaker notes, rendered by the console
 */

/** A channel, or null where BroadcastChannel is unavailable. */
export function presenterChannel() {
  return "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL) : null;
}

/** The URL of a deck, for the console to open or to iframe. */
export function deckUrl(base, talk, { present = false, only = "", follow = false } = {}) {
  const p = new URLSearchParams({ [PARAM.talk]: talk });
  if (present) p.set(PARAM.present, "1");
  if (only) p.set(PARAM.only, only);
  if (follow) p.set(PARAM.follow, "1");
  return `${base}?${p}`;
}
