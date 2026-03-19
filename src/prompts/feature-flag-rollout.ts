import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerFeatureFlagRolloutPrompt(server: McpServer): void {
  server.registerPrompt(
    "feature-flag-rollout",
    {
      description: "Plan and execute a progressive FME feature flag rollout across environments",
      argsSchema: {
        featureFlagName: z.string().describe("Feature flag name to roll out"),
        workspaceId: z.string().describe("FME workspace ID"),
      },
    },
    async ({ featureFlagName, workspaceId }) => {
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Plan a progressive rollout for FME feature flag "${featureFlagName}" in workspace "${workspaceId}".

Steps:
1. **Get flag details**: Call harness_get with resource_type="fme_feature_flag", feature_flag_name="${featureFlagName}", workspace_id="${workspaceId}" to see the current flag state
2. **List environments**: Call harness_list with resource_type="fme_environment", workspace_id="${workspaceId}" to see available environments
3. **Get flag definition per environment**: For each environment, call harness_get with resource_type="fme_feature_flag_definition", feature_flag_name="${featureFlagName}", workspace_id="${workspaceId}", environment_id=<env_id> to see treatments and rules
4. **Check rollout statuses**: Call harness_list with resource_type="fme_rollout_status", workspace_id="${workspaceId}" for rollout status context
5. **Propose rollout plan**: Recommend a progressive rollout strategy:
   - Phase 1: Restore flag in dev/test environments
   - Phase 2: Restore in staging, verify treatments
   - Phase 3: Restore in production
   - Phase 4: Full production rollout
6. **Safety gates**: Identify metrics or health checks between each phase
7. **Rollback plan**: Use kill action to immediately turn off the flag if issues arise

Present the rollout plan for review. Use harness_execute with resource_type="fme_feature_flag", action="kill" or action="restore", workspace_id="${workspaceId}", feature_flag_name="${featureFlagName}", environment_id=<env_id> to execute each phase after user approval.`,
          },
        }],
      };
    },
  );
}
