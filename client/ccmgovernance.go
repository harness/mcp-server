package client

import (
	"context"
	"fmt"
)

const (
	ccmGovTotalNewEnforcementRecommPath = ccmBasePath + "/governance/overview/totalNewEnforcementRecommendations?accountIdentifier=%s&cloudProvider=%s"
	ccmGovTotalActiveEnforcementsPath   = ccmBasePath + "/governance/overview/totalActiveEnforcements?accountIdentifier=%s&cloudProvider=%s"
	ccmGovTotalEvaluationsPath          = ccmBasePath + "/governance/overview/totalEvaluations?accountIdentifier=%s&cloudProvider=%s"
	ccmGovTotalRealisedSavingsPath      = ccmBasePath + "/governance/overview/totalRealisedSavingsGrouped?accountIdentifier=%s&cloudProvider=%s"
)

func (c *CloudCostManagementService) GetTotalNewEnforcementRecommendations(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalNewEnforcementRecommPath, accountId, cloudProvider)
	return c.fetchGov(ctx, path)
}

func (c *CloudCostManagementService) GetTotalActiveEnforcements(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalActiveEnforcementsPath, accountId, cloudProvider)
	return c.fetchGov(ctx, path)
}

func (c *CloudCostManagementService) GetTotalEvaluations(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalEvaluationsPath, accountId, cloudProvider)
	return c.fetchGov(ctx, path)
}

func (c *CloudCostManagementService) GetTotalRealisedSavings(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalRealisedSavingsPath, accountId, cloudProvider)
	return c.fetchGov(ctx, path)
}

func (c *CloudCostManagementService) fetchGov(ctx context.Context, url string) (*map[string]any, error) {

	resp := new(map[string]any)
	err := c.Client.Get(ctx, url, nil, nil, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ccm governance: %w", err)
	}

	return resp, nil
}
