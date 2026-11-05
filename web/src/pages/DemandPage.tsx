import { PagePlaceholder } from "../components";

/** Demand page (T-84). Placeholder until it's built. */
export default function DemandPage() {
  return (
    <PagePlaceholder
      title="Demand"
      answer="When demand rises or falls, and why our forecast differs from the benchmark."
      items={["Forecast against benchmark by day for each department", "Valentine's Day, the holiday window and PEAK's surge shaded", "A waterfall for a chosen day, from a normal weekday to the scenario", "The shift split, including Front End's holiday shift toward midday", "Forecast accuracy and the drivers we tested"]}
    />
  );
}
