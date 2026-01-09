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

// getInstanceAndConnectorID fetches instance details and extracts the connector ID
// Returns the connector ID and instance identifier on success
func (c *Client) getInstanceAndConnectorID(ctx context.Context, accountID, org, project, dbSchemaIdentifier, instanceIdentifier string) (string, string, error) {
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
		return "", "", fmt.Errorf("failed to get database instance: %w", err)
	}

	if instanceResp.JSON200 == nil {
		return "", "", fmt.Errorf("invalid instance response")
	}

	connectorID := instanceResp.JSON200.Connector
	fetchedInstanceID := instanceResp.JSON200.Identifier

	return connectorID, fetchedInstanceID, nil
}

// GetDatabaseInfo returns the schema identifier, instance identifier, and database type for a given database schema
// If dbInstanceIdentifier is provided, it directly fetches the instance info without querying the schema
// If dbInstanceIdentifier is empty, it first queries the schema to find the primary instance or first available instance
func (c *Client) GetDatabaseInfo(ctx context.Context, accountID, org, project, dbSchemaIdentifier, dbInstanceIdentifier string) (*DbInfo, error) {
	// Validate input parameters
	if err := validateDBInfoParams(accountID, org, project, dbSchemaIdentifier); err != nil {
		return nil, fmt.Errorf("failed to get database info: %w", err)
	}

	// Initialize the result
	result := &DbInfo{
		SchemaIdentifier: dbSchemaIdentifier,
	}

	// Step 1: Get instance identifier and connector ID
	var connectorID string

	if dbInstanceIdentifier != "" {
		// If instance identifier is provided, directly use it
		var err error
		connectorID, result.InstanceIdentifier, err = c.getInstanceAndConnectorID(ctx, accountID, org, project, dbSchemaIdentifier, dbInstanceIdentifier)
		if err != nil {
			return nil, err
		}
	} else {
		// Step 2: If instance identifier is not provided, query schema first
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

		if schema.PrimaryDbInstanceId != nil && *schema.PrimaryDbInstanceId != "" {
			// Use PrimaryDbInstanceId
			primaryInstanceID := *schema.PrimaryDbInstanceId

			// Get instance details using helper method
			var err error
			connectorID, result.InstanceIdentifier, err = c.getInstanceAndConnectorID(ctx, accountID, org, project, dbSchemaIdentifier, primaryInstanceID)
			if err != nil {
				return nil, err
			}
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

// GetSnapshotObjectNames retrieves the list of object names for a given database snapshot
func (c *Client) GetSnapshotObjectNames(ctx context.Context, accountID, org, project, dbSchemaIdentifier, dbInstanceIdentifier, objectType string, page, limit *int64) ([]string, error) {
	// Validate input parameters
	if err := validateDBInfoParams(accountID, org, project, dbSchemaIdentifier); err != nil {
		return nil, fmt.Errorf("failed to get snapshot object names: %w", err)
	}

	if dbInstanceIdentifier == "" {
		return nil, fmt.Errorf("failed to get snapshot object names: dbInstanceIdentifier cannot be empty")
	}

	if objectType == "" {
		return nil, fmt.Errorf("failed to get snapshot object names: objectType cannot be empty")
	}

	// Convert *int64 to *int for Limit
	var limitParam *int
	if limit != nil {
		limitInt := int(*limit)
		limitParam = &limitInt
	}

	// Create parameters for the API call
	params := &generated.V1GetSnapshotObjectNamesParams{
		HarnessAccount: &accountID,
		Page:           page,
		Limit:          limitParam,
		ObjectType:     objectType,
	}

	// Call the generated client method
	resp, err := c.DBOpsClient.V1GetSnapshotObjectNamesWithResponse(
		ctx,
		org,
		project,
		dbSchemaIdentifier,
		dbInstanceIdentifier,
		params,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot object names: %w", err)
	}

	if resp.JSON200 == nil {
		if resp.JSON400 != nil {
			return nil, fmt.Errorf("failed to get snapshot object names: bad request - %s", resp.JSON400.Message)
		}
		if resp.JSON403 != nil {
			return nil, fmt.Errorf("failed to get snapshot object names: forbidden - %s", resp.JSON403.Message)
		}
		if resp.JSON404 != nil {
			return nil, fmt.Errorf("failed to get snapshot object names: not found - %s", resp.JSON404.Message)
		}
		if resp.JSON500 != nil {
			return nil, fmt.Errorf("failed to get snapshot object names: server error - %s", resp.JSON500.Message)
		}
		return nil, fmt.Errorf("failed to get snapshot object names: invalid response")
	}

	// Extract data from response
	if resp.JSON200.Data == nil {
		return []string{}, nil
	}

	return resp.JSON200.Data, nil
}

// SnapshotObjectValueResult represents a single object value from the snapshot
type SnapshotObjectValueResult struct {
	ObjectName  string
	ObjectValue string
}

// GetSnapshotObjectValues retrieves the values of specified objects from a database snapshot
func (c *Client) GetSnapshotObjectValues(ctx context.Context, accountID, org, project, dbSchemaIdentifier, dbInstanceIdentifier, objectType string, objectNames []string) ([]SnapshotObjectValueResult, error) {
	// Validate input parameters
	if err := validateDBInfoParams(accountID, org, project, dbSchemaIdentifier); err != nil {
		return nil, fmt.Errorf("failed to get snapshot object values: %w", err)
	}

	if dbInstanceIdentifier == "" {
		return nil, fmt.Errorf("failed to get snapshot object values: dbInstanceIdentifier cannot be empty")
	}

	if objectType == "" {
		return nil, fmt.Errorf("failed to get snapshot object values: objectType cannot be empty")
	}

	if len(objectNames) == 0 {
		return nil, fmt.Errorf("failed to get snapshot object values: objectNames cannot be empty")
	}

	// Create request body
	requestBody := generated.SnapshotObjectValuesInput{
		ObjectType:  objectType,
		ObjectNames: objectNames,
	}

	// Create parameters for the API call
	params := &generated.V1GetSnapshotObjectValuesParams{
		HarnessAccount: &accountID,
	}

	// Call the generated client method
	resp, err := c.DBOpsClient.V1GetSnapshotObjectValuesWithResponse(
		ctx,
		org,
		project,
		dbSchemaIdentifier,
		dbInstanceIdentifier,
		params,
		requestBody,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get snapshot object values: %w", err)
	}

	if resp.JSON200 == nil {
		if resp.JSON400 != nil {
			return nil, fmt.Errorf("failed to get snapshot object values: bad request - %s", resp.JSON400.Message)
		}
		if resp.JSON403 != nil {
			return nil, fmt.Errorf("failed to get snapshot object values: forbidden - %s", resp.JSON403.Message)
		}
		if resp.JSON404 != nil {
			return nil, fmt.Errorf("failed to get snapshot object values: not found - %s", resp.JSON404.Message)
		}
		if resp.JSON500 != nil {
			return nil, fmt.Errorf("failed to get snapshot object values: server error - %s", resp.JSON500.Message)
		}
		return nil, fmt.Errorf("failed to get snapshot object values: invalid response")
	}

	// Convert response data to result format
	results := make([]SnapshotObjectValueResult, 0)
	if resp.JSON200.Data != nil {
		for _, value := range resp.JSON200.Data {
			results = append(results, SnapshotObjectValueResult{
				ObjectName:  value.ObjectName,
				ObjectValue: value.ObjectValue,
			})
		}
	}

	return results, nil
}

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
