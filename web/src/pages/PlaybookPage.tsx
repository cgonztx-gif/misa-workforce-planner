import { PagePlaceholder } from "../components";

/** Playbook page (T-87). Placeholder until it's built. */
export default function PlaybookPage() {
  return (
    <PagePlaceholder
      title="Playbook"
      answer="What to do when conditions shift, for each scenario."
      items={["When to use each scenario's plan, and what to do", "The headline action: limit holiday PTO, with its effect on service and cost", "Rules for the day", "The blocks with the least cushion"]}
    />
  );
}
