package harness

import (
	"context"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/modules"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// MockModule implements the modules.Module interface for testing
type MockModule struct {
	id        string
	isDefault bool
}

func (m *MockModule) ID() string {
	return m.id
}

func (m *MockModule) Name() string {
	return m.id // Using ID as name for simplicity
}

func (m *MockModule) Toolsets() []string {
	return []string{m.id + "_toolset"} // Simple toolset name based on ID
}

func (m *MockModule) IsDefault() bool {
	return m.isDefault
}

func (m *MockModule) RegisterToolsets() error {
	return nil
}

func (m *MockModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return nil
}

// MockModuleRegistry implements a simple registry for testing
type MockModuleRegistry struct {
	mockModules []modules.Module
}

// GetEnabledModules returns the mock modules
func (r *MockModuleRegistry) GetEnabledModules() []modules.Module {
	return r.mockModules
}

// TestGetEnabledModules tests the getEnabledModules function
func TestGetEnabledModules(t *testing.T) {
	// Create test cases
	testCases := []struct {
		name            string
		config          *config.Config
		licenseInfo     *LicenseInfo
		modules         []modules.Module
		expectedModules int
		expectedIDs     []string
	}{
		{
			name: "License validation enabled but license invalid",
			config: &config.Config{
				EnableLicense: true,
			},
			licenseInfo: &LicenseInfo{
				IsValid:        false,
				ModuleLicenses: map[string]bool{},
			},
			modules: []modules.Module{
				&MockModule{id: "module1", isDefault: true},
				&MockModule{id: "module2", isDefault: false},
			},
			expectedModules: 1,
			expectedIDs:     []string{"module1"},
		},
		{
			name: "License validation enabled and license valid",
			config: &config.Config{
				EnableLicense: true,
			},
			licenseInfo: &LicenseInfo{
				IsValid: true,
				ModuleLicenses: map[string]bool{
					"module1": true,
					"module2": false,
				},
			},
			modules: []modules.Module{
				&MockModule{id: "module1", isDefault: false},
				&MockModule{id: "module2", isDefault: false},
				&MockModule{id: "module3", isDefault: true}, // Default module
			},
			expectedModules: 2,
			expectedIDs:     []string{"module1", "module3"}, // module1 (licensed) and module3 (default)
		},
		{
			name: "License validation enabled and license valid",
			config: &config.Config{
				EnableLicense: true,
			},
			licenseInfo: &LicenseInfo{
				IsValid: true,
				ModuleLicenses: map[string]bool{
					"module1": true,
					"module2": true,
				},
			},
			modules: []modules.Module{
				&MockModule{id: "module1", isDefault: false},
				&MockModule{id: "module2", isDefault: false},
				&MockModule{id: "module3", isDefault: true}, // Default module
			},
			expectedModules: 3,
			expectedIDs:     []string{"module1", "module2", "module3"}, // module1 (licensed) and module3 (default)
		},
		{
			name: "CCM module enabled with CE license",
			config: &config.Config{
				EnableLicense: true,
			},
			licenseInfo: &LicenseInfo{
				IsValid: true,
				ModuleLicenses: map[string]bool{
					"CE": true, // License for CE
				},
			},
			modules: []modules.Module{
				&MockModule{id: "CCM", isDefault: false},     // This should be enabled
				&MockModule{id: "module2", isDefault: false}, // This should NOT be enabled
				&MockModule{id: "default", isDefault: true},  // This should always be enabled
			},
			expectedModules: 2,
			expectedIDs:     []string{"CCM", "default"},
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {

			ctx := context.Background()

			// Call our test version of getEnabledModules that accepts our mock registry
			result := getEnabledModules(ctx, tc.modules, tc.licenseInfo)

			// Verify results
			if len(result) != tc.expectedModules {
				t.Errorf("Expected %d modules, got %d", tc.expectedModules, len(result))
			}

			// Verify module IDs
			for i, expectedID := range tc.expectedIDs {
				if i >= len(result) {
					t.Errorf("Missing expected module: %s", expectedID)
					continue
				}
				if result[i].ID() != expectedID {
					t.Errorf("Expected module ID %s at position %d, got %s", expectedID, i, result[i].ID())
				}
			}
		})
	}
}
