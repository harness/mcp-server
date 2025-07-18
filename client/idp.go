package client

import (
	"context"
	"fmt"
	"log"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	idpGetEntityPath       = "/v1/entities/%s/%s/%s"
	idpListEntitiesPath    = "/v1/entities"
	idpGetScorecardPath    = "/v1/scorecards/%s"
	idpListScorecardsPath  = "/v1/scorecards"
	idpGetScoreSummaryPath = "/v1/scores/summary"
	idpGetScoresPath       = "/v1/scores"

	// Default values for requests
	defaultKind        = "component,api,resource"
	defaultScope       = "account.*"
	scopeAccountPrefix = "account"
	defaultSort        = "name,ASC"
	defaultLimit       = 10
	maxLimit           = 50
)

type IDPService struct {
	Client *Client
}

func (i *IDPService) GetEntity(ctx context.Context, scope dto.Scope, kind string, identifier string) (*dto.EntityResponse, error) {
	if kind == "" {
		kind = defaultKind
	}

	path := fmt.Sprintf(idpGetEntityPath, generateScopeParamVal(scope), kind, identifier)

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	addScope(scope, params)

	response := new(dto.EntityResponse)

	err := i.Client.Get(ctx, path, params, headers, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (i *IDPService) ListEntities(ctx context.Context, scope dto.Scope, getEntitiesParams *dto.GetEntitiesParams) (*[]dto.EntityResponse, error) {
	path := idpListEntitiesPath

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	addScope(scope, params)

	if getEntitiesParams.Limit == 0 {
		params["limit"] = fmt.Sprintf("%d", defaultLimit)
	} else if getEntitiesParams.Limit > maxLimit {
		params["limit"] = fmt.Sprintf("%d", maxLimit)
	} else {
		params["limit"] = fmt.Sprintf("%d", getEntitiesParams.Limit)
	}

	if getEntitiesParams.Sort != "" {
		params["sort"] = getEntitiesParams.Sort
	}

	if getEntitiesParams.SearchTerm != "" {
		params["search_term"] = getEntitiesParams.SearchTerm
	}

	if getEntitiesParams.Scopes != "" {
		params["scopes"] = getEntitiesParams.Scopes
	}

	params["owned_by_me"] = fmt.Sprintf("%v", getEntitiesParams.OwnedByMe)
	params["favorites"] = fmt.Sprintf("%v", getEntitiesParams.Favorites)

	if getEntitiesParams.Kind == "" {
		params["kind"] = defaultKind
	} else {
		params["kind"] = getEntitiesParams.Kind
	}

	if getEntitiesParams.Type != "" {
		params["type"] = getEntitiesParams.Type
	}

	if getEntitiesParams.Owner != "" {
		params["owner"] = getEntitiesParams.Owner
	}

	if getEntitiesParams.Lifecycle != "" {
		params["lifecycle"] = getEntitiesParams.Lifecycle
	}

	if getEntitiesParams.Tags != "" {
		params["tags"] = getEntitiesParams.Tags
	}

	response := make([]dto.EntityResponse, 0)

	err := i.Client.Get(ctx, path, params, headers, &response)
	if err != nil {
		return nil, err
	}

	return &response, nil
}

func (i *IDPService) GetScorecard(ctx context.Context, scope dto.Scope, identifier string) (*dto.ScorecardDetailsResponse, error) {
	path := fmt.Sprintf(idpGetScorecardPath, identifier)

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	response := new(dto.ScorecardDetailsResponse)

	err := i.Client.Get(ctx, path, map[string]string{}, headers, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (i *IDPService) ListScorecards(ctx context.Context, scope dto.Scope) (*[]dto.ScorecardResponse, error) {
	path := idpListScorecardsPath

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	response := make([]dto.ScorecardResponse, 0)

	err := i.Client.Get(ctx, path, map[string]string{}, headers, &response)
	if err != nil {
		return nil, err
	}

	return &response, nil
}

func (i *IDPService) GetScorecardSummary(ctx context.Context, scope dto.Scope, identifier string) (*dto.ScorecardSummaryResponse, error) {
	path := idpGetScoreSummaryPath

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	params["entity_identifier"] = identifier

	response := new(dto.ScorecardSummaryResponse)

	err := i.Client.Get(ctx, path, params, headers, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (i *IDPService) GetScorecardScores(ctx context.Context, scope dto.Scope, identifier string) (*dto.ScorecardScoreResponse, error) {
	path := idpGetScoresPath

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	params["entity_identifier"] = identifier

	response := new(dto.ScorecardScoreResponse)

	err := i.Client.Get(ctx, path, params, headers, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func generateScopeParamVal(scope dto.Scope) string {
	scopeParam := defaultScope
	if scope.AccountID != "" {
		scopeParam = scopeAccountPrefix
		if scope.OrgID != "" {
			scopeParam = scopeAccountPrefix + "." + scope.OrgID
			if scope.ProjectID != "" {
				scopeParam += "." + scope.ProjectID
			}
		}
	}
	return scopeParam
}

func addHarnessAccountToHeaders(scope dto.Scope, headers map[string]string) {
	if scope.AccountID == "" {
		log.Printf("Account ID is empty in scope")
	} else {
		headers["Harness-Account"] = scope.AccountID
	}
}
