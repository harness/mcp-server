package tool_filtering

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"

	commonConfig "github.com/harness/mcp-server/common"
	commonScopeUtils "github.com/harness/mcp-server/common/pkg/common"
	licenseFactory "github.com/harness/mcp-server/common/pkg/license"
	commonModules "github.com/harness/mcp-server/common/pkg/modules"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	"github.com/harness/mcp-server/pkg/modules"
	"github.com/mark3labs/mcp-go/mcp"
)

type HTTPToolFilteringMiddleware struct {
	Logger         *slog.Logger
	Config         *commonConfig.McpServerConfig
	ModuleRegistry *commonModules.ModuleRegistry
}

func NewHTTPToolFilteringMiddleware(ctx context.Context, logger *slog.Logger, config *commonConfig.McpServerConfig) *HTTPToolFilteringMiddleware {
	if logger == nil {
		logger = slog.Default()
	}

	// Create module registry once for efficient module-to-toolset mappings
	registry := modules.NewModuleRegistry(config, nil)

	return &HTTPToolFilteringMiddleware{
		Logger:         logger.With("component", "http_tool_filtering"),
		Config:         config,
		ModuleRegistry: registry,
	}
}

func (m *HTTPToolFilteringMiddleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		// Check if this is a tools/list request
		if m.isToolsListRequest(r) {
			m.Logger.DebugContext(ctx, "Detected tools/list request, applying license-based filtering")
			m.handleToolsListRequest(w, r, next)
			return
		}

		// Check if this is a tools/call request
		if m.isToolsCallRequest(r) {
			m.Logger.DebugContext(ctx, "Detected tools/call request, validating license")
			m.handleToolsCallRequest(w, r, next)
			return
		}

		// Pass through for other requests
		next.ServeHTTP(w, r)
	})
}

func (m *HTTPToolFilteringMiddleware) isToolsListRequest(r *http.Request) bool {
	if r.Method != "POST" {
		return false
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return false
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	var jsonRPCRequest struct {
		Method string `json:"method"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		return false
	}

	return jsonRPCRequest.Method == "tools/list"
}

func (m *HTTPToolFilteringMiddleware) isToolsCallRequest(r *http.Request) bool {
	if r.Method != "POST" {
		return false
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		return false
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	var jsonRPCRequest struct {
		Method string `json:"method"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		return false
	}

	return jsonRPCRequest.Method == "tools/call"
}

func (m *HTTPToolFilteringMiddleware) handleToolsListRequest(w http.ResponseWriter, r *http.Request, next http.Handler) {
	ctx := r.Context()

	// Extract account ID from scope context (populated by auth middleware)
	scope, _ := commonScopeUtils.GetScopeFromContext(ctx)
	accountID := scope.AccountID

	if accountID == "" {
		m.Logger.WarnContext(ctx, "No account ID in context, returning empty tool list")
		m.writeEmptyToolsList(w)
		return
	}

	// Get licensed modules for the account
	licensedModules, err := m.getLicensedModules(ctx, accountID)
	if err != nil {
		m.Logger.ErrorContext(ctx, "Failed to get licensed modules", "error", err)
		// Fall back to empty list on error
		m.writeEmptyToolsList(w)
		return
	}

	// Convert modules to allowed toolsets
	allowedToolsets := m.computeAllowedToolsets(licensedModules)

	// Capture the response
	recorder := &responseRecorder{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		statusCode:     http.StatusOK,
	}

	next.ServeHTTP(recorder, r)

	// Filter the response
	filteredResponse, err := m.filterToolsListResponse(ctx, recorder.body.Bytes(), allowedToolsets)
	if err != nil {
		m.Logger.ErrorContext(ctx, "Failed to filter tools", "error", err)
		w.WriteHeader(recorder.statusCode)
		w.Write(recorder.body.Bytes())
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(recorder.statusCode)
	w.Write(filteredResponse)
}

func (m *HTTPToolFilteringMiddleware) handleToolsCallRequest(w http.ResponseWriter, r *http.Request, next http.Handler) {
	ctx := r.Context()

	// Extract account ID from scope context
	scope, _ := commonScopeUtils.GetScopeFromContext(ctx)
	accountID := scope.AccountID

	if accountID == "" {
		m.Logger.WarnContext(ctx, "No account ID in context")
		m.writeErrorResponse(w, "Missing account authentication")
		return
	}

	// Extract tool name
	toolName, err := m.extractToolNameFromRequest(r)
	if err != nil {
		m.Logger.ErrorContext(ctx, "Failed to extract tool name", "error", err)
		m.writeErrorResponse(w, "Invalid request")
		return
	}

	// Get licensed modules
	licensedModules, err := m.getLicensedModules(ctx, accountID)
	if err != nil {
		m.Logger.ErrorContext(ctx, "Failed to get licensed modules", "error", err)
		m.writeErrorResponse(w, "License validation failed")
		return
	}

	// Compute allowed toolsets
	allowedToolsets := m.computeAllowedToolsets(licensedModules)

	// Find which toolset this tool belongs to
	toolset := m.findToolGroup(toolName)

	// Check if allowed
	if !m.isToolsetAllowed(toolset, allowedToolsets) {
		m.Logger.WarnContext(ctx, "Tool not authorized", "tool", toolName, "toolset", toolset)
		m.writeAuthorizationErrorResponse(w, toolName, allowedToolsets)
		return
	}

	// Authorized - proceed
	next.ServeHTTP(w, r)
}

func (m *HTTPToolFilteringMiddleware) getLicensedModules(ctx context.Context, accountID string) ([]string, error) {
	factory := licenseFactory.NewClientFactory(m.Config, m.Logger)
	licenseClient, err := licenseFactory.DefaultFactoryProvider.CreateLicenseClient(ctx, factory)
	if err != nil {
		return []string{"CORE", "UNLICENSED"}, err
	}

	accountLicense, rawResp, err := licenseClient.GetAccountLicenses(ctx, accountID)
	if err != nil || rawResp.StatusCode != 200 {
		return []string{"CORE", "UNLICENSED"}, err
	}

	// Parse licensed modules
	var licensedModules []string
	licensedModules = append(licensedModules, "CORE", "UNLICENSED")

	if accountLicense.Data != nil && accountLicense.Data.AllModuleLicenses != nil {
		for moduleType, licenses := range accountLicense.Data.AllModuleLicenses {
			if len(licenses) > 0 && licenses[0].Status == "ACTIVE" {
				if moduleType == "CE" {
					licensedModules = append(licensedModules, "CCM")
				} else {
					licensedModules = append(licensedModules, moduleType)
				}
			}
		}
	}

	m.Logger.InfoContext(ctx, "Licensed modules retrieved", "accountID", accountID, "modules", licensedModules)
	return licensedModules, nil
}

func (m *HTTPToolFilteringMiddleware) computeAllowedToolsets(licensedModules []string) []string {
	// If no licensed modules, only allow "default" toolset (minimal set)
	// This matches the behavior when using API key with no valid licenses
	if len(licensedModules) == 0 {
		return []string{"default"}
	}

	// Convert licensedModules slice to map for faster lookup
	licensedMap := make(map[string]bool)
	for _, module := range licensedModules {
		licensedMap[module] = true
	}

	var allowedToolsets []string

	// Iterate through all modules and collect toolsets from licensed ones
	for _, module := range m.ModuleRegistry.GetAllModules() {
		moduleID := module.ID()

		// Special handling for CCM -> CE license mapping
		licenseKey := moduleID
		if moduleID == "CCM" {
			licenseKey = "CE"
		}

		// Include toolsets if module is default (always allowed) or licensed
		if module.IsDefault() || licensedMap[licenseKey] {
			allowedToolsets = append(allowedToolsets, module.Toolsets()...)
		}
	}

	return allowedToolsets
}

func (m *HTTPToolFilteringMiddleware) filterToolsListResponse(ctx context.Context, responseBody []byte, allowedToolsets []string) ([]byte, error) {
	var jsonRPCResponse struct {
		JSONRPC string `json:"jsonrpc"`
		ID      any    `json:"id"`
		Result  struct {
			Tools      []mcp.Tool `json:"tools"`
			NextCursor *string    `json:"nextCursor,omitempty"`
		} `json:"result"`
		Error any `json:"error,omitempty"`
	}

	if err := json.Unmarshal(responseBody, &jsonRPCResponse); err != nil {
		return nil, fmt.Errorf("failed to parse JSON-RPC response: %w", err)
	}

	if jsonRPCResponse.Error != nil {
		return responseBody, nil
	}

	// Filter tools
	var filteredTools []mcp.Tool
	for _, tool := range jsonRPCResponse.Result.Tools {
		toolset := m.findToolGroup(tool.Name)
		if m.isToolsetAllowed(toolset, allowedToolsets) {
			filteredTools = append(filteredTools, tool)
		}
	}

	// Create filtered response
	filteredResponse := struct {
		JSONRPC string `json:"jsonrpc"`
		ID      any    `json:"id"`
		Result  struct {
			Tools      []mcp.Tool `json:"tools"`
			NextCursor *string    `json:"nextCursor,omitempty"`
		} `json:"result"`
	}{
		JSONRPC: "2.0",
		ID:      jsonRPCResponse.ID,
		Result: struct {
			Tools      []mcp.Tool `json:"tools"`
			NextCursor *string    `json:"nextCursor,omitempty"`
		}{
			Tools:      filteredTools,
			NextCursor: jsonRPCResponse.Result.NextCursor,
		},
	}

	m.Logger.InfoContext(ctx, "Tools filtered", "original", len(jsonRPCResponse.Result.Tools), "filtered", len(filteredTools))

	return json.Marshal(filteredResponse)
}

func (m *HTTPToolFilteringMiddleware) findToolGroup(toolName string) string {
	tracker := toolsets.GetMainToolTracker()
	if toolset, exists := tracker.GetGroupForTool(toolName); exists {
		return toolset
	}
	return ""
}

func (m *HTTPToolFilteringMiddleware) isToolsetAllowed(toolset string, allowedToolsets []string) bool {
	for _, allowed := range allowedToolsets {
		if allowed == toolset {
			return true
		}
	}
	return false
}

func (m *HTTPToolFilteringMiddleware) extractToolNameFromRequest(r *http.Request) (string, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return "", err
	}
	r.Body = io.NopCloser(bytes.NewReader(body))

	var jsonRPCRequest struct {
		Params struct {
			Name string `json:"name"`
		} `json:"params"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		return "", err
	}

	return jsonRPCRequest.Params.Name, nil
}

func (m *HTTPToolFilteringMiddleware) writeEmptyToolsList(w http.ResponseWriter) {
	response := map[string]interface{}{
		"jsonrpc": "2.0",
		"result": map[string]interface{}{
			"tools": []interface{}{},
		},
		"id": nil,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func (m *HTTPToolFilteringMiddleware) writeErrorResponse(w http.ResponseWriter, message string) {
	response := map[string]interface{}{
		"jsonrpc": "2.0",
		"error": map[string]interface{}{
			"code":    -32600,
			"message": message,
		},
		"id": nil,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(response)
}

func (m *HTTPToolFilteringMiddleware) writeAuthorizationErrorResponse(w http.ResponseWriter, toolName string, allowedToolsets []string) {
	message := fmt.Sprintf("Tool '%s' is not available. Allowed toolsets: %v", toolName, allowedToolsets)
	response := map[string]interface{}{
		"jsonrpc": "2.0",
		"error": map[string]interface{}{
			"code":    -32601,
			"message": message,
		},
		"id": nil,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	json.NewEncoder(w).Encode(response)
}

type responseRecorder struct {
	http.ResponseWriter
	body       *bytes.Buffer
	statusCode int
}

func (r *responseRecorder) Write(data []byte) (int, error) {
	return r.body.Write(data)
}

func (r *responseRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
}
