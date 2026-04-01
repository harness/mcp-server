import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAccessControlAuditPrompt(server: McpServer): void {
  server.registerPrompt(
    "access-control-audit",
    {
      description: "Audit user permissions, over-privileged accounts, and role assignments to enforce least-privilege",
      argsSchema: {
        projectId: z.string().describe("Project identifier").optional(),
        orgId: z.string().describe("Organization identifier").optional(),
      },
    },
    async ({ projectId, orgId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      const orgFilter = orgId ? `, org_id="${orgId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform an access control audit to identify over-privileged accounts and enforce least-privilege.

Steps:
1. **List users**: Call harness_list with resource_type="user"${orgFilter}${projectFilter} to get all users
2. **List service accounts**: Call harness_list with resource_type="service_account"${orgFilter}${projectFilter} to get all service accounts
3. **List roles**: Call harness_list with resource_type="role"${orgFilter}${projectFilter} to see all defined roles
4. **List role assignments**: Call harness_list with resource_type="role_assignment"${orgFilter}${projectFilter} to see who has what role
5. **List resource groups**: Call harness_list with resource_type="resource_group"${orgFilter}${projectFilter} to understand resource access scopes
6. **List user groups**: Call harness_list with resource_type="user_group"${orgFilter}${projectFilter} to see group memberships
7. **Analyze and flag**:
   - **Over-privileged users**: Users with admin roles who don't need them
   - **Stale accounts**: Users who haven't been active (check audit trail if available)
   - **Service account sprawl**: Unused or redundant service accounts
   - **Role drift**: Role assignments that don't match team structure
   - **Broad resource groups**: Resource groups with overly permissive scope
8. **Present audit report**:
   - User/SA inventory with role mappings
   - Flagged over-privileged accounts with recommended role changes
   - Recommendations for role consolidation
   - Suggested resource group tightening`,
          },
        }],
      };
    },
  );
}
