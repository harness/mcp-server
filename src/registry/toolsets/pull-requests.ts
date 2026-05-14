import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

function bodyRecord(input: Record<string, unknown>): Record<string, unknown> | undefined {
  const body = input.body;
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : undefined;
}

function pullRequestState(input: Record<string, unknown>): "open" | "closed" | undefined {
  const state = bodyRecord(input)?.state;
  return state === "open" || state === "closed" ? state : undefined;
}

function requiredPathPart(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (value === undefined || value === "") {
    throw new Error(`Missing required field "${field}" for pull_request.`);
  }
  return encodeURIComponent(String(value));
}

const PR_METADATA_FIELDS = ["title", "description"];

function pullRequestUpdatePath(input: Record<string, unknown>): string {
  const repoIdentifier = requiredPathPart(input, "repo_id");
  const prNumber = requiredPathPart(input, "pr_number");
  const state = pullRequestState(input);
  if (state) {
    rejectMixedStateUpdate(input);
    return `/code/api/v1/repos/${repoIdentifier}/pullreq/${prNumber}/state`;
  }
  return `/code/api/v1/repos/${repoIdentifier}/pullreq/${prNumber}`;
}

function rejectMixedStateUpdate(input: Record<string, unknown>): void {
  const body = bodyRecord(input);
  if (!body) return;
  const extras = PR_METADATA_FIELDS.filter((f) => body[f] !== undefined);
  if (extras.length > 0) {
    throw new Error(
      `Cannot combine state change with metadata fields (${extras.join(", ")}). ` +
      `Send state changes and metadata updates as separate harness_update calls.`,
    );
  }
}

function pullRequestUpdateBody(input: Record<string, unknown>): unknown {
  const state = pullRequestState(input);
  return state ? { state } : input.body;
}

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
        "Code pull request. Supports list, get, create, and update. Use execute actions for close and merge.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      listFilterFields: [
        { name: "state", description: "Pull request state filter", enum: ["open", "closed", "merged"] },
        { name: "query", description: "Search pull requests by keyword" },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}/pulls/{number}",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
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
          methodBuilder: (input) => pullRequestState(input) ? "POST" : "PATCH",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}",
          pathBuilder: pullRequestUpdatePath,
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: pullRequestUpdateBody,
          responseExtractor: passthrough,
          description:
            "Update a pull request. Body fields: title, description, state (open/closed). State changes use the dedicated Harness Code PR state endpoint.",
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
        close: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/state",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          skipScopeBodyInjection: true,
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: () => ({ state: "closed" }),
          responseExtractor: passthrough,
          actionDescription:
            "Close a pull request by setting its state to closed.",
          bodySchema: {
            description: "Close pull request state transition",
            fields: [],
          },
        },
        merge: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/merge",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body ?? {},
          responseExtractor: passthrough,
          actionDescription:
            "Merge a pull request. Body fields: method (merge/squash/rebase/fast-forward), source_sha, delete_source_branch (boolean), dry_run (boolean).",
          bodySchema: {
            description: "Merge options",
            fields: [
              { name: "method", type: "string", required: false, description: "Merge method: merge, squash, rebase, or fast-forward" },
              { name: "source_sha", type: "string", required: false, description: "Expected source SHA for optimistic locking" },
              { name: "delete_source_branch", type: "boolean", required: false, description: "Delete source branch after merge" },
              { name: "dry_run", type: "boolean", required: false, description: "Simulate merge without executing" },
            ],
          },
        },
      },
    },
    {
      resourceType: "pr_reviewer",
      displayName: "PR Reviewer",
      description:
        "Reviewers on a pull request. Supports list and create (add reviewer). Use execute action 'submit_review' to approve or request changes.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/reviewers",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
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
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          actionDescription:
            "Submit a review decision. Body fields: decision (required — 'approved' or 'changereq'), commit_sha (optional — SHA reviewed against).",
          bodySchema: {
            description: "Review decision",
            fields: [
              { name: "decision", type: "string", required: true, description: "Review decision: approved or changereq" },
              { name: "commit_sha", type: "string", required: false, description: "Commit SHA reviewed against" },
            ],
          },
        },
      },
    },
    {
      resourceType: "pr_comment",
      displayName: "PR Comment",
      description:
        "Create, update, or delete comments on a pull request. To READ/LIST comments, use pr_activity with kind=comment.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      diagnosticHint:
        "The Harness Code API does not support GET on the comments endpoint. To list or read comments, use harness_list with resource_type='pr_activity' and filters: {kind: 'comment'} or {type: 'comment'}.",
      operations: {
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/comments",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
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
        update: {
          method: "PATCH",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/comments/{pullreqCommentId}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
            comment_id: "pullreqCommentId",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Update an existing pull request comment. Body fields: text (required).",
          bodySchema: {
            description: "Updated comment content",
            fields: [
              { name: "text", type: "string", required: true, description: "Updated comment text (markdown supported)" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/comments/{pullreqCommentId}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
            comment_id: "pullreqCommentId",
          },
          responseExtractor: passthrough,
          description: "Delete a pull request comment",
        },
      },
    },
    {
      resourceType: "pr_check",
      displayName: "PR Check",
      description: "Status checks on a pull request. Supports list.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/checks",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
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
        "Activity timeline on a pull request (comments, reviews, status changes). This is the canonical way to READ comments — use kind=comment or type=comment to filter.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      listFilterFields: [
        { name: "kind", description: "Activity kind filter: change-comment, comment, system", enum: ["change-comment", "comment", "system"] },
        { name: "type", description: "Activity type filter: comment, code-comment, review-submit, reviewer-add, reviewer-delete, state-change, branch-update, branch-delete, branch-restore, merge, title-change, label-modify, target-branch-change, user-group-reviewer-add, user-group-reviewer-delete", enum: ["comment", "code-comment", "review-submit", "reviewer-add", "reviewer-delete", "state-change", "branch-update", "branch-delete", "branch-restore", "merge", "title-change", "label-modify", "target-branch-change", "user-group-reviewer-add", "user-group-reviewer-delete"] },
        { name: "after", description: "Only entries created at/after this timestamp (unix millis)", type: "number" },
        { name: "before", description: "Only entries created before this timestamp (unix millis)", type: "number" },
      ],
      diagnosticHint:
        "To list only comments, use filters: {kind: 'comment'}. For code review comments, use {type: 'code-comment'}. For all discussion, use {kind: 'comment'} which includes both general and code comments.",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/activities",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          queryParams: {
            kind: "kind",
            type: "type",
            after: "after",
            before: "before",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List activities for a pull request. Use kind=comment to get only comments. This is the only way to read PR comments (the /comments endpoint is POST-only).",
        },
      },
    },
  ],
};
