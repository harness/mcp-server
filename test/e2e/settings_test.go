//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/harness/harness-mcp/client/dto"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

func TestListSettingsTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that settings tools are available and get their actual names
	var foundSettingsTools = make(map[string]string)
	settingsToolPatterns := []string{
		"list_settings",
	}

	// Print all available tools
	fmt.Println("Available tools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range settingsToolPatterns {
			if tool.Name == pattern {
				foundSettingsTools[pattern] = tool.Name
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found settings tools:")
	for pattern, actualName := range foundSettingsTools {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	// Check if we found the list_settings tool
	require.Contains(t, foundSettingsTools, "list_settings", "expected to find list_settings tool")
}

func TestListSettings(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_settings tool without filters
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_settings"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"page":              0,
		"limit":             10,
		"category":          "CORE",
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_settings' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract settings
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var settingsResponse dto.SettingsResponse
	err = json.Unmarshal([]byte(textContent.Text), &settingsResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Verify the response structure
	require.Equal(t, "SUCCESS", settingsResponse.Status, "expected status to be SUCCESS")
	t.Logf("Found %d settings", len(settingsResponse.Data))

}
