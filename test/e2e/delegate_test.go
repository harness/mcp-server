//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/harness/mcp-server/common/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

// TestListDelegatesToolAvailable verifies that the list_delegates tool is available
func TestListDelegatesToolAvailable(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that list_delegates tool is available
	var foundTool bool
	for _, tool := range response.Tools {
		if tool.Name == "list_delegates" {
			foundTool = true
			t.Logf("Found tool: %s - %s", tool.Name, tool.Description)
			break
		}
	}

	require.True(t, foundTool, "expected to find list_delegates tool")
}

// TestListDelegates verifies that the list_delegates tool works correctly
func TestListDelegates(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	testCases := []struct {
		name           string
		args           map[string]interface{}
		wantErr        bool
		errContains    string
		validateResult func(t *testing.T, resp dto.DelegateListResponse)
	}{
		// Basic functionality tests
		{
			name: "List all delegates at account level",
			args: map[string]interface{}{},
		},
		{
			name: "List delegates with all flag",
			args: map[string]interface{}{
				"all": true,
			},
		},
		// Filter tests
		{
			name: "Filter by CONNECTED status",
			args: map[string]interface{}{
				"status": "CONNECTED",
			},
			validateResult: func(t *testing.T, resp dto.DelegateListResponse) {
				for _, delegate := range resp.Resource {
					require.True(t, delegate.Connected,
						"expected delegate %q to be connected when filtering by CONNECTED status", delegate.Name)
				}
			},
		},
		{
			name: "Filter by DISCONNECTED status",
			args: map[string]interface{}{
				"status": "DISCONNECTED",
			},
			validateResult: func(t *testing.T, resp dto.DelegateListResponse) {
				for _, delegate := range resp.Resource {
					require.False(t, delegate.Connected,
						"expected delegate %q to be disconnected when filtering by DISCONNECTED status", delegate.Name)
				}
			},
		},
		{
			name: "Filter by delegate type KUBERNETES",
			args: map[string]interface{}{
				"delegate_type": "KUBERNETES",
			},
		},
		{
			name: "Filter by delegate type DOCKER",
			args: map[string]interface{}{
				"delegate_type": "DOCKER",
			},
		},
		{
			name: "Multiple filters combined",
			args: map[string]interface{}{
				"status":        "CONNECTED",
				"delegate_type": "KUBERNETES",
			},
			validateResult: func(t *testing.T, resp dto.DelegateListResponse) {
				for _, delegate := range resp.Resource {
					require.True(t, delegate.Connected,
						"expected delegate %q to be connected", delegate.Name)
				}
			},
		},
		// Negative test cases - invalid enum values
		{
			name: "Invalid status enum value",
			args: map[string]interface{}{
				"status": "INVALID_STATUS",
			},
			wantErr:     true,
			errContains: "INVALID_STATUS",
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			request := mcp.CallToolRequest{}
			request.Params.Name = "list_delegates"
			request.Params.Arguments = tc.args

			response, err := mcpClient.CallTool(ctx, request)

			if tc.wantErr {
				if err != nil {
					require.Contains(t, err.Error(), tc.errContains, "error should contain expected message")
					return
				}
				require.True(t, response.IsError, "expected tool-level error")
				require.NotEmpty(t, response.Content, "expected error message in response content")

				textContent, ok := response.Content[0].(mcp.TextContent)
				require.True(t, ok, "expected text content in error response")
				require.Contains(t, textContent.Text, tc.errContains)
				return
			}

			require.NoError(t, err, "client call itself should succeed")
			require.False(t, response.IsError, "expected result not to be an error")
			require.NotEmpty(t, response.Content, "expected content to not be empty")

			textContent, ok := response.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			var delegateResponse dto.DelegateListResponse
			err = json.Unmarshal([]byte(textContent.Text), &delegateResponse)
			require.NoError(t, err, "expected to unmarshal response successfully")

			t.Logf("Found %d delegates", len(delegateResponse.Resource))

			// Run custom validation if provided
			if tc.validateResult != nil {
				tc.validateResult(t, delegateResponse)
			}
		})
	}
}

// TestListDelegatesWithScopes verifies list_delegates works with different scopes
func TestListDelegatesWithScopes(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	testCases := []struct {
		name  string
		scope string
		args  map[string]interface{}
	}{
		{
			name:  "Account Level",
			scope: "account",
			args:  map[string]interface{}{},
		},
		{
			name:  "Org Level",
			scope: "org",
			args: map[string]interface{}{
				"org_id": getE2EOrgID(),
			},
		},
		{
			name:  "Project Level",
			scope: "project",
			args: map[string]interface{}{
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
			request.Params.Name = "list_delegates"
			request.Params.Arguments = tc.args

			response, err := mcpClient.CallTool(ctx, request)
			require.NoError(t, err, "expected to call 'list_delegates' tool successfully")
			require.False(t, response.IsError, "expected result not to be an error")

			textContent, ok := response.Content[0].(mcp.TextContent)
			require.True(t, ok, "expected content to be of type TextContent")

			var delegateResponse dto.DelegateListResponse
			err = json.Unmarshal([]byte(textContent.Text), &delegateResponse)
			require.NoError(t, err, "expected to unmarshal response successfully")

			t.Logf("Found %d delegates at %s level", len(delegateResponse.Resource), tc.scope)
		})
	}
}
