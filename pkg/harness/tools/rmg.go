package tools

import (
	"strings"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// RMDevOpsAgentTool creates a tool for RMG DevOps agent with CREATE_PROCESS action
func RMDevOpsAgentTool(config *config.Config, client *client.GenaiService) (tool mcp.Tool, handler server.ToolHandlerFunc) {
	// Get common parameters
	commonParams := getCommonGenAIParameters()

	// Add tool-specific parameters (removing action since it's hardcoded)
	toolParams := append(commonParams,
		WithScope(config, false),
	)

	tool = mcp.NewTool("ask_rm_devops_agent",
		append([]mcp.ToolOption{mcp.WithDescription("The RMG AI DevOps Agent is an expert in planning and executing requests related to generation/updation of Harness release processes. ALWAYS PASS ORIGINAL PROMPT FROM USER TO THIS.")},
			toolParams...)...,
	)

	handler = createGenAIToolHandler(config, client, func(baseParams *dto.BaseRequestParameters, request mcp.CallToolRequest) (interface{}, error) {
		// Always use CREATE_PROCESS action - no need to extract from parameters
		action := "CREATE_PROCESS"

		// Create the service chat parameters
		return &dto.ServiceChatParameters{
			BaseRequestParameters: *baseParams,
			Action:                dto.RequestAction(strings.ToUpper(action)),
		}, nil
	})

	return tool, handler
}
