import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// snake_case id required by ml-infra (prompt_ref: "pipeline_summarizer")
const PIPELINE_SUMMARIZER_PROMPT = {
  description:
    "Analyze a pipeline execution — provides root cause analysis for failures and output summaries for successful steps. Supports whole-pipeline and single-step analysis.",
  argsSchema: {
    executionId: z
      .string()
      .describe("The execution ID, pipeline ID, or a Harness URL")
      .optional(),
    projectId: z.string().describe("Project identifier").optional(),
  },
} as const;

export function registerSummarizePipelinePrompt(server: McpServer): void {
  const handler = async ({
    executionId,
    projectId,
  }: {
    executionId?: string;
    projectId?: string;
  }) => {
      const isUrl = executionId?.startsWith("http");
      const idParam = isUrl
        ? `url="${executionId}"`
        : `execution_id="${executionId}"`;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `You are a pipeline execution analyzer for Harness CI/CD pipelines (IACM, CCM, CD, CI, STO).

Your job is to analyze every step in the execution: diagnose failures with root cause analysis and summarize outputs for successful steps.

## Steps

1. Call harness_diagnose with ${idParam}${projectId ? `, project_id="${projectId}"` : ""}, options={include_logs: true, include_all_step_logs: true} to get the full stage/step tree with ALL step logs.
   - Note: harness_diagnose rejects non-terminal executions (Running, Queued). For in-progress runs, use harness_get with resource_type="execution" and resource_id=<execution_id> instead.
   - The response contains \`all_step_logs\` (keyed by node ID) with logs for every step. Steps without available logs will have a \`note\` field instead — use their name/status/duration from the execution tree.
   - If any steps also appear in \`failed_step_logs\`, their log content is already merged into \`all_step_logs\` — use \`all_step_logs\` as the single source of truth.

2. Detect analysis mode from the response:
   - If the response contains \`requested_step_log\` → **single-step mode**: analyze only that step in depth.
   - If the response contains \`all_step_logs\` → **whole-pipeline mode**: analyze every step.

3. For each step, branch analysis by status:

   **Failed / Errored:**
   - Extract the error message and stack trace from logs
   - Identify the root cause (misconfiguration, timeout, dependency failure, permission issue, resource limit, etc.)
   - Provide a suggested fix with specific actions
   - Note if this is a child pipeline failure — follow the chain to the actual failing step

   **Success:**
   - Extract concrete outputs based on step type:
     - **IACM / Terraform**: Resources created/changed/destroyed, resource names/IDs, state drift
     - **CD / Deploy**: Service, environment/namespace, image tag, replicas, health check result
     - **CI / Build**: Image built (repo:tag), test results (passed/failed/skipped), artifacts produced
     - **STO / Security**: Vulnerability counts (critical/high/medium/low), policy violations, scan tool
     - **CCM / Cost**: Budget alerts, anomalies, recommendations, savings
     - **Approval**: Who approved/rejected, wait duration
     - **Plugin / Run steps**: Command executed, exit code, key output lines

   **Skipped:**
   - Note as skipped with the reason (conditional skip, previous stage failure, manual intervention required)

## Required Output (whole-pipeline mode)

### Summary
A 1–2 sentence executive summary of the entire execution outcome. Examples:
- Failed: "Pipeline failed at stage Deploy / step rollout-prod because the Kubernetes namespace 'prod-us' hit its resource quota. Fix: increase CPU limits on the namespace or scale down existing pods."
- Success: "Pipeline deployed service cart-api v2.4.1 to prod-us (3 replicas healthy), built and pushed image in 2m14s, passed 847 tests with 0 vulnerabilities."

### Execution Overview
- **Pipeline**: [name]
- **Execution ID**: [id]
- **Status**: [Success / Failed / Aborted]
- **Duration**: [total wall-clock time]
- **Trigger**: [manual / webhook / cron / API]

### Step Analysis

| Step Name | Status | Duration | Analysis |
|-----------|--------|----------|----------|
| ...       | Failed | ...      | **Root cause**: ... **Fix**: ... |
| ...       | Success | ...     | Concrete outputs from logs |
| ...       | Skipped | ...     | Reason skipped |

### Key Findings
- **Failures**: Root cause summary, affected steps, suggested fixes
- **Outputs**: Resources provisioned/deployed/built/scanned (aggregated)
- **Performance**: Bottlenecks or unusually slow steps
- **Warnings**: Issues worth investigating even in successful steps`,
            },
          },
        ],
      };
  };

  server.registerPrompt("pipeline_summarizer", PIPELINE_SUMMARIZER_PROMPT, handler);
  // Backward-compatible alias for callers still using the pre-rename prompt name.
  server.registerPrompt("summarize-pipeline", PIPELINE_SUMMARIZER_PROMPT, handler);
}
