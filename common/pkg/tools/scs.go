package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"
	"strings"
	"time"

	config "github.com/harness/mcp-server/common"
	generated "github.com/harness/mcp-server/common/client/scs/generated"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/harness/mcp-server/common/pkg/resources"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// ListArtifactSourcesTool returns a tool for listing artifact sources.
func ListArtifactSourcesTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_scs_artifact_sources",
			mcp.WithDescription(`
			Lists all artifacts available in Harness SCS.

			Output Format:
			Show output in the following format, other than this format don't show any other section:
			
			## Summary
			-[Provide a 2-3 sentence summary. Don't highlight the artifacts details]
						
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
				mcp.Description("Sort by field (severity, title,updated). Always go with updated unlesss specified otherwise"),
				mcp.Enum("severity", "title", "updated"),
				mcp.DefaultString("updated"),
			),
			mcp.WithNumber("page",
				mcp.Description("Page number for pagination - page 0 is the first page"),
				mcp.Min(0),
				mcp.DefaultNumber(0),
			),
			mcp.WithNumber("size",
				mcp.Description("Number of items per page.Always take 5 items per page,unless specified otherwise."),
				mcp.Min(1),
				mcp.DefaultNumber(5),
				mcp.Max(10),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID := scope.OrgID
			projectID := scope.ProjectID
			order, _, page, size, sortVal := ParseArtifactListParams(request)
			params := &generated.ListArtifactSourcesParams{
				Page:           (*generated.Page)(&page),
				Limit:          (*generated.Limit)(&size),
				HarnessAccount: generated.AccountHeader(scope.AccountID),
				Order:          (*generated.ListArtifactSourcesParamsOrder)(&order),
				Sort:           &sortVal,
			}
			size = 5
			artifactParams := &generated.ArtifactListV2Params{
				Page:           (*generated.Page)(&page),
				Limit:          (*generated.Limit)(&size),
				HarnessAccount: generated.AccountHeader(scope.AccountID),
				Order:          (*generated.ArtifactListV2ParamsOrder)(&order),
				Sort:           &sortVal,
			}

			// build the body using a helper function
			body, err := BuildArtifactListingBody(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			slog.InfoContext(ctx, "Body generated by BuildArtifactListingBody", "body", body)

			resp, err := client.ListArtifactSourcesWithResponse(ctx, orgID, projectID, params, body)
			if err != nil {
				return nil, fmt.Errorf("failed to call ListArtifactSources: %w", err)
			}
			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d", resp.StatusCode())
			}

			// Enrich each source with artifact details
			var enrichedArtifacts []generated.ArtifactV2ListingResponse
			//Note: SearchTerm can't be passed as we search on digest or tag in artifact list v2
			body.SearchTerm = nil
			if resp.JSON200 != nil {
				for _, src := range *resp.JSON200 {
					if src.SourceId != nil && *src.SourceId != "" {
						slog.InfoContext(ctx, "Fetching artifact details for source", "sourceId", *src.SourceId, "name", *src.Name)
						artifactResp, err := client.ArtifactListV2WithResponse(ctx, orgID, projectID, *src.SourceId, artifactParams, body)
						if err != nil {
							slog.ErrorContext(ctx, "Failed to call ArtifactListV2", "error", err)
							continue // skip on error
						}
						if artifactResp.StatusCode() >= 200 && artifactResp.StatusCode() < 300 && artifactResp.JSON200 != nil {
							enrichedArtifacts = append(enrichedArtifacts, *artifactResp.JSON200...)
						}
					}
				}
			}

			rows := []map[string]interface{}{}
			for _, artifact := range enrichedArtifacts {
				row := map[string]interface{}{}
				if artifact.Id != nil {
					row["id"] = *artifact.Id
				}
				if artifact.Digest != nil {
					row["digest"] = *artifact.Digest
				}
				if artifact.Name != nil {
					row["name"] = *artifact.Name
				}
				if artifact.Tags != nil {
					row["tags"] = strings.Join(*artifact.Tags, "\n")
				}
				if artifact.Url != nil {
					row["url"] = *artifact.Url
				}
				if artifact.Metadata != nil {
					row["metadata"] = *artifact.Metadata
				}
				if artifact.ComponentsCount != nil {
					row["components"] = *artifact.ComponentsCount
				}
				if artifact.Updated != nil {
					// Try to parse millis and format as date, fallback to raw string
					if tsMillis, err := strconv.ParseInt(*artifact.Updated, 10, 64); err == nil {
						tsSecs := tsMillis / 1000
						t := time.Unix(tsSecs, 0)
						row["updated"] = t.Format("02/01/2006 15:04")
					} else {
						row["updated"] = *artifact.Updated
					}
				}
				if artifact.Scorecard != nil && artifact.Scorecard.AvgScore != nil {
					row["scorecard"] = formatScorecard(*artifact.Scorecard.AvgScore)
				}
				if artifact.PolicyEnforcement != nil {
					pe := map[string]interface{}{}
					if artifact.PolicyEnforcement.AllowListViolationCount != nil {
						pe["allow list"] = *artifact.PolicyEnforcement.AllowListViolationCount
					}
					if artifact.PolicyEnforcement.DenyListViolationCount != nil {
						pe["deny list"] = *artifact.PolicyEnforcement.DenyListViolationCount
					}
					row["sbom violations"] = pe
				}
				if artifact.Deployment != nil {
					dep := map[string]interface{}{}
					if artifact.Deployment.ProdEnvCount != nil {
						dep["Prod"] = *artifact.Deployment.ProdEnvCount
					}
					if artifact.Deployment.NonProdEnvCount != nil {
						dep["Non Prod"] = *artifact.Deployment.NonProdEnvCount
					}
					row["deployment"] = dep
				}
				if artifact.Orchestration != nil {
					orch := map[string]interface{}{}
					if artifact.Orchestration.Id != nil {
						orch["id"] = *artifact.Orchestration.Id
					}
					if artifact.Orchestration.PipelineId != nil {
						orch["pipeline_id"] = *artifact.Orchestration.PipelineId
					}
					if artifact.Orchestration.PipelineExecutionId != nil {
						orch["pipeline_execution_id"] = *artifact.Orchestration.PipelineExecutionId
					}
					row["orchestration"] = orch
				}
				if artifact.StoIssueCount != nil {
					row["vulnerabilities"] = mapVulnerabilities(artifact.StoIssueCount)
				}
				if artifact.Signing != nil {
					row["signing"] = artifact.Signing.Rekor.Signature
				}
				if artifact.ArtifactType != nil {
					row["artifact_type"] = artifact.ArtifactType.Type
				}
				rows = append(rows, row)
			}

			// Extract pagination info from response headers
			pagination := extractPaginationFromHeaders(resp.HTTPResponse.Header)

			// Build response with pagination info
			listResponse := ArtifactSourcesListResponse{
				Pagination: pagination,
				Artifacts:  enrichedArtifacts,
			}

			rawEnrichedArtifacts, err := json.Marshal(listResponse)
			if err != nil {
				return nil, fmt.Errorf("failed to format response: %w", err)
			}

			responseContents := []mcp.Content{
				mcp.NewTextContent(string(rawEnrichedArtifacts)),
			}

			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}
}

// ArtifactListV2Tool returns a tool for listing artifacts from a source.
func ArtifactListV2Tool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_scs_artifacts_per_source",
			mcp.WithDescription(`
			Lists all artifacts from a specified artifact source in Harness SCS.Call this tool with sourceId of the artifact source.
			Show in data table format unless otherwise specified.

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
			- Use the 'list_scs_artifact_sources' tool with a relevant search_term (e.g., image name like 'alpine' or 'docker.io/library/alpine:latest') to find the artifact source.
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
			common.WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
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
				HarnessAccount: generated.AccountHeader(scope.AccountID),
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
func GetArtifactV2OverviewTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scs_artifact_overview",
			mcp.WithDescription(`
				Retrieves an overview of a specific artifact from a source in Harness SCS.

				This tool returns details such as metadata, security findings, SBOM information, and compliance status for the given artifact.

				Usage Guidance:
				- Use this tool to inspect the security and compliance posture of an artifact.
				- Required inputs: source (sourceId) and artifact_identifier (artifactId, UUID format).

				How to obtain artifactId:
				1. If you do not know the artifactId:
				- Use the 'list_scs_artifact_sources' tool with a relevant search_term (e.g., image name like 'docker.io/library/alpine:latest') to locate the artifact id.
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
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
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
				HarnessAccount: generated.AccountHeader(scope.AccountID),
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

// GetArtifactDetailComponentViewTool returns a tool for getting detailed component view of an artifact.
func GetArtifactDetailComponentViewTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scs_artifact_component_view",
			mcp.WithDescription(`
				Retrieves a detailed component view of a specific artifact in Harness SCS.

				This tool returns the list of components (dependencies) included in the artifact's SBOM,
				along with details such as package name, version, license, vulnerabilities, and health status.

				Usage Guidance:
				- Use this tool to inspect the components/dependencies of an artifact.
				- Required input: artifact_identifier (artifactId, UUID format).

				How to obtain artifactId:
				1. If you do not know the artifactId:
				- For artifact Use the 'list_scs_artifact_sources'  tool with a relevant search_term (e.g., image name like 'docker.io/library/alpine:latest') to locate the source_id.
				- For repo Use list_scs_code_repos tool to locate the id of the repo and use it as artifact_identifier for this tool.

				Filters Supported:
				- component_filter (filter by component name/version)
				- license_filter (filter by license type)
				- dependency_type_filter (DIRECT, TRANSITIVE, UNKNOWN)
				- image_layer (OS, APP)
				- package_manager (e.g., npm, pip, maven)
				- package_supplier (filter by supplier)

				Tip: Use pagination parameters to handle large component lists.
				`),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the artifact (artifactId, UUID format)."),
			),
			mcp.WithString("component_filter",
				mcp.Description(`Optional. Filter components by name or version.
				- Expects a JSON array of objects, where each object must include:
					- "field_name": the name of the component property to filter on (string). Only ComponentName and ComponentVersion are supported.
					- "operator": the comparison operator to use (string)
					- "value": the value to compare against (string)
				- Allowed operator values: Equals, StartsWith, Contains, NotEquals, GreaterThan, GreaterThanEquals, LessThan, LessThanEquals
				- Example:
				[
					{"field_name": "ComponentName", "operator": "Contains", "value": "lodash"},
					{"field_name": "ComponentVersion", "operator": "Equals", "value": "4.17.21"}
				]
				`),
			),
			mcp.WithString("license_filter",
				mcp.Description(`Optional. Filter components by license.
				- Provide an object with:
					- "operator": the operator to use for matching (allowed values: Contains, Equals, StartsWith)
					- "value": the license string to match (e.g., "MIT")
				- Example:
				{
					"operator": "Contains",
					"value": "MIT"
				}
				`),
			),
			mcp.WithString("dependency_type_filter",
				mcp.Description(`Optional. Filter by dependency type. Accepts a JSON array of dependency types.
				- Allowed values: DIRECT, TRANSITIVE, UNKNOWN
				- Example: ["DIRECT", "TRANSITIVE"]
				`),
			),
			mcp.WithString("image_layer",
				mcp.Description("Optional. Filter by image layer type."),
				mcp.Enum("OS", "APP"),
			),
			mcp.WithString("package_manager",
				mcp.Description("Optional. Filter by package manager (e.g., npm, pip, maven, go)."),
			),
			mcp.WithString("package_supplier",
				mcp.Description("Optional. Filter by package supplier."),
			),
			mcp.WithString("order",
				mcp.Description("Order of results (ASC, DESC)"),
				mcp.Enum("ASC", "DESC"),
				mcp.DefaultString("ASC"),
			),
			mcp.WithString("sort",
				mcp.Description("Sort by field (package_name, package_supplier)"),
				mcp.Enum("package_name", "package_supplier"),
				mcp.DefaultString("package_name"),
			),
			common.WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
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
			// Default sort to package_name if not provided (API requires non-empty sort)
			if sort == "" {
				sort = "package_name"
			}
			params := &generated.GetArtifactV2DetailComponentViewParams{
				Page:           (*generated.Page)(&page),
				Limit:          (*generated.Limit)(&size),
				HarnessAccount: generated.AccountHeader(scope.AccountID),
				Order:          (*generated.GetArtifactV2DetailComponentViewParamsOrder)(&order),
				Sort:           (*generated.GetArtifactV2DetailComponentViewParamsSort)(&sort),
			}

			// Build the request body
			body, err := BuildArtifactComponentViewBody(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Serialize body to JSON for logging
			bodyJSON, _ := json.Marshal(body)

			// Log all parameters used for the API call
			slog.InfoContext(ctx, "GetArtifactV2DetailComponentView API call parameters",
				"accountID", scope.AccountID,
				"orgID", orgID,
				"projectID", projectID,
				"artifact", artifact,
				"page", page,
				"limit", size,
				"order", order,
				"sort", sort,
				"bodyJSON", string(bodyJSON),
			)

			resp, err := client.GetArtifactV2DetailComponentViewWithResponse(ctx, orgID, projectID, artifact, params, body)
			if err != nil {
				return nil, fmt.Errorf("failed to call GetArtifactV2DetailComponentView: %w", err)
			}

			slog.InfoContext(ctx, "GetArtifactV2DetailComponentView API response",
				"statusCode", resp.StatusCode(),
				"responseLength", len(resp.Body),
				"responseBody", string(resp.Body),
			)

			if resp.StatusCode() < 200 || resp.StatusCode() >= 300 {
				return nil, fmt.Errorf("non-2xx status: %d, body: %s", resp.StatusCode(), string(resp.Body))
			}

			out, err := json.Marshal(resp.JSON200)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}
			return mcp.NewToolResultText(string(out)), nil
		}
}

// GetArtifactComponentRemediationByPurlTool returns a tool for getting remediation info for a component by its PURL.
func GetArtifactComponentRemediationByPurlTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scs_artifact_component_remediation",
			mcp.WithDescription(`
				Retrieves remediation information for a specific component in an artifact by its Package URL (PURL).

				This tool provides recommendations for upgrading vulnerable or outdated components,
				including the current version, recommended version, target versions, and any warnings.

				Usage Guidance:
				- Use this tool to get remediation advice for a specific component/dependency.
				- Required inputs: artifact_identifier (artifactId, UUID format) and purl (Package URL of the component).

				How to obtain the required inputs:
				1. artifact_identifier:
				   - Use the 'list_scs_artifact_sources' tool to find the artifact.
				   - Use the artifactId from the response.
				2. purl:
				   - Use the 'get_scs_artifact_component_view' tool to list components.
				   - Copy the 'purl' field from the component you want remediation for.

				Example PURL formats:
				- pkg:npm/lodash@4.17.20
				- pkg:maven/org.apache.logging.log4j/log4j-core@2.14.1
				- pkg:pypi/requests@2.25.1

				The response includes:
				- Current and recommended versions
				- Summary of the remediation
				- Target versions to upgrade to
				- Any warnings or additional info
				`),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the artifact (artifactId, UUID format)."),
			),
			mcp.WithString("purl",
				mcp.Required(),
				mcp.Description(`The Package URL (PURL) of the component to get remediation for.
				Example: pkg:npm/lodash@4.17.20`),
			),
			mcp.WithString("target_version",
				mcp.Description("Optional. Target version to check remediation against."),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID := scope.OrgID
			projectID := scope.ProjectID
			artifact, err := RequiredParam[string](request, "artifact_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			purl, err := RequiredParam[string](request, "purl")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			targetVersion, _ := OptionalParam[string](request, "target_version")

			params := &generated.GetArtifactComponentRemediationByPurlParams{
				Purl:           purl,
				HarnessAccount: generated.AccountHeader(scope.AccountID),
			}
			if targetVersion != "" {
				tv := generated.TargetVersion(targetVersion)
				params.TargetVersion = &tv
			}

			resp, err := client.GetArtifactComponentRemediationByPurlWithResponse(ctx, orgID, projectID, artifact, params)
			if err != nil {
				return nil, fmt.Errorf("failed to call GetArtifactComponentRemediationByPurl: %w", err)
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
func GetArtifactChainOfCustodyV2Tool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scs_artifact_chain_of_custody",
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
				- Use the 'list_scs_artifact_sources' tool with a relevant search_term (e.g., image name
					like 'alpine') to locate the artifact id.
				- Select the 1st artifact and use its artifactId as input to this tool.

				This tool is essential for supply chain transparency, compliance, and forensic investigations.
				`),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Pattern("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"),
				mcp.Description(`The identifier of the artifact (e.g. artifactId).`),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
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
				HarnessAccount: generated.AccountHeader(scope.AccountID),
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
func FetchComplianceResultsByArtifactTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("fetch_scs_compliance_results_for_repo_by_id",
			mcp.WithDescription(`
				Fetch compliance results for a specific CI/CD build systems or repositories from Harness SCS. Show in data table format unless otherwise specified.

				Usage Guidance:
				- Use this tool to retrieve compliance results for a specific CI/CD build system or repository.
				- The required input is artifact_identifier (artifactId, UUID format).

				How to obtain artifact_identifier:
				- If you do not know the artifact_identifier:
				1. Use the 'list_scs_code_repos' tool with a relevant search_term (such as an repository name like 'harness-mcp').
				2. Select the desired artifact and use its artifact_identifier as the input to this tool.


				Filters Supported:
				- search_term (fuzzy tag match)
				- standards (e.g., ["CIS", "OWASP"])
				- severity (CRITICAL, HIGH, MEDIUM, LOW)
				- status (e.g., ["PASS", "FAIL"])
				- order (ASC, DESC)
				- sort (severity, title)

				Tip: Use the artifactId with the 'get_artifact_overview' tool to retrieve detailed information about the artifact.
				`),
			mcp.WithString("artifact_identifier",
				mcp.Required(),
				mcp.Description(`
				The identifier of the repo or ci/cd artifact (e.g., artifactId, UUID format).Show in data table format unless otherwise specified.

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
			common.WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
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
				HarnessAccount: generated.AccountHeader(scope.AccountID),
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
func GetCodeRepositoryOverviewTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_scs_code_repository_overview",
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
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, true)
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
				HarnessAccount: generated.AccountHeader(scope.AccountID),
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
func CreateOPAPolicyTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("create_scs_opa_policy",
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

			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			_, err := common.FetchScope(ctx, config, request, true)
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
				slog.WarnContext(ctx, fmt.Sprintf("Warning: Template file not found in embedded resources at %s: %v. Using default template instead.", templatePath, err))
				return mcp.NewToolResultError(err.Error()), nil
			}
			template = string(templateBytes)

			// Replace placeholder with deny list block
			finalPolicy := strings.Replace(template, "{{DENY_LIST}}", denyListBlock, 1)

			opaContent := OPAContent{}
			opaContent.Policy.Name = "deny-list"
			opaContent.Policy.Content = finalPolicy
			opaContent.Metadata.DeniedLicenses = licenses

			// Serialize the OPA component for text fallback
			opaJSON, err := json.Marshal(opaContent)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal OPA content: %w", err)
			}

			responseContents := []mcp.Content{
				mcp.NewTextContent(string(opaJSON)),
			}

			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}
}

// DownloadSbomTool returns a tool that provides the download URL for an SBOM.
func DownloadSbomTool(cfg *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("download_scs_sbom",
			mcp.WithDescription(`
		Returns the download URL for the Software Bill of Materials (SBOM) for a given artifact orchestration in Harness SCS.

		How to obtain orchestration_id:

		1. If you do not know the orchestration_id:
		- For artifact orchestration, use the 'list_artifact_scs' tool with a relevant search_term (e.g., image name
			like 'alpine'). Then look for orchestration object which contains id in json response eg:
			"orchestration": {
            "id": <id>,
            "pipeline_id": <pipeline_id>,
            "pipeline_execution_id": <pipeline_execution_id>
        }
		- For repository orchestration, use the 'list_scs_code_repos' tool with a relevant search_term (e.g., repository name
			like 'my-repo') to find the repository orchestration_id.

		Usage Guidance:
		- Use this tool to get the download URL for an SBOM by its orchestration_id.
		- The response contains a URL that can be used to download the SBOM directly.
		- The URL requires authentication headers (Harness-Account and x-api-key) to access.
		`),
			mcp.WithString("orchestration_id",
				mcp.Required(),
				mcp.Description(`Required. The orchestration ID for the artifact whose SBOM download URL you want. eg: '8nehRXghR2C8ZWMHiyzxCg'`),
			),
			common.WithScope(cfg, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, cfg, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID := scope.OrgID
			projectID := scope.ProjectID
			orchestrationID, err := RequiredParam[string](request, "orchestration_id")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Construct the download URL
			baseURL := buildSCSBaseURL(cfg)
			downloadURL := fmt.Sprintf("%s/v1/orgs/%s/projects/%s/orchestration/%s/sbom-download",
				strings.TrimSuffix(baseURL, "/"),
				orgID,
				projectID,
				orchestrationID,
			)

			response := SbomDownloadResponse{
				OrchestrationID: orchestrationID,
				DownloadURL:     downloadURL,
				Message:         "Use this URL to download the SBOM. Include 'Harness-Account' header with your account ID and appropriate authentication.",
			}

			out, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal response: %w", err)
			}

			responseContents := []mcp.Content{
				mcp.NewTextContent(string(out)),
			}

			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}
}

// ListSCSCodeReposTool returns a tool for listing code repositories from Harness SCS.
func ListSCSCodeReposTool(config *config.McpServerConfig, client *generated.ClientWithResponses) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_scs_code_repos",
			mcp.WithDescription(`
			Lists all code repositories that have been scanned by Harness SCS (Supply Chain Security).Show in data table format unless otherwise specified.

			NOTE: Don't show any table format for the results . Just summarize the final results in the following format:
			
			## Summary
			[Provide a 2-3 sentence summary of the key information]
			
			## Key Insights
			- [First key insight about security or compliance]
			- [Second key insight]
			- [Third key insight if applicable]

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
			common.WithScope(config, true),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract org and project from scope
			scope, err := common.FetchScope(ctx, config, request, true)
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
				HarnessAccount: generated.AccountHeader(scope.AccountID),
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

			// Transform JSON200 (which is *[]generated.CodeRepositoryListingResponse) into a table-like structure
			rows := []map[string]interface{}{}
			if resp.JSON200 != nil {
				for _, repo := range *resp.JSON200 {
					row := map[string]interface{}{}
					if repo.Name != nil {
						variant := map[string]interface{}{}
						variant["name"] = *repo.Name
						if repo.Variant != nil {
							if repo.Variant.Type != nil {
								variant["type"] = *repo.Variant.Type
							}
							if repo.Variant.Value != nil {
								variant["value"] = *repo.Variant.Value
							}
							row["name"] = variant
						}
					}
					if repo.RepositoryPlatform != nil {
						row["platform"] = repo.RepositoryPlatform // You may want to format this as string if needed
					}
					if repo.DependenciesCount != nil {
						row["dependencies"] = *repo.DependenciesCount
					}
					if repo.RiskAndCompliance != nil {
						row["compliance"] = mapCompliance(repo.RiskAndCompliance)
					}
					if repo.StoIssueCount != nil {
						row["vulnerabilities"] = mapVulnerabilities(repo.StoIssueCount)
					}
					if repo.Scorecard != nil && repo.Scorecard.AvgScore != nil {
						row["sbom_score"] = formatScorecard(*repo.Scorecard.AvgScore)
					}
					if repo.Url != nil {
						row["repo_path"] = *repo.Url
					}
					if repo.LastScan != nil {
						row["last_scan"] = mapLastScan(repo.LastScan)
					}
					rows = append(rows, row)
				}
			}

			// Extract pagination info from response headers
			pagination := extractPaginationFromHeaders(resp.HTTPResponse.Header)

			// Build response with pagination info
			listResponse := CodeReposListResponse{
				Pagination:   pagination,
				Repositories: resp.JSON200,
			}

			// Always include basic JSON data for external clients
			raw, err := json.Marshal(listResponse)
			if err != nil {
				return mcp.NewToolResultErrorf("Failed to marshal response: %v. Found %d repositories.", err, len(rows)), nil
			}

			responseContents := []mcp.Content{
				mcp.NewTextContent(string(raw)),
			}

			return &mcp.CallToolResult{
				Content: responseContents,
			}, nil
		}

}
