package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	templateAccountPath = "v1/templates"
	templateOrgPath     = "v1/orgs/%s/templates"
	templateProjectPath = "v1/orgs/%s/projects/%s/templates"
)

type TemplateService struct {
	Client *Client
}

func (ts *TemplateService) buildPath(basePath string) string {
	return basePath
}

// buildTemplateParams converts template list options to query parameters map
func buildTemplateParams(opts *dto.TemplateListOptions) map[string]string {
	params := make(map[string]string)

	if opts == nil {
		opts = &dto.TemplateListOptions{}
	}

	// Pagination params
	params["page"] = strconv.Itoa(opts.Page)
	params["limit"] = strconv.Itoa(opts.Limit)

	// Sorting params
	if opts.Sort != "" {
		params["sort"] = opts.Sort
	}
	if opts.Order != "" {
		params["order"] = opts.Order
	}

	// Filtering params
	if opts.SearchTerm != "" {
		params["search_term"] = opts.SearchTerm
	}
	if opts.Type != "" {
		params["type"] = opts.Type
	}
	if opts.Recursive {
		params["recursive"] = "true"
	}

	appendArrayParams(params, "names", opts.Names)
	appendArrayParams(params, "identifiers", opts.Identifiers)
	appendArrayParams(params, "entity_types", opts.EntityTypes)
	appendArrayParams(params, "child_types", opts.ChildTypes)

	return params
}

func appendArrayParams(params map[string]string, paramName string, values []string) {
	for i, value := range values {
		// Use strconv.Itoa instead of fmt.Sprintf for integer to string conversion
		key := paramName + "[" + strconv.Itoa(i) + "]"
		params[key] = value
	}
}

// ListAccount lists templates in the account scope
func (ts *TemplateService) ListAccount(ctx context.Context, opts *dto.TemplateListOptions) (*dto.TemplateMetaDataList, error) {
	endpoint := ts.buildPath(templateAccountPath)
	params := buildTemplateParams(opts)

	var result dto.TemplateMetaDataList
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list account templates: %w", err)
	}

	return &result, nil
}

// ListOrg lists templates in the organization scope
func (ts *TemplateService) ListOrg(ctx context.Context, scope dto.Scope, opts *dto.TemplateListOptions) (*dto.TemplateMetaDataList, error) {
	endpoint := ts.buildPath(fmt.Sprintf(templateOrgPath, scope.OrgID))
	params := buildTemplateParams(opts)

	var result dto.TemplateMetaDataList
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list org templates: %w", err)
	}

	return &result, nil
}

// ListProject lists templates in the project scope
func (ts *TemplateService) ListProject(ctx context.Context, scope dto.Scope, opts *dto.TemplateListOptions) (*dto.TemplateMetaDataList, error) {
	endpoint := ts.buildPath(fmt.Sprintf(templateProjectPath, scope.OrgID, scope.ProjectID))
	params := buildTemplateParams(opts)

	var result dto.TemplateMetaDataList
	err := ts.Client.Get(ctx, endpoint, params, map[string]string{}, &result)
	if err != nil {
		return nil, fmt.Errorf("failed to list project templates: %w", err)
	}

	return &result, nil
}
