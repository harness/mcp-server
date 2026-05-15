import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";
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
      description: "Security issue exemption/waiver. Supports list (POST with status filter) with approve/reject/promote actions.",
      toolset: "sto",
      scope: "project",
      scopeParams: STO_SCOPE,
      identifierFields: ["exemption_id"],
      listFilterFields: [
        { name: "status", description: "Exemption status filter", enum: ["Pending", "Approved", "Rejected", "Expired", "Canceled"], required: true },
        { name: "search", description: "Free-text search for issue/exemption titles" },
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
          responseExtractor: passthrough,
          description: "List security exemptions filtered by status",
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
          actionDescription: "Approve a security exemption at PROJECT scope only. Use this ONLY when the user explicitly wants project-level approval. For ORG or ACCOUNT level, use the 'promote' action instead — do NOT call approve first.",
          bodySchema: {
            description: "Exemption approval details",
            fields: [
              { name: "approver_id", type: "string", required: false, description: "User UUID of the approver. Auto-derived from the authenticated PAT via /ng/api/user/currentUser if omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional approval comment"},
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
          queryParams: { promote_pipeline_id: "pipelineId", promote_target_id: "targetId" },
          preflight: async ({ client, input }) => {
            const b = ((input.body as Record<string, unknown> | undefined) ?? {});
            const scope = ((b.scope ?? input.scope) as string | undefined)?.toUpperCase();
            // The STO backend determines target scope by which query params are present:
            //   orgId + projectId + pipelineId → PIPELINE scope
            //   orgId + projectId + targetId   → TARGET scope
            //   orgId + projectId              → PROJECT scope
            //   orgId only                     → ORG scope
            //   neither                        → ACCOUNT scope
            // Setting to "" wins over config fallback (nullish coalescing) and is
            // skipped by the harness client URL builder, so the param is omitted.
            if (scope === "ACCOUNT") {
              input.org_id = "";
              input.project_id = "";
            } else if (scope === "ORG") {
              input.project_id = "";
              // org_id left undefined so registry injects it from config
            } else if (scope === "PIPELINE" && b.pipeline_id) {
              // Hoist to top-level so queryParams mapping sends it as URL param
              input.promote_pipeline_id = b.pipeline_id;
            } else if (scope === "TARGET" && b.target_id) {
              // Hoist to top-level so queryParams mapping sends it as URL param
              input.promote_target_id = b.target_id;
            }
            // PROJECT: leave both org_id and project_id as-is, no extra params

            const harnessClient = client as unknown as HarnessClient;
            if (!b.approver_id) {
              b.approver_id = await harnessClient.getCurrentUserId();
              input.body = b;
            }
          },
          bodyBuilder: (input) => {
            const b = (input.body as Record<string, unknown> | undefined) ?? {};
            // scope may arrive in body OR as a top-level input param depending on the calling agent
            const scope = (b.scope ?? input.scope) as string | undefined;
            const requestBody = {
              approverId: b.approver_id,
              scope,
              ...(b.comment     ? { comment:    b.comment }     : {}),
              ...(b.pipeline_id ? { pipelineId: b.pipeline_id } : {}),
              ...(b.target_id   ? { targetId:   b.target_id }   : {}),
            };
            return requestBody;
          },
          responseExtractor: passthrough,
          actionDescription: "Approve AND promote a security exemption to any scope in a single step. Call this directly — do NOT call 'approve' first. MUST pass scope in body: 'ACCOUNT' | 'ORG' | 'PROJECT' | 'PIPELINE' (requires pipeline_id) | 'TARGET' (requires target_id). approver_id is auto-derived when not supplied.",
          bodySchema: {
            description: "Exemption promotion details",
            fields: [
              { name: "scope",       type: "string", required: true,  description: "Target scope: 'ACCOUNT' | 'ORG' | 'PROJECT' | 'PIPELINE' (also pass pipeline_id) | 'TARGET' (also pass target_id)." },
              { name: "approver_id", type: "string", required: false, description: "User UUID of the approver. Auto-derived from the authenticated PAT via /ng/api/user/currentUser if omitted." },
              { name: "comment",     type: "string", required: false, description: "Optional comment" },
              { name: "pipeline_id", type: "string", required: false, description: "Pipeline ID to scope promotion" },
              { name: "target_id",   type: "string", required: false, description: "Target ID to scope promotion" },
            ],
          },
        },
      },
    },
  ],
};
