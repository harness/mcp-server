// Package mcplint provides validation for MCP tool definitions.
package mcplint

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
)

// ValidVerbs is the list of allowed verbs for tool names.
var ValidVerbs = []string{
	"get", "list", "create", "update", "delete",
	"fetch", "search", "run", "execute", "trigger",
	"enable", "disable", "add", "set", "check",
	"download", "upload",
}

// MaxToolNameLength is the maximum allowed length for tool names per MCP spec.
const MaxToolNameLength = 64

// snakeCasePattern matches valid snake_case names.
var snakeCasePattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// ValidateToolName checks if a tool name follows naming conventions.
// Returns an error if validation fails, nil if valid.
//
// Validation rules:
//   - Must be non-empty
//   - Must be at most 64 characters (MCP spec)
//   - Must be snake_case (lowercase letters, numbers, underscores)
//   - Must start with a verb or have module_verb pattern
func ValidateToolName(name string) error {
	// Check empty
	if name == "" {
		return fmt.Errorf("tool name cannot be empty")
	}

	// Check max length (MCP spec: 64 chars)
	if len(name) > MaxToolNameLength {
		return fmt.Errorf(
			"tool name '%s' exceeds %d character limit (has %d)",
			name, MaxToolNameLength, len(name),
		)
	}

	// Check snake_case: lowercase letters, numbers, underscores only
	if !snakeCasePattern.MatchString(name) {
		return fmt.Errorf(
			"tool name '%s' must be snake_case (lowercase letters, numbers, underscores only)",
			name,
		)
	}

	// Check verb prefix: must start with verb or have module_verb pattern
	if !hasValidVerbPrefix(name) {
		return fmt.Errorf(
			"tool name '%s' must start with a verb (%s) or use module_verb pattern (e.g., ccm_get_)",
			name, strings.Join(ValidVerbs, ", "),
		)
	}

	return nil
}

// hasValidVerbPrefix checks if name starts with verb or has module_verb pattern.
func hasValidVerbPrefix(name string) bool {
	parts := strings.Split(name, "_")

	// Check if first part is a verb (e.g., get_pipeline)
	if isVerb(parts[0]) {
		return true
	}

	// Check if second part is a verb (e.g., ccm_get_costs)
	if len(parts) >= 2 && isVerb(parts[1]) {
		return true
	}

	return false
}

// isVerb checks if s is a valid verb.
func isVerb(s string) bool {
	for _, v := range ValidVerbs {
		if s == v {
			return true
		}
	}
	return false
}

// ValidateTools validates all tool names and returns a list of errors.
// Each error corresponds to a validation failure for one tool.
func ValidateTools(tools []mcp.Tool) []error {
	var errors []error
	for _, tool := range tools {
		if err := ValidateToolName(tool.Name); err != nil {
			errors = append(errors, err)
		}
	}
	return errors
}
