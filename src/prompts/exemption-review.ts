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
5. **Batch actions**: Group exemptions by recommendation and target scope:
   - **Approve at current scope**: Low-risk with valid justification and compensating controls. Use action="approve" with body.scope="CURRENT".
   - **Approve at wider scope**: If the user wants approval at ACCOUNT, ORG, or PROJECT scope, use action="approve" with that body.scope; the server routes elevated scopes through STO promotion internally.
   - **Reject**: High-risk without adequate mitigation.
   - **Needs review**: Insufficient justification or missing context.

To take action, I can use harness_execute with resource_type="security_exemption" and action="approve" or "reject" — but only after you confirm each decision. For approve, the body must include scope: "CURRENT" | "ACCOUNT" | "ORG" | "PROJECT". approver_id is optional for approve/reject because the server derives it from the authenticated user when omitted.

## Suggested next steps

After presenting the review table, append a final section titled
"## Suggested next steps" containing 3–5 personalized follow-up prompts the
user can click to send back. Use human-readable titles (vulnerability name,
issue type, target name, severity) — NEVER raw UUIDs or exemption IDs in the
visible text. Mix single-entity actions with bulk actions when patterns emerge
across multiple exemptions.

Format: a markdown bullet list of complete, send-as-is sentences.

Example shape (use real titles/types/targets from your output, not these literals):
- Approve at project scope: SQL injection in payment-api (Critical, mitigation in place)
- Reject: Hardcoded API key in auth-service (no justification)
- Reject all Pending SECRET-type exemptions for target payment-api
- Approve all Pending Low-severity SCA exemptions for target shared-libs at ORG scope
- Show all Approved exemptions for target auth-service

Rules:
- Use vulnerability titles / issue types / target names visible to the user; never paste UUIDs
- Prefer bulk actions ("Reject all SECRET-type", "Approve all Low SCA") when 3+ exemptions share a pattern
- Maximum 5 suggestions; mix at least one bulk action when applicable
- Each line is a single, complete imperative sentence
- Order: high-confidence approves first, then rejects, then bulk, then info-gathering
- Omit the section entirely if no exemptions were returned`,
          },
        }],
      };
    },
  );
}
