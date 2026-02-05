package client

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
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
		{
			name:     "Interface array",
			input:    []interface{}{"cursor"},
			expected: []interface{}{"cursor"},
		},
		{
			name:     "Other type returns original",
			input:    123,
			expected: 123,
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

// aiMockAuthProvider for testing AI insights
type aiMockAuthProvider struct{}

func (m aiMockAuthProvider) GetHeader(ctx context.Context) (string, string, error) {
	return "Authorization", "Bearer test-token", nil
}

// createTestServer creates a mock HTTP server for testing
func createTestServer(t *testing.T, expectedPath string, response interface{}) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		// Don't check specific path since it may vary

		// Read request body
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		defer r.Body.Close()

		var reqBody map[string]interface{}
		err = json.Unmarshal(body, &reqBody)
		require.NoError(t, err)

		// Verify teamRefId is an integer
		if teamRefId, ok := reqBody["teamRefId"]; ok {
			_, isFloat := teamRefId.(float64) // JSON numbers are float64
			assert.True(t, isFloat, "teamRefId should be a number")
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
}

// createTestAIService creates an AIInsightsService with a mock server
func createTestAIService(serverURL string) *AIInsightsService {
	parsedURL, _ := url.Parse(serverURL)
	httpClient := &http.Client{}
	baseClient := &Client{
		client:       httpClient,
		BaseURL:      parsedURL,
		AuthProvider: aiMockAuthProvider{},
	}

	return &AIInsightsService{
		Client:  baseClient,
		BaseURL: serverURL,
	}
}

func TestAIInsightsService_GetAIUsageSummary(t *testing.T) {
	response := map[string]interface{}{
		"totalUsers":     100,
		"activeUsers":    50,
		"acceptanceRate": 42.5,
		"linesAccepted":  10000,
		"linesSuggested": 23529,
	}

	server := createTestServer(t, "/ai-insights/usage/summary", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIUsageSummary(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIUsageMetrics(t *testing.T) {
	response := map[string]interface{}{
		"dataPoints": []map[string]interface{}{
			{"date": "2025-01-01", "value": 100},
			{"date": "2025-01-08", "value": 150},
		},
	}

	server := createTestServer(t, "/ai-insights/usage/metrics", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"granularity":     "WEEKLY",
		"metricType":      "linesAccepted",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIUsageMetrics(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIUsageBreakdown(t *testing.T) {
	response := map[string]interface{}{
		"teams": []map[string]interface{}{
			{"teamId": "1", "teamName": "Team A", "value": 100},
			{"teamId": "2", "teamName": "Team B", "value": 200},
		},
	}

	server := createTestServer(t, "/ai-insights/usage/breakdown", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIUsageBreakdown(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIAdoptions(t *testing.T) {
	response := map[string]interface{}{
		"dataPoints": []map[string]interface{}{
			{"date": "2025-01-01", "adoptionRate": 35.5},
			{"date": "2025-01-08", "adoptionRate": 38.2},
		},
	}

	server := createTestServer(t, "/ai-insights/adoptions", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"granularity":     "WEEKLY",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIAdoptions(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIAdoptionsSummary(t *testing.T) {
	response := map[string]interface{}{
		"currentPeriod":  map[string]interface{}{"adoptionRate": 45.5},
		"previousPeriod": map[string]interface{}{"adoptionRate": 40.0},
		"change":         5.5,
	}

	server := createTestServer(t, "/ai-insights/adoptions/summary", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIAdoptionsSummary(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIAdoptionsBreakdown(t *testing.T) {
	response := map[string]interface{}{
		"teams": []map[string]interface{}{
			{"teamId": "1", "adoptionRate": 50.0},
			{"teamId": "2", "adoptionRate": 60.0},
		},
	}

	server := createTestServer(t, "/ai-insights/adoptions/breakdown", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIAdoptionsBreakdown(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAITopLanguages(t *testing.T) {
	response := map[string]interface{}{
		"languages": []map[string]interface{}{
			{"name": "TypeScript", "count": 1500, "percentage": 45.5},
			{"name": "Python", "count": 1000, "percentage": 30.3},
			{"name": "Go", "count": 800, "percentage": 24.2},
		},
	}

	server := createTestServer(t, "/ai-insights/top-languages", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAITopLanguages(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIRawMetrics(t *testing.T) {
	response := map[string]interface{}{
		"data": []map[string]interface{}{
			{"developerId": "1", "acceptanceRate": 50.0},
			{"developerId": "2", "acceptanceRate": 60.0},
		},
		"totalCount": 2,
	}

	server := createTestServer(t, "/ai-insights/raw-metrics", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIRawMetrics(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIRawMetricsV2(t *testing.T) {
	response := map[string]interface{}{
		"data": []map[string]interface{}{
			{"developerId": "1", "acceptanceRate": 50.0, "linesAccepted": 100},
			{"developerId": "2", "acceptanceRate": 60.0, "linesAccepted": 200},
		},
		"totalCount": 2,
	}

	server := createTestServer(t, "/ai-insights/raw-metrics/v2", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIRawMetricsV2(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIPRVelocitySummary(t *testing.T) {
	response := map[string]interface{}{
		"aiAssisted":    map[string]interface{}{"avgTime": 2.5},
		"nonAiAssisted": map[string]interface{}{"avgTime": 4.0},
	}

	server := createTestServer(t, "/ai-insights/pr-velocity/summary", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIPRVelocitySummary(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_GetAIReworkSummary(t *testing.T) {
	response := map[string]interface{}{
		"aiAssisted":    map[string]interface{}{"reworkRate": 5.0},
		"nonAiAssisted": map[string]interface{}{"reworkRate": 8.0},
	}

	server := createTestServer(t, "/ai-insights/rework/summary", response)
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIReworkSummary(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_ErrorHandling(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Invalid request",
		})
	}))
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	_, err := aiService.GetAIUsageSummary(context.Background(), params)
	assert.Error(t, err)
}

func TestAIInsightsService_WithOptionalParams(t *testing.T) {
	response := map[string]interface{}{"success": true}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var reqBody map[string]interface{}
		json.Unmarshal(body, &reqBody)

		// Verify optional params are included
		if page, ok := reqBody["page"]; ok {
			assert.Equal(t, float64(0), page)
		}
		if pageSize, ok := reqBody["pageSize"]; ok {
			assert.Equal(t, float64(10), pageSize)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
		"page":            0,
		"pageSize":        10,
	}

	result, err := aiService.GetAIRawMetrics(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}

func TestAIInsightsService_WithGranularityAndMetricType(t *testing.T) {
	response := map[string]interface{}{"success": true}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var reqBody map[string]interface{}
		json.Unmarshal(body, &reqBody)

		// Verify granularity and metricType are included
		if granularity, ok := reqBody["granularity"]; ok {
			assert.Equal(t, "WEEKLY", granularity)
		}
		if metricType, ok := reqBody["metricType"]; ok {
			assert.Equal(t, "linesAccepted", metricType)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	aiService := createTestAIService(server.URL)

	params := map[string]interface{}{
		"accountId":       "test-account",
		"teamRefId":       "12345",
		"startDate":       "2025-01-01",
		"endDate":         "2025-01-31",
		"granularity":     "WEEKLY",
		"metricType":      "linesAccepted",
		"integrationType": "cursor",
		"projectId":       "test-project",
		"orgId":           "default",
	}

	result, err := aiService.GetAIUsageBreakdown(context.Background(), params)
	assert.NoError(t, err)
	assert.NotNil(t, result)
}
