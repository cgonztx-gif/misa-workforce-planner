import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { useReturnFocus } from "../lib/focus";

/** The phone bottom sheet for the detail: max 85vh, a handle, internal scroll. Close is the detail's own ×. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const returnFocus = useReturnFocus(open);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content className="sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[20px] bg-card shadow-[var(--shadow-pop)] focus:outline-none" aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line-strong" />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
