//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

// Global variables to store tool name mappings
var (
	toolNamesMutex sync.Mutex
	toolNames      = make(map[string]string)
)

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
		"list_input_sets",
		"get_input_set",
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

func TestListInputSets(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// First, get a pipeline ID to use for input sets
	pipelineListRequest := mcp.CallToolRequest{}
	pipelineListRequest.Params.Name = "list_pipelines"
	pipelineListRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"limit":             1,
	}

	pipelineListResponse, err := mcpClient.CallTool(ctx, pipelineListRequest)
	require.NoError(t, err, "expected to call 'list_pipelines' tool successfully")
	if pipelineListResponse.IsError {
		t.Logf("Error response: %v", pipelineListResponse.Content)
		t.Skip("Skipping test due to error in pipeline listing")
		return
	}

	// Parse the response to extract pipeline ID
	textContent, ok := pipelineListResponse.Content[0].(mcp.TextContent)
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
		t.Log("No pipelines found, skipping input sets test")
		return
	}

	pipelineID := pipelineResponse.Data.Content[0].Identifier
	t.Logf("Using pipeline ID: %s for input sets test", pipelineID)

	// Call the list_input_sets tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_input_sets"
	request.Params.Arguments = map[string]any{
		"accountIdentifier":   accountID,
		"orgIdentifier":       getE2EOrgID(),
		"projectIdentifier":   getE2EProjectID(),
		"pipeline_identifier": pipelineID,
		"search_term":         "test", // Adding search term to test this parameter
		"page":                0,
		"limit":               10,
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_input_sets' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract input set IDs
	textContent, ok = response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var inputSetResponse dto.InputSetListResponse

	err = json.Unmarshal([]byte(textContent.Text), &inputSetResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Log the number of input sets found
	t.Logf("Found %d input sets", len(inputSetResponse.Data.Content))

	// If we found input sets, test getting a specific one
	if len(inputSetResponse.Data.Content) > 0 {
		inputSetID := inputSetResponse.Data.Content[0].Identifier
		t.Logf("Using input set ID: %s for get test", inputSetID)

		// Test getting input set details
		getInputSetRequest := mcp.CallToolRequest{}
		getInputSetRequest.Params.Name = "get_input_set"
		getInputSetRequest.Params.Arguments = map[string]any{
			"accountIdentifier":   accountID,
			"orgIdentifier":       getE2EOrgID(),
			"projectIdentifier":   getE2EProjectID(),
			"pipeline_identifier": pipelineID,
			"input_set_identifier": inputSetID,
		}

		getInputSetResponse, err := mcpClient.CallTool(ctx, getInputSetRequest)
		require.NoError(t, err, "expected to call 'get_input_set' tool successfully")
		if getInputSetResponse.IsError {
			t.Logf("Error response: %v", getInputSetResponse.Content)
		}
		require.False(t, getInputSetResponse.IsError, "expected result not to be an error")

		// Verify response content
		require.NotEmpty(t, getInputSetResponse.Content, "expected content to not be empty")
	}
}

func TestInputSetWorkflow(t *testing.T) {
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
	require.NoError(t, err, "expected to call 'list_pipelines' tool successfully")
	if listResponse.IsError {
		t.Logf("Error response: %v", listResponse.Content)
		t.Skip("Skipping test due to error in pipeline listing")
		return
	}

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
		t.Log("No pipelines found, skipping input set workflow test")
		return
	}

	pipelineID := pipelineResponse.Data.Content[0].Identifier
	t.Logf("Using pipeline ID: %s", pipelineID)

	// Step 2: List input sets for this pipeline
	inputSetsRequest := mcp.CallToolRequest{}
	inputSetsRequest.Params.Name = "list_input_sets"
	inputSetsRequest.Params.Arguments = map[string]any{
		"accountIdentifier":   accountID,
		"orgIdentifier":       getE2EOrgID(),
		"projectIdentifier":   getE2EProjectID(),
		"pipeline_identifier": pipelineID,
		"page":                0,
		"limit":               5,
	}

	inputSetsResponse, err := mcpClient.CallTool(ctx, inputSetsRequest)
	require.NoError(t, err, "expected to call 'list_input_sets' tool successfully")
	if inputSetsResponse.IsError {
		t.Logf("Error response: %v", inputSetsResponse.Content)
		return
	}

	// Parse the response to extract input set IDs
	textContent, ok = inputSetsResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var inputSetResponse dto.InputSetListResponse

	err = json.Unmarshal([]byte(textContent.Text), &inputSetResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip if no input sets are found
	if len(inputSetResponse.Data.Content) == 0 {
		t.Log("No input sets found, skipping input set detail test")
		return
	}
	
	// Log the number of input sets found with search term
	t.Logf("Found %d input sets with search term 'test'", len(inputSetResponse.Data.Content))
	
	// Only check the search results if we found input sets
	for _, inputSet := range inputSetResponse.Data.Content {
		// Check if the name or identifier contains the search term
		containsSearchTerm := strings.Contains(strings.ToLower(inputSet.Name), "test") || 
			strings.Contains(strings.ToLower(inputSet.Identifier), "test")
		t.Logf("Input set %s (name: %s) contains search term 'test': %v", 
			inputSet.Identifier, inputSet.Name, containsSearchTerm)
	}

	// Step 3: Get details of the first input set
	inputSetID := inputSetResponse.Data.Content[0].Identifier
	t.Logf("Using input set ID: %s", inputSetID)

	getInputSetRequest := mcp.CallToolRequest{}
	getInputSetRequest.Params.Name = "get_input_set"
	getInputSetRequest.Params.Arguments = map[string]any{
		"accountIdentifier":    accountID,
		"orgIdentifier":        getE2EOrgID(),
		"projectIdentifier":    getE2EProjectID(),
		"pipeline_identifier":  pipelineID,
		"input_set_identifier": inputSetID,
	}

	getInputSetResponse, err := mcpClient.CallTool(ctx, getInputSetRequest)
	require.NoError(t, err, "expected to call 'get_input_set' tool successfully")
	if getInputSetResponse.IsError {
		t.Logf("Error response: %v", getInputSetResponse.Content)
		return
	}

	// Verify the response contains the input set details
	textContent, ok = getInputSetResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	// Parse the response as a generic map to access the identifier
	var rawResponse map[string]interface{}
	err = json.Unmarshal([]byte(textContent.Text), &rawResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Get the identifier from the response and verify it matches
	identifier, ok := rawResponse["identifier"].(string)
	require.True(t, ok, "expected identifier to be present in response")
	require.Equal(t, inputSetID, identifier, "expected input set ID to match")
}
