// Light by default, like the showcase image the user asked to follow (2026-11-05): the page opens light whatever
// the computer's own setting, and dark or system is only ever the viewer's explicit choice, saved per viewer.
// A pinned theme sets data-theme on <html>; "system" removes it so prefers-color-scheme decides.
export type Theme = "system" | "light" | "dark";
const KEY = "wp-draft4-theme-v2"; // v2: earlier visits defaulted to "system", so their saved state is ignored.

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "system" ? v : "light";
  } catch {
    return "light";
  }
}

export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
}

export function saveTheme(t: Theme) {
  applyTheme(t);
  try {
    if (t === "light") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* private window or blocked storage: the theme still applies for this visit */
  }
}

export const nextTheme = (t: Theme): Theme => (t === "light" ? "dark" : t === "dark" ? "system" : "light");
export const themeName = (t: Theme) => (t === "system" ? "System" : t === "light" ? "Light" : "Dark");
