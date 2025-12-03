package tools

import (
	"context"
	"fmt"
	"log/slog"

	config "github.com/harness/mcp-server/common"
	tool_registration_utils "github.com/harness/mcp-server/common/pkg/utils"
	"github.com/harness/mcp-server/common/pkg/toolsets"
	"github.com/harness/mcp-server/common/pkg/modules"
	_ "github.com/harness/mcp-server/external/pkg/tools/utils"
)

func InitToolsets(ctx context.Context, config *config.Config) (*toolsets.ToolsetGroup, error) {
	tsg := toolsets.NewToolsetGroup(config.ReadOnly)

	// Initialize license validation
	licenseInfo, err := tool_registration_utils.InitLicenseValidation(ctx, config)
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
		tool_registration_utils.RegisterAllToolsetsWithTracker(ctx, tsg)
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

	tool_registration_utils.RegisterAllToolsetsWithTracker(ctx, tsg)
	return tsg, nil
}
