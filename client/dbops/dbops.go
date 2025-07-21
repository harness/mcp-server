package dbops

import (
	"context"
	"fmt"
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/common"
	"github.com/harness/harness-mcp/client/dbops/generated"
	"github.com/harness/harness-mcp/client/dto"
)

// DbInfo represents the database information including schema identifier, instance identifier, and database type
type DbInfo struct {
	SchemaIdentifier   string
	InstanceIdentifier string
	DatabaseType       string
}

// Client is the client for database operations
type Client struct {
	DBOpsClient     *generated.ClientWithResponses
	ConnectorClient *client.ConnectorService
}

// NewClient creates a new dbops client
func NewClient(dbOpsClient *generated.ClientWithResponses, connectorClient *client.ConnectorService) *Client {
	return &Client{
		DBOpsClient:     dbOpsClient,
		ConnectorClient: connectorClient,
	}
}

// validateDBInfoParams validates the parameters required for database info operations
func validateDBInfoParams(accountID, org, project, dbSchemaIdentifier string) error {
	if accountID == "" {
		return fmt.Errorf("accountID cannot be empty")
	}
	if org == "" {
		return fmt.Errorf("org cannot be empty")
	}
	if project == "" {
		return fmt.Errorf("project cannot be empty")
	}
	if dbSchemaIdentifier == "" {
		return fmt.Errorf("dbSchemaIdentifier cannot be empty")
	}
	return nil
}

// validateConnectorParams validates the parameters required for connector operations
func validateConnectorParams(accountID, connectorID string) error {
	if accountID == "" {
		return fmt.Errorf("accountID cannot be empty")
	}
	if connectorID == "" {
		return fmt.Errorf("connectorID cannot be empty")
	}
	return nil
}

// GetDatabaseInfo returns the schema identifier, instance identifier, and database type for a given database schema
func (c *Client) GetDatabaseInfo(ctx context.Context, accountID, org, project, dbSchemaIdentifier string) (*DbInfo, error) {
	// Validate input parameters
	if err := validateDBInfoParams(accountID, org, project, dbSchemaIdentifier); err != nil {
		return nil, fmt.Errorf("failed to get database info: %w", err)
	}

	// Step 1: Query V1GetProjDbSchemaWithResponse to get schema for given identifier
	params := &generated.V1GetProjDbSchemaParams{
		HarnessAccount: &accountID,
	}
	schemaResp, err := c.DBOpsClient.V1GetProjDbSchemaWithResponse(
		ctx,
		org,
		project,
		dbSchemaIdentifier,
		params,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get database schema: %w", err)
	}

	if schemaResp.JSON200 == nil {
		return nil, fmt.Errorf("failed to get database info: invalid schema response")
	}

	schema := schemaResp.JSON200

	// Initialize the result with schema information
	result := &DbInfo{
		SchemaIdentifier: schema.Identifier,
	}

	// Step 2: Get instance identifier
	var instanceIdentifier string
	var connectorID string

	if schema.PrimaryDbInstanceId != nil && *schema.PrimaryDbInstanceId != "" {
		// Use PrimaryDbInstanceId
		instanceIdentifier = *schema.PrimaryDbInstanceId

		// Get instance details
		instanceParams := &generated.V1GetProjDbSchemaInstanceParams{
			HarnessAccount: &accountID,
		}
		instanceResp, err := c.DBOpsClient.V1GetProjDbSchemaInstanceWithResponse(
			ctx,
			org,
			project,
			dbSchemaIdentifier,
			instanceIdentifier,
			instanceParams,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to get database instance: %w", err)
		}

		if instanceResp.JSON200 == nil {
			return nil, fmt.Errorf("invalid instance response")
		}

		// Get connector ID from instance
		connectorID = instanceResp.JSON200.Connector
		result.InstanceIdentifier = instanceResp.JSON200.Identifier
	} else {
		// Step 3: If PrimaryDbInstanceId is empty, make list API call
		instancesResp, err := c.DBOpsClient.V1ListProjDbSchemaInstanceWithResponse(
			ctx,
			org,
			project,
			dbSchemaIdentifier,
			&generated.V1ListProjDbSchemaInstanceParams{
				HarnessAccount: &accountID,
			},
			generated.V1ListProjDbSchemaInstanceJSONRequestBody{},
		)
		if err != nil {
			return nil, fmt.Errorf("failed to list database instances: %w", err)
		}

		if instancesResp.JSON200 == nil {
			return nil, fmt.Errorf("failed to get database info: no instances response")
		}

		// Get the first instance
		instances := *instancesResp.JSON200
		if len(instances) == 0 {
			return nil, fmt.Errorf("no instances found for the schema")
		}
		firstInstance := instances[0]
		result.InstanceIdentifier = firstInstance.Identifier
		connectorID = firstInstance.Connector
	}

	// Check if connectorID is empty
	if connectorID == "" {
		return nil, fmt.Errorf("no connector ID found for the database instance")
	}

	// Get JDBC connector URL and determine database type
	_, dbType, err := c.getJDBCConnectorUrl(ctx, accountID, org, project, connectorID)
	if err != nil {
		return nil, err
	}

	// Set the database type
	result.DatabaseType = dbType

	return result, nil
}

// getJDBCConnectorUrl retrieves the JDBC connector URL and database type from the connector service
func (c *Client) getJDBCConnectorUrl(ctx context.Context, accountID, org, project, connectorID string) (string, string, error) {
	// Validate input parameters
	if err := validateConnectorParams(accountID, connectorID); err != nil {
		return "", "", fmt.Errorf("failed to get JDBC connector URL: %w", err)
	}
	// Create base scope for connector API
	baseScope := dto.Scope{
		AccountID: accountID,
		OrgID:     org,
		ProjectID: project,
	}

	// Process connector ID to handle scoped references
	entityScope := common.GetScopeOfEntity(connectorID)
	scope := common.GetScopeFromEntityRef(baseScope, connectorID)
	actualConnectorID := common.GetEntityIDFromRef(connectorID)

	// Validate scope
	if !common.IsScopeValid(scope, entityScope) {
		return "", "", fmt.Errorf("failed to get JDBC connector URL: invalid scope for connector ID: %s", connectorID)
	}

	// Call GetConnector to get connector details
	connector, err := c.ConnectorClient.GetConnector(ctx, scope, actualConnectorID)
	if err != nil {
		return "", "", fmt.Errorf("failed to get connector: %w", err)
	}

	// Check if connector response is valid
	if connector == nil {
		return "", "", fmt.Errorf("failed to get JDBC connector URL: invalid connector response")
	}

	// Check if connector type is JDBC
	if connector.Connector.Type != "JDBC" {
		return "", "", fmt.Errorf("failed to get JDBC connector URL: connector type is not JDBC: %s", connector.Connector.Type)
	}

	// Extract URL from connector spec
	url := ""
	if connector.Connector.Spec != nil {
		if urlValue, exists := connector.Connector.Spec["url"]; exists {
			if urlStr, ok := urlValue.(string); ok {
				url = urlStr
			}
		}
	}

	if url == "" {
		return "", "", fmt.Errorf("failed to get JDBC connector URL: no URL found in connector spec")
	}

	// Extract database type from URL
	dbType := extractDatabaseTypeFromURL(url)

	return url, dbType, nil
}

// Database type constants
const (
	DBTypePostgres = "POSTGRES"
	DBTypeMongoDB  = "MONGODB"
	DBTypeMSSQL    = "MSSQL"
	DBTypeUnknown  = "UNKNOWN"
)

// extractDatabaseTypeFromURL extracts the database type from a JDBC or MongoDB URL
// Handles special cases for common database types and normalizes the output
func extractDatabaseTypeFromURL(url string) string {
	// Validate input parameter
	if url == "" {
		return DBTypeUnknown
	}
	url = strings.ToLower(url)

	// Check if it's a MongoDB URL
	if strings.HasPrefix(url, "mongodb:") {
		return DBTypeMongoDB
	}

	// For JDBC URLs in format jdbc:<database>:...
	if strings.HasPrefix(url, "jdbc:") {
		if len(url) <= len("jdbc:") {
			return DBTypeUnknown
		}
		// Extract the database type between jdbc: and the next :
		parts := strings.SplitN(url[5:], ":", 2) // Skip "jdbc:" prefix
		if len(parts) > 0 {
			dbType := parts[0]
			// Handle special cases
			switch dbType {
			case "postgresql":
				return DBTypePostgres
			case "sqlserver":
				return DBTypeMSSQL
			default:
				// Convert to uppercase
				return strings.ToUpper(dbType)
			}
		}
	}

	// Default to unknown if we can't determine
	return DBTypeUnknown
}
