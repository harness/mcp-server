package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/dto"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestCCMCommitmentClient creates an httptest server and a CloudCostManagementService
// pointing at it, following the same pattern as newTestClient in gitops_test.go.
func newTestCCMCommitmentClient(t *testing.T, handler http.HandlerFunc) (*client.CloudCostManagementService, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	c, err := client.NewWithAuthProvider(srv.URL, &noOpAuthProvider{}, "test-version")
	require.NoError(t, err)
	return &client.CloudCostManagementService{Client: c}, srv
}

func TestFetchCommitmentSpendsTool(t *testing.T) {
	cfg := &config.McpServerConfig{AccountID: "test-account-123"}

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := FetchCommitmentSpendsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "ccm_get_commitment_spends", tool.Name)
		assert.NotEmpty(t, tool.Description)
		// Description must reference Commitment Orchestrator and default window
		assert.Contains(t, tool.Description, "Commitment Orchestrator")
		assert.Contains(t, tool.Description, "30 days")
	})

	t.Run("Success_No_Params_Defaults_To_Last_30_Days", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "/v2/spend/detail")
			assert.Equal(t, "test-account-123", r.URL.Query().Get("accountIdentifier"))

			// Both date params must be set by the client (defaulted)
			assert.NotEmpty(t, r.URL.Query().Get("start_date"), "start_date should be defaulted")
			assert.NotEmpty(t, r.URL.Query().Get("end_date"), "end_date should be defaulted")

			resp := dto.CCMCommitmentBaseResponse{
				Success: true,
				Response: []interface{}{
					map[string]interface{}{
						"key":         "Savings Plans",
						"cost":        1234.56,
						"yearly_cost": 14814.72,
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), mcp.CallToolRequest{})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok, "result content should be TextContent")

		var parsed dto.CCMCommitmentBaseResponse
		require.NoError(t, json.Unmarshal([]byte(textContent.Text), &parsed))
		assert.True(t, parsed.Success)
	})

	t.Run("Success_With_Date_Range", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, "2025-01-01", r.URL.Query().Get("start_date"))
			assert.Equal(t, "2025-01-31", r.URL.Query().Get("end_date"))

			json.NewEncoder(w).Encode(dto.CCMCommitmentBaseResponse{Success: true})
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), newToolRequest(map[string]interface{}{
			"start_date": "2025-01-01",
			"end_date":   "2025-01-31",
		}))

		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Success_With_Service_Filter", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			assert.Equal(t, "EC2", body["service"])

			json.NewEncoder(w).Encode(dto.CCMCommitmentBaseResponse{Success: true})
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), newToolRequest(map[string]interface{}{
			"service": "EC2",
		}))

		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Success_With_Cloud_Account_IDs", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))

			cloudAccounts, ok := body["cloud_account_ids"].([]interface{})
			require.True(t, ok, "cloud_account_ids should be an array")
			assert.Contains(t, cloudAccounts, "123456789012")
			assert.Contains(t, cloudAccounts, "987654321098")

			json.NewEncoder(w).Encode(dto.CCMCommitmentBaseResponse{Success: true})
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), newToolRequest(map[string]interface{}{
			"cloud_account_ids": []interface{}{"123456789012", "987654321098"},
		}))

		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Success_With_Net_Amortized_True", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			// The JSON field name from CCMCommitmentAPIFilter is "net_amortized"
			assert.Equal(t, true, body["net_amortized"])

			json.NewEncoder(w).Encode(dto.CCMCommitmentBaseResponse{Success: true})
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), newToolRequest(map[string]interface{}{
			"net_amortized": true,
		}))

		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Success_With_All_Params", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "2025-03-01", q.Get("start_date"))
			assert.Equal(t, "2025-03-31", q.Get("end_date"))

			var body map[string]interface{}
			require.NoError(t, json.NewDecoder(r.Body).Decode(&body))
			assert.Equal(t, "Fargate", body["service"])
			assert.Equal(t, true, body["net_amortized"])

			cloudAccounts, ok := body["cloud_account_ids"].([]interface{})
			require.True(t, ok)
			assert.Len(t, cloudAccounts, 1)
			assert.Equal(t, "111122223333", cloudAccounts[0])

			json.NewEncoder(w).Encode(dto.CCMCommitmentBaseResponse{Success: true})
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), newToolRequest(map[string]interface{}{
			"start_date":        "2025-03-01",
			"end_date":          "2025-03-31",
			"service":           "Fargate",
			"net_amortized":     true,
			"cloud_account_ids": []interface{}{"111122223333"},
		}))

		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("API_Error_Returns_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "internal server error", http.StatusInternalServerError)
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), mcp.CallToolRequest{})

		// API errors must propagate as Go errors (not ToolResultError)
		assert.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "failed to get commitment spends")
	})

	t.Run("Response_Is_Valid_JSON", func(t *testing.T) {
		trend := 5.2
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			resp := dto.CCMCommitmentBaseResponse{
				Success: true,
				Response: []interface{}{
					map[string]interface{}{
						"key":         "Reserved Instances",
						"cost":        500.0,
						"yearly_cost": 6000.0,
						"trend":       &trend,
					},
					map[string]interface{}{
						"key":         "Savings Plans",
						"cost":        800.0,
						"yearly_cost": 9600.0,
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		ccmClient, srv := newTestCCMCommitmentClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchCommitmentSpendsTool(cfg, ccmClient)
		result, err := toolHandler(context.Background(), mcp.CallToolRequest{})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		// Response must be parseable JSON
		var parsed map[string]interface{}
		require.NoError(t, json.Unmarshal([]byte(textContent.Text), &parsed), "response must be valid JSON")
		assert.Equal(t, true, parsed["success"])
		assert.NotNil(t, parsed["response"])
	})
}
