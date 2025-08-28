//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

// TestListAuditTools verifies that the list_user_audits tool is available
func TestListAuditTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Check that audit tools are available
	var foundAuditTools = make(map[string]string)
	auditToolPatterns := []string{
		"list_user_audits",
	}

	// Print all available tools
	fmt.Println("Available tools in TestListAuditTools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)

		// Check if this tool matches any of our patterns
		for _, pattern := range auditToolPatterns {
			if strings.Contains(strings.ToLower(tool.Name), pattern) {
				foundAuditTools[pattern] = tool.Name
				break
			}
		}
	}

	// Print what we found
	fmt.Println("Found audit tools:")
	for pattern, actualName := range foundAuditTools {
		fmt.Printf("- %s -> %s\n", pattern, actualName)
	}

	// Check if we found the list_user_audits tool
	require.Contains(t, foundAuditTools, "list_user_audits", "expected to find list_user_audits tool")
}

// TestListUserAuditsWithResourceFilter verifies that the list_user_audits tool works correctly with resource filtering
func TestListUserAuditsWithResourceFilter(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Get current time and one week ago for time range
	now := time.Now().UTC()
	oneWeekAgo := now.AddDate(0, 0, -7)

	// Format times in ISO 8601 format
	startTime := oneWeekAgo.Format(time.RFC3339)
	endTime := now.Format(time.RFC3339)

	// Call the list_user_audits tool with resource filter
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_user_audits"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"size":              10,
		"start_time":        startTime,
		"end_time":          endTime,
		"resource_type":     "PIPELINE",
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_user_audits' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract audit events
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var auditResponse dto.AuditOutput[dto.AuditListItem]
	err = json.Unmarshal([]byte(textContent.Text), &auditResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Verify the response structure
	require.Equal(t, "SUCCESS", auditResponse.Status, "expected status to be SUCCESS")
	t.Logf("Found %d audit events", len(auditResponse.Data.Content))

	// Verify that all returned audit events are for the specified resource
	for _, audit := range auditResponse.Data.Content {
		require.Equal(t, "PIPELINE", audit.Resource.Type, "expected resource type to be PIPELINE")
	}
}

// TestListUserAuditsWithoutResourceFilter verifies that the list_user_audits tool works correctly without resource filtering
func TestListUserAuditsWithoutResourceFilter(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// Get current time and one week ago for time range
	now := time.Now().UTC()
	threeWeeksAgo := now.AddDate(0, 0, -21)

	// Format times in ISO 8601 format
	startTime := threeWeeksAgo.Format(time.RFC3339)
	endTime := now.Format(time.RFC3339)

	// Call the list_user_audits tool without resource filter
	request := mcp.CallToolRequest{}
	request.Params.Name = "list_user_audits"
	request.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		"page":              0,
		"size":              10,
		"start_time":        startTime,
		"end_time":          endTime,
	}

	response, err := mcpClient.CallTool(ctx, request)
	require.NoError(t, err, "expected to call 'list_user_audits' tool successfully")
	if response.IsError {
		t.Logf("Error response: %v", response.Content)
	}
	require.False(t, response.IsError, "expected result not to be an error")

	// Verify response content
	require.NotEmpty(t, response.Content, "expected content to not be empty")

	// Parse the response to extract audit events
	textContent, ok := response.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var auditResponse dto.AuditOutput[dto.AuditListItem]
	err = json.Unmarshal([]byte(textContent.Text), &auditResponse)
	require.NoError(t, err, "expected to unmarshal response successfully")

	// Verify the response structure
	require.Equal(t, "SUCCESS", auditResponse.Status, "expected status to be SUCCESS")
	t.Logf("Found %d audit events", len(auditResponse.Data.Content))
}
