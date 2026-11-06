// What the plan on screen is compared with. On the submitted plan it is the draft; in a what-if it is the submitted
// plan itself (D-33), so every "Draft" label, tooltip and spoken phrase reads "Submitted" instead, and "Plan" reads
// "What-if". One context, so no component hard-codes the word.

import { createContext, useContext } from "react";

export interface Base {
  whatIf: boolean;
  /** "draft" / "submitted", for running text. */
  word: string;
  /** "Draft" / "Submitted", for labels. */
  Word: string;
  /** "Plan" / "What-if", the plan on screen. */
  Plan: string;
}

export const DRAFT_BASE: Base = { whatIf: false, word: "draft", Word: "Draft", Plan: "Plan" };
export const SUBMITTED_BASE: Base = { whatIf: true, word: "submitted", Word: "Submitted", Plan: "What-if" };

export const BaseContext = createContext<Base>(DRAFT_BASE);
export const useBase = () => useContext(BaseContext);
