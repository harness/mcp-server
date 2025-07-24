package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/appseccommons"
	builder "github.com/harness/harness-mcp/pkg/harness/event/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// StoAllIssuesListTool returns a tool for listing all issues from the STO Frontend.
func StoAllIssuesListTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("sto_all_issues_list",
			mcp.WithDescription(`
				List all issues or vulnerabilities from the STO. Show in data table format unless otherwise specified.

				Usage Guidance:
				- Use this tool to retrieve a list of issues or vulnerabilities in your project.
				`),
			mcp.WithString("accountId",
				mcp.Required(),
				mcp.Description("Harness Account ID"),
			),
			mcp.WithString("orgId",
				mcp.Required(),
				mcp.Description("Harness Organization ID"),
			),
			mcp.WithString("projectId",
				mcp.Required(),
				mcp.Description("Harness Project ID"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number to fetch (starting from 0)"),
				mcp.Min(0),
				mcp.DefaultNumber(0),
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Number of results per page"),
				mcp.DefaultNumber(5),
				mcp.Max(20),
			),
			mcp.WithString("targetIds",
				mcp.Description("Comma-separated target IDs to filter")),
			mcp.WithString("targetTypes", mcp.Description(`Optional. Filter issues by target type.
													- Accepts a comma-separated list of target types.
													- Allowed values: configuration, container, instance, repository
													- Example: "configuration,container"
													- If not provided, all target types are included.
												`)),
			mcp.WithString("pipelineIds", mcp.Description("Comma-separated pipeline IDs to filter")),
			mcp.WithString("scanTools", mcp.Description(`Optional. Filter issues by scan tool.
													- Accepts a comma-separated list of scan tools.
													- Allowed values: aqua-trivy, aws-ecr, blackduckhub, brakeman, burp, checkmarx, checkmarx-one, checkov, coverity, custom, fortify, gitleaks, grype, nexusiq, nikto, osv-scanner, owasp, semgrep, snyk, sonarqube, sysdig, traceable, twistlock, veracode, whitesource, wiz, zap, aqua-security
													- Example: "aqua-trivy,semgrep"
													- If not provided, all scan tools are included.
												`)),
			mcp.WithString("severityCodes", mcp.Description(`Optional. Filter issues by severity.
													- Accepts a comma-separated list of severities.
													- Allowed values: Critical, High, Medium, Low, Info
													- Example: "Critical,High"
													- If not provided, all severities are included.
												`)),
			mcp.WithString("exemptionStatuses", mcp.Description(`Optional. Filter issues by exemption status.
													- Accepts a comma-separated list of statuses.
													- Allowed values: None, Pending, Approved, Rejected, Expired
													- Example: "None,Pending"
													- If not provided, all exemption statuses are included.
												`)),
			mcp.WithString("search", mcp.Description("Search term for issues, e.g. '<component name>' like 'alpine'")),
			mcp.WithString("issueTypes", mcp.Description(`Optional. Filter issues by type.
												- Accepts a comma-separated list of issue types.
												- Allowed values: SAST,DAST,SCA,IAC,SECRET,MISCONFIG,BUG_SMELLS,CODE_SMELLS,CODE_COVERAGE,EXTERNAL_POLICY
												- Example: "SCA,SAST"
												- If not provided (field omitted), all issue types are included (default behavior, as in: ?issueTypes= omitted in the request).
											`)),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &generated.FrontendAllIssuesListParams{
				AccountId: config.AccountID,
				OrgId:     config.DefaultOrgID,
				ProjectId: config.DefaultProjectID,
			}

			// Optional params
			if v, _ := OptionalParam[int64](request, "page"); v != 0 {
				params.Page = &v
			}
			if v, _ := OptionalParam[int64](request, "pageSize"); v != 0 {
				params.PageSize = &v
			}
			if v, _ := OptionalParam[string](request, "targetIds"); v != "" {
				params.TargetIds = &v
			}
			if v, _ := OptionalParam[string](request, "targetTypes"); v != "" {
				params.TargetTypes = &v
			}
			if v, _ := OptionalParam[string](request, "pipelineIds"); v != "" {
				params.PipelineIds = &v
			}
			if v, _ := OptionalParam[string](request, "scanTools"); v != "" {
				params.ScanTools = &v
			}
			if v, _ := OptionalParam[string](request, "severityCodes"); v != "" {
				params.SeverityCodes = &v
			}
			if v, _ := OptionalParam[string](request, "exemptionStatuses"); v != "" {
				params.ExemptionStatuses = &v
			}
			if v, _ := OptionalParam[string](request, "search"); v != "" {
				params.Search = &v
			}
			if v, _ := OptionalParam[string](request, "issueTypes"); v != "" {
				params.IssueTypes = &v
			}

			slog.Info("FrontendAllIssuesListTool called with params", "params", params)
			slog.Info("FrontendAllIssuesListTool called with request", "request", request)

			// Print params as map for easier viewing
			paramsJson, _ := json.Marshal(params)
			slog.Info("Params JSON", "params_json", string(paramsJson))

			resp, err := client.FrontendAllIssuesListWithResponse(ctx, params)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if resp.JSON200 == nil {
				// Try to marshal error response if available
				if resp.Body != nil {
					return mcp.NewToolResultText(string(resp.Body)), nil
				}
				return mcp.NewToolResultError("No data returned from STO service"), nil
			}
			// Build table rows from issues
			rows := []map[string]interface{}{}
			for _, issue := range resp.JSON200.Issues {
				row := map[string]interface{}{
					"SEVERITY":         issue.SeverityCode,
					"ISSUE TYPE":       issue.IssueType,
					"TITLE":            issue.Title,
					"TARGETS IMPACTED": issue.NumTargetsImpacted,
					"OCCURRENCES":      issue.NumOccurrences,
					"LAST DETECTED":    issue.LastDetected,
					"EXEMPTION STATUS": issue.ExemptionStatus,
					"ISSUE_ID":         issue.Id,
					"EXEMPTION_ID":     issue.ExemptionId,
				}
				rows = append(rows, row)
			}

			tableData, err := json.Marshal(rows)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal table data: " + err.Error()), nil
			}
			var prompts []string
			prompts = append(prompts,
				"Filter issues by status, e.g., show only Approved or Pending issues?",
				"Show only SAST or SCA issues?",
				"Show issues detected in the last 7 days?",
				"Approve or reject exemption for a specific issue?",
				"Get more details about why an exemption was approved or is pending?",
				"See all issues with more than 10 occurrences?",
				"Find all Critical severity issues without an exemption?",
			)
			return appseccommons.NewToolResultTextWithPrompts(
				string(builder.GenericTableEvent),
				string(tableData),
				prompts,
			), nil
		}
}

func StoGlobalExemptionsTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("sto_global_exemptions",
			mcp.WithDescription(`
		List global exemptions. Filter by status (Pending, Approved, Rejected, Expired), project, or search term. Use this to audit or review all exemption requests across your organization.

		Filters:
		- Status: Pending, Approved, Rejected, Expired
		- Project: Comma-separated org:project pairs
		- Search: Free-text search for issues or requesters
`),
			mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
			mcp.WithString("orgId", mcp.Required(), mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Required(), mcp.Description("Harness Project ID")),
			mcp.WithNumber("page", mcp.Description("Page number to fetch (starting from 0)"), mcp.Min(0), mcp.DefaultNumber(0)),
			mcp.WithNumber("pageSize", mcp.Description("Number of results per page"), mcp.DefaultNumber(5)),
			mcp.WithString("matchesProject", mcp.Description("Comma-separated list of organization:project pairs to filter exemptions by project scope.")),
			mcp.WithString("status", mcp.Description("Exemption status: Pending, Approved, Rejected, Expired")),
			mcp.WithString("search", mcp.Description("Free-text search for issues, requesters, or reasons.")),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &generated.FrontendGlobalExemptionsParams{
				AccountId: config.AccountID,
			}
			if v, _ := OptionalParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := OptionalParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}
			if v, _ := OptionalParam[int64](request, "page"); v != 0 {
				params.Page = &v
			}
			if v, _ := OptionalParam[int64](request, "pageSize"); v != 0 {
				params.PageSize = &v
			}
			if v, _ := OptionalParam[string](request, "matchesProject"); v != "" {
				params.MatchesProject = &v
			}
			if v, _ := OptionalParam[string](request, "status"); v != "" {
				params.Status = generated.FrontendGlobalExemptionsParamsStatus(v)
			}
			if v, _ := OptionalParam[string](request, "search"); v != "" {
				params.Search = &v
			}

			slog.Info("FrontendGlobalExemptionsTool called with params", "params", params)
			resp, err := client.FrontendGlobalExemptionsWithResponse(ctx, params)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if resp.JSON200 == nil {
				if resp.Body != nil {
					return mcp.NewToolResultText(string(resp.Body)), nil
				}
				return mcp.NewToolResultError("No data returned from STO service"), nil
			}

			// Build table rows from exemptions
			rows := []map[string]interface{}{}
			for _, e := range resp.JSON200.Exemptions {
				// Calculate exemption duration (as string)
				duration := ""
				if e.Expiration != nil {
					// If Expiration is present, compute duration from Created to Expiration
					seconds := *e.Expiration - e.Created
					days := seconds / 86400
					duration = fmt.Sprintf("%dd", days)
				} else if e.PendingChanges.DurationDays != nil {
					// If PendingChanges has durationDays, use it
					duration = fmt.Sprintf("%dd", *e.PendingChanges.DurationDays)
				}

				row := map[string]interface{}{
					"ExemptionId":        e.Id,
					"SEVERITY":           "",
					"ISSUE":              "",
					"SCOPE":              e.Scope,
					"REASON":             e.Reason,
					"EXEMPTION DURATION": duration,
					"REQUESTED BY":       e.RequesterId,
					"OrgId":              e.OrgId,
					"ProjectId":          e.ProjectId,
					"PipelineId":         e.PipelineId,
					"TargetId":           e.TargetId,
				}
				row["SEVERITY"] = e.IssueSummary.SeverityCode
				row["ISSUE"] = e.IssueSummary.Title
				rows = append(rows, row)
			}

			// Build dynamic suggestions for exemption actions and details
			var suggestions []string

			// Suggest approve/reject and details for up to the first 2 exemptions, if present
			maxSuggestions := 2
			for i := 0; i < len(rows) && i < maxSuggestions; i++ {
				id, idOk := rows[i]["ExemptionId"].(string)
				issue, issueOk := rows[i]["ISSUE"].(string)
				if idOk {
					suggestions = append(suggestions, "Approve exemption "+id)
					suggestions = append(suggestions, "Reject exemption "+id)
				}
				if idOk && issueOk {
					suggestions = append(suggestions, "Get more details about exemption \""+issue+"\" (ID: "+id+")")
				}
			}

			// Add general suggestions
			suggestions = append(suggestions,
				"See exemptions with a different status (Approved, Rejected, Expired)?",
				"Get more details about a specific exemption?",
			)

			// Marshal only the rows, not the whole response
			tableData, err := json.Marshal(rows)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal table data: " + err.Error()), nil
			}
			return appseccommons.NewToolResultTextWithPrompts(
				string(builder.GenericTableEvent),
				string(tableData),
				suggestions,
			), nil
		}
}

// ExemptionsPromoteExemptionTool promotes a pending exemption to approval/rejection.
func ExemptionsPromoteExemptionTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("sto_exemptions_promote_and_approve",
			mcp.WithDescription(`
				Promote (approve) an exemption request at its current scope or at a higher scope (Project, Org, or Account).

			**Usage Guidance:**
			- Use this endpoint to approve an exemption at the requested scope, or to promote (escalate) it to a higher scope.
			- Do NOT use this endpoint to reject an exemption (see exemptions_reject_and_approve).
			- The required identifiers depend on the scope you are promoting to:
				- **Account-level Promotion:** Provide only accountId.
				- **Org-level Promotion:** Provide accountId and orgId.
				- **Project-level Promotion:** Provide accountId, orgId, and projectId.
				- **Pipeline-level Approval:** Provide accountId, orgId, projectId, and pipelineId.
				- **Target-level Approval:** Provide accountId, orgId, projectId, and targetId.
			- You must provide the exemption id to promote.
			- Optionally, you may provide a comment, pipelineId, or targetId.

			**When to Use:**
			- To approve an exemption at the same or a higher scope than requested.
			- To escalate an exemption from Target/Pipeline/Project to Org or Account.

			**Parameters:**
			- id: Exemption ID to promote (required)
			- accountId: Harness Account ID (required)
			- orgId: Harness Organization ID (required for org/project promotion)
			- projectId: Harness Project ID (required for project promotion)
			- comment: Optional comment for the approval
			- pipelineId: Optional pipeline ID if relevant
			- targetId: Optional target ID if relevant

			**Do NOT use this endpoint for rejection.**
`),
			mcp.WithString("id", mcp.Required(), mcp.Description("Exemption ID to promote, generally present in id field of exemption")),
			mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
			mcp.WithString("orgId", mcp.Required(), mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Required(), mcp.Description("Harness Project ID")),
			mcp.WithString("comment", mcp.Description("Optional comment for the approval or rejection")),
			mcp.WithString("pipelineId", mcp.Description("Optional pipeline ID to associate with the exemption")),
			mcp.WithString("targetId", mcp.Description("Optional target ID to associate with the exemption")),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &generated.ExemptionsPromoteExemptionParams{
				AccountId: config.AccountID,
			}
			userID := "baCzBls7TumXnxvAyOHkUA"
			defaultComment := "This is done by Harness Agent"
			if v, _ := OptionalParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := OptionalParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}
			body := generated.PromoteExemptionRequestBody{
				ApproverId: userID,
			}
			if v, _ := OptionalParam[string](request, "comment"); v != "" {
				body.Comment = &v
			} else {
				body.Comment = &defaultComment
			}
			if v, _ := OptionalParam[string](request, "pipelineId"); v != "" {
				body.PipelineId = &v
			}
			if v, _ := OptionalParam[string](request, "targetId"); v != "" {
				body.TargetId = &v
			}
			id, _ := requiredParam[string](request, "id")

			slog.Info("ExemptionsPromoteExemptionTool called with params", "params", params, "body", body)
			resp, err := client.ExemptionsPromoteExemptionWithResponse(ctx, id, params, body)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if resp.JSON200 == nil {
				if resp.Body != nil {
					return mcp.NewToolResultText(string(resp.Body)), nil
				}
				return mcp.NewToolResultError("No data returned from STO service"), nil
			}
			data, err := json.Marshal(resp.JSON200)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal response: " + err.Error()), nil
			}
			return mcp.NewToolResultText(string(data)), nil
		}
}

// ExemptionsApproveExemptionTool approves or rejects an exemption request.
func ExemptionsApproveExemptionTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("exemptions_reject_and_approve",
			mcp.WithDescription(`
Approve or reject an exemption request at its current (requested) scope.

**Usage Guidance:**
- Use this endpoint to approve or reject an exemption at the requested scope.
- Provide Action to take: approve or reject
- Do NOT use this endpoint to promote an exemption to a higher scope (see exemptions_promote_and_approve).
- You must provide the exemption id, the action (approve or reject), and the relevant scope identifiers.
- Optionally, you may provide a comment.

**When to Use:**
- To approve or reject an exemption at the current/requested scope.
- To reject an exemption at any scope.

**Parameters:**
- id: Exemption ID to approve or reject (required)
- action: "approve" or "reject" (required)
- accountId: Harness Account ID (required)
- orgId: Harness Organization ID (required for org/project scope)
- projectId: Harness Project ID (required for project scope)
- pipelineId: Exemption's pipeline Id (required for pipeline scope)
- targetId: Exemption's target Id (required for target scope)
- comment: Optional comment for the approval or rejection

**Do NOT use this endpoint to promote to a higher scope.**
`),
			mcp.WithString("id", mcp.Required(), mcp.Description("Exemption ID to approve or reject, generally present in id field of exemption")),
			mcp.WithString("action", mcp.Required(), mcp.Description("Action to take: approve or reject")),
			mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
			mcp.WithString("orgId", mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Description("Harness Project ID")),
			mcp.WithString("comment", mcp.Description("Optional comment for the approval or rejection")),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &generated.ExemptionsApproveExemptionParams{
				AccountId: config.AccountID,
			}
			if v, _ := OptionalParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := OptionalParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}
			userID := "baCzBls7TumXnxvAyOHkUA"
			defaultComment := "This is done by Harness Agent"
			body := generated.ApproveExemptionRequestBody{
				ApproverId: userID,
			}
			if v, _ := OptionalParam[string](request, "comment"); v != "" {
				body.Comment = &v
			} else {
				body.Comment = &defaultComment
			}
			id, _ := requiredParam[string](request, "id")
			action, _ := ExtractParam[generated.ExemptionsApproveExemptionParamsAction](request, "action")
			slog.Info("ExemptionsApproveExemptionTool called with params", "params", params, "body", body, "action", action)
			resp, err := client.ExemptionsApproveExemptionWithResponse(ctx, id, action, params, body)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if resp.JSON200 == nil {
				if resp.Body != nil {
					return mcp.NewToolResultText(string(resp.Body)), nil
				}
				return mcp.NewToolResultError("No data returned from STO service"), nil
			}
			data, err := json.Marshal(resp.JSON200)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal response: " + err.Error()), nil
			}
			return mcp.NewToolResultText(string(data)), nil
		}
}
