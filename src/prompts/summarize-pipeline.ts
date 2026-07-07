import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSummarizePipelinePrompt(server: McpServer): void {
  server.registerPrompt(
    "summarize-pipeline",
    {
      description:
        "Summarize an entire pipeline execution — all steps, statuses, durations, and logs. Accepts an execution ID, pipeline ID, or Harness URL.",
      argsSchema: {
        executionId: z
          .string()
          .describe("The execution ID, pipeline ID, or a Harness URL")
          .optional(),
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ executionId, projectId }) => {
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
              text: `You are a pipeline execution summarizer for Harness CI/CD.

Unlike debug-pipeline-failure, summarize ALL steps including successes; focus on overview and optimization, not root-cause analysis.

## Steps

1. Call harness_diagnose with ${idParam}${projectId ? `, project_id="${projectId}"` : ""} to get the full stage/step tree, durations, statuses, and any failure details.
   - Note: harness_diagnose rejects non-terminal executions (Running, Queued). For in-progress runs, use harness_get with resource_type="execution" and resource_id=<execution_id> instead — log analysis may be incomplete for running executions.
2. Fetch logs selectively — do NOT fetch logs for every step (large pipelines may have 30+ steps):
   - Failed steps: already included in the harness_diagnose response (failed_step_logs).
   - Slowest steps: use harness_get with resource_type="execution_log" and the Harness URL including ?step=<nodeExecutionId> for the top 3 slowest steps.
   - Key output steps: fetch logs for build, deploy, and test steps to capture artifacts, image tags, and test counts.
3. Optionally call harness_get with resource_type="pipeline" and resource_id=<pipeline_id> for YAML context if step purposes are unclear from the diagnose output alone.

## Required Output

### Execution Overview
- **Pipeline**: [name]
- **Execution ID**: [id]
- **Status**: [Success / Failed / Aborted]
- **Duration**: [total wall-clock time]
- **Trigger**: [manual / webhook / cron / API]

### Step Summary

| # | Step Name | Type | Duration | Status | Key Output |
|---|-----------|------|----------|--------|------------|
| 1 | ...       | ...  | ...      | ...    | ...        |

For each step, the "Key Output" column should note: artifacts produced, images built/pushed, tests passed/failed counts, deployments made, or meaningful log lines.

### Key Observations
- Performance bottlenecks or unusually slow steps
- Warnings in passing steps
- Resource patterns (memory, CPU, disk)
- Suggestions for optimization`,
            },
          },
        ],
      };
    },
  );
}
