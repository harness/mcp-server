import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDelegateHealthPrompt(server: McpServer): void {
  server.prompt(
    "delegate-health-check",
    "Check delegate connectivity, health, and token status with troubleshooting guidance",
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
            text: `Perform a health check on Harness delegates and diagnose any issues.

Steps:
1. **List delegates**: Call harness_list with resource_type="delegate"${projectFilter} to get all delegate groups and their status
2. **Check tokens**: Call harness_list with resource_type="delegate_token"${projectFilter} to see delegate token status and expiration
3. **Analyze health**: For each delegate group, assess:
   - **Connectivity**: Is the delegate connected and heartbeating?
   - **Version**: Is it running the latest delegate version?
   - **Capacity**: How many instances are active vs expected?
   - **Token status**: Are tokens valid or nearing expiration?
4. **Present health report**: Create a table with:
   - Delegate name, status (healthy/degraded/disconnected), instance count, version, last heartbeat
5. **Diagnose issues**: For any unhealthy delegates:
   - Identify likely root cause (network, expired token, resource constraints)
   - Provide specific remediation steps
6. **Token warnings**: Flag any tokens expiring within 30 days`,
          },
        }],
      };
    },
  );
}
