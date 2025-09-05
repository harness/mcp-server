//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/uuid"
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

func TestCreateDelegateToken(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	testCases := []struct {
		name        string
		args        map[string]interface{}
		description string
		wantErr     bool
	}{
		{
			name: "Create token with invalid name",
			args: map[string]interface{}{
				"token_name": " ",
			},
			description: "Create a token with invalid name",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			createRequest := mcp.CallToolRequest{}
			createRequest.Params.Name = "create_delegate_token"
			createRequest.Params.Arguments = tc.args

			createResponse, err := mcpClient.CallTool(ctx, createRequest)
			// Step 1: RPC should not fail
			require.NoError(t, err, "client call itself should succeed, error should be inside tool result")

			// Step 2: Tool result must indicate error
			require.True(t, createResponse.IsError, "expected tool-level error for invalid token creation")

			// Step 3: Error message should exist
			require.NotEmpty(t, createResponse.Content, "expected error message in response content")

			// Step 4: Safely check the content type
			textContent, ok := createResponse.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected text content in error response")

			// Step 5: Verify actual error message
			require.Contains(t, textContent.Text, "token name cannot be empty string")
		})
	}
}

func TestGetDelegateToken(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// First create a token
	createRequest := mcp.CallToolRequest{}
	tokenName := "test_get_token" + uuid.NewString()
	nonExistentTokenName := "test_get_token" + uuid.NewString()
	createRequest.Params.Name = "create_delegate_token"
	createRequest.Params.Arguments = map[string]interface{}{
		"token_name": tokenName,
	}

	_, err := mcpClient.CallTool(ctx, createRequest)
	require.NoError(t, err, "failed to create test token")

	t.Cleanup(func() {
		revokeRequest := mcp.CallToolRequest{}
		revokeRequest.Params.Name = "revoke_delegate_token"
		revokeRequest.Params.Arguments = map[string]interface{}{
			"token_name": tokenName,
		}
		_, revokeErr := mcpClient.CallTool(ctx, revokeRequest)
		if revokeErr != nil {
			t.Logf("failed to revoke token %s during cleanup: %v", tokenName, revokeErr)
		}

		deleteRequest := mcp.CallToolRequest{}
		deleteRequest.Params.Name = "delete_delegate_token"
		deleteRequest.Params.Arguments = map[string]interface{}{
			"token_name": tokenName,
		}
		_, delErr := mcpClient.CallTool(ctx, deleteRequest)
		if delErr != nil {
			t.Logf("failed to delete token %s during cleanup: %v", tokenName, delErr)
		}
	})

	testCases := []struct {
		name        string
		args        map[string]interface{}
		description string
		wantErr     bool
	}{
		{
			name: "Get existing token",
			args: map[string]interface{}{
				"name": tokenName,
			},
			description: "Get an existing delegate token",
		},
		{
			name: "Get token with status filter",
			args: map[string]interface{}{
				"name":   tokenName,
				"status": "ACTIVE",
			},
			description: "Get a token filtering by status",
		},
		{
			name: "Get non-existent token",
			args: map[string]interface{}{
				"name": nonExistentTokenName,
			},
			description: "Try to get a non-existent token",
			wantErr:     true,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			getRequest := mcp.CallToolRequest{}
			getRequest.Params.Name = "get_delegate_token"
			getRequest.Params.Arguments = tc.args

			getResponse, err := mcpClient.CallTool(ctx, getRequest)
			if tc.wantErr {
				// Step 1: RPC should not fail
				require.NoError(t, err, "client call itself should succeed, error should be inside tool result")

				// Step 2: Tool result must indicate error
				require.True(t, getResponse.IsError, "expected tool-level error for invalid get Token call")

				// Step 3: Error message should exist
				require.NotEmpty(t, getResponse.Content, "expected error message in response content")

				// Step 4: Safely check the content type
				textContent, ok := getResponse.Content[0].(mcp.TextContent)
				require.True(t, ok, "expected text content in error response")

				// Step 5: Verify actual error message
				require.Contains(t, textContent.Text, "delegate token not found")
				return
			}

			require.NoError(t, err, "expected to get token successfully")
			require.False(t, getResponse.IsError, "expected result not to be an error")

			textContent, ok := getResponse.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			var response dto.DelegateTokenResponse
			err = json.Unmarshal([]byte(textContent.Text), &response)

			require.NoError(t, err, "expected to unmarshal response successfully")
			require.Equal(t, tc.args["name"], response.Resource.Name)
			require.Equal(t, "ACTIVE", response.Resource.Status)
		})
	}
}

func TestRevokeDelegateToken(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// Create tokens for revocation tests
	tokenNames := []string{"test_revoke_token1" + uuid.NewString(), "test_revoke_token2" + uuid.NewString()}
	for _, name := range tokenNames {
		createRequest := mcp.CallToolRequest{}
		createRequest.Params.Name = "create_delegate_token"
		createRequest.Params.Arguments = map[string]interface{}{
			"token_name": name,
		}
		_, err := mcpClient.CallTool(ctx, createRequest)
		require.NoError(t, err, "failed to create test token")
	}

	// Cleanup both tokens after test finishes
	t.Cleanup(func() {
		for _, name := range tokenNames {
			revokeRequest := mcp.CallToolRequest{}
			revokeRequest.Params.Name = "revoke_delegate_token"
			revokeRequest.Params.Arguments = map[string]interface{}{
				"token_name": name,
			}
			_, revokeErr := mcpClient.CallTool(ctx, revokeRequest)
			if revokeErr != nil {
				t.Logf("failed to revoke token %s during cleanup: %v", name, revokeErr)
			}

			deleteRequest := mcp.CallToolRequest{}
			deleteRequest.Params.Name = "delete_delegate_token"
			deleteRequest.Params.Arguments = map[string]interface{}{
				"token_name": name,
			}
			_, delErr := mcpClient.CallTool(ctx, deleteRequest)
			if delErr != nil {
				t.Logf("failed to delete token %s during cleanup: %v", name, delErr)
			}
		}
	})

	testCases := []struct {
		name        string
		args        map[string]interface{}
		description string
		wantErr     bool
	}{
		{
			name: "Revoke existing token",
			args: map[string]interface{}{
				"token_name": tokenNames[0],
			},
			description: "Revoke an existing delegate token",
		},
		{
			name: "Revoke non-existent token",
			args: map[string]interface{}{
				"token_name": "non_existent_token",
			},
			description: "Try to revoke a non-existent token",
			wantErr:     true,
		},
		{
			name: "Revoke already revoked token",
			args: map[string]interface{}{
				"token_name": "test_revoke_token1",
			},
			description: "Try to revoke an already revoked token",
			wantErr:     true,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			revokeRequest := mcp.CallToolRequest{}
			revokeRequest.Params.Name = "revoke_delegate_token"
			revokeRequest.Params.Arguments = tc.args

			revokeResponse, err := mcpClient.CallTool(ctx, revokeRequest)
			if tc.wantErr {
				require.Error(t, err, "expected error for invalid token revocation")
				return
			}

			require.NoError(t, err, "expected to revoke token successfully")
			require.False(t, revokeResponse.IsError, "expected result not to be an error")

			// Verify token was revoked by getting it
			getRequest := mcp.CallToolRequest{}
			getRequest.Params.Name = "get_delegate_token"
			getRequest.Params.Arguments = map[string]interface{}{
				"name":   tc.args["token_name"],
				"status": "REVOKED",
			}

			getResponse, err := mcpClient.CallTool(ctx, getRequest)
			require.NoError(t, err, "failed to get token after revocation")

			textContent, ok := getResponse.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			var response dto.DelegateTokenResponse
			err = json.Unmarshal([]byte(textContent.Text), &response)

			require.NoError(t, err, "expected to unmarshal response successfully")
			require.Equal(t, tc.args["token_name"], response.Resource.Name)
			require.Equal(t, "REVOKED", response.Resource.Status)
		})
	}
}
