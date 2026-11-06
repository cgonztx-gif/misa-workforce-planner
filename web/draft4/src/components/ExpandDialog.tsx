import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useReturnFocus } from "../lib/focus";

/** The expanded size (Apple's three sizes): the same marks, more room. Escape closes it. */
export function ExpandDialog({ open, onClose, title, aside, wide = false, children }: { open: boolean; onClose: () => void; title: string; aside?: ReactNode; wide?: boolean; children: ReactNode }) {
  const returnFocus = useReturnFocus(open, "[data-card=slot] [data-back], [data-card=slot] button");
  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={returnFocus}
          className={`fade-in fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] bg-card shadow-[var(--shadow-pop)] focus:outline-none ${
            wide ? "max-w-[1680px]" : "max-w-[560px]"
          }`}
        >
          <div className="flex h-14 shrink-0 items-center gap-3 px-5">
            <Dialog.Title className="text-[15.5px] font-semibold tracking-[-.01em]">{title}</Dialog.Title>
            <span className="flex-1" />
            {aside}
            <Dialog.Close aria-label="Close" data-tip="Close · Esc" className="grid size-8 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink">
              <X size={16} strokeWidth={1.75} />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
