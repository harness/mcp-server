package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/event/types"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// StoAllIssuesListTool returns a tool for listing all issues from the STO Frontend.
func StoAllIssuesListTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("sto_all_issues_list",
			mcp.WithDescription(`
                List all issues or vulnerabilities from the STO. Show in data table format unless otherwise specified.

				Output Format:
				Show output in the following format, other than this format don't show any other section:
				
				## Summary
				-[Provide a 2-3 sentence summary. Don't highlight the issue details]
				
                Usage Guidance:
                - Use this tool to retrieve a list of issues or vulnerabilities in your project.
                - You can search for specific issues using exact issue IDs, component names, or keywords.
                - Results include vulnerability details, severity, status, and remediation information.

                Search Examples:
                - Exact issue title or ID: "python.jwt.security.jwt-hardcode.jwt-python-hardcoded-secret"
                - Component name: "alpine" or "log4j"
                - CVE ID: "CVE-2021-44228"
                - General security concern: "hardcoded secret" or "sql injection"
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
				mcp.Required(),
			),
			mcp.WithNumber("size",
				mcp.Description("Number of results per page like 10"),
				mcp.DefaultNumber(10),
				mcp.Max(20),
				mcp.Required(),
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
			mcp.WithString("search", mcp.Description(`Search term for issues. Examples:
                                                    - Exact issue ID: "python.jwt.security.jwt-hardcode.jwt-python-hardcoded-secret"
                                                    - Component name: "alpine" or "log4j"
                                                    - CVE ID: "CVE-2021-44228"
                                                    - General security concern: "hardcoded secret"
                                                    Note: For exact issue IDs, ensure you use the complete ID without any modifications.`)),
			mcp.WithString("issueTypes", mcp.Description(`Optional. Filter issues by type.
                                                - Accepts a comma-separated list of issue types.
                                                - Allowed values: SAST,DAST,SCA,IAC,SECRET,MISCONFIG,BUG_SMELLS,CODE_SMELLS,CODE_COVERAGE,EXTERNAL_POLICY
                                                - Example: "SCA,SAST"
                                                - If not provided (field omitted), all issue types are included (default behavior, as in: ?issueTypes= omitted in the request).
                                            `)),
			WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			params := &generated.FrontendAllIssuesListParams{
				AccountId: config.AccountID,
				OrgId:     scope.OrgID,
				ProjectId: scope.ProjectID,
			}
			page := int64(0)
			size := int64(10)

			if v, _ := ExtractParam[string](request, "orgId"); v != "" {
				params.OrgId = v
			}
			if v, _ := ExtractParam[string](request, "projectId"); v != "" {
				params.ProjectId = v
			}
			// Optional params
			if v, _ := OptionalParam[int64](request, "page"); v != 0 {
				params.Page = &v
			} else {
				params.Page = &page
			}
			if v, _ := OptionalParam[int64](request, "size"); v != 0 {
				params.PageSize = &v
			} else {
				params.PageSize = &size
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
			rows := []map[string]interface{}{}
			for _, issue := range resp.JSON200.Issues {
				// Format the timestamp first
				var formattedDate interface{} = issue.LastDetected
				if tsInt, ok := formattedDate.(int64); ok {
					t := time.Unix(tsInt, 0)
					formattedDate = t.Format("02/01/2006 15:04")
				}
				row := map[string]interface{}{
					"SEVERITY":         issue.SeverityCode,
					"ISSUE_TYPE":       issue.IssueType,
					"TITLE":            issue.Title,
					"TARGETS_IMPACTED": issue.NumTargetsImpacted,
					"OCCURRENCES":      issue.NumOccurrences,
					"LAST_DETECTED":    formattedDate,
					"EXEMPTION_STATUS": issue.ExemptionStatus,
					"ISSUE_ID":         issue.Id,
					"EXEMPTION_ID":     issue.ExemptionId,
				}
				rows = append(rows, row)
			}

			// Create table columns for our UI component
			columns := []types.TableColumn{
				{Key: "TITLE", Label: "Title"},
				{Key: "SEVERITY", Label: "Severity"},
				{Key: "ISSUE_TYPE", Label: "Issue Type"},
				{Key: "TARGETS_IMPACTED", Label: "Targets Impacted"},
				{Key: "OCCURRENCES", Label: "Occurrences"},
				{Key: "LAST_DETECTED", Label: "Last Detected"},
				{Key: "EXEMPTION_STATUS", Label: "Exemption Status"},
				{Key: "ISSUE_ID", Label: "Issue ID"},
				{Key: "EXEMPTION_ID", Label: "Exemption ID"},
			}

			// Create the table component
			tableEvent := types.NewTableEvent(columns, rows)

			// Create string array for prompts
			prompts := []string{
				"Show me only issues with secrets identified",
				"Show me issues without Exemption",
			}

			// Serialize the table component for text representation
			tableJSON, err := json.Marshal(tableEvent)
			if err != nil {
				return mcp.NewToolResultErrorf("Failed to marshal table data: %v", err), nil
			}

			// Start with text content which is always returned
			responseContents := []mcp.Content{
				mcp.NewTextContent(string(tableJSON)),
			}

			if config.Internal {
				// Create embedded resources for the table event
				tableResource, err := tableEvent.CreateEmbeddedResource()
				if err != nil {
					slog.Error("Failed to create table resource", "error", err)
				} else {
					responseContents = append(responseContents, tableResource)
				}

				// Create prompt event and resource
				if len(prompts) > 0 {
					promptEvent := types.NewSimpleActionEvent(prompts)
					promptResource, err := promptEvent.CreateEmbeddedResource()
					if err != nil {
						slog.Error("Failed to create prompt resource", "error", err)
					} else {
						responseContents = append(responseContents, promptResource)
					}
				}
			}

			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}
}

func StoGlobalExemptionsTool(config *config.Config, client *generated.ClientWithResponses, principalClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("sto_global_exemptions",
			mcp.WithDescription(`
		List global exemptions. **You must always provide exactly one status filter**

        **Important Guidance:**
        - Always provide the status filter (Pending, Approved, Rejected, or Expired)
        - Use the search parameter to find specific issues or exemptions by title or content

        **Filters:**
        - Status (required): Pending, Approved, Rejected, Expired
        - Project: Comma-separated org:project pairs (e.g., "default:STO,default:CCM")
        - Search: Free-text search that matches both issue titles and exemption titles

        **Search Examples:**
        - Find by issue title: "Log4j vulnerability" or "hardcoded secret"
        - Find by specific vulnerability ID: "python.jwt.security.jwt-hardcode.jwt-python-hardcoded-secret"
        - Find by CVE: "CVE-2021-44228"
        - Find by exemption title: "Temporary exemption for production release"

		## Summary
		-[Provide a 2-3 sentence summary. Don't heighlight the artifacts details
		
		Use this tool to audit or review all exemption requests across your project or organization or account.
		Results will include exemption status, affected resources, severity, and approval information.
`),
			mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
			mcp.WithString("orgId", mcp.Required(), mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Required(), mcp.Description("Harness Project ID")),
			mcp.WithNumber("page", mcp.Description("Page number to fetch (starting from 0)"), mcp.Min(0), mcp.DefaultNumber(0)),
			mcp.WithNumber("pageSize", mcp.Description("Number of results per page"), mcp.DefaultNumber(5)),
			mcp.WithString("matchesProject", mcp.Description("Comma-separated list of organization:project pairs to filter exemptions by project scope (e.g., \"default:STO,default:CCM\").")),
			mcp.WithString("status", mcp.Description("Required. Exemption status: Pending, Approved, Rejected, Expired. You must provide exactly one status.")),
			mcp.WithString("search", mcp.Description(`Free-text search that matches both issue titles and exemption titles.
		
		Examples:
		- Issue title: "Log4j vulnerability" or "hardcoded secret"
		- Specific vulnerability ID: "python.jwt.security.jwt-hardcode.jwt-python-hardcoded-secret"
		- CVE: "CVE-2021-44228"
		- Exemption title: "Temporary exemption for production release"
		
		Note: For exact vulnerability IDs, use the complete ID without modifications.`)),
			WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			page := int64(0)
			size := int64(5)
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			params := &generated.FrontendGlobalExemptionsParams{
				AccountId: config.AccountID,
				OrgId:     &scope.OrgID,
				ProjectId: &scope.ProjectID,
			}
			if v, _ := OptionalParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := OptionalParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}
			if v, _ := OptionalParam[int64](request, "page"); v != 0 {
				params.Page = &v
			} else {
				params.Page = &page
			}
			if v, _ := OptionalParam[int64](request, "pageSize"); v != 0 {
				params.PageSize = &v
			} else {
				params.PageSize = &size
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

			showingApprovedExemptions := false
			// 1. Collect all unique user IDs
			userIDs := make(map[string]struct{})
			for _, e := range resp.JSON200.Exemptions {
				if e.RequesterId != "" {
					userIDs[e.RequesterId] = struct{}{}
				}
				if e.ApproverId != nil && *e.ApproverId != "" {
					userIDs[*e.ApproverId] = struct{}{}
				}
			}

			// 2. Fetch user info for each unique user ID
			userNameMap := make(map[string]string)
			for userID := range userIDs {
				name := ""
				scope := dto.Scope{
					AccountID: config.AccountID,
				}
				// PrincipalService: GetUserInfo(ctx, scope, userID, page, size)
				userInfo, err := principalClient.GetUserInfo(ctx, scope, userID, 0, 1)
				if err == nil && userInfo != nil && &userInfo.Data != nil && &userInfo.Data.User != nil {
					if userInfo.Data.User.Name != "" {
						name = userInfo.Data.User.Name
					} else if userInfo.Data.User.Email != "" {
						name = userInfo.Data.User.Email
					}
				}
				// If lookup fails, name remains ""
				userNameMap[userID] = name
			}

			// 3. Build table rows from exemptions
			rows := []map[string]interface{}{}
			for _, e := range resp.JSON200.Exemptions {
				duration := ""
				if e.Expiration != nil {
					seconds := *e.Expiration - e.Created
					days := seconds / 86400
					duration = fmt.Sprintf("%dd", days)
				} else if e.PendingChanges.DurationDays != nil {
					duration = fmt.Sprintf("%dd", *e.PendingChanges.DurationDays)
				}

				row := map[string]interface{}{
					"ExemptionId":        e.Id,
					"SEVERITY":           e.IssueSummary.SeverityCode,
					"ISSUE":              e.IssueSummary.Title,
					"SCOPE":              e.Scope,
					"REASON":             e.Reason,
					"EXEMPTION_DURATION": duration,
					"OrgId":              e.OrgId,
					"ProjectId":          e.ProjectId,
					"PipelineId":         e.PipelineId,
					"TargetId":           e.TargetId,
					"STATUS":             e.Status,
				}
				row["REQUESTED_BY"] = userNameMap[e.RequesterId]
				if e.ApproverId != nil && *e.ApproverId != "" {
					showingApprovedExemptions = true
					row["APPROVED_BY"] = userNameMap[*e.ApproverId]
				}
				rows = append(rows, row)
			}

			var suggestions []string
			maxSuggestions := 1
			suggestions = append(suggestions,
				"Reject exemptions raised for issue type as secret",
			)
			for i := 0; i < len(rows) && i < maxSuggestions; i++ {
				issue, issueOk := rows[i]["ISSUE"].(string)
				status, statusOk := rows[i]["STATUS"]
				if issueOk && statusOk {
					if status == "Pending" {
						suggestions = append(suggestions, "Approve exemption "+issue)
					}
					suggestions = append(suggestions, "Reject exemption "+issue)
				}
			}

			// Create table columns for our UI component
			columns := []types.TableColumn{}
			if showingApprovedExemptions {
				columns = []types.TableColumn{
					{Key: "ISSUE", Label: "Issue"},
					{Key: "SEVERITY", Label: "Severity"},
					{Key: "SCOPE", Label: "Scope"},
					{Key: "REASON", Label: "Reason"},
					{Key: "EXEMPTION_DURATION", Label: "Exemption Duration"},
					{Key: "REQUESTED_BY", Label: "Requested By"},
					{Key: "APPROVED_BY", Label: "Approved By"},
					{Key: "STATUS", Label: "Status"},
					{Key: "ExemptionId", Label: "Exemption ID"},
					{Key: "OrgId", Label: "Org ID"},
					{Key: "ProjectId", Label: "Project ID"},
					{Key: "PipelineId", Label: "Pipeline ID"},
					{Key: "TargetId", Label: "Target ID"},
				}
			} else {
				columns = []types.TableColumn{
					{Key: "ISSUE", Label: "Issue"},
					{Key: "SEVERITY", Label: "Severity"},
					{Key: "SCOPE", Label: "Scope"},
					{Key: "REASON", Label: "Reason"},
					{Key: "EXEMPTION_DURATION", Label: "Exemption Duration"},
					{Key: "REQUESTED_BY", Label: "Requested By"},
					{Key: "STATUS", Label: "Status"},
					{Key: "ExemptionId", Label: "Exemption ID"},
					{Key: "OrgId", Label: "Org ID"},
					{Key: "ProjectId", Label: "Project ID"},
					{Key: "PipelineId", Label: "Pipeline ID"},
					{Key: "TargetId", Label: "Target ID"},
				}
			}

			// Create the table component
			tableEvent := types.NewTableEvent(columns, rows)

			// Serialize the table component for text representation
			tableJSON, err := json.Marshal(tableEvent)
			if err != nil {
				return mcp.NewToolResultErrorf("Failed to marshal table data: %v", err), nil
			}

			// Start with text content which is always returned
			responseContents := []mcp.Content{
				mcp.NewTextContent(string(tableJSON)),
			}

			if config.Internal {
				// Create embedded resources for the table event
				tableResource, err := tableEvent.CreateEmbeddedResource()
				if err != nil {
					slog.Error("Failed to create table resource", "error", err)
				} else {
					responseContents = append(responseContents, tableResource)
				}

				// Create prompt event and resource if we have suggestions
				if len(suggestions) > 0 {
					promptEvent := types.NewSimpleActionEvent(suggestions)
					promptResource, err := promptEvent.CreateEmbeddedResource()
					if err != nil {
						slog.Error("Failed to create prompt resource", "error", err)
					} else {
						responseContents = append(responseContents, promptResource)
					}
				}
			}

			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}
}

// ExemptionsPromoteExemptionTool promotes a pending exemption to approval/rejection.
func ExemptionsPromoteExemptionTool(config *config.Config, client *generated.ClientWithResponses, principalClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			params := &generated.ExemptionsPromoteExemptionParams{
				AccountId: config.AccountID,
			}
			approverId := getCurrentUserUUID(ctx, config, principalClient)
			defaultComment := "This is done by Harness Agent"
			if v, _ := OptionalParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := OptionalParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}
			body := generated.PromoteExemptionRequestBody{
				ApproverId: approverId,
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
			id, _ := RequiredParam[string](request, "id")

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
func ExemptionsApproveExemptionTool(config *config.Config, client *generated.ClientWithResponses, principalClient *client.PrincipalService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("exemptions_reject_and_approve",
			mcp.WithDescription(`
			Approve or reject an exemption request at its current (requested) scope.

			**Usage Guidance:**
			- Use this endpoint to approve or reject an exemption at the requested scope.
			- Always provide one Action to take: approve or reject
			- Provide approve as an action to approve an exemption
			- Provide reject as an action to reject an exemption
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
			WithScope(config, true),
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
			approverId := getCurrentUserUUID(ctx, config, principalClient)
			defaultComment := "This is done by Harness Agent"
			body := generated.ApproveExemptionRequestBody{
				ApproverId: approverId,
			}
			if v, _ := OptionalParam[string](request, "comment"); v != "" {
				body.Comment = &v
			} else {
				body.Comment = &defaultComment
			}
			actionStr, _ := RequiredParam[string](request, "action")
			action := generated.ExemptionsApproveExemptionParamsAction(actionStr)
			id, _ := RequiredParam[string](request, "id")
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

func getCurrentUserUUID(ctx context.Context, config *config.Config, principalClient *client.PrincipalService) string {
	scope := dto.Scope{
		AccountID: config.AccountID,
	}
	resp, err := principalClient.GetCurrentUser(ctx, scope)
	if err != nil {
		slog.Error("getCurrentUserUUIDFromAPIClient error", "error", err)
		return ""
	}
	return resp.Data.UUID
}
