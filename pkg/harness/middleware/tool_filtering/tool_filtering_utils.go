package tool_filtering

import (
	"context"
	"time"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	license "github.com/harness/harness-mcp/pkg/license"
	"github.com/harness/harness-mcp/pkg/modules"
	"log/slog"
)

// Context keys for storing dynamic filtering information
type contextKey string

const (
	allowedToolsetsContextKey  contextKey = "allowed_toolsets"
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

func getLicensedModulesForAccount(ctx context.Context, accountID string, config *config.Config, logger *slog.Logger) ([]string, error) {
	// Get the global license cache
	cache := license.GetGlobalLicenseCache(config.LicenseCacheTTL, config.LicenseCacheCleanInterval)

	// Try to get from cache first
	if cachedModules, found := cache.Get(accountID); found {
		logger.Debug("License information retrieved from cache",
			"account_id", accountID,
			"modules", cachedModules,
			"cache_size", cache.Size())
		return cachedModules, nil
	}

	logger.Debug("License information not in cache, fetching from API",
		"account_id", accountID,
		"cache_size", cache.Size())

	// Use the shared license client factory for consistent license client creation
	licenseFactory := license.NewClientFactory(config, logger)
	licenseClient, err := licenseFactory.CreateLicenseClient(ctx)
	if err != nil {
		logger.Error("Failed to create license client", "error", err, "account_id", accountID)
		// Fallback to CORE and UNLICENSED on license client creation failure
		fallbackModules := []string{"CORE", "UNLICENSED"}
		// Cache the fallback result to avoid repeated failures
		cache.Set(accountID, fallbackModules)
		return fallbackModules, nil
	}

	// Call GetAccountLicenses API
	accountLicense, rawHttpResponse, err := licenseClient.GetAccountLicenses(ctx, accountID)
	if err != nil {
		logger.Error("Failed to get account licenses", "error", err, "account_id", accountID)
		// Fallback to CORE and UNLICENSED on API call failure
		fallbackModules := []string{"CORE", "UNLICENSED"}
		// Cache the fallback result to avoid repeated failures
		cache.Set(accountID, fallbackModules)
		return fallbackModules, nil
	}

	// Check response status
	if rawHttpResponse.StatusCode != 200 {
		logger.Error("Unexpected license API response status",
			"status", rawHttpResponse.Status,
			"status_code", rawHttpResponse.StatusCode,
			"account_id", accountID)
		// Fallback to CORE and UNLICENSED on non-200 response
		fallbackModules := []string{"CORE", "UNLICENSED"}
		// Cache the fallback result to avoid repeated failures
		cache.Set(accountID, fallbackModules)
		return fallbackModules, nil
	}

	logger.Debug("Successfully retrieved account licenses",
		"status", rawHttpResponse.Status,
		"account_id", accountID,
		"has_data", accountLicense.Data != nil)

	// Process license data
	var licensedModules []string

	// Always include CORE and UNLICENSED modules
	licensedModules = append(licensedModules, "CORE")
	licensedModules = append(licensedModules, "UNLICENSED")

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
					// For CCM module, license is issued as CE but we register AI entities module ID as CCM
					if moduleType == "CE" {
						licensedModules = append(licensedModules, "CCM")
					} else {
						licensedModules = append(licensedModules, moduleType)
					}
				}
			}
		}
	} else {
		logger.Warn("No module license data found in response", "account_id", accountID)
	}

	// Cache the successful result
	cache.Set(accountID, licensedModules)

	logger.Info("Licensed modules retrieved successfully and cached",
		"account_id", accountID,
		"modules", licensedModules,
		"module_count", len(licensedModules),
		"cache_size", cache.Size())

	return licensedModules, nil
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

	logger.Warn("No toolsets found for module in fallback mapping")
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
