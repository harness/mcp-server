package modules

import (
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/server"
)

// DefaultModulePrompts is a mixin that provides default implementations for prompt-related methods
// It can be embedded in module structs to satisfy the Module interface
type DefaultModulePrompts struct {}

// HasPrompts returns true if this module has prompts
// Default implementation returns false
func (d *DefaultModulePrompts) HasPrompts() bool {
	return false
}

// RegisterPrompts registers all prompts for this module
// Default implementation does nothing
func (d *DefaultModulePrompts) RegisterPrompts(_ *server.MCPServer) error {
	return nil
}

// ModuleWithPrompts is a helper interface for modules that have prompts
type ModuleWithPrompts interface {
	// ID returns the identifier for this module
	ID() string
	// Config returns the config for this module
	Config() *config.Config
}

// RegisterModulePrompts registers prompts for a module that implements ModuleWithPrompts
func RegisterModulePrompts(m ModuleWithPrompts, mcpServer *server.MCPServer) error {
	return ModuleRegisterPrompts(m.ID(), mcpServer, *m.Config())
}
