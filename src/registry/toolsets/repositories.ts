import type { ToolsetDefinition } from "../types.js";
import { fileContentGetExtract, passthrough } from "../extractors.js";
import { assertValidBase64 } from "../../utils/base64.js";
import { isRecord } from "../../utils/type-guards.js";

const COMMIT_ACTIONS_NEEDING_FILE_BYTES = new Set(["CREATE", "UPDATE"]);

function commitActionType(actionType: unknown): string {
  return typeof actionType === "string" ? actionType.toUpperCase() : "";
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

type ResolvedCommitPayload = { payload: string; encoding?: string };

/**
 * Agents often put file bytes on `content` / `text` because
 * `file_content` GET returns `content.text` / `content.data`. Harness Code
 * only persists `payload` — a missing UPDATE payload writes Git's empty blob
 * and wipes the file. Empty `payload` must not shadow those aliases.
 *
 * Not used for MOVE: Code treats MOVE payload as the destination path
 * (new path, optionally followed by NUL and replacement bytes), not file bytes.
 */
function resolveCommitActionPayload(action: Record<string, unknown>): ResolvedCommitPayload | undefined {
  const payload = nonEmptyString(action.payload);
  if (payload !== undefined) return { payload };

  const content = nonEmptyString(action.content);
  if (content !== undefined) return { payload: content };

  const text = nonEmptyString(action.text);
  if (text !== undefined) return { payload: text };

  const nested = isRecord(action.content) ? action.content : undefined;
  if (!nested) return undefined;

  const nestedText = nonEmptyString(nested.text);
  if (nestedText !== undefined) {
    return { payload: nestedText, encoding: nonEmptyString(nested.encoding) };
  }

  const nestedData = nonEmptyString(nested.data);
  if (nestedData !== undefined) {
    return { payload: nestedData, encoding: nonEmptyString(nested.encoding) ?? "base64" };
  }
  return undefined;
}

/**
 * Shape commit-file actions for Harness Code:
 * - copy `content`/`text` onto payload for CREATE/UPDATE when payload is empty
 * - reject omitted CREATE payload and empty UPDATE payload (that would wipe)
 * - leave MOVE/DELETE payload alone (MOVE payload is the destination path)
 * - validate and strip whitespace from `encoding: "base64"` payloads
 */
function buildCommitFilesBody(input: Record<string, unknown>): unknown {
  const body = input.body;
  if (!isRecord(body)) return body;
  const actions = body.actions;
  if (!Array.isArray(actions)) return body;

  const normalizedActions = actions.map((action, index) => {
    if (!isRecord(action)) return action;

    const field = `body.actions[${index}]`;
    const actionType = commitActionType(action.action);
    const next: Record<string, unknown> = { ...action };

    if (COMMIT_ACTIONS_NEEDING_FILE_BYTES.has(actionType)) {
      const resolved = resolveCommitActionPayload(action);
      delete next.content;
      delete next.text;
      if (resolved) {
        next.payload = resolved.payload;
        if (resolved.encoding !== undefined && nonEmptyString(next.encoding) === undefined) {
          next.encoding = resolved.encoding;
        }
      }

      if (actionType === "UPDATE" && (typeof next.payload !== "string" || next.payload.length === 0)) {
        throw new Error(
          `${field}.payload is required for UPDATE (file content). ` +
            `Pass payload, or content/text (aliases). An omitted payload commits an empty file.`,
        );
      }
      if (actionType === "CREATE" && typeof next.payload !== "string") {
        throw new Error(
          `${field}.payload is required for CREATE (file content). ` +
            `Pass payload, or content/text (aliases). An omitted payload commits an empty file.`,
        );
      }
    }

    if (next.encoding !== "base64" || typeof next.payload !== "string") {
      return next;
    }
    next.payload = assertValidBase64(next.payload, `${field}.payload`);
    return next;
  });

  return { ...body, actions: normalizedActions };
}

export const repositoriesToolset: ToolsetDefinition = {
  name: "repositories",
  displayName: "Code Repositories",
  description: "Harness Code repositories (source control)",
  resources: [
    {
      resourceType: "repository",
      displayName: "Repository",
      description:
        "Harness Code repository. Supports list, get, create, and update. Works at account, org, or project scope — omit org_id/project_id for account-scoped repos.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id"],
      listFilterFields: [
        { name: "query", description: "Search repositories by name or keyword" },
        { name: "sort", description: "Sort field" },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            query: "query",
            search_term: "query",
            sort: "sort",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List code repositories",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { repo_id: "repoIdentifier" },
          responseExtractor: passthrough,
          description: "Get repository details",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a new repository. Body fields: identifier (required), default_branch, description, is_public, readme, git_ignore, license.",
          bodySchema: {
            description: "New repository definition",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Repository identifier/name" },
              { name: "default_branch", type: "string", required: false, description: "Default branch name (default: main)" },
              { name: "description", type: "string", required: false, description: "Repository description" },
              { name: "is_public", type: "boolean", required: false, description: "Whether the repo is public" },
              { name: "readme", type: "boolean", required: false, description: "Initialize with a README" },
              { name: "git_ignore", type: "string", required: false, description: "Gitignore template name" },
              { name: "license", type: "string", required: false, description: "License template name" },
            ],
          },
        },
        update: {
          method: "PATCH",
          path: "/code/api/v1/repos/{repoIdentifier}",
          operationPolicy: { risk: "low_write", retryPolicy: "safe" },
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Update a repository. Body fields: description, default_branch, is_public.",
          bodySchema: {
            description: "Repository update fields",
            fields: [
              { name: "description", type: "string", required: false, description: "Repository description" },
              { name: "default_branch", type: "string", required: false, description: "Default branch name" },
              { name: "is_public", type: "boolean", required: false, description: "Whether the repo is public" },
            ],
          },
        },
      },
    },
    {
      resourceType: "branch",
      displayName: "Branch",
      description:
        "Git branch in a Harness Code repository. Supports list, get, create, and delete.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "branch_name"],
      listFilterFields: [
        { name: "query", description: "Search branches by name or keyword" },
        { name: "sort", description: "Sort field" },
        { name: "order", description: "Sort order (asc/desc)" },
      ],
      deepLinkTemplate:
        "/ng/account/{accountId}/module/code/orgs/{orgIdentifier}/projects/{projectIdentifier}/repos/{repoIdentifier}/files/{branchName}",
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/branches",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            query: "query",
            sort: "sort",
            order: "order",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List branches in a repository",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/branches/{branchName}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            branch_name: "branchName",
          },
          responseExtractor: passthrough,
          description: "Get branch details including latest commit",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/branches",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a new branch. Body fields: name (required), target (required — commit SHA or branch name to branch from).",
          bodySchema: {
            description: "New branch definition",
            fields: [
              { name: "name", type: "string", required: true, description: "New branch name" },
              { name: "target", type: "string", required: true, description: "Source commit SHA or branch name to create from" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/repos/{repoIdentifier}/branches/{branchName}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            branch_name: "branchName",
          },
          responseExtractor: passthrough,
          description: "Delete a branch from the repository",
        },
      },
    },
    {
      resourceType: "commit",
      displayName: "Commit",
      description:
        "Git commit in a Harness Code repository. Supports list, get, and create. Use create to commit file changes (CREATE, UPDATE, DELETE, MOVE) directly via the API without cloning.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "commit_sha"],
      listFilterFields: [
        { name: "git_ref", description: "Git reference (branch/tag) filter" },
        { name: "path", description: "File path filter" },
        { name: "since", description: "Filter commits since date" },
        { name: "until", description: "Filter commits until date" },
        { name: "committer", description: "Filter by committer" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/commits",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            git_ref: "git_ref",
            path: "path",
            since: "since",
            until: "until",
            committer: "committer",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description:
            "List commits in a repository. Filter by git_ref (branch/tag), path, date range, or committer.",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/commits/{commitSha}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            commit_sha: "commitSha",
          },
          responseExtractor: passthrough,
          description: "Get commit details by SHA",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/commits",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { repo_id: "repoIdentifier" },
          skipScopeBodyInjection: true,
          bodyBuilder: buildCommitFilesBody,
          responseExtractor: passthrough,
          description:
            "Commit file changes to a repository. Each action is CREATE, UPDATE, DELETE, or MOVE. For CREATE/UPDATE, file bytes go in payload (utf8 or base64); content/text and file_content GET content.text/content.data are aliases. CREATE and UPDATE require payload (omitted UPDATE is rejected because Code would write an empty file; CREATE may pass payload: '' for an empty file). MOVE payload is the destination path, not file bytes. For UPDATE, include the current blob sha. Returns the new commit_id and list of changed files.",
          bodySchema: {
            description:
              "Commit with one or more file actions. branch is the target branch, message is the commit message, actions is the list of file operations.",
            fields: [
              { name: "title", type: "string", required: true, description: "Commit title (first line of commit message)" },
              { name: "message", type: "string", required: false, description: "Extended commit message body" },
              { name: "branch", type: "string", required: true, description: "Target branch to commit to (e.g. 'main')" },
              { name: "new_branch", type: "string", required: false, description: "If set, creates a new branch from 'branch' and commits there instead" },
              { name: "actions", type: "array", required: true, description: "File operations. Each action: {action: 'CREATE'|'UPDATE'|'DELETE'|'MOVE', path: 'file/path', payload: 'CREATE/UPDATE: file bytes (required; content or text aliases are copied onto payload; empty string allowed only for CREATE). MOVE: destination path. DELETE: omit.', encoding: 'utf8'|'base64' (default utf8 — set explicitly for binary content, payload must then be valid base64), sha: 'blob_sha (required for UPDATE)'}." },
              { name: "bypass_rules", type: "boolean", required: false, description: "Bypass branch protection rules (requires permission)" },
              { name: "dry_run_rules", type: "boolean", required: false, description: "Check rules without committing" },
            ],
          },
        },
      },
      executeActions: {
        diff: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/diff/{range}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            range: "range",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get the raw diff between two refs. Set range to 'base..head' (e.g., 'main..feature-branch').",
          bodySchema: { description: "No body required. Diff range is specified via path parameter (e.g. main..feature-branch).", fields: [] },
        },
        diff_stats: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/diff-stats/{range}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            range: "range",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get diff stats (files changed, additions, deletions) between two refs. Set range to 'base..head'.",
          bodySchema: { description: "No body required. Range is specified via path parameter.", fields: [] },
        },
      },
    },
    {
      resourceType: "file_content",
      displayName: "File Content",
      description:
        "File or directory content from a Harness Code repository. Supports get. Use execute action 'blame' for git blame.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "path"],
      listFilterFields: [],
      operations: {
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/content/{filePath}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            path: "filePath",
          },
          queryParams: {
            org_id: "orgIdentifier",
            project_id: "projectIdentifier",
            git_ref: "git_ref",
            include_commit: "include_commit",
          },
          responseExtractor: fileContentGetExtract,
          description:
            "Get file or directory content. Specify path and optional git_ref (branch/tag/SHA). Returns file content or directory listing. For files, content.text holds the decoded text and content.encoding is set to 'utf8' when decoding succeeds; content.data (raw base64) and encoding 'base64' are kept only for binary/undecodable content. content._truncated is set if the server's 10 MB cap cut off the file; content._hint explains truncation, binary content, or Git LFS pointers.",
        },
      },
      executeActions: {
        blame: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/blame/{filePath}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            path: "filePath",
          },
          queryParams: {
            org_id: "orgIdentifier",
            project_id: "projectIdentifier",
            git_ref: "git_ref",
            line_from: "line_from",
            line_to: "line_to",
          },
          responseExtractor: passthrough,
          actionDescription:
            "Get git blame for a file. Optional line_from/line_to to restrict range.",
          bodySchema: { description: "No body required. File path and optional line range specified via path/query parameters.", fields: [] },
        },
      },
    },
    {
      resourceType: "tag",
      displayName: "Tag",
      description:
        "Git tag in a Harness Code repository. Supports list, create, and delete.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "tag_name"],
      listFilterFields: [
        { name: "query", description: "Search tags by name or keyword" },
        { name: "sort", description: "Sort field" },
        { name: "order", description: "Sort order (asc/desc)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/tags",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            query: "query",
            sort: "sort",
            order: "order",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description: "List tags in a repository",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/tags",
          operationPolicy: { risk: "low_write", retryPolicy: "do_not_retry" },
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description:
            "Create a tag. Body fields: name (required), target (required — commit SHA), message (optional — for annotated tags).",
          bodySchema: {
            description: "New tag definition",
            fields: [
              { name: "name", type: "string", required: true, description: "Tag name" },
              { name: "target", type: "string", required: true, description: "Commit SHA to tag" },
              { name: "message", type: "string", required: false, description: "Tag message (creates annotated tag)" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/repos/{repoIdentifier}/tags/{tagName}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            tag_name: "tagName",
          },
          responseExtractor: passthrough,
          description: "Delete a tag from the repository",
        },
      },
    },
    {
      resourceType: "repo_rule",
      displayName: "Repository Protection Rule",
      description:
        "Branch/tag/push protection rule for a Harness Code repository. Supports list, get, create, update, and delete. Rules define merge requirements, status checks, and code-owner approvals. Create/update/delete require user confirmation.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["repo_id", "rule_id"],
      listFilterFields: [
        { name: "query", description: "Filter rules by name or keyword" },
        { name: "sort", description: "Sort field (created_at, identifier, updated_at)" },
        { name: "order", description: "Sort order (asc/desc)" },
        { name: "type", description: "Filter by rule type: branch, tag, or push" },
        { name: "inherited", description: "Include rules inherited from parent spaces (true/false)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/rules",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: { repo_id: "repoIdentifier" },
          queryParams: {
            query: "query",
            sort: "sort",
            order: "order",
            type: "type",
            inherited: "inherited",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description:
            "List protection rules for a repository. Filter by type (branch/tag/push), sort, or keyword.",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/repos/{repoIdentifier}/rules/{ruleIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            rule_id: "ruleIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get a specific protection rule by identifier",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/repos/{repoIdentifier}/rules",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          pathParams: { repo_id: "repoIdentifier" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a protection rule for a repository. Requires user confirmation.",
          bodySchema: {
            description: "Protection rule definition. Use harness_get on an existing rule to see the full structure.",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Rule identifier (alphanumeric, hyphens, underscores, dots)" },
              { name: "type", type: "string", required: true, description: "Rule type: branch, tag, or push" },
              { name: "state", type: "string", required: true, description: "Rule state: active, disabled, or monitor" },
              { name: "description", type: "string", required: false, description: "Rule description" },
              { name: "pattern", type: "object", required: false, description: "Branch/tag pattern. Use {default: true} for default branch, or {include: ['pattern'], exclude: ['pattern']} with globstar patterns" },
              { name: "definition", type: "object", required: true, description: "Rule definition with bypass, pullreq, and lifecycle sections" },
            ],
          },
        },
        update: {
          method: "PATCH",
          path: "/code/api/v1/repos/{repoIdentifier}/rules/{ruleIdentifier}",
          operationPolicy: { risk: "high_write", retryPolicy: "safe" },
          pathParams: {
            repo_id: "repoIdentifier",
            rule_id: "ruleIdentifier",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a protection rule. Only include fields you want to change. Requires user confirmation.",
          bodySchema: {
            description: "Partial rule update. Only provided fields are changed.",
            fields: [
              { name: "state", type: "string", required: false, description: "Rule state: active, disabled, or monitor" },
              { name: "description", type: "string", required: false, description: "Rule description" },
              { name: "pattern", type: "object", required: false, description: "Branch/tag pattern" },
              { name: "definition", type: "object", required: false, description: "Rule definition — see create operation for full structure" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/repos/{repoIdentifier}/rules/{ruleIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            repo_id: "repoIdentifier",
            rule_id: "ruleIdentifier",
          },
          responseExtractor: passthrough,
          description: "Delete a protection rule from the repository",
        },
      },
    },
    {
      resourceType: "space_rule",
      displayName: "Space Protection Rule",
      description:
        "Project/org/account-level protection rule that applies across all repositories in a space. Supports list, get, create, update, and delete. Use repo_rule for per-repository rules. Create/update/delete require user confirmation. Scope: project (default), org, or account — omit project_id for org-level, omit both for account-level.",
      toolset: "repositories",
      scope: "account",
      scopeOptional: true,
      identifierFields: ["rule_id"],
      listFilterFields: [
        { name: "query", description: "Filter rules by name or keyword" },
        { name: "sort", description: "Sort field (created_at, identifier, updated_at)" },
        { name: "order", description: "Sort order (asc/desc)" },
        { name: "type", description: "Filter by rule type: branch, tag, or push" },
        { name: "inherited", description: "Include rules inherited from parent spaces (true/false)" },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/code/api/v1/rules",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            query: "query",
            sort: "sort",
            order: "order",
            type: "type",
            inherited: "inherited",
            page: "page",
            limit: "limit",
          },
          responseExtractor: passthrough,
          description:
            "List protection rules at the project/org/account level. These apply across all repos in the space.",
        },
        get: {
          method: "GET",
          path: "/code/api/v1/rules/{ruleIdentifier}",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          pathParams: {
            rule_id: "ruleIdentifier",
          },
          responseExtractor: passthrough,
          description: "Get a specific space-level protection rule by identifier",
        },
        create: {
          method: "POST",
          path: "/code/api/v1/rules",
          operationPolicy: { risk: "medium_write", retryPolicy: "do_not_retry" },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Create a project/org/account-level protection rule. Requires user confirmation.",
          bodySchema: {
            description: "Protection rule definition. Use harness_get on an existing rule to see the full structure.",
            fields: [
              { name: "identifier", type: "string", required: true, description: "Rule identifier (alphanumeric, hyphens, underscores, dots)" },
              { name: "type", type: "string", required: true, description: "Rule type: branch, tag, or push" },
              { name: "state", type: "string", required: true, description: "Rule state: active, disabled, or monitor" },
              { name: "description", type: "string", required: false, description: "Rule description" },
              { name: "pattern", type: "object", required: false, description: "Branch/tag pattern. Use {default: true} for default branch, or {include: ['pattern'], exclude: ['pattern']}" },
              { name: "definition", type: "object", required: true, description: "Rule definition with bypass, pullreq, and lifecycle sections" },
            ],
          },
        },
        update: {
          method: "PATCH",
          path: "/code/api/v1/rules/{ruleIdentifier}",
          operationPolicy: { risk: "high_write", retryPolicy: "safe" },
          pathParams: {
            rule_id: "ruleIdentifier",
          },
          bodyBuilder: (input) => input.body,
          responseExtractor: passthrough,
          description: "Update a space-level protection rule. Only include fields you want to change. Requires user confirmation.",
          bodySchema: {
            description: "Partial rule update. Only provided fields are changed.",
            fields: [
              { name: "state", type: "string", required: false, description: "Rule state: active, disabled, or monitor" },
              { name: "description", type: "string", required: false, description: "Rule description" },
              { name: "pattern", type: "object", required: false, description: "Branch/tag pattern" },
              { name: "definition", type: "object", required: false, description: "Rule definition — see create operation for full structure" },
            ],
          },
        },
        delete: {
          method: "DELETE",
          path: "/code/api/v1/rules/{ruleIdentifier}",
          operationPolicy: { risk: "destructive", retryPolicy: "do_not_retry" },
          pathParams: {
            rule_id: "ruleIdentifier",
          },
          responseExtractor: passthrough,
          description: "Delete a space-level protection rule",
        },
      },
    },
  ],
};
