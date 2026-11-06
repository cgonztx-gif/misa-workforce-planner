// System → light → dark. A pinned theme sets data-theme on <html>; system removes it. Saved per viewer only.
export type Theme = "system" | "light" | "dark";
const KEY = "wp-draft4-theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
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
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* private window or blocked storage: the theme still applies for this visit */
  }
}

export const nextTheme = (t: Theme): Theme => (t === "system" ? "light" : t === "light" ? "dark" : "system");
export const themeName = (t: Theme) => (t === "system" ? "System" : t === "light" ? "Light" : "Dark");
