package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"      // Corrected import path for Scope
	pkgDTO "github.com/harness/harness-mcp/pkg/harness/dto" // Alias for the other DTOs
)

type ConnectorService struct {
	Client *Client
}

// ListConnectorCatalogue fetches the connector catalogue.
// API Documentation: https://apidocs.harness.io/tag/Connectors#operation/getConnectorCatalogue
func (c *ConnectorService) ListConnectorCatalogue(ctx context.Context, scope dto.Scope) ([]pkgDTO.ConnectorCatalogueItem, error) {
	path := "/ng/api/connectors/catalogue"
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
		MetaData     interface{} `json:"metaData"`
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
	path := fmt.Sprintf("/ng/api/connectors/%s", connectorIdentifier)
	params := make(map[string]string)
	// Ensure accountIdentifier is always set
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(scope, params)

	// Define a struct to match the actual API response structure
	type connectorResponse struct {
		Status        string                   `json:"status"`
		Data          pkgDTO.ConnectorDetail   `json:"data"`
		MetaData      interface{}              `json:"metaData"`
		CorrelationID string                   `json:"correlationId"`
	}

	var response connectorResponse
	err := c.Client.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get connector: %w", err)
	}

	return &response.Data, nil
}
