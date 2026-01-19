package test

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
)

// Tool name validation rules:
//   - Non-empty, max 64 characters (MCP spec)
//   - snake_case only (lowercase, numbers, underscores)
//   - Must follow {module}_{verb}_{noun} pattern

var validModules = []string{
	"acm", "ccm", "cd", "chaos", "ci", "code",
	"core", "fme", "har", "idp", "sei", "ssca", "sto",
}

var validVerbs = []string{
	"get", "list", "create", "update", "delete",
	"fetch", "search", "run", "execute", "trigger",
	"enable", "disable", "add", "set", "check",
	"download", "upload", "validate", "report", "override",
	"invite", "revoke",
}

const maxToolNameLength = 64

// snakeCasePattern enforces: starts with letter, single underscores between segments, no trailing underscore
var snakeCasePattern = regexp.MustCompile(`^[a-z][a-z0-9]*(_[a-z0-9]+)*$`)

func validateToolName(name string) error {
	if name == "" {
		return fmt.Errorf("tool name cannot be empty")
	}

	if len(name) > maxToolNameLength {
		return fmt.Errorf("tool name '%s' exceeds %d character limit (has %d)",
			name, maxToolNameLength, len(name))
	}

	if !snakeCasePattern.MatchString(name) {
		return fmt.Errorf("tool name '%s' must be snake_case (lowercase, numbers, single underscores)", name)
	}

	if err := validateModuleVerbPattern(name); err != nil {
		return err
	}

	return nil
}

// validateModuleVerbPattern checks for {module}_{verb}_{noun} pattern.
func validateModuleVerbPattern(name string) error {
	parts := strings.Split(name, "_")
	if len(parts) < 3 {
		return fmt.Errorf("tool name '%s' must follow {module}_{verb}_{noun} pattern", name)
	}

	module := parts[0]
	verb := parts[1]

	if !isValidModule(module) {
		return fmt.Errorf("tool name '%s' has invalid module '%s' (valid: %s)",
			name, module, strings.Join(validModules, ", "))
	}

	if !isValidVerb(verb) {
		return fmt.Errorf("tool name '%s' has invalid verb '%s' (valid: %s)",
			name, verb, strings.Join(validVerbs, ", "))
	}

	return nil
}

func isValidModule(s string) bool {
	for _, m := range validModules {
		if s == m {
			return true
		}
	}
	return false
}

func isValidVerb(s string) bool {
	for _, v := range validVerbs {
		if s == v {
			return true
		}
	}
	return false
}

// ValidateTools validates all tool names and returns validation errors.
func ValidateTools(tools []mcp.Tool) []error {
	var errs []error
	for _, tool := range tools {
		if err := validateToolName(tool.Name); err != nil {
			errs = append(errs, err)
		}
	}
	return errs
}
