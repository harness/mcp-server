import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDebugPipelinePrompt(server: McpServer): void {
  server.prompt(
    "debug-pipeline-failure",
    "Analyze a failed pipeline execution and suggest fixes",
    {
      executionId: z.string().describe("The failed execution ID"),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ executionId, projectId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze this failed Harness pipeline execution and provide:

1. **Root cause** of the failure
2. **Which step failed** and why
3. **Suggested fix** with specific actions
4. **Similar patterns** — have we seen this failure type before?

Start by calling harness_diagnose with execution_id="${executionId}"${projectId ? ` and project_id="${projectId}"` : ""} to gather all context (execution details, pipeline YAML, and logs) in one call.

Then analyze the diagnostic payload and provide actionable recommendations.`,
        },
      }],
    }),
  );
}
