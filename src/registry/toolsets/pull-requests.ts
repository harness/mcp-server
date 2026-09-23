import type { HarnessClientInterface, ParamsSchema, PreflightContext, ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

const REPO_PARAMS: ParamsSchema = {
  fields: [
    { name: "repo_id", required: true, description: "Repository slug (e.g. \"my-repo\"). Use repo_id, not repo_identifier." },
  ],
};

const REPO_PR_PARAMS: ParamsSchema = {
  fields: [
    { name: "repo_id", required: true, description: "Repository slug (e.g. \"my-repo\"). Use repo_id, not repo_identifier." },
    { name: "pr_number", required: true, description: "Pull request number" },
  ],
};

const PR_COMMENT_PARAMS: ParamsSchema = {
  fields: [
    ...REPO_PR_PARAMS.fields,
    { name: "comment_id", required: true, description: "Pull request activity/comment ID" },
  ],
};

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

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const PR_METADATA_FIELDS = ["title", "description"];

interface MergeBodyField {
  wire: string;
  aliases?: readonly string[];
}

const PR_MERGE_BODY_FIELDS: readonly MergeBodyField[] = [
  { wire: "method" },
  { wire: "source_sha", aliases: ["sourceSha"] },
  { wire: "delete_source_branch", aliases: ["deleteSourceBranch"] },
  { wire: "dry_run", aliases: ["dryRun"] },
  { wire: "dry_run_rules", aliases: ["dryRunRules"] },
  { wire: "message" },
  { wire: "title" },
  { wire: "bypass_rules", aliases: ["bypassRules"] },
  { wire: "bypass_message", aliases: ["bypassMessage"] },
];

function fieldValue(
  source: Record<string, unknown> | undefined,
  names: readonly string[],
): { key: string; value: unknown } | undefined {
  if (!source) return undefined;
  for (const name of names) {
    if (source[name] !== undefined) {
      return { key: name, value: source[name] };
    }
  }
  return undefined;
}

/**
 * harness_execute's `params` argument flattens onto the top-level input, while
 * `body` stays nested — a bodyBuilder that only reads input.body misses fields
 * an agent passed via params, and (since the required-field check is gated on
 * a truthy body) silently sends an empty POST instead of erroring.
 */
function liftBodyFields(
  input: Record<string, unknown>,
  fields: readonly MergeBodyField[],
  actionLabel: string,
): Record<string, unknown> {
  const body = bodyRecord(input);
  const merged: Record<string, unknown> = {};

  for (const field of fields) {
    const names = [field.wire, ...(field.aliases ?? [])];
    const bodyValue = fieldValue(body, names);
    const inputValue = fieldValue(input, names);
    if (bodyValue && inputValue && !Object.is(bodyValue.value, inputValue.value)) {
      throw new Error(
        `Conflicting ${actionLabel} values for "${field.wire}" between ` +
        `body.${bodyValue.key} and params/top-level ${inputValue.key}.`,
      );
    }
    const selected = bodyValue ?? inputValue;
    if (selected) {
      merged[field.wire] = selected.value;
    }
  }

  return merged;
}

function pullRequestMergeBody(input: Record<string, unknown>): Record<string, unknown> {
  return liftBodyFields(input, PR_MERGE_BODY_FIELDS, "pull_request.merge");
}

const PR_SUBMIT_REVIEW_BODY_FIELDS: readonly MergeBodyField[] = [
  { wire: "decision" },
  { wire: "commit_sha", aliases: ["commitSha"] },
];

function submitReviewBody(input: Record<string, unknown>): Record<string, unknown> {
  return liftBodyFields(input, PR_SUBMIT_REVIEW_BODY_FIELDS, "pr_reviewer.submit_review");
}

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
  if (!state) return input.body;
  const body = bodyRecord(input);
  const isDraft = body?.is_draft;
  if (isDraft === undefined) {
    throw new Error(
      "is_draft is required when changing PR state. " +
      "The backend resets draft status to false when is_draft is omitted. " +
      "First GET the pull request to read its current is_draft value, then include it in the state change.",
    );
  }
  return { state, is_draft: isDraft };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function scalarString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/** Positive integer reviewer_id. Non-numeric identifiers are resolved separately. */
function numericReviewerId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return undefined;
}

interface ReviewerUserInfo {
  id?: number;
  uid?: string;
  email?: string;
  display_name?: string;
}

function reviewerUsersFromRaw(raw: unknown): ReviewerUserInfo[] {
  return Array.isArray(raw) ? raw as ReviewerUserInfo[] : [];
}

function emailFromUserAggregateRaw(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const envelope = raw as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object"
    ? envelope.data as Record<string, unknown>
    : envelope;
  const user = data.user && typeof data.user === "object"
    ? data.user as Record<string, unknown>
    : data;
  return scalarString(user.email ?? data.email);
}

async function lookupReviewerIdByEmail(
  client: HarnessClientInterface,
  email: string,
  signal?: AbortSignal,
): Promise<number> {
  const raw = await client.request<unknown>({
    method: "GET",
    path: "/code/api/v1/principals",
    params: { query: email, type: "user", limit: 50 },
    signal,
  });
  const users = reviewerUsersFromRaw(raw);
  const needle = email.toLowerCase();
  const exactEmail = users.filter((p) => scalarString(p.email)?.toLowerCase() === needle);
  const matches = exactEmail.length > 0
    ? exactEmail
    : users.filter((p) => scalarString(p.uid)?.toLowerCase() === needle);
  if (matches.length === 0) {
    throw new Error(
      `No reviewer found for email "${email}". Confirm the address with harness_list(resource_type="user") and retry with body.reviewer_email.`,
    );
  }
  if (matches.length > 1) {
    const listed = matches
      .map((p) => `${p.display_name ?? p.email} <${p.email}>`)
      .join("; ");
    throw new Error(
      `Multiple users matched email "${email}": ${listed}. Pass reviewer_id from harness_list(resource_type="pr_reviewer") for the intended person.`,
    );
  }
  const id = matches[0]?.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    throw new Error(`Could not resolve a reviewer_id for "${email}".`);
  }
  return id;
}

/** Numeric reviewer_id wins; otherwise resolve reviewer_email or account user id to reviewer_id. */
async function resolvePrReviewerCreate({ client, input, signal }: PreflightContext): Promise<void> {
  const body = bodyRecord(input) ?? {};
  const numericId = numericReviewerId(body.reviewer_id ?? input.reviewer_id);
  if (numericId !== undefined) {
    input.body = { reviewer_id: numericId };
    return;
  }

  const email = scalarString(body.reviewer_email ?? input.reviewer_email);
  const uidOrEmail = scalarString(
    body.reviewer_uid ?? input.reviewer_uid ?? body.reviewer_id ?? input.reviewer_id,
  );

  let resolvedEmail = email;
  if (!resolvedEmail && uidOrEmail && EMAIL_RE.test(uidOrEmail)) {
    resolvedEmail = uidOrEmail;
  }
  if (!resolvedEmail && uidOrEmail) {
    let raw: unknown;
    try {
      raw = await client.request<unknown>({
        method: "GET",
        path: `/ng/api/user/aggregate/${encodeURIComponent(uidOrEmail)}`,
        signal,
      });
    } catch {
      throw new Error(
        `"${uidOrEmail}" is not a valid reviewer_id. Pass reviewer_email, or a numeric reviewer_id from harness_list(resource_type="pr_reviewer").`,
      );
    }
    resolvedEmail = emailFromUserAggregateRaw(raw);
    if (!resolvedEmail) {
      throw new Error(
        `User "${uidOrEmail}" has no email. Pass reviewer_email instead.`,
      );
    }
  }

  if (!resolvedEmail) {
    throw new Error(
      "pr_reviewer.create requires reviewer_email (preferred) or a numeric reviewer_id.",
    );
  }

  const id = await lookupReviewerIdByEmail(client, resolvedEmail, signal);
  input.body = { reviewer_id: id };
}

function prReviewerCreateBody(input: Record<string, unknown>): { reviewer_id: number } {
  const id = numericReviewerId(bodyRecord(input)?.reviewer_id);
  if (id === undefined) {
    throw new Error("pr_reviewer.create is missing reviewer_id.");
  }
  return { reviewer_id: id };
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
        "Code pull request. Supports list, get, create, and update. Use execute actions for close and merge. Works at account, org, or project scope — pass org_id/project_id for the space the repo lives in; omit both for account-scoped repos.",
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
          pageOneIndexed: true,
          queryParams: {
            state: "state",
            query: "query",
            search_term: "query",
            page: "page",
            limit: "limit",
            size: "limit",
          },
          responseExtractor: passthrough,
          description: "List pull requests for a repository",
          paramsSchema: REPO_PARAMS,
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
          paramsSchema: REPO_PR_PARAMS,
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a pull request",
          paramsSchema: REPO_PARAMS,
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
            "Update a pull request. State changes use the dedicated Harness Code PR state endpoint.",
          paramsSchema: REPO_PR_PARAMS,
          bodySchema: {
            description: "Pull request update fields",
            fields: [
              { name: "title", type: "string", required: false, description: "Updated PR title" },
              { name: "description", type: "string", required: false, description: "Updated PR description" },
              { name: "state", type: "string", required: false, description: "PR state: open or closed. Requires is_draft when provided." },
              { name: "is_draft", type: "boolean", required: false, description: "Required when changing state. GET the PR first and pass its current is_draft value to prevent silent reset." },
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
          bodyBuilder: (input) => {
            const body = bodyRecord(input);
            const isDraft = body?.is_draft;
            if (isDraft === undefined) {
              throw new Error(
                "is_draft is required when closing a PR. " +
                "The backend resets draft status to false when is_draft is omitted. " +
                "First GET the pull request to read its current is_draft value, then include it here.",
              );
            }
            return { state: "closed", is_draft: isDraft };
          },
          responseExtractor: passthrough,
          paramsSchema: REPO_PR_PARAMS,
          actionDescription:
            "Close a pull request. Requires is_draft in the body to prevent silent draft-status reset. GET the PR first to read its current is_draft value.",
          bodySchema: {
            description: "Close pull request state transition",
            fields: [
              { name: "is_draft", type: "boolean", required: true, description: "Current draft status of the PR. GET the PR first and pass its is_draft value to prevent silent reset." },
            ],
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
          skipScopeBodyInjection: true,
          bodyBuilder: pullRequestMergeBody,
          responseExtractor: passthrough,
          paramsSchema: REPO_PR_PARAMS,
          actionDescription:
            "Merge a pull request. GET the PR first and pass its source_sha. Body fields: method (merge/squash/rebase/fast-forward), source_sha (required), delete_source_branch (boolean), dry_run (boolean), dry_run_rules (boolean), message, title, bypass_rules (boolean), bypass_message.",
          bodySchema: {
            description: "Merge options",
            fields: [
              { name: "method", type: "string", required: false, description: "Merge method: merge, squash, rebase, or fast-forward" },
              { name: "source_sha", type: "string", required: true, description: "Expected source SHA for optimistic locking. GET the PR first and pass its source_sha value — the backend rejects a stale value with 'A newer commit is available. Only the latest commit can be merged.'" },
              { name: "delete_source_branch", type: "boolean", required: false, description: "Delete source branch after merge" },
              { name: "dry_run", type: "boolean", required: false, description: "Simulate merge without executing" },
              { name: "dry_run_rules", type: "boolean", required: false, description: "Evaluate rules during a dry run" },
              { name: "message", type: "string", required: false, description: "Merge commit message" },
              { name: "title", type: "string", required: false, description: "Merge commit title" },
              { name: "bypass_rules", type: "boolean", required: false, description: "Bypass merge rules when allowed" },
              { name: "bypass_message", type: "string", required: false, description: "Reason for bypassing merge rules" },
            ],
          },
        },
      },
    },
    {
      resourceType: "pr_reviewer",
      displayName: "PR Reviewer",
      description:
        "Reviewers on a pull request. Supports list and create (add reviewer). Prefer body.reviewer_email from harness_list(user). Numeric reviewer_id from an existing reviewer list also works. Use execute action 'submit_review' to approve or request changes. Works at account, org, or project scope — pass org_id/project_id for the space the repo lives in; omit both for account-scoped repos.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number"],
      diagnosticHint:
        "To add a reviewer, pass body.reviewer_email from harness_list(resource_type=\"user\"). harness_list(user) identifier/uuid is not reviewer_id. If you already listed reviewers on the PR, you may pass that numeric reviewer_id instead.",
      relatedResources: [
        {
          resourceType: "user",
          relationship: "identity",
          description:
            "Look up the reviewer with harness_list(resource_type=\"user\", search_term=<name or email>), then pass the returned email as pr_reviewer body.reviewer_email.",
        },
      ],
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
          paramsSchema: REPO_PR_PARAMS,
        },
        create: {
          method: "PUT",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/reviewers",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          skipScopeBodyInjection: true,
          preflight: resolvePrReviewerCreate,
          bodyBuilder: prReviewerCreateBody,
          responseExtractor: passthrough,
          description:
            "Add a reviewer to a pull request. Prefer reviewer_email. Numeric reviewer_id from an existing reviewer list also works and wins if both are set.",
          paramsSchema: REPO_PR_PARAMS,
          bodySchema: {
            description: "Reviewer to add. Provide reviewer_email (preferred) or numeric reviewer_id.",
            fields: [
              {
                name: "reviewer_email",
                type: "string",
                required: false,
                description: "Reviewer email from harness_list(user). Preferred.",
              },
              {
                name: "reviewer_id",
                type: "number",
                required: false,
                description:
                  "Numeric reviewer id from harness_list(resource_type=\"pr_reviewer\"). Optional. Do not use harness_list(user) identifier/uuid here — use reviewer_email.",
              },
              {
                name: "reviewer_uid",
                type: "string",
                required: false,
                description:
                  "Account user identifier from harness_list(user). Prefer reviewer_email when you have it.",
              },
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
          bodyBuilder: submitReviewBody,
          responseExtractor: passthrough,
          paramsSchema: REPO_PR_PARAMS,
          actionDescription:
            "Submit a review decision. GET the PR first and pass its source_sha as commit_sha. Body fields: decision (required — 'approved', 'changereq', or 'reviewed'), commit_sha (required — SHA reviewed against).",
          bodySchema: {
            description: "Review decision",
            fields: [
              { name: "decision", type: "string", required: true, description: "Review decision: approved, changereq, or reviewed (comment-only, no approve/reject)" },
              { name: "commit_sha", type: "string", required: true, description: "Commit SHA reviewed against. GET the PR first and pass its source_sha value here." },
            ],
          },
        },
      },
    },
    {
      resourceType: "pr_comment",
      displayName: "PR Comment",
      description:
        "Create, update, or delete comments on a pull request. To READ/LIST comments, use pr_activity with kind=comment. Works at account, org, or project scope — pass org_id/project_id for the space the repo lives in; omit both for account-scoped repos.",
      toolset: "pull-requests",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "pr_number", "comment_id"],
      diagnosticHint:
        "The pr_comment resource is for comment writes. To list or read comments, use harness_list with resource_type='pr_activity' and filters: {type: ['comment', 'code-comment']}.",
      operations: {
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/pullreq/{prNumber}/comments",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            pr_number: "prNumber",
          },
          bodyBuilder: (input) => {
            const b = { ...(input.body as Record<string, unknown>) };
            const lineNew = toFiniteNumber(b.line_new);
            const lineOld = toFiniteNumber(b.line_old);
            if (lineNew !== undefined) {
              b.line_start = lineNew;
              b.line_end = lineNew;
              b.line_start_new = true;
              b.line_end_new = true;
              delete b.line_new;
            } else if (lineOld !== undefined) {
              b.line_start = lineOld;
              b.line_end = lineOld;
              b.line_start_new = false;
              b.line_end_new = false;
              delete b.line_old;
            }
            return b;
          },
          responseExtractor: passthrough,
          description:
            "Add a comment to a pull request. Body fields: text (required). For inline PR comments, also include: path, line_new OR line_old (line number on the new or old side of the diff), source_commit_sha, target_commit_sha.",
          paramsSchema: REPO_PR_PARAMS,
          bodySchema: {
            description: "PR comment content",
            fields: [
              { name: "text", type: "string", required: true, description: "Comment text (markdown supported)" },
              { name: "path", type: "string", required: false, description: "File path for inline code comment" },
              { name: "line_new", type: "number", required: false, description: "Line number in the new file version for inline comment (mutually exclusive with line_old)" },
              { name: "line_old", type: "number", required: false, description: "Line number in the old file version for inline comment (mutually exclusive with line_new)" },
              { name: "source_commit_sha", type: "string", required: false, description: "Source commit SHA (HEAD of source branch) for code comment context" },
              { name: "target_commit_sha", type: "string", required: false, description: "Target/merge-base commit SHA for code comment context" },
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
          paramsSchema: PR_COMMENT_PARAMS,
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
          paramsSchema: PR_COMMENT_PARAMS,
        },
      },
    },
    {
      resourceType: "pr_check",
      displayName: "PR Check",
      description:
        "Status checks on a pull request. Supports list. Works at account, org, or project scope — pass org_id/project_id for the space the repo lives in; omit both for account-scoped repos.",
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
          pageOneIndexed: true,
          responseExtractor: passthrough,
          description: "List status checks for a pull request",
          paramsSchema: REPO_PR_PARAMS,
        },
      },
    },
    {
      resourceType: "pr_activity",
      displayName: "PR Activity",
      description:
        "Activity timeline on a pull request (comments, reviews, status changes). Omit filters to return the full PR activity timeline. Works at account, org, or project scope — pass org_id/project_id for the space the repo lives in; omit both for account-scoped repos.",
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
        "To list all PR comments, use filters: {type: ['comment', 'code-comment']}. For general comments only, use {type: 'comment'} or {kind: 'comment'}. For inline PR comments, use {type: 'code-comment'} or {kind: 'change-comment'}.",
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
            size: "limit",
          },
          responseExtractor: passthrough,
          description: "List activities for a pull request. Omit filters to return the full PR activity timeline.",
          paramsSchema: REPO_PR_PARAMS,
        },
      },
    },
  ],
};
