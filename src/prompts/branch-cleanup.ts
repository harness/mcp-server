import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBranchCleanupPrompt(server: McpServer): void {
  server.prompt(
    "branch-cleanup",
    "Analyze branches in a repository and recommend stale or merged branches to delete",
    {
      repoId: z.string().describe("Repository identifier"),
      projectId: z.string().describe("Project identifier").optional(),
    },
    async ({ repoId, projectId }) => {
      const projectArg = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Analyze branches in repo "${repoId}" and recommend which ones to clean up.

Steps:
1. Call harness_list with resource_type="branch", repo_id="${repoId}"${projectArg} to list all branches
2. Call harness_list with resource_type="pull_request", repo_id="${repoId}", state="merged"${projectArg} to find merged PRs (their source branches are cleanup candidates)
3. Call harness_list with resource_type="pull_request", repo_id="${repoId}", state="closed"${projectArg} to find closed PRs
4. Call harness_get with resource_type="repository", repo_id="${repoId}"${projectArg} to identify the default branch

Analyze and present:

**Branch Summary**: Total branch count, default branch name.

**Safe to Delete** (merged branches):
| Branch | Merged Via PR | Last Commit Date | Status |
|--------|---------------|-------------------|--------|

**Likely Stale** (no recent activity, no open PR):
| Branch | Last Commit Date | Days Inactive | Recommendation |
|--------|-------------------|---------------|----------------|

**Active Branches** (open PRs or recent commits — keep):
| Branch | Open PR | Last Activity |
|--------|---------|---------------|

**Recommended Actions**: Prioritized list of branches to delete, starting with merged ones. Include the harness_delete commands to run.

Never recommend deleting the default branch or any branch with an open PR.`,
          },
        }],
      };
    },
  );
}
