package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestListConnectorCatalogueTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListConnectorCatalogueTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_connector_catalog", tool.Name)
		assert.Contains(t, tool.Description, "connector catalogue")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"catalogue": []map[string]interface{}{
						{"category": "CLOUD_PROVIDER", "connectors": []string{"Aws", "Gcp"}},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListConnectorCatalogueTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := ListConnectorCatalogueTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list connector catalogue")
	})
}

func TestGetConnectorDetailsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetConnectorDetailsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_connector", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"connector": map[string]interface{}{
						"name":       "my-connector",
						"identifier": "my_conn",
						"type":       "K8sCluster",
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetConnectorDetailsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"connector_identifier": "my_conn",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Connector_Identifier", func(t *testing.T) {
		_, handler := GetConnectorDetailsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetConnectorDetailsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"connector_identifier": "my_conn",
		}))
		require.Error(t, err)
	})
}

func TestListConnectorsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListConnectorsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_connectors", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"content":       []interface{}{},
					"totalElements": 0,
					"totalPages":    0,
					"empty":         true,
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListConnectorsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Filters", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"content":       []interface{}{},
					"totalElements": 0,
					"totalPages":    0,
					"empty":         true,
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListConnectorsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"types":      "K8sCluster,Git",
			"categories": "CLOUD_PROVIDER",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestConnectorService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := ListConnectorsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.Error(t, err)
	})
}

func TestParseStringSlice(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"Empty_String", "", nil},
		{"Single_Value", "K8sCluster", []string{"K8sCluster"}},
		{"Multiple_Values", "K8sCluster,Git,Aws", []string{"K8sCluster", "Git", "Aws"}},
		{"With_Spaces", " K8sCluster , Git , Aws ", []string{"K8sCluster", "Git", "Aws"}},
		{"Empty_Parts", "K8sCluster,,Git", []string{"K8sCluster", "Git"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseStringSlice(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}
