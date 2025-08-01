package tools

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
)

var (
	// Define the input JSON for perspective rules
	validInputJSON = `[
		{
			"view_conditions": [
				{
					"type": "VIEW_ID_CONDITION",
					"view_field": {
						"field_id": "awsUsageaccountid",
						"field_name": "Account",
						"identifier": "AWS",
						"identifier_name": "AWS"
					},
					"view_operator": "IN",
					"values": ["test(test_id)"]
				}
			]
		}
	]`

	// Define the expected output structure
	validExpectedOutput = `{
				"entity_info": {
					"entity_type": "get_ccm_perspective_rules"
				},
				"type": "perspective_rules_updated",
				"viewRules": [
					{
						"viewConditions": [
							{
								"type": "VIEW_ID_CONDITION",
								"viewField": {
									"fieldId": "awsUsageaccountid",
									"fieldName": "Account",
									"identifier": "AWS",
									"identifierName": "AWS"
								},
								"viewOperator": "IN",
								"values": [
									"test(test_id)"
									]
							}
						]
					}
				]
			}`
		// Define the input JSON for perspective rules
	invalidInputJSON = `[{{
			"view_conditions": [
				{
					"type": "VIEW_ID_CONDITION",
					"view_field": {
						"field_id": "awsUsageaccountid",
						"field_name": "Account",
						"identifier": "AWS",
						"identifier_name": "AWS"
					},
					"view_operator": "IN",
					"values": ["test(test_id)"]
				}
			]
	}}]`

invalidExpectedOutput = `{
	"entity_info": {
		"entity_type": "get_ccm_perspective_rules"
	}
}`
	
)

// TestGetCcmPerspectiveRulesTool tests the basic functionality of the perspective rules tool
func TestGetCcmPerspectiveRulesTool(t *testing.T) {

	testCases := []struct {
		name     string
		input    string
		expected string
		harError bool
	}{
		{
			name:     "Valid Json Input Tests",
			input:    validInputJSON,
			expected: validExpectedOutput,
			harError: false,
		},
		{
			name:     "Invalid Json Input Tests",
			input:    invalidInputJSON,
			expected: invalidExpectedOutput,
			harError: true,
		},
	}
	// Create a config for testing
	testConfig := &config.Config{}

	// Get the tool and handler
	tool, handler := GetCcmPerspectiveRulesTool(testConfig)
	assert.Equal(t, "get_ccm_perspective_rules", tool.Name, "Tool should have correct name")
	assert.NotEmpty(t, tool.Description, "Tool should have a description")
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a mock request with the input JSON

			// Parse input JSON for the request
			var viewRulesArray []any
			err := json.Unmarshal([]byte(tc.input), &viewRulesArray)
			if tc.harError {
				assert.Error(t, err, "Should parse input JSON with error")
				return
			} else {
				assert.NoError(t, err, "Should parse input JSON without error")
			}

			// Create a valid CallToolRequest for get_ccm_perspective_rules tool
			request := mcp.CallToolRequest{
				Request: mcp.Request{
					Method: "get_ccm_perspective_rules",
				},
				Params: mcp.CallToolParams{
					Name: "get_ccm_perspective_rules",
					Arguments: map[string]any{
						"view_rules": viewRulesArray,
					},
				},
			}

			// Call the handler
			result, err := handler(context.Background(), request)
			assert.NoError(t, err, "Should call handler without error")

			// Verify the result
			assert.NotNil(t, result.Content[0], "Result should not be nil")

			//assert.Equal(t, tc.expected, result.Content[0], "Result should match expected output")

			// Unmarshal both expected and actual JSON into comparable structures
			var expectedJson map[string]any
			var actualJson map[string]any

			err = json.Unmarshal([]byte(tc.expected), &expectedJson)
			assert.NoError(t, err, "Should parse expected JSON without error")

			//Extract text content from the result
			textContent, ok := result.Content[0].(mcp.TextContent)
			if !ok {
				t.Fatalf("Expected result.Content[0] to be TextContent, got %T", result.Content[0])
			}

			err = json.Unmarshal([]byte(textContent.Text), &actualJson)
			if !tc.harError {
				assert.NoError(t, err, "Should parse actual result JSON without error")
				assert.Equal(t, expectedJson, actualJson, "Result should match expected output")
			} else {
				assert.Error(t, err, "Should parse actual result JSON with error")
				assert.Nil(t, actualJson, "Result should be nil")
			}

		})
	}
}
