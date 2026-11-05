import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "navy";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-strong shadow-sm",
  secondary: "bg-surface text-ink border border-border-strong hover:bg-raised",
  ghost: "text-ink-muted hover:bg-raised hover:text-ink",
  navy: "bg-navy-raised text-navy-ink ring-1 ring-navy-border hover:bg-navy-border",
};
const SIZES: Record<Size, string> = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-9 px-4 text-base gap-2" };

const base =
  "inline-flex items-center justify-center whitespace-nowrap rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** A lucide icon element before the label. */
  icon?: ReactNode;
}

/** Buttons say exactly what happens: "Run what-if", "Download submission CSV". */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cn(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

/** A link styled as a button, e.g. a download from /api/submission.csv. */
export function LinkButton({ variant = "secondary", size = "md", icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <a className={cn(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {icon}
      {children}
    </a>
  );
}
