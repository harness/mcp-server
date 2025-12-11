package tools

import (
	"context"
	"encoding/json"
	"fmt"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetSecretTool creates a tool for retrieving a secret from Harness
func GetSecretTool(config *config.McpServerConfig, client *client.SecretsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_secret",
			mcp.WithDescription("Get a secret by identifier from Harness."),
			mcp.WithString("secret_identifier",
				mcp.Required(),
				mcp.Description("Identifier of the secret to retrieve"),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			secretIdentifier, err := RequiredParam[string](request, "secret_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the client to get the secret
			response, err := client.GetSecret(ctx, scope, secretIdentifier)
			if err != nil {
				return nil, fmt.Errorf("failed to get secret: %w", err)
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal secret response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// Secret types supported by the Harness secrets API
const (
	SecretTypeSecretFile       = "SecretFile"
	SecretTypeSecretText       = "SecretText"
	SecretTypeSSHKey           = "SSHKey"
	SecretTypeWinRmCredentials = "WinRmCredentials"
)

// Sort fields for secrets
const (
	SortByName       = "name"
	SortByIdentifier = "identifier"
	SortByCreated    = "created"
	SortByUpdated    = "updated"
)

// ListSecretsTool creates a tool for listing secrets from Harness
func ListSecretsTool(config *config.McpServerConfig, client *client.SecretsClient) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_secrets",
			mcp.WithDescription("List secrets from Harness with filtering and pagination options."),
			mcp.WithArray("secret",
				mcp.WithStringItems(),
				mcp.Description("Identifier field of secrets"),
			),
			mcp.WithArray("type",
				mcp.WithStringItems(),
				mcp.Description("Secret types on which the filter will be applied"),
				mcp.Enum(
					SecretTypeSecretFile,
					SecretTypeSecretText,
					SecretTypeSSHKey,
					SecretTypeWinRmCredentials,
				),
			),
			mcp.WithBoolean("recursive",
				mcp.Description("Expand current scope to include all child scopes"),
			),
			mcp.WithString("search_term",
				mcp.Description("Filter resources having attributes matching with search term"),
			),
			mcp.WithString("filter_type",
				mcp.Description("Type of resources to filter"),
				mcp.Enum(
					"Secret", "Connector", "DelegateProfile", "Delegate", "PipelineSetup",
					"PipelineExecution", "Deployment", "Audit", "Template", "Trigger",
					"EnvironmentGroup", "FileStore", "CCMRecommendation", "Anomaly",
					"RIInventory", "SPInventory", "Autocud", "CCMConnector",
					"CCMK8sConnector", "Environment", "RuleExecution", "Override",
					"InputSet", "Webhook",
				),
			),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get pagination parameters
			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Get filter parameters
			secretIds, err := OptionalAnyArrayParam(request, "secret")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Convert []any to []string
			secretIdsStr := make([]string, 0, len(secretIds))
			for _, id := range secretIds {
				if str, ok := id.(string); ok {
					secretIdsStr = append(secretIdsStr, str)
				}
			}

			secretTypes, err := OptionalAnyArrayParam(request, "type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Convert []any to []string
			secretTypesStr := make([]string, 0, len(secretTypes))
			for _, t := range secretTypes {
				if str, ok := t.(string); ok {
					secretTypesStr = append(secretTypesStr, str)
				}
			}

			recursive, err := OptionalParam[bool](request, "recursive")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			searchTerm, err := OptionalParam[string](request, "search_term")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Temporarily removing sort orders due to API compatibility issues
			// We'll revisit this once we have more information about the expected format
			sortOrders := []string{}

			// Get filter_type parameter
			filterType, err := OptionalParam[string](request, "filter_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create filter properties
			filters := dto.SecretFilterProperties{
				SecretTypes:                     secretTypesStr,
				SearchTerm:                      searchTerm,
				IncludeSecretsFromEverySubScope: recursive,
				FilterType:                      filterType,
			}

			// If secretIds is provided, use the first one as secretIdentifier
			if len(secretIdsStr) > 0 {
				filters.SecretIdentifier = secretIdsStr[0]
			}

			// Call the client to list secrets
			response, err := client.ListSecrets(ctx, scope, page, size, sortOrders, filters)
			if err != nil {
				return nil, fmt.Errorf("failed to list secrets: %w", err)
			}

			r, err := json.Marshal(response)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list secrets response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
