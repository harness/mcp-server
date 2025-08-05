//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/harness/harness-mcp/client/dto"
	"strings"
	"sync"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

// Global variables to store tool name mappings
var (
	toolNamesMutex sync.Mutex
	toolNames      = make(map[string]string)
)

// setToolNames updates the global tool name mapping
func setToolNames(names map[string]string) {
	toolNamesMutex.Lock()
	defer toolNamesMutex.Unlock()

	for k, v := range names {
		toolNames[k] = v
	}
}

// getToolName returns the actual tool name for a given pattern
func getToolName(pattern string) string {
	toolNamesMutex.Lock()
	defer toolNamesMutex.Unlock()

	if name, ok := toolNames[pattern]; ok {
		return name
	}
	return pattern // Fall back to the pattern if no mapping exists
}

func TestListPipelineTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that pipeline tools are available and get their actual names
	var foundPipelineTools = make(map[string]string)
	pipelineToolPatterns := []string{
		"list_pipelines",
		"get_pipeline",
		"list_executions",
		"get_execution",
		"fetch_execution_url",
	}

	// Print all available tools
	fmt.Println("Available tools in TestListPipelineTools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range pipelineToolPatterns {
			if strings.Contains(strings.ToLower(tool.Name), pattern) {
				foundPipelineTools[pattern] = tool.Name
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found pipeline tools:")
	for pattern, actualName := range foundPipelineTools {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	// Store the found tool names in a global variable for other tests to use
	setToolNames(foundPipelineTools)

	// Check if we found at least one pipeline tool
	require.NotEmpty(t, foundPipelineTools, "expected to find at least one pipeline tool")

	// We've already checked with NotEmpty above
}

func TestListPipelines(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_pipelines tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_pipelines"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"limit":             10,
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_pipelines' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract pipeline IDs for subsequent tests
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var pipelineResponse struct {
		Data struct {
			Content []struct {
				Identifier string `json:"identifier"`
				Name       string `json:"name"`
			} `json:"content"`
		} `json:"data"`
	}

	err = json.Unmarshal([]byte(textContent.Text), &pipelineResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip further tests if no pipelines are found
	if len(pipelineResponse.Data.Content) == 0 {
		t.Log("No pipelines found, skipping pipeline detail tests")
		return
	}

	// Store the first pipeline ID for subsequent tests
	t.Logf("Found %d pipelines", len(pipelineResponse.Data.Content))
	pipelineID := pipelineResponse.Data.Content[0].Identifier
	t.Logf("Using pipeline ID: %s", pipelineID)

	// Test getting pipeline details
	getPipelineRequest := mcp.CallToolRequest{}
	getPipelineRequest.Params.Name = "get_pipeline"
	getPipelineRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"pipeline_id":       pipelineID,
	}

	getPipelineResponse, err := mcpClient.CallTool(ctx, getPipelineRequest)
	if getPipelineResponse.IsError {
		t.Logf("Error response: %v", getPipelineResponse.Content)
	}
	require.NoError(t, err, "expected to call 'list_pipelines' tool successfully")
	require.False(t, getPipelineResponse.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, getPipelineResponse.Content, "expected content to not be empty")
}

func TestListExecutions(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_executions tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_executions"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"limit":             10,
	}

	response, err := mcpClient.CallTool(ctx, request)
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.NoError(t, err, "expected to call 'list_executions' tool successfully")
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract execution IDs for subsequent tests
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var executionResponse dto.ListOutput[dto.PipelineExecution]

	err = json.Unmarshal([]byte(textContent.Text), &executionResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip further tests if no executions are found
	if len(executionResponse.Data.Content) == 0 {
		t.Log("No executions found, skipping execution detail tests")
		return
	}

	// Store the first execution ID for subsequent tests
	t.Logf("Found %d executions", len(executionResponse.Data.Content))
	executionID := executionResponse.Data.Content[0].PlanExecutionId
	t.Logf("Using execution ID: %s", executionID)

	// Test getting execution details
	getExecutionRequest := mcp.CallToolRequest{}
	getExecutionRequest.Params.Name = "get_execution"
	getExecutionRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"plan_execution_id": executionID,
	}

	getExecutionResponse, err := mcpClient.CallTool(ctx, getExecutionRequest)
	if getExecutionResponse.IsError {
		t.Logf("Error response: %v", getExecutionResponse.Content)
	}
	require.NoError(t, err, "expected to call 'get_execution' tool successfully")
	require.False(t, getExecutionResponse.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, getExecutionResponse.Content, "expected content to not be empty")
}

func TestPipelineWorkflow(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Step 1: List pipelines
	listRequest := mcp.CallToolRequest{}
	listRequest.Params.Name = "list_pipelines"
	listRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"limit":             1,
	}

	listResponse, err := mcpClient.CallTool(ctx, listRequest)
	if listResponse.IsError {
		t.Logf("Error response: %v", listResponse.Content)
	}
	require.NoError(t, err, "expected to call 'list_pipelines' tool successfully")
	require.False(t, listResponse.IsError, "expected result not to be an error")

	// Parse the response to extract pipeline ID
	textContent, ok := listResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var pipelineResponse struct {
		Data struct {
			Content []struct {
				Identifier string `json:"identifier"`
				Name       string `json:"name"`
			} `json:"content"`
		} `json:"data"`
	}

	err = json.Unmarshal([]byte(textContent.Text), &pipelineResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip if no pipelines are found
	if len(pipelineResponse.Data.Content) == 0 {
		t.Log("No pipelines found, skipping pipeline workflow test")
		return
	}

	pipelineID := pipelineResponse.Data.Content[0].Identifier

	// Step 2: List executions for this pipeline
	executionsRequest := mcp.CallToolRequest{}
	executionsRequest.Params.Name = "list_executions"
	executionsRequest.Params.Arguments = map[string]any{
		"accountIdentifier":   accountID,
		"orgIdentifier":       getE2EOrgID(),
		"projectIdentifier":   getE2EProjectID(),
		"pipeline_identifier": pipelineID,
		"page":                0,
		"limit":               5,
	}

	executionsResponse, err := mcpClient.CallTool(ctx, executionsRequest)
	if executionsResponse.IsError {
		t.Logf("Error response: %v", executionsResponse.Content)
	}
	require.NoError(t, err, "expected to call 'list_executions' tool successfully")
	require.False(t, executionsResponse.IsError, "expected result not to be an error")
}
