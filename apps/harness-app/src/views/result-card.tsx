import type { ResultView } from "../../../../src/apps/view-types.js";
import { Card } from "../components/card.js";

export function ResultCard({ view }: { view: ResultView }) {
  return (
    <Card
      title={view.title}
      status={view.status}
      footer={view.subtitle}
      openInHarness={view.open_in_harness}
      refresh={view.refresh}
    />
  );
}
