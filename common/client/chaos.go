package client

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/harness/mcp-server/common/client/dto"
)

const (
	// Base API paths
	chaosListExperimentsPath                = "rest/v2/experiment"
	chaosGetExperimentPath                  = "rest/v2/experiments/%s"
	chaosGetExperimentRunPipelinePath       = "rest/v2/chaos-pipeline/%s"
	chaosExperimentRunPath                  = "rest/v2/experiments/%s/run"
	chaosListProbesPath                     = "rest/v2/probes"
	chaosGetProbePath                       = "rest/v2/probes/%s"
	chaosCreateExperimentFromTemplate       = "rest/experimenttemplates/%s/launch"
	chaosListExperimentTemplates            = "rest/experimenttemplates"
	chaosGetExperimentTemplatePath          = "rest/experimenttemplates/%s"
	chaosDeleteExperimentTemplatePath       = "rest/experimenttemplates/%s"
	chaosGetExperimentTemplateRevisionsPath = "rest/experimenttemplates/%s/revisions"
	chaosGetExperimentTemplateVariablesPath = "rest/experimenttemplates/%s/variables"
	chaosGetExperimentTemplateYamlPath      = "rest/experimenttemplates/%s/yaml"
	chaosCompareExperimentTemplateRevsPath  = "rest/experimenttemplates/%s/compare"
	chaosListExperimentVariables            = "rest/v2/experiments/%s/variables"

	chaosListFaultTemplatesPath        = "rest/faulttemplates"
	chaosGetFaultTemplatePath          = "rest/faulttemplates/%s"
	chaosDeleteFaultTemplatePath       = "rest/faulttemplates/%s"
	chaosGetFaultTemplateRevisionsPath = "rest/faulttemplates/%s/revisions"
	chaosGetFaultTemplateVariablesPath = "rest/faulttemplates/%s/variables"
	chaosGetFaultTemplateYamlPath      = "rest/faulttemplates/%s/yaml"
	chaosCompareFaultTemplateRevsPath  = "rest/faulttemplates/%s/compare"

	chaosListProbeTemplatesPath        = "rest/templates/probes"
	chaosGetProbeTemplatePath          = "rest/templates/probes/%s"
	chaosDeleteProbeTemplatePath       = "rest/templates/probes/%s"
	chaosGetProbeTemplateVariablesPath = "rest/templates/probes/%s/variables"

	chaosListActionTemplatesPath            = "rest/templates/actions"
	chaosGetActionTemplatePath              = "rest/templates/actions/%s"
	chaosDeleteActionTemplatePath           = "rest/templates/actions/%s"
	chaosGetActionTemplateRevisionsPath     = "rest/templates/actions/%s/revisions"
	chaosGetActionTemplateVariablesPath     = "rest/templates/actions/%s/variables"
	chaosCompareActionTemplateRevisionsPath = "rest/templates/actions/%s/compare"

	chaosListChaosGuardConditionsPath  = "v3/chaosguard-conditions"
	chaosGetChaosGuardConditionPath   = "v3/chaosguard-conditions/%s"
	chaosDeleteChaosGuardConditionPath = "v3/chaosguard-conditions/%s"
	chaosListChaosGuardRulesPath       = "v3/chaosguard-rules"
	chaosGetChaosGuardRulePath    = "v3/chaosguard-rules/%s"
	chaosDeleteChaosGuardRulePath = "v3/chaosguard-rules/%s"
	chaosEnableChaosGuardRulePath = "v3/chaosguard-rules/%s/enable"
)

type ChaosService struct {
	Client *Client
}

func (c *ChaosService) ListExperiments(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions) (*dto.ListExperimentResponse, error) {
	var (
		path   = chaosListExperimentsPath
		params = make(map[string]string)
	)

	// Set default pagination
	setDefaultPagination(pagination)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	listExperiments := new(dto.ListExperimentResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperiments)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiments: %w", err)
	}

	return listExperiments, nil
}

func (c *ChaosService) GetExperiment(ctx context.Context, scope dto.Scope, experimentID string) (*dto.GetExperimentResponse, error) {
	var (
		path   = fmt.Sprintf(chaosGetExperimentPath, experimentID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getExperiment := new(dto.GetExperimentResponse)
	err := c.Client.Get(ctx, path, params, nil, getExperiment)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment: %w", err)
	}

	return getExperiment, nil
}

func (c *ChaosService) GetExperimentRun(ctx context.Context, scope dto.Scope, experimentID, experimentRunID string) (*dto.ChaosExecutionResponse, error) {
	var (
		path   = fmt.Sprintf(chaosGetExperimentRunPipelinePath, experimentID)
		params = make(map[string]string)
	)

	params["experimentRunId"] = experimentRunID
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getExperimentRun := new(dto.ChaosExecutionResponse)
	err := c.Client.Get(ctx, path, params, nil, getExperimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to get experiment run: %w", err)
	}

	return getExperimentRun, nil
}

func (c *ChaosService) RunExperiment(ctx context.Context, scope dto.Scope, experimentID string, request *dto.ExperimentRunRequest) (*dto.RunChaosExperimentResponse, error) {
	var (
		path   = fmt.Sprintf(chaosExperimentRunPath, experimentID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["isIdentity"] = "false"
	params = addIdentifierParams(params, scope)

	experimentRun := new(dto.RunChaosExperimentResponse)
	err := c.Client.Post(ctx, path, params, request, nil, experimentRun)
	if err != nil {
		return nil, fmt.Errorf("failed to run experiment: %w", err)
	}

	return experimentRun, nil
}

func (c *ChaosService) ListProbes(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions) (*dto.ListProbeResponse, error) {
	var (
		path   = chaosListProbesPath
		params = make(map[string]string)
	)

	// Set default pagination
	setDefaultPagination(pagination)

	// Add pagination parameters
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)
	// Add scope parameters
	params = addIdentifierParams(params, scope)

	listExperiments := new(dto.ListProbeResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperiments)
	if err != nil {
		return nil, fmt.Errorf("failed to list probes: %w", err)
	}

	return listExperiments, nil
}

func (c *ChaosService) GetProbe(ctx context.Context, scope dto.Scope, probeID string) (*dto.GetProbeResponse, error) {
	var (
		path   = fmt.Sprintf(chaosGetProbePath, probeID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)

	getProbe := new(dto.GetProbeResponse)
	err := c.Client.Get(ctx, path, params, nil, getProbe)
	if err != nil {
		return nil, fmt.Errorf("failed to get probe: %w", err)
	}

	return getProbe, nil
}

func (c *ChaosService) ListExperimentTemplates(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions, hubIdentity, infrastructureType, infrastructure, search, sortField string, sortAscending, includeAllScope bool, tags string) (*dto.ListExperimentTemplateResponse, error) {
	var (
		path   = chaosListExperimentTemplates
		params = make(map[string]string)
	)

	setDefaultPagination(pagination)
	params["page"] = fmt.Sprintf("%d", pagination.Page)
	params["limit"] = fmt.Sprintf("%d", pagination.Size)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if infrastructureType != "" {
		params["infrastructureType"] = infrastructureType
	}
	if infrastructure != "" {
		params["infrastructure"] = infrastructure
	}
	if search != "" {
		params["search"] = search
	}
	if sortField != "" {
		params["sortField"] = sortField
		params["sortAscending"] = fmt.Sprintf("%t", sortAscending)
	}
	if includeAllScope {
		params["includeAllScope"] = "true"
	}
	if tags != "" {
		params["tags"] = tags
	}

	listExperimentTemplates := new(dto.ListExperimentTemplateResponse)
	err := c.Client.Get(ctx, path, params, nil, listExperimentTemplates)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiment templates: %w", err)
	}

	return listExperimentTemplates, nil
}

func (c *ChaosService) GetExperimentTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision string) (*dto.GetExperimentTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetExperimentTemplatePath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if revision != "" {
		params["revision"] = revision
	}

	out := new(dto.GetExperimentTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get experiment template: %w", err)
	}
	return out, nil
}

func (c *ChaosService) DeleteExperimentTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity string, verbose bool) error {
	path := fmt.Sprintf(chaosDeleteExperimentTemplatePath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if verbose {
		params["verbose"] = "true"
	}

	if err := c.Client.Delete(ctx, path, params, nil, nil); err != nil {
		return fmt.Errorf("failed to delete experiment template: %w", err)
	}
	return nil
}

func (c *ChaosService) GetExperimentTemplateRevisions(ctx context.Context, scope dto.Scope, identity, hubIdentity string, pagination *dto.PaginationOptions, infrastructureType, infrastructure, search, sortField string, sortAscending, includeAllScope bool, tags string) (*dto.ListExperimentTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetExperimentTemplateRevisionsPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if pagination != nil {
		params["page"] = fmt.Sprintf("%d", pagination.Page)
		params["size"] = fmt.Sprintf("%d", pagination.Size)
	}
	if infrastructureType != "" {
		params["infrastructureType"] = infrastructureType
	}
	if infrastructure != "" {
		params["infrastructure"] = infrastructure
	}
	if search != "" {
		params["search"] = search
	}
	if sortField != "" {
		params["sortField"] = sortField
	}
	if sortAscending {
		params["sortAscending"] = "true"
	}
	if includeAllScope {
		params["includeAllScope"] = "true"
	}
	if tags != "" {
		params["tags"] = tags
	}

	out := new(dto.ListExperimentTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get experiment template revisions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetExperimentTemplateVariables(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision string) (*dto.ExperimentTemplateVariablesResponse, error) {
	path := fmt.Sprintf(chaosGetExperimentTemplateVariablesPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if revision != "" {
		params["revision"] = revision
	}

	out := new(dto.ExperimentTemplateVariablesResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get experiment template variables: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetExperimentTemplateYaml(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision string) (*dto.ExperimentTemplateYamlResponse, error) {
	path := fmt.Sprintf(chaosGetExperimentTemplateYamlPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if revision != "" {
		params["revision"] = revision
	}

	out := new(dto.ExperimentTemplateYamlResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get experiment template yaml: %w", err)
	}
	return out, nil
}

func (c *ChaosService) CompareExperimentTemplateRevisions(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision1, revision2 string) (*dto.CompareRevisionsResponse, error) {
	path := fmt.Sprintf(chaosCompareExperimentTemplateRevsPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params["revision1"] = revision1
	params["revision2"] = revision2
	params = addIdentifierParams(params, scope)

	out := new(dto.CompareRevisionsResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to compare experiment template revisions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) CreateExperimentFromTemplateRequest(ctx context.Context, scope dto.Scope, templateID, hubIdentity string, request dto.CreateExperimentFromTemplateRequest) (*dto.ExperimentCreationResponse, error) {
	var (
		path   = fmt.Sprintf(chaosCreateExperimentFromTemplate, templateID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)

	// Add hub parameters
	params["hubIdentity"] = hubIdentity

	var createExperimentFromTemplates = new(dto.ExperimentCreationResponse)

	err := c.Client.Post(ctx, path, params, request, nil, createExperimentFromTemplates)
	if err != nil {
		return nil, fmt.Errorf("failed to create experiment from template: %w", err)
	}

	return createExperimentFromTemplates, nil
}

func (c *ChaosService) ListExperimentVariables(ctx context.Context, scope dto.Scope, experimentID string) (*dto.ListExperimentVariables, error) {
	var (
		path   = fmt.Sprintf(chaosListExperimentVariables, experimentID)
		params = make(map[string]string)
	)

	// Add scope parameters
	params["isIdentity"] = "false"
	params = addIdentifierParams(params, scope)

	listExperimentVariables := new(dto.ListExperimentVariables)
	err := c.Client.Get(ctx, path, params, nil, listExperimentVariables)
	if err != nil {
		return nil, fmt.Errorf("failed to list experiment variables: %w", err)
	}

	return listExperimentVariables, nil
}

const (
	chaosListLinuxInfrastructuresPath = "rest/machine/infras"
)

// ListLinuxInfrastructures lists available Linux infrastructure (load runners).
// statusFilter controls the status filter: non-empty values filter by that status, empty string omits the filter.
func (c *ChaosService) ListLinuxInfrastructures(ctx context.Context, scope dto.Scope, statusFilter string) (*dto.ListLinuxInfraResponse, error) {
	var (
		path   = chaosListLinuxInfrastructuresPath
		params = make(map[string]string)
	)

	// Add scope parameters
	params = addIdentifierParams(params, scope)
	params["infraType"] = "Linux"
	params["page"] = "0"
	params["limit"] = "15"

	filter := map[string]any{}
	if statusFilter != "" {
		filter["status"] = statusFilter
	}

	body := map[string]any{
		"filter": filter,
		"sort": map[string]any{
			"field":     "NAME",
			"ascending": true,
		},
	}

	result := new(dto.ListLinuxInfraResponse)
	err := c.Client.Post(ctx, path, params, body, nil, result)
	if err != nil {
		return nil, fmt.Errorf("failed to list linux infras: %w", err)
	}

	return result, nil
}

func (c *ChaosService) ListFaultTemplates(ctx context.Context, scope dto.Scope, pagination *dto.PaginationOptions, hubIdentity, faultType, infrastructureType, infrastructure, search, sortField string, sortAscending, includeAllScope, isEnterprise bool, tags, category, permissionsRequired string) (*dto.ListFaultTemplateResponse, error) {
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if pagination != nil {
		params["page"] = fmt.Sprintf("%d", pagination.Page)
		params["size"] = fmt.Sprintf("%d", pagination.Size)
	}
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if faultType != "" {
		params["type"] = faultType
	}
	if infrastructureType != "" {
		params["infrastructureType"] = infrastructureType
	}
	if infrastructure != "" {
		params["infrastructure"] = infrastructure
	}
	if search != "" {
		params["search"] = search
	}
	if sortField != "" {
		params["sortField"] = sortField
	}
	if sortAscending {
		params["sortAscending"] = "true"
	}
	if includeAllScope {
		params["includeAllScope"] = "true"
	}
	if isEnterprise {
		params["isEnterprise"] = "true"
	}
	if tags != "" {
		params["tags"] = tags
	}
	if category != "" {
		params["category"] = category
	}
	if permissionsRequired != "" {
		params["permissionsRequired"] = permissionsRequired
	}

	out := new(dto.ListFaultTemplateResponse)
	if err := c.Client.Get(ctx, chaosListFaultTemplatesPath, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to list fault templates: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetFaultTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision string) (*dto.GetFaultTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetFaultTemplatePath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if revision != "" {
		params["revision"] = revision
	}

	out := new(dto.GetFaultTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get fault template: %w", err)
	}
	return out, nil
}

func (c *ChaosService) DeleteFaultTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity string) error {
	path := fmt.Sprintf(chaosDeleteFaultTemplatePath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if err := c.Client.Delete(ctx, path, params, nil, nil); err != nil {
		return fmt.Errorf("failed to delete fault template: %w", err)
	}
	return nil
}

func (c *ChaosService) GetFaultTemplateRevisions(ctx context.Context, scope dto.Scope, identity, hubIdentity string, pagination *dto.PaginationOptions) (*dto.ListFaultTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetFaultTemplateRevisionsPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if pagination != nil {
		params["page"] = fmt.Sprintf("%d", pagination.Page)
		params["limit"] = fmt.Sprintf("%d", pagination.Size)
	}

	out := new(dto.ListFaultTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get fault template revisions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetFaultTemplateVariables(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision string) (*dto.FaultTemplateVariablesResponse, error) {
	path := fmt.Sprintf(chaosGetFaultTemplateVariablesPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if revision != "" {
		params["revision"] = revision
	}

	out := new(dto.FaultTemplateVariablesResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get fault template variables: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetFaultTemplateYaml(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision string) (*dto.FaultTemplateYamlResponse, error) {
	path := fmt.Sprintf(chaosGetFaultTemplateYamlPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	if revision != "" {
		params["revision"] = revision
	}

	out := new(dto.FaultTemplateYamlResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get fault template yaml: %w", err)
	}
	return out, nil
}

func (c *ChaosService) CompareFaultTemplateRevisions(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision1, revision2 string) (*dto.FaultTemplateCompareRevisionsResponse, error) {
	path := fmt.Sprintf(chaosCompareFaultTemplateRevsPath, identity)
	params := make(map[string]string)
	params["hubIdentity"] = hubIdentity
	params["correlationID"] = uuid.New().String()
	params["revision1"] = revision1
	params["revision2"] = revision2
	params = addIdentifierParams(params, scope)

	out := new(dto.FaultTemplateCompareRevisionsResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to compare fault template revisions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) ListProbeTemplates(ctx context.Context, scope dto.Scope, hubIdentity, search, infraType, entityType string, includeAllScope bool, page, limit int) (*dto.ListProbeTemplateResponse, error) {
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if search != "" {
		params["search"] = search
	}
	if infraType != "" {
		params["infraType"] = infraType
	}
	if entityType != "" {
		params["entityType"] = entityType
	}
	if includeAllScope {
		params["includeAllScope"] = "true"
	}
	if page > 0 {
		params["page"] = fmt.Sprintf("%d", page)
	}
	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ListProbeTemplateResponse)
	if err := c.Client.Get(ctx, chaosListProbeTemplatesPath, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to list probe templates: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetProbeTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity string, revision int64) (*dto.GetProbeTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetProbeTemplatePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if revision > 0 {
		params["revision"] = fmt.Sprintf("%d", revision)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.GetProbeTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get probe template: %w", err)
	}
	return out, nil
}

func (c *ChaosService) DeleteProbeTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity string, revision int64) (bool, error) {
	path := fmt.Sprintf(chaosDeleteProbeTemplatePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params["hubIdentity"] = hubIdentity
	if revision > 0 {
		params["revision"] = fmt.Sprintf("%d", revision)
	}
	params = addIdentifierParams(params, scope)

	if err := c.Client.Delete(ctx, path, params, nil, nil); err != nil {
		return false, fmt.Errorf("failed to delete probe template: %w", err)
	}
	return true, nil
}

func (c *ChaosService) GetProbeTemplateVariables(ctx context.Context, scope dto.Scope, identity, hubIdentity string, revision int64) (*dto.ProbeTemplateVariablesResponse, error) {
	path := fmt.Sprintf(chaosGetProbeTemplateVariablesPath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if revision > 0 {
		params["revision"] = fmt.Sprintf("%d", revision)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ProbeTemplateVariablesResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get probe template variables: %w", err)
	}
	return out, nil
}

func (c *ChaosService) ListActionTemplates(ctx context.Context, scope dto.Scope, hubIdentity, search, infraType, entityType string, includeAllScope bool, page, limit int) (*dto.ListActionTemplateResponse, error) {
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if search != "" {
		params["search"] = search
	}
	if infraType != "" {
		params["infraType"] = infraType
	}
	if entityType != "" {
		params["entityType"] = entityType
	}
	if includeAllScope {
		params["includeAllScope"] = "true"
	}
	if page > 0 {
		params["page"] = fmt.Sprintf("%d", page)
	}
	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ListActionTemplateResponse)
	if err := c.Client.Get(ctx, chaosListActionTemplatesPath, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to list action templates: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetActionTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity string, revision int64) (*dto.GetActionTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetActionTemplatePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if revision > 0 {
		params["revision"] = fmt.Sprintf("%d", revision)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.GetActionTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get action template: %w", err)
	}
	return out, nil
}

func (c *ChaosService) DeleteActionTemplate(ctx context.Context, scope dto.Scope, identity, hubIdentity string, revision int64) (bool, error) {
	path := fmt.Sprintf(chaosDeleteActionTemplatePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params["hubIdentity"] = hubIdentity
	if revision > 0 {
		params["revision"] = fmt.Sprintf("%d", revision)
	}
	params = addIdentifierParams(params, scope)

	if err := c.Client.Delete(ctx, path, params, nil, nil); err != nil {
		return false, fmt.Errorf("failed to delete action template: %w", err)
	}
	return true, nil
}

func (c *ChaosService) GetActionTemplateRevisions(ctx context.Context, scope dto.Scope, identity, hubIdentity, search, infraType, entityType string, includeAllScope bool, page, limit int) (*dto.ListActionTemplateResponse, error) {
	path := fmt.Sprintf(chaosGetActionTemplateRevisionsPath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if search != "" {
		params["search"] = search
	}
	if infraType != "" {
		params["infraType"] = infraType
	}
	if entityType != "" {
		params["entityType"] = entityType
	}
	if includeAllScope {
		params["includeAllScope"] = "true"
	}
	if page > 0 {
		params["page"] = fmt.Sprintf("%d", page)
	}
	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ListActionTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get action template revisions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetActionTemplateVariables(ctx context.Context, scope dto.Scope, identity, hubIdentity string, revision int64) (*dto.ActionTemplateVariablesResponse, error) {
	path := fmt.Sprintf(chaosGetActionTemplateVariablesPath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	if revision > 0 {
		params["revision"] = fmt.Sprintf("%d", revision)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ActionTemplateVariablesResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get action template variables: %w", err)
	}
	return out, nil
}

func (c *ChaosService) CompareActionTemplateRevisions(ctx context.Context, scope dto.Scope, identity, hubIdentity, revision, revisionToCompare string) (*dto.ListActionTemplateResponse, error) {
	path := fmt.Sprintf(chaosCompareActionTemplateRevisionsPath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if hubIdentity != "" {
		params["hubIdentity"] = hubIdentity
	}
	params["revision"] = revision
	params["revisionToCompare"] = revisionToCompare
	params = addIdentifierParams(params, scope)

	out := new(dto.ListActionTemplateResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to compare action template revisions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) ListChaosGuardConditions(ctx context.Context, scope dto.Scope, search, sortField string, sortAscending bool, infraType, tags string, page, limit int) (*dto.ListChaosGuardConditionsResponse, error) {
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if search != "" {
		params["search"] = search
	}
	if sortField != "" {
		params["sortField"] = sortField
	}
	if sortAscending {
		params["sortAscending"] = "true"
	}
	if infraType != "" {
		params["infrastructureType"] = infraType
	}
	if tags != "" {
		params["tags"] = tags
	}
	if page > 0 {
		params["page"] = fmt.Sprintf("%d", page)
	}
	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ListChaosGuardConditionsResponse)
	if err := c.Client.Get(ctx, chaosListChaosGuardConditionsPath, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to list chaosguard conditions: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetChaosGuardCondition(ctx context.Context, scope dto.Scope, identity string) (*dto.GetChaosGuardConditionResponse, error) {
	path := fmt.Sprintf(chaosGetChaosGuardConditionPath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	out := new(dto.GetChaosGuardConditionResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get chaosguard condition: %w", err)
	}
	return out, nil
}

func (c *ChaosService) DeleteChaosGuardCondition(ctx context.Context, scope dto.Scope, identity string) (*dto.DeleteChaosGuardConditionResponse, error) {
	path := fmt.Sprintf(chaosDeleteChaosGuardConditionPath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	out := new(dto.DeleteChaosGuardConditionResponse)
	if err := c.Client.Delete(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to delete chaosguard condition: %w", err)
	}
	return out, nil
}

func (c *ChaosService) ListChaosGuardRules(ctx context.Context, scope dto.Scope, search, sortField string, sortAscending bool, infraType, tags string, page, limit int) (*dto.ListChaosGuardRulesResponse, error) {
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if search != "" {
		params["search"] = search
	}
	if sortField != "" {
		params["sortField"] = sortField
	}
	if sortAscending {
		params["sortAscending"] = "true"
	}
	if infraType != "" {
		params["infrastructureType"] = infraType
	}
	if tags != "" {
		params["tags"] = tags
	}
	if page > 0 {
		params["page"] = fmt.Sprintf("%d", page)
	}
	if limit > 0 {
		params["limit"] = fmt.Sprintf("%d", limit)
	}
	params = addIdentifierParams(params, scope)

	out := new(dto.ListChaosGuardRulesResponse)
	if err := c.Client.Get(ctx, chaosListChaosGuardRulesPath, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to list chaosguard rules: %w", err)
	}
	return out, nil
}

func (c *ChaosService) GetChaosGuardRule(ctx context.Context, scope dto.Scope, identity string) (*dto.GetChaosGuardRuleResponse, error) {
	path := fmt.Sprintf(chaosGetChaosGuardRulePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	out := new(dto.GetChaosGuardRuleResponse)
	if err := c.Client.Get(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to get chaosguard rule: %w", err)
	}
	return out, nil
}

func (c *ChaosService) DeleteChaosGuardRule(ctx context.Context, scope dto.Scope, identity string) (*dto.DeleteChaosGuardRuleResponse, error) {
	path := fmt.Sprintf(chaosDeleteChaosGuardRulePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	params = addIdentifierParams(params, scope)

	out := new(dto.DeleteChaosGuardRuleResponse)
	if err := c.Client.Delete(ctx, path, params, nil, out); err != nil {
		return nil, fmt.Errorf("failed to delete chaosguard rule: %w", err)
	}
	return out, nil
}

func (c *ChaosService) EnableChaosGuardRule(ctx context.Context, scope dto.Scope, identity string, enabled bool) error {
	path := fmt.Sprintf(chaosEnableChaosGuardRulePath, identity)
	params := make(map[string]string)
	params["correlationID"] = uuid.New().String()
	if enabled {
		params["enabled"] = "true"
	} else {
		params["enabled"] = "false"
	}
	params = addIdentifierParams(params, scope)

	if err := c.Client.Put(ctx, path, params, nil, nil); err != nil {
		return fmt.Errorf("failed to enable/disable chaosguard rule: %w", err)
	}
	return nil
}

func addIdentifierParams(params map[string]string, scope dto.Scope) map[string]string {
	params["accountIdentifier"] = scope.AccountID
	params["projectIdentifier"] = scope.ProjectID
	params["organizationIdentifier"] = scope.OrgID
	return params
}
