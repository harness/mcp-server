package modules

import (
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/server"
)

func TestDefaultModulePrompts_HasPrompts(t *testing.T) {
	// Create a DefaultModulePrompts instance
	d := &DefaultModulePrompts{}
	
	// Test that HasPrompts returns false by default
	if d.HasPrompts() {
		t.Errorf("DefaultModulePrompts.HasPrompts() should return false")
	}
}

func TestDefaultModulePrompts_RegisterPrompts(t *testing.T) {
	// Create a DefaultModulePrompts instance
	d := &DefaultModulePrompts{}
	
	// Create a mock MCP server (we don't need a real one since the method should do nothing)
	mockServer := &server.MCPServer{}
	
	// Test that RegisterPrompts returns nil (no error)
	err := d.RegisterPrompts(mockServer)
	if err != nil {
		t.Errorf("DefaultModulePrompts.RegisterPrompts() should not return an error: %v", err)
	}
}

type testModuleWithPrompts struct {
	id     string
	config *config.Config
}

func (m *testModuleWithPrompts) ID() string {
	return m.id
}

func (m *testModuleWithPrompts) Config() *config.Config {
	return m.config
}

func TestRegisterModulePrompts(t *testing.T) {
	// Create a mock module that implements ModuleWithPrompts
	mockModule := &testModuleWithPrompts{
		id:     "test-module",
		config: &config.Config{},
	}
	
	// Create a mock MCP server
	mockServer := &server.MCPServer{}
	
	// We can't easily test the actual registration since ModuleRegisterPrompts calls
	// the package-level function ModuleRegisterPrompts, which we'd need to mock.
	// But we can at least verify it doesn't panic or return an unexpected error.
	
	// This is more of a smoke test than a true unit test
	err := RegisterModulePrompts(mockModule, mockServer)
	
	// The actual result will depend on the implementation of ModuleRegisterPrompts
	// and what prompts are available for the test module.
	// At minimum, it shouldn't panic or return an unexpected error.
	if err != nil {
		t.Errorf("RegisterModulePrompts should not return an error: %v", err)
	}
}
