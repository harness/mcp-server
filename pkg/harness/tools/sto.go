package tools

import (
	"context"
	"encoding/json"
	"github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// FrontendAllIssuesListTool returns a tool for listing all issues from the STO Frontend.
func FrontendAllIssuesListTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("frontend_all_issues_list",
			mcp.WithDescription("List all issues from the STO Frontend. Show in data table format unless otherwise specified."),
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
			),
			mcp.WithNumber("pageSize",
				mcp.Description("Number of results per page"),
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
			params := &generated.FrontendAllIssuesListParams{}
			// Required params
			params.AccountId, _ = OptionalParam[string](request, "accountId")
			params.OrgId, _ = OptionalParam[string](request, "orgId")
			params.ProjectId, _ = OptionalParam[string](request, "projectId")
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
			data, err := json.Marshal(resp.JSON200)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal response: " + err.Error()), nil
			}
			return mcp.NewToolResultText(string(data)), nil
		}
}
