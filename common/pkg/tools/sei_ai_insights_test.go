package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
)

// testAuthProvider for testing
type testAuthProvider struct{}

func (m testAuthProvider) GetHeader(ctx context.Context) (string, string, error) {
	return "Authorization", "Bearer test-token", nil
}

// createMockServer creates a mock HTTP server that returns success
func createMockServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"data":    []interface{}{},
		})
	}))
}

// createTestAIClient creates an AIInsightsService with a mock server
func createTestAIClient(serverURL string) *client.AIInsightsService {
	baseClient, _ := client.NewWithAuthProvider(serverURL, testAuthProvider{}, "test")

	return &client.AIInsightsService{
		Client:  baseClient,
		BaseURL: serverURL,
	}
}

// createTestConfig creates a test config
func createTestConfig() *config.McpServerConfig {
	return &config.McpServerConfig{
		AccountID:        "test-account",
		DefaultOrgID:     "default",
		DefaultProjectID: "test-project",
	}
}

// createFullRequest creates a request with all required parameters
func createFullRequest(toolName string, extraArgs map[string]any) mcp.CallToolRequest {
	args := map[string]any{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"org_id":          "default",
		"project_id":      "test-project",
	}
	for k, v := range extraArgs {
		args[k] = v
	}
	return mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name:      toolName,
			Arguments: args,
		},
	}
}

// ===== Tests for Helper Functions =====

func TestAIBaseParamsToParamsMap(t *testing.T) {
	params := &aiBaseParams{
		AccountID:       "acc-123",
		TeamRefID:       "team-456",
		StartDate:       "2025-01-01",
		EndDate:         "2025-01-31",
		IntegrationType: "cursor",
		ProjectID:       "proj-789",
		OrgID:           "org-abc",
	}

	result := params.toParamsMap()

	assert.Equal(t, "acc-123", result["accountId"])
	assert.Equal(t, "team-456", result["teamRefId"])
	assert.Equal(t, "2025-01-01", result["startDate"])
	assert.Equal(t, "2025-01-31", result["endDate"])
	assert.Equal(t, "cursor", result["integrationType"])
	assert.Equal(t, "proj-789", result["projectId"])
	assert.Equal(t, "org-abc", result["orgId"])
}

func TestMarshalResult(t *testing.T) {
	t.Run("Success case", func(t *testing.T) {
		data := map[string]interface{}{"key": "value"}
		result, err := marshalResult(data)
		assert.Nil(t, err)
		assert.NotNil(t, result)
		assert.False(t, result.IsError)
	})
}

func TestWithCommonAIToolOptions(t *testing.T) {
	cfg := createTestConfig()
	opts := withCommonAIToolOptions(cfg)
	assert.NotEmpty(t, opts)
	// Should have at least 6 options: annotation, scope, accountId, teamRefId, startDate, endDate, integrationType
	assert.GreaterOrEqual(t, len(opts), 6)
}

func TestExtractPaginationParams(t *testing.T) {
	t.Run("Extracts all pagination params", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "test_tool",
				Arguments: map[string]any{
					"type":     "acceptance_rate",
					"page":     float64(2),
					"pageSize": float64(25),
				},
			},
		}

		params := map[string]interface{}{}
		extractPaginationParams(request, params)

		assert.Equal(t, "acceptance_rate", params["type"])
		assert.Equal(t, 2, params["page"])
		assert.Equal(t, 25, params["pageSize"])
	})

	t.Run("Handles missing params", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name:      "test_tool",
				Arguments: map[string]any{},
			},
		}

		params := map[string]interface{}{}
		extractPaginationParams(request, params)

		_, hasType := params["type"]
		_, hasPage := params["page"]
		_, hasPageSize := params["pageSize"]

		assert.False(t, hasType)
		assert.False(t, hasPage)
		assert.False(t, hasPageSize)
	})

	t.Run("Handles empty type string", func(t *testing.T) {
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "test_tool",
				Arguments: map[string]any{
					"type": "",
				},
			},
		}

		params := map[string]interface{}{}
		extractPaginationParams(request, params)

		_, hasType := params["type"]
		assert.False(t, hasType, "Empty type should not be added to params")
	})
}

func TestRawMetricsPaginationOptions(t *testing.T) {
	opts := rawMetricsPaginationOptions()
	assert.NotEmpty(t, opts)
	// Should have exactly 3 options: type, page, pageSize
	assert.Equal(t, 3, len(opts))
}

func TestGetAIUsageMetricsTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIUsageMetricsTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_usage_metrics", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		tool, _ := GetAIUsageMetricsTool(testConfig, nil)
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "AI coding assistant")
	})

	t.Run("Missing accountId returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_metrics",
				Arguments: map[string]any{
					"accountId": "test-account",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_metrics",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_metrics",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_metrics",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing granularity returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_metrics",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing metricType returns error", func(t *testing.T) {
		_, handler := GetAIUsageMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_metrics",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
					"granularity":     "WEEKLY",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIUsageMetricsTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_usage_metrics", map[string]any{
			"granularity": "WEEKLY",
			"metricType":  "linesAccepted",
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIUsageSummaryTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIUsageSummaryTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_usage_summary", tool.Name)
	})

	t.Run("Tool has description", func(t *testing.T) {
		tool, _ := GetAIUsageSummaryTool(testConfig, nil)
		assert.NotEmpty(t, tool.Description)
		assert.Contains(t, tool.Description, "summary statistics")
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIUsageSummaryTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIUsageSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIUsageSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIUsageSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIUsageSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_summary",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIUsageSummaryTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_usage_summary", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIUsageBreakdownTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIUsageBreakdownTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_usage_breakdown", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIUsageBreakdownTool(testConfig, nil)
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

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIUsageBreakdownTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_usage_breakdown",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIUsageBreakdownTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_usage_breakdown", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Full request with optional params succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIUsageBreakdownTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_usage_breakdown", map[string]any{
			"granularity": "WEEKLY",
			"metricType":  "linesAccepted",
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIAdoptionsTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIAdoptionsTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_adoptions", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"granularity":     "WEEKLY",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"granularity":     "WEEKLY",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"granularity":     "WEEKLY",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing granularity returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions",
				Arguments: map[string]any{
					"accountId":   "test-account",
					"teamRefId":   "12345",
					"startDate":   "2025-01-01",
					"endDate":     "2025-01-31",
					"granularity": "WEEKLY",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIAdoptionsTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_adoptions", map[string]any{
			"granularity": "WEEKLY",
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIAdoptionsSummaryTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIAdoptionsSummaryTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_adoptions_summary", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsSummaryTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_summary",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIAdoptionsSummaryTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_adoptions_summary", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIAdoptionsBreakdownTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIAdoptionsBreakdownTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_adoptions_breakdown", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsBreakdownTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsBreakdownTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_breakdown",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsBreakdownTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_breakdown",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsBreakdownTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_breakdown",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIAdoptionsBreakdownTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_adoptions_breakdown",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIAdoptionsBreakdownTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_adoptions_breakdown", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAITopLanguagesTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAITopLanguagesTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_top_languages", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAITopLanguagesTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAITopLanguagesTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_top_languages",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAITopLanguagesTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_top_languages",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAITopLanguagesTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_top_languages",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAITopLanguagesTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_top_languages",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAITopLanguagesTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_top_languages", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIRawMetricsTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIRawMetricsTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_raw_metrics", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIRawMetricsTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_raw_metrics", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Full request with optional params succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIRawMetricsTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_raw_metrics", map[string]any{
			"type":     "acceptance_rate",
			"page":     float64(0),
			"pageSize": float64(10),
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIRawMetricsV2Tool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIRawMetricsV2Tool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_raw_metrics_v2", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsV2Tool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsV2Tool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics_v2",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsV2Tool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics_v2",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsV2Tool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics_v2",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIRawMetricsV2Tool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_raw_metrics_v2",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIRawMetricsV2Tool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_raw_metrics_v2", nil)

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Full request with optional params succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIRawMetricsV2Tool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_raw_metrics_v2", map[string]any{
			"type":     "acceptance_rate",
			"page":     float64(0),
			"pageSize": float64(10),
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIPRVelocitySummaryTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIPRVelocitySummaryTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_pr_velocity_summary", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIPRVelocitySummaryTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIPRVelocitySummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_pr_velocity_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIPRVelocitySummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_pr_velocity_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIPRVelocitySummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_pr_velocity_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIPRVelocitySummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_pr_velocity_summary",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing granularity returns error", func(t *testing.T) {
		_, handler := GetAIPRVelocitySummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_pr_velocity_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIPRVelocitySummaryTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_pr_velocity_summary", map[string]any{
			"granularity": "MONTHLY",
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAIReworkSummaryTool(t *testing.T) {
	testConfig := createTestConfig()

	t.Run("Tool has correct name", func(t *testing.T) {
		tool, _ := GetAIReworkSummaryTool(testConfig, nil)
		assert.Equal(t, "sei_get_ai_rework_summary", tool.Name)
	})

	t.Run("Missing required parameter returns error", func(t *testing.T) {
		_, handler := GetAIReworkSummaryTool(testConfig, nil)
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

	t.Run("Missing teamRefId returns error", func(t *testing.T) {
		_, handler := GetAIReworkSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_rework_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing startDate returns error", func(t *testing.T) {
		_, handler := GetAIReworkSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_rework_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing endDate returns error", func(t *testing.T) {
		_, handler := GetAIReworkSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_rework_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing integrationType returns error", func(t *testing.T) {
		_, handler := GetAIReworkSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_rework_summary",
				Arguments: map[string]any{
					"accountId": "test-account",
					"teamRefId": "12345",
					"startDate": "2025-01-01",
					"endDate":   "2025-01-31",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing granularity returns error", func(t *testing.T) {
		_, handler := GetAIReworkSummaryTool(testConfig, nil)
		request := mcp.CallToolRequest{
			Params: mcp.CallToolParams{
				Name: "sei_get_ai_rework_summary",
				Arguments: map[string]any{
					"accountId":       "test-account",
					"teamRefId":       "12345",
					"startDate":       "2025-01-01",
					"endDate":         "2025-01-31",
					"integrationType": "cursor",
				},
			},
		}
		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full request with mock server succeeds", func(t *testing.T) {
		server := createMockServer()
		defer server.Close()

		mockClient := createTestAIClient(server.URL)
		_, handler := GetAIReworkSummaryTool(testConfig, mockClient)

		request := createFullRequest("sei_get_ai_rework_summary", map[string]any{
			"granularity": "WEEKLY",
		})

		result, err := handler(context.Background(), request)
		assert.Nil(t, err)
		assert.False(t, result.IsError)
	})
}
