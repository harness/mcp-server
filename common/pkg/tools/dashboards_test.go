package tools

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListDashboardsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListDashboardsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_dashboards", tool.Name)
		assert.Contains(t, tool.Description, "dashboards")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestDashboardService(t, func(w http.ResponseWriter, r *http.Request) {
			resp := map[string]interface{}{
				"resource": []map[string]interface{}{
					{
						"id":     "dash-1",
						"title":  "CI Dashboard",
						"models": []string{"CI"},
					},
					{
						"id":     "dash-2",
						"title":  "CD Dashboard",
						"models": []string{"CD"},
					},
				},
				"items": 2,
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListDashboardsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Pagination", func(t *testing.T) {
		svc, srv := newTestDashboardService(t, func(w http.ResponseWriter, r *http.Request) {
			resp := map[string]interface{}{
				"resource": []interface{}{},
				"items":    0,
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListDashboardsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"page": float64(2),
			"size": float64(50),
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_Returns_Tool_Error", func(t *testing.T) {
		svc, srv := newTestDashboardService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := ListDashboardsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		// ListDashboardsTool returns tool errors, not Go errors
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetDashboardDataTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetDashboardDataTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_dashboard", tool.Name)
		assert.Contains(t, tool.Description, "dashboard")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestDashboardService(t, func(w http.ResponseWriter, r *http.Request) {
			// GetDashboardData expects a ZIP file containing CSV files
			var buf bytes.Buffer
			zw := zip.NewWriter(&buf)
			csvWriter, _ := zw.Create("deployments.csv")
			csvWriter.Write([]byte("name,count\nPipeline A,42\n"))
			zw.Close()
			w.Header().Set("Content-Type", "application/zip")
			w.Write(buf.Bytes())
		})
		defer srv.Close()

		_, handler := GetDashboardDataTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"dashboard_id": "dash-123",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_Returns_Tool_Error_For_Data", func(t *testing.T) {
		svc, srv := newTestDashboardService(t, func(w http.ResponseWriter, r *http.Request) {
			// GetDashboardData expects a ZIP response; returning 500
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetDashboardDataTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"dashboard_id":        "dash-123",
			"reporting_timeframe": float64(90),
		}))
		// GetDashboardData returns tool errors
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Dashboard_ID", func(t *testing.T) {
		_, handler := GetDashboardDataTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_Returns_Tool_Error", func(t *testing.T) {
		svc, srv := newTestDashboardService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetDashboardDataTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"dashboard_id": "dash-123",
		}))
		// GetDashboardDataTool returns tool errors, not Go errors
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestFetchDashboardPagination(t *testing.T) {
	t.Run("defaults", func(t *testing.T) {
		request := newToolRequest(map[string]interface{}{})
		page, size, err := fetchDashboardPagination(request)
		require.NoError(t, err)
		assert.Equal(t, 1, page)
		assert.Equal(t, 100, size)
	})

	t.Run("custom_values", func(t *testing.T) {
		request := newToolRequest(map[string]interface{}{
			"page": float64(3),
			"size": float64(50),
		})
		page, size, err := fetchDashboardPagination(request)
		require.NoError(t, err)
		assert.Equal(t, 3, page)
		assert.Equal(t, 50, size)
	})
}
