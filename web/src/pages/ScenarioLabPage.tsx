import { PagePlaceholder } from "../components";

/** Scenario lab page (T-86). Placeholder until it's built. */
export default function ScenarioLabPage() {
  return (
    <PagePlaceholder
      title="Scenario lab"
      answer="Change the conditions and the plan recalculates live. Results here are what-ifs, never the submitted plan."
      items={["Settings: service goal, callouts, demand and staff availability", "Run, then the KPI changes against the submitted plan", "A mini board highlighting the blocks that changed", "A list of changes, and Reset"]}
    />
  );
}
