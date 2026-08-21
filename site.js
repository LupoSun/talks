// Talks index + presenter console.
//
// "Present" opens the deck in its own window — full-screen that on the
// projector — while this page keeps the speaker notes and the arrow keys. The
// two talk over a BroadcastChannel rather than window.opener, so either can be
// refreshed, and closing the deck does not orphan the console.

const channel = "BroadcastChannel" in window ? new BroadcastChannel("deck-present") : null;
const $ = (sel) => document.querySelector(sel);

let deckWindow = null;
let startedAt = null;
let ticker = null;

// ---- talk list -------------------------------------------------------------

async function loadTalks() {
  const host = $("#talks");
  let index;
  try {
    index = await (await fetch("talks.json", { cache: "no-store" })).json();
  } catch {
    host.innerHTML = `<p class="empty">Could not read <code>talks.json</code>.</p>`;
    return;
  }
  host.innerHTML = "";
  for (const t of index.talks) {
    const files = [];
    if (t.pptx) files.push(`<a class="btn" href="${t.pptx}" download>PowerPoint</a>`);
    if (t.pdf) files.push(`<a class="btn" href="${t.pdf}" download>PDF</a>`);
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      <div class="card__top">
        <h2>${escapeHtml(t.title)}</h2>
        <span class="pill">${escapeHtml(t.id)}</span>
      </div>
      <p class="meta">${escapeHtml(t.venue || "")}${t.venue && t.slides ? " · " : ""}${
        t.slides ? `${t.slides} slides` : ""}${t.minutes ? ` · ${t.minutes} min` : ""}</p>
      <div class="row">
        <button class="btn btn--primary" data-present="${escapeHtml(t.id)}">Present</button>
        <a class="btn" href="deck/index.html?talk=${encodeURIComponent(t.id)}" target="_blank"
           rel="noopener">Open deck</a>
        ${files.join("")}
      </div>`;
    host.appendChild(card);
  }
  host.querySelectorAll("[data-present]").forEach((b) =>
    b.addEventListener("click", () => present(b.dataset.present)));
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// ---- presenting ------------------------------------------------------------

function present(talk) {
  const url = `deck/index.html?talk=${encodeURIComponent(talk)}&present=1`;
  // Sized to the screen rather than maximised: a popup that already fills the
  // display gives no hint that it is the thing to make full screen.
  const w = Math.round(screen.availWidth * 0.72);
  const h = Math.round((w * 9) / 16);
  deckWindow = window.open(url, "deck-present",
    `popup=yes,width=${w},height=${h},left=${Math.round((screen.availWidth - w) / 2)},top=80`);
  if (!deckWindow) {
    alert("The deck window was blocked. Allow pop-ups for this site and press Present again.");
    return;
  }
  deckWindow.focus();
  $("#console").hidden = false;
  $("#c-notes").innerHTML = `<p class="muted">Waiting for the deck…</p>`;
  startTimer();
  channel?.postMessage({ type: "hello" });
}

function startTimer() {
  startedAt = Date.now();
  clearInterval(ticker);
  ticker = setInterval(() => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    $("#c-clock").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}

function nav(dir) {
  channel?.postMessage({ type: "nav", dir });
  deckWindow?.focus?.();
}

// ---- notes -----------------------------------------------------------------
//
// Same shape the deck itself renders: "- " lines are a list, a line starting
// with the warning sign is an aside, and the "Say it as:" block is the script.
function renderNotes(text) {
  if (!text.trim()) return `<p class="muted">No notes for this slide.</p>`;
  return text.split(/\n{2,}/).map((block) => {
    const lines = block.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return "";
    if (lines.every((l) => l.startsWith("- "))) {
      return `<ul>${lines.map((l) => `<li>${escapeHtml(l.slice(2))}</li>`).join("")}</ul>`;
    }
    if (lines.length === 1 && lines[0].startsWith("⚠")) {
      return `<p><em>${escapeHtml(lines[0])}</em></p>`;
    }
    const cls = lines[0].startsWith("Say it as") ? ' class="say"' : "";
    return `<p${cls}>${lines.map(escapeHtml).join("<br>")}</p>`;
  }).join("");
}

channel?.addEventListener("message", (ev) => {
  const m = ev.data || {};
  if (m.type === "gone") {
    $("#c-notes").innerHTML = `<p class="muted">The deck window closed.</p>`;
    return;
  }
  if (m.type !== "state") return;
  $("#console").hidden = false;
  $("#c-id").textContent = m.id || "—";
  $("#c-name").textContent = m.name || "";
  $("#c-pos").textContent =
    `slide ${m.slide + 1} of ${m.slides}` + (m.beats > 1 ? ` · beat ${m.beat + 1}/${m.beats}` : "");
  $("#c-budget").textContent = m.minutes ? `this slide ${m.minutes} min` : "";
  $("#c-notes").innerHTML = renderNotes(m.notes || "");
  $("#c-notes").scrollTop = 0;
});

$("#c-next").addEventListener("click", () => nav("next"));
$("#c-prev").addEventListener("click", () => nav("prev"));
$("#c-reset").addEventListener("click", startTimer);
$("#c-stop").addEventListener("click", () => {
  try { deckWindow?.close(); } catch { /* already gone */ }
  clearInterval(ticker);
  $("#console").hidden = true;
});

// Arrow keys drive the deck from here, so the presenter can look at the notes.
window.addEventListener("keydown", (e) => {
  if ($("#console").hidden) return;
  if (e.target.matches("input, textarea")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); nav("next"); }
  else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); nav("prev"); }
});

loadTalks();
