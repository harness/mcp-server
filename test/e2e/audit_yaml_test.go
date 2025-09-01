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

// TestGetAuditYamlTool verifies that the get_audit_yaml tool is available
func TestGetAuditYamlTool(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that audit yaml tool is available
	var foundAuditYamlTool bool

	// Print all available tools
	fmt.Println("Available tools in TestGetAuditYamlTool:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this is our get_audit_yaml tool
		if tool.Name == "get_audit_yaml" {
			foundAuditYamlTool = true
		}
	}

	// Check if we found the get_audit_yaml tool
	require.True(t, foundAuditYamlTool, "expected to find get_audit_yaml tool")
}

// TestGetAuditYaml verifies that the get_audit_yaml tool works correctly
func TestGetAuditYaml(t *testing.T) {
	t.Skip("Skipping TestGetAuditYaml as it requires specific audit events with YAML content")
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// First, get an audit ID by listing audit events
	listRequest := mcp.CallToolRequest{}
	listRequest.Params.Name = "list_user_audits"
	listRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"size":              1,
		"resource_type":     "PIPELINE", // Filter for pipeline events which are likely to have YAML
	}

	listResponse, err := mcpClient.CallTool(ctx, listRequest)
	require.NoError(t, err, "expected to call 'list_user_audits' tool successfully")
	if listResponse.IsError {
		t.Logf("Error response: %v", listResponse.Content)
		t.Log("list_user_audits tool returned an error")
		t.FailNow()
	}

	// Parse the response to extract audit events
	if len(listResponse.Content) == 0 {
		t.Skip("No content returned from list_user_audits")
	}

	textContent, ok := listResponse.Content[0].(mcp.TextContent)
	if !ok {
		t.Skip("Content is not of type TextContent")
	}

	var auditResponse dto.AuditOutput[dto.AuditListItem]
	err = json.Unmarshal([]byte(textContent.Text), &auditResponse)
	if err != nil {
		t.Logf("Failed to unmarshal response: %v", err)
		t.Skip("Could not unmarshal audit response")
	}

	// Skip test if no audit events found
	if len(auditResponse.Data.Content) == 0 {
		t.Skip("No audit events found to test get_audit_yaml")
	}

	// Get the first audit ID
	auditID := auditResponse.Data.Content[0].AuditID
	if auditID == "" {
		t.Skip("Audit ID is empty")
	}
	t.Logf("Using audit ID: %s", auditID)

	// Now call the get_audit_yaml tool with this audit ID
	yamlRequest := mcp.CallToolRequest{}
	yamlRequest.Params.Name = "get_audit_yaml"
	yamlRequest.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"audit_id":          auditID,
	}

	yamlResponse, err := mcpClient.CallTool(ctx, yamlRequest)
	require.NoError(t, err, "expected to call 'get_audit_yaml' tool successfully")

	// Note: Some audit events might not have YAML content, so we don't strictly require success
	if yamlResponse.IsError {
		t.Logf("Error response from get_audit_yaml: %v", yamlResponse.Content)
		t.Skip("Skipping YAML content verification as the audit event might not have YAML content")
	}

	// If we got a successful response, verify the structure
	require.NotEmpty(t, yamlResponse.Content, "expected content to not be empty")

	// Parse the response to extract YAML content
	yamlTextContent, ok := yamlResponse.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var auditYamlResponse dto.AuditYamlResponse
	err = json.Unmarshal([]byte(yamlTextContent.Text), &auditYamlResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Verify the response structure
	require.Equal(t, "SUCCESS", auditYamlResponse.Status, "expected status to be SUCCESS")

	// Log the YAML content lengths for debugging
	oldYamlLen := len(auditYamlResponse.Data.OldYaml)
	newYamlLen := len(auditYamlResponse.Data.NewYaml)
	t.Logf("Old YAML length: %d, New YAML length: %d", oldYamlLen, newYamlLen)

	// At least one of the YAMLs should be non-empty
	require.True(t, oldYamlLen > 0 || newYamlLen > 0,
		"expected at least one of old or new YAML to be non-empty")
}
