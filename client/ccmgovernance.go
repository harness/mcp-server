package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
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
	return c.fetchGov(ctx, cloudProvider, path)
}

func (c *CloudCostManagementService) GetTotalActiveEnforcements(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalActiveEnforcementsPath, accountId)
	return c.fetchGov(ctx, cloudProvider, path)
}

func (c *CloudCostManagementService) GetTotalEvaluations(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalEvaluationsPath, accountId)
	return c.fetchGov(ctx, cloudProvider, path)
}

func (c *CloudCostManagementService) GetTotalRealisedSavings(ctx context.Context, accountId string, cloudProvider string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalRealisedSavingsPath, accountId)
	return c.fetchGov(ctx, cloudProvider, path)
}

func (c *CloudCostManagementService) GetDayWiseTotalEvaluations(ctx context.Context, options dto.CCMGovernanceValuesOptions) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalRealisedSavingsPath, options.AccountIdentifier)
	return c.postGov(ctx, options, path)
}

func (c *CloudCostManagementService) GetTotalRealisedSavingsV2(ctx context.Context, options dto.CCMGovernanceValuesOptions) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGovTotalRealisedSavingsV2Path, options.AccountIdentifier)
	return c.postGov(ctx, options, path)
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

func (c *CloudCostManagementService) postGov(ctx context.Context, options dto.CCMGovernanceValuesOptions, url string) (*map[string]any, error) {

	resp := new(map[string]any)
	params := map[string]string{}
	if cloudProvider := options.CloudProvider; cloudProvider != "" {
		params["cloudProvider"] = cloudProvider
	}

	err := c.Client.Post(ctx, url, params, options.Filters, map[string]string{}, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ccm gov: %w - url: %s", err, url)
	}
	return resp, nil
}
