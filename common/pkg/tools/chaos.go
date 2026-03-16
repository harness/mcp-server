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
	"github.com/harness/mcp-server/common/pkg/chaoscommons"
	"github.com/harness/mcp-server/common/pkg/common"
	mcputils "github.com/harness/mcp-server/common/pkg/utils"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

var identityRegex = regexp.MustCompile(`[^a-z0-9-]+`)

// ListExperimentsTool creates a tool for listing the experiments
func ListExperimentsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolExperimentsList,
			mcp.WithDescription(chaoscommons.DescToolExperimentsList),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolExperimentDescribe,
			mcp.WithDescription(chaoscommons.DescToolExperimentDescribe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolExperimentRunResult,
			mcp.WithDescription(chaoscommons.DescToolExperimentRunResult),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamExperimentRunID,
				mcp.Description(chaoscommons.DescExperimentRunID),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolExperimentRun,
			mcp.WithDescription(chaoscommons.DescToolExperimentRun),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInputsetIdentity,
				mcp.Description(chaoscommons.DescInputsetIdentity),
			),
			mcp.WithArray(chaoscommons.ParamExperimentVariables,
				mcp.Description(chaoscommons.DescExperimentVariables),
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
			mcp.WithObject(chaoscommons.ParamTasks,
				mcp.Description(chaoscommons.DescTasks),
				mcp.Properties(map[string]any{}),
				mcp.AdditionalProperties(map[string]any{
					"type":                 "object",
					"additionalProperties": map[string]any{},
				}),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolStopExperiment,
			mcp.WithDescription(chaoscommons.DescToolStopExperiment),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamExperimentRunID,
				mcp.Description(chaoscommons.DescExperimentRunIDStop),
			),
			mcp.WithString(chaoscommons.ParamNotifyId,
				mcp.Description(chaoscommons.DescNotifyId),
			),
			mcp.WithBoolean(chaoscommons.ParamForce,
				mcp.Description(chaoscommons.DescForce),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
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

// ListProbesTool creates a tool for listing down the probes
func ListProbesTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolProbesList,
			mcp.WithDescription(chaoscommons.DescToolProbesList),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolProbeDescribe,
			mcp.WithDescription(chaoscommons.DescToolProbeDescribe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamProbeId,
				mcp.Description(chaoscommons.DescProbeId),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolGetProbeManifest,
			mcp.WithDescription(chaoscommons.DescToolGetProbeManifest),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamProbeId,
				mcp.Description(chaoscommons.DescProbeId),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolEnableProbe,
			mcp.WithDescription(chaoscommons.DescToolEnableProbe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamProbeId,
				mcp.Description(chaoscommons.DescProbeId),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamIsEnabled,
				mcp.Description(chaoscommons.DescIsEnabled),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamIsBulkUpdate,
				mcp.Description(chaoscommons.DescIsBulkUpdate),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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

// DeleteProbeTool creates a tool to delete a chaos probe by its ID.
// The probe must be disabled and not in use by any experiment before deletion.
func DeleteProbeTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolDeleteProbe,
			mcp.WithDescription(chaoscommons.DescToolDeleteProbe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamProbeId,
				mcp.Description(chaoscommons.DescProbeIdDelete),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
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

			data, err := client.DeleteProbe(ctx, scope, probeID)
			if err != nil {
				return nil, fmt.Errorf("failed to delete probe: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal delete probe response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// VerifyProbeTool creates a tool to verify or unverify a chaos probe.
// Default probes cannot be verified/unverified.
func VerifyProbeTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolVerifyProbe,
			mcp.WithDescription(chaoscommons.DescToolVerifyProbe),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamProbeId,
				mcp.Description(chaoscommons.DescProbeIdVerify),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamVerify,
				mcp.Description(chaoscommons.DescVerify),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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

			verify, ok, err := OptionalParamOK[bool](request, "verify")
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}
			if !ok {
				return mcp.NewToolResultError("missing required parameter: verify"), nil
			}

			msg, err := client.VerifyProbe(ctx, scope, probeID, verify)
			if err != nil {
				return nil, fmt.Errorf("failed to verify probe: %w", err)
			}

			r, err := json.Marshal(map[string]string{"message": msg})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal verify probe response: %v", err)), nil
			}
			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetProbesInExperimentRunTool creates a tool to get probe execution details for experiment runs.
func GetProbesInExperimentRunTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolListProbesInExperimentRun,
			mcp.WithDescription(chaoscommons.DescToolListProbesInExperimentRun),
			common.WithScope(config, false),
			mcp.WithArray(chaoscommons.ParamExperimentRunIds,
				mcp.Description(chaoscommons.DescExperimentRunIds),
				mcp.Items(map[string]any{"type": "string"}),
			),
			mcp.WithArray(chaoscommons.ParamNotifyIds,
				mcp.Description(chaoscommons.DescNotifyIds),
				mcp.Items(map[string]any{"type": "string"}),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
		),
		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			scope, err := common.FetchScope(ctx, config, request, false)
			if err != nil {
				return mcp.NewToolResultError(err.Error()), nil
			}

			experimentRunIDs, _ := OptionalParam[[]interface{}](request, "experimentRunIds")
			notifyIDs, _ := OptionalParam[[]interface{}](request, "notifyIds")

			// should we remove this check and allow API to be hit to hce-saas as keeping same validation logic on both repos can cause inconsistencies in future?
			if len(experimentRunIDs) == 0 && len(notifyIDs) == 0 {
				return mcp.NewToolResultError("at least one of experimentRunIds or notifyIds must be provided"), nil
			}

			body := dto.ProbeDetailsInExperimentRequest{}
			for _, id := range experimentRunIDs {
				if s, ok := id.(string); ok {
					body.ExperimentRunIDs = append(body.ExperimentRunIDs, s)
				}
			}
			for _, id := range notifyIDs {
				if s, ok := id.(string); ok {
					body.NotifyIDs = append(body.NotifyIDs, s)
				}
			}

			data, err := client.GetProbesInExperimentRun(ctx, scope, body)
			if err != nil {
				return nil, fmt.Errorf("failed to get probes in experiment run: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal probes in experiment run response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// ListFaultsTool creates a tool for listing chaos faults in a project.
func ListFaultsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolListFaults,
			mcp.WithDescription(chaoscommons.DescToolListFaults),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithBoolean(chaoscommons.ParamIsEnterprise,
				mcp.Description(chaoscommons.DescIsEnterprise),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolGetFaultVariables,
			mcp.WithDescription(chaoscommons.DescToolGetFaultVariables),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescFaultIdentity),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamIsEnterprise,
				mcp.Description(chaoscommons.DescIsEnterpriseVars),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolGetFault,
			mcp.WithDescription(chaoscommons.DescToolGetFault),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescFaultIdentity),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamIsEnterprise,
				mcp.Description(chaoscommons.DescIsEnterpriseGet),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolGetFaultYaml,
			mcp.WithDescription(chaoscommons.DescToolGetFaultYaml),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescFaultIdentity),
				mcp.Required(),
			),
			mcp.WithBoolean(chaoscommons.ParamIsEnterprise,
				mcp.Description(chaoscommons.DescIsEnterpriseYaml),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolListFaultExperimentRuns,
			mcp.WithDescription(chaoscommons.DescToolListFaultExperimentRuns),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescFaultIdentity),
				mcp.Required(),
			),
			WithPagination(),
			mcp.WithBoolean(chaoscommons.ParamIsEnterprise,
				mcp.Description(chaoscommons.DescIsEnterpriseRuns),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolDeleteFault,
			mcp.WithDescription(chaoscommons.DescToolDeleteFault),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescFaultIdentityDelete),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
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
	return mcp.NewTool(chaoscommons.ToolCreateExperimentFromTemplate,
			mcp.WithDescription(chaoscommons.DescToolCreateExperimentFromTemplate),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamTemplateId,
				mcp.Description(chaoscommons.DescTemplateId),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInfraId,
				mcp.Description(chaoscommons.DescInfraId),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamEnvironmentId,
				mcp.Description(chaoscommons.DescEnvironmentId),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentity),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamName,
				mcp.Description(chaoscommons.DescExperimentName),
			),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescExperimentIdentity),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolExperimentTemplateList,
			mcp.WithDescription(chaoscommons.DescToolExperimentTemplateList),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentity),
				mcp.Required(),
			),
			mcp.WithString(chaoscommons.ParamInfrastructureType,
				mcp.Description(chaoscommons.DescInfrastructureType),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolExperimentVariablesList,
			mcp.WithDescription(chaoscommons.DescToolExperimentVariablesList),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamExperimentID,
				mcp.Description(chaoscommons.DescExperimentID),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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
	return mcp.NewTool(chaoscommons.ToolListLinuxInfrastructures,
			mcp.WithDescription(chaoscommons.DescToolListLinuxInfrastructures),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamStatus,
				mcp.Description(chaoscommons.DescStatus),
				mcp.Enum("Active", "All"),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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

// ListActionsTool creates a tool for listing chaos actions.
func ListActionsTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolListActions,
			mcp.WithDescription(chaoscommons.DescToolListActions),
			common.WithScope(config, false),
			WithPagination(),
			mcp.WithString(chaoscommons.ParamHubIdentity,
				mcp.Description(chaoscommons.DescHubIdentityActions),
			),
			mcp.WithString(chaoscommons.ParamSearch,
				mcp.Description(chaoscommons.DescSearchActions),
			),
			mcp.WithString(chaoscommons.ParamInfraType,
				mcp.Description(chaoscommons.DescInfraType),
				mcp.Enum("Kubernetes", "KubernetesV2", "Windows", "Linux", "CloudFoundry", "Container"),
			),
			mcp.WithString(chaoscommons.ParamEntityType,
				mcp.Description(chaoscommons.DescEntityType),
				mcp.Enum("delay", "customScript", "container"),
			),
			mcp.WithBoolean(chaoscommons.ParamIncludeAllScope,
				mcp.Description(chaoscommons.DescIncludeAllScope),
				mcp.DefaultBool(false),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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

			pagination := &dto.PaginationOptions{Page: page, Size: size}

			hubIdentity, _ := OptionalParam[string](request, "hubIdentity")
			search, _ := OptionalParam[string](request, "search")
			infraType, _ := OptionalParam[string](request, "infraType")
			entityType, _ := OptionalParam[string](request, "entityType")
			includeAllScope, _ := OptionalParam[bool](request, "includeAllScope")

			data, err := client.ListActions(ctx, scope, pagination, hubIdentity, search, infraType, entityType, includeAllScope)
			if err != nil {
				return nil, fmt.Errorf("failed to list actions: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal list actions response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetActionTool creates a tool to get a single chaos action by its identity.
func GetActionTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolGetAction,
			mcp.WithDescription(chaoscommons.DescToolGetAction),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescActionIdentityGet),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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

			data, err := client.GetAction(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to get action: %w", err)
			}

			r, err := json.Marshal(data)
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal get action response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// GetActionManifestTool creates a tool to get the YAML manifest for a chaos action.
func GetActionManifestTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolGetActionManifest,
			mcp.WithDescription(chaoscommons.DescToolGetActionManifest),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescActionIdentityManifest),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(true),
				DestructiveHint: mcputils.ToBoolPtr(false),
			}),
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

			manifest, err := client.GetActionManifest(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to get action manifest: %w", err)
			}

			r, err := json.Marshal(map[string]string{"manifest": manifest})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal action manifest response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}

// DeleteActionTool creates a tool to delete a chaos action by its identity.
// The upstream API performs a soft-delete.
func DeleteActionTool(config *config.McpServerConfig, client *client.ChaosService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	return mcp.NewTool(chaoscommons.ToolDeleteAction,
			mcp.WithDescription(chaoscommons.DescToolDeleteAction),
			common.WithScope(config, false),
			mcp.WithString(chaoscommons.ParamIdentity,
				mcp.Description(chaoscommons.DescActionIdentityDelete),
				mcp.Required(),
			),
			mcp.WithToolAnnotation(mcp.ToolAnnotation{
				ReadOnlyHint:    mcputils.ToBoolPtr(false),
				DestructiveHint: mcputils.ToBoolPtr(true),
			}),
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

			deleted, err := client.DeleteAction(ctx, scope, identity)
			if err != nil {
				return nil, fmt.Errorf("failed to delete action: %w", err)
			}

			r, err := json.Marshal(map[string]bool{"deleted": deleted})
			if err != nil {
				return mcp.NewToolResultError(fmt.Sprintf("failed to marshal delete action response: %v", err)), nil
			}

			return mcp.NewToolResultText(string(r)), nil
		}
}
