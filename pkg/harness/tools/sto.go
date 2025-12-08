package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/harness/harness-mcp/pkg/harness/event/types"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// convertTargetNamesToIds converts comma-separated target names to comma-separated target IDs
func convertTargetNamesToIds(ctx context.Context, targetNamesStr string, filters *generated.FrontendAllIssuesFiltersResponseBody) string {
	if targetNamesStr == "" || filters == nil || len(filters.LatestBaselineScans) == 0 {
		return ""
	}

	targetNames := strings.Split(targetNamesStr, ",")
	var targetIds []string
	targetIdMap := make(map[string]bool)

	for _, targetName := range targetNames {
		targetName = strings.TrimSpace(targetName)
		for _, scan := range filters.LatestBaselineScans {
			if strings.EqualFold(scan.TargetName, targetName) {
				if !targetIdMap[scan.TargetId] {
					targetIds = append(targetIds, scan.TargetId)
					targetIdMap[scan.TargetId] = true
				}
			}
		}
	}

	if len(targetIds) > 0 {
		targetIdsStr := strings.Join(targetIds, ",")
		slog.InfoContext(ctx, "Converted target names to IDs",
			"target_names", targetNamesStr,
			"target_ids", targetIdsStr)
		return targetIdsStr
	}

	slog.WarnContext(ctx, "No matching target IDs found for provided names",
		"target_names", targetNamesStr)
	return ""
}

// convertScannerNamesToIds converts comma-separated scanner names to comma-separated scanner tool IDs
func convertScannerNamesToIds(ctx context.Context, scannerNamesStr string, filters *generated.FrontendAllIssuesFiltersResponseBody) string {
	if scannerNamesStr == "" || filters == nil || len(filters.LatestBaselineScans) == 0 {
		return ""
	}

	scannerNames := strings.Split(scannerNamesStr, ",")
	var scanToolIds []string
	scanToolIdMap := make(map[string]bool)

	for _, scannerName := range scannerNames {
		scannerName = strings.TrimSpace(scannerName)
		for _, scan := range filters.LatestBaselineScans {
			if strings.EqualFold(scan.ScanToolName, scannerName) {
				if !scanToolIdMap[scan.ScanTool] {
					scanToolIds = append(scanToolIds, scan.ScanTool)
					scanToolIdMap[scan.ScanTool] = true
				}
			}
		}
	}

	if len(scanToolIds) > 0 {
		scanToolIdsStr := strings.Join(scanToolIds, ",")
		slog.InfoContext(ctx, "Converted scanner names to IDs",
			"scanner_names", scannerNamesStr,
			"scan_tool_ids", scanToolIdsStr)
		return scanToolIdsStr
	}

	slog.WarnContext(ctx, "No matching scanner IDs found for provided names",
		"scanner_names", scannerNamesStr)
	return ""
}

func fetchFilters(ctx context.Context, scope dto.Scope, client *generated.ClientWithResponses) (*generated.FrontendAllIssuesFiltersResponseBody, error) {
	params := &generated.FrontendAllIssuesFiltersParams{
		AccountId: scope.AccountID,
		OrgId:     scope.OrgID,
		ProjectId: scope.ProjectID,
	}

	resp, err := client.FrontendAllIssuesFiltersWithResponse(ctx, params)
	if err != nil {
		slog.ErrorContext(ctx, "FrontendFilters API request failed",
			"error", err,
			"accountId", params.AccountId,
			"orgId", params.OrgId,
			"projectId", params.ProjectId)
		return nil, fmt.Errorf("failed to fetch filters: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("failed to fetch filters: status %d", resp.StatusCode())
	}

	if resp.JSON200 == nil {
		slog.ErrorContext(ctx, "FrontendFilters API returned 200 but JSON200 is nil")
		return nil, fmt.Errorf("failed to fetch filters: JSON200 is nil")
	}

	return resp.JSON200, nil
}

// StoAllIssuesListTool returns a tool for listing all issues from the STO Frontend.
func StoAllIssuesListTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_all_security_issues",
			mcp.WithDescription(`
                List all issues or vulnerabilities from the STO. Show in data table format unless otherwise specified.
				
				NOTE:Don't show any table format for the results . Just summarize the final results in the Output Format section.

				**CRITICAL: Output Format Requirements**
				Don't show any table format for the results . Just summarize the final results in the Output Format section.
				
				Output Format:
				### Summary
				[Provide a 2-3 sentence summary. Don't highlight the issue details. Don't show any table format for the results.]

				
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
			mcp.WithString("targetNames",
				mcp.Description("Comma-separated targetNames to filter. can be reffeed as target in the request. The target name is the name of the target in the STO and will be converted to targetIds before making the API call.")),
			mcp.WithString("targetTypes", mcp.Description(`Optional. Filter issues by target type.
                                                    - Accepts a comma-separated list of target types.
                                                    - Allowed values: configuration, container, instance, repository
                                                    - Example: "configuration,container"
                                                    - If not provided, all target types are included.
                                                `)),
			mcp.WithString("pipelineIds", mcp.Description("Comma-separated pipeline IDs to filter. Use list_pipelines (if available) first to verify and the correct pipeline_id if you're unsure of the exact ID.")),
			mcp.WithString("scanTools", mcp.Description(`Optional. Filter issues by scan tool.
                                                    - Accepts a comma-separated list of scan tools.
													- Can be referred as scanner or scanner name in the request.
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
												- Convert the values to uppercase and replace space with underscore.
												- Example: "External Policy" -> "EXTERNAL_POLICY"
												- Example: "Bug Smells" -> "BUG_SMELLS"
                                            `)),
			common.WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			filters, err := fetchFilters(ctx, scope, client)
			if err != nil {
				slog.ErrorContext(ctx, "Failed to fetch filters API call",
					"error", err,
					"accountId", scope.AccountID,
					"orgId", scope.OrgID,
					"projectId", scope.ProjectID)
			}

			params := &generated.FrontendAllIssuesListParams{
				AccountId: scope.AccountID,
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
			// Convert target names to target IDs
			if targetNamesStr, _ := OptionalParam[string](request, "targetNames"); targetNamesStr != "" {
				if targetIdsStr := convertTargetNamesToIds(ctx, targetNamesStr, filters); targetIdsStr != "" {
					params.TargetIds = &targetIdsStr
				}
			}
			if v, _ := OptionalParam[string](request, "targetTypes"); v != "" {
				params.TargetTypes = &v
			}
			if v, _ := OptionalParam[string](request, "pipelineIds"); v != "" {
				params.PipelineIds = &v
			}
			// Convert scanner names to scanner tool IDs
			if scannerNamesStr, _ := OptionalParam[string](request, "scanTools"); scannerNamesStr != "" {
				combinedScanTools := scannerNamesStr
				if scanToolIdsStr := convertScannerNamesToIds(ctx, scannerNamesStr, filters); scanToolIdsStr != "" {
					combinedScanTools = combinedScanTools + "," + scannerNamesStr
				}
				params.ScanTools = &combinedScanTools
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
				slog.ErrorContext(ctx, "Failed to get STO issues", "error", err)
				return mcp.NewToolResultError(err.Error()), nil
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				slog.ErrorContext(ctx, "Failed to get STO issues", "status code", resp.StatusCode())
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
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
			}

			tableData := types.TableData{
				Columns: columns,
				Rows:    rows,
			}

			// Serialize the table component for text representation
			tableJSON, err := json.Marshal(tableData)
			if err != nil {
				return mcp.NewToolResultErrorf("Failed to marshal table data: %v", err), nil
			}

			raw, err := json.Marshal(resp.JSON200)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal table data: " + err.Error()), nil
			}

			// Start with text content which is always returned
			responseContents := []mcp.Content{
				mcp.NewTextContent(string(tableJSON)),
				mcp.NewTextContent(string(raw)),
			}

			if config.Internal {
				// Create the table component
				tableEvent := types.NewTableEvent(tableData)

				tableResource, err := tableEvent.CreateEmbeddedResource()
				if err != nil {
					slog.ErrorContext(ctx, "Failed to create table resource", "error", err)
				} else {
					responseContents = append(responseContents, tableResource)
				}

				prompts := []string{
					"Show me only issues with secrets identified",
					"Show me issues without Exemption",
				}

				// Create prompt event and resource
				if len(prompts) > 0 {
					promptEvent := types.NewActionEvent(prompts)
					promptResource, err := promptEvent.CreateEmbeddedResource()
					if err != nil {
						slog.ErrorContext(ctx, "Failed to create prompt resource", "error", err)
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

		NOTE: Do NOT show any list of exemptions, table of exemptions, or individual exemption details. Only provide a high-level summary and key statistics. Just summarize the final results in the Output Format section.
		
		**CRITICAL: Output Format Requirements**
		Do NOT show any list of exemptions, table of exemptions, or individual exemption details. Only provide a high-level summary and key statistics.. Just summarize the final results in the following format:
		
		Output Format:
		### Summary
		[Provide a 2-3 sentence summary. Do NOT show any list of exemptions, table of exemptions, or individual exemption details. Only provide a high-level summary and key statistics.]

        **Important Guidance:**
        - Always provide the status filter (Pending, Approved, Rejected, or Expired)
        - Use the search parameter to find specific issues or exemptions by title or content
		- List only 5 exemptions by default when user doesn't specify any number
		- CRITICAL PAGINATION: Track total items shown and calculate correct page number
		  * First request: page=0, size=5 (shows items 1-5)
		  * "list more": page=1, size=5 (shows items 6-10)  
		  * "list 10 more": page=2, size=10 (shows items 11-20, NOT items 1-10!)
		- Maximum limit is 50 exemptions per request. If user asks for more than 50, inform them that the maximum limit is 50 and show 50 exemptions.
		
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
			mcp.WithNumber("size", mcp.Description("Number of results per page"), mcp.DefaultNumber(5), mcp.Max(50)),

			mcp.WithString("status", mcp.Description("Required. Exemption status: Pending, Approved, Rejected, Expired. You must provide exactly one status.")),
			mcp.WithString("search", mcp.Description(`Free-text search that matches both issue titles and exemption titles.
		
		Examples:
		- Issue title: "Log4j vulnerability" or "hardcoded secret"
		- Specific vulnerability ID: "python.jwt.security.jwt-hardcode.jwt-python-hardcoded-secret"
		- CVE: "CVE-2021-44228"
		- Exemption title: "Temporary exemption for production release"
		
		Note: For exact vulnerability IDs, use the complete ID without modifications.`)),
			common.WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Use standard pagination utility
			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pageInt64 := int64(page)
			sizeInt64 := int64(size)

			params := &generated.FrontendGlobalExemptionsParams{
				AccountId: scope.AccountID,
				OrgId:     &scope.OrgID,
				ProjectId: &scope.ProjectID,
				Page:      &pageInt64,
				PageSize:  &sizeInt64,
			}
			if v, _ := OptionalParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := OptionalParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}

			if v, _ := OptionalParam[string](request, "status"); v != "" {
				params.Status = generated.FrontendGlobalExemptionsParamsStatus(v)
			}
			if v, _ := OptionalParam[string](request, "search"); v != "" {
				params.Search = &v
			}

			// Create request body for the new POST API
			body := generated.GlobalExemptionsRequestBody{}

			resp, err := client.FrontendGlobalExemptionsWithResponse(ctx, params, body)
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
				userScope := dto.Scope{
					AccountID: scope.AccountID,
				}
				// PrincipalService: GetUserInfo(ctx, userScope, userID, page, size)
				userInfo, err := principalClient.GetUserInfo(ctx, userScope, userID, 0, 1)
				if err == nil && userInfo != nil {
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
				if issueOk {
					if statusOk && status == "Pending" {
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
				}
			}

			// Always create the basic table data
			tableData := types.TableData{
				Columns: columns,
				Rows:    rows,
			}

			// Always include basic JSON data for external clients
			tableJSON, err := json.Marshal(tableData)
			if err != nil {
				return mcp.NewToolResultErrorf("Failed to marshal table data: %v", err), nil
			}

			raw, err := json.Marshal(resp.JSON200)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal table data: " + err.Error()), nil
			}

			responseContents := []mcp.Content{
				mcp.NewTextContent(string(tableJSON)),
				mcp.NewTextContent(string(raw)),
			}

			if config.Internal {
				// Only create enhanced UI components for internal mode
				tableEvent := types.NewTableEvent(tableData)
				tableResource, err := tableEvent.CreateEmbeddedResource()
				if err != nil {
					slog.ErrorContext(ctx, "Failed to create table resource", "error", err)
				} else {
					responseContents = append(responseContents, tableResource)
				}

				// Create prompt event and resource if we have suggestions
				if len(suggestions) > 0 {
					promptEvent := types.NewActionEvent(suggestions)
					promptResource, err := promptEvent.CreateEmbeddedResource()
					if err != nil {
						slog.ErrorContext(ctx, "Failed to create prompt resource", "error", err)
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
			Promote (approve) an exemption request at higher scope (Org or Account).
			This tool could be used only for Approving an exemption either to Organization(Org) level or to Account level

			**Usage Guidance:**
			- Use this endpoint to promote an exemption to a higher scope (ORGANIZATION or ACCOUNT).
			- The tool automatically determines the exemption's current scope and required identifiers.
			- Simply specify the target scope and the tool handles the rest.

			**When to Use:**
			- To APPROVE/PROMOTE an exemption from Project/Pipeline/Target to Organization or Account level.
			- To escalate exemptions that need higher-level approval.

			**Parameters:**
			- id: Exemption ID to promote (required)
			- scope: where to approve the exemption at, accepted values:- "ORGANIZATION" or "ACCOUNT" (required)
			- comment: Optional comment for the approval
			- pipelineId: Optional pipeline ID if relevant
			- targetId: Optional target ID if relevant


			**Do NOT use this endpoint for rejection.**
`),
			mcp.WithString("id", mcp.Required(), mcp.Description("Exemption ID to promote, generally present in id field of exemption")),
			mcp.WithString("scope", mcp.Required(), mcp.Description("Scope requested to promote/approve the exemption to, allowed values are ORGANIZATION and ACCOUNT")),
			mcp.WithString("comment", mcp.Description("Optional comment for the approval or rejection")),
			mcp.WithString("pipelineId", mcp.Description("Optional pipeline ID to associate with the exemption")),
			mcp.WithString("targetId", mcp.Description("Optional target ID to associate with the exemption")),
			common.WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			id, err := RequiredParam[string](request, "id")
			if err != nil {
				return mcp.NewToolResultError("id is required"), nil
			}

			targetScope, err := RequiredParam[string](request, "scope")
			if err != nil {
				return mcp.NewToolResultError("scope is required"), nil
			}

			// First, fetch the exemption details to get the correct scope information
			findParams := &generated.ExemptionsFindExemptionByIdParams{
				AccountId:   scope.AccountID,
				IgnoreScope: &[]bool{true}[0],
			}

			findResp, err := client.ExemptionsFindExemptionByIdWithResponse(ctx, id, findParams)
			if err != nil {
				return mcp.NewToolResultError("Failed to fetch exemption details: " + err.Error()), nil
			}

			if findResp.JSON200 == nil {
				if findResp.Body != nil {
					return mcp.NewToolResultText("Failed to fetch exemption details: " + string(findResp.Body)), nil
				}
				return mcp.NewToolResultError("Failed to fetch exemption details: No data returned"), nil
			}

			exemption := findResp.JSON200
			targetScope = strings.ToUpper(strings.TrimSpace(targetScope))

			// Validate scope value FIRST
			if targetScope != "ORGANIZATION" && targetScope != "ACCOUNT" {
				return mcp.NewToolResultError("scope must be either ORGANIZATION or ACCOUNT"), nil
			}

			params := &generated.ExemptionsPromoteExemptionParams{
				AccountId: scope.AccountID,
			}

			if targetScope == "ORGANIZATION" {
				if exemption.OrgId != nil && *exemption.OrgId != "" {
					params.OrgId = exemption.OrgId
				} else {
					return mcp.NewToolResultError("Cannot promote to ORGANIZATION scope: exemption has no org ID"), nil
				}
			}
			approverId := getCurrentUserUUID(ctx, scope, principalClient)

			defaultComment := "This is done by Harness Agent"

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
			- To reject an exemption in any scope: Pending, Approved, Rejected, Expired

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
			mcp.WithString("orgId", mcp.Required(), mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Required(), mcp.Description("Harness Project ID")),
			mcp.WithString("userId", mcp.Description("User ID of the approver. Get the current userID from context")),
			common.WithScope(config, true),
		), func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			params := &generated.ExemptionsApproveExemptionParams{
				AccountId: scope.AccountID,
			}
			if v, _ := RequiredParam[string](request, "orgId"); v != "" {
				params.OrgId = &v
			}
			if v, _ := RequiredParam[string](request, "projectId"); v != "" {
				params.ProjectId = &v
			}

			approverId := getCurrentUserUUID(ctx, scope, principalClient)
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

func getCurrentUserUUID(ctx context.Context, scope dto.Scope, principalClient *client.PrincipalService) string {
	accountScope := dto.Scope{
		AccountID: scope.AccountID,
	}
	resp, err := principalClient.GetCurrentUser(ctx, accountScope)
	if err != nil {
		slog.ErrorContext(ctx, "getCurrentUserUUIDFromAPIClient error", "error", err)
		return ""
	}
	return resp.Data.UUID
}
