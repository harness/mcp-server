import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerOptimizeCostsPrompt(server: McpServer): void {
  server.registerPrompt(
    "optimize-costs",
    {
      description: "Analyze cloud cost data and recommend optimizations for a Harness project",
      argsSchema: {
        projectId: z.string().describe("Project identifier to analyze costs for").optional(),
      },
    },
    async ({ projectId }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Analyze cloud costs and recommend optimizations for this Harness project.

Steps:
1. Call harness_list with resource_type="cost_recommendation"${projectId ? ` and project_id="${projectId}"` : ""} to get current cost recommendations
2. Call harness_list with resource_type="cost_anomaly"${projectId ? ` and project_id="${projectId}"` : ""} to identify any cost anomalies
3. Prioritize findings by potential savings (highest first)
4. For each recommendation, provide:
   - **What**: Which resource/service is over-provisioned or idle
   - **Savings**: Estimated monthly savings
   - **Action**: Specific steps to realize the savings
   - **Risk**: Any potential impact of making the change

Present a summary table of top recommendations sorted by savings potential, then detailed breakdowns.`,
        },
      }],
    }),
  );
}
