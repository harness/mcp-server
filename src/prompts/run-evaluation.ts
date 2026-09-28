import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerRunEvaluationPrompt(server: McpServer): void {
  server.registerPrompt(
    "run-evaluation",
    {
      description:
        "Safely discover or create a managed offline AI evaluation, validate its real resources, then run it",
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

## Rules

- This workflow creates **managed offline evaluations only**. Do not assume identifiers, connector settings, models, dataset content, prompt versions, or agent response paths.
- Before every write, ask for any required value that the user has not explicitly supplied, in the field's documented JSON format. Never fabricate UUIDs, connector refs, sample data, or outputs.
- Use the IDs returned from the matching list/create call, in this exact org/project. The MCP preflight rejects inaccessible or mismatched references.
- Actions that contact an LLM, target, or execution pipeline require an explicit confirmation. Explain the likely cost and external effect immediately before invoking them.

## Steps (use generic MCP tools only)

1. **Discover** — \`harness_describe(resource_type="eval_dataset")\` and same for \`eval_target\`, \`eval_metric_set\`, \`evaluation\` to see operations and filters.

2. **Gather valid resources before wiring**
   - Datasets: \`harness_list(resource_type="eval_dataset")\`. Each item needs a stable \`item_identifier\` and a JSON \`input\`; ask the user for representative, real test data when it does not exist.
   - Targets: \`harness_list(resource_type="eval_target")\`. A prompt target needs an existing LLM connector and an explicit model for Harness-managed connectors. An agent target needs an HTTP(S) endpoint, method, request template, and response path. A precomputed target needs complete output coverage for the selected dataset.
   - Metric sets: \`harness_list(resource_type="eval_metric_set")\`. LLM-as-judge metrics require \`judge_llm_config: { connector_ref, model? }\`; do not use raw API keys or deprecated flat fields.
   - Connectors: list the user's existing Harness connectors and have them select one by scoped identifier. Never create a connector or substitute a placeholder.

3. **Create a complete evaluation** — only after the dataset, target, and metric set IDs have been returned:
   \`harness_create(resource_type="evaluation", body={ name, dataset_id, target_id, metric_set_id, storage_type: "managed" })\`

4. **Confirm, then run** — state the target/model, number of items, and that this can invoke external services. On confirmation:
   \`harness_execute(resource_type="evaluation", action="run", resource_id=<eval_id>, body={ ... optional TriggerEvalRunRequest })\`

5. **Poll results** — \`harness_list(resource_type="eval_run")\` or \`harness_list(resource_type="eval_run_by_eval", filters={ eval_id: "..." })\`, then \`harness_get(resource_type="eval_run", resource_id=<run_id>)\`

## Notes
- All AI Evals paths are under the Harness platform host (same \`HARNESS_BASE_URL\` as the UI); scope is \`/ai-evals/api/v1/orgs/{org}/projects/{project}/...\`.
- Ensure \`Harness-Account\` and auth are configured on the MCP server.
- For comparing runs: \`harness_execute(resource_type="eval_run", action="compare", params={ run_ids: "uuid1,uuid2,uuid3" })\` (no resource_id needed for compare).
- Use \`evaluation\` actions \`clone\` and \`item_history\` for managed-evaluation maintenance. Use \`eval_dataset_item\` action \`bulk_delete\` only after confirming its destructive scope.`,
          },
        },
      ],
    }),
  );
}
