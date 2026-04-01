import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCodeReviewPrompt(server: McpServer): void {
  server.registerPrompt(
    "code-review",
    {
      description: "Review a Harness Code pull request — analyze diff, commits, checks, and comments to provide structured feedback",
      argsSchema: {
        repoId: z.string().describe("Repository identifier"),
        prNumber: z.string().describe("Pull request number"),
        projectId: z.string().describe("Project identifier").optional(),
      },
    },
    async ({ repoId, prNumber, projectId }) => {
      const projectArg = projectId ? `, project_id="${projectId}"` : "";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Perform a thorough code review of pull request #${prNumber} in repo "${repoId}".

Steps:
1. Call harness_get with resource_type="pull_request", repo_id="${repoId}", pr_number="${prNumber}"${projectArg} to get PR details (title, description, source/target branches)
2. Call harness_list with resource_type="pr_comment", repo_id="${repoId}", pr_number="${prNumber}"${projectArg} to see existing review comments
3. Call harness_list with resource_type="pr_check", repo_id="${repoId}", pr_number="${prNumber}"${projectArg} to check CI status
4. Call harness_list with resource_type="pr_activity", repo_id="${repoId}", pr_number="${prNumber}"${projectArg} to see review activity
5. Call harness_list with resource_type="commit", repo_id="${repoId}", git_ref="refs/pullreq/${prNumber}/head"${projectArg} to list the PR's commits
6. Use harness_execute with resource_type="commit", action="diff_stats", repo_id="${repoId}", range="<target_branch>..<source_branch>"${projectArg} to see what files changed and scope of changes

Analyze the PR and provide:

**Summary**: One-paragraph description of what this PR does.

**Review Findings** (organized by category):
- **Bugs / Logic Errors**: Potential correctness issues
- **Security**: Credential exposure, injection risks, auth gaps
- **Performance**: Inefficient patterns, N+1 queries, missing caching
- **Style / Readability**: Naming, structure, dead code
- **Testing**: Missing test coverage, edge cases

**Verdict**: Approve, Request Changes, or Comment — with rationale.

**Suggested Comments**: Specific inline feedback to post on the PR.`,
          },
        }],
      };
    },
  );
}