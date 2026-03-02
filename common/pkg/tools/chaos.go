package tools

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/harness/harness-go-sdk/harness/utils"
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var identityRegex = regexp.MustCompile(`[^a-z0-9-]+`)

// ListExperimentsTool creates a tool for listing the experiments
func ListExperimentsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
func GetExperimentsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
func GetExperimentRunsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
func RunExperimentTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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

// StopExperimentRunsTool creates a tool for stopping the experiment runs
func StopExperimentRunsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_experiments_stop",
			mcp.WithDescription("Stops a chaos experiment run. If notifyId is set, the run is found by notifyId and scope; otherwise by experimentRunID and scope. If both are omitted, all runs for the experiment with phase 'Running' are stopped."),
			common.WithScope(config, false),
			mcp.WithString("experimentID",
				mcp.Description("Unique Identifier for an experiment"),
				mcp.Required(),
			),
			mcp.WithString("experimentRunID",
				mcp.Description("Unique identifier of the experiment run to stop. If omitted, the stop request may apply to the latest or all relevant runs depending on backend behavior."),
			),
			mcp.WithString("notifyId",
				mcp.Description("Notification or callback identifier associated with the experiment run; used to correlate the stop request with the run that was started."),
			),
			mcp.WithBoolean("force",
				mcp.Description("When true, immediately marks the run as Stopped in the database (run, execution nodes, experiment recents). When false (default), only requests stop on cluster/machine; DB is updated later when the delegate or infra reports status."),
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

			if !isValidUUID(experimentID) { // do we need this check as in hce it's treated as string?
				return mcp.NewToolResultError(fmt.Sprintf("invalid experimentID %s, expected a valid UUID", experimentID)), nil
			}

			experimentRunID, err := OptionalParam[string](request, "experimentRunID")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			notifyId, err := OptionalParam[string](request, "notifyId")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			force, err := OptionalParam[bool](request, "force")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.StopExperimentRuns(ctx, scope, experimentID, experimentRunID, notifyId, force)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal stop chaos experiment response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListProbesTool creates a tool for listing the probes
func ListProbesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
func GetProbeTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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

// GetProbeManifestTool creates a tool to get the probe YAML manifest (chaos engine compatible).
func GetProbeManifestTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_manifest",
			mcp.WithDescription("Get the YAML manifest for a chaos probe by its ID (compatible with chaos engine)"),
			common.WithScope(config, false),
			mcp.WithString("probeId",
				mcp.Description("Unique Identifier for the probe"),
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

			manifest, err := client.GetProbeManifest(ctx, scope, probeID)
			if err != nil {
				return nil, fmt.Errorf("failed to get probe manifest: %w", err)
			}

			// Return as JSON object for consistency with other tools
			r, err := json.Marshal(map[string]string{"manifest": manifest})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal probe manifest response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// EnableProbeTool creates a tool to enable or disable a chaos probe.
func EnableProbeTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_probe_enable",
			mcp.WithDescription("Enable or disable a chaos probe by ID; optionally bulk-update across all experiments"),
			common.WithScope(config, false),
			mcp.WithString("probeId",
				mcp.Description("Unique Identifier for the probe"),
				mcp.Required(),
			),
			mcp.WithBoolean("isEnabled",
				mcp.Description("True to enable the probe, false to disable"),
				mcp.Required(),
			),
			mcp.WithBoolean("isBulkUpdate",
				mcp.Description("When true, enable/disable the probe across all experiments that use it"),
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

			isEnabled, ok, err := OptionalParamOK[bool](request, "isEnabled")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if !ok {
				return mcp.NewToolResultError("missing required parameter: isEnabled"), nil
			}

			var isBulkUpdate *bool
			if bulkVal, bulkOK, _ := OptionalParamOK[bool](request, "isBulkUpdate"); bulkOK {
				isBulkUpdate = &bulkVal
			}

			msg, err := client.EnableProbe(ctx, scope, probeID, isEnabled, isBulkUpdate)
			if err != nil {
				return nil, fmt.Errorf("failed to enable/disable probe: %w", err)
			}

			r, err := json.Marshal(map[string]string{"message": msg})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal enable probe response: %v", err)), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListFaultsTool creates a tool for listing chaos faults in a project.
func ListFaultsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_faults_list",
			mcp.WithDescription("List the chaos faults"),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithBoolean("isEnterprise",
				mcp.Description("When true, list only enterprise faults"),
			),
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

			isEnterprise, _ := OptionalParam[bool](request, "isEnterprise")

			data, err := client.ListFaults(ctx, scope, pagination, isEnterprise)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list chaos faults response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetFaultVariablesTool creates a tool to get the inputs/variables of a chaos fault.
func GetFaultVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_variables",
			mcp.WithDescription("Retrieves the list of inputs and variables (variables, faultAuthentication, faultTargets, faultTunable) for a chaos fault by its identity"),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identity of the fault"),
				mcp.Required(),
			),
			mcp.WithBoolean("isEnterprise",
				mcp.Description("When true, get variables for an enterprise fault"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			isEnterprise, _ := OptionalParam[bool](request, "isEnterprise")

			data, err := client.GetFaultVariables(ctx, scope, identity, isEnterprise)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal fault variables response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetFaultTool creates a tool to get a single chaos fault by identity.
func GetFaultTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_describe",
			mcp.WithDescription("Get details of a single chaos fault by its identity"),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identity of the fault"),
				mcp.Required(),
			),
			mcp.WithBoolean("isEnterprise",
				mcp.Description("When true, get an enterprise fault"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			isEnterprise, _ := OptionalParam[bool](request, "isEnterprise")

			data, err := client.GetFault(ctx, scope, identity, isEnterprise)
			if err != nil {
				return nil, fmt.Errorf("failed to get fault: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get fault response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetFaultYamlTool creates a tool to get the fault template YAML by identity.
func GetFaultYamlTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_yaml",
			mcp.WithDescription("Get the fault template YAML for a chaos fault by its identity"),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identity of the fault"),
				mcp.Required(),
			),
			mcp.WithBoolean("isEnterprise",
				mcp.Description("When true, get YAML for an enterprise fault"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			isEnterprise, _ := OptionalParam[bool](request, "isEnterprise")

			data, err := client.GetFaultYaml(ctx, scope, identity, isEnterprise)
			if err != nil {
				return nil, fmt.Errorf("failed to get fault yaml: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal fault yaml response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListExperimentRunsOfFaultTool creates a tool to list experiment runs for a chaos fault.
func ListExperimentRunsOfFaultTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_experiment_runs",
			mcp.WithDescription("List experiment runs for a chaos fault by its identity"),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identity of the fault"),
				mcp.Required(),
			),
			WithPagination(),
			mcp.WithBoolean("isEnterprise",
				mcp.Description("When true, list runs for an enterprise fault"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			page, size, err := FetchPagination(request)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			pagination := &dto.PaginationOptions{Page: page, Size: size}
			isEnterprise, _ := OptionalParam[bool](request, "isEnterprise")

			data, err := client.ListExperimentRunsOfFault(ctx, scope, identity, pagination, isEnterprise)
			if err != nil {
				return nil, fmt.Errorf("failed to list experiment runs of fault: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list experiment runs of fault response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// DeleteFaultTool creates a tool to delete a chaos fault by its identity.
// The upstream API performs a soft-delete and rejects the request if the fault
// is still referenced by any experiment.
func DeleteFaultTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_fault_delete",
			mcp.WithDescription("Delete a chaos fault by its identity. The fault must not be in use by any experiment. This performs a soft-delete."),
			common.WithScope(config, false),
			mcp.WithString("identity",
				mcp.Description("Unique identity of the fault to delete"),
				mcp.Required(),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			identity, err := RequiredParam[string](request, "identity")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			data, err := client.DeleteFault(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to delete fault: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal delete fault response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// CreateExperimentFromTemplateTool creates a tool to create the experiment from template
func CreateExperimentFromTemplateTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
func ListExperimentTemplatesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
func ListExperimentVariablesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
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
			return errors.New(errMsg)
		}
		found := false
		for _, x := range experimentRunRequest.RuntimeInputs.Experiment {
			if exp.Name == x.Name {
				found = true
				break
			}
		}
		if !found {
			return errors.New(errMsg)
		}
	}

	for key, tasks := range variables.Tasks {
		if len(tasks) == 0 {
			continue
		}
		if experimentRunRequest == nil || experimentRunRequest.RuntimeInputs == nil {
			return errors.New(errMsg)
		}
		actualTasksVars, ok := experimentRunRequest.RuntimeInputs.Tasks[key]
		if !ok {
			return errors.New(errMsg)
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
				return errors.New(errMsg)
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

// ListLinuxInfrastructuresTool creates a tool for listing Linux infrastructure (load runners)
func ListLinuxInfrastructuresTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool("chaos_list_linux_infrastructures",
			mcp.WithDescription("List available Linux infrastructure for chaos engineering and load testing. Returns chaos Linux infrastructures (load infrastructures) with their IDs, names, and status. Infra IDs are needed when creating sample load tests via chaos_create_sample_loadtest. By default only active infrastructures are returned; set status to 'All' to list all."),
			common.WithScope(config, false),
			mcp.WithString("status",
				mcp.Description("Filter by infra status. Defaults to 'Active'. Use 'All' to list all infras regardless of status."),
				mcp.Enum("Active", "All"),
			),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			statusFilter := "Active"
			status, err := OptionalParam[string](request, "status")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if status == "All" {
				statusFilter = ""
			} else if status != "" {
				statusFilter = status
			}

			data, err := client.ListLinuxInfrastructures(ctx, scope, statusFilter)
			if err != nil {
				return nil, fmt.Errorf("failed to list linux infras: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal list linux infras response: %w", err)
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
