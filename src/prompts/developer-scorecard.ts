import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDeveloperScorecardPrompt(server: McpServer): void {
  server.registerPrompt(
    "developer-portal-scorecard",
    {
      description: "Review IDP scorecards for services and identify gaps to improve developer experience",
      argsSchema: {
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review Internal Developer Portal scorecards and recommend improvements.

Steps:
1. **List scorecards**: Call harness_list with resource_type="scorecard"${projectFilter} to see all defined scorecards
2. **Get scorecard checks**: Call harness_list with resource_type="scorecard_check"${projectFilter} to see individual checks and their pass/fail status
3. **List entities**: Call harness_list with resource_type="idp_entity"${projectFilter} to see registered components/services
4. **Get scores**: Call harness_list with resource_type="idp_score"${projectFilter} to see current scores per entity
5. **Analyze results**: For each scorecard:
   - Overall pass rate and trend
   - Lowest-scoring entities
   - Most commonly failing checks
6. **Prioritize improvements**: Rank failing checks by:
   - Impact (how many entities fail this check)
   - Effort (estimated difficulty to fix)
   - Value (importance for developer experience / production readiness)
7. **Generate action plan**: For the top 5 failing checks, provide specific remediation steps

Present a summary scorecard table followed by a prioritized improvement plan.`,
          },
        }],
      };
    },
  );
}
