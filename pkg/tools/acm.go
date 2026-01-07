package tools

import (
	"context"
	"encoding/json"
	"fmt"

	client "github.com/harness/mcp-server/client"
	"github.com/harness/mcp-server/client/dto"
	config "github.com/harness/mcp-server/common"
	commonScopeUtils "github.com/harness/mcp-server/common/pkg/common"
	commonTools "github.com/harness/mcp-server/common/pkg/tools"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// CreateAutonomousCodeMaintenanceTaskTool creates a tool for creating autonomous code maintenance tasks
func CreateAutonomousCodeMaintenanceTaskTool(config *config.McpServerConfig, client *client.ACMService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	tool = mcp.NewTool("create_autonomous_code_maintenance_task",
		mcp.WithDescription(`Create a new autonomous code maintenance task that will create a coding task in the cloud.
Autonomous code maintenance tasks allow you to create and execute coding tasks remotely.
Once a task is created, you need to trigger it for a repository and branch to execute it.`),
		mcp.WithString("name",
			mcp.Required(),
			mcp.Description("The name of the task"),
		),
		mcp.WithString("identifier",
			mcp.Required(),
			mcp.Description("The identifier of the task"),
		),
		mcp.WithString("instructions",
			mcp.Required(),
			mcp.Description("The instructions for the task"),
		),
		commonScopeUtils.WithScope(config, false),
	)

	handler = func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Extract required parameters
		name, err := commonTools.RequiredParam[string](request, "name")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		identifier, err := commonTools.RequiredParam[string](request, "identifier")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		instructions, err := commonTools.RequiredParam[string](request, "instructions")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Get scope
		scope, err := commonScopeUtils.FetchScope(ctx, config, request, false)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Construct the space_ref
		orgProjectPath := fmt.Sprintf("%s/%s", scope.OrgID, scope.ProjectID)

		// Create the request
		createRequest := &dto.CreateACMTaskRequest{
			Name:         name,
			Identifier:   identifier,
			Instructions: instructions,
			Path:         orgProjectPath,
		}

		// Call the service
		response, err := client.CreateTask(ctx, scope, createRequest)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to create task: %v", err)), nil
		}

		// Create a result that includes the task link
		baseURL := config.BaseURL
		taskLink := fmt.Sprintf("%s/ng/account/%s/module/autoai/orgs/%s/projects/%s/tasks/%s",
			baseURL, scope.AccountID, scope.OrgID, scope.ProjectID, response.ID)

		// Create a struct that includes the response and the link
		result := struct {
			*dto.ACMTaskResponse
			TaskLink string `json:"task_link"`
		}{
			ACMTaskResponse: response,
			TaskLink:        taskLink,
		}

		// Return the result as JSON
		resultBytes, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal response: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resultBytes)), nil
	}

	return tool, handler
}

// TriggerAutonomousCodeMaintenanceTaskTool creates a tool for triggering execution of autonomous code maintenance tasks
func TriggerAutonomousCodeMaintenanceTaskTool(config *config.McpServerConfig, client *client.ACMService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	tool = mcp.NewTool("trigger_autonomous_code_maintenance_task",
		mcp.WithDescription("Trigger execution of an autonomous code maintenance task with a specific repository and branch. This requies that an autonomous code maintenance task was already created or already exists."),
		mcp.WithString("task_id",
			mcp.Required(),
			mcp.Description("The ID of the task to execute"),
		),
		mcp.WithString("repository_path",
			mcp.Required(),
			mcp.Description("The path of the repository to run the task against. It's the complete path with the account/org/project details."),
		),
		mcp.WithString("source_branch",
			mcp.Required(),
			mcp.Description("The source branch to run the task against"),
		),
		commonScopeUtils.WithScope(config, false),
	)

	handler = func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Extract required parameters
		taskID, err := commonTools.RequiredParam[string](request, "task_id")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		repoID, err := commonTools.RequiredParam[string](request, "repository_path")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		sourceBranch, err := commonTools.RequiredParam[string](request, "source_branch")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Get scope
		scope, err := commonScopeUtils.FetchScope(ctx, config, request, false)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Create the request
		executeRequest := &dto.TriggerACMTaskExecutionRequest{
			TaskID:       taskID,
			RepositoryID: repoID,
			SourceBranch: sourceBranch,
		}

		// Call the service
		response, err := client.TriggerTaskExecution(ctx, scope, executeRequest)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to trigger task execution: %v", err)), nil
		}

		// Create a result that includes the task link
		baseURL := config.BaseURL
		taskLink := fmt.Sprintf("%s/ng/account/%s/module/autoai/orgs/%s/projects/%s/tasks/%s",
			baseURL, scope.AccountID, scope.OrgID, scope.ProjectID, response.TaskID)

		// Create a struct that includes the response and the link
		result := struct {
			*dto.ACMExecution
			TaskLink string `json:"task_link"`
		}{
			ACMExecution: response,
			TaskLink:     taskLink,
		}

		// Return the result as JSON
		resultBytes, err := json.Marshal(result)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal response: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resultBytes)), nil
	}

	return tool, handler
}

// GetAutonomousCodeMaintenanceTaskExecutionsTool creates a tool for listing executions of autonomous code maintenance tasks
func GetAutonomousCodeMaintenanceTaskExecutionsTool(config *config.McpServerConfig, client *client.ACMService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	tool = mcp.NewTool("get_autonomous_code_maintenance_task_executions",
		mcp.WithDescription("Get executions of an existing autonomous code maintenance task."),
		mcp.WithString("task_id",
			mcp.Required(),
			mcp.Description("The ID of the task to get executions for"),
		),
		mcp.WithNumber("page",
			mcp.Description("Page number for pagination"),
			mcp.DefaultNumber(1),
		),
		mcp.WithNumber("limit",
			mcp.Description("Number of results per page"),
			mcp.DefaultNumber(10),
		),
		commonScopeUtils.WithScope(config, false),
	)

	handler = func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		// Extract required parameters
		taskID, err := commonTools.RequiredParam[string](request, "task_id")
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Extract optional parameters with defaults
		page := 1
		if pageArg, ok := request.GetArguments()["page"].(float64); ok {
			page = int(pageArg)
		}

		limit := 10
		if limitArg, ok := request.GetArguments()["limit"].(float64); ok {
			limit = int(limitArg)
		}

		// Get scope
		scope, err := commonScopeUtils.FetchScope(ctx, config, request, false)
		if err != nil {
			return mcp.NewToolResultError(err.Error()), nil
		}

		// Create the request
		getRequest := &dto.GetACMExecutionsRequest{
			TaskID: taskID,
			Page:   page,
			Limit:  limit,
		}

		// Call the service
		response, err := client.ListTaskExecutions(ctx, scope, getRequest)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to list task executions: %v", err)), nil
		}

		// Return the result as JSON
		resultBytes, err := json.Marshal(response)
		if err != nil {
			return mcp.NewToolResultError(fmt.Sprintf("Failed to marshal response: %v", err)), nil
		}
		return mcp.NewToolResultText(string(resultBytes)), nil
	}

	return tool, handler
}
