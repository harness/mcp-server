//go:build e2e

package e2e

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	clientdto "github.com/harness/harness-mcp/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

func TestListConnectorTools(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()

	// List available tools
	request := mcp.ListToolsRequest{}
	response, err := mcpClient.ListTools(ctx, request)
	require.NoError(t, err, "expected to list tools successfully")

	// Find connector-related tools and map actual names
	found := make(map[string]string)
	patterns := []string{
		"list_connectors",
		"get_connector_details",
		"list_connector_catalogue",
	}

	fmt.Println("Available tools in TestListConnectorTools:")
	for _, tool := range response.Tools {
		fmt.Printf("- %s\n", tool.Name)
		for _, pattern := range patterns {
			if strings.Contains(strings.ToLower(tool.Name), pattern) {
				found[pattern] = tool.Name
				break
			}
		}
	}

	fmt.Println("Found connector tools:")
	for pattern, actual := range found {
		fmt.Printf("- %s -> %s\n", pattern, actual)
	}

	require.NotEmpty(t, found, "expected to find at least one connector tool")
}

func TestListConnectorsAndGetDetails(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	// List connectors
	listReq := mcp.CallToolRequest{}
	listReq.Params.Name = getToolName("list_connectors")
	listReq.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
		// Optional filters intentionally omitted for broad listing
	}

	listResp, err := mcpClient.CallTool(ctx, listReq)
	if listResp.IsError {
		t.Logf("Error response: %v", listResp.Content)
	}
	require.NoError(t, err, "expected to call 'list_connectors' tool successfully")
	require.False(t, listResp.IsError, "expected result not to be an error")
	require.NotEmpty(t, listResp.Content, "expected content to not be empty")

	// Unmarshal to client DTO with human-readable times
	textContent, ok := listResp.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var connectors clientdto.ConnectorListDataResponse
	err = json.Unmarshal([]byte(textContent.Text), &connectors)
	require.NoError(t, err, "expected to unmarshal response successfully")

	t.Logf("Found %d connectors (empty=%v, totalElements=%d, totalPages=%d)",
		len(connectors.Content), connectors.Empty, connectors.TotalElements, connectors.TotalPages)

	if len(connectors.Content) == 0 {
		t.Log("No connectors found, skipping get_connector_details test")
		return
	}

	// Take first connector and get details
	connectorID := connectors.Content[0].Connector.Identifier
	t.Logf("Using connector identifier: %s", connectorID)

	getReq := mcp.CallToolRequest{}
	getReq.Params.Name = getToolName("get_connector_details")
	getReq.Params.Arguments = map[string]any{
		"accountIdentifier":    accountID,
		"orgIdentifier":        getE2EOrgID(),
		"projectIdentifier":    getE2EProjectID(),
		"connector_identifier": connectorID,
	}

	getResp, err := mcpClient.CallTool(ctx, getReq)
	if getResp.IsError {
		t.Logf("Error response: %v", getResp.Content)
	}
	require.NoError(t, err, "expected to call 'get_connector_details' tool successfully")
	require.False(t, getResp.IsError, "expected result not to be an error")
	require.NotEmpty(t, getResp.Content, "expected content to not be empty")

	textContent, ok = getResp.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var detail clientdto.ConnectorDetailResponse
	err = json.Unmarshal([]byte(textContent.Text), &detail)
	require.NoError(t, err, "expected to unmarshal connector detail successfully")
	require.Equal(t, connectorID, detail.Connector.Identifier, "connector identifier should match")
}

func TestListConnectorCatalogue(t *testing.T) {
	t.Parallel()

	mcpClient := setupMCPClient(t)
	ctx := context.Background()
	accountID := getE2EAccountID(t)

	req := mcp.CallToolRequest{}
	req.Params.Name = getToolName("list_connector_catalogue")
	req.Params.Arguments = map[string]any{
		"accountIdentifier": accountID,
		"orgIdentifier":     getE2EOrgID(),
		"projectIdentifier": getE2EProjectID(),
	}

	resp, err := mcpClient.CallTool(ctx, req)
	if resp.IsError {
		t.Logf("Error response: %v", resp.Content)
	}
	require.NoError(t, err, "expected to call 'list_connector_catalogue' tool successfully")
	require.False(t, resp.IsError, "expected result not to be an error")
	require.NotEmpty(t, resp.Content, "expected content to not be empty")

	textContent, ok := resp.Content[0].(mcp.TextContent)
	require.True(t, ok, "expected content to be of type TextContent")

	var items []clientdto.ConnectorCatalogueItem
	err = json.Unmarshal([]byte(textContent.Text), &items)
	require.NoError(t, err, "expected to unmarshal catalogue successfully")

	t.Logf("Connector catalogue items: %d", len(items))
}
