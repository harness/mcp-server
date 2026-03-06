import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSbomCompliancePrompt(server: McpServer): void {
  server.prompt(
    "sbom-compliance-check",
    "Audit SBOM and compliance posture for artifacts — license risks, policy violations, component vulnerabilities",
    {
      artifactId: z.string().describe("Specific artifact ID to audit").optional(),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ artifactId, projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      const artifactFilter = artifactId ? `, artifact_id="${artifactId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Audit the Software Bill of Materials (SBOM) and compliance posture.

Steps:
1. **Get SBOM**: Call harness_list with resource_type="scs_sbom"${projectFilter}${artifactFilter} to retrieve the SBOM for the artifact(s)
2. **Check compliance**: Call harness_list with resource_type="scs_compliance_result"${projectFilter} to see policy compliance results
3. **List components**: Call harness_list with resource_type="scs_artifact_component"${projectFilter}${artifactFilter} to see all dependencies
4. **Check policies**: Call harness_list with resource_type="scs_opa_policy"${projectFilter} to see OPA policies governing compliance
5. **Check remediation**: Call harness_list with resource_type="scs_artifact_remediation"${projectFilter}${artifactFilter} to see available fixes
6. **Analyze and report**:
   - **Component count**: Total dependencies, direct vs transitive
   - **License breakdown**: Group by license type, flag copyleft or unknown licenses
   - **Policy violations**: List all failed compliance checks with details
   - **Vulnerable components**: Dependencies with known CVEs
   - **Remediation plan**: For each violation, specific upgrade path or alternative dependency

Present a compliance scorecard followed by detailed findings.`,
          },
        }],
      };
    },
  );
}
