import { useRef } from "react";

/**
 * Focus goes back where it came from when a dialog closes (Radix returns it only to a Dialog.Trigger, and these
 * dialogs are opened from state). The opener is read while the dialog renders open, before Radix moves focus into it.
 * If the opener is gone (the slot swapped to the detail), focus goes to the first match of `fallback`.
 */
export function useReturnFocus(open: boolean, fallback?: string) {
  const opener = useRef<HTMLElement | null>(null);
  if (open && !opener.current && typeof document !== "undefined") {
    const a = document.activeElement as HTMLElement | null;
    opener.current = a && a !== document.body ? a : null;
  }
  return (e: Event) => {
    const el = opener.current;
    opener.current = null;
    const target = el?.isConnected ? el : fallback ? document.querySelector<HTMLElement>(fallback) : null;
    if (target) {
      e.preventDefault();
      target.focus({ preventScroll: true });
    }
  };
}
