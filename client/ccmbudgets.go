package client

import (
	"context"
	"fmt"
	"log/slog"
)

const (
	ccmListAllBudgetsPath            = ccmBasePath + "/budgets?accountIdentifier=%s"
	ccmGetBudgetDetailPath           = ccmBasePath + "/budgets/%s?accountIdentifier=%s"
	ccmListBudgetsForPerspectivePath = ccmBasePath + "/budgets/perspectiveBudgets?accountIdentifier=%s&perspectiveId=%s"
	ccmGetBudgetCostDetailPath       = ccmBasePath + "/budgets/%s/costDetails?accountIdentifier=%s&breakdown=%s"
	ccmCloneBudgetPath               = ccmBasePath + "/budgets/%s?accountIdentifier=%s&cloneName=%s"
	ccmDeleteBudgetPath              = ccmBasePath + "/budgets/%s?accountIdentifier=%s"
	ccmCreateBudgetPath              = ccmBasePath + "/budgets?accountIdentifier=%s"
	ccmUpdateBudgetPath              = ccmBasePath + "/budgets/%s?accountIdentifier=%s"
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
		return nil, fmt.Errorf("failed to fetch ccm budgets data: %w", err)
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

func (c *CloudCostManagementService) CreateBudget(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {

	path := fmt.Sprintf(ccmCreateBudgetPath, accountId)
	resp := new(map[string]any)

	slog.Debug("Create Budget", "body", options)
	err := c.Client.Post(ctx, path, nil, options, map[string]string{}, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to create a ccm budget: %w", err)
	}
	return resp, nil
}

func (c *CloudCostManagementService) UpdateBudget(ctx context.Context, accountId string, options map[string]any) (*map[string]any, error) {
	budgetId, ok := options["uuid"].(string)
	if !ok {
		return nil, fmt.Errorf("uuid parameter is required and must be a string")
	}
	path := fmt.Sprintf(ccmUpdateBudgetPath, budgetId, accountId)
	resp := new(map[string]any)

	err := c.Client.Put(ctx, path, nil, options, &resp)
	if err != nil {
		return nil, fmt.Errorf("failed to update a ccm budgets: %w", err)
	}

	return resp, nil
}
