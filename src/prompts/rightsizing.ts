import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerRightsizingPrompt(server: McpServer): void {
  server.registerPrompt(
    "rightsizing-recommendations",
    {
      description: "Review and prioritize rightsizing recommendations, optionally create Jira or ServiceNow tickets",
      argsSchema: {
        projectId: z.string().describe("Project identifier").optional(),
        minSavings: z.string().describe("Minimum monthly savings threshold to include (e.g., '100' for $100/mo)").optional(),
      },
    },
    async ({ projectId, minSavings }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      const savingsNote = minSavings ? `\nFilter to recommendations with monthly savings >= $${minSavings}.` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review rightsizing recommendations and help take action on them.${savingsNote}

Steps:
1. **Get stats**: Call harness_get with resource_type="cost_recommendation_stats"${projectFilter} to get overall recommendation summary
2. **By type**: Call harness_get with resource_type="cost_recommendation_stats"${projectFilter}, params={group_by: "type"} to see recommendations grouped by type (resize, terminate, etc.)
3. **Full list**: Call harness_list with resource_type="cost_recommendation"${projectFilter} to get all individual recommendations
4. **Rank and present**: Create a prioritized table sorted by monthly savings:
   - **Resource**: Name and type of the over-provisioned resource
   - **Current**: Current instance type/size
   - **Recommended**: Suggested instance type/size
   - **Monthly savings**: Estimated savings
   - **Risk level**: Low (idle resource), Medium (right-size), High (requires testing)
5. **Action plan**: For the top recommendations:
   - Group by risk level
   - Suggest implementation order (low-risk first)
   - Note any that need load testing before applying

To take action on approved recommendations, I can:
- Update recommendation state using harness_execute with resource_type="cost_recommendation", action="update_state"
- Create a Jira ticket using action="create_jira_ticket"
- Create a ServiceNow ticket using action="create_snow_ticket"

Present recommendations for review before taking any action.`,
          },
        }],
      };
    },
  );
}
