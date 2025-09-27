package modules

import (
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
	"github.com/stretchr/testify/assert"
)

// MockModule is a simple implementation of the Module interface for testing
type MockModule struct {
	id        string
	name      string
	toolsets  []string
	isDefault bool
}

func (m *MockModule) ID() string                                      { return m.id }
func (m *MockModule) Name() string                                    { return m.name }
func (m *MockModule) Toolsets() []string                              { return m.toolsets }
func (m *MockModule) RegisterToolsets() error                         { return nil }
func (m *MockModule) EnableToolsets(tsg *toolsets.ToolsetGroup) error { return nil }
func (m *MockModule) IsDefault() bool                                 { return m.isDefault }

// NewMockModuleRegistry creates a registry with mock modules for testing
func NewMockModuleRegistry(config *config.Config, tsg *toolsets.ToolsetGroup) *ModuleRegistry {
	registry := &ModuleRegistry{
		modules: []Module{
			&MockModule{id: "CORE", name: "Core Module", toolsets: []string{"core-tools"}, isDefault: true},
			&MockModule{id: "CI", name: "CI Module", toolsets: []string{"ci-tools"}, isDefault: true},
			&MockModule{id: "CD", name: "CD Module", toolsets: []string{"cd-tools"}, isDefault: false},
		},
		config:           config,
		tsg:              tsg,
		moduleToToolsets: make(map[string][]string),
	}

	// Populate the moduleToToolsets mapping
	for _, module := range registry.modules {
		registry.moduleToToolsets[module.ID()] = module.Toolsets()
	}

	return registry
}

// TestNewModuleRegistry tests the creation of a new module registry
func TestNewModuleRegistry(t *testing.T) {
	// Create a minimal config for testing
	cfg := &config.Config{}
	tsg := toolsets.NewToolsetGroup(false)

	// Create a new module registry
	registry := NewMockModuleRegistry(cfg, tsg)

	// Verify the registry was created with the expected modules
	assert.NotNil(t, registry)
	assert.NotEmpty(t, registry.modules)
	assert.Equal(t, cfg, registry.config)
	assert.Equal(t, tsg, registry.tsg)
	assert.NotNil(t, registry.moduleToToolsets)
}

// TestGetAllModules tests retrieving all modules from the registry
func TestGetAllModules(t *testing.T) {
	// Create a minimal config for testing
	cfg := &config.Config{}
	tsg := toolsets.NewToolsetGroup(false)

	// Create a new module registry
	registry := NewMockModuleRegistry(cfg, tsg)

	// Get all modules
	modules := registry.GetAllModules()

	// Verify modules were returned
	assert.NotEmpty(t, modules)
	assert.Equal(t, registry.modules, modules)
}

// TestGetEnabledModules tests retrieving enabled modules
func TestGetEnabledModules(t *testing.T) {
	// Test cases
	testCases := []struct {
		name          string
		enableModules []string
		expectedCount int
		expectAll     bool
	}{
		{
			name:          "No modules specified - should return default modules",
			enableModules: []string{},
			expectedCount: 0, // This will be updated after counting default modules
			expectAll:     false,
		},
		{
			name:          "All modules enabled",
			enableModules: []string{"all"},
			expectedCount: 0, // This will be updated with the total count
			expectAll:     true,
		},
		{
			name:          "Specific modules enabled",
			enableModules: []string{"CI", "CD"},
			expectedCount: 3, // Core + CI + CD
			expectAll:     false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create config with test case settings
			cfg := &config.Config{
				EnableModules: tc.enableModules,
			}
			tsg := toolsets.NewToolsetGroup(false)

			// Create registry
			registry := NewMockModuleRegistry(cfg, tsg)

			// Count default modules for first test case
			if len(tc.enableModules) == 0 {
				defaultCount := 0
				for _, m := range registry.modules {
					if m.IsDefault() {
						defaultCount++
					}
				}
				tc.expectedCount = defaultCount
			} else if tc.expectAll {
				tc.expectedCount = len(registry.modules)
			}

			// Get enabled modules
			enabledModules := registry.GetEnabledModules()

			// Verify correct modules are enabled
			if tc.expectAll {
				assert.Equal(t, len(registry.modules), len(enabledModules))
			} else {
				assert.Equal(t, tc.expectedCount, len(enabledModules))
			}

			// Core module should always be included
			hasCoreModule := false
			for _, m := range enabledModules {
				if m.ID() == "CORE" {
					hasCoreModule = true
					break
				}
			}
			assert.True(t, hasCoreModule, "Core module should always be enabled")
		})
	}
}

// TestGetToolsetsForModule tests retrieving toolsets for a module
func TestGetToolsetsForModule(t *testing.T) {
	// Create a minimal config for testing
	cfg := &config.Config{}
	tsg := toolsets.NewToolsetGroup(false)

	// Create a new module registry
	registry := NewMockModuleRegistry(cfg, tsg)

	// Test getting toolsets for an existing module
	coreModule := registry.modules[0]
	toolsets := registry.GetToolsetsForModule(coreModule.ID())
	assert.Equal(t, coreModule.Toolsets(), toolsets)

	// Test getting toolsets for a non-existent module
	nonExistentToolsets := registry.GetToolsetsForModule("NON_EXISTENT_MODULE")
	assert.Empty(t, nonExistentToolsets)
}

// TestGlobalRegistry tests the global registry functions
func TestGlobalRegistry(t *testing.T) {
	// Create a minimal config for testing
	cfg := &config.Config{}
	tsg := toolsets.NewToolsetGroup(false)

	// Create a new module registry
	registry := NewMockModuleRegistry(cfg, tsg)

	// Set the global registry
	SetGlobalRegistry(registry)

	// Verify the global registry was set correctly
	assert.Equal(t, registry, GetGlobalRegistry())
}

// TestRegisterPrompts tests the prompt registration functionality
func TestRegisterPrompts(t *testing.T) {
	// Create a minimal config for testing
	cfg := &config.Config{
		EnableModules: []string{"CORE"},
	}
	tsg := toolsets.NewToolsetGroup(false)

	// Create a new module registry
	registry := NewMockModuleRegistry(cfg, tsg)

	// Create a mock MCP server with required parameters
	mcpServer := server.NewMCPServer("test-server", "test-version")

	// Register prompts
	err := registry.RegisterPrompts(mcpServer)

	// Verify registration completed without errors
	assert.NoError(t, err)
}
