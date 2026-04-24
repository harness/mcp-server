import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerRunEvaluationPrompt(server: McpServer): void {
  server.registerPrompt(
    "run-evaluation",
    {
      description:
        "Use AI Evals MCP resources to discover or create datasets, targets, metrics, wire an evaluation, and trigger a run",
      argsSchema: {
        goal: z.string().describe("What the user wants to evaluate (e.g. prompt quality on a JSONL dataset)"),
        org_id: z.string().describe("Harness org identifier").optional(),
        project_id: z.string().describe("Harness project identifier").optional(),
      },
    },
    async ({ goal, org_id, project_id }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Help me run an AI evaluation in Harness.

## Goal
${goal}

## Scope
${org_id ? `org_id=${org_id}` : "Use default HARNESS_ORG"}; ${project_id ? `project_id=${project_id}` : "Use default HARNESS_PROJECT"}.

## Steps (use generic MCP tools only)

1. **Discover** — \`harness_describe(resource_type="eval_dataset")\` and same for \`eval_target\`, \`eval_metric_set\`, \`evaluation\` to see operations and filters.

2. **List or create resources**
   - Datasets: \`harness_list(resource_type="eval_dataset")\` — create with \`harness_create\` if needed (body: name, identifier, ...).
   - Targets: \`harness_list(resource_type="eval_target")\`
   - Metric sets: \`harness_list(resource_type="eval_metric_set")\`
   - Models (optional): \`harness_list(resource_type="eval_model")\`

3. **Create an evaluation** — \`harness_create(resource_type="evaluation", body={ name, dataset_id, target_id, metric_set_id, ... })\`

4. **Trigger a run** — \`harness_execute(resource_type="evaluation", action="run", resource_id=<eval_id>, body={ ... optional TriggerEvalRunRequest })\`

5. **Poll results** — \`harness_list(resource_type="eval_run")\` or \`harness_list(resource_type="eval_run_by_eval", filters={ eval_id: "..." })\`, then \`harness_get(resource_type="eval_run", resource_id=<run_id>)\`

## Notes
- All AI Evals paths are under the Harness platform host (same \`HARNESS_BASE_URL\` as the UI); scope is \`/ai-evals/api/v1/orgs/{org}/projects/{project}/...\`.
- Ensure \`Harness-Account\` and auth are configured on the MCP server.
- For comparing runs: \`harness_execute(resource_type="eval_run", action="compare", params={ run_ids: "uuid1,uuid2,uuid3" })\` (no resource_id needed for compare).`,
          },
        },
      ],
    }),
  );
}
