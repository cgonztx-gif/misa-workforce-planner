import { clsx, type ClassValue } from "clsx";

/** Join class names; falsy values drop out. */
export const cn = (...values: ClassValue[]) => clsx(values);
