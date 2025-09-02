package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// FindSimilarTemplates creates a tool that allows finding similar templates based on provided description.
func FindSimilarTemplates(config *config.Config, client *client.IntelligenceService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("intelligent_template_search",
			mcp.WithDescription("The tool is used to find most relevant entity template for any entity everytime a template is explicitly requested for any of pipeline/stage/step"+
				"Finds the most relevant templates based on a natural language description. "+
				"Searches across template identifiers, names, types, capabilities, and use cases to find the best matches. "+
				"Returns templates ranked by similarity score with metadata including template IDs and organizational context. "+
				"Ideal for discovering templates that fulfill specific requirements without knowing exact identifiers."),
			mcp.WithString("description",
				mcp.Required(),
				mcp.Description("Description of the template to find similar templates"),
			),
			mcp.WithString("template_type",
				mcp.Description("Type of templates to find similar templates (e.g., Step, Stage, Pipeline)"),
			),
			mcp.WithNumber("count",
				mcp.Description("Maximum number of similar templates to return"),
				mcp.DefaultNumber(1),
			),
			common.WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			// Get required description parameter
			description, err := RequiredParam[string](request, "description")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Fetch optional parameters
			templateType, err := OptionalParam[string](request, "template_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Handle count parameter as float64 (JSON default) and convert to int
			countFloat, err := OptionalParam[float64](request, "count")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			count := int(countFloat)

			// Try to fetch scope parameters (account_id, org_id, project_id) if provided
			scope, err := common.FetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			// Create similarity search request
			similarityRequest := &dto.SimilaritySearchRequest{
				AccountID:    scope.AccountID,
				OrgID:        scope.OrgID,
				ProjectID:    scope.ProjectID,
				Description:  description,
				Count:        count,
				TemplateType: templateType,
			}

			// Call the similarity search API
			result, err := client.SimilaritySearch(ctx, similarityRequest)
			if err != nil {
				return nil, fmt.Errorf("failed to perform similarity search: %w", err)
			}

			// Marshal and return the result
			r, err := json.Marshal(result)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal similarity search response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
