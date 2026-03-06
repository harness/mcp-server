import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCommitmentUtilizationPrompt(server: McpServer): void {
  server.prompt(
    "commitment-utilization-review",
    "Analyze reserved instance and savings plan utilization to find waste and optimize commitments",
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
            text: `Analyze commitment utilization (reserved instances, savings plans) and recommend optimizations.

Steps:
1. **Coverage analysis**: Call harness_get with resource_type="cost_commitment_coverage"${projectFilter} to see what percentage of compute is covered by commitments
2. **Utilization check**: Call harness_get with resource_type="cost_commitment_utilisation"${projectFilter} to see how well existing commitments are being used
3. **Savings realized**: Call harness_get with resource_type="cost_commitment_savings"${projectFilter} to quantify actual savings from commitments
4. **Detailed analysis**: Call harness_get with resource_type="cost_commitment_analysis"${projectFilter} for detailed breakdown by commitment type
5. **Estimated savings**: Call harness_get with resource_type="cost_estimated_savings"${projectFilter} to see potential additional savings
6. **Present findings**:
   - **Utilization rate**: Percentage of commitments being used (target >80%)
   - **Coverage rate**: Percentage of eligible compute covered (identify gaps)
   - **Wasted spend**: Dollar value of underutilized commitments
   - **Recommendations**:
     - Right-size existing commitments
     - Purchase additional commitments for uncovered high-usage resources
     - Convert commitment types (RI → Savings Plan) where beneficial
     - Let low-utilization commitments expire`,
          },
        }],
      };
    },
  );
}
