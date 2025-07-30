package modules

import (
	"errors"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness/prompts"
	p "github.com/harness/harness-mcp/pkg/prompts"
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

// Mock for GetModulePrompts to avoid file system dependencies
var originalGetModulePrompts func(moduleID string, cfg config.Config) ([]prompts.PromptFile, error)

func setupMockGetModulePrompts(mockFn func(moduleID string, cfg config.Config) ([]prompts.PromptFile, error)) func() {
	originalGetModulePrompts = prompts.GetModulePrompts
	prompts.GetModulePrompts = mockFn
	return func() {
		prompts.GetModulePrompts = originalGetModulePrompts
	}
}

// Mock for AddPrompts to avoid actual MCP server dependencies
var originalAddPrompts func(prompts p.Prompts, mcpServer *server.MCPServer)

func setupMockAddPrompts(mockFn func(prompts p.Prompts, mcpServer *server.MCPServer)) func() {
	originalAddPrompts = p.AddPrompts
	p.AddPrompts = mockFn
	return func() {
		p.AddPrompts = originalAddPrompts
	}
}

func TestModuleRegisterPrompts_NoPrompts(t *testing.T) {
	// Setup mock for GetModulePrompts to return empty
	cleanup := setupMockGetModulePrompts(func(moduleID string, cfg config.Config) ([]prompts.PromptFile, error) {
		return []prompts.PromptFile{}, nil
	})
	defer cleanup()

	// Setup mock for AddPrompts (should not be called)
	addPromptsCalled := false
	cleanupAddPrompts := setupMockAddPrompts(func(prompts p.Prompts, mcpServer *server.MCPServer) {
		addPromptsCalled = true
	})
	defer cleanupAddPrompts()

	// Call the function
	err := ModuleRegisterPrompts("test-module", &server.MCPServer{}, config.Config{})
	
	// Verify no error and AddPrompts was not called
	assert.NoError(t, err)
	assert.False(t, addPromptsCalled, "AddPrompts should not be called when no prompts are available")
}

func TestModuleRegisterPrompts_WithPrompts(t *testing.T) {
	// Setup mock for GetModulePrompts to return some prompts
	cleanup := setupMockGetModulePrompts(func(moduleID string, cfg config.Config) ([]prompts.PromptFile, error) {
		return []prompts.PromptFile{
			{
				Metadata: prompts.PromptMetadata{
					Name:             "test-prompt",
					Description:      "Test prompt description",
					ResultDescription: "Test result description",
				},
				Content: "This is a test prompt content",
			},
		}, nil
	})
	defer cleanup()

	// Setup mock for AddPrompts (should be called)
	addPromptsCalled := false
	cleanupAddPrompts := setupMockAddPrompts(func(prompts p.Prompts, mcpServer *server.MCPServer) {
		addPromptsCalled = true
		// Verify the prompt was converted correctly
		assert.Equal(t, 1, len(prompts))
	})
	defer cleanupAddPrompts()

	// Call the function
	err := ModuleRegisterPrompts("test-module", &server.MCPServer{}, config.Config{})
	
	// Verify no error and AddPrompts was called
	assert.NoError(t, err)
	assert.True(t, addPromptsCalled, "AddPrompts should be called when prompts are available")
}

func TestModuleRegisterPrompts_Error(t *testing.T) {
	// Setup mock for GetModulePrompts to return an error
	cleanup := setupMockGetModulePrompts(func(moduleID string, cfg config.Config) ([]prompts.PromptFile, error) {
		return nil, errors.New("test error")
	})
	defer cleanup()

	// Call the function
	err := ModuleRegisterPrompts("test-module", &server.MCPServer{}, config.Config{})
	
	// Verify error is returned
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "test error")
}

func TestModuleRegistry_RegisterPrompts(t *testing.T) {
	// Create a mock MCP server
	mockServer := new(mockMCPServer)
	
	// Setup expectations
	mockServer.On("RegisterPrompt", mock.Anything).Return()
	
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
