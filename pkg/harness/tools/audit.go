package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

const (
	minPage = 0
	maxPage = 1000
	minSize = 1
	maxSize = 1000
)

func convertDateToMilliseconds(timestamp string) int64 {
	slog.Info("Converting date to milliseconds", "timestamp", timestamp)
	t, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		slog.Error("Failed to parse timestamp", "error", err, "timestamp", timestamp)
		panic(err)
	}

	year := t.Year()
	month := int(t.Month())
	day := t.Day()
	hour := t.Hour()
	minute := t.Minute()
	second := t.Second()

	t = time.Date(year, time.Month(month), day, hour, minute, second, 0, time.Local)

	// Convert to Unix milliseconds
	unixMillis := t.UnixNano() / int64(time.Millisecond)

	return unixMillis

}

func getCurrentTime() string {
	now := time.Now().UTC().Format(time.RFC3339)
	return now
}

func previousWeek() string {
	oneWeekAgo := time.Now().AddDate(0, 0, -7).UTC().Format(time.RFC3339)
	return oneWeekAgo
}

// GetAuditYamlTool creates a tool for retrieving YAML diff for a specific audit event.
func GetAuditYamlTool(config *config.Config, auditClient *client.AuditService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_audit_yaml",
			mcp.WithDescription("Get YAML diff for a specific audit event."),
			mcp.WithString("audit_id",
				mcp.Description("The ID of the audit event to retrieve YAML diff for."),
				mcp.Required(),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			slog.Info("Handling get_audit_yaml request", "request", request.GetArguments())

			auditID, err := RequiredParam[string](request, "audit_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			slog.Info("Calling GetAuditYaml API", "audit_id", auditID)

			data, err := auditClient.GetAuditYaml(ctx, scope, auditID)
			if err != nil {
				return nil, fmt.Errorf("failed to get audit YAML: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal the audit YAML response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListAuditsOfUser creates a tool for listing the audit trail.
func ListUserAuditTrailTool(config *config.Config, auditClient *client.AuditService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_user_audits",
			mcp.WithDescription("List the audit trail."),
			mcp.WithString("user_id_list",
				mcp.Description("Enter one or more user email IDs (comma-separated) to filter the audit trail; leave blank to include all users."),
			),
			mcp.WithString("start_time",
				mcp.Description("Optional start time in ISO 8601 format (e.g., '2025-07-10T08:00:00Z')"),
				mcp.DefaultString(previousWeek()),
			),
			mcp.WithString("end_time",
				mcp.Description("Optional end time in ISO 8601 format (e.g., '2025-07-10T08:00:00Z')"),
				mcp.DefaultString(getCurrentTime()),
			),
			mcp.WithString("actions",
				mcp.Description("Optional actions to filter by. For multiple actions, use comma-separated values."),
				mcp.Enum("CREATE", "UPDATE", "RESTORE", "DELETE", "FORCE_DELETE", "UPSERT", "INVITE", "RESEND_INVITE", "REVOKE_INVITE",
					"ADD_COLLABORATOR", "REMOVE_COLLABORATOR", "CREATE_TOKEN", "REVOKE_TOKEN", "LOGIN", "LOGIN2FA", "UNSUCCESSFUL_LOGIN",
					"ADD_MEMBERSHIP", "REMOVE_MEMBERSHIP", "ERROR_BUDGET_RESET", "START", "END", "STAGE_START", "STAGE_END", "PAUSE", "RESUME", "ABORT", "TIMEOUT", "SIGNED_EULA",
					"ROLE_ASSIGNMENT_CREATED", "ROLE_ASSIGNMENT_UPDATED", "ROLE_ASSIGNMENT_DELETED", "MOVE", "ENABLED", "DISABLED", "DISMISS_ANOMALY", "RERUN", "BYPASS", "STABLE_VERSION_CHANGED",
					"SYNC_START", "START_IMPERSONATION", "END_IMPERSONATION", "MOVE_TO_GIT", "FREEZE_BYPASS", "EXPIRED", "FORCE_PUSH"),
			),
			common.WithScope(config, false),

			mcp.WithString("resource_type",
				mcp.Description("Optional resource type to filter by."),
				mcp.Enum("ORGANIZATION", "PROJECT", "USER_GROUP", "SECRET", "CERTIFICATE", "STREAMING_DESTINATION", "RESOURCE_GROUP",
					"USER", "ROLE", "PIPELINE", "TRIGGER", "TEMPLATE", "INPUT_SET", "DELEGATE_CONFIGURATION", "DELEGATE_GROUPS",
					"SERVICE", "ENVIRONMENT", "ENVIRONMENT_GROUP", "DELEGATE", "SERVICE_ACCOUNT", "CONNECTOR", "API_KEY",
					"TOKEN", "DELEGATE_TOKEN", "DASHBOARD", "DASHBOARD_FOLDER", "GOVERNANCE_POLICY", "GOVERNANCE_POLICY_SET",
					"VARIABLE", "CHAOS_HUB", "MONITORED_SERVICE", "CHAOS_INFRASTRUCTURE", "CHAOS_EXPERIMENT", "CHAOS_GAMEDAY",
					"CHAOS_PROBE", "STO_TARGET", "STO_EXEMPTION", "SERVICE_LEVEL_OBJECTIVE", "PERSPECTIVE", "PERSPECTIVE_BUDGET",
					"PERSPECTIVE_REPORT", "COST_CATEGORY", "COMMITMENT_ORCHESTRATOR_SETUP", "COMMITMENT_ACTIONS",
					"CLUSTER_ORCHESTRATOR_SETUP", "CLUSTER_ACTIONS", "SMTP", "PERSPECTIVE_FOLDER", "AUTOSTOPPING_RULE",
					"AUTOSTOPPING_LB", "AUTOSTOPPING_STARTSTOP", "SETTING", "NG_LOGIN_SETTINGS", "DEPLOYMENT_FREEZE",
					"CLOUD_ASSET_GOVERNANCE_RULE", "CLOUD_ASSET_GOVERNANCE_RULE_SET", "CLOUD_ASSET_GOVERNANCE_RULE_ENFORCEMENT",
					"TARGET_GROUP", "FEATURE_FLAG", "FEATURE_FLAG_STALE_CONFIG", "NG_ACCOUNT_DETAILS", "BUDGET_GROUP",
					"IP_ALLOWLIST_CONFIG", "NETWORK_MAP", "CET_AGENT_TOKEN", "CET_CRITICAL_EVENT", "CHAOS_SECURITY_GOVERNANCE",
					"END_USER_LICENSE_AGREEMENT", "WORKSPACE", "IAC_MODULE", "SEI_CONFIGURATION_SETTINGS", "SEI_COLLECTIONS",
					"SEI_INSIGHTS", "SEI_PANORAMA", "CET_SAVED_FILTER", "GITOPS_AGENT", "GITOPS_REPOSITORY", "GITOPS_CLUSTER",
					"GITOPS_CREDENTIAL_TEMPLATE", "GITOPS_REPOSITORY_CERTIFICATE", "GITOPS_GNUPG_KEY", "GITOPS_PROJECT_MAPPING",
					"GITOPS_APPLICATION", "GITOPS_APPLICATION_SET", "CODE_REPOSITORY", "CODE_REPOSITORY_SETTINGS", "CODE_BRANCH_RULE",
					"CODE_PUSH_RULE", "CODE_TAG_RULE", "CODE_BRANCH", "CODE_TAG", "CODE_WEBHOOK", "MODULE_LICENSE",
					"IDP_BACKSTAGE_CATALOG_ENTITY", "IDP_BACKSTAGE_SCAFFOLDER_TASK", "IDP_APP_CONFIGS", "IDP_CONFIG_ENV_VARIABLES",
					"IDP_PROXY_HOST", "IDP_SCORECARDS", "IDP_CHECKS", "IDP_ALLOW_LIST", "IDP_OAUTH_CONFIG", "IDP_CATALOG_CONNECTOR",
					"IDP_GIT_INTEGRATIONS", "IDP_PERMISSIONS", "IDP_CATALOG", "IDP_WORKFLOW", "SERVICE_DISCOVERY_AGENT",
					"APPLICATION_MAP", "IDP_LAYOUT", "IDP_PLUGINS", "NOTIFICATION_CHANNEL", "NOTIFICATION_RULE",
					"IDP_CATALOG_CUSTOM_PROPERTIES", "CLOUD_ASSET_GOVERNANCE_RULE_EVALUATION", "ARTIFACT_REGISTRY_UPSTREAM_PROXY",
					"ARTIFACT_REGISTRY", "BANNER", "GITX_WEBHOOK", "FILE", "CHAOS_IMAGE_REGISTRY", "DB_SCHEMA", "DB_INSTANCE",
					"CCM_ANOMALY", "CCM_ANOMALY_ALERT", "CLOUD_ASSET_GOVERNANCE_NOTIFICATION", "CDE_GITSPACE", "DEFAULT_NOTIFICATION_TEMPLATE_SET"),
			),
			mcp.WithString("resource_identifier",
				mcp.Description("Optional resource identifier to filter by. Must be used with resource_type."),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			slog.Info("Handling list_user_audits request", "request", request.GetArguments())

			userIDList, err := OptionalParam[string](request, "user_id_list")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			actionsList, err := OptionalParam[string](request, "actions")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resourceType, err := OptionalParam[string](request, "resource_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resourceIdentifier, err := OptionalParam[string](request, "resource_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page = int(math.Min(math.Max(float64(page), float64(minPage)), float64(maxPage)))
			size = int(math.Min(math.Max(float64(size), float64(minSize)), float64(maxSize)))

			startTime, _ := OptionalParam[string](request, "start_time")
			endTime, _ := OptionalParam[string](request, "end_time")
			slog.Info("Time range parameters", "start_time", startTime, "end_time", endTime)

			startTimeMilliseconds := convertDateToMilliseconds(startTime)
			endTimeMilliseconds := convertDateToMilliseconds(endTime)
			slog.Info("Converted time range", "start_time_ms", startTimeMilliseconds, "end_time_ms", endTimeMilliseconds)

			// Create filter options
			opts := &dto.ListAuditEventsFilter{}

			// Set default filter type
			opts.FilterType = "Audit"

			// Add resource filter if provided
			if strings.TrimSpace(resourceType) != "" {
				opts.Resources = []dto.AuditResource{{
					Type:       resourceType,
					Identifier: resourceIdentifier,
				}}
				slog.Info("Adding resource filter", "resource_type", resourceType, "resource_identifier", resourceIdentifier)
			}

			slog.Info("Calling ListUserAuditTrail API",
				"user_id_list", userIDList,
				"actions", actionsList,
				"resource_type", resourceType,
				"resource_identifier", resourceIdentifier,
				"page", page,
				"size", size,
				"start_time_ms", startTimeMilliseconds,
				"end_time_ms", endTimeMilliseconds)

			data, err := auditClient.ListUserAuditTrail(ctx, scope, userIDList, actionsList, page, size, startTimeMilliseconds, endTimeMilliseconds, opts)
			if err != nil {
				return nil, fmt.Errorf("failed to list the audit logs: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal the audit logs: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
