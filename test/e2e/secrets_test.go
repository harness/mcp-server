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

// TestListSecretsTools verifies that the list_secrets tool is available
func TestListSecretsTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that secrets tools are available and get their actual names
	var foundSecretsTools = make(map[string]string)
	secretsToolPatterns := []string{
		"list_secrets",
		"get_secret",
	}

	// Print all available tools
	fmt.Println("Available tools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range secretsToolPatterns {
			if tool.Name == pattern {
				foundSecretsTools[pattern] = tool.Name
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found secrets tools:")
	for pattern, actualName := range foundSecretsTools {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	// Check if we found the list_secrets tool
	require.Contains(t, foundSecretsTools, "list_secrets", "expected to find list_secrets tool")
}

// TestListSecrets verifies that the list_secrets tool works correctly with the filter_type parameter
// and then calls get_secret on the first secret found
func TestListSecrets(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Call the list_secrets tool with filter_type parameter
	listRequest := mcp.CallToolRequest{}
	listRequest.Params.Name = "list_secrets"
	listRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"page_index":        0,
		"page_size":         10,
		"filter_type":       "Secret", // Testing the filter_type parameter
	}

	listResponse, err := mcpClient.CallTool(ctx, listRequest)
	require.NoError(t, err, "expected to call 'list_secrets' tool successfully")
	if listResponse.IsError {
		t.Logf("Error response: %v", listResponse.Content)
	}
	require.False(t, listResponse.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, listResponse.Content, "expected content to not be empty")

	// Parse the response to extract secrets
	textContent, ok := listResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var secretsResponse dto.ListSecretsResponse
	err = json.Unmarshal([]byte(textContent.Text), &secretsResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Verify the response structure
	require.Equal(t, "SUCCESS", secretsResponse.Status, "expected status to be SUCCESS")
	t.Logf("Found %d secrets", len(secretsResponse.Data.Content))

	// If we found any secrets, get the first one using get_secret tool
	if len(secretsResponse.Data.Content) > 0 {
		firstSecret := secretsResponse.Data.Content[0]
		secretIdentifier := firstSecret.Secret.Identifier
		t.Logf("Getting details for secret: %s", secretIdentifier)

		// Call the get_secret tool with the identifier of the first secret
		getRequest := mcp.CallToolRequest{}
		getRequest.Params.Name = "get_secret"
		getRequest.Params.Arguments = map[string]any{
			"accountIdentifier": accountID,
			"secret_identifier": secretIdentifier,
		}

		getResponse, err := mcpClient.CallTool(ctx, getRequest)
		require.NoError(t, err, "expected to call 'get_secret' tool successfully")
		require.False(t, getResponse.IsError, "expected get_secret result not to be an error")

		// Verify get_secret response content
		require.NotEmpty(t, getResponse.Content, "expected get_secret content to not be empty")

		// Parse the get_secret response
		getTextContent, ok := getResponse.Content[0].(mcp.TextContent)
		require.True(t, ok, "expected get_secret content to be of type TextContent")

		var getSecretResponse dto.SecretResponse
		err = json.Unmarshal([]byte(getTextContent.Text), &getSecretResponse)
		require.NoError(t, err, "expected to unmarshal get_secret response successfully")

		// Verify the get_secret response structure
		require.Equal(t, "SUCCESS", getSecretResponse.Status, "expected get_secret status to be SUCCESS")
		require.Equal(t, secretIdentifier, getSecretResponse.Data.Secret.Identifier, "expected get_secret to return the requested secret")
		t.Logf("Successfully retrieved secret: %s (Type: %s)", getSecretResponse.Data.Secret.Name, getSecretResponse.Data.Secret.Type)
	} else {
		t.Log("No secrets found, skipping get_secret test")
	}
}
