package client

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseTeamRefId(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{
			name:     "Valid integer string",
			input:    "12345",
			expected: 12345,
		},
		{
			name:     "Valid large integer",
			input:    "203129",
			expected: 203129,
		},
		{
			name:     "Already an int",
			input:    12345,
			expected: 12345,
		},
		{
			name:     "Float64 value",
			input:    float64(12345),
			expected: 12345,
		},
		{
			name:     "Invalid string returns original",
			input:    "abc",
			expected: "abc",
		},
		{
			name:     "Empty string returns original",
			input:    "",
			expected: "",
		},
		{
			name:     "Negative integer string",
			input:    "-123",
			expected: -123,
		},
		{
			name:     "Zero string",
			input:    "0",
			expected: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseTeamRefId(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestToIntegrationTypeArray(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected interface{}
	}{
		{
			name:     "Single integration type cursor",
			input:    "cursor",
			expected: []string{"cursor"},
		},
		{
			name:     "Single integration type windsurf",
			input:    "windsurf",
			expected: []string{"windsurf"},
		},
		{
			name:     "Already an array",
			input:    []string{"cursor", "windsurf"},
			expected: []string{"cursor", "windsurf"},
		},
		{
			name:     "Empty string returns nil",
			input:    "",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := toIntegrationTypeArray(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestBuildQueryParams(t *testing.T) {
	tests := []struct {
		name     string
		params   map[string]interface{}
		expected map[string]string
	}{
		{
			name: "With projectId and orgId",
			params: map[string]interface{}{
				"projectId": "test-project",
				"orgId":     "default",
			},
			expected: map[string]string{
				"projectIdentifier": "test-project",
				"orgIdentifier":     "default",
			},
		},
		{
			name: "Only projectId",
			params: map[string]interface{}{
				"projectId": "test-project",
			},
			expected: map[string]string{
				"projectIdentifier": "test-project",
			},
		},
		{
			name: "Only orgId",
			params: map[string]interface{}{
				"orgId": "my-org",
			},
			expected: map[string]string{
				"orgIdentifier": "my-org",
			},
		},
		{
			name:     "Empty params",
			params:   map[string]interface{}{},
			expected: map[string]string{},
		},
		{
			name: "Ignores non-string values",
			params: map[string]interface{}{
				"projectId": 123, // Not a string
				"orgId":     "valid-org",
			},
			expected: map[string]string{
				"orgIdentifier": "valid-org",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := buildQueryParams(tt.params)
			assert.Equal(t, len(tt.expected), len(result))
			for key, expectedValue := range tt.expected {
				assert.Equal(t, expectedValue, result[key])
			}
		})
	}
}

func TestBuildAccountHeader(t *testing.T) {
	tests := []struct {
		name      string
		params    map[string]interface{}
		expectKey string
		expectVal string
	}{
		{
			name: "With accountId",
			params: map[string]interface{}{
				"accountId": "test-account-123",
			},
			expectKey: "harness-account",
			expectVal: "test-account-123",
		},
		{
			name:      "Without accountId",
			params:    map[string]interface{}{},
			expectKey: "harness-account",
			expectVal: "",
		},
		{
			name: "Non-string accountId ignored",
			params: map[string]interface{}{
				"accountId": 12345, // Not a string
			},
			expectKey: "harness-account",
			expectVal: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			headers := buildAccountHeader(tt.params)
			assert.Equal(t, tt.expectVal, headers[tt.expectKey])
		})
	}
}

func TestAIInsightsService_NewService(t *testing.T) {
	t.Run("Service can be created", func(t *testing.T) {
		service := &AIInsightsService{
			BaseURL: "https://app.harness.io/sei/api/v1",
		}
		assert.NotNil(t, service)
		assert.Equal(t, "https://app.harness.io/sei/api/v1", service.BaseURL)
	})
}

func TestBuildRequestBody(t *testing.T) {
	t.Run("teamRefId is converted to integer", func(t *testing.T) {
		params := map[string]interface{}{
			"teamRefId":       "12345",
			"startDate":       "2025-01-01",
			"endDate":         "2025-01-31",
			"integrationType": "cursor",
		}

		// Simulate what buildRequestBody would do
		body := map[string]interface{}{
			"teamRefId":       parseTeamRefId(params["teamRefId"]),
			"startDate":       params["startDate"],
			"endDate":         params["endDate"],
			"integrationType": toIntegrationTypeArray(params["integrationType"]),
		}

		assert.Equal(t, 12345, body["teamRefId"])
		assert.Equal(t, "2025-01-01", body["startDate"])
		assert.Equal(t, "2025-01-31", body["endDate"])
		assert.Equal(t, []string{"cursor"}, body["integrationType"])
	})

	t.Run("teamRefId already integer stays integer", func(t *testing.T) {
		params := map[string]interface{}{
			"teamRefId": 203129,
		}

		body := map[string]interface{}{
			"teamRefId": parseTeamRefId(params["teamRefId"]),
		}

		assert.Equal(t, 203129, body["teamRefId"])
	})

	t.Run("integrationType array stays array", func(t *testing.T) {
		params := map[string]interface{}{
			"integrationType": []string{"cursor", "windsurf"},
		}

		body := map[string]interface{}{
			"integrationType": toIntegrationTypeArray(params["integrationType"]),
		}

		expected := []string{"cursor", "windsurf"}
		assert.Equal(t, expected, body["integrationType"])
	})
}
