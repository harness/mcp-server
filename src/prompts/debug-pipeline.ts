import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDebugPipelinePrompt(server: McpServer): void {
  server.prompt(
    "debug-pipeline-failure",
    "Analyze a failed pipeline execution and suggest fixes. Accepts an execution ID, pipeline ID, or Harness URL.",
    {
      executionId: z.string().describe("The failed execution ID, pipeline ID, or a Harness URL").optional(),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ executionId, projectId }) => {
      // Detect if the input looks like a URL
      const isUrl = executionId?.startsWith("http");
      const idParam = isUrl
        ? `url="${executionId}"`
        : `execution_id="${executionId}"`;

      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze this failed Harness pipeline execution and provide:

1. **Root cause** of the failure
2. **Which step failed** and why
3. **Suggested fix** with specific actions
4. **Similar patterns** — have we seen this failure type before?

Start by calling harness_diagnose with ${idParam}${projectId ? `, project_id="${projectId}"` : ""}, include_logs=true to get the execution report with stage/step breakdown, timing, failure details, and failed step logs.

Then analyze the diagnostic payload:
- **failure section**: failed stage, step, error message, and delegate
- **child_pipeline section**: if present, the failure is in a chained pipeline — focus on the child's failure details
- **failed_step_logs**: actual log output from the failed steps — look for error patterns, stack traces, and exit codes

Provide actionable recommendations based on the combined evidence.`,
          },
        }],
      };
    },
  );
}
