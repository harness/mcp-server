import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSummarizePipelinePrompt(server: McpServer): void {
  server.registerPrompt(
    "pipeline_summarizer",
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

Provide a comprehensive markdown summary of ALL steps in this pipeline execution — not just failures.

## Steps

1. Call \`get_execution\` with ${idParam}${projectId ? `, project_id="${projectId}"` : ""} to retrieve the full execution tree (all stages, steps, statuses, durations).
2. Call \`download_execution_logs\` for EACH step to capture log output — include passing steps, not only failures.
3. Optionally call \`get_pipeline\` for YAML context if step purposes are unclear from logs alone.

## Required Output

### Execution Overview
- **Pipeline**: [name]
- **Execution ID**: [id]
- **Status**: [Success / Failed / Running / Aborted]
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
