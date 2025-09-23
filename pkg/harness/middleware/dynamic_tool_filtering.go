package middleware

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/common"
	licenseFactory "github.com/harness/harness-mcp/pkg/license"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

// Context keys for storing dynamic filtering information
type contextKey string

const (
	allowedToolsetsContextKey  contextKey = "allowed_toolsets"
	accountIDContextKey        contextKey = "account_id"
	requestedModulesContextKey contextKey = "requested_modules"
)

// LicenseStatus represents the status of a module license
type LicenseStatus int

const (
	LicenseActive LicenseStatus = iota
	LicenseExpired
	LicenseInactive
)

// LicenseInfo holds license information for an account
type LicenseInfo struct {
	AccountID      string
	ModuleLicenses map[string]LicenseStatus
	LastUpdated    time.Time
}

// HTTPHeaderExtractor defines interface for extracting modules from HTTP headers
type HTTPHeaderExtractor interface {
	ExtractRequestedModules(headers map[string][]string) ([]string, error)
}

// DefaultHeaderExtractor implements HTTPHeaderExtractor for X-Harness-Modules header
type DefaultHeaderExtractor struct{}

func (e *DefaultHeaderExtractor) ExtractRequestedModules(headers map[string][]string) ([]string, error) {
	// Look for X-Harness-Modules header
	if modules, exists := headers["X-Harness-Modules"]; exists && len(modules) > 0 {
		// Parse comma-separated modules
		var requestedModules []string
		for _, moduleList := range modules {
			parts := strings.Split(moduleList, ",")
			for _, module := range parts {
				module = strings.TrimSpace(module)
				if module != "" {
					requestedModules = append(requestedModules, module)
				}
			}
		}
		return requestedModules, nil
	}

	return []string{}, nil
}

// DynamicToolFilteringConfig holds configuration for the dynamic tool filtering middleware
type DynamicToolFilteringConfig struct {
	HeaderExtractor HTTPHeaderExtractor
	Cache           *ModuleIntersectionCache
	CacheTTL        time.Duration
	Logger          *slog.Logger
	Config          *config.Config // Harness configuration for license client
}

// WithDynamicToolFiltering creates middleware that filters tools based on request-scoped modules
func WithDynamicToolFiltering(config *DynamicToolFilteringConfig) server.ToolHandlerMiddleware {
	// Set defaults
	if config.HeaderExtractor == nil {
		config.HeaderExtractor = &DefaultHeaderExtractor{}
	}
	if config.CacheTTL == 0 {
		config.CacheTTL = 5 * time.Minute
	}
	if config.Cache == nil {
		config.Cache = NewModuleIntersectionCache(config.CacheTTL)
	}

	logger := config.Logger.With("component", "dynamic_tool_filtering_middleware")

	return func(next server.ToolHandlerFunc) server.ToolHandlerFunc {
		return func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			requestLogger := logger.With(
				"operation", "tool_call",
				"tool_name", request.Params.Name,
				"request_id", extractRequestID(ctx))

			requestLogger.Debug("Processing tool call with dynamic filtering")

			// Step 1: Extract account ID from existing context
			accountID := extractAccountIDFromContext(ctx, requestLogger)
			if accountID == "" {
				requestLogger.Debug("No account ID found, proceeding without filtering")
				return next(ctx, request)
			}

			// Step 2: Extract requested modules from HTTP headers (if available)
			requestedModules := extractRequestedModulesFromContext(ctx, requestLogger)
			if len(requestedModules) == 0 {
				requestLogger.Debug("No requested modules found, proceeding without filtering")
				return next(ctx, request)
			}

			// Step 3: Get licensed modules for the account
			licensedModules, err := getLicensedModulesForAccount(ctx, accountID, config.Config, requestLogger)
			if err != nil {
				requestLogger.Error("Failed to get licensed modules, proceeding without filtering", "error", err)
				return next(ctx, request)
			}

			// Step 4: Check cache for previous results
			cacheKey := fmt.Sprintf("%s:%s", accountID, strings.Join(requestedModules, ","))
			if cachedToolsets, found := config.Cache.Get(cacheKey); found {
				requestLogger.Debug("Using cached allowed toolsets", "toolsets", cachedToolsets)
				ctx = context.WithValue(ctx, allowedToolsetsContextKey, cachedToolsets)
			} else {
				// Step 5: Compute allowed toolsets
				allowedToolsets, err := computeAllowedToolsets(requestedModules, licensedModules, requestLogger)

				if err != nil {
					requestLogger.Error("Failed to compute allowed toolsets, proceeding without filtering", "error", err)
					return next(ctx, request)
				}

				// Cache the result
				config.Cache.Set(cacheKey, allowedToolsets)

				// Step 6: Store allowed toolsets in request context
				ctx = context.WithValue(ctx, allowedToolsetsContextKey, allowedToolsets)

				requestLogger.Debug("Computed and cached allowed toolsets", "toolsets", allowedToolsets)
			}

			// Step 7: Check if the requested tool is allowed
			toolset := findToolGroup(request.Params.Name, requestLogger)
			allowedToolsets, _ := GetAllowedToolsetsFromContext(ctx)

			if !IsToolsetAllowed(toolset, allowedToolsets) {
				requestLogger.Warn("Tool not allowed in current context",
					"tool_name", request.Params.Name,
					"toolset", toolset,
					"allowed_toolsets", allowedToolsets)

				return mcp.NewToolResultError(fmt.Sprintf("Tool '%s' is not available in the current context. Allowed toolsets: %v", request.Params.Name, allowedToolsets)), nil
			}

			requestLogger.Debug("Tool allowed, proceeding with execution",
				"tool_name", request.Params.Name,
				"toolset", toolset)

			// Continue to the next handler
			return next(ctx, request)
		}
	}
}

// Helper functions

func extractRequestID(ctx context.Context) string {
	if requestID, ok := ctx.Value("request_id").(string); ok {
		return requestID
	}
	if requestID, ok := ctx.Value("X-Request-ID").(string); ok {
		return requestID
	}
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}

func extractAccountIDFromContext(ctx context.Context, logger *slog.Logger) string {
	// First try to get account ID from our context key (set by HTTP middleware)
	if accountID, ok := ctx.Value(accountIDContextKey).(string); ok && accountID != "" {
		logger.Debug("Account ID extracted from context", "key", "account_id", "account_id", accountID)
		return accountID
	}

	// Fallback to existing scope-based extraction
	scope, _ := common.GetScopeFromContext(ctx)
	if scope.AccountID != "" {
		logger.Debug("Account ID extracted from scope context", "account_id", scope.AccountID)
		return scope.AccountID
	}

	// Try various context keys that might contain account ID
	contextKeys := []string{"account_id", "accountId", "AccountID", "harness_account_id"}
	for _, key := range contextKeys {
		if accountID, ok := ctx.Value(key).(string); ok && accountID != "" {
			logger.Debug("Account ID extracted from context", "key", key, "account_id", accountID)
			return accountID
		}
	}

	logger.Debug("No account ID found in context")
	return ""
}

func extractRequestedModulesFromContext(ctx context.Context, logger *slog.Logger) []string {
	if modules, ok := ctx.Value(requestedModulesContextKey).([]string); ok {
		logger.Debug("Requested modules extracted from context", "modules", modules)
		return modules
	}

	logger.Debug("No requested modules found in context")
	return []string{}
}

func getLicensedModulesForAccount(ctx context.Context, accountID string, config *config.Config, logger *slog.Logger) ([]string, error) {
	// Use the shared license client factory for consistent license client creation
	licenseFactory := licenseFactory.NewClientFactory(config, logger)
	licenseClient, err := licenseFactory.CreateLicenseClient(ctx)
	if err != nil {
		logger.Error("Failed to create license client", "error", err, "account_id", accountID)
		// Fallback to CORE only on license client creation failure
		return []string{"CORE"}, nil
	}

	// Call GetAccountLicenses API
	accountLicense, rawHttpResponse, err := licenseClient.GetAccountLicenses(ctx, accountID)
	if err != nil {
		logger.Error("Failed to get account licenses", "error", err, "account_id", accountID)
		// Fallback to CORE only on API call failure
		return []string{"CORE"}, nil
	}

	// Check response status
	if rawHttpResponse.StatusCode != 200 {
		logger.Error("Unexpected license API response status",
			"status", rawHttpResponse.Status,
			"status_code", rawHttpResponse.StatusCode,
			"account_id", accountID)
		// Fallback to CORE only on non-200 response
		return []string{"CORE"}, nil
	}

	logger.Debug("Successfully retrieved account licenses",
		"status", rawHttpResponse.Status,
		"account_id", accountID,
		"has_data", accountLicense.Data != nil)

	// Process license data
	var licensedModules []string

	// Always include CORE module
	licensedModules = append(licensedModules, "CORE")

	// Process module licenses if available
	if accountLicense.Data != nil && accountLicense.Data.AllModuleLicenses != nil {
		logger.Debug("Processing module licenses",
			"account_id", accountID,
			"module_count", len(accountLicense.Data.AllModuleLicenses))

		// Iterate through all module types in allModuleLicenses
		for moduleType, licenses := range accountLicense.Data.AllModuleLicenses {
			if len(licenses) > 0 {
				// Use the first license to determine status
				license := licenses[0]

				// Check if the module license is ACTIVE
				isValid := license.Status == "ACTIVE"

				logger.Debug("Processing module license",
					"module", moduleType,
					"status", license.Status,
					"is_valid", isValid,
					"account_id", accountID)

				if isValid {
					licensedModules = append(licensedModules, moduleType)
				}
			}
		}
	} else {
		logger.Warn("No module license data found in response", "account_id", accountID)
	}

	logger.Info("Licensed modules retrieved successfully",
		"account_id", accountID,
		"modules", licensedModules,
		"module_count", len(licensedModules))

	return licensedModules, nil
}

func computeAllowedToolsets(requestedModules, licensedModules []string, logger *slog.Logger) ([]string, error) {
	logger.Debug("Computing allowed toolsets",
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

	return allowedToolsets, nil
}

func computeAllowedToolsetsWithMetrics(requestedModules, licensedModules []string, logger *slog.Logger) ([]string, error) {
	start := time.Now()
	defer func() {
		duration := time.Since(start)
		logger.Debug("Toolset computation completed", "duration_ms", duration.Milliseconds())
	}()

	return computeAllowedToolsets(requestedModules, licensedModules, logger)
}

func moduleToToolsets(module string) []string {
	logger := slog.Default().With("component", "moduleToToolsets", "module", module)
	// Get the global registry
	registry := modules.GetGlobalRegistry()

	// If registry is available, use it to get toolsets for the module
	if registry != nil {
		toolsets := registry.GetToolsetsForModule(module)
		logger.Debug("Retrieved toolsets from registry", "toolsets", toolsets)
		return toolsets
	}

	// Fallback mapping when registry is not available (e.g., during tests)
	fallbackMapping := getFallbackModuleToToolsetsMapping(module, logger)
	if len(fallbackMapping) > 0 {
		logger.Debug("Using fallback mapping for module", "module", module, "toolsets", fallbackMapping)
		return fallbackMapping
	}

	logger.Warn("No toolsets found for module in fallback mapping", "module", module)
	return []string{}
}

// GetAllowedToolsetsFromContext retrieves allowed toolsets from context
func GetAllowedToolsetsFromContext(ctx context.Context) ([]string, bool) {
	if toolsets, ok := ctx.Value(allowedToolsetsContextKey).([]string); ok {
		return toolsets, true
	}
	return []string{}, false
}

// IsToolsetAllowed checks if a toolset is in the allowed list
func IsToolsetAllowed(toolset string, allowedToolsets []string) bool {
	for _, allowed := range allowedToolsets {
		if allowed == toolset {
			return true
		}
	}
	return false
}

// ModuleIntersectionCache provides thread-safe caching for module intersection results
type ModuleIntersectionCache struct {
	cache map[string]cacheEntry
	mutex sync.RWMutex
	ttl   time.Duration
}

type cacheEntry struct {
	toolsets  []string
	timestamp time.Time
}

// NewModuleIntersectionCache creates a new cache with the specified TTL
func NewModuleIntersectionCache(ttl time.Duration) *ModuleIntersectionCache {
	return &ModuleIntersectionCache{
		cache: make(map[string]cacheEntry),
		ttl:   ttl,
	}
}

// Get retrieves toolsets from cache if not expired
func (c *ModuleIntersectionCache) Get(key string) ([]string, bool) {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	entry, exists := c.cache[key]
	if !exists {
		return nil, false
	}

	if time.Since(entry.timestamp) > c.ttl {
		return nil, false
	}

	return entry.toolsets, true
}

// Set stores toolsets in cache with current timestamp
func (c *ModuleIntersectionCache) Set(key string, toolsets []string) {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	c.cache[key] = cacheEntry{
		toolsets:  toolsets,
		timestamp: time.Now(),
	}
}

// Clear removes expired entries from cache
func (c *ModuleIntersectionCache) Clear() {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	now := time.Now()
	for key, entry := range c.cache {
		if now.Sub(entry.timestamp) > c.ttl {
			delete(c.cache, key)
		}
	}
}

// getFallbackModuleToToolsetsMapping provides fallback module-to-toolsets mapping
// when the global registry is not available (e.g., during tests)
func getFallbackModuleToToolsetsMapping(module string, logger *slog.Logger) []string {
	// Define the standard module-to-toolsets mapping
	moduleMapping := map[string][]string{
		"CORE": {"pipelines", "connectors", "dashboards", "audit"},
		"CI":   {"ci"},
		"CD":   {"cd"},
		"CCM":  {"ccm"},
		"STO":  {"sto"},
		"FF":   {"ff"},
		"CV":   {"cv"},
		"CE":   {"ce"},
		"SRM":  {"srm"},
		"CHAOS": {"chaos"},
		"SSCA": {"ssca"},
		"IDP":  {"idp"},
	}
	
	if toolsets, exists := moduleMapping[module]; exists {
		logger.Debug("Found fallback mapping for module", "module", module, "toolsets", toolsets)
		return toolsets
	}
	
	logger.Debug("No fallback mapping found for module", "module", module)
	return []string{}
}
