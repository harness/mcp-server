package client

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	// Base API paths
	idpGetEntityPath         = "/v1/entities/%s/%s/%s"
	idpListEntitiesPath      = "/v1/entities"
	idpGetScorecardPath      = "/v1/scorecards/%s"
	idpListScorecardsPath    = "/v1/scorecards"
	idpGetScoreSummaryPath   = "/v1/scores/summary"
	idpGetScoresPath         = "/v1/scores"
	idpGetScorecardStatsPath = "/v1/scorecards/%s/stats"
	idpGetCheckPath          = "/v1/checks/%s"
	idpListChecksPath        = "/v1/checks"
	idpGetCheckStatsPath     = "/v1/checks/%s/stats"
	idpExecuteWorkflowPath   = "/v2/workflows/execute"

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

	params["scopes"] = generateScopeParamVal(scope)

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

func (i *IDPService) GetScorecardStats(ctx context.Context, scope dto.Scope, scorecardIdentifier string) (*dto.ScorecardStatsResponseWithHumanReadableTime, error) {
	path := fmt.Sprintf(idpGetScorecardStatsPath, scorecardIdentifier)

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)

	response := new(dto.ScorecardStatsResponse)
	err := i.Client.Get(ctx, path, params, headers, response)
	if err != nil {
		return nil, err
	}

	result := &dto.ScorecardStatsResponseWithHumanReadableTime{
		Name:  response.Name,
		Stats: response.Stats,
	}

	if response.Timestamp != nil {
		result.Time = dto.FormatUnixMillisToRFC3339(*response.Timestamp)
	} else {
		result.Time = ""
	}

	return result, nil
}

func (i *IDPService) GetCheck(ctx context.Context, scope dto.Scope, checkIdentifier string, isCustom bool) (*dto.CheckDetailsResponse, error) {
	path := fmt.Sprintf(idpGetCheckPath, checkIdentifier)

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	params["custom"] = fmt.Sprintf("%v", isCustom)

	response := new(dto.CheckDetailsResponse)

	err := i.Client.Get(ctx, path, params, headers, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (i *IDPService) ListChecks(ctx context.Context, scope dto.Scope, getChecksParams *dto.GetChecksParams) (*dto.CheckResponseList, error) {
	path := idpListChecksPath

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)

	if getChecksParams.Limit == 0 {
		params["limit"] = fmt.Sprintf("%d", defaultLimit)
	} else if getChecksParams.Limit > maxLimit {
		params["limit"] = fmt.Sprintf("%d", maxLimit)
	} else {
		params["limit"] = fmt.Sprintf("%d", getChecksParams.Limit)
	}

	params["page"] = fmt.Sprintf("%d", getChecksParams.Page)

	if getChecksParams.Sort != "" {
		params["sort"] = getChecksParams.Sort
	}

	if getChecksParams.SearchTerm != "" {
		params["search_term"] = getChecksParams.SearchTerm
	}

	response := new(dto.CheckResponseList)

	err := i.Client.GetWithoutSplittingParamValuesOnComma(ctx, path, params, headers, &response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (i *IDPService) GetCheckStats(ctx context.Context, scope dto.Scope, checkIdentifier string, isCustom bool) (*dto.CheckStatsResponseWithHumanReadableTime, error) {
	path := fmt.Sprintf(idpGetCheckStatsPath, checkIdentifier)

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	params["custom"] = fmt.Sprintf("%v", isCustom)

	response := new(dto.CheckStatsResponse)
	err := i.Client.Get(ctx, path, params, headers, response)
	if err != nil {
		return nil, err
	}

	result := &dto.CheckStatsResponseWithHumanReadableTime{
		Name:  response.Name,
		Stats: response.Stats,
	}

	if response.Timestamp != nil {
		result.Time = dto.FormatUnixMillisToRFC3339(*response.Timestamp)
	} else {
		result.Time = ""
	}

	return result, nil
}

func (i *IDPService) ExecuteWorkflow(ctx context.Context, scope dto.Scope, identifier string, inputSet map[string]interface{}) (*dto.ExecuteWorkflowResponse, error) {
	path := idpExecuteWorkflowPath

	headers := make(map[string]string)
	addHarnessAccountToHeaders(scope, headers)

	params := make(map[string]string)
	addScope(scope, params)

	_, authHeaderVal, err := i.Client.AuthProvider.GetHeader(ctx)
	if err != nil {
		slog.Error("Failed to get auth header", "error", err)
		return nil, err
	}
	token := authHeaderVal
	parts := strings.Split(authHeaderVal, " ")
	if len(parts) == 2 {
		token = parts[1]
	}
	inputSet["token"] = token
	body := new(dto.ExecuteWorkflowRequest)
	body.Identifier = identifier
	body.Values = inputSet

	response := new(dto.ExecuteWorkflowResponse)

	err = i.Client.Post(ctx, path, params, body, headers, response)
	if err != nil {
		slog.Error("Failed to execute workflow", "error", err)
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
		slog.Error("Account ID is empty in scope")
	} else {
		headers["Harness-Account"] = scope.AccountID
	}
}
