import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerExemptionReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    "security-exemption-review",
    {
      description: "Review pending security exemptions and make batch approval or rejection decisions",
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
            text: `Review pending security exemptions and provide approval recommendations.

Steps:
1. **List exemptions**: Call harness_list with resource_type="security_exemption"${projectFilter} to get all exemptions
2. **Get security context**: Call harness_list with resource_type="security_issue"${projectFilter} to understand the broader security landscape
3. **For each pending exemption, assess**:
   - **Justification quality**: Is the reason valid and well-documented?
   - **Risk level**: What's the exposure if this vulnerability remains unpatched?
   - **Compensating controls**: Are there mitigations in place?
   - **Expiration**: Is the exemption time-bounded?
   - **Recommendation**: Approve, Reject, or Request more info
4. **Present review table**:
   - Exemption ID, vulnerability, severity, requestor, justification, recommendation
5. **Batch actions**: Group exemptions by recommendation:
   - **Approve**: Low-risk with valid justification and compensating controls
   - **Reject**: High-risk without adequate mitigation
   - **Needs review**: Insufficient justification or missing context

To take action, I can use harness_execute with resource_type="security_exemption" and action="approve", "reject", or "promote" — but only after you confirm each decision.`,
          },
        }],
      };
    },
  );
}
