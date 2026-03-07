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

Start by calling harness_diagnose with ${idParam}${projectId ? `, project_id="${projectId}"` : ""}, summary=false to gather all context (execution details, pipeline YAML, and logs) in one call.

Then analyze the diagnostic payload and provide actionable recommendations.`,
          },
        }],
      };
    },
  );
}
