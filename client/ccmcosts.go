package client

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/pkg/utils"
)

const (
	ccmBasePath                                = "ccm/api"
	ccmGetOverviewPath                         = ccmBasePath + "/overview?accountIdentifier=%s&startTime=%d&endTime=%d&groupBy=%s"
	ccmCostCategoryListPath                    = ccmBasePath + "/business-mapping/filter-panel?accountIdentifier=%s"
	ccmCostCategoryDetailListPath              = ccmBasePath + "/business-mapping?accountIdentifier=%s"    // This endpoint lists cost categories
	ccmGetCostCategoryPath                     = ccmBasePath + "/business-mapping/%s?accountIdentifier=%s" // This endpoint lists cost categories
	ccmCommitmentCoverageDetailsPath           = "/accounts/%s/v1/detail/compute_coverage?accountIdentifier=%s"
	ccmCommitmentSavingsDetailsPath            = "/accounts/%s/v1/detail/savings?accountIdentifier=%s"
	ccmCommitmentUtilisationDetailsPath        = "/accounts/%s/v1/detail/commitment_utilisation?accountIdentifier=%s"
	ccmCommitmentComputeService         string = "Amazon Elastic Compute Cloud - Compute"
)

type CloudCostManagementService struct {
	Client      *Client
	NgManClient *Client
}

func (c *CloudCostManagementService) GetOverview(ctx context.Context, accID string, startTime int64, endTime int64, groupBy string) (*dto.CEView, error) {
	path := fmt.Sprintf(ccmGetOverviewPath, accID, startTime, endTime, groupBy)

	slog.DebugContext(ctx, "GetOverView", "Path", path)
	params := make(map[string]string)

	ccmOverview := new(dto.CEView)
	err := c.Client.Get(ctx, path, params, nil, ccmOverview)
	if err != nil {
		return nil, fmt.Errorf("failed to get ccm overview: %w", err)
	}

	return ccmOverview, nil
}

func (r *CloudCostManagementService) ListCostCategories(ctx context.Context, scope dto.Scope, opts *dto.CCMListCostCategoriesOptions) (*dto.CCMCostCategoryList, error) {
	path := ccmCostCategoryListPath
	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMListCostCategoriesOptions{}
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

func (r *CloudCostManagementService) ListCostCategoriesDetail(ctx context.Context, scope dto.Scope, opts *dto.CCMListCostCategoriesDetailOptions) (*dto.CCMCostCategoryDetailList, error) {
	path := ccmCostCategoryDetailListPath
	params := make(map[string]string)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMListCostCategoriesDetailOptions{}
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
	params["limit"] = fmt.Sprintf("%d", opts.Limit)
	params["offset"] = fmt.Sprintf("%d", opts.Offset)

	costCategories := new(dto.CCMCostCategoryDetailList)

	err := r.Client.Get(ctx, path, params, nil, &costCategories)
	if err != nil {
		return nil, fmt.Errorf("failed to list cloud cost management cost categories: %w", err)
	}

	return costCategories, nil
}

func (r *CloudCostManagementService) GetCostCategory(ctx context.Context, scope dto.Scope, opts *dto.CCMGetCostCategoryOptions) (*dto.CCMCostCategory, error) {
	// Opts shouuldn't be nil
	if opts == nil {
		return nil, fmt.Errorf("Missing parameters for Get CCM Cost categories.")
	}

	path := fmt.Sprintf(ccmGetCostCategoryPath, opts.CostCategoryId, opts.AccountIdentifier)
	params := make(map[string]string)

	// Temporary slice to hold the strings
	costCategory := new(dto.CCMCostCategory)

	err := r.Client.Get(ctx, path, params, nil, costCategory)
	if err != nil {
		return nil, fmt.Errorf("failed to Get cloud cost managment cost category by Id: %w", err)
	}

	return costCategory, nil
}

func setCCMPaginationDefault(opts *dto.CCMPaginationOptions) {
	if opts == nil {
		return
	}
	// The code below is commented out because when filtering is applied and Offset (or Page) == 1
	// Seach does not retrieves results, only total count (In get perspective details endpoint)
	// if opts.Offset <= 0 {
	// 	opts.Offset = 1
	// }
	safeMaxPageSize := utils.SafeIntToInt32(maxPageSize, 20)
	if opts.Limit <= 0 {
		opts.Limit = utils.SafeIntToInt32(defaultPageSize, 5)
	} else if opts.Limit > safeMaxPageSize {
		opts.Limit = safeMaxPageSize
	}
}

func (r *CloudCostManagementService) GetComputeCoverage(ctx context.Context, scope dto.Scope, opts *dto.CCMCommitmentOptions) (*dto.CCMCommitmentBaseResponse, error) {
	path := fmt.Sprintf(ccmCommitmentCoverageDetailsPath, scope.AccountID, scope.AccountID)
	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMCommitmentOptions{}
	}

	if opts.StartDate != nil && *opts.StartDate != "" {
		params["start_date"] = *opts.StartDate
	} else {
		// Default to last 30 days
		params["start_date"] = utils.FormatUnixToYYYYMMDD(time.Now().AddDate(0, 0, -30).Unix())
	}
	if opts.EndDate != nil && *opts.EndDate != "" {
		params["end_date"] = *opts.EndDate
	} else {
		// Default to last 30 days
		params["end_date"] = utils.FormatUnixToYYYYMMDD(time.Now().Unix())
	}

	var requestPayload = dto.CCMCommitmentAPIFilter{
		Service: ccmCommitmentComputeService, // Default value

	}

	if opts.Service != nil && *opts.Service != "" {
		requestPayload.Service = *opts.Service
	}

	if opts.GroupBy != nil && *opts.GroupBy != "" {
		requestPayload.GroupBy = opts.GroupBy
	}

	if len(opts.CloudAccountIDs) > 0 {
		requestPayload.CloudAccounts = opts.CloudAccountIDs
	}

	// Temporary slice to hold the strings
	coverageRespone := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, requestPayload, map[string]string{}, coverageRespone)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost managment compute coverage with path %s: %w", path, err)
	}

	return coverageRespone, nil
}

func (r *CloudCostManagementService) GetCommitmentSavings(ctx context.Context, scope dto.Scope, opts *dto.CCMCommitmentOptions) (*dto.CCMCommitmentBaseResponse, error) {
	path := fmt.Sprintf(ccmCommitmentSavingsDetailsPath, scope.AccountID, scope.AccountID)
	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMCommitmentOptions{}
	}

	if opts.StartDate != nil && *opts.StartDate != "" {
		params["start_date"] = *opts.StartDate
	} else {
		// Default to last 30 days
		params["start_date"] = utils.FormatUnixToYYYYMMDD(time.Now().AddDate(0, 0, -30).Unix())
	}
	if opts.EndDate != nil && *opts.EndDate != "" {
		params["end_date"] = *opts.EndDate
	} else {
		// Default to last 30 days
		params["end_date"] = utils.FormatUnixToYYYYMMDD(time.Now().Unix())
	}

	var requestPayload = dto.CCMCommitmentAPIFilter{
		Service: ccmCommitmentComputeService, // Default value

	}

	if opts.Service != nil && *opts.Service != "" {
		requestPayload.Service = *opts.Service
	}

	if len(opts.CloudAccountIDs) > 0 {
		requestPayload.CloudAccounts = opts.CloudAccountIDs
	}

	// Handle is_harness_managed parameter
	if opts.IsHarnessManaged != nil {
		requestPayload.IsHarnessManaged = opts.IsHarnessManaged
	}

	savingsResponse := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, requestPayload, map[string]string{}, savingsResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost management compute savings with path %s: %w", path, err)
	}

	return savingsResponse, nil
}

func (r *CloudCostManagementService) GetCommitmentUtilisation(ctx context.Context, scope dto.Scope, opts *dto.CCMCommitmentOptions) (*dto.CCMCommitmentBaseResponse, error) {
	path := fmt.Sprintf(ccmCommitmentUtilisationDetailsPath, scope.AccountID, scope.AccountID)
	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Handle nil options by creating default options
	if opts == nil {
		opts = &dto.CCMCommitmentOptions{}
	}

	if opts.StartDate != nil && *opts.StartDate != "" {
		params["start_date"] = *opts.StartDate
	} else {
		// Default to last 30 days
		params["start_date"] = utils.FormatUnixToYYYYMMDD(time.Now().AddDate(0, 0, -30).Unix())
	}
	if opts.EndDate != nil && *opts.EndDate != "" {
		params["end_date"] = *opts.EndDate
	} else {
		// Default to last 30 days
		params["end_date"] = utils.FormatUnixToYYYYMMDD(time.Now().Unix())
	}

	var requestPayload = dto.CCMCommitmentAPIFilter{
		Service: ccmCommitmentComputeService, // Default value

	}

	if opts.Service != nil && *opts.Service != "" {
		requestPayload.Service = *opts.Service
	}

	if len(opts.CloudAccountIDs) > 0 {
		requestPayload.CloudAccounts = opts.CloudAccountIDs
	}

	// Temporary slice to hold the strings
	utilisationResponse := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, requestPayload, map[string]string{}, utilisationResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost managment compute utilisation with path %s: %w", path, err)
	}

	return utilisationResponse, nil
}
