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
      searchAliases: ["approve", "reject", "promote", "waiver", "exception", "exempt", "approval"],
      description: "Security issue exemption/waiver. THIS is the resource for ALL approve/reject/promote operations — even when the user mentions a vulnerability title like 'SQL Injection'. Supports list (POST with status filter) with approve/reject/promote actions. " +
        "IMPORTANT: When listing exemptions, NEVER override org_id or project_id — always use the configured defaults. " +
        "Phrases like 'for org' or 'for account' refer to the APPROVAL SCOPE (passed as body.scope to the execute action), NOT as an org_id filter for listing. " +
        "PAGINATION CONTRACT: (1) Pass `size: 5` explicitly inside `filters` for the first call — the recommended default for this resource is 5, not the global 20. (2) Page is 0-indexed: page=0 → items 1–5, page=1 → items 6–10. (3) CRITICAL — `size` AND all other filters (status, search, …) MUST stay identical across every page in a session. The backend computes offset = page × size, so altering either silently shifts the dataset. (4) For 'next N' requests, increment `page` by 1 and keep `size` constant. If the user asks for 'next 10' after showing 5, make TWO sequential calls with the same size=5 — do NOT bump size mid-session. (5) After each response, read `_nextPageHint` — it spells out the exact follow-up call to make.",
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
            // Strip scope keywords that LLMs mistakenly pass as org_id/project_id
            // (e.g. "approve for org" → org_id="org"). These are never valid
            // Harness identifiers — real IDs are alphanumeric slugs or UUIDs.
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
        "'approve for account' / 'account-wide' / 'promote to account' → 'ACCOUNT'; " +
        "'promote to project' → 'PROJECT'.",
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
