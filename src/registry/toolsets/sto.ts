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

    // ── Pipeline Security Issues (per-execution view) ─────────────────
    {
      resourceType: "pipeline_security_issue",
      displayName: "Pipeline Security Issue",
      description:
        "Security issues from STO's per-execution **Pipeline Security view** — the issues shown on a "
        + "specific pipeline execution's Security tab. Keyed by REQUIRED `execution_id`. Use this "
        + "(not `security_issue`, which is the cross-execution Issues page) when the user asks about "
        + "issues that caused a specific pipeline run to fail, or when correlating to a policy "
        + "evaluation. Response merges `existing` + `new` issue summaries into a single `items[]` "
        + "(each row tagged with `_partition`) and exposes per-partition counts + matching-step "
        + "metadata as side-channels. PAGINATION: this endpoint uses DIFF pagination — not standard "
        + "`page`/`size`. Use `page_existing` / `page_size_existing` (for the 'existing' partition) "
        + "and `page_new` / `page_size_new` (for the 'new' partition) independently. Each defaults to "
        + "page 0, size 50 (max 100). For most chat-driven workflows, calling once with both sizes "
        + "set to 100 returns the full page of each partition.",
      searchAliases: ["pipeline security", "execution issues", "security tab", "issues for execution", "issues that failed pipeline"],
      relatedResources: [
        { resourceType: "pipeline_security_step", relationship: "sibling", description: "REQUIRED when creating target-scoped exemptions: issue rows here only carry `targetVariantName` (a display string like 'repo:branch'), NOT a raw `target_id`. List pipeline_security_step for the same execution_id and join on `targetName:targetVariant === issue.targetVariantName` to resolve the raw `target_id` you need for harness_create body.target_id. Also used to attribute an issue to its source scanner." },
        { resourceType: "security_exemption", relationship: "child", description: "Create exemptions for issues from this view (one per issue_id). For target-scope, first resolve target_id via pipeline_security_step (see sibling above)." },
        { resourceType: "security_exemption_bulk", relationship: "child", description: "Bulk-create exemptions for many issues from this view in a single all-or-none transaction (≤100 items). For target-scope, pre-resolve target_id via pipeline_security_step." },
        { resourceType: "policy_evaluation", relationship: "sibling", description: "Find OPA policy evaluations that ran on the same execution_id to learn why the pipeline was denied." },
      ],
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["issue_id"],
      listFilterFields: [
        { name: "execution_id", description: "REQUIRED. Pipeline plan execution ID (e.g. 'ehsPKtczTRO5CUDAt-NR'). Identifies which execution's Pipeline Security view to read.", required: true },
        { name: "stages", description: "Comma-separated stage identifiers (or parent.stage). Narrows issues to specific pipeline stages." },
        { name: "steps", description: "Comma-separated step identifiers as 'stage.step' or 'parent.stage.step'. Narrows issues to specific scan steps (Trivy / Semgrep / …)." },
        { name: "target_ids", description: "Comma-separated 22-char target IDs." },
        { name: "target_types", description: "Comma-separated target types.", enum: ["repository", "container", "instance", "configuration"] },
        { name: "product_names", description: "Comma-separated scanner product names (e.g. 'owasp,zap')." },
        { name: "severity_codes", description: "Comma-separated severities.", enum: ["Critical", "High", "Medium", "Low", "Info"] },
        { name: "include_exempted", type: "boolean", description: "Include already-exempted issues. Defaults to true on the API; pass false when looking for unexempted candidates." },
        { name: "search", description: "Free-text search across issue title / CWE / CVE." },
        { name: "issue_types", description: "Comma-separated issue types.", enum: ["SAST", "DAST", "SCA", "IAC", "SECRET", "MISCONFIG", "BUG_SMELLS", "CODE_SMELLS", "CODE_COVERAGE", "EXTERNAL_POLICY", "UNKNOWN"] },
        { name: "status", description: "Comma-separated issue statuses.", enum: ["ACTIVE", "REMEDIATED", "PENDING_EXEMPTION", "EXEMPTED", "PARTIALLY_EXEMPTED", "REJECTED"] },
        { name: "origins", description: "Comma-separated origin layers.", enum: ["app", "base", "no_layer"] },
        { name: "origin_statuses", description: "Comma-separated origin statuses.", enum: ["approved", "unapproved"] },
        { name: "epss", description: "EPSS probability bucket (single select).", enum: ["all", "gte_15", "gte_5", "gte_1", "na"] },
        { name: "epss_percentile", description: "EPSS percentile bucket (single select).", enum: ["all", "gte_99", "gte_90", "gte_80", "na"] },
        { name: "severity_overridden", description: "Filter by whether severity was manually overridden.", enum: ["Yes", "No"] },
        { name: "reachability", description: "Reachability filter.", enum: ["reachable", "unknown-reachability"] },
        { name: "exploitability", description: "Exploitability filter.", enum: ["yes", "no"] },
        // Diff pagination — this endpoint paginates `existing` and `new` partitions independently.
        // See DiffPaginationRequestParams in sto-core/design/frontend.go.
        { name: "page_existing", type: "number", description: "0-indexed page number for the 'existing' issue partition (defaults to 0). The endpoint paginates existing and new issues independently — NOT a single combined cursor." },
        { name: "page_size_existing", type: "number", description: "Page size for the 'existing' partition (1–100, default 50)." },
        { name: "page_new", type: "number", description: "0-indexed page number for the 'new' issue partition (defaults to 0)." },
        { name: "page_size_new", type: "number", description: "Page size for the 'new' partition (1–100, default 50)." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/executions/{executionId}/pipeline",
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/pipeline-security/issues",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            execution_id: "executionId",
            stages: "stages",
            steps: "steps",
            target_ids: "targetIds",
            target_types: "targetTypes",
            product_names: "productNames",
            severity_codes: "severityCodes",
            include_exempted: "includeExempted",
            search: "search",
            issue_types: "issueTypes",
            status: "status",
            origins: "origins",
            origin_statuses: "originStatuses",
            epss: "epss",
            epss_percentile: "epssPercentile",
            severity_overridden: "severityOverridden",
            reachability: "reachability",
            exploitability: "exploitability",
            // Diff pagination — NOT standard page/pageSize. This endpoint splits
            // pagination between the 'existing' and 'new' partitions.
            page_existing: "pageExisting",
            page_size_existing: "pageSizeExisting",
            page_new: "pageNew",
            page_size_new: "pageSizeNew",
          },
          responseExtractor: (raw: unknown): unknown => {
            // Pipeline Security endpoint (sto-core PipelineSecurityIssuesResult) returns:
            //   { existing: { issues: [...], pagination: { totalItems, ... } },
            //     new:      { issues: [...], pagination: { totalItems, ... } },
            //     counts: {...}, matchingSteps: [...] }
            // NOTE: the partition payload key is `issues` (not `items`) and totals live
            // under `pagination.totalItems` (not a top-level `totalItems`). We flatten
            // existing+new into a single items[] for prompt consumption and preserve
            // the partitioned counts + matchingSteps as side-channels.
            if (raw === null || raw === undefined || typeof raw !== "object") return raw;
            type Partition = {
              issues?: unknown[];
              items?: unknown[]; // defensive: handle older or alternate shapes
              pagination?: { totalItems?: number };
              totalItems?: number; // defensive
            };
            const r = raw as {
              existing?: Partition;
              new?: Partition;
              counts?: unknown;
              matchingSteps?: unknown;
            };
            const partitionItems = (p: Partition | undefined): unknown[] => {
              if (!p) return [];
              if (Array.isArray(p.issues)) return p.issues;
              if (Array.isArray(p.items)) return p.items;
              return [];
            };
            const partitionTotal = (p: Partition | undefined, fallback: number): number => {
              if (!p) return fallback;
              if (typeof p.pagination?.totalItems === "number") return p.pagination.totalItems;
              if (typeof p.totalItems === "number") return p.totalItems;
              return fallback;
            };
            const existingItems = partitionItems(r.existing);
            const newItems = partitionItems(r.new);
            // Tag each row so the prompt can tell which partition it came from.
            const tagged = [
              ...existingItems.map(it => (typeof it === "object" && it !== null ? { ...it, _partition: "existing" } : it)),
              ...newItems.map(it => (typeof it === "object" && it !== null ? { ...it, _partition: "new" } : it)),
            ];
            const existingTotal = partitionTotal(r.existing, existingItems.length);
            const newTotal = partitionTotal(r.new, newItems.length);
            // Surface one-line breadcrumbs for the two IDs that are NOT on the
            // issue row but ARE required for narrower-scope exemptions. Without
            // these hints, agents spend multiple turns chasing the raw IDs
            // through unrelated endpoints (security_issue_filter, harness_get
            // on the issue, etc).
            const targetIdHint =
              "Each row carries `targetVariantName` (display string like 'repo:branch') but NOT a raw `target_id`. " +
              "For target-scoped exemptions, also call harness_list(resource_type='pipeline_security_step', " +
              "filters={execution_id:<same id>}) and join on `targetName:targetVariant === issue.targetVariantName` " +
              "to resolve the `target_id` you pass to harness_create body.target_id.";
            const pipelineIdHint =
              "Issue rows do NOT carry `pipeline_id` either. For pipeline-scoped exemptions: " +
              "(1) if a Harness pipeline execution URL was pasted, `pipeline_id` is already auto-extracted from the URL path; " +
              "(2) otherwise call harness_get(resource_type='execution', resource_id=<execution_id>) once and read `pipelineIdentifier`. " +
              "Do NOT iterate through harness_list(resource_type='pipeline') — the execution-to-pipeline link is 1:1.";
            return {
              items: tagged,
              total: existingTotal + newTotal,
              existing_total: existingTotal,
              new_total: newTotal,
              counts: r.counts,
              matching_steps: r.matchingSteps,
              _target_id_lookup_hint: targetIdHint,
              _pipeline_id_lookup_hint: pipelineIdHint,
            };
          },
          skipCompact: true,
          description: "List the security issues shown on a specific pipeline execution's Security tab. Requires execution_id. Flattens existing + new partitions into items[]; each item is tagged with _partition.",
        },
      },
    },

    // ── Pipeline Security Steps (scan steps for an execution) ─────────
    {
      resourceType: "pipeline_security_step",
      displayName: "Pipeline Security Scan Step",
      description:
        "STO scan steps (Trivy / Semgrep / Snyk / …) that ran inside a specific pipeline execution. "
        + "Use to attribute Pipeline Security issues to their source scanner, or to narrow a "
        + "`pipeline_security_issue` query by `steps`. Keyed by REQUIRED `execution_id`. Response also "
        + "carries `reachabilityFlag` / `exploitabilityFlag` indicating whether reachability or "
        + "exploitability analysis is available for this execution.",
      searchAliases: ["scan steps", "sto steps", "pipeline scan steps", "execution scan steps"],
      relatedResources: [
        { resourceType: "pipeline_security_issue", relationship: "sibling", description: "List issues for the same execution; filter by 'steps' to scope to one scanner." },
        { resourceType: "security_exemption", relationship: "sibling", description: "Use this resource to look up `target_id` when creating target-scoped exemptions: pipeline_security_issue rows expose `targetVariantName` (a display string) but not the raw `target_id`. Build a `{targetName:targetVariant → targetId}` map from this response and join against each issue row's `targetVariantName`." },
        { resourceType: "security_exemption_bulk", relationship: "sibling", description: "Same target_id lookup pattern when bulk-exempting from a specific execution." },
      ],
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      listFilterFields: [
        { name: "execution_id", description: "REQUIRED. Pipeline plan execution ID.", required: true },
      ],
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/frontend/pipeline-security/steps",
          operationPolicy: { risk: "read", retryPolicy: "safe" },
          queryParams: {
            execution_id: "executionId",
          },
          responseExtractor: (raw: unknown): unknown => {
            // Response: { steps: [...], reachabilityFlag: bool, exploitabilityFlag: bool }
            if (raw === null || raw === undefined || typeof raw !== "object") return raw;
            const r = raw as { steps?: unknown[]; reachabilityFlag?: boolean; exploitabilityFlag?: boolean };
            const steps = Array.isArray(r.steps) ? r.steps : [];
            return {
              items: steps,
              total: steps.length,
              reachability_flag: r.reachabilityFlag ?? false,
              exploitability_flag: r.exploitabilityFlag ?? false,
            };
          },
          skipCompact: true,
          description: "List STO scan steps that ran in a given pipeline execution. Use to map issues back to their source scanner.",
        },
      },
    },

    // ── Security Exemptions ────────────────────────────────────────────
    {
      resourceType: "security_exemption",
      displayName: "Security Exemption",
      searchAliases: ["approve", "reject", "promote", "waiver", "exception", "exempt", "approval"],
      description: "Security issue exemption/waiver. THIS is the resource for exemption approval/rejection workflows — even when the user mentions a vulnerability title like 'SQL Injection'. Supports list (POST with status filter), create, and approve/reject actions. Approval with body.scope='ACCOUNT', 'ORG', or 'PROJECT' routes through STO promotion internally. " +
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

    // ── Bulk Security Exemption Creation ───────────────────────────────
    // Wraps POST /sto/api/v2/exemptions/bulk. Modeled as its own resource
    // (rather than an executeAction on `security_exemption`) so the standard
    // `harness_create` dispatcher handles it without a new MCP tool.
    //
    // Semantics (per sto-core/docs/STO-8977-bulk-exemption-api.md): the bulk
    // endpoint is ALL-OR-NONE. If any item fails validation or insertion, the
    // whole batch is rolled back and every item in the response carries the
    // same error message. We document this loudly so the LLM does not retry
    // partial batches assuming per-item independence.
    {
      resourceType: "security_exemption_bulk",
      displayName: "Security Exemption (Bulk)",
      searchAliases: ["bulk exempt", "bulk waiver", "exempt many", "exempt multiple", "batch exemption"],
      description:
        "Create up to 100 security exemptions in a single ALL-OR-NONE transaction. " +
        "Use this instead of looping `harness_create resource_type=security_exemption` when the user wants " +
        "to exempt multiple issues at once — it produces one audit row and one DB transaction for the whole batch. " +
        "ALL-OR-NONE: if any single item fails validation or insert (e.g. unknown issue_id, target/pipeline " +
        "mutual-exclusion violation, latest-scan lookup miss), the entire batch is rolled back and every item in " +
        "the response is marked failed with the same error. Never retry a partial batch — re-send the full corrected list. " +
        "Per-item fields: `issue_id` (required), and optionally `target_id` XOR `pipeline_id` (mutually exclusive), " +
        "`scan_id`, `occurrences[]`, `search`. Top-level fields apply to every item: `type`, `reason`, `duration_days` (default 30), " +
        "`link`, `expiration`. `requester_id` is auto-derived from the authenticated PAT.",
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: [],
      relatedResources: [
        { resourceType: "security_exemption", relationship: "sibling", description: "Single-item create path. Use this when exempting just one issue, or when you need per-item independence (the bulk endpoint is all-or-none)." },
        { resourceType: "pipeline_security_issue", relationship: "parent", description: "Source of issue_ids when exempting from the Vuln tab of a specific execution." },
        { resourceType: "security_issue", relationship: "parent", description: "Source of issue_ids when exempting from the All Issues / baseline page (Project scope only)." },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/exemptions",
      operations: {
        create: {
          method: "POST",
          path: "/sto/api/v2/exemptions/bulk",
          operationPolicy: { risk: "high_write", retryPolicy: "do_not_retry" },
          preflight: async ({ client, input }) => {
            const body = (input.body as Record<string, unknown> | undefined) ?? {};

            // Top-level required fields. Validated against raw snake_case input
            // (not the built body) so the error message points at the field the
            // caller passed.
            const requiredFields = ["type", "reason", "items"] as const;
            const missing = requiredFields.filter(f => body[f] === undefined);
            if (missing.length > 0) {
              throw new Error(
                `Missing required fields for security_exemption_bulk: ${missing.join(", ")}. ` +
                `Use harness_describe(resource_type="security_exemption_bulk") to see the schema.`,
              );
            }

            // Items array sanity — matches the API contract (1..100).
            const items = body.items;
            if (!Array.isArray(items) || items.length < 1) {
              throw new Error("security_exemption_bulk: 'items' must be a non-empty array.");
            }
            if (items.length > 100) {
              throw new Error(
                `security_exemption_bulk: 'items' must contain at most 100 entries (got ${items.length}). ` +
                `Split the request into multiple bulk calls.`,
              );
            }

            // Per-item validation. Fail loudly with the offending index so the
            // LLM can surface "item 3 is missing issue_id" to the user instead
            // of getting an opaque 400 from the server.
            items.forEach((raw, idx) => {
              if (raw === null || typeof raw !== "object") {
                throw new Error(`security_exemption_bulk: items[${idx}] must be an object.`);
              }
              const it = raw as Record<string, unknown>;
              if (typeof it.issue_id !== "string" || it.issue_id.length === 0) {
                throw new Error(`security_exemption_bulk: items[${idx}].issue_id is required (string).`);
              }
              const hasTarget = typeof it.target_id === "string" && it.target_id.length > 0;
              const hasPipeline = typeof it.pipeline_id === "string" && it.pipeline_id.length > 0;
              if (hasTarget && hasPipeline) {
                throw new Error(
                  `security_exemption_bulk: items[${idx}] sets both target_id and pipeline_id — they are mutually exclusive. ` +
                  `Pick exactly one scope per item.`,
                );
              }
            });

            // Auto-derive requester from the authenticated PAT, same as the
            // single-create path.
            const harnessClient = client as unknown as HarnessClient;
            body.requester_id = await harnessClient.getCurrentUserId();
            input.body = body;
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            const items = (b.items as Array<Record<string, unknown>>).map((it) => ({
              issueId: it.issue_id,
              ...(it.target_id   ? { targetId:    it.target_id }   : {}),
              ...(it.pipeline_id ? { pipelineId:  it.pipeline_id } : {}),
              ...(it.scan_id     ? { scanId:      it.scan_id }     : {}),
              ...(it.occurrences ? { occurrences: it.occurrences } : {}),
              ...(it.search      ? { search:      it.search }      : {}),
            }));
            return {
              type: b.type,
              reason: b.reason,
              requesterId: b.requester_id,
              exemptFutureOccurrences: true,
              pendingChanges: { durationDays: b.duration_days ?? 30 },
              ...(b.link       ? { link:       b.link }       : {}),
              ...(b.expiration ? { expiration: b.expiration } : {}),
              items,
            };
          },
          responseExtractor: (raw: unknown): unknown => {
            // Surface the all-or-none outcome at the top level so the LLM
            // doesn't have to inspect every item to know what happened.
            // Server returns: { results: [{issueId, id?, error?, statusCode}], succeeded, failed }
            if (raw === null || typeof raw !== "object") return raw;
            const r = raw as { results?: unknown[]; succeeded?: number; failed?: number };
            const succeeded = typeof r.succeeded === "number" ? r.succeeded : 0;
            const failed = typeof r.failed === "number" ? r.failed : 0;
            const total = succeeded + failed;
            const allOrNone =
              total === 0
                ? "EMPTY"
                : failed === 0
                  ? "ALL_SUCCEEDED"
                  : succeeded === 0
                    ? "ALL_FAILED"
                    : "MIXED_UNEXPECTED";
            return {
              status: allOrNone,
              succeeded,
              failed,
              total,
              results: r.results ?? [],
              ...(allOrNone === "ALL_FAILED"
                ? {
                    _action_hint:
                      "The entire bulk request was rolled back. Inspect results[0].error for the cause, " +
                      "fix the offending item(s), and re-send the FULL corrected list — never retry only the failed items.",
                  }
                : {}),
              ...(allOrNone === "MIXED_UNEXPECTED"
                ? {
                    _action_hint:
                      "Bulk endpoint returned a mixed succeeded/failed result, which violates the all-or-none contract. " +
                      "Treat this as a server-side bug and surface the raw results[] to the user.",
                  }
                : {}),
            };
          },
          description:
            "Bulk-create security exemptions (1..100 items) in a single all-or-none transaction. " +
            "Auto-derives requesterId from the authenticated PAT and always sets exemptFutureOccurrences=true.",
          bodySchema: {
            description:
              "Bulk exemption creation. Top-level fields apply to every item. Required: type, reason, items. " +
              "Per-item: issue_id (required); optionally one of target_id XOR pipeline_id, plus scan_id, occurrences, search.",
            fields: [
              { name: "type",          type: "string", required: true,  description: "REQUIRED. Applies to every item. One of: Compensating Controls | Acceptable Use | Acceptable Risk | False Positive | Fix Unavailable | Other." },
              { name: "reason",        type: "string", required: true,  description: "REQUIRED. Applies to every item. Max 1024 chars." },
              { name: "duration_days", type: "number", required: false, description: "Applies to every item. Default 30." },
              { name: "link",          type: "string", required: false, description: "Optional ticket / reference URL applied to every item." },
              { name: "expiration",    type: "number", required: false, description: "Optional unix timestamp at which every item expires." },
              {
                name: "items",
                type: "array",
                required: true,
                description: "REQUIRED. 1..100 per-item entries. Each item: { issue_id (required), target_id? XOR pipeline_id?, scan_id?, occurrences?, search? }. target_id and pipeline_id are mutually exclusive per item.",
                itemType: "object",
              },
            ],
          },
        },
      },
    },
  ],
};
