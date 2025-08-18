//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

func TestListIDPTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t, withToolsets([]string{"pipelines", "idp", "default"}))
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that pipeline tools are available and get their actual names
	var foundIDPTools = make(map[string]string)
	IDPToolPatterns := []string{
		"get_entity",
		"list_entities",
		"get_scorecard",
		"list_scorecards",
		"get_score_summary",
		"get_scores",
		"execute_workflow",
		"generate_idp_workflow",
	}

	// Print all available tools
	fmt.Println("Available tools in TestListIDPTools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range IDPToolPatterns {
			if strings.Contains(strings.ToLower(tool.Name), pattern) {
				foundIDPTools[pattern] = tool.Name
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found IDP tools:")
	for pattern, actualName := range foundIDPTools {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	// Store the found tool names in a global variable for other tests to use
	setToolNames(foundIDPTools)

	// Check if we found at least one pipeline tool
	require.NotEmpty(t, foundIDPTools, "expected to find at least one IDP tool")

	// We've already checked with NotEmpty above
}

func TestCreateWorkflow(t *testing.T) {
	t.Skip("Skipping test for now as it tests a tool which is dependent on an internal service")
	t.Parallel()

	mcpClient := setupMCPClient(t, withToolsets([]string{"pipelines", "idp", "default"}))
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

	// Test generating workflow
	generateIDPWorkflowRequest := mcp.CallToolRequest{}
	generateIDPWorkflowRequest.Params.Name = "generate_idp_workflow"
	generateIDPWorkflowRequest.Params.Arguments = map[string]any{
		"prompt":            "Create a workflow for the given pipeline",
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"pipeline_info":     pipelineID,
	}

	generateIDPWorkflowResponse, err := mcpClient.CallTool(ctx, generateIDPWorkflowRequest)
	if generateIDPWorkflowResponse.IsError {
		t.Logf("Error response: %v", generateIDPWorkflowResponse.Content)
	}
	require.NoError(t, err, "expected to call 'generate_idp_workflow' tool successfully")
	require.False(t, generateIDPWorkflowResponse.IsError, "expected result not to be an error")

	// Verify response content
	t.Logf("Response content: %v\n", generateIDPWorkflowResponse.Content)
	require.NotEmpty(t, generateIDPWorkflowResponse.Content, "expected content to not be empty")
}

func TestExecuteWorkflow(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t, withToolsets([]string{"pipelines", "idp", "default"}))
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_entities tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_entities"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"limit":             10,
		"kind":              "Workflow",
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_entities' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract pipeline IDs for subsequent tests
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var listEntityResponse []*dto.EntityResponse

	err = json.Unmarshal([]byte(textContent.Text), &listEntityResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip further tests if no workflows are found
	if len(listEntityResponse) == 0 {
		t.Log("No workflows found, skipping execution tests")
		return
	}

	// Store the first workflow ID for subsequent tests
	t.Logf("Found %d workflows", len(listEntityResponse))
	workflowId := listEntityResponse[0].Identifier
	workflowYAML := listEntityResponse[0].Yaml
	t.Logf("Using workflow ID: %s", workflowId)

	// Test executing workflow
	executeWorkflowRequest := mcp.CallToolRequest{}
	executeWorkflowRequest.Params.Name = "execute_workflow"
	executeWorkflowRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"workflow_details":  workflowYAML,
		"identifier":        workflowId,
		"values": map[string]any{
			"name": "Test Workflow Execution",
		},
	}

	executeWorkflowResponse, err := mcpClient.CallTool(ctx, executeWorkflowRequest)
	if executeWorkflowResponse.IsError {
		t.Logf("Error response: %v", executeWorkflowResponse.Content)
	}
	require.NoError(t, err, "expected to call 'execute_workflow' tool successfully")
	require.False(t, executeWorkflowResponse.IsError, "expected result not to be an error")

	// Verify response content
	t.Logf("Response content: %v\n", executeWorkflowResponse.Content)
	require.NotEmpty(t, executeWorkflowResponse.Content, "expected content to not be empty")
}
