package harness

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
	"github.com/harness/harness-mcp/pkg/utils"
)

func ListCcmPerspectivesDetailTool(config *config.Config, client *client.Client) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("list_ccm_perspectives_detail",
			mcp.WithDescription("List the cost perspectives with advanced options in Harness Cloud Cost Management"),
			mcp.WithString("account_id",
				mcp.Description("The account identifier"),
			),
			mcp.WithString("search_key",
				mcp.Description("Optional search key to filter cost categories"),
			),
			mcp.WithString("sort_type",
				mcp.Description("Sort type for the results (e.g., NAME, LAST_EDIT)"),
			),
			mcp.WithString("sort_order",
				mcp.Description("Sort order for the results (e.g., ASCENDING, DESCENDING)"),
			),
			mcp.WithString("cloud_filter",
				mcp.Description("Filters for cloud and clusters (e.g., AWS, GCP, AZURE)"),
			),
			mcp.WithNumber("limit",
				mcp.DefaultNumber(5),
				mcp.Max(20),
				mcp.Description("Number of items per page"),
			),
			mcp.WithNumber("offset",
				mcp.DefaultNumber(1),
				mcp.Description("Offset or page number for pagination"),
			),
			WithScope(config, false),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			accountId, err := OptionalParam[string](request, "account_id")
			if accountId == "" {
				accountId, err = getAccountID(config, request)
			}
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			params := &dto.CCMListPerspectivesDetailOptions{}
			params.AccountIdentifier = accountId

			// Handle search key parameter
			searchKey, ok, err := OptionalParamOK[string](request, "search_key")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && searchKey != "" {
				params.SearchKey = searchKey
			}

			// Handle sort type parameter
			sortType, ok, err := OptionalParamOK[string](request, "sort_type")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortType != "" {
				params.SortType = sortType
			}

			// Handle sort order parameter
			sortOrder, ok, err := OptionalParamOK[string](request, "sort_order")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok && sortOrder != "" {
				params.SortOrder = sortOrder
			}

			// Handle limit parameter
			limit, ok, err := OptionalParamOK[float64](request, "limit")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.Limit = utils.SafeFloatToInt32(limit, 5)
			}

			// Handle offset parameter
			offset, ok, err := OptionalParamOK[float64](request, "offset")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if ok {
				params.Offset = utils.SafeFloatToInt32(offset, 1)
			}

			scope, err := fetchScope(config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.CloudCostManagement.ListPerspectivesDetail(ctx, scope, params)
			if err != nil {
				return nil, fmt.Errorf("failed to get CCM Cost Perspectives: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal CCM Cost Perspectives: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
	}

