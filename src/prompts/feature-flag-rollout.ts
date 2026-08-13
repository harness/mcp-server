import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerFeatureFlagRolloutPrompt(server: McpServer): void {
  server.registerPrompt(
    "feature-flag-rollout",
    {
      description: "Plan and execute a progressive FME feature flag rollout across environments",
      argsSchema: {
        featureFlagName: z.string().describe("Feature flag name to roll out"),
        workspaceId: z.string().describe("FME workspace ID (deprecated — omit if passing orgId+projectId)").optional(),
        orgId: z.string().describe("Harness org identifier (pass together with projectId)").optional(),
        projectId: z.string().describe("Harness project identifier (pass together with orgId)").optional(),
      },
    },
    async ({ featureFlagName, workspaceId, orgId, projectId }) => {
      if (!workspaceId && !(orgId && projectId)) {
        throw new Error("Provide either workspaceId (deprecated) or orgId + projectId.");
      }

      const scopeArgs = workspaceId
        ? `workspace_id="${workspaceId}"`
        : `org_id="${orgId}", project_id="${projectId}"`;

      const nativeModeCaveat = workspaceId
        ? ""
        : "\n\nNote: in Harness-native mode (org_id/project_id), fme_feature_flag_definition, fme_rollout_status, and the kill/restore execute action are not yet implemented server-side and will error — steps 3, 4, and 7 below only work today with workspace_id (legacy mode).";

      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Plan a progressive rollout for FME feature flag "${featureFlagName}" (${scopeArgs}).

Steps:
1. **Get flag details**: Call harness_get with resource_type="fme_feature_flag", feature_flag_name="${featureFlagName}", ${scopeArgs} to see the current flag state
2. **List environments**: Call harness_list with resource_type="fme_environment", ${scopeArgs} to see available environments
3. **Get flag definition per environment**: For each environment, call harness_get with resource_type="fme_feature_flag_definition", feature_flag_name="${featureFlagName}", ${scopeArgs}, environment_id=<env_id> to see treatments and rules
4. **Check rollout statuses**: Call harness_list with resource_type="fme_rollout_status", ${scopeArgs} for rollout status context
5. **Propose rollout plan**: Recommend a progressive rollout strategy:
   - Phase 1: Restore flag in dev/test environments
   - Phase 2: Restore in staging, verify treatments
   - Phase 3: Restore in production
   - Phase 4: Full production rollout
6. **Safety gates**: Identify metrics or health checks between each phase
7. **Rollback plan**: Use kill action to immediately turn off the flag if issues arise

Present the rollout plan for review. Use harness_execute with resource_type="fme_feature_flag", action="kill" or action="restore", ${scopeArgs}, feature_flag_name="${featureFlagName}", environment_id=<env_id> to execute each phase after user approval.${nativeModeCaveat}`,
          },
        }],
      };
    },
  );
}
