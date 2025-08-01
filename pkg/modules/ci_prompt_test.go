package modules

import (
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/mark3labs/mcp-go/server"
)

func TestCIModule_HasPrompts(t *testing.T) {
	// Create a CI module
	cfg := &config.Config{}
	ciModule := NewCIModule(cfg, nil)
	
	// Test that HasPrompts returns true for CI module
	if !ciModule.HasPrompts() {
		t.Errorf("CIModule.HasPrompts() should return true")
	}
}

func TestCIModule_RegisterPrompts(t *testing.T) {
	// Create a CI module
	cfg := &config.Config{}
	ciModule := NewCIModule(cfg, nil)
	
	// Create a properly initialized MCP server
	mockServer := harness.NewServer("test-version")
	
	// Call RegisterPrompts
	err := ciModule.RegisterPrompts(mockServer)
	
	// Verify no error is returned
	if err != nil {
		t.Errorf("CIModule.RegisterPrompts() should not return an error: %v", err)
	}
	
	// Note: The actual registration depends on ModuleRegisterPrompts which is tested separately
}
