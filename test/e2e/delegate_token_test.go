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

// TestListDelegateTokenTools verifies that the list_delegate_tokens tool is available
func TestListDelegateTokenTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that delegate token tools are available
	var foundDelegateTokenTools = make(map[string]string)
	delegateTokenToolPatterns := []string{
		"list_delegate_tokens",
	}

	// Print all available tools
	fmt.Println("Available tools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range delegateTokenToolPatterns {
			if tool.Name == pattern {
				foundDelegateTokenTools[pattern] = tool.Name
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found delegate token tools:")
	for pattern, actualName := range foundDelegateTokenTools {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	// Check if we found the list_delegate_tokens tool
	require.Contains(t, foundDelegateTokenTools, "list_delegate_tokens", "expected to find list_delegate_tokens tool")
}

// TestListDelegateTokens verifies that the list_delegate_tokens tool works correctly with different scopes
func TestListDelegateTokens(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// Test cases for different scopes
	testCases := []struct {
		name  string
		scope string
		args  map[string]any
	}{
		{
			name:  "Account Level",
			scope: "account",
			args: map[string]any{
				"scope": "account",
				"size":  10,
			},
		},
		{
			name:  "Organization Level",
			scope: "org",
			args: map[string]any{
				"scope":  "org",
				"org_id": getE2EOrgID(),
				"size":   10,
			},
		},
		{
			name:  "Project Level",
			scope: "project",
			args: map[string]any{
				"scope":      "project",
				"org_id":     getE2EOrgID(),
				"project_id": getE2EProjectID(),
				"size":       10,
			},
		},
	}

	for _, tc := range testCases {
		tc := tc // capture range variable
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			// Call the list_delegate_tokens tool
			listRequest := mcp.CallToolRequest{}
			listRequest.Params.Name = "list_delegate_tokens"
			listRequest.Params.Arguments = tc.args

			listResponse, err := mcpClient.CallTool(ctx, listRequest)
			require.NoError(t, err, "expected to call 'list_delegate_tokens' tool successfully")
			if listResponse.IsError {
				t.Logf("Error response: %v", listResponse.Content)
			}
			require.False(t, listResponse.IsError, "expected result not to be an error")

			// Verify response content
			require.NotEmpty(t, listResponse.Content, "expected content to not be empty")

			// Parse the response
			textContent, ok := listResponse.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			var response struct {
				Tokens     []dto.DelegateToken `json:"tokens"`
				TotalCount int                 `json:"totalCount"`
				PageSize   int                 `json:"pageSize"`
				PageNumber int                 `json:"pageNumber"`
			}
			err = json.Unmarshal([]byte(textContent.Text), &response)
			require.NoError(t, err, "expected to unmarshal response successfully")

			// Log the results
			t.Logf("Found %d tokens at %s level", len(response.Tokens), tc.scope)
			for _, token := range response.Tokens {
				t.Logf("Token: %s, Status: %s, Owner: %s", token.Name, token.Status, token.OwnerIdentifier)
			}
		})
	}
}

// TestListDelegateTokensWithFilters verifies filtering capabilities
func TestListDelegateTokensWithFilters(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// Test cases for different filters
	testCases := []struct {
		name        string
		args        map[string]any
		description string
	}{
		{
			name: "Active Tokens",
			args: map[string]any{
				"status": "ACTIVE",
				"size":   10,
			},
			description: "List only active tokens",
		},
		{
			name: "Revoked Tokens",
			args: map[string]any{
				"status": "REVOKED",
				"size":   10,
			},
			description: "List only revoked tokens",
		},
		{
			name: "Search By Name",
			args: map[string]any{
				"search_term": "test",
				"size":        10,
			},
			description: "Search tokens by name containing 'test'",
		},
	}

	for _, tc := range testCases {
		tc := tc // capture range variable
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			listRequest := mcp.CallToolRequest{}
			listRequest.Params.Name = "list_delegate_tokens"
			listRequest.Params.Arguments = tc.args

			listResponse, err := mcpClient.CallTool(ctx, listRequest)
			require.NoError(t, err, "expected to call 'list_delegate_tokens' tool successfully")
			require.False(t, listResponse.IsError, "expected result not to be an error")

			// Parse and verify response
			textContent, ok := listResponse.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			var response struct {
				Tokens     []dto.DelegateToken `json:"tokens"`
				TotalCount int                 `json:"totalCount"`
			}
			err = json.Unmarshal([]byte(textContent.Text), &response)
			require.NoError(t, err, "expected to unmarshal response successfully")

			t.Logf("%s: Found %d tokens", tc.description, len(response.Tokens))
		})
	}
}
