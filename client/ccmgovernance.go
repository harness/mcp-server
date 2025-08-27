package client

import (
	"context"
	"fmt"
)

const (
	ccmGovTotalNewEnforcementRecommPath = ccmBasePath + "/governance/overview/totalNewEnforcementRecommendations?accountIdentifier=%s"
	ccmGovTotalActiveEnforcementsPath   = ccmBasePath + "/governance/overview/totalActiveEnforcements?accountIdentifier=%s"
	ccmGovTotalEvaluationsPath          = ccmBasePath + "/governance/overview/totalEvaluations?accountIdentifier=%s"
	ccmGovTotalRealisedSavingsPath      = ccmBasePath + "/governance/overview/totalRealisedSavingsGrouped?accountIdentifier=%s"
	ccmGovDayWiseTotalEvaluationsPath   = ccmBasePath + "/governance/overview/dayWiseTotalEvaluations?accountIdentifier=%s"
	ccmGovTotalRealisedSavingsV2Path    = ccmBasePath + "/governance/overview/totalRealisedSavingsV2?accountIdentifier=%s"
)

func (c *CloudCostManagementService) GetTotalNewEnforcementRecommendations(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalNewEnforcementRecommPath, accountId)
	return c.fetchGov(ctx, path, cloudProvider)
}

func (c *CloudCostManagementService) GetTotalActiveEnforcements(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalActiveEnforcementsPath, accountId)
	return c.fetchGov(ctx, path, cloudProvider)
}

func (c *CloudCostManagementService) GetTotalEvaluations(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalEvaluationsPath, accountId)
	return c.fetchGov(ctx, path, cloudProvider)
}

func (c *CloudCostManagementService) GetTotalRealisedSavings(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalRealisedSavingsPath, accountId)
	return c.fetchGov(ctx, path, cloudProvider)
}

func (c *CloudCostManagementService) GetTotalRealisedSavings(ctx context.Context, accountId string, options map[string]string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalRealisedSavingsPath, accountId)
	return c.fetchGov(ctx, path, cloudProvider)
}

func (c *CloudCostManagementService) fetchGov(ctx context.Context, cloudProvider string, url string) (*map[string]any, error) {

	resp := new(map[string]any)
	options := map[string]string{}
	if cloudProvider != "" {
		options["cloudProvider"] = cloudProvider
	}
	err := c.Client.Get(ctx, url, options, nil, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ccm governance: %w - url: %s", err, url)
	}

	return resp, nil
}

func (c *CloudCostManagementService) postGov(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {

	path := fmt.Sprintf(ccmGovDayWiseTotalEvaluationsPath, accountId)
	resp := new(map[string]any)

	err := c.Client.Post(ctx, path, nil, options, map[string]string{}, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ccm gov: %w - url: %s", err, path)
	}
	return resp, nil
}
