import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { HarnessView } from "../../../src/apps/view-types.js";
import { host } from "./host.js";
import { ResultCard } from "./views/result-card.js";
import { ExecutionCard } from "./views/execution-card.js";
import "./styles.css";

function ViewRouter() {
  const [view, setView] = useState<HarnessView | undefined>(host.current());
  useEffect(() => host.subscribe(setView), []);

  if (!view) return null;
  switch (view.kind) {
    case "result":
      return <ResultCard view={view} />;
    case "pipeline_execution":
      return <ExecutionCard key={view.execution_id} view={view} />;
    default:
      return null;
  }
}

render(<ViewRouter />, document.getElementById("root")!);
void host.connect();
