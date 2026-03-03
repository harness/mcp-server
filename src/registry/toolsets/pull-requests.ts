import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const pullRequestsToolset: ToolsetDefinition = {
  name: "pull-requests",
  displayName: "Pull Requests",
  description:
    "Harness Code pull requests, reviews, comments, checks, and activities",
  resources: [
    {
      resourceType: "pull_request",
      displayName: "Pull Request",
      description:
        "Code pull request. Supports list, get, create, and update. Use execute actions for merge.",
      toolset: "pull-requests",
      scope: "project",
      identifierFields: ["repo_id", "pr_number"],
      listFilterFields: ["state", "query"],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}/pull-requests/{prNumber}",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq",
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            state: "state",
            query: "query",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List pull requests for a repository",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          responseExtractor: passthrough,
          description: "Get pull request details",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq",
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a pull request. Body fields: title (required), source_branch (required), target_branch (required), description.",
          bodySchema: {
            description: "New pull request",
            fields: [
              { name: "title", type: "string", required: true, description: "PR title" },
              { name: "source_branch", type: "string", required: true, description: "Source branch name" },
              { name: "target_branch", type: "string", required: true, description: "Target branch name" },
              { name: "description", type: "string", required: false, description: "PR description (markdown)" },
            ],
          },
        },
        update: {
          method: "PATCH",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Update a pull request. Body fields: title, description, state (open/closed).",
          bodySchema: {
            description: "Pull request update fields",
            fields: [
              { name: "title", type: "string", required: false, description: "Updated PR title" },
              { name: "description", type: "string", required: false, description: "Updated PR description" },
              { name: "state", type: "string", required: false, description: "PR state: open or closed" },
            ],
          },
        },
      },
      executeActions: {
        merge: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/merge",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          actionDescription:
            "Merge a pull request. Body fields: method (merge/squash/rebase/fast-forward), source_sha, delete_source_branch (boolean), dry_run (boolean).",
        },
      },
    },
    {
      resourceType: "pr_reviewer",
      displayName: "PR Reviewer",
      description:
        "Reviewers on a pull request. Supports list and create (add reviewer). Use execute action 'submit_review' to approve or request changes.",
      toolset: "pull-requests",
      scope: "project",
      identifierFields: ["repo_id", "pr_number"],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/reviewers",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          responseExtractor: passthrough,
          description: "List reviewers assigned to a pull request",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/reviewers",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Add a reviewer to a pull request. Body fields: reviewer_id (required).",
          bodySchema: {
            description: "Reviewer to add",
            fields: [
              { name: "reviewer_id", type: "number", required: true, description: "User ID of the reviewer to add" },
            ],
          },
        },
      },
      executeActions: {
        submit_review: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/reviews",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          actionDescription:
            "Submit a review decision. Body fields: decision (required — 'approved' or 'changereq'), commit_sha (optional — SHA reviewed against).",
        },
      },
    },
    {
      resourceType: "pr_comment",
      displayName: "PR Comment",
      description:
        "Comments on a pull request. Supports list and create.",
      toolset: "pull-requests",
      scope: "project",
      identifierFields: ["repo_id", "pr_number"],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/comments",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          responseExtractor: passthrough,
          description: "List comments on a pull request",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/comments",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Add a comment to a pull request. Body fields: text (required). For inline code comments, also include: path, line_new/line_old, source_commit_sha, target_commit_sha.",
          bodySchema: {
            description: "PR comment content",
            fields: [
              { name: "text", type: "string", required: true, description: "Comment text (markdown supported)" },
              { name: "path", type: "string", required: false, description: "File path for inline code comment" },
              { name: "line_new", type: "number", required: false, description: "Line number in new file for inline comment" },
              { name: "line_old", type: "number", required: false, description: "Line number in old file for inline comment" },
              { name: "source_commit_sha", type: "string", required: false, description: "Source commit SHA for code comment context" },
              { name: "target_commit_sha", type: "string", required: false, description: "Target commit SHA for code comment context" },
            ],
          },
        },
      },
    },
    {
      resourceType: "pr_check",
      displayName: "PR Check",
      description: "Status checks on a pull request. Supports list.",
      toolset: "pull-requests",
      scope: "project",
      identifierFields: ["repo_id", "pr_number"],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/checks",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          responseExtractor: passthrough,
          description: "List status checks for a pull request",
        },
      },
    },
    {
      resourceType: "pr_activity",
      displayName: "PR Activity",
      description:
        "Activity timeline on a pull request (comments, reviews, status changes). Supports list.",
      toolset: "pull-requests",
      scope: "project",
      identifierFields: ["repo_id", "pr_number"],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/activities",
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          responseExtractor: passthrough,
          description: "List activities for a pull request",
        },
      },
    },
  ],
};
