import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSecurityReviewPrompt(server: McpServer): void {
  server.prompt(
    "security-review",
    "Review security issues across Harness resources and suggest remediations",
    {
      projectId: z.string().describe("Project identifier to review").optional(),
      severity: z.string().describe("Comma-separated severity filter (default: critical,high)").optional(),
    },
    async ({ projectId, severity }) => {
      const severityFilter = severity ?? "critical,high";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a security review of Harness resources and provide actionable remediations.

Steps:
1. Call harness_list with resource_type="security_issue"${projectId ? `, project_id="${projectId}"` : ""}, severity="${severityFilter}" to get current security findings
2. Call harness_list with resource_type="artifact_security"${projectId ? `, project_id="${projectId}"` : ""} to check artifact-level security posture
3. Call harness_list with resource_type="code_repo_security"${projectId ? `, project_id="${projectId}"` : ""} to check code repository security
4. Group findings by service/resource
5. For each finding, provide:
   - **Severity**: Critical / High / Medium / Low
   - **Resource**: Which service or component is affected
   - **Issue**: Description of the vulnerability
   - **Remediation**: Specific fix with steps
   - **Priority**: Urgency ranking based on severity and exposure

Present critical issues first with immediate action items, then high-severity items with recommended timeline.`,
          },
        }],
      };
    },
  );
}
