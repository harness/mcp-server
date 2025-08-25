package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client/dbops"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
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
			WithScope(config, true),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Extract org and project from scope
			scope, err := FetchScope(config, request, true)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			orgID := scope.OrgID
			projectID := scope.ProjectID

			// Extract db_schema_identifier parameter
			dbSchemaIdentifier, err := RequiredParam[string](request, "db_schema_identifier")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			// Call the GetDatabaseInfo method
			dbInfo, err := dbopsClient.GetDatabaseInfo(ctx, config.AccountID, orgID, projectID, dbSchemaIdentifier)
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
