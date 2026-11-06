// One delegated tooltip for the whole page (snippets.md). Any element with data-tip (and data-tip-title for the
// big first line) shows the same dark #tip on hover and on keyboard focus. It hides on scroll, on Escape, and when
// its element leaves the DOM, and it follows a data-tip change on the element it is showing.

let current: HTMLElement | null = null;
/** A control just pressed (a tile, a cell, a segment, the switch): its tip stays hidden until the pointer leaves it,
 *  so the tip of the tile that changed the board's colours never covers the legend that names them. */
let pressed: HTMLElement | null = null;
const STATEFUL = '[data-tile],[role="gridcell"],[role="radio"],[role="switch"],[aria-pressed]';

function fill(tip: HTMLElement, el: HTMLElement) {
  const title = el.dataset.tipTitle;
  const lines = (el.dataset.tip ?? "").split("\n").filter((l) => l.length > 0);
  tip.replaceChildren();
  if (title) {
    const t = document.createElement("div");
    t.className = "tip-title";
    t.textContent = title;
    tip.append(t);
  }
  lines.forEach((line, i) => {
    const d = document.createElement("div");
    if (title || i > 0) d.className = "tip-muted";
    d.textContent = line;
    tip.append(d);
  });
}

function place(tip: HTMLElement, el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2));
  let top = r.top - h - 8;
  if (top < 8) top = Math.min(window.innerHeight - h - 8, r.bottom + 8);
  tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(8, top))}px)`;
}

function hideNow() {
  current = null;
  document.getElementById("tip")?.classList.remove("show");
}

export function installTooltip() {
  const tip = document.getElementById("tip");
  if (!tip) return;

  const show = (el: HTMLElement) => {
    if (!el.dataset.tip && !el.dataset.tipTitle) return hideNow();
    current = el;
    fill(tip, el);
    place(tip, el);
    tip.classList.add("show");
  };

  const onEnter = (e: Event) => {
    const target = e.target as Element | null;
    const el = target && typeof target.closest === "function" ? target.closest<HTMLElement>("[data-tip],[data-tip-title]") : null;
    if (pressed && el && (el === pressed || pressed.contains(el))) return;
    if (pressed && e.type === "pointerover") pressed = null; // a fresh hover elsewhere ends the hush
    if (el) show(el);
    else hideNow();
  };
  document.addEventListener("pointerdown", (e) => {
    const t = e.target as Element | null;
    const el = t && typeof t.closest === "function" ? t.closest<HTMLElement>(STATEFUL) : null;
    if (!el) return;
    pressed = el;
    hideNow();
  });
  document.addEventListener("pointerover", onEnter);
  document.addEventListener("focusin", onEnter);
  document.addEventListener("focusout", (e) => {
    if (current && e.target === current) hideNow();
  });
  document.documentElement.addEventListener("pointerleave", hideNow);
  document.addEventListener("scroll", hideNow, true);
  window.addEventListener("resize", hideNow);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideNow();
  });

  new MutationObserver((records) => {
    if (!current) return;
    if (records.every((r) => tip.contains(r.target))) return; // our own fill, not the page
    if (!records.some((r) => r.type === "childList" || r.target === current)) return;
    if (!current.isConnected) return hideNow();
    fill(tip, current);
    place(tip, current);
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-tip", "data-tip-title"] });
}

/** Hide the page tip (for example while recharts shows its own tooltip). */
export const hideTip = hideNow;
