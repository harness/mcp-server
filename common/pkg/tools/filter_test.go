package tools

import (
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
)

func makeCallToolRequest(args map[string]any) mcp.CallToolRequest {
	req := mcp.CallToolRequest{}
	req.Params.Name = "test_tool"
	req.Params.Arguments = args
	return req
}

func TestNormalizeArrayParam(t *testing.T) {
	tests := []struct {
		name     string
		key      string
		args     map[string]any
		expected any
	}{
		{
			name:     "plain string CIS becomes array",
			key:      "standards",
			args:     map[string]any{"standards": "CIS"},
			expected: `["CIS"]`,
		},
		{
			name:     "plain string OWASP becomes array",
			key:      "standards",
			args:     map[string]any{"standards": "OWASP"},
			expected: `["OWASP"]`,
		},
		{
			name:     "already array format unchanged",
			key:      "standards",
			args:     map[string]any{"standards": `["CIS"]`},
			expected: `["CIS"]`,
		},
		{
			name:     "multi-element array unchanged",
			key:      "standards",
			args:     map[string]any{"standards": `["CIS", "OWASP"]`},
			expected: `["CIS", "OWASP"]`,
		},
		{
			name:     "missing key is no-op",
			key:      "standards",
			args:     map[string]any{"other": "value"},
			expected: nil,
		},
		{
			name:     "empty string is no-op",
			key:      "standards",
			args:     map[string]any{"standards": ""},
			expected: "",
		},
		{
			name:     "non-string value is no-op",
			key:      "standards",
			args:     map[string]any{"standards": []string{"CIS"}},
			expected: []string{"CIS"},
		},
		{
			name:     "string with whitespace trimmed",
			key:      "standards",
			args:     map[string]any{"standards": "  CIS  "},
			expected: `["CIS"]`,
		},
		{
			name:     "works for status param too",
			key:      "status",
			args:     map[string]any{"status": "FAIL"},
			expected: `["FAIL"]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := makeCallToolRequest(tt.args)
			normalizeArrayParam(req, tt.key)

			val, exists := req.GetArguments()[tt.key]
			if tt.expected == nil {
				assert.False(t, exists, "key should not exist")
			} else {
				assert.Equal(t, tt.expected, val)
			}
		})
	}
}
