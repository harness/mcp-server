package modules

import (
	"errors"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	p "github.com/harness/harness-mcp/pkg/prompts"
	"github.com/harness/harness-mcp/pkg/toolsets"
	"github.com/mark3labs/mcp-go/server"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock for the MCP server
type mockMCPServer struct {
	mock.Mock
	RegisteredPrompts []string
}

func (m *mockMCPServer) RegisterPrompt(name string) {
	m.Called(name)
	m.RegisteredPrompts = append(m.RegisteredPrompts, name)
}

// Test helper functions that don't rely on package function mocking
func TestModuleRegisterPrompts_NoPrompts(t *testing.T) {
	// Create a test config
	cfg := config.Config{}
	
	// Call the function with a non-existent module (should return no prompts)
	err := ModuleRegisterPrompts("non-existent-module", harness.NewServer("test-version"), cfg)
	
	// Verify no error is returned (empty prompts should not cause error)
	assert.NoError(t, err)
}

func TestModuleRegisterPrompts_WithValidModule(t *testing.T) {
	// Create a test config
	cfg := config.Config{}
	
	// Call the function with a valid module
	err := ModuleRegisterPrompts("ccm", harness.NewServer("test-version"), cfg)
	
	// Verify no error is returned
	assert.NoError(t, err)
}

func TestModuleRegistry_RegisterPrompts(t *testing.T) {
	// Create a properly initialized MCP server
	mockServer := harness.NewServer("test-version")
	
	// Create modules with and without prompts
	moduleWithPrompts := &mockModuleWithPrompts{
		id:         "module-with-prompts",
		hasPrompts: true,
	}
	moduleWithoutPrompts := &mockModuleWithPrompts{
		id:         "module-without-prompts",
		hasPrompts: false,
	}
	moduleWithError := &mockModuleWithPrompts{
		id:         "module-with-error",
		hasPrompts: true,
		error:      errors.New("registration error"),
	}
	
	// Create a module registry with these modules
	registry := &ModuleRegistry{
		modules: []Module{moduleWithPrompts, moduleWithoutPrompts, moduleWithError},
		config:  &config.Config{},
	}
	
	// Call RegisterPrompts
	err := registry.RegisterPrompts(mockServer)
	
	// Verify error is returned from the module with error
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "registration error")
	
	// Verify the module with prompts had RegisterPrompts called
	assert.True(t, moduleWithPrompts.registerPromptsCalled, "RegisterPrompts should be called for modules with prompts")
	
	// Verify the module without prompts did not have RegisterPrompts called
	assert.False(t, moduleWithoutPrompts.registerPromptsCalled, "RegisterPrompts should not be called for modules without prompts")
}

func TestModuleRegistry_RegisterPrompts_Success(t *testing.T) {
	// Create a properly initialized MCP server
	mockServer := harness.NewServer("test-version")
	
	// Create modules that should succeed
	moduleWithPrompts := &mockModuleWithPrompts{
		id:         "module-with-prompts",
		hasPrompts: true,
	}
	moduleWithoutPrompts := &mockModuleWithPrompts{
		id:         "module-without-prompts",
		hasPrompts: false,
	}
	
	// Create a module registry with these modules
	registry := &ModuleRegistry{
		modules: []Module{moduleWithPrompts, moduleWithoutPrompts},
		config:  &config.Config{},
	}
	
	// Call RegisterPrompts
	err := registry.RegisterPrompts(mockServer)
	
	// Verify no error is returned
	assert.NoError(t, err)
	
	// Verify the module with prompts had RegisterPrompts called
	assert.True(t, moduleWithPrompts.registerPromptsCalled, "RegisterPrompts should be called for modules with prompts")
	
	// Verify the module without prompts did not have RegisterPrompts called
	assert.False(t, moduleWithoutPrompts.registerPromptsCalled, "RegisterPrompts should not be called for modules without prompts")
}

func TestPrompts_Length(t *testing.T) {
	// Test the Prompts type length functionality
	prompts := p.Prompts{}
	
	// Test empty prompts
	assert.Equal(t, 0, len(prompts.GetPrompts()))
	
	// Add a prompt
	prompt := p.NewPrompt().SetName("test").SetText("test content").Build()
	prompts.Append(prompt)
	
	// Test with one prompt
	assert.Equal(t, 1, len(prompts.GetPrompts()))
}

// Mock module implementation for testing
type mockModuleWithPrompts struct {
	id                   string
	hasPrompts           bool
	error                error
	registerPromptsCalled bool
}

func (m *mockModuleWithPrompts) ID() string {
	return m.id
}

func (m *mockModuleWithPrompts) Name() string {
	return m.id
}

func (m *mockModuleWithPrompts) Toolsets() []string {
	return []string{}
}

func (m *mockModuleWithPrompts) RegisterToolsets() error {
	return nil
}

func (m *mockModuleWithPrompts) EnableToolsets(tsg *toolsets.ToolsetGroup) error {
	return nil
}

func (m *mockModuleWithPrompts) HasPrompts() bool {
	return m.hasPrompts
}

func (m *mockModuleWithPrompts) RegisterPrompts(mcpServer *server.MCPServer) error {
	m.registerPromptsCalled = true
	return m.error
}

func (m *mockModuleWithPrompts) IsDefault() bool {
	return false
}