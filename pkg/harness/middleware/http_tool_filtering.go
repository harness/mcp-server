package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	"github.com/mark3labs/mcp-go/mcp"
)

// HTTPToolFilteringMiddleware wraps HTTP handlers to provide dynamic tool filtering
type HTTPToolFilteringMiddleware struct {
	Logger             *slog.Logger
	LicensesApiService *nextgen.LicensesApiService
}

// NewHTTPToolFilteringMiddleware creates a new HTTP tool filtering middleware
func NewHTTPToolFilteringMiddleware(logger *slog.Logger) *HTTPToolFilteringMiddleware {
	if logger == nil {
		logger = slog.Default()
	}

	return &HTTPToolFilteringMiddleware{
		Logger: logger.With("component", "http_tool_filtering_middleware"),
	}
}

// Wrap wraps an HTTP handler to provide dynamic tool filtering for tools/list requests
func (m *HTTPToolFilteringMiddleware) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestLogger := m.Logger.With(
			"method", r.Method,
			"path", r.URL.Path,
			"request_id", extractRequestIDFromHTTPRequest(r))

		requestLogger.Debug("Processing HTTP request")

		// Check if this is a tools/list request
		if m.isToolsListRequest(r, requestLogger) {
			requestLogger.Debug("Detected tools/list request, applying dynamic filtering")
			m.handleToolsListRequest(w, r, next, requestLogger)
			return
		}

		// Check if this is a tools/call request
		if m.isToolsCallRequest(r, requestLogger) {
			requestLogger.Debug("Detected tools/call request, applying authorization validation")
			m.handleToolsCallRequest(w, r, next, requestLogger)
			return
		}

		// For non-tools requests, pass through normally
		requestLogger.Debug("Non-tools request, passing through")
		next.ServeHTTP(w, r)
	})
}

// isToolsListRequest checks if the HTTP request is for tools/list
func (m *HTTPToolFilteringMiddleware) isToolsListRequest(r *http.Request, logger *slog.Logger) bool {
	// For MCP over HTTP, we need to check the request body for the method
	if r.Method != "POST" {
		return false
	}

	// Read the request body to check for tools/list method
	body, err := io.ReadAll(r.Body)
	if err != nil {
		logger.Debug("Failed to read request body", "error", err)
		return false
	}

	// Restore the request body for the next handler
	r.Body = io.NopCloser(bytes.NewReader(body))

	// Parse the JSON-RPC request
	var jsonRPCRequest struct {
		Method string `json:"method"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		logger.Debug("Failed to parse JSON-RPC request", "error", err)
		return false
	}

	isToolsList := jsonRPCRequest.Method == "tools/list"
	logger.Debug("Checked if tools/list request",
		"method", jsonRPCRequest.Method,
		"is_tools_list", isToolsList)

	return isToolsList
}

// handleToolsListRequest handles tools/list requests with dynamic filtering
func (m *HTTPToolFilteringMiddleware) handleToolsListRequest(w http.ResponseWriter, r *http.Request, next http.Handler, logger *slog.Logger) {
	logger.Debug("Handling tools/list request with dynamic filtering")

	// Extract dynamic filtering context from HTTP headers
	ctx := m.enrichContextWithDynamicFiltering(r.Context(), r, logger)

	// Create a new request with the enriched context
	r = r.WithContext(ctx)

	// Create a response recorder to capture the original response
	recorder := &responseRecorder{
		ResponseWriter: w,
		body:           &bytes.Buffer{},
		statusCode:     http.StatusOK,
	}

	// Call the next handler (MCP server)
	next.ServeHTTP(recorder, r)

	// Check if we need to filter the response
	allowedToolsets, hasFiltering := GetAllowedToolsetsFromContext(ctx)
	if !hasFiltering {
		logger.Debug("No dynamic filtering context, returning original response")
		// Write the original response
		w.WriteHeader(recorder.statusCode)
		w.Write(recorder.body.Bytes())
		return
	}

	logger.Debug("Dynamic filtering enabled, processing response",
		"allowed_toolsets", allowedToolsets)

	// Parse and filter the response
	filteredResponse, err := m.filterToolsListResponse(recorder.body.Bytes(), allowedToolsets, logger)
	if err != nil {
		logger.Error("Failed to filter tools/list response", "error", err)
		// Return original response on error
		w.WriteHeader(recorder.statusCode)
		w.Write(recorder.body.Bytes())
		return
	}

	// Write the filtered response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(recorder.statusCode)
	w.Write(filteredResponse)

	logger.Info("Tools/list response filtered successfully",
		"allowed_toolsets", allowedToolsets)
}

// enrichContextWithDynamicFiltering enriches the context with dynamic filtering information
func (m *HTTPToolFilteringMiddleware) enrichContextWithDynamicFiltering(ctx context.Context, r *http.Request, logger *slog.Logger) context.Context {
	logger.Debug("Enriching context with dynamic filtering information")

	// Extract account ID from existing context or headers
	accountID := extractAccountIDFromHTTPRequest(r, logger)
	if accountID == "" {
		logger.Warn("No account ID found in request")
		return ctx
	}

	// Extract requested modules from headers
	requestedModules := extractRequestedModulesFromHTTPHeaders(r, logger)
	if len(requestedModules) == 0 {
		logger.Debug("No requested modules found in headers")
		return ctx
	}

	logger.Debug("Extracted filtering parameters",
		"account_id", accountID,
		"requested_modules", requestedModules)

	// Get licensed modules for the account (placeholder - this should call the actual license validation)
	licensedModules, err := getLicensedModulesForAccount(ctx, accountID, logger)
	if err != nil {
		logger.Error("Failed to get licensed modules", "error", err, "account_id", accountID)
		return ctx
	}

	// Compute allowed toolsets
	allowedToolsets := computeAllowedToolsetsFromModules(requestedModules, licensedModules, logger)

	// Store account ID, requested modules, and computed toolsets in context
	// This allows the tool handler middleware to access all necessary information
	ctx = context.WithValue(ctx, accountIDContextKey, accountID)
	ctx = context.WithValue(ctx, requestedModulesContextKey, requestedModules)
	ctx = context.WithValue(ctx, allowedToolsetsContextKey, allowedToolsets)

	logger.Debug("Context enriched with dynamic filtering",
		"requested_modules", requestedModules,
		"allowed_toolsets", allowedToolsets)

	return ctx
}

// filterToolsListResponse filters the tools/list JSON-RPC response
func (m *HTTPToolFilteringMiddleware) filterToolsListResponse(responseBody []byte, allowedToolsets []string, logger *slog.Logger) ([]byte, error) {
	logger.Debug("Filtering tools/list JSON-RPC response",
		"response_size", len(responseBody),
		"allowed_toolsets", allowedToolsets)

	// Parse the JSON-RPC response
	var jsonRPCResponse struct {
		ID     interface{} `json:"id"`
		Result struct {
			Tools []mcp.Tool `json:"tools"`
		} `json:"result"`
		Error interface{} `json:"error,omitempty"`
	}

	if err := json.Unmarshal(responseBody, &jsonRPCResponse); err != nil {
		return nil, fmt.Errorf("failed to parse JSON-RPC response: %w", err)
	}

	logger.Debug("Parsed JSON-RPC response",
		"total_tools", len(jsonRPCResponse.Result.Tools),
		"has_error", jsonRPCResponse.Error != nil)

	// If there's an error in the response, return as-is
	if jsonRPCResponse.Error != nil {
		logger.Debug("Response contains error, returning as-is")
		return responseBody, nil
	}

	// Filter the tools
	filteredTools := m.filterToolsByToolsets(jsonRPCResponse.Result.Tools, allowedToolsets, logger)

	// Create the filtered response
	filteredResponse := struct {
		ID     interface{} `json:"id"`
		Result struct {
			Tools []mcp.Tool `json:"tools"`
		} `json:"result"`
	}{
		ID: jsonRPCResponse.ID,
		Result: struct {
			Tools []mcp.Tool `json:"tools"`
		}{
			Tools: filteredTools,
		},
	}

	// Marshal the filtered response
	filteredResponseBody, err := json.Marshal(filteredResponse)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal filtered response: %w", err)
	}

	logger.Info("Tools/list response filtered",
		"original_count", len(jsonRPCResponse.Result.Tools),
		"filtered_count", len(filteredTools),
		"allowed_toolsets", allowedToolsets)

	return filteredResponseBody, nil
}

// filterToolsByToolsets filters tools based on allowed toolsets
func (m *HTTPToolFilteringMiddleware) filterToolsByToolsets(tools []mcp.Tool, allowedToolsets []string, logger *slog.Logger) []mcp.Tool {
	if len(allowedToolsets) == 0 {
		logger.Warn("No allowed toolsets, returning empty list")
		return []mcp.Tool{}
	}

	// Create allowed toolsets set
	allowedSet := make(map[string]bool)
	for _, toolset := range allowedToolsets {
		allowedSet[toolset] = true
	}

	var filteredTools []mcp.Tool
	var deniedTools []string

	for _, tool := range tools {
		toolset := determineToolsetForToolName(tool.Name, logger)

		if allowedSet[toolset] {
			filteredTools = append(filteredTools, tool)
			logger.Debug("Tool allowed",
				"tool_name", tool.Name,
				"toolset", toolset)
		} else {
			deniedTools = append(deniedTools, tool.Name)
			logger.Debug("Tool denied",
				"tool_name", tool.Name,
				"toolset", toolset)
		}
	}

	logger.Debug("Tool filtering completed",
		"input_count", len(tools),
		"filtered_count", len(filteredTools),
		"denied_count", len(deniedTools),
		"denied_tools", deniedTools)

	return filteredTools
}

// responseRecorder captures HTTP responses for modification
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

// Helper functions

func extractRequestIDFromHTTPRequest(r *http.Request) string {
	// Try various common request ID headers
	if requestID := r.Header.Get("X-Request-ID"); requestID != "" {
		return requestID
	}

	// Generate a simple request ID if none found
	return fmt.Sprintf("http_req_%d", r.Context().Value("start_time"))
}

func extractAccountIDFromHTTPRequest(r *http.Request, logger *slog.Logger) string {
	// Try to extract account ID from headers
	if accountID := r.Header.Get("X-Harness-Account-ID"); accountID != "" {
		logger.Debug("Account ID extracted from X-Harness-Account-ID header", "account_id", accountID)
		return accountID
	}
	if accountID := r.Header.Get("X-Account-ID"); accountID != "" {
		logger.Debug("Account ID extracted from X-Account-ID header", "account_id", accountID)
		return accountID
	}

	logger.Debug("No account ID found in request headers")
	return ""
}

func extractRequestedModulesFromHTTPHeaders(r *http.Request, logger *slog.Logger) []string {
	// Extract requested modules from X-Harness-Modules header
	modulesHeader := r.Header.Get("X-Harness-Modules")
	if modulesHeader == "" {
		logger.Debug("No X-Harness-Modules header found")
		return []string{}
	}

	// Parse comma-separated modules
	modules := strings.Split(modulesHeader, ",")
	var cleanModules []string
	for _, module := range modules {
		module = strings.TrimSpace(module)
		if module != "" {
			cleanModules = append(cleanModules, module)
		}
	}

	logger.Debug("Extracted requested modules from header",
		"header_value", modulesHeader,
		"parsed_modules", cleanModules)

	return cleanModules
}

// getLicensedModulesForAccount is implemented in dynamic_tool_filtering.go

func computeAllowedToolsetsFromModules(requestedModules, licensedModules []string, logger *slog.Logger) []string {
	logger.Debug("Computing allowed toolsets from modules",
		"requested_modules", requestedModules,
		"licensed_modules", licensedModules)

	// Create licensed modules set
	licensedSet := make(map[string]bool)
	for _, module := range licensedModules {
		licensedSet[module] = true
	}

	// Find intersection of requested and licensed modules
	var allowedModules []string
	for _, module := range requestedModules {
		if licensedSet[module] {
			allowedModules = append(allowedModules, module)
		}
	}

	// Always include CORE
	coreIncluded := false
	for _, module := range allowedModules {
		if module == "CORE" {
			coreIncluded = true
			break
		}
	}
	if !coreIncluded {
		allowedModules = append(allowedModules, "CORE")
	}

	// Convert modules to toolsets
	var allowedToolsets []string
	for _, module := range allowedModules {
		toolsets := moduleToToolsets(module)
		allowedToolsets = append(allowedToolsets, toolsets...)
	}

	logger.Debug("Computed allowed toolsets",
		"allowed_modules", allowedModules,
		"allowed_toolsets", allowedToolsets)

	return allowedToolsets
}

// moduleToToolsets is implemented in dynamic_tool_filtering.go

func determineToolsetForToolName(toolName string, logger *slog.Logger) string {
	// Tool name to toolset mapping (same as in the other file)
	toolToToolsetMap := map[string]string{
		// CORE toolset tools
		"list_pipelines":           "pipelines",
		"get_pipeline":             "pipelines",
		"create_pipeline":          "pipelines",
		"update_pipeline":          "pipelines",
		"delete_pipeline":          "pipelines",
		"execute_pipeline":         "pipelines",
		"list_pipeline_executions": "pipelines",
		"get_pipeline_execution":   "pipelines",
		"stop_pipeline_execution":  "pipelines",
		"retry_pipeline_execution": "pipelines",
		"list_connectors":          "connectors",
		"get_connector_details":    "connectors",
		"list_connector_catalogue": "connectors",
		"create_connector":         "connectors",
		"update_connector":         "connectors",
		"delete_connector":         "connectors",
		"test_connector":           "connectors",
		"list_dashboards":          "dashboards",
		"get_dashboard":            "dashboards",
		"create_dashboard":         "dashboards",
		"update_dashboard":         "dashboards",
		"delete_dashboard":         "dashboards",
		"list_audit_events":        "audit",
		"get_audit_event":          "audit",
		"get_audit_logs":           "audit",
		"search_audit_events":      "audit",

		// CI toolset tools
		"list_builds":          "ci",
		"get_build":            "ci",
		"trigger_build":        "ci",
		"stop_build":           "ci",
		"get_build_logs":       "ci",
		"list_build_artifacts": "ci",

		// CD toolset tools
		"list_deployments":    "cd",
		"get_deployment":      "cd",
		"trigger_deployment":  "cd",
		"rollback_deployment": "cd",
		"list_environments":   "cd",
		"get_environment":     "cd",
		"create_environment":  "cd",
		"update_environment":  "cd",
		"delete_environment":  "cd",

		// Other toolsets...
		"get_cost_overview":     "ccm",
		"get_cost_data":         "ccm",
		"list_cost_categories":  "ccm",
		"get_cost_details":      "ccm",
		"list_recommendations":  "ccm",
		"get_recommendation":    "ccm",
		"list_security_scans":   "sto",
		"get_security_scan":     "sto",
		"trigger_security_scan": "sto",
		"scan_repository":       "sto",
		"list_vulnerabilities":  "sto",
		"get_vulnerability":     "sto",
	}

	// Look up the toolset for this tool
	if toolset, exists := toolToToolsetMap[toolName]; exists {
		return toolset
	}

	// Try to infer from naming patterns
	lowerToolName := strings.ToLower(toolName)
	patterns := map[string]string{
		"pipeline":      "pipelines",
		"connector":     "connectors",
		"dashboard":     "dashboards",
		"audit":         "audit",
		"build":         "ci",
		"ci_":           "ci",
		"deploy":        "cd",
		"cd_":           "cd",
		"environment":   "cd",
		"cost":          "ccm",
		"ccm_":          "ccm",
		"security":      "sto",
		"sto_":          "sto",
		"vulnerability": "sto",
	}

	for pattern, toolset := range patterns {
		if strings.Contains(lowerToolName, pattern) {
			return toolset
		}
	}

	// Default to pipelines toolset for unknown tools (CORE)
	logger.Debug("Unknown tool, defaulting to pipelines toolset", "tool_name", toolName)
	return "pipelines"
}

// isToolsCallRequest checks if the HTTP request is for tools/call
func (m *HTTPToolFilteringMiddleware) isToolsCallRequest(r *http.Request, logger *slog.Logger) bool {
	// For MCP over HTTP, we need to check the request body for the method
	if r.Method != "POST" {
		return false
	}

	// Read the request body to check for tools/call method
	body, err := io.ReadAll(r.Body)
	if err != nil {
		logger.Debug("Failed to read request body", "error", err)
		return false
	}

	// Restore the request body for the next handler
	r.Body = io.NopCloser(bytes.NewReader(body))

	// Parse the JSON-RPC request
	var jsonRPCRequest struct {
		Method string `json:"method"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		logger.Debug("Failed to parse JSON-RPC request", "error", err)
		return false
	}

	isToolsCall := jsonRPCRequest.Method == "tools/call"
	logger.Debug("Checked if tools/call request",
		"method", jsonRPCRequest.Method,
		"is_tools_call", isToolsCall)

	return isToolsCall
}

// handleToolsCallRequest handles tools/call requests with authorization validation
func (m *HTTPToolFilteringMiddleware) handleToolsCallRequest(w http.ResponseWriter, r *http.Request, next http.Handler, logger *slog.Logger) {
	logger.Debug("Handling tools/call request with authorization validation")

	// Extract dynamic filtering context from HTTP headers
	ctx := m.enrichContextWithDynamicFiltering(r.Context(), r, logger)

	// Check if we need to validate tool authorization
	allowedToolsets, hasFiltering := GetAllowedToolsetsFromContext(ctx)
	if !hasFiltering {
		logger.Debug("No dynamic filtering context, allowing tool call")
		// Create a new request with the enriched context and pass through
		r = r.WithContext(ctx)
		next.ServeHTTP(w, r)
		return
	}

	logger.Debug("Dynamic filtering enabled, validating tool authorization",
		"allowed_toolsets", allowedToolsets)

	// Extract tool name from request body
	toolName, err := m.extractToolNameFromRequest(r, logger)
	if err != nil {
		logger.Error("Failed to extract tool name from request", "error", err)
		// Return error response
		m.writeErrorResponse(w, "Invalid request: could not extract tool name", logger)
		return
	}

	logger.Debug("Extracted tool name from request", "tool_name", toolName)

	// Determine which toolset this tool belongs to
	toolset := determineToolsetForToolName(toolName, logger)

	// Check if the toolset is allowed
	if !m.isToolsetAllowed(toolset, allowedToolsets) {
		logger.Warn("Tool not authorized for current context",
			"tool_name", toolName,
			"toolset", toolset,
			"allowed_toolsets", allowedToolsets)

		// Return authorization error
		m.writeAuthorizationErrorResponse(w, toolName, allowedToolsets, logger)
		return
	}

	logger.Debug("Tool authorized, proceeding with execution",
		"tool_name", toolName,
		"toolset", toolset)

	// Create a new request with the enriched context
	r = r.WithContext(ctx)

	// Call the next handler (MCP server)
	next.ServeHTTP(w, r)

	logger.Info("Tool call completed successfully",
		"tool_name", toolName,
		"toolset", toolset,
		"allowed_toolsets", allowedToolsets)
}

// extractToolNameFromRequest extracts the tool name from a tools/call JSON-RPC request
func (m *HTTPToolFilteringMiddleware) extractToolNameFromRequest(r *http.Request, logger *slog.Logger) (string, error) {
	// Read the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read request body: %w", err)
	}

	// Restore the request body for the next handler
	r.Body = io.NopCloser(bytes.NewReader(body))

	// Parse the JSON-RPC request
	var jsonRPCRequest struct {
		Params struct {
			Name string `json:"name"`
		} `json:"params"`
	}

	if err := json.Unmarshal(body, &jsonRPCRequest); err != nil {
		return "", fmt.Errorf("failed to parse JSON-RPC request: %w", err)
	}

	if jsonRPCRequest.Params.Name == "" {
		return "", fmt.Errorf("tool name not found in request")
	}

	logger.Debug("Extracted tool name from JSON-RPC request",
		"tool_name", jsonRPCRequest.Params.Name)

	return jsonRPCRequest.Params.Name, nil
}

// isToolsetAllowed checks if a toolset is in the allowed list
func (m *HTTPToolFilteringMiddleware) isToolsetAllowed(toolset string, allowedToolsets []string) bool {
	for _, allowed := range allowedToolsets {
		if allowed == toolset {
			return true
		}
	}
	return false
}

// writeErrorResponse writes a JSON-RPC error response
func (m *HTTPToolFilteringMiddleware) writeErrorResponse(w http.ResponseWriter, message string, logger *slog.Logger) {
	errorResponse := map[string]interface{}{
		"jsonrpc": "2.0",
		"error": map[string]interface{}{
			"code":    -32600,
			"message": message,
		},
		"id": nil,
	}

	responseBody, err := json.Marshal(errorResponse)
	if err != nil {
		logger.Error("Failed to marshal error response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	w.Write(responseBody)

	logger.Debug("Wrote error response", "message", message)
}

// writeAuthorizationErrorResponse writes a JSON-RPC authorization error response
func (m *HTTPToolFilteringMiddleware) writeAuthorizationErrorResponse(w http.ResponseWriter, toolName string, allowedToolsets []string, logger *slog.Logger) {
	message := fmt.Sprintf("Tool '%s' is not available in the current context. Allowed toolsets: %v", toolName, allowedToolsets)

	errorResponse := map[string]interface{}{
		"jsonrpc": "2.0",
		"error": map[string]interface{}{
			"code":    -32601, // Method not found
			"message": message,
		},
		"id": nil,
	}

	responseBody, err := json.Marshal(errorResponse)
	if err != nil {
		logger.Error("Failed to marshal authorization error response", "error", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	w.Write(responseBody)

	logger.Info("Tool call denied - authorization failed",
		"tool_name", toolName,
		"allowed_toolsets", allowedToolsets,
		"message", message)
}
