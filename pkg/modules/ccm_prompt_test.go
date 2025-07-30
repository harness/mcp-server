package modules

import (
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/server"
)

func TestCCMModule_HasPrompts(t *testing.T) {
	// Create a CCM module
	cfg := &config.Config{}
	ccmModule := NewCCMModule(cfg, nil)
	
	// Test that HasPrompts returns true for CCM module
	if !ccmModule.HasPrompts() {
		t.Errorf("CCMModule.HasPrompts() should return true")
	}
}

func TestCCMModule_RegisterPrompts(t *testing.T) {
	// Create a CCM module
	cfg := &config.Config{}
	ccmModule := NewCCMModule(cfg, nil)
	
	// Create a simple mock MCP server
	mockServer := &server.MCPServer{}
	
	// Call RegisterPrompts
	err := ccmModule.RegisterPrompts(mockServer)
	
	// Verify no error is returned
	if err != nil {
		t.Errorf("CCMModule.RegisterPrompts() should not return an error: %v", err)
	}
	
	// Note: The actual registration depends on ModuleRegisterPrompts which is tested separately
}
