import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSetupGitopsPrompt(server: McpServer): void {
  server.prompt(
    "setup-gitops-application",
    "Guide through onboarding a GitOps application — verify agent, cluster, repo, and create the application",
    {
      agentId: z.string().describe("GitOps agent identifier"),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ agentId, projectId }) => {
      const projectFilter = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Set up a new GitOps application in Harness.

Steps:
1. **Verify agent**: Call harness_list with resource_type="gitops_agent"${projectFilter} and confirm agent "${agentId}" is healthy
2. **List clusters**: Call harness_list with resource_type="gitops_cluster", agent_id="${agentId}"${projectFilter} to see available target clusters
3. **List repositories**: Call harness_list with resource_type="gitops_repository", agent_id="${agentId}"${projectFilter} to see configured Git repos
4. **Review existing apps**: Call harness_list with resource_type="gitops_application", agent_id="${agentId}"${projectFilter} to see current application patterns
5. **Generate application spec**: Based on the available clusters, repos, and existing patterns, propose a new GitOps application configuration
6. **Present for review**: Show the proposed application definition and target sync settings

Do NOT create the application until I confirm — present the plan and configuration first.`,
          },
        }],
      };
    },
  );
}
