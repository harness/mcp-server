//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

// TestGetDelegateByTokenTools verifies that the core_get_delegate_by_token tool is available
func TestGetDelegateByTokenTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that core_get_delegate_by_token tool is available
	var foundTool bool
	fmt.Println("Available delegate token tools:")
	for _, tool := range response.Tools {
		if tool.Name == "core_get_delegate_by_token" {
			foundTool = true
			fmt.Printf("- %s: %s\n", tool.Name, tool.Description)
			break
		}
	}

	require.True(t, foundTool, "expected to find core_get_delegate_by_token tool")
}

// TestGetDelegateByToken verifies that the core_get_delegate_by_token tool works correctly
func TestGetDelegateByToken(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// First create a token to test with
	tokenName := "test_core_get_delegate_by_token_" + uuid.NewString()

	createRequest := mcp.CallToolRequest{}
	createRequest.Params.Name = "create_delegate_token"
	createRequest.Params.Arguments = map[string]interface{}{
		"token_name": tokenName,
	}

	createResponse, err := mcpClient.CallTool(ctx, createRequest)
	require.NoError(t, err, "failed to create test token")
	if createResponse.IsError {
		t.Skipf("Could not create test token: %v", createResponse.Content)
	}

	// Cleanup: revoke and delete the token after test
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
		errContains string
	}{
		{
			name: "Get delegates for existing token",
			args: map[string]interface{}{
				"token_name": tokenName,
			},
			description: "Get delegates using an existing token (should return empty for new token)",
		},
		{
			name: "Get delegates for non-existent token",
			args: map[string]interface{}{
				"token_name": "non_existent_token_" + uuid.NewString(),
			},
			description: "Get delegates using a non-existent token",
			wantErr:     true,
			errContains: "not found",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			getRequest := mcp.CallToolRequest{}
			getRequest.Params.Name = "core_get_delegate_by_token"
			getRequest.Params.Arguments = tc.args

			getResponse, err := mcpClient.CallTool(ctx, getRequest)

			if tc.wantErr {
				// Error could come from either Go error or tool-level error
				if err != nil {
					require.Contains(t, err.Error(), tc.errContains, "error should contain expected message")
					return
				}
				require.True(t, getResponse.IsError, "expected tool-level error")
				require.NotEmpty(t, getResponse.Content, "expected error message in response content")

				textContent, ok := getResponse.Content[0].(mcp.TextContent)
				require.True(t, ok, "expected text content in error response")
				require.Contains(t, textContent.Text, tc.errContains)
				return
			}

			require.NoError(t, err, "client call itself should succeed")

			// For successful calls, verify response format
			require.False(t, getResponse.IsError, "expected result not to be an error")
			require.NotEmpty(t, getResponse.Content, "expected content to not be empty")

			textContent, ok := getResponse.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			// Response could be "No delegates found using this token" or a valid JSON response
			if textContent.Text == "No delegates found using this token" {
				t.Logf("No delegates found for token: %s", tc.args["token_name"])
			} else {
				var response dto.DelegateGroupsResponse
				err = json.Unmarshal([]byte(textContent.Text), &response)
				require.NoError(t, err, "expected to unmarshal response successfully")
				t.Logf("Found %d delegate groups for token: %s", len(response.Resource.DelegateGroupDetails), tc.args["token_name"])
			}
		})
	}
}

// TestGetDelegateByTokenValidation verifies input validation for core_get_delegate_by_token
func TestGetDelegateByTokenValidation(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	testCases := []struct {
		name        string
		args        map[string]interface{}
		description string
		errContains string
	}{
		{
			name:        "Empty token name",
			args:        map[string]interface{}{"token_name": ""},
			description: "Should fail with empty token name",
			errContains: "token_name", // Empty string triggers missing required parameter
		},
		{
			name:        "Whitespace only token name",
			args:        map[string]interface{}{"token_name": "   "},
			description: "Should fail with whitespace-only token name",
			errContains: "token name cannot be empty",
		},
		{
			name:        "Missing token name",
			args:        map[string]interface{}{},
			description: "Should fail with missing token name parameter",
			errContains: "token_name",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			request := mcp.CallToolRequest{}
			request.Params.Name = "core_get_delegate_by_token"
			request.Params.Arguments = tc.args

			response, err := mcpClient.CallTool(ctx, request)
			require.NoError(t, err, "client call itself should succeed, error should be inside tool result")

			require.True(t, response.IsError, "expected tool-level error for: %s", tc.description)
			require.NotEmpty(t, response.Content, "expected error message in response content")

			textContent, ok := response.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected text content in error response")
			require.Contains(t, textContent.Text, tc.errContains, "error message should contain: %s", tc.errContains)
		})
	}
}

// TestGetDelegateByTokenWithScopes verifies core_get_delegate_by_token works with different scopes
func TestGetDelegateByTokenWithScopes(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// Create a token at project level for testing
	tokenName := "test_scope_delegate_token_" + uuid.NewString()

	createRequest := mcp.CallToolRequest{}
	createRequest.Params.Name = "create_delegate_token"
	createRequest.Params.Arguments = map[string]interface{}{
		"token_name": tokenName,
		"org_id":     getE2EOrgID(),
		"project_id": getE2EProjectID(),
	}

	createResponse, err := mcpClient.CallTool(ctx, createRequest)
	require.NoError(t, err, "failed to create test token")
	if createResponse.IsError {
		t.Skipf("Could not create test token: %v", createResponse.Content)
	}

	t.Cleanup(func() {
		revokeRequest := mcp.CallToolRequest{}
		revokeRequest.Params.Name = "revoke_delegate_token"
		revokeRequest.Params.Arguments = map[string]interface{}{
			"token_name": tokenName,
			"org_id":     getE2EOrgID(),
			"project_id": getE2EProjectID(),
		}
		_, _ = mcpClient.CallTool(ctx, revokeRequest)

		deleteRequest := mcp.CallToolRequest{}
		deleteRequest.Params.Name = "delete_delegate_token"
		deleteRequest.Params.Arguments = map[string]interface{}{
			"token_name": tokenName,
			"org_id":     getE2EOrgID(),
			"project_id": getE2EProjectID(),
		}
		_, _ = mcpClient.CallTool(ctx, deleteRequest)
	})

	testCases := []struct {
		name  string
		scope string
		args  map[string]interface{}
	}{
		{
			name:  "Project Level",
			scope: "project",
			args: map[string]interface{}{
				"token_name": tokenName,
				"org_id":     getE2EOrgID(),
				"project_id": getE2EProjectID(),
			},
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			request := mcp.CallToolRequest{}
			request.Params.Name = "core_get_delegate_by_token"
			request.Params.Arguments = tc.args

			response, err := mcpClient.CallTool(ctx, request)
			require.NoError(t, err, "expected to call 'core_get_delegate_by_token' tool successfully")
			require.False(t, response.IsError, "expected result not to be an error")

			textContent, ok := response.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			// New token should have no delegates
			if textContent.Text == "No delegates found using this token" {
				t.Logf("No delegates found at %s level for token: %s", tc.scope, tokenName)
			} else {
				var delegateResponse dto.DelegateGroupsResponse
				err = json.Unmarshal([]byte(textContent.Text), &delegateResponse)
				require.NoError(t, err, "expected to unmarshal response successfully")
				t.Logf("Found %d delegate groups at %s level", len(delegateResponse.Resource.DelegateGroupDetails), tc.scope)
			}
		})
	}
}
