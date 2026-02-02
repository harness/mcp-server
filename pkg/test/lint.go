package test

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
)

// Tool name validation rules:
//   - Non-empty, max 64 characters (MCP spec)
//   - snake_case only (lowercase, numbers, single underscores)
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

const maxNameLength = 64

var namePattern *regexp.Regexp

func init() {
	moduleRegExpr := strings.Join(validModules, "|")
	verbRegExpr := strings.Join(validVerbs, "|")

	// Pattern: {module}_{verb}_{noun} where noun is one or more snake_case segments
	pattern := fmt.Sprintf(`^(%s)_(%s)_[a-z0-9]+(_[a-z0-9]+)*$`, moduleRegExpr, verbRegExpr)
	namePattern = regexp.MustCompile(pattern)
}

func validateToolName(name string) error {
	if name == "" {
		return fmt.Errorf("tool name cannot be empty")
	}

	if len(name) > maxNameLength {
		return fmt.Errorf("tool name '%s' exceeds %d character limit (has %d)",
			name, maxNameLength, len(name))
	}

	if !namePattern.MatchString(name) {
		return fmt.Errorf(
			"tool name '%s' must follow {module}_{verb}_{noun} pattern (modules: %s)",
			name, strings.Join(validModules, ", "))
	}

	return nil
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
