//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

func TestListPromptTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t, withToolsets([]string{"prompts", "default"}))
	ctx := context.Background()

	// List available tools to verify prompt tools are registered
	toolsRequest := mcp.ListToolsRequest{}
	toolsResponse, err := mcpClient.ListTools(ctx, toolsRequest)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that prompt tools are available
	var foundListPrompts, foundGetPrompt bool
	var promptToolNames = make(map[string]string)
	promptToolPatterns := []string{
		"list_prompts",
		"get_prompt",
	}

	// Print all available tools
	fmt.Println("Available tools in TestListPromptTools:")
	for _, tool := range toolsResponse.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range promptToolPatterns {
			if strings.Contains(strings.ToLower(tool.Name), pattern) {
				promptToolNames[pattern] = tool.Name
				if pattern == "list_prompts" {
					foundListPrompts = true
				}
				if pattern == "get_prompt" {
					foundGetPrompt = true
				}
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found prompt tools:")
	for pattern, actualName := range promptToolNames {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	require.True(t, foundListPrompts, "expected to find 'list_prompts' tool")
	require.True(t, foundGetPrompt, "expected to find 'get_prompt' tool")
} 

func TestListPromptTool(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t, withToolsets([]string{"prompts", "default"}))
	ctx := context.Background()

	// Call the list_prompts tool
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_prompts"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": getE2EAccountID(t),
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_prompts' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to verify structure
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var listResult struct {
		Prompts []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		} `json:"prompts"`
	}

	err = json.Unmarshal([]byte(textContent.Text), &listResult)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Verify that prompts are returned
	t.Logf("Found %d prompts", len(listResult.Prompts))

	// Store the prompts for the next test
	if len(listResult.Prompts) > 0 {
		t.Logf("Sample prompt: %s - %s", listResult.Prompts[0].Name, listResult.Prompts[0].Description)
	}

	// Basic verification - we should have at least some prompts
	require.NotEmpty(t, listResult.Prompts, "expected to find at least one prompt")
}

func TestGetPromptTool(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t, withToolsets([]string{"prompts", "default"}))
	ctx := context.Background()

	// First, list prompts to get an available prompt name
	listRequest := mcp.CallToolRequest{}
	listRequest.Params.Name = "list_prompts"
	listRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
	}

	listResponse, err := mcpClient.CallTool(ctx, listRequest)
	require.NoError(t, err, "expected to call 'list_prompts' tool successfully")
	if listResponse.IsError {
		t.Logf("Error response: %v", listResponse.Content)
	}
	require.False(t, listResponse.IsError, "expected list result not to be an error")

	// Parse the list response to get a prompt name
	textContent, ok := listResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var listResult struct {
		Prompts []struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		} `json:"prompts"`
	}

	err = json.Unmarshal([]byte(textContent.Text), &listResult)
	require.NoError(t, err, "expected to unmarshal list response successfully")

	// Skip further tests if no prompts are found
	if len(listResult.Prompts) == 0 {
		t.Log("No prompts found, skipping get prompt test")
		return
	}

	// Use the first available prompt
	promptName := listResult.Prompts[0].Name
	t.Logf("Testing get_prompt with prompt: %s", promptName)

	// Test getting the prompt
	getRequest := mcp.CallToolRequest{}
	getRequest.Params.Name = "get_prompt"
	getRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"prompt_name":       promptName,
	}

	getResponse, err := mcpClient.CallTool(ctx, getRequest)
	require.NoError(t, err, "expected to call 'get_prompt' tool successfully")
	if getResponse.IsError {
		t.Logf("Error response: %v", getResponse.Content)
	}
	require.False(t, getResponse.IsError, "expected get result not to be an error")

	// Verify response content
	require.NotEmpty(t, getResponse.Content, "expected content to not be empty")

	// Parse the get response to verify structure
	getTextContent, ok := getResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected get content to be of type TextContent")

	var getResult map[string]interface{}
	err = json.Unmarshal([]byte(getTextContent.Text), &getResult)
	require.NoError(t, err, "expected to unmarshal get response successfully")

	// Verify basic response structure
	require.Contains(t, getResult, "description", "expected prompt to have description")
	require.Contains(t, getResult, "messages", "expected prompt to have messages")

	// Verify messages structure
	messages, ok := getResult["messages"].([]interface{})
	require.True(t, ok, "expected messages to be an array")
	require.NotEmpty(t, messages, "expected prompt to have at least one message")

	t.Logf("Successfully retrieved prompt '%s' with %d messages", promptName, len(messages))

	// Test with mode parameter if applicable
	getModeRequest := mcp.CallToolRequest{}
	getModeRequest.Params.Name = "get_prompt"
	getModeRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"prompt_name":       promptName,
		"mode":              "standard",
	}

	getModeResponse, err := mcpClient.CallTool(ctx, getModeRequest)
	require.NoError(t, err, "expected to call 'get_prompt' tool with mode successfully")
	if getModeResponse.IsError {
		t.Logf("Mode request error response: %v", getModeResponse.Content)
	}
	require.False(t, getModeResponse.IsError, "expected get result with mode not to be an error")

	// Verify mode response content
	require.NotEmpty(t, getModeResponse.Content, "expected mode content to not be empty")

	t.Logf("Successfully retrieved prompt '%s' with mode 'standard'", promptName)
}
