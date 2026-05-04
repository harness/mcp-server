import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCreateEvalSuitePrompt(server: McpServer): void {
  server.registerPrompt(
    "create-eval-suite",
    {
      description:
        "Build a multi-evaluation suite in AI Evals: create suite, add members, optional suite run",
      argsSchema: {
        suite_name: z.string().describe("Name for the eval suite"),
        pass_strategy: z
          .enum(["all_must_pass", "weighted_threshold"])
          .describe("How the suite decides pass/fail")
          .optional(),
        goal: z.string().describe("What evaluations should be included and any ordering constraints").optional(),
      },
    },
    async ({ suite_name, pass_strategy, goal }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Create and configure an AI Evals **suite**.

## Suite
- **Name**: ${suite_name}
- **Pass strategy**: ${pass_strategy ?? "all_must_pass (default) or set pass_threshold for weighted_threshold strategy"}
- **Context**: ${goal ?? "(none)"}

## Steps

1. **List existing evaluations** — \`harness_list(resource_type="evaluation")\` — pick eval IDs to include.

2. **Create the suite** — \`harness_create(resource_type="eval_suite", body={ name: "${suite_name}", pass_strategy: "all_must_pass" | "weighted_threshold", pass_threshold?: number })\`

3. **Add members** (choose one pattern)
   - **Add one at a time**: \`harness_create(resource_type="eval_suite_evaluation", params={ suite_id: "<SUITE_ID>" }, body={ evaluation_id: "<EVAL_ID>", is_required: true })\`
   - **Replace full list**: \`harness_execute(resource_type="eval_suite", action="replace_evaluations", resource_id=<suite_id>, body={ entries: [ { evaluation_id, is_required, position? }, ... ] })\`  
     (Body shape matches \`ReplaceSuiteEntriesRequest\` in the ai-evals API.)

4. **List members to verify** — \`harness_list(resource_type="eval_suite_evaluation", filters={ suite_id: "<SUITE_ID>" })\`

5. **Run the suite** — \`harness_execute(resource_type="eval_suite", action="run", resource_id=<suite_id>, body={ trigger_type: "manual", ... })\`

6. **Poll suite run** — \`harness_list(resource_type="eval_suite_run", filters={ suite_id: "<SUITE_ID>" })\` then \`harness_get(resource_type="eval_suite_run", resource_id=<suite_run_id>)\`

Use \`harness_describe(resource_type="eval_suite")\` for exact fields and execute actions.`,
          },
        },
      ],
    }),
  );
}
