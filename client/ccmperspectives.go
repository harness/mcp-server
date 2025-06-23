package client

import (
	"context"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/pkg/utils"
)

const (
	ccmPerspetiveDetailListPath = ccmBasePath + "/perspective/getAllPerspectives?accountIdentifier=%s"
	ccmGetPerspectivePath = ccmBasePath + "/perspective"
	ccmGetLastPeriodCostPerspectivePath = ccmBasePath + "/perspective/lastPeriodCost"
	ccmGetLastTwelveMonthCostPerspectivePath = ccmBasePath + "/perspective/lastYearMonthlyCost"
	ccmCreatePerspectivePath = ccmBasePath + "/perspective"
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

func (r *CloudCostManagementService) GetLastTwelveMonthsCostPerspective(ctx context.Context, scope dto.Scope, opts *dto.CCMGetLastTwelveMonthsCostPerspectiveOptions) (*dto.CCMLastTwelveMonthsCostPerspective, error) {

	path := ccmGetLastTwelveMonthCostPerspectivePath
	params := make(map[string]string)
	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMGetLastTwelveMonthsCostPerspectiveOptions{}
	}

	params["accountIdentifier"] = opts.AccountIdentifier
	params["perspectiveId"] = opts.PerspectiveId
	params["startTime"] = fmt.Sprintf("%d", opts.StartTime)
	params["period"] = dto.PeriodYearly 
	params["type"] = "PREVIOUS_PERIOD_SPEND" 
	params["breakdown"] = "MONTHLY" 

	items := new(dto.CCMLastTwelveMonthsCostPerspective)
	err := r.Client.Get(ctx, path, params, nil, &items)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost management perspectives: %w", err)
	}

	return items, nil
}

func (r *CloudCostManagementService) CreatePerspective(ctx context.Context, scope dto.Scope, opts *dto.CCMCreatePerspectiveOptions) (*dto.CCMPerspective, error) {
	path := ccmCreatePerspectivePath
	params := make(map[string]string)
	if opts == nil {
		opts = &dto.CCMCreatePerspectiveOptions{}
	}

	// Query parameters
	params["accountIdentifier"] = opts.Body.AccountId
	params["clone"] = utils.BoolToString(opts.Clone)
	params["updateTotalCost"] = utils.BoolToString(opts.UpdateTotalCost)

	// Body payload
	body := map[string]interface{}{
		"name":                opts.Body.Name,
		"accountId":           opts.Body.AccountId,
		"folderId":            opts.Body.FolderId,
		"viewVersion":         opts.Body.ViewVersion,
		"viewTimeRange": map[string]interface{}{
			"viewTimeRangeType":   opts.Body.ViewTimeRange.ViewTimeRangeType,
			"startTime":  opts.Body.ViewTimeRange.StartTime,
			"endTime":    opts.Body.ViewTimeRange.EndTime,
		},
		"viewType":            opts.Body.ViewType,
		"viewState":           opts.Body.ViewState,
	}

	item := new(dto.CCMPerspective)
	err := r.Client.Post(ctx, path, params, body, &item)
	if err != nil {
		return nil, fmt.Errorf("failed to create cloud cost management perspective: %w", err)
	}

	return item, nil
}
