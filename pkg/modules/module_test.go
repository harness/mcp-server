package modules

import (
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/toolsets"
)

// TestModuleInterface tests that modules implement the Module interface correctly
func TestModuleInterface(t *testing.T) {
	// Create a mock config
	cfg := &config.Config{
		Internal: true,
	}

	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(false)

	// Test cases for different modules
	testModules := []struct {
		name       string
		createFunc func() Module
	}{
		{
			name: "Core Module",
			createFunc: func() Module {
				return NewCoreModule(cfg, tsg)
			},
		},
		{
			name: "CI Module",
			createFunc: func() Module {
				return NewCIModule(cfg, tsg)
			},
		},
		{
			name: "CD Module",
			createFunc: func() Module {
				return NewCDModule(cfg, tsg)
			},
		},
		{
			name: "SEI Module",
			createFunc: func() Module {
				return NewSEIModule(cfg, tsg)
			},
		},
		{
			name: "STO Module",
			createFunc: func() Module {
				return NewSTOModule(cfg, tsg)
			},
		},
		{
			name: "SSCA Module",
			createFunc: func() Module {
				return NewSSCAModule(cfg, tsg)
			},
		},
		{
			name: "CCM Module",
			createFunc: func() Module {
				return NewCCMModule(cfg, tsg)
			},
		},
		{
			name: "IDP Module",
			createFunc: func() Module {
				return NewIDPModule(cfg, tsg)
			},
		},
		{
			name: "HAR Module",
			createFunc: func() Module {
				return NewHARModule(cfg, tsg)
			},
		},
		{
			name: "Unlicensed Module",
			createFunc: func() Module {
				return NewUnlicensedModule(cfg, tsg)
			},
		},
	}

	for _, tc := range testModules {
		t.Run(tc.name, func(t *testing.T) {
			module := tc.createFunc()

			// Test ID method
			if module.ID() == "" {
				t.Errorf("Module ID should not be empty")
			}

			// Test Name method
			if module.Name() == "" {
				t.Errorf("Module name should not be empty")
			}

			// Test Toolsets method
			toolsets := module.Toolsets()
			if toolsets == nil {
				t.Errorf("Toolsets should return a non-nil slice")
			}

			// Test IsDefault method
			_ = module.IsDefault()
		})
	}
}

// TestModuleRegistry tests the module registry functionality
func TestModuleRegistry(t *testing.T) {
	// Create configs for different test cases
	configs := []*config.Config{
		{
			// No modules specified - should return default modules
			EnableLicense: true,
			EnableModules: []string{},
			Internal:      true,
		},
		{
			// Specific modules - should return only those modules and CORE module
			EnableLicense: true,
			EnableModules: []string{"CI"},
			Internal:      true,
		},
		{
			// All modules - should return all modules
			EnableLicense: true,
			EnableModules: []string{"all"},
			Internal:      true,
		},
	}

	for i, cfg := range configs {
		t.Run("Config case "+string(rune('A'+i)), func(t *testing.T) {
			// Create a toolset group
			tsg := toolsets.NewToolsetGroup(false)

			// Create the module registry
			registry := NewModuleRegistry(cfg, tsg)

			// Get enabled modules
			enabledModules := registry.GetEnabledModules()

			// Basic validation
			if len(enabledModules) == 0 {
				t.Errorf("No modules were enabled")
			}

			// Check specific cases
			switch i {
			case 0:
				// Default case - should only have default modules
				if len(enabledModules) < 2 {
					t.Errorf("Atleast Core and Unlicensed modules should be returned, enabled modules count: %v", len(enabledModules))
				}
				for _, module := range enabledModules {
					if !module.IsDefault() {
						t.Errorf("Non-default module %s was enabled in default case", module.ID())
					}
				}
			case 1:
				// Specific modules case - should only have CORE and CI
				foundCore := false
				foundCI := false
				foundUnlicensed := false
				for _, module := range enabledModules {
					if module.ID() == "CORE" {
						foundCore = true
					}
					if module.ID() == "CI" {
						foundCI = true
					}
					if module.ID() == "UNLICENSED" {
						foundUnlicensed = true
					}
				}
				if !foundCore {
					t.Errorf("CORE module not found")
				}
				if !foundUnlicensed {
					t.Errorf("UNLICENSED module not found")
				}
				if !foundCI {
					t.Errorf("CI module not found when specifically enabled")
				}
				if len(enabledModules) != 3 {
					t.Errorf("Expected 3 modules, got %d", len(enabledModules))
				}
			case 2:
				// All modules case - should have all modules
				if len(enabledModules) != len(registry.modules) {
					t.Errorf("Expected all %d modules to be enabled, got %d", len(registry.modules), len(enabledModules))
				}
			}
		})
	}
}

// TestModuleEnableToolsetsHelper tests the ModuleEnableToolsets helper function
func TestModuleEnableToolsetsHelper(t *testing.T) {
	// We don't need a config for this test, but we'll keep the comment for clarity
	// as other tests might need it in the future

	// Create a toolset group
	tsg := toolsets.NewToolsetGroup(false)

	// Create a test toolset and add it to the group
	testToolset := toolsets.NewToolset("test-toolset", "Test Toolset")
	tsg.AddToolset(testToolset)

	// Create a default toolset and add it to the group
	defaultToolset := toolsets.NewToolset("default", "Default Toolset")
	tsg.AddToolset(defaultToolset)

	// Create a simple mock module that implements the Module interface
	mockModule := &struct {
		id        string
		name      string
		toolsets  []string
		isDefault bool
	}{
		id:        "MOCK",
		name:      "Mock Module",
		toolsets:  []string{"test-toolset", "non-existent-toolset"},
		isDefault: false,
	}

	// Implement the Module interface methods
	mockModuleImpl := Module(mockModuleAdapter{
		m:                mockModule,
		registerToolsets: func() error { return nil },
		enableToolsets:   func(tsg *toolsets.ToolsetGroup) error { return nil },
	})

	// Call ModuleEnableToolsets with the mock module
	err := ModuleEnableToolsets(mockModuleImpl, tsg)

	// Verify no error is returned
	if err != nil {
		t.Errorf("ModuleEnableToolsets returned error: %v", err)
	}

	// Check if the test toolset was enabled
	isEnabled := tsg.IsEnabled("test-toolset")
	if !isEnabled {
		t.Errorf("test-toolset should be enabled but isn't")
	}

	// Verify non-existent toolset was skipped without error
	// (ModuleEnableToolsets should only enable toolsets that exist)
}

// mockModuleAdapter adapts a simple struct to implement the Module interface
type mockModuleAdapter struct {
	m *struct {
		id        string
		name      string
		toolsets  []string
		isDefault bool
	}
	registerToolsets func() error
	enableToolsets   func(tsg *toolsets.ToolsetGroup) error
}

func (a mockModuleAdapter) ID() string              { return a.m.id }
func (a mockModuleAdapter) Name() string            { return a.m.name }
func (a mockModuleAdapter) Toolsets() []string      { return a.m.toolsets }
func (a mockModuleAdapter) RegisterToolsets() error { return a.registerToolsets() }
func (a mockModuleAdapter) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return a.enableToolsets(tsg)
}
func (a mockModuleAdapter) IsDefault() bool { return a.m.isDefault }
