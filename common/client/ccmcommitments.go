package client

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/utils"
)

const (
	ccmCommitmentEstimatedSavingsPath = "/accounts/%s/v2/setup/%s/estimated_savings?accountIdentifier=%s"
	ccmCommitmentSpendDetailsPath     = "/accounts/%s/v2/spend/detail?accountIdentifier=%s"
	ccmCommitmentMasterAccountsPath   = "/accounts/%s/v1/setup/listMasterAccounts?accountIdentifier=%s"

	defaultTargetCoveragePercentage = 90.0
)

func (r *CloudCostManagementService) GetEstimatedSavings(ctx context.Context, scope dto.Scope, targetCoverage float64, opts *dto.CCMCommitmentOptions) (*dto.CommitmentEstimatedSavingsResponse, error) {
	var response dto.CommitmentEstimatedSavingsResponse
	var wg sync.WaitGroup
	var mu sync.Mutex
	errChan := make(chan error, len(opts.CloudAccountIDs))

	// Parse all possible cloud account IDs and run go routines to capture responses
	for _, cloudAccountID := range opts.CloudAccountIDs {
		wg.Add(1)
		go func(accID string) {
			defer wg.Done()

			remoteResponse, err := r.getEstimatedSavingsResponse(ctx, scope, accID, opts.Service, &targetCoverage)
			if err != nil {
				errChan <- err
				return
			}

			mu.Lock()
			response.Data = append(response.Data, &dto.CommitmentEstimatedSavings{
				CloudAccountID:    accID,
				AnnualizedSavings: remoteResponse.EstimatedSavings * 12, // Monthly value is extrapolated
			})
			mu.Unlock()
		}(cloudAccountID)
	}

	// Wait for all goroutines to complete
	wg.Wait()
	close(errChan)

	// Check if any errors occurred
	if len(errChan) > 0 {
		return nil, <-errChan // Return the first error encountered
	}

	return &response, nil
}

func (r *CloudCostManagementService) getEstimatedSavingsResponse(ctx context.Context, scope dto.Scope, cloudAccountID string, service *string, targetCoverage *float64) (*dto.EstimatedSavingsRemoteResponse, error) {
	path := fmt.Sprintf(ccmCommitmentEstimatedSavingsPath, scope.AccountID, cloudAccountID, scope.AccountID)
	params := make(map[string]string)
	addScope(ctx, scope, params)

	type reqPayload struct {
		Service        string  `json:"service"`
		TargetCoverage float64 `json:"target_coverage"`
	}

	requestPayload := reqPayload{
		TargetCoverage: defaultTargetCoveragePercentage,
	}

	if service != nil {
		requestPayload.Service = *service
	}

	if targetCoverage != nil {
		requestPayload.TargetCoverage = *targetCoverage
	}

	// Temporary slice to hold the strings
	baseResponse := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, requestPayload, map[string]string{}, baseResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost managment estimated savings response with path %s: %w", path, err)
	}

	responseBytes, err := json.Marshal(baseResponse.Response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal cloud cost managment estimated savings response with path %s: %w", path, err)
	}

	var response dto.EstimatedSavingsRemoteResponse

	err = json.Unmarshal(responseBytes, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal cloud cost managment estimated savings response with path %s: %w", path, err)
	}

	return &response, nil
}

func (r *CloudCostManagementService) GetCommitmentSpends(ctx context.Context, scope dto.Scope, opts *dto.CCMCommitmentOptions) (*dto.CCMCommitmentBaseResponse, error) {

	path := fmt.Sprintf(ccmCommitmentSpendDetailsPath, scope.AccountID, scope.AccountID)
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
		Service:          ccmCommitmentComputeService, // Default value
		NetAmortizedCost: utils.ToBoolPtr(false),
	}

	if opts.Service != nil && *opts.Service != "" {
		requestPayload.Service = *opts.Service
	}

	if opts.IsNetAmortizedCost != nil {
		requestPayload.NetAmortizedCost = opts.IsNetAmortizedCost
	}

	if len(opts.CloudAccountIDs) > 0 {
		requestPayload.CloudAccounts = opts.CloudAccountIDs
	}

	// Temporary slice to hold the strings
	spendDetailsResponse := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, requestPayload, map[string]string{}, spendDetailsResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost managment compute spend details with path %s: %w", path, err)
	}

	return spendDetailsResponse, nil
}

func (r *CloudCostManagementService) GetCommitmentMasterAccounts(ctx context.Context, scope dto.Scope) (*dto.CCMMasterAccountsListResponse, error) {
	path := fmt.Sprintf(ccmCommitmentMasterAccountsPath, scope.AccountID, scope.AccountID)
	params := make(map[string]string)
	addScope(ctx, scope, params)

	listMasterAccountsResponse := new(dto.CCMCommitmentBaseResponse)

	err := r.Client.Post(ctx, path, params, nil, map[string]string{}, listMasterAccountsResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to get cloud cost managment master accounts with path %s: %w", path, err)
	}

	jsonBytes, err := json.Marshal(listMasterAccountsResponse.Response)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal cloud cost managment master accounts with path %s: %w", path, err)
	}

	var response dto.CCMMasterAccountsListResponse

	err = json.Unmarshal(jsonBytes, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal cloud cost managment master accounts with path %s: %w", path, err)
	}

	return &response, nil
}
