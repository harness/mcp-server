import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCloudCostBreakdownPrompt(server: McpServer): void {
  server.registerPrompt(
    "cloud-cost-breakdown",
    {
      description: "Deep-dive into cloud costs by service, environment, or cluster with trend analysis",
      argsSchema: {
        perspectiveId: z.string().describe("Cost perspective ID to analyze").optional(),
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ perspectiveId, projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      const perspectiveFilter = perspectiveId ? `, perspective_id="${perspectiveId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a deep-dive analysis of cloud costs.

Steps:
1. **List perspectives**: Call harness_list with resource_type="cost_perspective"${projectFilter} to see available cost perspectives
2. **Get cost summary**: Call harness_get with resource_type="cost_summary"${projectFilter}${perspectiveFilter} to get overall cost totals
3. **Get cost breakdown**: Call harness_get with resource_type="cost_breakdown"${projectFilter}${perspectiveFilter} to see costs broken down by service/cluster/environment
4. **Get trends**: Call harness_get with resource_type="cost_timeseries"${projectFilter}${perspectiveFilter} to see cost trends over time
5. **Check anomalies**: Call harness_list with resource_type="cost_anomaly"${projectFilter} to identify unusual cost spikes
6. **Analyze and present**:
   - **Top 5 cost drivers**: Rank by spend, show month-over-month change
   - **Cost trend**: Is spending increasing, stable, or decreasing?
   - **Anomalies**: Flag any unusual spikes with likely root cause
   - **Optimization opportunities**: Identify idle resources, over-provisioned services
   - **Forecast**: Project next month's costs based on current trends`,
          },
        }],
      };
    },
  );
}
