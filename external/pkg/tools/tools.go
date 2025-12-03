package tools

import (
	"context"
	"fmt"
	"log/slog"

	"net/http"

	config "github.com/harness/mcp-server/common"
	licenseFactory "github.com/harness/mcp-server/common/pkg/license"
	"github.com/harness/mcp-server/common/pkg/modules"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	_ "github.com/harness/mcp-server/external/pkg/tools/utils"
)

type LicenseInfo struct {
	AccountID      string
	ModuleLicenses map[string]bool // Map of module ID to license status
	IsValid        bool
}

type LicenseStatus string

const LicenseActive LicenseStatus = "ACTIVE"

// initLicenseValidation creates a license client and validates licenses
func initLicenseValidation(ctx context.Context, config *config.Config) (*LicenseInfo, error) {
	// Initialize license info with default values
	licenseInfo := &LicenseInfo{
		AccountID:      config.AccountID,
		ModuleLicenses: make(map[string]bool),
		IsValid:        false,
	}

	// Use the shared license client factory for consistent license client creation
	factory := licenseFactory.NewClientFactory(config, slog.Default())
	licenseClient, err := licenseFactory.DefaultFactoryProvider.CreateLicenseClient(ctx, factory)
	if err != nil {
		return licenseInfo, fmt.Errorf("failed to create license client, error: %w", err)
	}

	slog.InfoContext(ctx, "Successfully created license client")

	// Call GetAccountLicensesWithResponse to get account licenses
	// Make the API call
	accountLicense, rawHttpResponse, err := licenseClient.GetAccountLicenses(ctx, config.AccountID)
	if err != nil {
		slog.Error("Failed to get account licenses", "error", err)
		return licenseInfo, err
	}

	// Check accountLicense status
	if rawHttpResponse.StatusCode != http.StatusOK {
		slog.ErrorContext(ctx, "Unexpected accountLicense status", "status", rawHttpResponse.Status)
		return licenseInfo, fmt.Errorf("unexpected accountLicense status: %s", rawHttpResponse.Status)
	} else {
		// Print license information
		slog.InfoContext(ctx, "Successfully retrieved account licenses",
			"status", rawHttpResponse.Status,
			"accountId", config.AccountID)

		// If accountLicense has JSON data, process it
		slog.InfoContext(ctx, "License accountLicense data",
			"hasData", accountLicense.Data != nil,
			"status", accountLicense.Status)

		// Process account license details if available
		if accountLicense.Data != nil {
			// Set license info as valid
			licenseInfo.IsValid = true

			// Process module licenses from allModuleLicenses field
			if accountLicense.Data.AllModuleLicenses != nil {
				// Iterate through all module types in allModuleLicenses
				for moduleType, licenses := range accountLicense.Data.AllModuleLicenses {
					// Check if there are any licenses for this module type
					if len(licenses) > 0 {
						// Use the first license to determine status (assuming one license per module type)
						license := licenses[0]

						// Check if the module license is valid (ACTIVE)
						isValid := license.Status == string(LicenseActive)

						// Store the license status in our map
						licenseInfo.ModuleLicenses[moduleType] = isValid

					}
				}
			}

			// Log summary
			slog.InfoContext(ctx, "Account license details",
				"accountId", accountLicense.Data.AccountId,
				"licenseCount", len(licenseInfo.ModuleLicenses))
		}
	}

	return licenseInfo, nil
}

// registerAllToolsetsWithTracker registers all toolsets in the group with the main tracker
// This ensures that findToolGroup() can find which toolset a tool belongs to
func registerAllToolsetsWithTracker(ctx context.Context, group *toolsets.ToolsetGroup) {
	tracker := toolsets.GetMainToolTracker()

	// Register each toolset with the tracker
	for _, toolset := range group.Toolsets {
		if err := tracker.RegisterToolGroup(toolset); err != nil {
			slog.WarnContext(ctx, "Failed to register toolset with tracker", "toolset", toolset.Name, "error", err)
		}
	}

	slog.InfoContext(ctx, "Registered toolsets with tracker", "count", len(group.Toolsets))
}

func InitToolsets(ctx context.Context, config *config.Config) (*toolsets.ToolsetGroup, error) {
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Initialize license validation
	licenseInfo, err := initLicenseValidation(ctx, config)
	if err != nil {
		return nil, err
	}

	// Create module registry
	registry := modules.NewModuleRegistry(config, tsg)

	if !licenseInfo.IsValid || len(config.Toolsets) == 0 {
		modules.RegisterDefaultToolsets(config, tsg)

		if err := tsg.EnableToolset("default"); err != nil {
			return nil, fmt.Errorf("failed to enable toolsets: %w", err)
		}
		registerAllToolsetsWithTracker(ctx, tsg)
		return tsg, nil
	}

	// Validate requested toolsets against licenses
	allowedToolsets, deniedToolsets := registry.ValidateToolsets(
		config.Toolsets,
		licenseInfo.ModuleLicenses,
	)

	modules.RegisterAllowedToolsets(ctx, tsg, config, allowedToolsets)
	// Log denied toolsets
	for toolset, reason := range deniedToolsets {
		slog.WarnContext(ctx, "Toolset denied",
			"toolset", toolset,
			"reason", reason)
	}

	// Only enable allowed toolsets
	if err := tsg.EnableToolsets(allowedToolsets); err != nil {
		return nil, fmt.Errorf("failed to enable toolsets: %w", err)
	}

	slog.InfoContext(ctx, "Toolsets validated",
		"allowed", len(allowedToolsets),
		"denied", len(deniedToolsets))

	registerAllToolsetsWithTracker(ctx, tsg)
	return tsg, nil
}
