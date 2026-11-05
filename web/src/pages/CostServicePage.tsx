import { PagePlaceholder } from "../components";

/** Cost and service page (T-85). Placeholder until it's built. */
export default function CostServicePage() {
  return (
    <PagePlaceholder
      title="Cost and service"
      answer="Labor cost and service risk for the plan against the draft."
      items={["Cost, hours, expected service and blocks below the goal by scenario and department", "Cost and service by day", "The service-goal trade-off curve, with 95% marked", "The callout allowance comparison", "Blocks below the goal, each with its reason"]}
    />
  );
}
