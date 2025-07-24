package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	generated "github.com/harness/harness-mcp/client/scs/generated"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/appseccommons"
	builder "github.com/harness/harness-mcp/pkg/harness/event/common"
	"github.com/harness/harness-mcp/pkg/resources"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// SummarizeSCSTool creates a tool that can summarize SCS tool results and generate follow-on prompts
func SummarizeSCSTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("summarize_scs_result",
			mcp.WithDescription("Summarizes SCS tool results and generates follow-on prompts for further exploration. Call this after finishing all tool calls from scs"),
			mcp.WithString("tool_result",
				mcp.Required(),
				mcp.Description("The result from a previous SCS tool call that you want to summarize"),
			),
			mcp.WithString("context",
				mcp.Description("Additional context about what the user is trying to accomplish"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract parameters
			toolResultStr, err := RequiredParam[string](request, "tool_result")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			contextInfo, _ := OptionalParam[string](request, "context")

			// Create sampling request with system prompt that instructs the model to summarize and generate prompts
			systemPrompt := `You are an expert at analyzing Harness SCS (Supply Chain Security) data. 
			Your task is to:
			1. Provide a concise summary of the SCS tool result
			2. Identify the most important security or compliance insights
			3. Generate exactly 3 follow-on prompts that would help the user explore this data further

			Format your response as follows:
			
			## Summary
			[Provide a 2-3 sentence summary of the key information]
			
			## Key Insights
			- [First key insight about security or compliance]
			- [Second key insight]
			- [Third key insight if applicable]
			
			## Follow-on Questions
			1. [Specific, actionable follow-on question]
			2. [Another specific follow-on question]
			3. [Another specific follow-on question]`

			// Prepare the user message with tool result and context
			userMessage := "Tool Result:\n" + toolResultStr
			if contextInfo != "" {
				userMessage += "\n\nContext:\n" + contextInfo
			}

			// Create sampling request
			samplingRequest := mcp.CreateMessageRequest{
				CreateMessageParams: mcp.CreateMessageParams{
					Messages: []mcp.SamplingMessage{
						{
							Role: mcp.RoleUser,
							Content: mcp.TextContent{
								Type: "text",
								Text: userMessage,
							},
						},
					},
					SystemPrompt: systemPrompt,
					MaxTokens:    1500,
					Temperature:  0.5,
				},
			}

			// Request sampling from the server
			samplingCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
			defer cancel()
			serverFromCtx := server.ServerFromContext(ctx)
			sampling, err := serverFromCtx.RequestSampling(samplingCtx, samplingRequest)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Error generating summary: %v", err)), nil
			}

			// Extract the text from the content
			responseText := ""
			// Handle content as a slice of interface{}
			contentSlice, ok := sampling.Content.([]interface{})
			if !ok {
				return mcp.NewToolResultError("Failed to parse sampling response content"), nil
			}

			// Process each content item
			for _, item := range contentSlice {
				// Try to extract text from the content item
				if contentMap, ok := item.(map[string]interface{}); ok {
					if textValue, ok := contentMap["text"].(string); ok {
						responseText += textValue
					}
				}
			}

			// Extract follow-on questions to use as prompts
			var prompts []string
			followOnSection := false
			lines := strings.Split(responseText, "\n")
			for _, line := range lines {
				if strings.Contains(line, "Follow-on Questions") {
					followOnSection = true
					continue
				}
				if followOnSection && (strings.HasPrefix(strings.TrimSpace(line), "1.") ||
					strings.HasPrefix(strings.TrimSpace(line), "2.") ||
					strings.HasPrefix(strings.TrimSpace(line), "3.")) {
					// Extract the question part (remove the number and period)
					question := strings.TrimSpace(line)
					if idx := strings.Index(question, ". "); idx != -1 {
						question = question[idx+2:]
					}
					prompts = append(prompts, question)
				}
			}

			// Create the tool result with the summary text
			result := mcp.NewToolResultText(responseText)

			// If we found any prompts, add them as suggested responses
			if len(prompts) > 0 {
				// Since there's no direct method to add suggestions, we'll return the text with the prompts separately
				var suggestionsText string
				suggestionsText = "\n\n**Follow-up Questions:**\n"
				for i, prompt := range prompts {
					suggestionsText += fmt.Sprintf("%d. %s\n", i+1, prompt)
				}

				// Append the suggestions to the response text
				return mcp.NewToolResultText(responseText + suggestionsText), nil
			}

			return result, nil
		}
}

func artifactRuleBasedFollowUps(artifacts []generated.ArtifactV2ListingResponse, licenseFilterList *[]generated.LicenseFilter) []string {
	var prompts []string
	for i, a := range artifacts {
		if i >= 3 {
			break
		}
		name := "<unknown>"
		licenseStr := "<unknown>"
		if a.Name != nil {
			name = *a.Name
		}
		if licenseFilterList != nil && len(*licenseFilterList) > 0 {
			var licenses []string
			for _, lf := range *licenseFilterList {
				if lf.Value != "" {
					licenses = append(licenses, lf.Value)
				}
			}
			licenseStr = strings.Join(licenses, ", ")
			prompts = append(prompts, fmt.Sprintf("Enforce a opa policy to prevent artifact %s with %s licenses from being deployed?", name, licenseStr))
		} else {
			prompts = append(prompts, fmt.Sprintf("Summarise key risks for %s", name))
		}
	}
	return prompts
}

// ListArtifactSourcesTool returns a tool for listing artifact sources.
func ListArtifactSourcesTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_artifact_sources",
			mcp.WithDescription(`
			Lists all artifact sources available in Harness SCS.

			NOTE: Don't show any table format for the results . Just summarize the final results in the following format:
			
			## Summary
			[Provide a 2-3 sentence summary of the key information]
			
			## Key Insights
			- [First key insight about security or compliance]
			- [Second key insight]
			- [Third key insight if applicable]

			Usage Guidance:
			- Use this tool to retrieve a list of artifact sources (such as container registries ) in your organization and project.
			- Each artifact source returned will include a unique sourceId.

			Filters Supported:
				- search_term (fuzzy tag match)
				- component_filter (e.g.,{"field_name": "ComponentVersion", "operator": "Equals", "value": "1.2.3"})
				- license_filter (e.g.,{"operator": "Contains", "value": "MIT"})
				- policy_violation (ALLOW, DENY, ANY, NONE)
				- artifact_type (e.g., Accepts an array of artifact types. Example: ["WAR", "MANIFEST"])
				- environment_type (Prod, NonProd, None, All)

			Tip: Use search_term or pagination parameters (if available) to narrow or organize the results for large organizations.
			`), mcp.WithString("search_term",
				mcp.Description(`Optional. Free-text search to filter artifacts by name e.g. 'alpine' or 'docker.io/library/alpine:latest'.`),
			),
			mcp.WithString("component_filter",
				mcp.Description(`Optional. Filter artifacts by component properties.
				- Expects a JSON array of objects, where each object must include:
					- "field_name": the name of the component property to filter on (string).Only ComponentName and ComponentVersion are supported.
					- "operator": the comparison operator to use (string, see allowed values below)
					- "value": the value to compare against (string)
				- Allowed operator values:
					- Equals
				- StartsWith
				- Contains
				- NotEquals
				- GreaterThan
				- GreaterThanEquals
				- LessThan
				- LessThanEquals
			- Example:
				[
				{"field_name": "ComponentVersion", "operator": "Equals", "value": "1.2.3"},
				{"field_name": "ComponentName", "operator": "StartsWith", "value": "lib"}
				]
			`),
			),
			mcp.WithString("license_filter_list",
				mcp.Description(`Optional. Filter artifacts by multiple licenses.
			- Accepts an array of license filter objects.
			- Each filter object should have:
				- "operator": the operator to use for matching (allowed values: Contains, Equals, StartsWith)
				- "value": the license string to match.

			- Allowed operator values:
				- Equals
				- Contains
				- StartsWith
			- Example:
				[
					{"operator": "Contains", "value": "MIT"},
					{"operator": "Contains", "value": "Apache"}
				]
			`),
			),
			mcp.WithString("policy_violation",
				mcp.Description(`Optional. Filter artifacts by opa policy violation status or type. Allowed values: ALLOW, DENY, ANY, NONE.`),
				mcp.Enum("ALLOW", "DENY", "ANY", "NONE"),
			),
			mcp.WithString("environment_type",
				mcp.Description(`Optional. Filter artifacts by environment type. Allowed values: Prod, NonProd, None, All.`),
				mcp.Enum("Prod", "NonProd", "None", "All"),
				mcp.DefaultString("All"),
			),
			mcp.WithString("artifact_type",
				mcp.Description(`Optional.Accepts an array of artifact types. 
				-Allowed artifact types: CONTAINER_IMAGE, HELM, MANIFEST, JAR, WAR, UNKNOWN.
				-Example: 
				[
						"WAR",
						"MANIFEST"
				]`),
			),
			mcp.WithString("order",
				mcp.Description("Order of results (ASC, DESC)"),
				mcp.Enum("ASC", "DESC"),
				mcp.DefaultString("DESC"),
			),
			mcp.WithString("sort",
				mcp.Description("Sort by field (severity, title)"),
				mcp.Enum("severity", "title"),
				mcp.DefaultString("severity"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID
			order, _, page, size, sortVal := ParseArtifactListParams(request)
			params := &generated.ListArtifactSourcesParams{
				Page:           (*generated.Page)(&page),
				Limit:          (*generated.Limit)(&size),
				HarnessAccount: generated.AccountHeader(config.AccountID),
				Order:          (*generated.ListArtifactSourcesParamsOrder)(&order),
				Sort:           &sortVal,
			}
			pageVal := 1
			sizeVal := 2
			artifactParams := &generated.ArtifactListV2Params{
				Page:           (*generated.Page)(&pageVal),
				Limit:          (*generated.Limit)(&sizeVal),
				HarnessAccount: generated.AccountHeader(config.AccountID),
				Order:          (*generated.ArtifactListV2ParamsOrder)(&order),
				Sort:           &sortVal,
			}

			// build the body using a helper function
			body, err := BuildArtifactListingBody(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resp, err := client.ListArtifactSourcesWithResponse(ctx, orgID, projectID, params, body)
			if err != nil {
				return nil, fmt.Errorf("failed to call ListArtifactSources: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}

			// Enrich each source with artifact details
			var enrichedArtifacts []generated.ArtifactV2ListingResponse
			if resp.JSON200 != nil {
				for _, src := range *resp.JSON200 {
					if src.SourceId != nil && *src.SourceId != "" {
						artifactResp, err := client.ArtifactListV2WithResponse(ctx, orgID, projectID, *src.SourceId, artifactParams, body)
						if err != nil {
							slog.Error("Failed to call ArtifactListV2", "error", err)
							continue // skip on error
						}
						if artifactResp.StatusCode() >= 200 && artifactResp.StatusCode() < 300 && artifactResp.JSON200 != nil {
							enrichedArtifacts = append(enrichedArtifacts, *artifactResp.JSON200...)
						}
					}
				}
			}
			pretty, err := json.MarshalIndent(enrichedArtifacts, "", "  ")
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			// Compute suggestions
			var suggestions []string
			if enrichedArtifacts != nil {
				suggestions = artifactRuleBasedFollowUps(enrichedArtifacts, &*body.LicenseFilterList)
			}

			return appseccommons.NewToolResultTextWithPrompts(string(builder.GenericTableEvent), string(pretty), suggestions, "scs_result", []string{"name", "tags", "components_count", "Scorecard", "StoIssueCount", "Signing", "deployments", "digest"}), nil
		}
}

// ArtifactListV2Tool returns a tool for listing artifacts from a source.
func ArtifactListV2Tool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_artifacts_per_source",
			mcp.WithDescription(`
			Lists all artifacts from a specified artifact source in Harness SCS.Show in data table format unless otherwise specified.

			Usage Guidance:
			- Use this tool to retrieve a list of all artifacts (such as images, packages, etc.) from a given artifact source.
			- The required input is the source (sourceId) of the artifact source.
			
			Filters Supported:
				- search_term (fuzzy tag match)
				- component_filter (e.g.,{"field_name": "ComponentVersion", "operator": "Equals", "value": "1.2.3"})
				- license_filter (e.g.,{"operator": "Contains", "value": "MIT"})
				- policy_violation (ALLOW, DENY, ANY, NONE)
				- artifact_type (e.g., Accepts an array of artifact types. Example: ["WAR", "MANIFEST"])
				- environment_type (Prod, NonProd, None, All)

			How to obtain sourceId:
			1. If you do not know the sourceId:
			- Use the 'list_artifact_sources' tool with a relevant search_term (e.g., image name like 'alpine' or 'docker.io/library/alpine:latest') to find the artifact source.
			- Then use the sourceId from the response as the input to this tool.

			Tip: Once you have the list of artifacts, you can use the sourceId from the results with other tools such as 'get_artifact_overview' or 'get_artifact_chain_of_custody' for further analysis.
			`),
			mcp.WithString("source",
				mcp.Required(),
				mcp.Description("The identifier of the artifact source, eg: 'sourceId'"),
			), mcp.WithString("search_term",
				mcp.Description(`Optional. Free-text search to filter artifacts by tag.`),
			),
			mcp.WithString("component_filter",
				mcp.Description(`Optional. Filter artifacts by component properties.
				- Expects a JSON array of objects, where each object must include:
					- "field_name": the name of the component property to filter on (string).Only ComponentName and ComponentVersion are supported.
					- "operator": the comparison operator to use (string, see allowed values below)
					- "value": the value to compare against (string)
				- Allowed operator values:
					- Equals
				- StartsWith
				- Contains
				- NotEquals
				- GreaterThan
				- GreaterThanEquals
				- LessThan
				- LessThanEquals
			- Example:
				[
				{"field_name": "ComponentVersion", "operator": "Equals", "value": "1.2.3"},
				{"field_name": "ComponentName", "operator": "StartsWith", "value": "lib"}
				]
			`),
			),
			mcp.WithString("license_filter",
				mcp.Description(`Optional. Filter artifacts by license.
			- Accepts license names, or a JSON object for structured filtering.
			- For structured filtering, provide an object with:
				- "operator": the operator to use for matching (allowed values: Contains, Equals, StartsWith)
				- "value": the license string to match (e.g., "MIT")
			- Allowed operator values:
				- Equals
				- Contains
				- StartsWith
			- Example:
				{
					"operator": "Contains",
					"value": "MIT"
				}
			`),
			),
			mcp.WithString("policy_violation",
				mcp.Description(`Optional. Filter artifacts by opa policy violation status or type. Allowed values: ALLOW, DENY, ANY, NONE.`),
				mcp.Enum("ALLOW", "DENY", "ANY", "NONE"),
			),
			mcp.WithString("environment_type",
				mcp.Description(`Optional. Filter artifacts by environment type. Allowed values: Prod, NonProd, None, All.`),
				mcp.Enum("Prod", "NonProd", "None", "All"),
				mcp.DefaultString("All"),
			),
			mcp.WithString("artifact_type",
				mcp.Description(`Optional.Accepts an array of artifact types. 
				-Allowed artifact types: CONTAINER_IMAGE, HELM, MANIFEST, JAR, WAR, UNKNOWN.
				-Example: 
				[
						"WAR",
						"MANIFEST"
				]`),
			),
			mcp.WithString("order",
				mcp.Description("Order of results (ASC, DESC)"),
				mcp.Enum("ASC", "DESC"),
			),
			mcp.WithString("sort",
				mcp.Description("Sort by field (severity, title)"),
				mcp.Enum("severity", "title"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID
			source, err := RequiredParam[string](request, "source")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			order, _, page, size, sortVal := ParseArtifactListParams(request)
			params := &generated.ArtifactListV2Params{
				Page:           (*generated.Page)(&page),
				Limit:          (*generated.Limit)(&size),
				HarnessAccount: generated.AccountHeader(config.AccountID),
				Order:          (*generated.ArtifactListV2ParamsOrder)(&order),
				Sort:           &sortVal,
			}

			// build the body using a helper function
			body, err := BuildArtifactListingBody(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resp, err := client.ArtifactListV2WithResponse(ctx, orgID, projectID, source, params, body)
			if err != nil {
				return nil, fmt.Errorf("failed to call ArtifactListV2: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}
			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}
}

// GetArtifactV2OverviewTool returns a tool for getting artifact overview from a source.
func GetArtifactV2OverviewTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_artifact_overview",
			mcp.WithDescription(`
				Retrieves an overview of a specific artifact from a source in Harness SCS.

				This tool returns details such as metadata, security findings, SBOM information, and compliance status for the given artifact.

				Usage Guidance:
				- Use this tool to inspect the security and compliance posture of an artifact.
				- Required inputs: source (sourceId) and artifact_identifier (artifactId, UUID format).

				How to obtain artifactId:
				1. If you do not know the artifactId:
				- Use the 'list_artifact_sources' tool with a relevant search_term (e.g., image name like 'docker.io/library/alpine:latest') to locate the artifact id.
				- Select the 1st artifact and use its artifactId as input to this tool.

				Tip: For full supply chain context, use the 'get_artifact_chain_of_custody' tool with the artifactId to retrieve the artifact's event history.
				`),
			mcp.WithString("source",
				mcp.Required(),
				mcp.Description("The identifier of the artifact source, eg: 'sourceId'"),
			),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the artifact, eg: 'artifactId'"),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID
			source, err := RequiredParam[string](request, "source")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			artifact, err := RequiredParam[string](request, "artifact_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			params := &generated.GetArtifactV2OverviewParams{
				HarnessAccount: generated.AccountHeader(config.AccountID),
			}
			resp, err := client.GetArtifactV2OverviewWithResponse(ctx, orgID, projectID, source, artifact, params)
			if err != nil {
				return nil, fmt.Errorf("failed to call GetArtifactV2Overview: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}
			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}
}

// GetArtifactChainOfCustodyV2Tool returns a tool for getting chain of custody for an artifact.
func GetArtifactChainOfCustodyV2Tool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_artifact_chain_of_custody",
			mcp.WithDescription(`
				Retrieves the full chain of custody for a specific artifact in Harness SCS. Show in data table format unless otherwise specified.

				This tool provides a chronological list of all key events performed on the artifact,
				such as SLSA provenance, security scans, SBOM generation, and other supply chain activities.

				Usage Guidance:

				- Use this tool when you need to audit or verify the lifecycle and security events
				associated with an artifact.
				- The required input is the artifactId (UUID format).

				How to obtain artifactId:

				1. If you do not know the artifactId:
				- Use the 'list_artifact_sources' tool with a relevant search_term (e.g., image name
					like 'alpine') to locate the artifact id.
				- Select the 1st artifact and use its artifactId as input to this tool.

				This tool is essential for supply chain transparency, compliance, and forensic investigations.
				`),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Pattern("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"),
				mcp.Description(`The identifier of the artifact (e.g. artifactId).`),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID
			artifact, err := RequiredParam[string](request, "artifact_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			params := &generated.GetArtifactChainOfCustodyV2Params{
				HarnessAccount: generated.AccountHeader(config.AccountID),
			}
			resp, err := client.GetArtifactChainOfCustodyV2WithResponse(ctx, orgID, projectID, artifact, params)
			if err != nil {
				return nil, fmt.Errorf("failed to call GetArtifactChainOfCustodyV2: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}
			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}
}

// FetchComplianceResultsByArtifactTool returns a tool for fetching compliance results by artifact from Harness SCS.
func FetchComplianceResultsByArtifactTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("fetch_compliance_results_for_repo_by_id",
			mcp.WithDescription("Fetch compliance results for a specific CI/CD or repository from Harness SCS."),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Description(`
				The identifier of the repo or ci/cd artifact (e.g., artifactId, UUID format).Show in data table format unless otherwise specified.


				Filters Supported:
				- search_term (fuzzy tag match)
				- standards (e.g., ["CIS", "OWASP"])
				- severity (CRITICAL, HIGH, MEDIUM, LOW)
				- status (e.g., ["PASS", "FAIL"])
				- order (ASC, DESC)
				- sort (severity, title)

				How to obtain artifactId:
				- If you do not know the artifactId:
				1. Use the 'list_scs_code_repos' tool with a relevant search_term (such as an repository name like 'github.com/harness/harness-mcp').Id in the response is the artifactId.
				2. Select the desired artifact and use its artifactId as the input to this tool.

				Tip: Use the artifactId with the 'get_artifact_overview' tool to retrieve detailed information about the artifact.
				`),
			),
			mcp.WithString("compliance_id",
				mcp.Description("Optional. Filter by compliance rule ID (compliance_id)."),
			),
			mcp.WithString("search_term",
				mcp.Description("Optional. Search term for compliance checks. This can be any word in the compliance rule description like pipeline, build, Github Action etc."),
			),
			mcp.WithString("standards",
				mcp.Description("Optional. Array of standards to filter by (e.g., [\"CIS\", \"OWASP\"])."),
			),
			mcp.WithString("status",
				mcp.Description("Optional. Array of statuses to filter by (e.g., [\"PASS\", \"FAIL\"])."),
			),
			mcp.WithString("severity",
				mcp.Description("Optional severity filter (CRITICAL, HIGH, MEDIUM, LOW).If no filter is provided then all severity levels will be returned."),
				mcp.Enum("CRITICAL", "HIGH", "MEDIUM", "LOW"),
			),
			mcp.WithString("order",
				mcp.Description("Order of results (ASC, DESC)"),
				mcp.Enum("ASC", "DESC"),
			),
			mcp.WithString("sort",
				mcp.Description("Sort by field (severity, title)"),
				mcp.Enum("severity", "title"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID

			artifact, err := RequiredParam[string](request, "artifact_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			order, sort, page, size, _ := ParseArtifactListParams(request)

			params := &generated.FetchComplianceResultsByArtifactParams{
				Page:           (*generated.Page)(&page),
				Limit:          (*generated.Limit)(&size),
				Order:          (*generated.FetchComplianceResultsByArtifactParamsOrder)(&order),
				Sort:           (*generated.FetchComplianceResultsByArtifactParamsSort)(&sort),
				HarnessAccount: generated.AccountHeader(config.AccountID),
			}
			body, err := BuildComplianceResultByArtifactFilter(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resp, err := client.FetchComplianceResultsByArtifactWithResponse(ctx, orgID, projectID, artifact, params, body)
			if err != nil {
				return nil, fmt.Errorf("failed to call FetchComplianceResultsByArtifact: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}

			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}
}

// GetCodeRepositoryOverviewTool returns a tool for getting an overview of a code repository from Harness SCS.
func GetCodeRepositoryOverviewTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_code_repository_overview",
			mcp.WithDescription(`
				Retrieves an overview of a specific code repository from Harness SCS, including vulnerabilities, SBOM (Software Bill of Materials), compliance issues, and policy violations.
				Show in data table format unless otherwise specified.

				Usage Guidance:
				- Use this tool to inspect the security and compliance posture of a code repository.
				- The required input is repo_identifier (artifactId, UUID format).

				How to obtain repo_identifier:
				1. If you do not know the artifactId for the repository:
				- Use the 'list_scs_code_repos' tool with a relevant search_term (such as part of the repo name or URL) to filter the list of repositories.
				- Use the artifactId from the response as the repo_identifier for this tool.

				This tool is essential for repository-level risk assessment, compliance reporting, and security audits.
				`),
			mcp.WithString("repo_identifier",
				mcp.Required(),
				mcp.Description(`
						The identifier of the code repository (artifactId, UUID format).

						How to obtain:
						- Use the 'list_scs_code_repos' tool to find the repository by name or URL and copy its artifactId.
						`),
			),
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID

			repoIdentifier, err := RequiredParam[string](request, "repo_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &generated.GetCodeRepositoryOverviewParams{
				HarnessAccount: generated.AccountHeader(config.AccountID),
			}
			resp, err := client.GetCodeRepositoryOverviewWithResponse(ctx, orgID, projectID, repoIdentifier, params)
			if err != nil {
				return nil, fmt.Errorf("failed to call GetCodeRepositoryOverview: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}

			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}
}

// CreateOPAPolicyTool returns a tool for creating OPA policies based on a list of licenses to deny
func CreateOPAPolicyTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_opa_policy",
			mcp.WithDescription(`
			Creates an OPA policy based on a list of denied licenses.
			
			Usage Guidance:
			- Use this tool to generate an OPA policy that will deny artifacts with specific licenses.
			- Provide a list of license identifiers (e.g., "GPL-2.0-only", "AGPL-3.0") to be denied.
			- Optionally specify a custom policy template or use the default template.
			
			This tool is useful for creating license compliance policies in Harness SCS.
			`),
			mcp.WithArray("licenses",
				mcp.Required(),
				mcp.Description(`
				Array of license identifiers to be denied.
				
				Examples:
				- ["GPL-2.0-only", "BSD-2-Clause", "AGPL-3.0"]
				- ["MIT", "Apache-2.0"]
				`),
				mcp.Items(map[string]any{
					"type": "string",
				}),
			),

			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			_, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get licenses parameter
			licenses, err := OptionalStringArrayParam(request, "licenses")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("Error with 'licenses' parameter: %v", err)), nil
			}

			if len(licenses) == 0 {
				return mcp.NewToolResultError("missing required parameter: licenses"), nil
			}

			// Generate the deny_list block
			var entries []string
			for _, lic := range licenses {
				entries = append(entries, fmt.Sprintf(`    {"license": {"value": "%s", "operator": "=="}},`, lic))
			}
			// Remove trailing comma from the last entry (for clean formatting)
			if len(entries) > 0 {
				entries[len(entries)-1] = strings.TrimSuffix(entries[len(entries)-1], ",")
			}
			denyListBlock := fmt.Sprintf("deny_list := fill_default_deny_rules([\n%s\n])", strings.Join(entries, "\n"))

			// Read template from embedded resources
			var template string
			templatePath := "templates/opa/scs_opa.rego"

			templateBytes, err := resources.Templates.ReadFile(templatePath)
			if err != nil {
				// If template file not found in embedded resources, log warning and use default template
				slog.Warn(fmt.Sprintf("Warning: Template file not found in embedded resources at %s: %v. Using default template instead.", templatePath, err))
				return mcp.NewToolResultError(err.Error()), nil
			}
			template = string(templateBytes)

			// Replace placeholder with deny list block
			finalPolicy := strings.Replace(template, "{{DENY_LIST}}", denyListBlock, 1)

			response := map[string]interface{}{
				"policy":          finalPolicy,
				"denied_licenses": licenses,
			}

			out, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			// Compute suggestions for OPA policies
			suggestions := []string{
				"Show me more examples of OPA policies",
				"How can I test this policy?",
				"Create a policy to deny specific CVE severities",
			}

			// Use the OPA builder to format the response
			return appseccommons.NewToolResultTextWithPrompts(string(builder.OPAEvent), string(out), suggestions, "scs_result", []string{"policy", "denied_licenses"}), nil
		}
}

// GetSCSTool returns a tool for getting SCS (Supply Chain Security) details
func ListSCSCodeReposTool(config *config.Config, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_scs_code_repos",
			mcp.WithDescription(`
			Lists all code repositories that have been scanned by Harness SCS (Supply Chain Security).Show in data table format unless otherwise specified.

			Usage Guidance:
			- Use this tool to retrieve a complete list of scanned code repositories in your organization and project.
			- You can optionally filter the results by providing a search_term that matches part of the repository name or URL.

			Filters Supported:
				- search_term (fuzzy tag match)
				- dependency_filter (e.g.,{"field_name": "ComponentVersion", "operator": "Equals", "value": "1.2.3"})
				- license_filter (e.g.,{"operator": "Contains", "value": "MIT"})

			Examples:
			- To list all code repositories: run the tool without a search_term.
			- To search for a specific repository: set search_term to a substring of the repo name, e.g., 'harness/harness-mcp'.

			This tool is useful for SBOM, risk and compliance, and security audit purposes.
			`),
			mcp.WithString("search_term",
				mcp.Description(`
			Optional parameter to filter code repositories by name or URL.

			Usage:
			- Provide any substring of the repository name or its URL to narrow down the search results.

			Examples:
			- 'github.com/harness/harness-mcp' will match any repository containing this string.
			- 'harness/harness-mcp' will also match repositories with that substring.
			- Leaving this blank will return all scanned code repositories.

			Use this parameter to quickly find specific repositories in large organizations.
			`),
			),
			mcp.WithString("dependency_filter",
				mcp.Description(`Optional. Filter code repositories by component name and version.
				- Expects a JSON array of objects, where each object must include:
					- "field_name": the name of the component property to filter on (string).Only ComponentName and ComponentVersion are supported.
					- "operator": the comparison operator to use (string, see allowed values below)
					- "value": the value to compare against (string)
				- Allowed operator values:
					- Equals
					- StartsWith
					- Contains
					- NotEquals
					- GreaterThan
					- GreaterThanEquals
				- LessThan
				- LessThanEquals
			- Example:
				[
				{"field_name": "ComponentVersion", "operator": "Equals", "value": "1.2.3"},
				{"field_name": "ComponentName", "operator": "StartsWith", "value": "lib"}
				]
			`),
			),
			mcp.WithString("license_filter",
				mcp.Description(`Optional. Filter code repositories by license type.
			- Accepts license names, or a JSON object for structured filtering.
			- For structured filtering, provide an object with:
				- "operator": the operator to use for matching (allowed values: Contains, Equals, StartsWith)
				- "value": the license string to match (e.g., "MIT")
			- Allowed operator values:
				- Equals
				- Contains
				- StartsWith
			- Example:
				{
					"operator": "Contains",
					"value": "MIT"
				}
			`),
			),
			mcp.WithString("order",
				mcp.Description("Order of results (ASC, DESC)"),
				mcp.Enum("ASC", "DESC"),
			),
			mcp.WithString("sort",
				mcp.Description("Optional parameter to sort by field (compliance_results, last_scan).If you skip this parameter it will sort on repository name"),
				mcp.Enum("compliance_results", "last_scan"),
			),
			WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract org and project from scope
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID
			order, sort, page, size, _ := ParseArtifactListParams(request)
			if sort == "" {
				sort = "last_scan"
			}
			params := &generated.CodeRepositoriesListParams{
				Limit:          (*generated.Limit)(&size),
				Page:           (*generated.Page)(&page),
				Sort:           (*generated.CodeRepositoriesListParamsSort)(&sort),
				Order:          (*generated.CodeRepositoriesListParamsOrder)(&order),
				HarnessAccount: generated.AccountHeader(config.AccountID),
			}
			body, err := buildCodeRepositoryListingBody(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			resp, err := client.CodeRepositoriesListWithResponse(ctx, orgID, projectID, params, body)
			if err != nil {
				return nil, fmt.Errorf("failed to call CodeRepositoriesList: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}

			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}

}
