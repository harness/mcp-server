package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"             // Corrected import path for Scope
	pkgDTO "github.com/harness/harness-mcp/pkg/harness/dto" // Alias for the other DTOs
)

const (
	listConnectorCataloguePath = "/connectors/catalogue"
	getConnectorPath           = "/connectors/%s"
	listConnectorsPath         = "/connectors/listV2"
)

type ConnectorService struct {
	Client *Client
}

// ListConnectorCatalogue fetches the connector catalogue.
// API Documentation: https://apidocs.harness.io/tag/Connectors#operation/getConnectorCatalogue
func (c *ConnectorService) ListConnectorCatalogue(ctx context.Context, scope dto.Scope) ([]pkgDTO.ConnectorCatalogueItem, error) {
	path := listConnectorCataloguePath
	params := make(map[string]string)
	params["accountIdentifier"] = scope.AccountID
	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
	}
	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
	}

	// Define a struct to match the actual API response structure
	type catalogueResponse struct {
		Status string `json:"status"`
		Data   struct {
			Catalogue []struct {
				Category   string   `json:"category"`
				Connectors []string `json:"connectors"`
			} `json:"catalogue"`
		} `json:"data"`
		MetaData      interface{} `json:"metaData"`
		CorrelationID string      `json:"correlationId"`
	}

	var rawResponse catalogueResponse
	err := c.Client.Get(ctx, path, params, nil, &rawResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to list connector catalogue: %w", err)
	}

	// Convert the response to the expected format
	var result []pkgDTO.ConnectorCatalogueItem
	for _, cat := range rawResponse.Data.Catalogue {
		for _, conn := range cat.Connectors {
			result = append(result, pkgDTO.ConnectorCatalogueItem{
				Category: cat.Category,
				Name:     conn,
			})
		}
	}

	return result, nil
}

// GetConnector retrieves a connector by its identifier
// https://apidocs.harness.io/tag/Connectors#operation/getConnector
func (c *ConnectorService) GetConnector(ctx context.Context, scope dto.Scope, connectorIdentifier string) (*pkgDTO.ConnectorDetail, error) {
	path := fmt.Sprintf(getConnectorPath, connectorIdentifier)
	params := make(map[string]string)
	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(ctx, scope, params)

	// Define a struct to match the actual API response structure
	type connectorResponse struct {
		Status        string                 `json:"status"`
		Data          pkgDTO.ConnectorDetail `json:"data"`
		MetaData      interface{}            `json:"metaData"`
		CorrelationID string                 `json:"correlationId"`
	}

	var response connectorResponse
	err := c.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get connector: %w", err)
	}

	return &response.Data, nil
}

// ListConnectors retrieves a list of connectors with filtering options
// https://apidocs.harness.io/tag/Connectors#operation/getConnectorListV2
func (c *ConnectorService) ListConnectors(ctx context.Context, scope dto.Scope, connectorNames, connectorIdentifiers, types, categories, connectivityStatuses, connectorConnectivityModes []string, description string, inheritingCredentialsFromDelegate *bool, tags map[string]string) (*pkgDTO.ConnectorListData, error) {
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}

	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Create request body with specified fields
	requestBody := pkgDTO.ConnectorListRequestBody{
		ConnectorNames:                    connectorNames,
		ConnectorIdentifiers:              connectorIdentifiers,
		Description:                       description,
		Types:                             types,
		Categories:                        categories,
		ConnectivityStatuses:              connectivityStatuses,
		InheritingCredentialsFromDelegate: inheritingCredentialsFromDelegate,
		ConnectorConnectivityModes:        connectorConnectivityModes,
		Tags:                              tags,
		FilterType:                        "Connector", // Fixed value
	}

	// Define a struct to match the actual API response structure
	type listConnectorsResponse struct {
		Status        string                   `json:"status"`
		Data          pkgDTO.ConnectorListData `json:"data"`
		MetaData      interface{}              `json:"metaData"`
		CorrelationID string                   `json:"correlationId"`
	}

	var response listConnectorsResponse
	err := c.Client.Post(ctx, listConnectorsPath, params, requestBody, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list connectors: %w", err)
	}

	return &response.Data, nil
}
