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

func TestTranslateToCostCategoriesCostTargetsTool(t *testing.T) {
	// Setup
	cfg := &config.McpServerConfig{
		AccountID: "test-account-123",
	}
	mockClient := &client.CloudCostManagementService{}
	// Create the tool
	tool, handler := TranslateToCostCategoriesCostTargetsTool(cfg, mockClient)
	t.Run("Tool Creation", func(t *testing.T) {
		assert.NotNil(t, tool, "Tool should not be nil")
		assert.NotNil(t, handler, "Handler should not be nil")
		assert.Equal(t, "translate_to_ccm_cost_categories_cost_targets", tool.Name, "Tool name should match")
		assert.NotEmpty(t, tool.Description, "Tool should have a description")
	})
	t.Run("Valid Cost Target Groupings - Single Group", func(t *testing.T) {
		ctx := context.Background()
		request := mcp.CallToolRequest{}
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title":  "Production Environments",
						"keys":   []string{"environment"},
						"values": []string{"prod", "production"},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title":  "Production Environments",
						"keys":   []string{"environment"},
						"values": []string{"prod", "production"},
					},
					map[string]interface{}{
						"title":  "Development Environments",
						"keys":   []string{"environment"},
						"values": []string{"dev", "development"},
					},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title":  "Multi-Key Target",
						"keys":   []string{"environment", "team"},
						"values": []string{"prod", "backend"},
					},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						// Missing title
						"keys":   []string{"environment"},
						"values": []string{"prod"},
					},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title": "Production",
						// Missing keys
						"values": []string{"prod"},
					},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title": "Production",
						"keys":  []string{"environment"},
						// Missing values
					},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{},
			},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title":  "Test Environment",
						"keys":   []string{"env"},
						"values": []string{"test1", "test2", "test3"},
					},
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
		request.Params.Name = "translate_to_ccm_cost_categories_cost_targets"
		request.Params.Arguments = map[string]interface{}{
			"cost_target_groupings": map[string]interface{}{
				"cost_target_groupings": []interface{}{
					map[string]interface{}{
						"title":  "Staging",
						"keys":   []string{"env"},
						"values": []string{"staging"},
					},
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
