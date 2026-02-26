package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// GetEntityTool
// ---------------------------------------------------------------------------

func TestIdpGetEntityTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetEntityTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_entity", tool.Name)
		assert.Contains(t, tool.Description, "entity")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/v1/entities/")
			assert.Equal(t, "test-account-123", r.Header.Get("Harness-Account"))
			resp := map[string]interface{}{
				"identifier":  "svc-1",
				"entity_ref":  "account/svc-1",
				"description": "My service entity",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetEntityTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"entity_id": "svc-1",
			"kind":      "component",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "svc-1")
	})

	t.Run("Missing_Required_EntityID", func(t *testing.T) {
		_, handler := GetEntityTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"kind": "component",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "entity_id")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := GetEntityTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"entity_id": "svc-1",
			"kind":      "component",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get entity")
	})
}

// ---------------------------------------------------------------------------
// ListEntitiesTool
// ---------------------------------------------------------------------------

func TestIdpListEntitiesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListEntitiesTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_entities", tool.Name)
		assert.Contains(t, tool.Description, "entities")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Equal(t, "test-account-123", r.Header.Get("Harness-Account"))
			resp := []map[string]interface{}{
				{"identifier": "svc-1", "entity_ref": "account/svc-1"},
				{"identifier": "svc-2", "entity_ref": "account/svc-2"},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListEntitiesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scope_level": "ALL",
			"kind":        "component",
			"page":        float64(0),
			"size":        float64(20),
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "svc-1")
	})

	t.Run("Missing_Required_ScopeLevel", func(t *testing.T) {
		_, handler := ListEntitiesTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"kind": "component",
			"page": float64(0),
			"size": float64(20),
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Required_Kind", func(t *testing.T) {
		_, handler := ListEntitiesTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scope_level": "ALL",
			"page":        float64(0),
			"size":        float64(20),
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ListEntitiesTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scope_level": "ALL",
			"kind":        "component",
			"page":        float64(0),
			"size":        float64(20),
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list entities")
	})
}

// ---------------------------------------------------------------------------
// GetScorecardTool
// ---------------------------------------------------------------------------

func TestIdpGetScorecardTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetScorecardTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_scorecard", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/v1/scorecards/sc-1")
			resp := map[string]interface{}{
				"scorecard": map[string]interface{}{
					"id":   "sc-1",
					"name": "Production Readiness",
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetScorecardTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scorecard_id": "sc-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_ScorecardID", func(t *testing.T) {
		_, handler := GetScorecardTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := GetScorecardTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scorecard_id": "sc-1",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get scorecard")
	})
}

// ---------------------------------------------------------------------------
// ListScorecardsTool
// ---------------------------------------------------------------------------

func TestIdpListScorecardsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListScorecardsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_scorecards", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := []map[string]interface{}{
				{"scorecard": map[string]interface{}{"identifier": "sc-1", "name": "Readiness"}},
				{"scorecard": map[string]interface{}{"identifier": "sc-2", "name": "Security"}},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListScorecardsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "Readiness")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ListScorecardsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list scorecards")
	})
}

// ---------------------------------------------------------------------------
// GetScoreSummaryTool
// ---------------------------------------------------------------------------

func TestIdpGetScoreSummaryTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetScoreSummaryTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_score_summary", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "entity-1", q.Get("entity_identifier"))
			resp := map[string]interface{}{
				"entity_identifier": "entity-1",
				"overall_score":     85,
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetScoreSummaryTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"entity_identifier": "entity-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_EntityIdentifier", func(t *testing.T) {
		_, handler := GetScoreSummaryTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := GetScoreSummaryTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"entity_identifier": "entity-1",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get scorecard summary")
	})
}

// ---------------------------------------------------------------------------
// GetScoresTool
// ---------------------------------------------------------------------------

func TestIdpGetScoresTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetScoresTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_scores", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "entity-1", q.Get("entity_identifier"))
			resp := map[string]interface{}{
				"scores": []map[string]interface{}{
					{"scorecard_id": "sc-1", "score": 90},
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetScoresTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"entity_identifier": "entity-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_EntityIdentifier", func(t *testing.T) {
		_, handler := GetScoresTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetScoresTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"entity_identifier": "entity-1",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list scorecards")
	})
}

// ---------------------------------------------------------------------------
// GetScorecardStatsTool
// ---------------------------------------------------------------------------

func TestIdpGetScorecardStatsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetScorecardStatsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_scorecard_stats", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/v1/scorecards/sc-1/stats")
			resp := map[string]interface{}{
				"name": "Production Readiness",
				"stats": []map[string]interface{}{
					{"entity_identifier": "svc-1", "score": 90},
				},
				"timestamp": float64(1700000000000),
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetScorecardStatsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scorecard_identifier": "sc-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_ScorecardIdentifier", func(t *testing.T) {
		_, handler := GetScorecardStatsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetScorecardStatsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"scorecard_identifier": "sc-1",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get scorecard stats")
	})
}

// ---------------------------------------------------------------------------
// GetCheckTool
// ---------------------------------------------------------------------------

func TestIdpGetCheckTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetCheckTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_scorecard_check", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/v1/checks/chk-1")
			q := r.URL.Query()
			assert.Equal(t, "false", q.Get("custom"))
			resp := map[string]interface{}{
				"check": map[string]interface{}{
					"id":   "chk-1",
					"name": "Has Readme",
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetCheckTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"check_id": "chk-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_CheckID", func(t *testing.T) {
		_, handler := GetCheckTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetCheckTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"check_id": "chk-1",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get check")
	})
}

// ---------------------------------------------------------------------------
// ListChecksTool
// ---------------------------------------------------------------------------

func TestIdpListChecksTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListChecksTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_scorecard_checks", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := []map[string]interface{}{
				{"id": "chk-1", "name": "Has Readme"},
				{"id": "chk-2", "name": "Has Tests"},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListChecksTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := ListChecksTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list checks")
	})
}

// ---------------------------------------------------------------------------
// GetCheckStatsTool
// ---------------------------------------------------------------------------

func TestIdpGetCheckStatsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetCheckStatsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_scorecard_check_stats", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/v1/checks/chk-1/stats")
			resp := map[string]interface{}{
				"name": "Has Readme",
				"stats": []map[string]interface{}{
					{"entity_identifier": "svc-1", "status": "PASS"},
				},
				"timestamp": float64(1700000000000),
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetCheckStatsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"check_identifier": "chk-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_CheckIdentifier", func(t *testing.T) {
		_, handler := GetCheckStatsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetCheckStatsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"check_identifier": "chk-1",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get check stats")
	})
}

// ---------------------------------------------------------------------------
// ExecuteWorkflowTool
// ---------------------------------------------------------------------------

func TestIdpExecuteWorkflowTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ExecuteWorkflowTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "execute_workflow", tool.Name)
		assert.Contains(t, tool.Description, "Execute a workflow")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "/v2/workflows/execute")

			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)
			assert.Equal(t, "wf-1", body["identifier"])

			resp := map[string]interface{}{
				"taskId": "task-1",
				"status": "RUNNING",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ExecuteWorkflowTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"workflow_details": map[string]interface{}{"name": "My Workflow"},
			"identifier":       "wf-1",
			"values":           map[string]interface{}{"param1": "value1"},
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_WorkflowDetails", func(t *testing.T) {
		_, handler := ExecuteWorkflowTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"identifier": "wf-1",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Required_Identifier", func(t *testing.T) {
		_, handler := ExecuteWorkflowTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"workflow_details": map[string]interface{}{"name": "My Workflow"},
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ExecuteWorkflowTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"workflow_details": map[string]interface{}{"name": "My Workflow"},
			"identifier":       "wf-1",
			"values":           map[string]interface{}{"param1": "value1"},
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to execute workflow")
	})
}

// ---------------------------------------------------------------------------
// SearchTechDocsTool
// ---------------------------------------------------------------------------

func TestIdpSearchTechDocsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := SearchTechDocsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "search_tech_docs", tool.Name)
		assert.Contains(t, tool.Description, "documentation")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "/v1/tech-docs/semantic-search")

			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)
			assert.Equal(t, "how to deploy", body["query"])

			resp := []map[string]interface{}{
				{"content": "Deploy using Harness pipelines", "entity_id": "svc-1"},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := SearchTechDocsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"query": "how to deploy",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Query", func(t *testing.T) {
		_, handler := SearchTechDocsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestIDPService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := SearchTechDocsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"query": "how to deploy",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to search tech docs")
	})
}
