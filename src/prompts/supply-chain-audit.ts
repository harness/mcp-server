import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSupplyChainAuditPrompt(server: McpServer): void {
  server.registerPrompt(
    "supply-chain-audit",
    {
      description: "End-to-end software supply chain security audit — provenance, chain of custody, policy compliance",
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
            text: `Perform an end-to-end software supply chain security audit.

Steps:
1. **Artifact security posture**: Call harness_list with resource_type="artifact_security"${projectFilter} to assess overall artifact security
2. **Code repository security**: Call harness_list with resource_type="code_repo_security"${projectFilter} to check source code security
3. **Chain of custody**: Call harness_list with resource_type="scs_chain_of_custody"${projectFilter} to verify artifact provenance and build attestation
4. **SBOM coverage**: Call harness_list with resource_type="scs_sbom"${projectFilter} to check which artifacts have SBOMs generated
5. **Compliance results**: Call harness_list with resource_type="scs_compliance_result"${projectFilter} to check policy compliance
6. **OPA policies**: Call harness_list with resource_type="scs_opa_policy"${projectFilter} to review active governance policies
7. **Remediation status**: Call harness_list with resource_type="scs_artifact_remediation"${projectFilter} to see outstanding remediation items
8. **Generate audit report**:
   - **Supply chain integrity score**: Overall health (0-100)
   - **Provenance gaps**: Artifacts without verified build provenance
   - **Unsigned artifacts**: Missing signatures or attestation
   - **SBOM coverage**: Percentage of artifacts with SBOMs
   - **Policy enforcement**: Active vs missing policies
   - **Open vulnerabilities**: Unresolved security findings
   - **Remediation backlog**: Pending fixes by severity
   - **Recommendations**: Prioritized actions to improve supply chain security`,
          },
        }],
      };
    },
  );
}
