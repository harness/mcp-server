package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

const (
	ccmBasePath        = "ccm/api"
	ccmGetOverviewPath = ccmBasePath + "/overview?accountIdentifier=%s&startTime=%d&endTime=%d&groupBy=%s"
	ccmCostCategoryListPath = ccmBasePath + "/business-mapping/filter-panel?accountIdentifier=%s" // This endpoint lists cost categories

//business-mapping/filter-panel?accountIdentifier=${ACCOUNT_ID}&costCategory=string&search=string"
)

type CloudCostManagementService struct {
	Client *Client
}

func (c *CloudCostManagementService) GetOverview(ctx context.Context, accID string, startTime int64, endTime int64, groupBy string) (*dto.CEView, error) {
	path := fmt.Sprintf(ccmGetOverviewPath, accID, startTime, endTime, groupBy)
	params := make(map[string]string)

	ccmOverview := new(dto.CEView)
	err := c.Client.Get(ctx, path, params, nil, ccmOverview)
	if err != nil {
		return nil, fmt.Errorf("failed to get ccm overview: %w", err)
	}

	return ccmOverview, nil
}

func (r *CloudCostManagementService) ListCostCategories(ctx context.Context, scope dto.Scope, opts *dto.CcmListCostCategoriesOptions) (*dto.CCMCostCategoryList, error) {
	path := ccmCostCategoryListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CcmListCostCategoriesOptions{}
	}

	if opts.CostCategory != "" {
		params["costCategory"] = opts.CostCategory
	}
	if opts.SearchTerm != "" {
		params["search"] = opts.SearchTerm
	}

	// Temporary slice to hold the strings
	costCategories := new(dto.CCMCostCategoryList)

	err := r.Client.Get(ctx, path, params, nil, costCategories)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost managment cost categories: %w", err)
	}

	return costCategories, nil
}
