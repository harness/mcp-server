package tools

import (
	"context"
	"encoding/json"
	"testing"

	config "github.com/harness/mcp-server/common"
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

	validEventJSONText = `{"type":"perspective_rules_updated","continue":true,"content":{"viewRules":[{"viewConditions":[{"type":"VIEW_ID_CONDITION","viewField":{"fieldId":"awsUsageaccountid","fieldName":"Account","identifier":"AWS","identifierName":"AWS"},"viewOperator":"IN","values":["test(test_id)"]}]}]}}`

	validPromptJSONText = `{"type":"prompt","continue":true,"display_order":100,"content":{"prompts":["Proceed to save perspective"]}}`

	validExpectedTextContent = mcp.EmbeddedResource{
		Type: "resource",
		Resource: &mcp.TextResourceContents{
			URI:      "harness:custom-event",
			MIMEType: "application/vnd.harness.custom-event+json",
			Text:     validEventJSONText,
		},
	}

	validExpectedPromptContent = mcp.EmbeddedResource{
		Type: "resource",
		Resource: &mcp.TextResourceContents{
			URI:      "harness:custom-event",
			MIMEType: "application/vnd.harness.custom-event+json",
			Text:     validPromptJSONText,
		},
	}

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
)

// TestGetCcmPerspectiveRulesTool tests the basic functionality of the perspective rules tool
func TestGetCcmPerspectiveRulesTool(t *testing.T) {

	testCases := []struct {
		name                  string
		input                 string
		expectedContent       mcp.EmbeddedResource
		expectedPromptContent mcp.EmbeddedResource
		expectError           bool
	}{
		{
			name:                  "Valid Json Input Tests",
			input:                 validInputJSON,
			expectedContent:       validExpectedTextContent,
			expectedPromptContent: validExpectedPromptContent,
			expectError:           false,
		},
		{
			name:        "Invalid Json Input Tests",
			input:       invalidInputJSON,
			expectError: true,
		},
	}
	// Create a config for testing
	testConfig := &config.McpServerConfig{}

	// Get the tool and handler
	tool, handler := GetCcmPerspectiveRulesTool(testConfig)
	assert.Equal(t, CCMPerspectiveRulesToolID, tool.Name, "Tool should have correct name")
	assert.NotEmpty(t, tool.Description, "Tool should have a description")
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Create a mock request with the input JSON

			// Parse input JSON for the request
			var viewRulesArray []any
			err := json.Unmarshal([]byte(tc.input), &viewRulesArray)
			if tc.expectError {
				assert.Error(t, err, "Should parse input JSON with error")
				return
			} else {
				assert.NoError(t, err, "Should parse input JSON without error")
			}

			// Create a valid CallToolRequest for get_ccm_perspective_rules tool
			request := mcp.CallToolRequest{
				Request: mcp.Request{
					Method: CCMPerspectiveRulesToolID,
				},
				Params: mcp.CallToolParams{
					Name: CCMPerspectiveRulesToolID,
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
			assert.Equal(t, len(result.Content), 2, "Result should have only two content")
			actualContent, ok := result.Content[0].(mcp.EmbeddedResource)
			if !ok {
				t.Fatalf("Expected result.Content[0] to be EmbeddedResource, got %T", result.Content[0])
			}

			actualPromptContent, k := result.Content[1].(mcp.EmbeddedResource)
			if !k {
				t.Fatalf("Expected result.Content[1] to be EmbeddedResource, got %T", result.Content[1])
			}

			if !tc.expectError {
				assert.Equal(t, tc.expectedContent, actualContent, "Result should match expected content")
				assert.Equal(t, tc.expectedPromptContent, actualPromptContent, "Result should match expected prompt content")
			} else {
				assert.Error(t, err, "Should parse actual result JSON with error")
			}

		})
	}
}
