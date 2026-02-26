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
// TestGetPipelineTool
// ---------------------------------------------------------------------------
func TestGetPipelineTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetPipelineTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_pipeline", tool.Name)
		assert.Contains(t, tool.Description, "Get details of a specific pipeline")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/api/pipelines/test-pipeline")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"yamlPipeline": "pipeline:\n  name: test-pipeline",
					"modules":      []string{"cd"},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetPipelineTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
			"org_id":      "test-org",
			"project_id":  "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "yamlPipeline")
	})

	t.Run("Missing_Required_Params", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetPipelineTool(cfg, client)

		// Missing pipeline_id
		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetPipelineTool(cfg, client)

		// Missing org_id and project_id (required scope)
		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetPipelineTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
			"org_id":      "test-org",
			"project_id":  "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestListPipelinesTool
// ---------------------------------------------------------------------------
func TestListPipelinesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListPipelinesTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_pipelines", tool.Name)
		assert.Contains(t, tool.Description, "List pipelines")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "/api/pipelines/list")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 1,
					"content": []map[string]interface{}{
						{
							"name":       "my-pipeline",
							"identifier": "my-pipeline",
							"executionSummaryInfo": map[string]interface{}{
								"lastExecutionTs": 0,
							},
						},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListPipelinesTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "my-pipeline")
	})

	t.Run("With_Search_Term", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "deploy", q.Get("searchTerm"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 0,
					"content":    []map[string]interface{}{},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListPipelinesTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":      "test-org",
			"project_id":  "test-project",
			"search_term": "deploy",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Params", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := ListPipelinesTool(cfg, client)

		// Missing org_id and project_id (required scope)
		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListPipelinesTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestFetchExecutionURLTool
// ---------------------------------------------------------------------------
func TestFetchExecutionURLTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := FetchExecutionURLTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_execution_url", tool.Name)
		assert.Contains(t, tool.Description, "execution URL")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "/api/pipelines/execution/url")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))
			assert.Equal(t, "test-pipeline", q.Get("pipelineIdentifier"))
			assert.Equal(t, "exec-123", q.Get("planExecutionId"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data":   "https://app.harness.io/pipelines/exec-123",
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchExecutionURLTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id":       "test-pipeline",
			"plan_execution_id": "exec-123",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "https://app.harness.io/pipelines/exec-123")
	})

	t.Run("Missing_Required_Params_Pipeline_ID", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := FetchExecutionURLTool(cfg, client)

		// Missing pipeline_id
		request := newToolRequest(map[string]interface{}{
			"plan_execution_id": "exec-123",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Required_Params_Execution_ID", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := FetchExecutionURLTool(cfg, client)

		// Missing plan_execution_id
		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
			"org_id":      "test-org",
			"project_id":  "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := FetchExecutionURLTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id":       "test-pipeline",
			"plan_execution_id": "exec-123",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchExecutionURLTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id":       "test-pipeline",
			"plan_execution_id": "exec-123",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestGetExecutionTool
// ---------------------------------------------------------------------------
func TestGetExecutionTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetExecutionTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_execution", tool.Name)
		assert.Contains(t, tool.Description, "Get details of a specific pipeline execution")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/api/pipelines/execution/v2/exec-123")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"pipelineExecutionSummary": map[string]interface{}{
						"pipelineIdentifier": "my-pipeline",
						"planExecutionId":    "exec-123",
						"status":             "Success",
						"startTs":            0,
						"endTs":              0,
					},
					"executionGraph": map[string]interface{}{
						"rootNodeId": "node1",
						"nodeMap":    map[string]interface{}{},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetExecutionTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"plan_execution_id": "exec-123",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "exec-123")
	})

	t.Run("With_Stage_Node_ID", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "stage-1", q.Get("stageNodeId"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"pipelineExecutionSummary": map[string]interface{}{
						"planExecutionId": "exec-123",
						"status":          "Success",
					},
					"executionGraph": map[string]interface{}{
						"nodeMap": map[string]interface{}{},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetExecutionTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"plan_execution_id": "exec-123",
			"stage_node_id":     "stage-1",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Params", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetExecutionTool(cfg, client)

		// Missing plan_execution_id
		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetExecutionTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"plan_execution_id": "exec-123",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetExecutionTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"plan_execution_id": "exec-123",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestListExecutionsTool
// ---------------------------------------------------------------------------
func TestListExecutionsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListExecutionsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_executions", tool.Name)
		assert.Contains(t, tool.Description, "List pipeline executions")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "/api/pipelines/execution/summary")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 1,
					"content": []map[string]interface{}{
						{
							"pipelineIdentifier": "my-pipeline",
							"planExecutionId":    "exec-1",
							"status":             "Success",
							"startTs":            0,
							"endTs":              0,
						},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListExecutionsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "exec-1")
	})

	t.Run("With_Filters", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "deploy", q.Get("searchTerm"))
			assert.Equal(t, "my-pipeline", q.Get("pipelineIdentifier"))
			assert.Equal(t, "Failed", q.Get("status"))
			assert.Equal(t, "main", q.Get("branch"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 0,
					"content":    []map[string]interface{}{},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListExecutionsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":              "test-org",
			"project_id":          "test-project",
			"search_term":         "deploy",
			"pipeline_identifier": "my-pipeline",
			"status":              "Failed",
			"branch":              "main",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Params", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := ListExecutionsTool(cfg, client)

		// Missing org_id and project_id (required scope)
		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListExecutionsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestListInputSetsTool
// ---------------------------------------------------------------------------
func TestListInputSetsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListInputSetsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_input_sets", tool.Name)
		assert.Contains(t, tool.Description, "List input sets")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/api/inputSets")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))
			assert.Equal(t, "my-pipeline", q.Get("pipelineIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 1,
					"content": []map[string]interface{}{
						{
							"identifier":         "input-set-1",
							"name":               "My Input Set",
							"pipelineIdentifier": "my-pipeline",
						},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListInputSetsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier": "my-pipeline",
			"org_id":              "test-org",
			"project_id":          "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "input-set-1")
	})

	t.Run("With_Search_Term", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "prod", q.Get("searchTerm"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 0,
					"content":    []map[string]interface{}{},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListInputSetsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier": "my-pipeline",
			"org_id":              "test-org",
			"project_id":          "test-project",
			"search_term":         "prod",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Params", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := ListInputSetsTool(cfg, client)

		// Missing org_id and project_id (required scope)
		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier": "my-pipeline",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListInputSetsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier": "my-pipeline",
			"org_id":              "test-org",
			"project_id":          "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestGetInputSetTool
// ---------------------------------------------------------------------------
func TestGetInputSetTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetInputSetTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_input_set", tool.Name)
		assert.Contains(t, tool.Description, "Get details of a specific input set")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/api/inputSets/input-set-1")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))
			assert.Equal(t, "my-pipeline", q.Get("pipelineIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"identifier":         "input-set-1",
					"name":               "My Input Set",
					"pipelineIdentifier": "my-pipeline",
					"inputSetYaml":       "inputSet:\n  name: My Input Set",
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetInputSetTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier":  "my-pipeline",
			"input_set_identifier": "input-set-1",
			"org_id":               "test-org",
			"project_id":           "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "input-set-1")
	})

	t.Run("Missing_Required_Params_Pipeline_Identifier", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetInputSetTool(cfg, client)

		// Missing pipeline_identifier
		request := newToolRequest(map[string]interface{}{
			"input_set_identifier": "input-set-1",
			"org_id":               "test-org",
			"project_id":           "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Required_Params_Input_Set_Identifier", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetInputSetTool(cfg, client)

		// Missing input_set_identifier
		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier": "my-pipeline",
			"org_id":              "test-org",
			"project_id":          "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetInputSetTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier":  "my-pipeline",
			"input_set_identifier": "input-set-1",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetInputSetTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_identifier":  "my-pipeline",
			"input_set_identifier": "input-set-1",
			"org_id":               "test-org",
			"project_id":           "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestGetPipelineSummaryTool
// ---------------------------------------------------------------------------
func TestGetPipelineSummaryTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetPipelineSummaryTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_pipeline_summary", tool.Name)
		assert.Contains(t, tool.Description, "summary")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/api/pipelines/summary/test-pipeline")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"identifier":  "test-pipeline",
					"name":        "Test Pipeline",
					"numOfStages": 3,
					"modules":     []string{"cd", "ci"},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetPipelineSummaryTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
			"org_id":      "test-org",
			"project_id":  "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "test-pipeline")
	})

	t.Run("With_Metadata_Only", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "true", q.Get("getMetadataOnly"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"identifier": "test-pipeline",
					"name":       "Test Pipeline",
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetPipelineSummaryTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id":       "test-pipeline",
			"org_id":            "test-org",
			"project_id":        "test-project",
			"get_metadata_only": true,
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Params", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetPipelineSummaryTool(cfg, client)

		// Missing pipeline_id
		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetPipelineSummaryTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetPipelineSummaryTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"pipeline_id": "test-pipeline",
			"org_id":      "test-org",
			"project_id":  "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}

// ---------------------------------------------------------------------------
// TestListTriggersTool
// ---------------------------------------------------------------------------
func TestListTriggersTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListTriggersTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_triggers", tool.Name)
		assert.Contains(t, tool.Description, "List triggers")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "/api/triggers")

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "test-org", q.Get("orgIdentifier"))
			assert.Equal(t, "test-project", q.Get("projectIdentifier"))
			assert.Equal(t, "my-pipeline", q.Get("targetIdentifier"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 1,
					"content": []map[string]interface{}{
						{
							"name":             "my-trigger",
							"identifier":       "my-trigger",
							"type":             "Webhook",
							"enabled":          true,
							"targetIdentifier": "my-pipeline",
						},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListTriggersTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"target_identifier": "my-pipeline",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "my-trigger")
	})

	t.Run("With_Search_Term", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "webhook", q.Get("searchTerm"))

			resp := map[string]interface{}{
				"status": "SUCCESS",
				"data": map[string]interface{}{
					"totalItems": 0,
					"content":    []map[string]interface{}{},
				},
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListTriggersTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"target_identifier": "my-pipeline",
			"org_id":            "test-org",
			"project_id":        "test-project",
			"search_term":       "webhook",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Params_Target_Identifier", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := ListTriggersTool(cfg, client)

		// Missing target_identifier
		request := newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		client, srv := newTestPipelineService(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := ListTriggersTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"target_identifier": "my-pipeline",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, srv := newTestPipelineService(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListTriggersTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"target_identifier": "my-pipeline",
			"org_id":            "test-org",
			"project_id":        "test-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
	})
}
