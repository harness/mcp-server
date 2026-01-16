package tool_filtering

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	commonConfig "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client/dto"
	commonScopeUtils "github.com/harness/mcp-server/common/pkg/common"
	"github.com/mark3labs/mcp-go/mcp"
)

func TestToolFilteringMiddleware_IsToolsListRequest(t *testing.T) {
	cfg := &commonConfig.McpServerConfig{}
	middleware := NewHTTPToolFilteringMiddleware(context.Background(), nil, cfg)

	tests := []struct {
		name   string
		method string
		body   string
		want   bool
	}{
		{
			name:   "Valid tools/list request",
			method: "POST",
			body:   `{"jsonrpc":"2.0","method":"tools/list","id":1}`,
			want:   true,
		},
		{
			name:   "tools/call request",
			method: "POST",
			body:   `{"jsonrpc":"2.0","method":"tools/call","id":1}`,
			want:   false,
		},
		{
			name:   "GET request",
			method: "GET",
			body:   ``,
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/test", bytes.NewBufferString(tt.body))
			got := middleware.isToolsListRequest(req)
			if got != tt.want {
				t.Errorf("isToolsListRequest() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestToolFilteringMiddleware_HandleToolsListRequest_NoAccountID(t *testing.T) {
	cfg := &commonConfig.McpServerConfig{}
	middleware := NewHTTPToolFilteringMiddleware(context.Background(), nil, cfg)

	req := httptest.NewRequest("POST", "/test", nil)
	w := httptest.NewRecorder()

	middleware.handleToolsListRequest(w, req, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Next handler should not be called")
	}))

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &response)

	result := response["result"].(map[string]interface{})
	tools := result["tools"].([]interface{})

	if len(tools) != 0 {
		t.Errorf("Expected empty tools list, got %d tools", len(tools))
	}
}

func TestToolFilteringMiddleware_FilterToolsListResponse(t *testing.T) {
	cfg := &commonConfig.McpServerConfig{}
	middleware := NewHTTPToolFilteringMiddleware(context.Background(), nil, cfg)

	// Create sample response with multiple tools
	originalResponse := struct {
		JSONRPC string `json:"jsonrpc"`
		ID      int    `json:"id"`
		Result  struct {
			Tools []mcp.Tool `json:"tools"`
		} `json:"result"`
	}{
		JSONRPC: "2.0",
		ID:      1,
		Result: struct {
			Tools []mcp.Tool `json:"tools"`
		}{
			Tools: []mcp.Tool{
				{Name: "list_pipelines"},
				{Name: "get_pipeline"},
				{Name: "list_repositories"},
			},
		},
	}

	responseBody, _ := json.Marshal(originalResponse)
	allowedToolsets := []string{"pipelines"}

	filteredResponse, err := middleware.filterToolsListResponse(context.Background(), responseBody, allowedToolsets)
	if err != nil {
		t.Errorf("filterToolsListResponse() error = %v", err)
	}

	var filtered struct {
		Result struct {
			Tools []mcp.Tool `json:"tools"`
		} `json:"result"`
	}
	json.Unmarshal(filteredResponse, &filtered)

	// Should only include pipeline tools
	if len(filtered.Result.Tools) >= len(originalResponse.Result.Tools) {
		t.Error("Expected filtered tools to be less than original")
	}
}

func TestToolFilteringMiddleware_HandleToolsCallRequest_WithAuth(t *testing.T) {
	cfg := &commonConfig.McpServerConfig{}
	middleware := NewHTTPToolFilteringMiddleware(context.Background(), nil, cfg)

	requestBody := `{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_pipelines"},"id":1}`
	req := httptest.NewRequest("POST", "/test", bytes.NewBufferString(requestBody))

	// Add account ID to context
	ctx := commonScopeUtils.WithScopeContext(req.Context(), dto.Scope{
		AccountID: "test-account",
	})
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	// This will fail license fetch, but should handle gracefully
	middleware.handleToolsCallRequest(w, req, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Should return error due to license fetch failure
	if w.Code == http.StatusOK {
		t.Error("Expected error response due to license fetch failure")
	}
}

func TestToolFilteringMiddleware_ComputeAllowedToolsets(t *testing.T) {
	cfg := &commonConfig.McpServerConfig{}
	middleware := NewHTTPToolFilteringMiddleware(context.Background(), nil, cfg)

	licensedModules := []string{"CD", "CI"}
	allowedToolsets := middleware.computeAllowedToolsets(licensedModules)

	// Should include default module toolsets (CORE) plus licensed modules
	if len(allowedToolsets) < 3 {
		t.Errorf("Expected at least 3 toolsets, got %d: %v", len(allowedToolsets), allowedToolsets)
	}

	// Check that it includes toolsets from CORE (default module)
	// Core module includes pipelines, connectors, etc.
	hasCoreToolset := false
	for _, toolset := range allowedToolsets {
		if toolset == "pipelines" || toolset == "connectors" {
			hasCoreToolset = true
			break
		}
	}

	if !hasCoreToolset {
		t.Errorf("Expected default CORE module toolsets to be included, got: %v", allowedToolsets)
	}

	// Check that it includes toolsets from licensed modules (CD)
	hasCDToolset := false
	for _, toolset := range allowedToolsets {
		if toolset == "environments" || toolset == "services" {
			hasCDToolset = true
			break
		}
	}

	if !hasCDToolset {
		t.Errorf("Expected CD module toolsets to be included, got: %v", allowedToolsets)
	}
}
