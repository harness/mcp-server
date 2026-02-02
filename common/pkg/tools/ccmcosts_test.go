package tools

import (
	"context"
	"encoding/json"
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/harness/mcp-server/common/pkg/event"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCreateCostCategoriesCostTargetsEventTool(t *testing.T) {
	// Setup
	cfg := &config.McpServerConfig{
		AccountID: "test-account-123",
	}
	mockClient := &client.CloudCostManagementService{}
	// Create the tool
	tool, handler := CreateCostCategoriesCostTargetsEventTool(cfg, mockClient)
	t.Run("Tool Creation", func(t *testing.T) {
		assert.NotNil(t, tool, "Tool should not be nil")
		assert.NotNil(t, handler, "Handler should not be nil")
		assert.Equal(t, "ccm_create_cost_categories_cost_targets_event", tool.Name, "Tool name should match")
		assert.NotEmpty(t, tool.Description, "Tool should have a description")
	})
	t.Run("Valid Cost Target Groupings - Single Group", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title":  "Production Environments",
					"keys":   []interface{}{"environment"},
					"values": []interface{}{"prod", "production"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		require.NotEmpty(t, result.Content, "Result content should not be empty")

		// Verify the event was created as embedded resource
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource, got %T: %+v", result.Content[0], result.Content[0])
		// Get the text resource contents
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content, got %T", embeddedResource.Resource)
		// Parse the event data
		var eventData event.CustomEvent
		err = json.Unmarshal([]byte(textResource.Text), &eventData)
		require.NoError(t, err, "Should be able to parse event data")
		assert.Equal(t, CCMCostCategoryCostTargetsEventType, eventData.Type, "Event type should match")
		// Parse the response data
		var costTargets []dto.CCMCostTarget
		dataBytes, _ := json.Marshal(eventData.Content)
		err = json.Unmarshal(dataBytes, &costTargets)
		require.NoError(t, err, "Should be able to parse cost targets")
		assert.Len(t, costTargets, 1, "Should have one cost target")
		assert.Equal(t, "Production Environments", costTargets[0].Name, "Cost target name should match")
		assert.Len(t, costTargets[0].Rules, 1, "Should have one rule")
		// Verify the rule structure
		rule := costTargets[0].Rules[0]
		assert.NotNil(t, rule.ViewConditions, "Rule should have view conditions")
		assert.Len(t, rule.ViewConditions, 1, "Rule should have one condition")
	})
	t.Run("Valid Cost Target Groupings - Multiple Groups", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		// Direct array format (MCP Inspector)
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title":  "Production Environments",
					"keys":   []interface{}{"environment"},
					"values": []interface{}{"prod", "production"},
				},
				map[string]interface{}{
					"title":  "Development Environments",
					"keys":   []interface{}{"environment"},
					"values": []interface{}{"dev", "development"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		// Parse and verify multiple cost targets
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")
		var eventData event.CustomEvent
		json.Unmarshal([]byte(textResource.Text), &eventData)
		var costTargets []dto.CCMCostTarget
		dataBytes, _ := json.Marshal(eventData.Content)
		json.Unmarshal(dataBytes, &costTargets)
		assert.Len(t, costTargets, 2, "Should have two cost targets")
		assert.Equal(t, "Production Environments", costTargets[0].Name)
		assert.Equal(t, "Development Environments", costTargets[1].Name)
	})
	t.Run("Valid Cost Target Groupings - Multiple Keys", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title":  "Multi-Key Target",
					"keys":   []interface{}{"environment", "team"},
					"values": []interface{}{"prod", "backend"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		// Parse and verify rules for multiple keys
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")
		var eventData event.CustomEvent
		json.Unmarshal([]byte(textResource.Text), &eventData)
		var costTargets []dto.CCMCostTarget
		dataBytes, _ := json.Marshal(eventData.Content)
		json.Unmarshal(dataBytes, &costTargets)
		assert.Len(t, costTargets, 1, "Should have one cost target")
		assert.Len(t, costTargets[0].Rules, 2, "Should have two rules (one per key)")
		// Verify rule structure for both keys
		for i, rule := range costTargets[0].Rules {
			assert.Len(t, rule.ViewConditions, 1, "Each rule should have one condition")
			condition := rule.ViewConditions[0].(map[string]interface{})
			viewField := condition["viewField"].(map[string]interface{})
			assert.Equal(t, "labels.value", viewField["fieldId"], "Field ID should be labels.value")
			assert.Equal(t, "LABEL_V2", viewField["identifier"], "Identifier should be LABEL_V2")
			assert.Equal(t, "IN", condition["viewOperator"], "Operator should be IN")
			expectedFieldName := []string{"environment", "team"}[i]
			assert.Equal(t, expectedFieldName, viewField["fieldName"], "Field name should match key")
		}
	})
	t.Run("Missing cost_target_groupings Parameter", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error")
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "Error extracting cost target groupings")
	})
	t.Run("Invalid Type for cost_target_groupings", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": "invalid-string",
		}
		result, err := handler(ctx, request)
		// Should handle gracefully - either error or skip processing
		require.NoError(t, err, "Handler should not panic")
		require.NotNil(t, result, "Result should not be nil")
	})
	t.Run("Missing Title in Grouping", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					// Missing title
					"keys":   []interface{}{"environment"},
					"values": []interface{}{"prod"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error")
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "Error extracting title")
	})
	t.Run("Missing Keys in Grouping", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title": "Production",
					// Missing keys
					"values": []interface{}{"prod"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error")
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "Error extracting key")
	})
	t.Run("Missing Values in Grouping", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title": "Production",
					"keys":  []interface{}{"environment"},
					// Missing values
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error")
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "Error extracting values")
	})
	t.Run("Empty cost_target_groupings Array", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		// Should return empty response successfully
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")
		var eventData event.CustomEvent
		json.Unmarshal([]byte(textResource.Text), &eventData)
		var costTargets []dto.CCMCostTarget
		dataBytes, _ := json.Marshal(eventData.Content)
		json.Unmarshal(dataBytes, &costTargets)
		assert.Empty(t, costTargets, "Should have no cost targets")
	})
	t.Run("Rule Structure Validation", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title":  "Test Environment",
					"keys":   []interface{}{"env"},
					"values": []interface{}{"test1", "test2", "test3"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		// Parse and verify the rule structure
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")
		var eventData event.CustomEvent
		json.Unmarshal([]byte(textResource.Text), &eventData)
		var costTargets []dto.CCMCostTarget
		dataBytes, _ := json.Marshal(eventData.Content)
		json.Unmarshal(dataBytes, &costTargets)
		assert.Len(t, costTargets, 1)
		rule := costTargets[0].Rules[0]
		condition := rule.ViewConditions[0].(map[string]interface{})
		viewField := condition["viewField"].(map[string]interface{})
		// Verify all required fields
		assert.Equal(t, "labels.value", viewField["fieldId"])
		assert.Equal(t, "env", viewField["fieldName"])
		assert.Equal(t, "LABEL_V2", viewField["identifier"])
		assert.Equal(t, "Label V2", viewField["identifierName"])
		assert.Equal(t, "IN", condition["viewOperator"])
		values := condition["values"].([]interface{})
		var strValues []string
		for _, v := range values {
			strValues = append(strValues, v.(string))
		}
		assert.ElementsMatch(t, []string{"test1", "test2", "test3"}, strValues)
	})
	t.Run("Event Properties Validation", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "ccm_translate_to_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": []interface{}{
				map[string]interface{}{
					"title":  "Staging",
					"keys":   []interface{}{"env"},
					"values": []interface{}{"staging"},
				},
			},
		}
		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		// Verify event properties
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")
		var eventData event.CustomEvent
		json.Unmarshal([]byte(textResource.Text), &eventData)
		assert.Equal(t, CCMCostCategoryCostTargetsEventType, eventData.Type)
		assert.True(t, eventData.Continue, "Event should have Continue set to true")
	})
}

// TestReportCostCategoryKeyValuesEventTool tests the cost category key values event tool
func TestReportCostCategoryKeyValuesEventTool(t *testing.T) {
	// Setup
	cfg := &config.McpServerConfig{
		AccountID: "test-account-123",
	}

	// Create the tool
	tool, handler := ReportCostCategoryKeyValuesEventTool(cfg)

	t.Run("Tool Creation", func(t *testing.T) {
		assert.NotNil(t, tool, "Tool should not be nil")
		assert.NotNil(t, handler, "Handler should not be nil")
		assert.Equal(t, CCMReportCostCategoryKeyValuesToolID, tool.Name, "Tool name should match")
		assert.NotEmpty(t, tool.Description, "Tool should have a description")
	})

	t.Run("Present Checkbox Event - Waits for Response", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data": []interface{}{
				map[string]interface{}{
					"key":        "key1",
					"total_cost": 100.0,
				},
				map[string]interface{}{
					"key":        "key2",
					"total_cost": 200.0,
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		require.NotEmpty(t, result.Content, "Result content should not be empty")
		require.Len(t, result.Content, 1, "Should have exactly one content item")

		// Verify the event was created as embedded resource
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")

		// Get the text resource contents
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")

		// Verify resource format
		assert.Equal(t, "harness:custom-event", textResource.URI, "URI should be harness:custom-event")
		assert.Equal(t, "application/vnd.harness.custom-event+json", textResource.MIMEType, "MIME type should match")

		// Parse the event data
		var eventData event.CustomEvent
		err = json.Unmarshal([]byte(textResource.Text), &eventData)
		require.NoError(t, err, "Should be able to parse event data")

		assert.Equal(t, CCMCostCategoryKeyValuesEventName, eventData.Type, "Event type should match tool ID")
		assert.False(t, eventData.Continue, "present_checkbox should have Continue=false (waits for response)")
		assert.Equal(t, 100, eventData.DisplayOrder, "Display order should be 100")

		// Verify content structure
		content, ok := eventData.Content.(map[string]interface{})
		require.True(t, ok, "Content should be a map")
		assert.Equal(t, CCMEventNamePresentCheckbox, content["ccm_event_name"], "ccm_event_name should match")
		assert.NotNil(t, content["data"], "data should be present")

		// Verify data array length
		data, ok := content["data"].([]interface{})
		require.True(t, ok, "data should be an array")
		assert.Len(t, data, 2, "Should have two data items")
	})

	t.Run("Drop Down List Event - Does Not Wait", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "cost_category_name1",
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "value1",
							"total_cost": 100.0,
						},
						map[string]interface{}{
							"value":      "value2",
							"total_cost": 200.0,
						},
					},
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		require.NotEmpty(t, result.Content, "Result content should not be empty")

		// Verify the event was created as embedded resource
		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")

		// Get the text resource contents
		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")

		// Parse the event data
		var eventData event.CustomEvent
		err = json.Unmarshal([]byte(textResource.Text), &eventData)
		require.NoError(t, err, "Should be able to parse event data")

		assert.Equal(t, CCMCostCategoryKeyValuesEventName, eventData.Type, "Event type should match tool ID")
		assert.True(t, eventData.Continue, "drop_down_list should have Continue=true (does not wait)")
		assert.Equal(t, 100, eventData.DisplayOrder, "Display order should be 100")

		// Verify content structure
		content, ok := eventData.Content.(map[string]interface{})
		require.True(t, ok, "Content should be a map")
		assert.Equal(t, CCMEventNameDropDownList, content["ccm_event_name"], "ccm_event_name should match")
		assert.NotNil(t, content["data"], "data should be present")
	})

	t.Run("Missing ccm_event_name Parameter", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"data": []interface{}{
				map[string]interface{}{
					"key":        "key1",
					"total_cost": 100.0,
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error")
	})

	t.Run("Empty Data Array", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data":           []interface{}{},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for empty data")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "data array cannot be empty")
	})

	t.Run("Missing Data Parameter", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for missing data")
	})

	// Schema Validation Tests
	t.Run("Schema Validation - Checkbox Missing Key Field", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data": []interface{}{
				map[string]interface{}{
					// Missing "key" field
					"total_cost": 100.0,
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for missing key field")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "schema validation failed")
		assert.Contains(t, textContent.Text, "'key' field is required")
	})

	t.Run("Schema Validation - Checkbox Empty Key Field", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data": []interface{}{
				map[string]interface{}{
					"key":        "", // Empty key
					"total_cost": 100.0,
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for empty key field")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "'key' field is required and cannot be empty")
	})

	t.Run("Schema Validation - Dropdown Missing cost_category_name", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					// Missing "cost_category_name"
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "prod",
							"total_cost": 100.0,
						},
					},
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for missing cost_category_name")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "'cost_category_name' field is required")
	})

	t.Run("Schema Validation - Dropdown Empty value_list", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "Environment",
					"value_list":         []interface{}{}, // Empty value_list
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for empty value_list")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "'value_list' must contain at least one value")
	})

	t.Run("Schema Validation - Dropdown Missing Value in value_list", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "Environment",
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "", // Empty value
							"total_cost": 100.0,
						},
					},
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for empty value in value_list")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "'value' field is required and cannot be empty")
	})

	t.Run("Schema Validation - Wrong Schema for Event Type", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList, // Expects dropdown schema
			"data": []interface{}{
				map[string]interface{}{
					// Sending checkbox schema instead
					"key":        "key1",
					"total_cost": 100.0,
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for wrong schema type")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "schema validation failed")
	})

	t.Run("Tool Description Contains Schema Examples", func(t *testing.T) {
		assert.Contains(t, tool.Description, "present_checkbox", "Description should mention present_checkbox")
		assert.Contains(t, tool.Description, "drop_down_list", "Description should mention drop_down_list")
		assert.Contains(t, tool.Description, "key", "Description should contain key field example")
		assert.Contains(t, tool.Description, "total_cost", "Description should contain total_cost field example")
		assert.Contains(t, tool.Description, "cost_category_name", "Description should contain cost_category_name example")
		assert.Contains(t, tool.Description, "value_list", "Description should contain value_list example")
	})

	t.Run("Invalid Event Name", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": "invalid_event_name",
			"data": []interface{}{
				map[string]interface{}{
					"key":        "key1",
					"total_cost": 100.0,
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for invalid event name")
	})

	t.Run("Data Not An Array", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data":           "not-an-array",
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error when data is not an array")
	})

	t.Run("Multiple Items Drop Down List", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "Environment",
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "prod",
							"total_cost": 5000.0,
						},
						map[string]interface{}{
							"value":      "staging",
							"total_cost": 2000.0,
						},
					},
				},
				map[string]interface{}{
					"cost_category_name": "Team",
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "backend",
							"total_cost": 3000.0,
						},
						map[string]interface{}{
							"value":      "frontend",
							"total_cost": 1500.0,
						},
					},
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")

		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")

		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")

		var eventData event.CustomEvent
		err = json.Unmarshal([]byte(textResource.Text), &eventData)
		require.NoError(t, err, "Should be able to parse event data")

		assert.True(t, eventData.Continue, "drop_down_list should continue without waiting")

		content, ok := eventData.Content.(map[string]interface{})
		require.True(t, ok, "Content should be a map")

		data, ok := content["data"].([]interface{})
		require.True(t, ok, "data should be an array")
		assert.Len(t, data, 2, "Should have two cost category data items")
	})

	t.Run("Schema Validation - Checkbox Invalid Total Cost Type", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data": []interface{}{
				map[string]interface{}{
					"key":        "key1",
					"total_cost": "not-a-number", // Invalid type
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for invalid total_cost type")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "schema validation failed")
	})

	t.Run("Schema Validation - Dropdown Invalid Total Cost in Value List", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "Environment",
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "prod",
							"total_cost": "invalid-number", // Invalid type
						},
					},
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for invalid total_cost type")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "schema validation failed")
	})

	t.Run("Schema Validation - Dropdown Missing Value List", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "Environment",
					// Missing value_list
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error for missing value_list")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "schema validation failed")
	})

	t.Run("Schema Validation - Data Item Not A Map", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNamePresentCheckbox,
			"data": []interface{}{
				"not-a-map", // Invalid - should be a map
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")
		assert.True(t, result.IsError, "Result should be an error when data item is not a map")

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "Content should be text content")
		assert.Contains(t, textContent.Text, "schema validation failed")
	})

	t.Run("Drop Down List With Special Characters In Names", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = CCMCostCategoryKeyValuesEventName
		request.Params.Arguments = map[string]interface{}{
			"ccm_event_name": CCMEventNameDropDownList,
			"data": []interface{}{
				map[string]interface{}{
					"cost_category_name": "Environment (US-EAST-1)",
					"value_list": []interface{}{
						map[string]interface{}{
							"value":      "prod-api-v2.0",
							"total_cost": 1234.56,
						},
					},
				},
			},
		}

		result, err := handler(ctx, request)
		require.NoError(t, err, "Handler should not return error")
		require.NotNil(t, result, "Result should not be nil")

		embeddedResource, ok := result.Content[0].(mcp.EmbeddedResource)
		require.True(t, ok, "Content should be an embedded resource")

		textResource, ok := embeddedResource.Resource.(*mcp.TextResourceContents)
		require.True(t, ok, "Resource should be text content")

		var eventData event.CustomEvent
		err = json.Unmarshal([]byte(textResource.Text), &eventData)
		require.NoError(t, err, "Should be able to parse event data")

		assert.True(t, eventData.Continue, "drop_down_list should continue")
		assert.Equal(t, 100, eventData.DisplayOrder)

		// Verify special characters are preserved correctly
		content, ok := eventData.Content.(map[string]interface{})
		require.True(t, ok, "Content should be a map")
		data, ok := content["data"].([]interface{})
		require.True(t, ok, "data should be an array")
		require.Len(t, data, 1, "Should have one cost category")
		category, ok := data[0].(map[string]interface{})
		require.True(t, ok, "Category should be a map")
		assert.Equal(t, "Environment (US-EAST-1)", category["cost_category_name"], "Special characters should be preserved")
		valueList, ok := category["value_list"].([]interface{})
		require.True(t, ok, "value_list should be an array")
		require.Len(t, valueList, 1, "Should have one value")
		value, ok := valueList[0].(map[string]interface{})
		require.True(t, ok, "Value should be a map")
		assert.Equal(t, "prod-api-v2.0", value["value"], "Special characters in value should be preserved")
	})
}
