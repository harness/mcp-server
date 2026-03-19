import type { ToolsetDefinition } from "../types.js";
import { ngExtract, pageExtract } from "../extractors.js";

/** Parse ISO 8601 to Unix ms. Returns NaN if invalid. */
function parseIsoToMs(value: unknown): number {
  if (value === undefined || value === "") return NaN;
  const t = new Date(String(value)).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** Default 7-day window (matches v1 list_user_audits). */
function defaultAuditTimeWindow(): { startTime: number; endTime: number } {
  const endTime = Date.now();
  const startTime = endTime - 7 * 24 * 60 * 60 * 1000;
  return { startTime, endTime };
}

export const auditToolset: ToolsetDefinition = {
  name: "audit",
  displayName: "Audit Trail",
  description: "Platform audit events and activity log",
  resources: [
    {
      resourceType: "audit_event",
      displayName: "Audit Event",
      description: "Audit trail event. Supports list and get (YAML diff).",
      toolset: "audit",
      scope: "account",
      identifierFields: ["audit_id"],
      listFilterFields: [
        { name: "resource_type", description: "Filter audit logs by resource type", enum: ["ORGANIZATION", "PROJECT", "USER_GROUP", "SECRET", "PIPELINE", "TRIGGER", "TEMPLATE", "INPUT_SET", "DELEGATE_CONFIGURATION", "DELEGATE_GROUPS", "SERVICE", "ENVIRONMENT", "ENVIRONMENT_GROUP", "DELEGATE", "SERVICE_ACCOUNT", "CONNECTOR", "ROLE", "RESOURCE_GROUP", "DASHBOARD", "GOVERNANCE_POLICY", "GOVERNANCE_POLICY_SET", "VARIABLE", "MONITORED_SERVICE", "FEATURE_FLAG", "CHAOS_HUB", "CHAOS_INFRASTRUCTURE", "CHAOS_EXPERIMENT", "GITOPS_AGENT", "GITOPS_APPLICATION", "CODE_REPOSITORY", "SETTING", "DEPLOYMENT_FREEZE"] },
        { name: "action", description: "Filter audit logs by action type", enum: ["CREATE", "UPDATE", "RESTORE", "DELETE", "FORCE_DELETE", "UPSERT", "INVITE", "RESEND_INVITE", "REVOKE_INVITE", "ADD_COLLABORATOR", "REMOVE_COLLABORATOR", "CREATE_TOKEN", "REVOKE_TOKEN", "LOGIN", "LOGIN2FA", "UNSUCCESSFUL_LOGIN", "ADD_MEMBERSHIP", "REMOVE_MEMBERSHIP", "START", "END", "PAUSE", "RESUME", "ABORT", "TIMEOUT", "ROLE_ASSIGNMENT_CREATED", "ROLE_ASSIGNMENT_UPDATED", "ROLE_ASSIGNMENT_DELETED", "ENABLED", "DISABLED", "RERUN", "BYPASS"] },
        { name: "start_time", description: "Start time in ISO 8601 format (e.g. 2025-07-10T08:00:00Z). Default: 7 days ago." },
        { name: "end_time", description: "End time in ISO 8601 format (e.g. 2025-07-10T23:59:59Z). Default: now." },
        { name: "search_term", description: "Filter audit logs by search term" },
        { name: "module", description: "Filter audit logs by module" },
      ],
      deepLinkTemplate: "/ng/account/{accountId}/settings/audit-trail",
      operations: {
        list: {
          method: "POST",
          path: "/audit/api/audits/list",
          queryParams: { page: "pageIndex", size: "pageSize" },
          bodyBuilder: (input) => {
            const { startTime: defaultStart, endTime: defaultEnd } = defaultAuditTimeWindow();
            const startMs = parseIsoToMs(input.start_time);
            const endMs = parseIsoToMs(input.end_time);
            const startTime = Number.isNaN(startMs) ? defaultStart : startMs;
            const endTime = Number.isNaN(endMs) ? defaultEnd : endMs;
            return {
              filterType: "Audit",
              modules: input.module ? [input.module] : undefined,
              actions: input.action ? [input.action] : undefined,
              startTime,
              endTime,
            };
          },
          responseExtractor: pageExtract,
          description: "List audit events",
        },
        get: {
          method: "GET",
          path: "/audit/api/auditYaml",
          queryParams: { audit_id: "auditId" },
          responseExtractor: ngExtract,
          description: "Get audit event YAML diff",
        },
      },
    },
  ],
};
