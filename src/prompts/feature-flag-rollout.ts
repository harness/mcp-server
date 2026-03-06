import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerFeatureFlagRolloutPrompt(server: McpServer): void {
  server.prompt(
    "feature-flag-rollout",
    "Plan and execute a progressive feature flag rollout across environments",
    {
      flagIdentifier: z.string().describe("Feature flag identifier to roll out"),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ flagIdentifier, projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Plan a progressive rollout for feature flag "${flagIdentifier}".

Steps:
1. **Get flag details**: Call harness_get with resource_type="feature_flag", resource_id="${flagIdentifier}"${projectFilter} to see the current flag state and variations
2. **List environments**: Call harness_list with resource_type="fme_environment"${projectFilter} to see available feature flag environments
3. **Check workspaces**: Call harness_list with resource_type="fme_workspace"${projectFilter} for workspace context
4. **Assess current state**: Determine which environments the flag is currently on/off in
5. **Propose rollout plan**: Recommend a progressive rollout strategy:
   - Phase 1: Enable in dev/test environments
   - Phase 2: Enable in staging with percentage rollout (e.g., 10%)
   - Phase 3: Increase staging to 50%, then 100%
   - Phase 4: Enable in production with percentage rollout
   - Phase 5: Full production rollout
6. **Safety gates**: Identify metrics or health checks between each phase
7. **Rollback plan**: Define conditions that trigger automatic rollback

Present the rollout plan for review. Use harness_execute with resource_type="feature_flag", action="toggle" to execute each phase only after confirmation.`,
          },
        }],
      };
    },
  );
}
