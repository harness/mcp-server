import type { ToolsetDefinition } from "../types.js";
import { passthrough, stoExemptionsExtract } from "../extractors.js";
import type { HarnessClient } from "../../client/harness-client.js";

/**
 * STO scope override — STO API uses accountId / orgId / projectId
 * instead of the standard NG accountIdentifier / orgIdentifier / projectIdentifier.
 *
 * NOTE: The STO gateway may have auth limitations with x-api-key PATs.
 * If auth errors occur, this may be a Harness platform limitation,
 * not an MCP server issue.
 */
const STO_SCOPE = { account: "accountId", org: "orgId", project: "projectId" } as const;

export const stoToolset: ToolsetDefinition = {
  name: "sto",
  displayName: "Security Testing Orchestration",
  description:
    "Harness STO — security issues, vulnerabilities, and exemptions",
  resources: [
    // ── Security Issues ────────────────────────────────────────────────
    {
      resourceType: "security_issue",
      displayName: "Security Issue",
      description:
        "Security vulnerability/issue from scan results. Supports list with extensive filtering.",
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["issue_id"],
      listFilterFields: [
        { name: "search", description: "Free-text search (issue ID, CVE, component name, keyword)" },
        { name: "severity_codes", description: "Comma-separated severity levels", enum: ["Critical", "High", "Medium", "Low", "Info"] },
        { name: "issue_types", description: "Comma-separated issue types", enum: ["SAST", "DAST", "SCA", "IAC", "SECRET", "MISCONFIG"] },
        { name: "target_ids", description: "Comma-separated target IDs" },
        { name: "target_types", description: "Comma-separated target types", enum: ["configuration", "container", "instance", "repository"] },
        { name: "pipeline_ids", description: "Comma-separated pipeline IDs" },
        { name: "scan_tools", description: "Comma-separated scan tools (e.g. aqua-trivy, semgrep)" },
        { name: "exemption_statuses", description: "Comma-separated statuses", enum: ["None", "Pending", "Approved", "Rejected", "Expired"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/issues/{issueId}",
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/all-issues/issues",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            search: "search",
            severity_codes: "severityCodes",
            issue_types: "issueTypes",
            target_ids: "targetIds",
            target_types: "targetTypes",
            pipeline_ids: "pipelineIds",
            scan_tools: "scanTools",
            exemption_statuses: "exemptionStatuses",
            page: "page",
            size: "pageSize",
          },
          responseExtractor: passthrough,
          description: "List security issues with filtering by severity, type, target, pipeline, and scan tool",
        },
      },
    },

    // ── Security Issue Filters ─────────────────────────────────────────
    {
      resourceType: "security_issue_filter",
      displayName: "Security Issue Filter",
      description:
        "Available filter values (targets, scan tools, pipelines) for security issues. Use this to discover valid filter values before listing issues.",
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/all-issues/filters",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            page: "page",
            size: "pageSize",
          },
          responseExtractor: passthrough,
          description: "Get available filter values for security issues (targets, scan tools, pipelines)",
        },
      },
    },

    // ── Security Exemptions ────────────────────────────────────────────
    {
      resourceType: "security_exemption",
      displayName: "Security Exemption",
      description: "Security issue exemption/waiver. Supports list (POST with status filter) with approve/reject/promote actions. PAGINATION CONTRACT: (1) Pass `size: 5` explicitly inside `filters` for the first call — the recommended default for this resource is 5, not the global 20. (2) Page is 0-indexed: page=0 → items 1–5, page=1 → items 6–10. (3) CRITICAL — `size` AND all other filters (status, search, …) MUST stay identical across every page in a session. The backend computes offset = page × size, so altering either silently shifts the dataset. (4) For 'next N' requests, increment `page` by 1 and keep `size` constant. If the user asks for 'next 10' after showing 5, make TWO sequential calls with the same size=5 — do NOT bump size mid-session. (5) After each response, read `_nextPageHint` — it spells out the exact follow-up call to make.",
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["exemption_id"],
      listFilterFields: [
        { name: "status", description: "Exemption status filter", enum: ["Pending", "Approved", "Rejected", "Expired", "Canceled"], required: true },
        { name: "search", description: "Free-text search for issue/exemption titles" },
        { name: "size", type: "number", description: "Exemptions per page (recommended: 5, max: 50). Always pass explicitly inside `filters` — `harness_list`'s global default of 20 is too large for this resource. Must remain constant across pages in a session." },
        { name: "page", type: "number", description: "0-indexed page number. Increment by 1 for each 'next' request — never repeat the same value." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/exemptions",
      operations: {
        list: {
          method: "POST",
          path: "/sto/api/v2/frontend/exemptions",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            status: "status",
            search: "search",
            page: "page",
            size: "pageSize",
          },
          bodyBuilder: () => ({}),
          preflight: async ({ input }) => {
            // Fail-loud validation only — no silent rewriting of caller-supplied
            // values. The shared `harness_list` tool already applies Zod
            // defaults; this preflight enforces STO-specific BOUNDS and rejects
            // invalid inputs so misuse surfaces immediately instead of being
            // papered over (Cursor review feedback).
            const STO_EXEMPTION_SIZE_MAX = 50;
            const rawSize = input.size;
            if (rawSize !== undefined) {
              if (typeof rawSize !== "number" || !Number.isInteger(rawSize)) {
                throw new Error(`security_exemption: 'size' must be an integer, got ${typeof rawSize}.`);
              }
              if (rawSize < 1) {
                throw new Error(`security_exemption: 'size' must be >= 1, got ${rawSize}.`);
              }
              if (rawSize > STO_EXEMPTION_SIZE_MAX) {
                throw new Error(`security_exemption: 'size' must be <= ${STO_EXEMPTION_SIZE_MAX}, got ${rawSize}.`);
              }
            }
            const rawPage = input.page;
            if (rawPage !== undefined) {
              if (typeof rawPage !== "number" || !Number.isInteger(rawPage)) {
                throw new Error(`security_exemption: 'page' must be an integer, got ${typeof rawPage}.`);
              }
              if (rawPage < 0) {
                throw new Error(`security_exemption: 'page' must be >= 0 (0-indexed), got ${rawPage}.`);
              }
            }
          },
          responseExtractor: stoExemptionsExtract,
          skipCompact: true,
          description: "List security exemptions filtered by status. Recommended `size`: 5 (pass explicitly via `filters` — the shared default of 20 is too large for this resource). Response includes items[], total, page, pageSize, totalPages and `_nextPageHint`. ALWAYS read `_nextPageHint` — it spells out the exact follow-up call, including all active filters. NEVER re-use the same page for a 'next' request, NEVER drop filters between pages, and NEVER change size mid-session.",
        },
        create: {
          method: "POST",
          path: "/sto/api/v2/exemptions",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: async ({ client, input }) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};
            // Validate required fields here against raw input (snake_case) rather
            // than relying on the generic registry check which runs on the built body.
            const requiredFields = ["issue_id", "type", "reason"] as const;
            const missing = requiredFields.filter(f => body[f] === undefined);
            if (missing.length > 0) {
              throw new Error(
                `Missing required fields for security_exemption: ${missing.join(", ")}. ` +
                `Use harness_describe(resource_type="security_exemption") to see the schema.`
              );
            }
            const harnessClient = client as unknown as HarnessClient;
            body.requester_id = await harnessClient.getCurrentUserId();
            input.body = body;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              issueId: b.issue_id,
              type: b.type,
              reason: b.reason,
              requesterId: b.requester_id,
              exemptFutureOccurrences: true,
              pendingChanges: { durationDays: b.duration_days ?? 30 },
              ...(b.occurrences ? { occurrences: b.occurrences } : {}),
              ...(b.scan_id ? { scanId: b.scan_id } : {}),
              ...(b.pipeline_id ? { pipelineId: b.pipeline_id } : {}),
              ...(b.target_id ? { targetId: b.target_id } : {}),
              ...(b.search ? { search: b.search } : {}),
              ...(b.link ? { link: b.link } : {}),
              ...(b.expiration ? { expiration: b.expiration } : {}),
            };
          },
          responseExtractor: passthrough,
          description: "Create a new security exemption for an issue. requesterId is always derived from the authenticated PAT and exemptFutureOccurrences is always true.",
          bodySchema: {
            description: "Exemption creation fields. Required: issue_id, type, reason.",
            fields: [
              { name: "issue_id", type: "string", required: false, description: "REQUIRED. Issue ID to exempt (22-char Harness ID)." },
              { name: "type", type: "string", required: false, description: "REQUIRED. Exemption type: Compensating Controls | Acceptable Use | Acceptable Risk | False Positive | Fix Unavailable | Other." },
              { name: "reason", type: "string", required: false, description: "REQUIRED. Text justification for the exemption (max 1024 chars)." },
              { name: "duration_days", type: "number", required: false, description: "Exemption duration in days (default: 30)." },
              { name: "occurrences", type: "array", required: false, description: "Specific occurrence IDs (integers) to exempt.", itemType: "number" },
              { name: "scan_id", type: "string", required: false, description: "Scan ID — exempts all occurrences in that scan." },
              { name: "pipeline_id", type: "string", required: false, description: "Pipeline ID scope. Use with org/project scope." },
              { name: "target_id", type: "string", required: false, description: "Target ID scope. Cannot be combined with pipeline scope fields." },
              { name: "search", type: "string", required: false, description: "Search filter for issue occurrences (e.g. component/CWE expressions)." },
              { name: "link", type: "string", required: false, description: "Related ticket or reference URL." },
              { name: "expiration", type: "number", required: false, description: "Unix timestamp at which this exemption expires." },
            ],
          },
        },
      },
      executeActions: {
        approve: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/approve",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { exemption_id: "exemptionId" },
          preflight: async ({ client, input }) => {
            const harnessClient = client as unknown as HarnessClient;
            const body = ((input.body as Record<string, unknown> | undefined) ?? {});
            if (!body.approver_id) {
              body.approver_id = await harnessClient.getCurrentUserId();
            }
            input.body = body;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              approverId: b.approver_id,
              ...(b.comment ? { comment: b.comment } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription:
            "Approve a security exemption AT ITS CURRENT SCOPE (PROJECT, PIPELINE, or TARGET — whichever scope the requester created it at). Does NOT change the exemption's scope. This is the default for routine 'approve this exemption' requests. The STO backend uses your project-level RBAC for PROJECT/PIPELINE/TARGET exemptions, so the orgId+projectId from config defaults (or overridden via top-level org_id/project_id) is sufficient. " +
            "ROUTING — when NOT to use this action: any user phrasing that names a target scope different from the exemption's current scope is a PROMOTION, NOT an approval. Examples that MUST route to the 'promote' action instead (not this one): " +
            "'approve to org scope', 'approve at account level', 'approve org-wide', 'approve account-wide', 'approve for the whole org', 'approve at ACCOUNT', 'elevate to ORG and approve', 'promote and approve to project' (from a PIPELINE/TARGET exemption), 'make this exemption org-wide and approve', 'approve this account-level'. " +
            "If the user mentions ACCOUNT, ORG, or 'whole org/account' anywhere in the same sentence as the approval, call 'promote' with the corresponding target_scope — do NOT call this 'approve' action with overridden org_id/project_id as a workaround.",
          bodySchema: {
            description:
              "Exemption approval details. Approves at the exemption's existing scope; does not change scope.",
            fields: [
              { name: "approver_id", type: "string", required: false, description: "User UUID of the approver. Auto-derived from the authenticated PAT via /ng/api/user/currentUser when omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional approval comment (max 1024 chars)." },
            ],
          },
        },
        reject: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/reject",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { exemption_id: "exemptionId" },
          preflight: async ({ client, input }) => {
            const harnessClient = client as unknown as HarnessClient;
            const body = ((input.body as Record<string, unknown> | undefined) ?? {});
            if (!body.approver_id) {
              body.approver_id = await harnessClient.getCurrentUserId();
              input.body = body;
            }
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            return {
              approverId: b.approver_id,
              ...(b.comment ? { comment: b.comment } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription: "Reject a security exemption. approver_id is auto-derived from the authenticated user when not supplied.",
          bodySchema: {
            description: "Exemption rejection details",
            fields: [
              { name: "approver_id", type: "string", required: false, description: "User UUID of the rejector. Auto-derived from the authenticated PAT via /ng/api/user/currentUser if omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional rejection comment" },
            ],
          },
        },
        promote: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/promote",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          pathParams: { exemption_id: "exemptionId" },
          // NOTE: PromoteExemption does NOT read pipelineId/targetId from the URL.
          // The goa-generated decoder only reads accountId/orgId/projectId from the
          // query string; pipelineId/targetId live in the request body. We therefore
          // do not declare queryParams here — the backend derives the new scope from
          // (a) whether orgId/projectId are present on the URL and (b) whether
          // pipelineId/targetId are present in the body. See
          // sto-core/internal/services/exemptions/exemptions_service.go:957-969.
          preflight: async ({ client, input }) => {
            const b = ((input.body as Record<string, unknown> | undefined) ?? {});

            // target_scope is REQUIRED. Fail loud rather than silently defaulting
            // to PROJECT (the latter was the root cause of the "promote to ORG
            // landed at PROJECT" hallucinations the STO team reported).
            const rawScope = b.target_scope ?? b.scope ?? input.target_scope ?? input.scope;
            if (rawScope === undefined || rawScope === null || rawScope === "") {
              throw new Error(
                "security_exemption promote: 'target_scope' is required in body. " +
                "Valid values: 'ACCOUNT' | 'ORG' | 'PROJECT'. " +
                "Use 'PROJECT' only when promoting from PIPELINE- or TARGET-scoped exemptions. " +
                "For same-scope approval, use the 'approve' action instead.",
              );
            }
            if (typeof rawScope !== "string") {
              throw new Error(
                `security_exemption promote: 'target_scope' must be a string, got ${typeof rawScope}.`,
              );
            }
            const targetScope = rawScope.toUpperCase();
            const allowed = ["ACCOUNT", "ORG", "PROJECT"] as const;
            if (!(allowed as readonly string[]).includes(targetScope)) {
              throw new Error(
                `security_exemption promote: invalid target_scope '${rawScope}'. ` +
                `Must be one of: ${allowed.join(", ")}. ` +
                "PIPELINE and TARGET are exemption SOURCE scopes only; they cannot be promote destinations.",
              );
            }

            // Map target_scope → URL scope params. The STO backend infers the new
            // scope from which of orgId/projectId are present on the URL:
            //   neither            → ACCOUNT
            //   orgId only         → ORG
            //   orgId + projectId  → PROJECT
            // Setting the registry input to "" overrides any HARNESS_ORG / HARNESS_PROJECT
            // config default (nullish coalescing only short-circuits null/undefined), and
            // harness-client.buildUrl skips params whose value is "" — so the URL param
            // is omitted entirely.
            if (targetScope === "ACCOUNT") {
              input.org_id = "";
              input.project_id = "";
            } else if (targetScope === "ORG") {
              input.project_id = "";
              // org_id is left untouched so the registry injects it from input or config.
            }
            // PROJECT: nothing to override — registry injects both org_id and project_id.

            const harnessClient = client as unknown as HarnessClient;
            if (!b.approver_id) {
              b.approver_id = await harnessClient.getCurrentUserId();
            }
            input.body = b;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            // The backend's PromoteExemptionRequestBody accepts approverId, comment,
            // pendingChangesOverride, pipelineId, targetId — it does NOT accept a
            // 'scope' field (scope is derived from URL params). pipelineId/targetId
            // are intentionally omitted here: this MCP exposes promote only for
            // ACCOUNT/ORG/PROJECT elevations, which never need them.
            return {
              approverId: b.approver_id,
              ...(b.comment ? { comment: b.comment } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription:
            "Approve a security exemption AND elevate its scope in one step. Valid target_scope values: 'ACCOUNT' | 'ORG' | 'PROJECT'. Allowed elevations (enforced by the STO backend via canApproveFor): " +
            "PROJECT → ORG, ACCOUNT;  PIPELINE → PROJECT, ORG, ACCOUNT;  TARGET → PROJECT, ORG, ACCOUNT. " +
            "PIPELINE and TARGET are source scopes only — they cannot be promote destinations. " +
            "ROUTING — when to use this action: ANY user phrasing that names ACCOUNT or ORG as the target, OR names PROJECT when the exemption is currently PIPELINE/TARGET-scoped. Examples that MUST route here (not to 'approve'): " +
            "'approve to org scope' → target_scope='ORG';  'approve at account level' / 'approve account-wide' → target_scope='ACCOUNT';  'elevate to ORG and approve' → target_scope='ORG';  'make this exemption org-wide and approve' → target_scope='ORG';  'promote to project and approve' (from a PIPELINE/TARGET exemption) → target_scope='PROJECT'. " +
            "For same-scope approval (no scope change), use the 'approve' action instead — do NOT call promote with the exemption's existing scope. " +
            "approver_id is auto-derived from the authenticated PAT when omitted. " +
            "Backend returns 403 if the caller lacks RBAC for the requested target_scope.",
          bodySchema: {
            description:
              "Exemption promotion details. Approves the exemption AND changes its scope to target_scope. " +
              "NOTE: target_scope is a CONTROL field (used by preflight to set URL scope params) — it is NOT sent to the backend body. " +
              "It is therefore declared required:false at this schema layer (which validates HTTP body fields), but the preflight throws loudly if it is missing or invalid.",
            fields: [
              // target_scope is required-in-spirit but required:false here because the registry's
              // generic bodySchema validator checks the BUILT body (after bodyBuilder strips
              // control fields). Our preflight is the authoritative validator for target_scope.
              { name: "target_scope", type: "string", required: false, description: "REQUIRED (enforced by preflight, not by this schema). Target scope to elevate to: 'ACCOUNT' | 'ORG' | 'PROJECT'. Case-insensitive on input; normalized to upper-case before validation. Use 'PROJECT' only when the source exemption is PIPELINE- or TARGET-scoped. Omitting this field causes the preflight to throw immediately with a fail-loud error message." },
              { name: "approver_id",  type: "string", required: false, description: "User UUID of the approver. Auto-derived from the authenticated PAT via /ng/api/user/currentUser when omitted." },
              { name: "comment",      type: "string", required: false, description: "Optional comment recorded in exemption history (max 1024 chars)." },
            ],
          },
        },
      },
    },
  ],
};
