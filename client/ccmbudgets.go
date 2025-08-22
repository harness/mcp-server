package client

import (
	"context"
	"fmt"
)

const (
	ccmListAllBudgetsPath            = ccmBasePath + "/budgets?accountIdentifier=%s"
	ccmGetBudgetDetailPath           = ccmBasePath + "/budgets/%s?accountIdentifier=%s"
	ccmListBudgetsForPerspectivePath = ccmBasePath + "/budgets/perspectiveBudgets?accountIdentifier=%s&perspectiveId=%s"
	ccmGetBudgetCostDetailPath       = ccmBasePath + "/budgets/%s/costDetails?accountIdentifier=%s&breakdown=%s"
	ccmCloneBudgetPath               = ccmBasePath + "/budgets/%s?accountIdentifier=%s&cloneName=%s"
	ccmDeleteBudgetPath              = ccmBasePath + "/budgets/%s?accountIdentifier=%s"
)

func (c *CloudCostManagementService) ListAllBudgets(ctx context.Context, accountId string, options map[string]string) (*map[string]any, error) {

	path := fmt.Sprintf(ccmListAllBudgetsPath, accountId)
	return c.fetch(ctx, options, path)
}

func (c *CloudCostManagementService) GetBudgetDetail(ctx context.Context, accountId string, budgetId string) (*map[string]any, error) {
	path := fmt.Sprintf(ccmGetBudgetDetailPath, budgetId, accountId)
	return c.fetch(ctx, nil, path)
}

func (c *CloudCostManagementService) ListBudgetsForPerspective(ctx context.Context, accountId string, perspectiveId string) (*map[string]any, error) {

	path := fmt.Sprintf(ccmListBudgetsForPerspectivePath, accountId, perspectiveId)
	return c.fetch(ctx, nil, path)
}

func (c *CloudCostManagementService) GetBudgetCostDetail(ctx context.Context, accountId string, budgetId string, breakdown string) (*map[string]any, error) {

	path := fmt.Sprintf(ccmGetBudgetCostDetailPath, budgetId, accountId, breakdown)
	return c.fetch(ctx, nil, path)
}

func (c *CloudCostManagementService) fetch(ctx context.Context, options map[string]string, url string) (*map[string]any, error) {

	resp := new(map[string]any)
	err := c.Client.Get(ctx, url, options, nil, resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ccm budgets: %w", err)
	}

	return resp, nil
}

func (c *CloudCostManagementService) CloneBudget(ctx context.Context, accountId string, budgetId string, newName string) (*map[string]any, error) {

	path := fmt.Sprintf(ccmCloneBudgetPath, budgetId, accountId, newName)
	resp := new(map[string]any)

	err := c.Client.Post(ctx, path, nil, nil, map[string]string{}, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ccm budgets: %w", err)
	}
	return resp, nil
}

func (c *CloudCostManagementService) DeleteBudget(ctx context.Context, accountId string, budgetId string) (*map[string]any, error) {

	path := fmt.Sprintf(ccmDeleteBudgetPath, budgetId, accountId)
	resp := new(map[string]any)

	err := c.Client.Delete(ctx, path, nil, nil, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to delete ccm budget  %s: %w", budgetId, err)
	}
	return resp, nil
}
