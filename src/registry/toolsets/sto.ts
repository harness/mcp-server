import type { ToolsetDefinition } from "../types.js";
import { passthrough } from "../extractors.js";

export const stoToolset: ToolsetDefinition = {
  name: "sto",
  displayName: "Security Testing Orchestration",
  description:
    "Harness STO — security issues, vulnerabilities, and exemptions",
  resources: [
    {
      resourceType: "security_issue",
      displayName: "Security Issue",
      description:
        "Security vulnerability/issue from scan results. Supports list and get.",
      toolset: "sto",
      scope: "project",
      identifierFields: ["issue_id"],
      listFilterFields: [
        { name: "severity", description: "Security severity filter", enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/issues/{issueId}",
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/issues",
          queryParams: {
            search: "search",
            severity: "severity",
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List security issues",
        },
        get: {
          method: "GET",
          path: "/sto/api/v2/issues/{issueId}",
          pathParams: { issue_id: "issueId" },
          responseExtractor: passthrough,
          description: "Get security issue details",
        },
      },
    },
    {
      resourceType: "security_exemption",
      displayName: "Security Exemption",
      description: "Security issue exemption/waiver. Supports list with approve/reject actions.",
      toolset: "sto",
      scope: "project",
      identifierFields: ["exemption_id"],
      deepLinkTemplate: "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/sto/exemptions",
      operations: {
        list: {
          method: "GET",
          path: "/sto/api/v2/exemptions",
          queryParams: {
            page: "page",
            size: "size",
          },
          responseExtractor: passthrough,
          description: "List security exemptions",
        },
      },
      executeActions: {
        approve: {
          method: "POST",
          path: "/sto/api/v2/exemptions/{exemptionId}/approve",
          pathParams: { exemption_id: "exemptionId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Approve (promote and approve) a security exemption",
          bodySchema: { description: "No body required. Exemption is identified by path parameter.", fields: [] },
        },
        reject: {
          method: "POST",
          path: "/sto/api/v2/exemptions/{exemptionId}/reject",
          pathParams: { exemption_id: "exemptionId" },
          bodyBuilder: () => ({}),
          responseExtractor: passthrough,
          actionDescription: "Reject a security exemption",
          bodySchema: { description: "No body required. Exemption is identified by path parameter.", fields: [] },
        },
        promote: {
          method: "POST",
          path: "/sto/api/v2/exemptions/{exemptionId}/promote",
          pathParams: { exemption_id: "exemptionId" },
          bodyBuilder: (input) => ({
            scope: input.scope,
            comment: input.comment,
          }),
          responseExtractor: passthrough,
          actionDescription: "Promote a security exemption to a wider scope. Pass scope and optional comment.",
          bodySchema: {
            description: "Exemption promotion details",
            fields: [
              { name: "scope", type: "string", required: false, description: "Target scope for promotion" },
              { name: "comment", type: "string", required: false, description: "Comment for promotion" },
            ],
          },
        },
      },
    },
  ],
};
