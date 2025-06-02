package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

const (
	ccmPerspetiveDetailListPath = ccmBasePath + "/perspective/getAllPerspectives?accountIdentifier=%s"
)

func (r *CloudCostManagementService) ListPerspectivesDetail(ctx context.Context, scope dto.Scope, opts *dto.CCMListPerspectivesDetailOptions) (*dto.CCMPerspectivesDetailList, error) {
	path := ccmPerspetiveDetailListPath
	params := make(map[string]string)
	addScope(scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMListPerspectivesDetailOptions{}
	}

	setCCMPaginationDefault(&opts.CCMPaginationOptions)

	if opts.SearchKey != "" {
		params["searchKey"] = opts.SearchKey
	}
	if opts.SortType != "" {
		params["sortType"] = opts.SortType
	}
	if opts.SortOrder != "" {
		params["sortOrder"] = opts.SortOrder
	}
	if opts.CloudFilters != "" {
		params["cloudFilters"] = opts.CloudFilters
	}

	params["pageSize"] = fmt.Sprintf("%d", opts.Limit)
	params["pageNo"] = fmt.Sprintf("%d", opts.Offset)

	items := new(dto.CCMPerspectivesDetailList)

	err := r.Client.Get(ctx, path, params, nil, &items)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost management cost categories: %w", err)
	}

	return items, nil
}
