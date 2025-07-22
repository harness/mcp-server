package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/harness/harness-mcp/client/sto/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// FrontendAllIssuesListTool returns a tool for listing all issues from the STO Frontend.
func FrontendAllIssuesListTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("frontend_all_issues_list",
			mcp.WithDescription(`
				List all issues or vulnerabilities from the STO Frontend. Show in data table format unless otherwise specified.

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

			// Print base URL and query params if accessible
			if client != nil {
				if c, ok := client.ClientInterface.(*generated.Client); ok {
					serverUrl := ""
					if c.Server != "" {
						serverUrl = c.Server
					}
					// Try to print the full URL as constructed by the generator
					if params != nil {
						if req, err := generated.NewFrontendAllIssuesListRequest(serverUrl, params); err == nil {
							// Prepare the information needed for Postman
							slog.Info("Postman URL", "url", req.URL.String())
							slog.Info("Postman Method", "method", req.Method)

							// Print headers for Postman
							// Start with actual headers in the request (if any)
							headers := make(map[string][]string)
							for k, v := range req.Header {
								headers[k] = v
							}

							// Add commonly expected headers for completeness in Postman
							// Note: These are examples and may need to be adjusted for your specific API
							if _, exists := headers["Authorization"]; !exists {
								headers["Authorization"] = []string{"Bearer YOUR_API_TOKEN"}
							}
							if _, exists := headers["x-api-key"]; !exists {
								headers["x-api-key"] = []string{"Bearer x-api-key"}
							}
							if _, exists := headers["APIKey"]; !exists {
								headers["APIKey"] = []string{"Bearer APIKey"}
							}
							if _, exists := headers["Content-Type"]; !exists {
								headers["Content-Type"] = []string{"application/json"}
							}
							if _, exists := headers["Accept"]; !exists {
								headers["Accept"] = []string{"application/json"}
							}
							if _, exists := headers["User-Agent"]; !exists {
								headers["User-Agent"] = []string{"Harness-MCP-Client"}
							}

							// Convert to JSON for logging
							headersJson, _ := json.Marshal(headers)
							slog.Info("Postman Headers", "headers", string(headersJson))

							// Also log individual headers for easy copy-paste
							for k, v := range headers {
								if len(v) > 0 {
									slog.Info("Header", "name", k, "value", v[0])
								}
							}

							// Create a complete curl command for easy testing (without escaped quotes for easier copy/paste)
							curlCmd := fmt.Sprintf("curl -X %s '%s'", req.Method, req.URL.String())
							for k, v := range req.Header {
								if len(v) > 0 {
									curlCmd += fmt.Sprintf(" -H '%s: %s'", k, v[0])
								}
							}
							slog.Info("Curl Command", "cmd", curlCmd)
						}
					}
				}
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

func FrontendGlobalExemptionsTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("frontend_global_exemptions",
			mcp.WithDescription(`
List global exemptions from the STO Frontend. Filter by status (Pending, Approved, Rejected, Expired), project, or search term. Use this to audit or review all exemption requests across your organization.

Filters:
- Status: Pending, Approved, Rejected, Expired
- Project: Comma-separated org:project pairs
- Search: Free-text search for issues or requesters
`),
			mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
			mcp.WithString("orgId", mcp.Required(), mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Required(), mcp.Description("Harness Project ID")),
			mcp.WithNumber("page", mcp.Description("Page number to fetch (starting from 0)"), mcp.Min(0), mcp.DefaultNumber(0)),
			mcp.WithNumber("pageSize", mcp.Description("Number of results per page"), mcp.DefaultNumber(10)),
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
			data, err := json.Marshal(resp.JSON200)
			if err != nil {
				return mcp.NewToolResultError("Failed to marshal response: " + err.Error()), nil
			}
			return mcp.NewToolResultText(string(data)), nil
		}
}

// ExemptionsPromoteExemptionTool promotes a pending exemption to approval/rejection.
func ExemptionsPromoteExemptionTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("exemptions_promote_exemption",
			mcp.WithDescription(`
Promote a pending exemption to approval or rejection. Use this tool to approve or reject an exemption request, providing approver ID, optional comment, and optionally associating it with a pipeline or target.
`),
			mcp.WithString("id", mcp.Required(), mcp.Description("Exemption ID to promote, generally present in id field of exemption")),
			mcp.WithString("accountId", mcp.Required(), mcp.Description("Harness Account ID")),
			mcp.WithString("orgId", mcp.Description("Harness Organization ID")),
			mcp.WithString("projectId", mcp.Description("Harness Project ID")),
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
	return mcp.NewTool("exemptions_approve_exemption",
			mcp.WithDescription(`
Approve or reject an exemption request. Use this tool to take action on an exemption by specifying the action (approve/reject), approver ID, and optional comment.
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
