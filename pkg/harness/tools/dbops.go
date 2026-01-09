package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client/dbops"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// GetDatabaseInfoTool returns a tool for retrieving database information.
func GetDatabaseInfoTool(config *config.Config, dbopsClient *dbops.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_database_schema_info",
			mcp.WithDescription(`
			Retrieves metadata about a database schema including its identifier, instance identifier, and database type.

			Usage Guidance:
			- Use this tool to get essential metadata about a specific database schema in your database devops setup.
			- You must provide the database schema identifier to retrieve its information.
			- Optionally provide the database instance identifier.
			- The tool returns schema identifier, instance identifier, and database type information.

			Example Use Cases:
			- Determine database type before generating changesets or SQL for a schema.
			- Identify the database type (e.g., POSTGRES, MYSQL, MONGODB) for a specific schema.
			- Retrieve instance identifier associated with a database schema.

			Tip: This tool provides metadata for the schema, not the database structure itself.
			`),
			mcp.WithString("db_schema_identifier",
				mcp.Description(`Required. The unique identifier of the database schema for which you want to retrieve metadata.`),
			),
			mcp.WithString("db_instance_identifier",
				mcp.Description(`Optional. The unique identifier of the database instance.`),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract org and project from scope
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID := scope.OrgID
			projectID := scope.ProjectID

			// Extract db_schema_identifier parameter (required)
			dbSchemaIdentifier, err := RequiredParam[string](request, "db_schema_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Extract db_instance_identifier parameter (optional)
			dbInstanceIdentifier, err := OptionalParam[string](request, "db_instance_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the GetDatabaseInfo method with the optional instance identifier
			dbInfo, err := dbopsClient.GetDatabaseInfo(ctx, scope.AccountID, orgID, projectID, dbSchemaIdentifier, dbInstanceIdentifier)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get database information: %v", err)), nil
			}

			// Marshal the result to JSON
			out, err := json.Marshal(dbInfo)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(out)), nil
		}
}

// GetSnapshotObjectNamesTool returns a tool for retrieving snapshot object names
func GetSnapshotObjectNamesTool(config *config.Config, dbopsClient *dbops.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_snapshot_object_names",
			mcp.WithDescription(`
			Retrieves the list of object names (e.g., tables) from a database snapshot for a specific object type.

			Usage Guidance:
			- Use this tool to discover what objects exist in your database snapshot.
			- You must provide the database schema identifier, database instance identifier, and object type.
			- The tool returns a list of object names of the specified type (e.g., table names if object type is "Table").

			Example Use Cases:
			- Discover available tables in a database snapshot.
			- Get a list of database objects before querying their values.
			- Identify all objects of a specific type in your database schema.

			Tip: This tool helps you explore the structure of your database snapshots without executing queries on the database.
			`),
			mcp.WithString("db_schema_identifier",
				mcp.Description(`Required. The unique identifier of the database schema.`),
			),
			mcp.WithString("db_instance_identifier",
				mcp.Description(`Required. The unique identifier of the database instance.`),
			),
			mcp.WithString("object_type",
				mcp.Description(`Required. Type of database object to retrieve. 
				- Allowed values: 
				a) Table 
				- Example: "Table"
				`),
				mcp.Enum("Table"),
				mcp.DefaultString("Table"),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract org and project from scope
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID := scope.OrgID
			projectID := scope.ProjectID

			// Extract required parameters
			dbSchemaIdentifier, err := RequiredParam[string](request, "db_schema_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			dbInstanceIdentifier, err := RequiredParam[string](request, "db_instance_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			objectType, err := RequiredParam[string](request, "object_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Call the GetSnapshotObjectNames method with fixed page=1 and limit=200
			page := int64(0)
			limit := int64(100)
			_ = page
			_ = limit
			_ = orgID
			_ = projectID
			_ = dbSchemaIdentifier
			_ = dbInstanceIdentifier
			_ = dbopsClient
			_ = objectType
			// TODO: Remove this hardcoded test data
			objectNames := []string{"batman"}
			// objectNames, err := dbopsClient.GetSnapshotObjectNames(ctx, scope.AccountID, orgID, projectID, dbSchemaIdentifier, dbInstanceIdentifier, objectType, &page, &limit)
			// if err != nil {
			// 	return mcp.NewToolResultError(fmt.Sprintf("failed to get snapshot object names: %v", err)), nil
			// }

			// Marshal the result to JSON
			out, err := json.Marshal(objectNames)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(out)), nil
		}
}

// GetSnapshotObjectValuesTool returns a tool for retrieving snapshot object values
func GetSnapshotObjectValuesTool(config *config.Config, dbopsClient *dbops.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("get_snapshot_object_values",
			mcp.WithDescription(`
			Retrieves the complete json metadata of specified objects from a database snapshot.
			Example - for a table, the response will be the complete json metadata of the table including the columns, constraints, indexes, etc.

			Usage Guidance:
			- Use this tool to fetch the actual content/definition of database objects like for Table.
			- You must provide the database schema identifier, database instance identifier, object type, and list of object names.
			- The tool returns the values/definitions of the specified objects.

			Example Use Cases:
			- Retrieve the schema definition of specific tables.
			- Get the DDL (Data Definition Language) of database objects.

			Tip: Use GetSnapshotObjectNames tool first to discover available object names, then use this tool to fetch their values.
			`),
			mcp.WithString("db_schema_identifier",
				mcp.Description(`Required. The unique identifier of the database schema.`),
			),
			mcp.WithString("db_instance_identifier",
				mcp.Description(`Required. The unique identifier of the database instance.`),
			),
			mcp.WithString("object_type",
				mcp.Description(`Required. Type of database object.
				- Allowed values: 
				a) Table 
				- Example: "Table"
				`),
				mcp.Enum("Table"),
				mcp.DefaultString("Table"),
			),
			mcp.WithArray("object_names",
				mcp.Description(`Required. Array of object names to retrieve values for. Example: ["users_table", "orders_table"]
				How to obtain Object Names:
				- Use the get_snapshot_object_names tool to retrieve the list of available object names for a specific object type and database schema.
				`),
				mcp.Items(map[string]any{
					"type": "string",
				}),
			),
			common.WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract org and project from scope
			scope, err := common.FetchScope(ctx, config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			orgID := scope.OrgID
			projectID := scope.ProjectID

			// Extract required parameters
			dbSchemaIdentifier, err := RequiredParam[string](request, "db_schema_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			dbInstanceIdentifier, err := RequiredParam[string](request, "db_instance_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			objectType, err := RequiredParam[string](request, "object_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Extract object_names array parameter (required)
			objectNames, err := OptionalStringArrayParam(request, "object_names")
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("error parsing object_names: %v", err)), nil
			}

			if len(objectNames) == 0 {
				return mcp.NewToolResultError("missing required parameter: object_names cannot be empty"), nil
			}

			// Call the GetSnapshotObjectValues method
			objectValues, err := dbopsClient.GetSnapshotObjectValues(ctx, scope.AccountID, orgID, projectID, dbSchemaIdentifier, dbInstanceIdentifier, objectType, objectNames)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to get snapshot object values: %v", err)), nil
			}

			// Marshal the result to JSON
			out, err := json.Marshal(objectValues)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(out)), nil
		}
}
