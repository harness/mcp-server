package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetAuditYamlTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetAuditYamlTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_audit_yaml", tool.Name)
		assert.Contains(t, tool.Description, "audit")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestAuditService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"oldYaml": "pipeline:\n  name: old",
					"newYaml": "pipeline:\n  name: new",
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetAuditYamlTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"audit_id": "audit-123",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Audit_ID", func(t *testing.T) {
		_, handler := GetAuditYamlTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestAuditService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetAuditYamlTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"audit_id": "audit-123",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get audit YAML")
	})
}

func TestListUserAuditTrailTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListUserAuditTrailTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_audit_events", tool.Name)
		assert.Contains(t, tool.Description, "audit")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestAuditService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"content": []map[string]interface{}{
						{
							"auditId":      "audit-1",
							"action":       "CREATE",
							"resourceType": "PIPELINE",
						},
					},
					"totalElements": 1,
					"totalPages":    1,
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListUserAuditTrailTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"start_time": "2025-01-01T00:00:00Z",
			"end_time":   "2025-01-31T23:59:59Z",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Filters", func(t *testing.T) {
		svc, srv := newTestAuditService(t, func(w http.ResponseWriter, r *http.Request) {
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"content":       []interface{}{},
					"totalElements": 0,
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListUserAuditTrailTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"user_id_list":        "user@example.com",
			"actions":             "CREATE",
			"resource_type":       "PIPELINE",
			"resource_identifier": "my-pipeline",
			"start_time":          "2025-01-01T00:00:00Z",
			"end_time":            "2025-01-31T23:59:59Z",
			"page":                float64(0),
			"size":                float64(10),
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestAuditService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := ListUserAuditTrailTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"start_time": "2025-01-01T00:00:00Z",
			"end_time":   "2025-01-31T23:59:59Z",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list the audit logs")
	})
}
