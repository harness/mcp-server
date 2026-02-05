package tools

import (
	"context"
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
)

// mockAIInsightsClient creates a mock AIInsightsService for testing
func mockAIInsightsClient() *client.AIInsightsService {
	return &client.AIInsightsService{}
}

func TestGetAIUsageMetricsTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIUsageMetricsTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_usage_metrics", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "AI coding assistant")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_usage_metrics",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIUsageSummaryTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIUsageSummaryTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_usage_summary", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "summary statistics")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_usage_summary",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIUsageBreakdownTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIUsageBreakdownTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_usage_breakdown", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "breakdown")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_usage_breakdown",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIAdoptionsTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIAdoptionsTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_adoptions", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "adoption")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_adoptions",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIAdoptionsSummaryTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIAdoptionsSummaryTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_adoptions_summary", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "current vs previous")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_adoptions_summary",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIAdoptionsBreakdownTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIAdoptionsBreakdownTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_adoptions_breakdown", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "child teams")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_adoptions_breakdown",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAITopLanguagesTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAITopLanguagesTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_top_languages", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "languages")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_top_languages",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIRawMetricsTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIRawMetricsTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_raw_metrics", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "per-developer")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_raw_metrics",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIRawMetricsV2Tool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIRawMetricsV2Tool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_raw_metrics_v2", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "v2")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_raw_metrics_v2",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIPRVelocitySummaryTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIPRVelocitySummaryTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_pr_velocity_summary", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "PR velocity")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_pr_velocity_summary",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetAIReworkSummaryTool(t *testing.T) {
	testConfig := &config.McpServerConfig{}
	mockClient := mockAIInsightsClient()

	tool, handler := GetAIReworkSummaryTool(testConfig, mockClient)

	t.Run("Tool has correct name", func(t *testing.T) {
		assert.Equal(t, "sei_get_ai_rework_summary", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "rework")
	})

	t.Run("Handler exists", func(t *testing.T) {
		assert.NotNil(t, handler)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "sei_get_ai_rework_summary",
				Arguments: map[string]any{},
			},
		}

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})
}
