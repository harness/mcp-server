package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/harness/harness-go-sdk/harness/utils"
	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var identityRegex = regexp.MustCompile(`[^a-z0-9-]+`)

// ListExperimentsTool creates a tool for listing the experiments
func ListExperimentsTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiments_list",
			mcp.WithDescription("List the chaos experiments"),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListExperiments(ctx, scope, pagination)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetExperimentsTool creates a tool to get the experiment details
func GetExperimentsTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_describe",
			mcp.WithDescription("Retrieves information about chaos experiment, allowing users to get an overview and detailed insights for each experiment"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experiment ID %s, expected a valid UUID", experimentID)), nil
				}
			}

			data, err := client.GetExperiment(ctx, scope, experimentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetExperimentRunsTool creates a tool to get the experiment run details
func GetExperimentRunsTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_run_result",
			mcp.WithDescription("Retrieves run result of chaos experiment runs, helping to describe and summarize the details of each experiment run"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
			mcp.WithString("experimentRunID",
				mcp.Description("Unique Identifier for an experiment run"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
				}
			}

			experimentRunID, err := RequiredParam[string](request, "experimentRunID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentRunID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentRunID %s, expected a valid UUID", experimentRunID)), nil
				}
			}

			data, err := client.GetExperimentRun(ctx, scope, experimentID, experimentRunID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get chaos experiment run response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// RunExperimentTool creates a tool to run the experiment
func RunExperimentTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_run",
			mcp.WithDescription("Run the chaos experiment"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
			mcp.WithString("inputsetIdentity",
				mcp.Description("Optional inputset identity to use for the experiment run"),
			),
			mcp.WithArray("experimentVariables",
				mcp.Description("Optional experiment variables as an array of objects where each object has a name and value"),
				mcp.Items(map[string]any{
					"type": "object",
					"properties": map[string]any{
						"name": map[string]any{
							"type":        "string",
							"description": "Name of the variable",
						},
						"value": map[string]any{
							"type":        "string",
							"description": "Value of the variable",
						},
					},
					"required": []string{"name"},
				}),
			),
			mcp.WithObject("tasks",
				mcp.Description("Optional task-level variables as a map where key is task name and value is an object of variable name-value pairs"),
				mcp.Properties(map[string]any{}), // no fixed props
				mcp.AdditionalProperties(map[string]any{
					"type":                 "object",
					"additionalProperties": map[string]any{},
				}),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {

			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				if err != nil {
					return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
				}
			}

			inputsetIdentity, err := OptionalParam[string](request, "inputsetIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentVariablesRaw, err := OptionalParam[[]interface{}](request, "experimentVariables")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			taskVariablesRaw, err := OptionalParam[map[string]any](request, "tasks")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentRunRequest := getRuntimeVariables(inputsetIdentity, experimentVariablesRaw, taskVariablesRaw)

			if err := validateVariables(ctx, scope, experimentID, client, experimentRunRequest); err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.RunExperiment(ctx, scope, experimentID, experimentRunRequest)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal run chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListProbesTool creates a tool for listing the probes
func ListProbesTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probes_list",
			mcp.WithDescription("List the chaos probes"),
			common.WithScope(config, false),
			WithPagination(),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListProbes(ctx, scope, pagination)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos probes response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetProbeTool creates a tool to get the probe details
func GetProbeTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_describe",
			mcp.WithDescription("Retrieves information about chaos probe, allowing users to get an overview and detailed insights for each probe"),
			common.WithScope(config, false),
			mcp.WithString("probeId",
				mcp.Description("Unique Identifier for a probe"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			probeID, err := RequiredParam[string](request, "probeId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.GetProbe(ctx, scope, probeID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get chaos probe response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CreateExperimentFromTemplateTool creates a tool to create the experiment from template
func CreateExperimentFromTemplateTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_create_experiment_from_template",
			mcp.WithDescription("Create the chaos experiment from template"),
			common.WithScope(config, false),
			mcp.WithString("templateId",
				mcp.Description("Unique Identifier for a experiment template"),
				mcp.Required(),
			),
			mcp.WithString("infraId",
				mcp.Description("Unique Identifier for a infrastructure"),
				mcp.Required(),
			),
			mcp.WithString("environmentId",
				mcp.Description("Unique Identifier for a environment"),
				mcp.Required(),
			),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique Identifier for a chaos hub"),
				mcp.Required(),
			),
			mcp.WithString("name",
				mcp.Description("User defined name of the experiment"),
			),
			mcp.WithString("identity",
				mcp.Description("User defined identity of the experiment"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			templateID, err := RequiredParam[string](request, "templateId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infraID, err := RequiredParam[string](request, "infraId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			environmentID, err := RequiredParam[string](request, "environmentId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !strings.HasPrefix(infraID, fmt.Sprintf("%s/", environmentID)) {
				infraID = fmt.Sprintf("%s/%s", environmentID, infraID)
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			name, err := OptionalParam[string](request, "name")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if name == "" {
				name = fmt.Sprintf("%s-%s", templateID, utils.RandStringBytes(3))
			}

			identity, err := OptionalParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if identity == "" {
				identity = generateIdentity(name)
			}

			requestPayload := dto.CreateExperimentFromTemplateRequest{
				InfraRef: infraID,
				IdentifiersQuery: dto.IdentifiersQuery{
					AccountIdentifier:      scope.AccountID,
					OrganizationIdentifier: scope.OrgID,
					ProjectIdentifier:      scope.ProjectID,
				},
				Name:     name,
				Identity: identity,
			}

			data, err := client.CreateExperimentFromTemplateRequest(ctx, scope, templateID, hubIdentity, requestPayload)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal create chaos experiment from template response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListExperimentTemplatesTool creates a tool for listing the experiment templates
func ListExperimentTemplatesTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_template_list",
			mcp.WithDescription("List the chaos experiment templates"),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString("hubIdentity",
				mcp.Description("Unique Identifier for a chaos hub"),
				mcp.Required(),
			),
			mcp.WithString("infrastructureType",
				mcp.Description("infrastructure type filter for the experiment template"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			hubIdentity, err := RequiredParam[string](request, "hubIdentity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			infrastructureType, err := OptionalParam[string](request, "infrastructureType")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{
				Page: page,
				Size: size,
			}

			data, err := client.ListExperimentTemplates(ctx, scope, pagination, hubIdentity, infrastructureType)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos experiment templates response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListExperimentVariablesTool creates a tool for listing the experiment variables
func ListExperimentVariablesTool(config *config.Config, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiment_variables_list",
			mcp.WithDescription("List the chaos experiment variables"),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentID, err := RequiredParam[string](request, "experimentID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			if !isValidUUID(experimentID) {
				return nil, fmt.Errorf("invalid experiment ID %s, expected a valid UUID", experimentID)
			}

			data, err := client.ListExperimentVariables(ctx, scope, experimentID)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos experiment variables response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

func isValidUUID(u string) bool {
	_, err := uuid.Parse(u)
	return err == nil
}

// generateIdentity converts a name string into a valid identity.
// Allowed characters: lowercase letters, digits, and hyphens.
func generateIdentity(name string) string {
	// Convert to lowercase
	identity := strings.ToLower(name)

	// Replace spaces and underscores with hyphens
	identity = strings.ReplaceAll(identity, " ", "-")
	identity = strings.ReplaceAll(identity, "_", "-")

	// Remove all invalid characters (anything not a-z, 0-9, or hyphen)
	identity = identityRegex.ReplaceAllString(identity, "")

	// Remove leading or trailing hyphens
	identity = strings.Trim(identity, "-")

	return identity
}

func validateVariables(ctx context.Context, scope dto.Scope, experimentID string, client *client.ChaosService, experimentRunRequest *dto.ExperimentRunRequest) error {
	var (
		errMsg = "experiment variables are required. Try running the experiment by providing experiment and tasks variables"
	)

	// validate the inputs
	variables, err := client.ListExperimentVariables(ctx, scope, experimentID)
	if err != nil {
		return fmt.Errorf("failed to list experiment variables: %w", err)
	}

	if variables == nil || (len(variables.Tasks) == 0 && len(variables.Experiment) == 0) {
		return nil
	}

	if experimentRunRequest != nil && experimentRunRequest.InputsetIdentity != "" {
		return nil
	}

	for _, exp := range variables.Experiment {
		if experimentRunRequest == nil || experimentRunRequest.RuntimeInputs == nil {
			return fmt.Errorf("%s", errMsg)
		}
		found := false
		for _, x := range experimentRunRequest.RuntimeInputs.Experiment {
			if exp.Name == x.Name {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("%s", errMsg)
		}
	}

	for key, tasks := range variables.Tasks {
		if len(tasks) == 0 {
			continue
		}
		if experimentRunRequest == nil || experimentRunRequest.RuntimeInputs == nil {
			return fmt.Errorf("%s", errMsg)
		}
		actualTasksVars, ok := experimentRunRequest.RuntimeInputs.Tasks[key]
		if !ok {
			return fmt.Errorf("%s", errMsg)
		}
		for _, task := range tasks {
			found := false
			for _, vars := range actualTasksVars {
				if vars.Name == task.Name {
					found = true
					break
				}
			}
			if !found {
				return fmt.Errorf("%s", errMsg)
			}
		}
	}
	return nil
}

func getRuntimeVariables(inputsetIdentity string, experimentVariablesRaw []interface{}, taskVariablesRaw map[string]any) *dto.ExperimentRunRequest {
	var (
		experimentVariables  []dto.VariableMinimum
		tasksVariables       = make(map[string][]dto.VariableMinimum)
		experimentRunRequest *dto.ExperimentRunRequest
	)

	for _, item := range experimentVariablesRaw {
		if itemMap, ok := item.(map[string]interface{}); ok {
			name, ok := itemMap["name"].(string)
			if !ok {
				continue
			}
			value, _ := itemMap["value"]
			experimentVariables = append(experimentVariables, dto.VariableMinimum{
				Name:  name,
				Value: value,
			})
		}
	}

	for key, item := range taskVariablesRaw {
		var taskVariables []dto.VariableMinimum
		if itemMap, ok := item.(map[string]interface{}); ok {
			for name, value := range itemMap {
				taskVariables = append(taskVariables, dto.VariableMinimum{
					Name:  name,
					Value: value,
				})
			}
		}
		tasksVariables[key] = taskVariables
	}

	if len(experimentVariables) > 0 || len(tasksVariables) > 0 {
		inputsetSpec := &dto.ChaosExperimentInputsetSpec{}
		if len(experimentVariables) > 0 {
			inputsetSpec.Experiment = experimentVariables
		}
		if len(tasksVariables) > 0 {
			inputsetSpec.Tasks = tasksVariables
		}
		experimentRunRequest = &dto.ExperimentRunRequest{
			InputsetIdentity: inputsetIdentity,
			RuntimeInputs:    inputsetSpec,
		}
	}

	if inputsetIdentity != "" {
		if experimentRunRequest == nil {
			experimentRunRequest = &dto.ExperimentRunRequest{}
		}
		experimentRunRequest.InputsetIdentity = inputsetIdentity
	}

	return experimentRunRequest
}
