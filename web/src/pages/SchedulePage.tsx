import { PagePlaceholder } from "../components";

/** Schedule page (T-83). Placeholder until it's built. */
export default function SchedulePage() {
  return (
    <PagePlaceholder
      title="Schedule"
      answer="Where, when and how many people the plan puts in each block, and why."
      items={["The weekly board: department and shift down, days across", "Color by change from the draft, chance of meeting target, or utilization", "Click a block for its drawer: action, why, demand, staff sources, cost, service, cushion", "The Changes view: every change from the draft, sortable", "Export the submission CSV or the current view"]}
    />
  );
}
