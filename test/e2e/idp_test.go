//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

func TestListIDPTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
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

	// Check if we found at least one pipeline tool
	require.NotEmpty(t, foundIDPTools, "expected to find at least one IDP tool")

	// We've already checked with NotEmpty above
}

func TestCreateWorkflow(t *testing.T) {
	t.Skip("Skipping test for now as it tests a tool which is dependent on an internal service")
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

	mcpClient := setupMCPClient(t)
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

func TestScorecardTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_entities tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_scorecards"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_scorecards' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var listScorecardsResponse []*dto.ScorecardResponse

	err = json.Unmarshal([]byte(textContent.Text), &listScorecardsResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip further tests if no scorecards are found
	if len(listScorecardsResponse) == 0 {
		t.Log("No scorecards found, skipping get test")
		return
	}

	// Store the first scorecard ID for subsequent tests
	t.Logf("Found %d scorecards", len(listScorecardsResponse))
	scorecardId := ""

	for _, scorecard := range listScorecardsResponse {
		if scorecard.Scorecard.Identifier != "" {
			scorecardId = scorecard.Scorecard.Identifier
			break
		}
	}
	if scorecardId == "" {
		t.Log("No valid scorecards found, skipping get test")
		return
	}
	t.Logf("Using scorecard ID: %s", scorecardId)

	// Test get scorecard details
	getScorecardDetailsRequest := mcp.CallToolRequest{}
	getScorecardDetailsRequest.Params.Name = "get_scorecard"
	getScorecardDetailsRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"scorecard_id":      scorecardId,
	}

	getScorecardDetailsResponse, err := mcpClient.CallTool(ctx, getScorecardDetailsRequest)
	if getScorecardDetailsResponse.IsError {
		t.Logf("Error response: %v", getScorecardDetailsResponse.Content)
	}
	require.NoError(t, err, "expected to call 'get_scorecard' tool successfully")
	require.False(t, getScorecardDetailsResponse.IsError, "expected result not to be an error")
	// Verify response content
	t.Logf("Scorecard Details Response content: %v\n", getScorecardDetailsResponse.Content)
	require.NotEmpty(t, getScorecardDetailsResponse.Content, "expected content to not be empty")

	// Test get scorecard stats
	getScorecardStatsRequest := mcp.CallToolRequest{}
	getScorecardStatsRequest.Params.Name = "get_scorecard_stats"
	getScorecardStatsRequest.Params.Arguments = map[string]any{
		"accountIdentifier":    accountID,
		"orgIdentifier":        getE2EOrgID(),
		"projectIdentifier":    getE2EProjectID(),
		"scorecard_identifier": scorecardId,
	}

	getScorecardStatsResponse, err := mcpClient.CallTool(ctx, getScorecardStatsRequest)
	if getScorecardStatsResponse == nil {
		err = errors.New("nil response")
		t.Logf("Nil scorecard stats response")
	} else if getScorecardStatsResponse.IsError {
		t.Logf("Error response: %v", getScorecardStatsResponse.Content)
	}
	require.NoError(t, err, "expected to call 'get_scorecard_stats' tool successfully")
	require.NotNil(t, getScorecardStatsResponse, "expected response not to be nil")
	require.False(t, getScorecardStatsResponse.IsError, "expected result not to be an error")
	// Verify response content
	t.Logf("Scorecard Stats Response content: %v\n", getScorecardStatsResponse.Content)
	require.NotEmpty(t, getScorecardStatsResponse.Content, "expected content to not be empty")
}

func TestScorecardCheckTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_entities tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_scorecard_checks"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_scorecard_checks' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var listChecksResponse dto.CheckResponseList

	err = json.Unmarshal([]byte(textContent.Text), &listChecksResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Skip further tests if no scorecards are found
	if len(listChecksResponse) == 0 {
		t.Log("No scorecards found, skipping get test")
		return
	}

	// Store the first scorecard ID for subsequent tests
	t.Logf("Found %d checks", len(listChecksResponse))
	checkId := ""
	isCustom := false

	for _, check := range listChecksResponse {
		if check.Check.Identifier != "" {
			checkId = check.Check.Identifier
			isCustom = check.Check.Custom
			break
		}
	}
	if checkId == "" {
		t.Log("No valid scorecards found, skipping get test")
		return
	}
	t.Logf("Using check ID: %s", checkId)

	// Test get check details
	getCheckDetailsRequest := mcp.CallToolRequest{}
	getCheckDetailsRequest.Params.Name = "get_scorecard_check"
	getCheckDetailsRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"check_id":          checkId,
		"is_custom":         isCustom,
	}

	getCheckDetailsResponse, err := mcpClient.CallTool(ctx, getCheckDetailsRequest)
	if getCheckDetailsResponse == nil {
		err = errors.New("nil response")
		t.Logf("Nil check details response")
	} else if getCheckDetailsResponse.IsError {
		t.Logf("Error response: %v", getCheckDetailsResponse.Content)
	}
	require.NoError(t, err, "expected to call 'get_scorecard_check' tool successfully")
	require.False(t, getCheckDetailsResponse.IsError, "expected result not to be an error")
	// Verify response content
	t.Logf("Check Details Response content: %v\n", getCheckDetailsResponse.Content)
	require.NotEmpty(t, getCheckDetailsResponse.Content, "expected content to not be empty")

	// Test get check stats
	getCheckStatsRequest := mcp.CallToolRequest{}
	getCheckStatsRequest.Params.Name = "get_scorecard_check_stats"
	getCheckStatsRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"check_identifier":  checkId,
		"is_custom":         isCustom,
	}

	getCheckStatsResponse, err := mcpClient.CallTool(ctx, getCheckStatsRequest)
	if getCheckStatsResponse == nil {
		err = errors.New("nil response")
		t.Logf("Nil check stats response")
	} else if getCheckStatsResponse.IsError {
		t.Logf("Error response: %v", getCheckStatsResponse.Content)
	}
	require.NoError(t, err, "expected to call 'get_scorecard_check_stats' tool successfully")
	require.NotNil(t, getCheckStatsResponse, "expected response not to be nil")
	require.False(t, getCheckStatsResponse.IsError, "expected result not to be an error")
	// Verify response content
	t.Logf("Check Stats Response content: %v\n", getCheckStatsResponse.Content)
	require.NotEmpty(t, getCheckStatsResponse.Content, "expected content to not be empty")
}
