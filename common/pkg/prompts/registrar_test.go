package prompts

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func TestSeiAgenticPromptEmbedded(t *testing.T) {
	// Verify the embedded prompt text is non-empty
	if seiAgenticPromptText == "" {
		t.Fatal("embedded sei_ai_insights_agentic.txt is empty")
	}

	// Verify it contains expected content
	expectedPhrases := []string{
		"AI Engineering Analyst",
		"sei_get_ai_usage_summary",
		"sei_get_ai_raw_metrics",
		"sei_productivity_feature_metrics",
		"Output Format",
		"SUMMARY",
		"KEY INSIGHTS",
		"RECOMMENDATIONS",
	}
	for _, phrase := range expectedPhrases {
		if !strings.Contains(seiAgenticPromptText, phrase) {
			t.Errorf("embedded prompt missing expected phrase: %q", phrase)
		}
	}
}

func TestSeiAgenticPromptRegistration(t *testing.T) {
	// Create a real MCP server
	mcpServer := server.NewMCPServer("test-server", "1.0.0",
		server.WithPromptCapabilities(true),
	)

	// Register prompts (includes the new agentic prompt)
	RegisterPrompts(mcpServer)

	// List prompts and verify sei_ai_insights_agentic is registered
	listReq := mcp.ListPromptsRequest{}
	listReq.Method = "prompts/list"

	result := mcpServer.HandleMessage(
		context.Background(),
		mustJSON(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"method":  "prompts/list",
			"params":  map[string]interface{}{},
		}),
	)

	// Check the result contains our prompt
	jsonResult := mustJSON(result)
	if !strings.Contains(string(jsonResult), "sei_ai_insights_agentic") {
		t.Errorf("sei_ai_insights_agentic not found in prompts list: %s", string(jsonResult))
	}
}

func TestSeiAgenticPromptGetContent(t *testing.T) {
	// Create a real MCP server
	mcpServer := server.NewMCPServer("test-server", "1.0.0",
		server.WithPromptCapabilities(true),
	)

	// Register prompts
	RegisterPrompts(mcpServer)

	// Get the agentic prompt with standard mode
	result := mcpServer.HandleMessage(
		context.Background(),
		mustJSON(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      2,
			"method":  "prompts/get",
			"params": map[string]interface{}{
				"name": "sei_ai_insights_agentic",
				"arguments": map[string]interface{}{
					"mode": "standard",
				},
			},
		}),
	)

	jsonBytes := mustJSON(result)
	resultStr := string(jsonBytes)

	// Verify it's not an error response
	if strings.Contains(resultStr, `"error"`) {
		t.Fatalf("get prompt returned error: %s", resultStr)
	}

	// Verify the response contains the prompt content
	if !strings.Contains(resultStr, "AI Engineering Analyst") {
		t.Errorf("prompt content missing 'AI Engineering Analyst': %s", resultStr[:min(500, len(resultStr))])
	}
	if !strings.Contains(resultStr, "sei_get_ai_usage_summary") {
		t.Errorf("prompt content missing tool reference: %s", resultStr[:min(500, len(resultStr))])
	}
}

func mustJSON(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}
