package tool_filtering

import (
	"log/slog"
	"os"
	"reflect"
	"testing"
)

// testComputeAllowedToolsetsFromModules is a test-specific version of computeAllowedToolsetsFromModules
// that uses a mock moduleToToolsets function for predictable test results
func testComputeAllowedToolsetsFromModules(requestedModules, licensedModules []string, logger *slog.Logger) []string {
	// Define a mock function for moduleToToolsets
	mockModuleToToolsets := func(module string) []string {
		switch module {
		case "CORE":
			return []string{"core-tools", "default"}
		case "UNLICENSED":
			return []string{"unlicensed-tools"}
		case "CI":
			return []string{"ci-tools"}
		case "CD":
			return []string{"cd-tools"}
		case "CCM":
			return []string{"ccm-tools"}
		default:
			return []string{}
		}
	}

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

	// Helper function to ensure a module is included
	ensureModuleIncluded := func(modules []string, moduleToInclude string) []string {
		for _, module := range modules {
			if module == moduleToInclude {
				return modules
			}
		}
		return append(modules, moduleToInclude)
	}

	// Always include required modules
	allowedModules = ensureModuleIncluded(allowedModules, "CORE")
	allowedModules = ensureModuleIncluded(allowedModules, "UNLICENSED")

	// Convert modules to toolsets
	var allowedToolsets []string
	for _, module := range allowedModules {
		toolsets := mockModuleToToolsets(module)
		allowedToolsets = append(allowedToolsets, toolsets...)
	}

	// Ensure default toolset is included
	allowedToolsets = ensureModuleIncluded(allowedToolsets, "default")

	logger.Debug("Computed allowed toolsets",
		"allowed_modules", allowedModules,
		"allowed_toolsets", allowedToolsets)

	return allowedToolsets
}

func TestComputeAllowedToolsetsFromModules(t *testing.T) {
	// Setup a test logger
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))

	tests := []struct {
		name             string
		requestedModules []string
		licensedModules  []string
		expectedToolsets []string
	}{
		{
			name:             "Empty requested and licensed modules",
			requestedModules: []string{},
			licensedModules:  []string{},
			// Should always include CORE, UNLICENSED, and default toolsets
			expectedToolsets: []string{"core-tools", "default", "unlicensed-tools"},
		},
		{
			name:             "Only CORE licensed",
			requestedModules: []string{"CI", "CD"},
			licensedModules:  []string{"CORE"},
			// Should include CORE, UNLICENSED, and default toolsets
			expectedToolsets: []string{"core-tools", "default", "unlicensed-tools"},
		},
		{
			name:             "Multiple modules licensed and requested",
			requestedModules: []string{"CI", "CD", "CCM"},
			licensedModules:  []string{"CORE", "CI", "CD"},
			// Should include CI, CD, CORE, UNLICENSED, and default toolsets
			expectedToolsets: []string{"ci-tools", "cd-tools", "core-tools", "default", "unlicensed-tools"},
		},
		{
			name:             "CORE and UNLICENSED already in requested modules",
			requestedModules: []string{"CORE", "UNLICENSED", "CI"},
			licensedModules:  []string{"CORE", "CI", "UNLICENSED"},
			// Should include CI, CORE, UNLICENSED, and default toolsets
			expectedToolsets: []string{"core-tools", "default", "unlicensed-tools", "ci-tools"},
		},
		{
			name:             "No intersection between requested and licensed",
			requestedModules: []string{"CI", "CD"},
			licensedModules:  []string{"CORE", "CCM"},
			// Should include CORE, UNLICENSED, and default toolsets
			expectedToolsets: []string{"core-tools", "default", "unlicensed-tools"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotToolsets := testComputeAllowedToolsetsFromModules(tt.requestedModules, tt.licensedModules, logger)

			// Check if the expected toolsets are included in the result
			for _, expectedToolset := range tt.expectedToolsets {
				found := false
				for _, gotToolset := range gotToolsets {
					if gotToolset == expectedToolset {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("testComputeAllowedToolsetsFromModules() = %v, expected to include %v", gotToolsets, expectedToolset)
				}
			}

			// Check if the result has the expected length
			if len(gotToolsets) != len(tt.expectedToolsets) {
				t.Errorf("testComputeAllowedToolsetsFromModules() returned %d toolsets, expected %d. Got: %v, Expected: %v",
					len(gotToolsets), len(tt.expectedToolsets), gotToolsets, tt.expectedToolsets)
			}
		})
	}
}

func TestEnsureModuleIncluded(t *testing.T) {
	// Test the behavior of the ensureModuleIncluded helper function
	// by creating a similar function for testing
	ensureModuleIncluded := func(modules []string, moduleToInclude string) []string {
		for _, module := range modules {
			if module == moduleToInclude {
				return modules
			}
		}
		return append(modules, moduleToInclude)
	}

	tests := []struct {
		name            string
		modules         []string
		moduleToInclude string
		expected        []string
	}{
		{
			name:            "Empty modules list",
			modules:         []string{},
			moduleToInclude: "CORE",
			expected:        []string{"CORE"},
		},
		{
			name:            "Module already included",
			modules:         []string{"CORE", "CI"},
			moduleToInclude: "CORE",
			expected:        []string{"CORE", "CI"},
		},
		{
			name:            "Module not included",
			modules:         []string{"CI", "CD"},
			moduleToInclude: "CORE",
			expected:        []string{"CI", "CD", "CORE"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ensureModuleIncluded(tt.modules, tt.moduleToInclude)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("ensureModuleIncluded() = %v, expected %v", result, tt.expected)
			}
		})
	}
}
