import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPrSummaryPrompt(server: McpServer): void {
  server.registerPrompt(
    "pr-summary",
    {
      description: "Auto-generate a pull request title and description from the commit history and diff of a branch",
      argsSchema: {
        repoId: z.string().describe("Repository identifier"),
        sourceBranch: z.string().describe("Source branch name (the feature branch)"),
        targetBranch: z.string().describe("Target branch name (e.g., main)").optional(),
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ repoId, sourceBranch, targetBranch, projectId }) => {
      const target = targetBranch ?? "main";
      const projectArg = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Generate a pull request title and description for merging "${sourceBranch}" into "${target}" in repo "${repoId}".

Steps:
1. Call harness_list with resource_type="commit", repo_id="${repoId}", git_ref="${sourceBranch}"${projectArg} to list commits on the source branch
2. Call harness_execute with resource_type="commit", action="diff_stats", repo_id="${repoId}", range="${target}..${sourceBranch}"${projectArg} to see files changed and scope
3. Call harness_execute with resource_type="commit", action="diff", repo_id="${repoId}", range="${target}..${sourceBranch}"${projectArg} to see the actual code changes

From the commits and diff, generate:

**Title**: A concise, descriptive PR title (imperative mood, <=72 chars).

**Description** (in markdown):
- **Summary**: 2-3 sentence overview of the changes.
- **Changes**: Bullet list of key modifications grouped by area.
- **Testing**: What was tested or what should be tested.
- **Breaking Changes**: Any breaking changes (or "None").
- **Related Issues**: Inferred issue references from commit messages.

Output the title and description in a ready-to-use format that can be passed directly to harness_create with resource_type="pull_request".`,
          },
        }],
      };
    },
  );
}
