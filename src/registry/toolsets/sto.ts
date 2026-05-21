import type { ToolsetDefinition } from "../types.js";
import { passthrough, stoExemptionsExtract } from "../extractors.js";
import type { HarnessClient } from "../../client/harness-client.js";

/**
 * Injects a redirect hint into every security_issue list response.
 * When the LLM lands here while trying to approve/reject an exemption, it sees
 * the hint in the response and pivots to security_exemption on the next call.
 */
const securityIssueListExtract = (raw: unknown): unknown => {
  const base = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    ...base,
    _action_hint:
      "If the user asked to APPROVE, REJECT, or PROMOTE an exemption — even by mentioning a CVE or package name — " +
      "STOP using this resource. " +
      "The correct workflow is: " +
      "(1) harness_list(resource_type='security_exemption', filters={status:'Pending', search:'<keyword from user prompt>'}). " +
      "(2) Get the exemption_id from _action_id_by_row. " +
      "(3) harness_execute(resource_type='security_exemption', action='approve', resource_id=<exemption_id>, body={scope:'CURRENT'|'ORG'|'ACCOUNT'|'PROJECT'}).",
  };
};

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
        "STOP — IF THE USER WANTS TO APPROVE, REJECT, OR PROMOTE AN EXEMPTION, USE resource_type='security_exemption' INSTEAD. " +
        "This 'security_issue' resource only lists raw vulnerabilities from scans — it has NO approve/reject/promote actions. " +
        "Security vulnerability/issue from scan results. Supports list with extensive filtering by severity, type, target, pipeline, and scan tool.",
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
          preflight: async ({ input }) => {
            // LLMs sometimes pass scope keywords as literal org_id/project_id
            // values (e.g. "approve for org" → org_id="org"). These are never
            // valid Harness identifiers, so strip them and fall back to config
            // defaults rather than letting the request fail with a confusing 500.
            const SCOPE_KEYWORDS = new Set(["org", "account", "project", "organization"]);
            if (typeof input.org_id === "string" && SCOPE_KEYWORDS.has(input.org_id.toLowerCase())) {
              delete input.org_id;
            }
            if (typeof input.project_id === "string" && SCOPE_KEYWORDS.has(input.project_id.toLowerCase())) {
              delete input.project_id;
            }
          },
          responseExtractor: securityIssueListExtract,
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
      searchAliases: ["approve", "reject", "promote", "waiver", "exception", "exempt", "approval"],
      description: "Security issue exemption/waiver. THIS is the resource for ALL approve/reject/promote operations — even when the user mentions a vulnerability title like 'SQL Injection'. Supports list (POST with status filter) with approve/reject/promote actions. " +
        "CRITICAL SCOPE DISTINCTION: There are TWO different scope concepts that must NOT be confused: " +
        "(1) LISTING scope — security_exemption ALWAYS lists at project scope. NEVER pass resource_scope='account' or resource_scope='org' to harness_list — it will fail. Always list using project defaults. " +
        "(2) APPROVAL scope — the scope the exemption is approved AT, passed as body.scope to harness_execute. This CAN be 'ACCOUNT', 'ORG', 'PROJECT', or 'CURRENT'. " +
        "If harness_list returns an error about 'account scope not supported', that means you passed resource_scope='account' to the LIST call — NOT that account-level approval is impossible. Fix: remove resource_scope from the list call, keep project defaults, then approve with body={scope:'ACCOUNT'}. " +
        "IMPORTANT: When listing exemptions, NEVER pass resource_scope, org_id, or project_id overrides. " +
        "Phrases like 'for org' or 'for account' refer to the APPROVAL SCOPE (body.scope on execute), NOT to resource_scope or org_id on list. " +
        "PAGINATION CONTRACT: (1) Pass `size: 5` explicitly inside `filters` for the first call — the recommended default for this resource is 5, not the global 20. (2) Page is 0-indexed: page=0 → items 1–5, page=1 → items 6–10. (3) CRITICAL — `size` AND all other filters (status, search, …) MUST stay identical across every page in a session. The backend computes offset = page × size, so altering either silently shifts the dataset. (4) For 'next N' requests, increment `page` by 1 and keep `size` constant. If the user asks for 'next 10' after showing 5, make TWO sequential calls with the same size=5 — do NOT bump size mid-session. (5) After each response, read `_nextPageHint` — it spells out the exact follow-up call to make.",
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["exemption_id"],
      listFilterFields: [
        { name: "status", description: "Exemption status filter — SINGLE value only, not comma-separated. Make separate calls for each status.", enum: ["Pending", "Approved", "Rejected", "Expired", "Canceled"], required: true },
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
            // Security exemptions ALWAYS list at project scope.
            // Strip resource_scope='account'/'org' silently — these are
            // approval scope intents (for harness_execute), not list scopes.
            // Without this, the registry rejects the call with "account scope
            // not supported" which causes the LLM to forget the user's
            // original account-level approval intent and fall back to CURRENT.
            const wideScopes = new Set(["account", "org", "organization"]);
            if (typeof input.resource_scope === "string" && wideScopes.has(input.resource_scope.toLowerCase())) {
              delete input.resource_scope;
            }

            const SCOPE_KEYWORDS = new Set(["org", "account", "project", "organization"]);
            const rawOrg = input.org_id;
            if (typeof rawOrg === "string" && SCOPE_KEYWORDS.has(rawOrg.toLowerCase())) {
              delete input.org_id;
            }
            const rawProject = input.project_id;
            if (typeof rawProject === "string" && SCOPE_KEYWORDS.has(rawProject.toLowerCase())) {
              delete input.project_id;
            }

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
          description: "List security exemptions filtered by status. ALWAYS uses project scope — NEVER pass resource_scope='account' or resource_scope='org', it will fail. 'For account' / 'for org' are approval scopes for harness_execute, not list scopes. Recommended `size`: 5 (pass explicitly via `filters` — the shared default of 20 is too large for this resource). Response includes items[], total, page, pageSize, totalPages and `_nextPageHint`. ALWAYS read `_nextPageHint` — it spells out the exact follow-up call, including all active filters. NEVER re-use the same page for a 'next' request, NEVER drop filters between pages, and NEVER change size mid-session.",
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
          // pathBuilder dynamically picks /approve vs /promote based on body.scope.
          // 'CURRENT' (or missing) → /approve; anything else → /promote.
          pathBuilder: (input) => {
            const exemptionId = encodeURIComponent(String(input.exemption_id ?? ""));
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            const scope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();
            const elevating = scope && scope !== "CURRENT";
            const endpoint = elevating ? "promote" : "approve";
            return `/sto/api/v2/exemptions/${exemptionId}/${endpoint}`;
          },
          preflight: async ({ client, input }) => {
            const b = ((input.body as Record<string, unknown> | undefined) ?? {});
            const rawScope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();

            if (!rawScope) {
              throw new Error(
                "security_exemption approve: body.scope is required. " +
                "Pass one of: 'CURRENT' (approve at the exemption's existing scope) | 'ORG' | 'ACCOUNT' | 'PROJECT' (elevate + approve). " +
                "If the user said plain 'approve this exemption', pass body={scope:'CURRENT'}. " +
                "If the user said 'approve for org' / 'org-wide', pass body={scope:'ORG'}. " +
                "If the user said 'approve for account' / 'account-wide', pass body={scope:'ACCOUNT'}.",
              );
            }
            const allowed = ["CURRENT", "ACCOUNT", "ORG", "PROJECT"] as const;
            if (!(allowed as readonly string[]).includes(rawScope)) {
              throw new Error(
                `security_exemption approve: invalid scope '${rawScope}'. Must be one of: ${allowed.join(", ")}.`,
              );
            }

            if (rawScope === "ACCOUNT") {
              input.org_id = "";
              input.project_id = "";
            } else if (rawScope === "ORG") {
              input.project_id = "";
            }

            const harnessClient = client as unknown as HarnessClient;
            if (!b.approver_id) {
              b.approver_id = await harnessClient.getCurrentUserId();
              input.body = b;
            }
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            const rawScope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();
            const elevating = rawScope && rawScope !== "CURRENT";
            return {
              approverId: b.approver_id,
              ...(elevating ? { scope: rawScope } : {}),
              ...(b.comment ? { comment: b.comment } : {}),
            };
          },
          responseExtractor: passthrough,
          actionDescription:
        "Approve a security exemption. body.scope is REQUIRED — pick one of: " +
        "'CURRENT' (approve at the exemption's existing scope, no elevation), " +
        "'ORG' (elevate + approve at organization scope), " +
        "'ACCOUNT' (elevate + approve at account scope), " +
        "'PROJECT' (elevate + approve at project scope, only valid when source is TARGET/PIPELINE). " +
        "MAPPING — scan the user's prompt and pick scope accordingly: " +
        "plain 'approve this' → 'CURRENT'; " +
        "'approve for org' / 'org-wide' / 'at org level' → 'ORG'; " +
        "'approve for account' / 'account-wide' / 'account level' → 'ACCOUNT'; " +
        "'promote to project' → 'PROJECT'. " +
        "IMPORTANT: If harness_list returned an error saying 'account scope not supported', that error was about the LIST call scope — it does NOT mean account-level approval is impossible. " +
        "The listing always uses project scope; the approval scope (body.scope) is independent and CAN be 'ACCOUNT'.",
          bodySchema: {
            // scope is REQUIRED at the call layer (enforced by preflight with a fail-loud
            // error), but declared required:false here because bodySchema validates the
            // BUILT body — and the bodyBuilder strips scope='CURRENT' from the wire payload
            // (the /approve endpoint doesn't accept scope). Preflight is authoritative.
            description: "Exemption approval details. body.scope is REQUIRED (validated by preflight).",
            fields: [
              { name: "scope",       type: "string", required: false, description: "REQUIRED (enforced by preflight). One of: 'CURRENT' | 'ORG' | 'ACCOUNT' | 'PROJECT'. Use 'CURRENT' to approve at the exemption's existing scope. Use ORG/ACCOUNT/PROJECT to elevate (calls the /promote endpoint internally). MUST be passed on every call." },
              { name: "approver_id", type: "string", required: false, description: "User UUID of the approver. Auto-derived from the authenticated PAT via /ng/api/user/currentUser if omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional approval comment" },
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
      },
    },
  ],
};
