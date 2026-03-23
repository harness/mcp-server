import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

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
      },
      executeActions: {
        approve: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/approve",
          pathParams: { exemption_id: "exemptionId" },
          bodyBuilder: (input) => ({
            approverId: input.approver_id,
            ...(input.comment ? { comment: input.comment } : {}),
          }),
          responseExtractor: passthrough,
          actionDescription: "Approve a security exemption",
          bodySchema: {
            description: "Exemption approval details",
            fields: [
              { name: "approver_id", type: "string", required: true, description: "User UUID of the approver" },
              { name: "comment", type: "string", required: false, description: "Optional approval comment" },
            ],
          },
        },
        reject: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/reject",
          pathParams: { exemption_id: "exemptionId" },
          bodyBuilder: (input) => ({
            approverId: input.approver_id,
            ...(input.comment ? { comment: input.comment } : {}),
          }),
          responseExtractor: passthrough,
          actionDescription: "Reject a security exemption",
          bodySchema: {
            description: "Exemption rejection details",
            fields: [
              { name: "approver_id", type: "string", required: true, description: "User UUID of the rejector" },
              { name: "comment", type: "string", required: false, description: "Optional rejection comment" },
            ],
          },
        },
        promote: {
          method: "PUT",
          path: "/sto/api/v2/exemptions/{exemptionId}/promote",
          pathParams: { exemption_id: "exemptionId" },
          bodyBuilder: (input) => ({
            approverId: input.approver_id,
            ...(input.comment ? { comment: input.comment } : {}),
            ...(input.pipeline_id ? { pipelineId: input.pipeline_id } : {}),
            ...(input.target_id ? { targetId: input.target_id } : {}),
          }),
          responseExtractor: passthrough,
          actionDescription: "Promote a security exemption to organization or account level",
          bodySchema: {
            description: "Exemption promotion details",
            fields: [
              { name: "approver_id", type: "string", required: true, description: "User UUID of the approver" },
              { name: "comment", type: "string", required: false, description: "Optional comment" },
              { name: "pipeline_id", type: "string", required: false, description: "Pipeline ID to scope promotion" },
              { name: "target_id", type: "string", required: false, description: "Target ID to scope promotion" },
            ],
          },
        },
      },
    },
  ],
};
