package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

type TemplateService struct {
	Client *Client
}

// ListAccount lists templates in the account scope
func (ts *TemplateService) ListAccount(ctx context.Context, opts *dto.TemplateListOptions) (*dto.TemplateMetaDataList, error) {
	endpoint := "/v1/templates"

	params := make(map[string]string)
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}
	if opts.TemplateListType != "" {
		params["templateListType"] = opts.TemplateListType
	}
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	var result dto.TemplateMetaDataList
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list account templates: %w", err)
	}

	return &result, nil
}

// ListOrg lists templates in the organization scope
func (ts *TemplateService) ListOrg(ctx context.Context, scope dto.Scope, opts *dto.TemplateListOptions) (*dto.TemplateMetaDataList, error) {
	endpoint := fmt.Sprintf("/v1/orgs/%s/templates", scope.OrgID)

	params := make(map[string]string)
	addScope(scope, params)
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}
	if opts.TemplateListType != "" {
		params["templateListType"] = opts.TemplateListType
	}
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	var result dto.TemplateMetaDataList
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list org templates: %w", err)
	}

	return &result, nil
}

// ListProject lists templates in the project scope
func (ts *TemplateService) ListProject(ctx context.Context, scope dto.Scope, opts *dto.TemplateListOptions) (*dto.TemplateMetaDataList, error) {
	endpoint := fmt.Sprintf("/v1/orgs/%s/projects/%s/templates", scope.OrgID, scope.ProjectID)

	params := make(map[string]string)
	addScope(scope, params)
	if opts.SearchTerm != "" {
		params["searchTerm"] = opts.SearchTerm
	}
	if opts.TemplateListType != "" {
		params["templateListType"] = opts.TemplateListType
	}
	params["page"] = fmt.Sprintf("%d", opts.Page)
	params["size"] = fmt.Sprintf("%d", opts.Size)

	var result dto.TemplateMetaDataList
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list project templates: %w", err)
	}

	return &result, nil
}
