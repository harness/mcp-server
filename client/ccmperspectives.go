package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
)

const (
	ccmPerspetiveDetailListPath = ccmBasePath + "/perspective/getAllPerspectives?accountIdentifier=%s"
	ccmGetPerspectivePath = ccmBasePath + "/perspective"
	ccmGetLastPeriodCostPerspectivePath = ccmBasePath + "/perspective/lastPeriodCost"
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

func (r *CloudCostManagementService) GetPerspective(ctx context.Context, scope dto.Scope, opts *dto.CCMGetPerspectiveOptions) (*dto.CCMPerspectiveDetail, error) {

	path := ccmGetPerspectivePath
	params := make(map[string]string)
	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMGetPerspectiveOptions{}
	}
	params["accountIdentifier"] = opts.AccountIdentifier
	params["perspectiveId"] = opts.PerspectiveId

	items := new(dto.CCMPerspectiveDetail)
	err := r.Client.Get(ctx, path, params, nil, &items)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost management perspectives: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) GetLastCostPerspective(ctx context.Context, scope dto.Scope, opts *dto.CCMGetLastPeriodCostPerspectiveOptions) (*dto.CCMLastPeriodCostPerspective, error) {

	path := ccmGetLastPeriodCostPerspectivePath
	params := make(map[string]string)
	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMGetLastPeriodCostPerspectiveOptions{}
	}

	params["accountIdentifier"] = opts.AccountIdentifier
	params["perspectiveId"] = opts.PerspectiveId
	params["startTime"] = fmt.Sprintf("%d", opts.StartTime)
	params["period"] = opts.Period

	items := new(dto.CCMLastPeriodCostPerspective)
	err := r.Client.Get(ctx, path, params, nil, &items)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost management perspectives: %w", err)
	}

	return items, nil
}
