package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/harness/harness-mcp/client"
	clientdto "github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	pkgdto "github.com/harness/harness-mcp/pkg/harness/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// parseStringSlice converts a comma-separated string to a slice of strings
func parseStringSlice(input string) []string {
	if input == "" {
		return nil
	}
	parts := strings.Split(input, ",")
	var result []string
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func ListConnectorCatalogueTool(harnessConfig *config.Config, connectorService *client.ConnectorService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_connector_catalogue",
			mcp.WithDescription("List the Harness connector catalogue."),
			WithScope(harnessConfig, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(harnessConfig, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			catalogue, err := connectorService.ListConnectorCatalogue(ctx, scope)
			if err != nil {
				return nil, fmt.Errorf("failed to list connector catalogue: %w", err)
			}

			responseBytes, err := json.Marshal(catalogue)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connector catalogue: %w", err)
			}

			return mcp.NewToolResultText(string(responseBytes)), nil
		}
}

// GetConnectorDetailsTool creates a tool for getting details of a specific connector
// https://apidocs.harness.io/tag/Connectors#operation/getConnector
func GetConnectorDetailsTool(config *config.Config, connectorService *client.ConnectorService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("get_connector_details",
			mcp.WithDescription("Get detailed information about a specific connector."),
			mcp.WithString("connector_identifier",
				mcp.Required(),
				mcp.Description("The identifier of the connector"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			connectorIdentifier, err := RequiredParam[string](request, "connector_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := connectorService.GetConnector(ctx, scope, connectorIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get connector: %w", err)
			}

			// Marshal the connector data to JSON and unmarshal to client DTO type
			jsonData, err := json.Marshal(*data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connector: %w", err)
			}

			var clientDetail clientdto.ConnectorDetail
			err = json.Unmarshal(jsonData, &clientDetail)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal connector: %w", err)
			}

			// Convert to human-readable time fields
			response := clientdto.ToConnectorDetail(clientDetail)
			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connector: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListConnectorsTool creates a tool for listing connectors with filtering options
// https://apidocs.harness.io/tag/Connectors#operation/getConnectorListV2
func ListConnectorsTool(config *config.Config, connectorService *client.ConnectorService) (mcp.Tool, server.ToolHandlerFunc) {
	return mcp.NewTool("list_connectors",
			mcp.WithDescription("List connectors with filtering options."),
			mcp.WithString("connector_names",
				mcp.Description("Comma-separated list of connector names to filter by"),
			),
			mcp.WithString("connector_identifiers",
				mcp.Description("Comma-separated list of connector identifiers to filter by"),
			),
			mcp.WithString("description",
				mcp.Description("Filter by connector description"),
			),
			mcp.WithString("types",
				mcp.Description("Comma-separated list of connector types"),
				mcp.Enum("K8sCluster", "Git", "Splunk", "AppDynamics", "Prometheus", "Dynatrace", "Vault", "AzureKeyVault", "DockerRegistry", "Local", "AwsKms", "GcpKms", "AwsSecretManager", "Gcp", "Aws", "Azure", "Artifactory", "Jira", "Nexus", "Github", "Gitlab", "Bitbucket", "Codecommit", "CEAws", "CEAzure", "GcpCloudCost", "CEK8sCluster", "HttpHelmRepo", "NewRelic", "Datadog", "SumoLogic", "PagerDuty", "CustomHealth", "ServiceNow", "ErrorTracking", "Pdc", "AzureRepo", "Jenkins", "OciHelmRepo", "CustomSecretManager", "ElasticSearch", "GcpSecretManager", "AzureArtifacts", "Tas", "Spot", "Bamboo", "TerraformCloud", "SignalFX", "Harness", "Rancher", "JDBC", "Zoom", "MsTeams", "Confluence", "Slack", "Salesforce", "LangSmith", "MLFlow"),
			),
			mcp.WithString("categories",
				mcp.Description("Comma-separated list of connector categories"),
				mcp.Enum("CLOUD_PROVIDER", "SECRET_MANAGER", "CLOUD_COST", "ARTIFACTORY", "CODE_REPO", "MONITORING", "TICKETING", "DATABASE", "COMMUNICATION", "DOCUMENTATION", "ML_OPS"),
			),
			mcp.WithString("connectivity_statuses",
				mcp.Description("Comma-separated list of connectivity statuses"),
				mcp.Enum("SUCCESS", "FAILURE", "PARTIAL", "UNKNOWN", "PENDING"),
			),
			mcp.WithBoolean("inheriting_credentials_from_delegate",
				mcp.Description("Filter by whether connectors inherit credentials from delegate"),
			),
			mcp.WithString("connector_connectivity_modes",
				mcp.Description("Comma-separated list of connectivity modes"),
				mcp.Enum("DELEGATE", "MANAGER"),
			),
			mcp.WithString("tags",
				mcp.Description("JSON object of tags to filter by (e.g., {\"env\":\"prod\"})"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Parse optional parameters
			namesStr, err := OptionalParam[string](request, "connector_names")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			connectorNames := parseStringSlice(namesStr)

			idsStr, err := OptionalParam[string](request, "connector_identifiers")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			connectorIdentifiers := parseStringSlice(idsStr)

			description, err := OptionalParam[string](request, "description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			typesStr, err := OptionalParam[string](request, "types")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			types := parseStringSlice(typesStr)

			categoriesStr, err := OptionalParam[string](request, "categories")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			categories := parseStringSlice(categoriesStr)

			connStatStr, err := OptionalParam[string](request, "connectivity_statuses")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			connectivityStatuses := parseStringSlice(connStatStr)

			connModesStr, err := OptionalParam[string](request, "connector_connectivity_modes")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			connectorConnectivityModes := parseStringSlice(connModesStr)

			var inheritingCredentialsFromDelegate *bool
			if val, exists := request.GetArguments()["inheriting_credentials_from_delegate"]; exists {
				if boolVal, ok := val.(bool); ok {
					inheritingCredentialsFromDelegate = &boolVal
				}
			}

			var tags map[string]string
			tagsStr, err := OptionalParam[string](request, "tags")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if tagsStr != "" {
				if err := json.Unmarshal([]byte(tagsStr), &tags); err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid tags JSON: %v", err)), nil
				}
			}

			data, err := connectorService.ListConnectors(ctx, scope, connectorNames, connectorIdentifiers, types, categories, connectivityStatuses, connectorConnectivityModes, description, inheritingCredentialsFromDelegate, tags)
			if err != nil {
				return nil, fmt.Errorf("failed to list connectors: %w", err)
			}

			// Marshal the list data to JSON and unmarshal to client DTO type
			jsonData, err := json.Marshal(*data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connectors list: %w", err)
			}

			var clientList clientdto.ConnectorListData
			err = json.Unmarshal(jsonData, &clientList)
			if err != nil {
				return nil, fmt.Errorf("failed to unmarshal connectors list: %w", err)
			}

			// Convert to human-readable time fields
			response := clientdto.ToConnectorListData(clientList)
			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal connectors: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// convertToClientConnectorDetail converts pkg/dto.ConnectorDetail to client/dto.ConnectorDetail
func convertToClientConnectorDetail(src pkgdto.ConnectorDetail) clientdto.ConnectorDetail {
	return clientdto.ConnectorDetail{
		Connector: clientdto.Connector{
			Name:              src.Connector.Name,
			Identifier:        src.Connector.Identifier,
			Description:       src.Connector.Description,
			AccountIdentifier: src.Connector.AccountIdentifier,
			OrgIdentifier:     src.Connector.OrgIdentifier,
			ProjectIdentifier: src.Connector.ProjectIdentifier,
			Tags:              src.Connector.Tags,
			Type:              src.Connector.Type,
			Spec:              src.Connector.Spec,
		},
		CreatedAt:      src.CreatedAt,
		LastModifiedAt: src.LastModifiedAt,
		Status: clientdto.ConnectorStatus{
			Status:          src.Status.Status,
			ErrorSummary:    src.Status.ErrorSummary,
			Errors:          convertConnectorErrors(src.Status.Errors),
			TestedAt:        src.Status.TestedAt,
			LastTestedAt:    src.Status.LastTestedAt,
			LastConnectedAt: src.Status.LastConnectedAt,
			LastAlertSent:   src.Status.LastAlertSent,
		},
		ActivityDetails: clientdto.ActivityDetails{
			LastActivityTime: src.ActivityDetails.LastActivityTime,
		},
		HarnessManaged: src.HarnessManaged,
		GitDetails: clientdto.ConnectorGitDetails{
			Valid:       src.GitDetails.Valid,
			InvalidYaml: src.GitDetails.InvalidYaml,
		},
		EntityValidityDetails: clientdto.ConnectorEntityValidityDetails{
			Valid:       src.EntityValidityDetails.Valid,
			InvalidYaml: src.EntityValidityDetails.InvalidYaml,
		},
		GovernanceMetadata: src.GovernanceMetadata,
		IsFavorite:         src.IsFavorite,
	}
}

// convertConnectorErrors converts []pkgdto.ConnectorError to []clientdto.ConnectorError
func convertConnectorErrors(srcErrors []pkgdto.ConnectorError) []clientdto.ConnectorError {
	if srcErrors == nil {
		return nil
	}
	result := make([]clientdto.ConnectorError, len(srcErrors))
	for i, err := range srcErrors {
		result[i] = clientdto.ConnectorError{
			Reason:  err.Reason,
			Message: err.Message,
			Code:    err.Code,
		}
	}
	return result
}

// convertToClientConnectorListData converts pkg/dto.ConnectorListData to client/dto.ConnectorListData
func convertToClientConnectorListData(src pkgdto.ConnectorListData) clientdto.ConnectorListData {
	result := clientdto.ConnectorListData{
		PageInfo: clientdto.PageInfo{
			Page:    src.PageInfo.Page,
			Size:    src.PageInfo.Size,
			HasNext: src.PageInfo.HasNext,
			HasPrev: src.PageInfo.HasPrev,
		},
		Empty:         src.Empty,
		TotalElements: src.TotalElements,
		TotalPages:    src.TotalPages,
	}

	// Convert content items
	if len(src.Content) > 0 {
		result.Content = make([]clientdto.ConnectorDetail, len(src.Content))
		for i, item := range src.Content {
			result.Content[i] = convertToClientConnectorDetail(item)
		}
	}
	return result
}
