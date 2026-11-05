import { PagePlaceholder } from "../components";

/** Methods page (T-88). Placeholder until it's built. */
export default function MethodsPage() {
  return (
    <PagePlaceholder
      title="Methods"
      answer="How the planner works, what it assumes, and how well it holds up."
      items={["The engine: data, forecast, service curve and risk, allocation and cost, search, explanations", "Our assumptions, listed apart from the case's", "Validation figures", "The simulated-data notice, and where to find the report and notebook"]}
    />
  );
}
