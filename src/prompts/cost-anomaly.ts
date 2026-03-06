import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCostAnomalyPrompt(server: McpServer): void {
  server.prompt(
    "cost-anomaly-investigation",
    "Investigate cost anomalies — determine root cause, impacted resources, and remediation",
    {
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Investigate recent cost anomalies and determine root causes.

Steps:
1. **Fetch anomalies**: Call harness_list with resource_type="cost_anomaly"${projectFilter} to get recent cost anomalies
2. **Get cost timeline**: Call harness_get with resource_type="cost_timeseries"${projectFilter} to see the cost spike in context
3. **Breakdown analysis**: Call harness_get with resource_type="cost_breakdown"${projectFilter} to identify which services/resources drove the spike
4. **Check ignored**: Call harness_list with resource_type="cost_ignored_anomaly"${projectFilter} to see if similar anomalies were previously dismissed
5. **For each anomaly, provide**:
   - **When**: Date and time of the anomaly
   - **What**: Which resource/service saw the cost spike
   - **How much**: Dollar impact (expected vs actual)
   - **Root cause**: Most likely explanation (autoscaling event, new deployment, misconfiguration, attack)
   - **Remediation**: Specific actions to resolve and prevent recurrence
   - **Urgency**: Is this ongoing or already resolved?

Prioritize anomalies by dollar impact, with ongoing anomalies flagged as urgent.`,
          },
        }],
      };
    },
  );
}
