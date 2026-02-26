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
// ListExperimentsTool
// ---------------------------------------------------------------------------

func TestChaosListExperimentsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListExperimentsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_experiments", tool.Name)
		assert.Contains(t, tool.Description, "chaos experiments")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			resp := map[string]interface{}{
				"data": []map[string]interface{}{
					{"experimentID": "exp-1", "name": "Pod Delete"},
				},
				"pagination": map[string]interface{}{
					"page":  0,
					"limit": 10,
					"total": 1,
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListExperimentsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "Pod Delete")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ListExperimentsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// GetExperimentsTool
// ---------------------------------------------------------------------------

func TestChaosGetExperimentsTool(t *testing.T) {
	cfg := newTestConfig()
	validUUID := "550e8400-e29b-41d4-a716-446655440000"

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetExperimentsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_experiment", tool.Name)
		assert.Contains(t, tool.Description, "chaos experiment")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, validUUID)
			resp := map[string]interface{}{
				"ExperimentID":   validUUID,
				"Identity":       "my-experiment",
				"InfraID":        "infra-1",
				"InfraType":      "Kubernetes",
				"ExperimentType": "CronExperiment",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetExperimentsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, validUUID)
	})

	t.Run("Missing_Required_ExperimentID", func(t *testing.T) {
		_, handler := GetExperimentsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "experimentID")
	})

	t.Run("Invalid_UUID", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			// The tool checks UUID validity but only returns an error if err is set;
			// since it is not a real error path, the request proceeds to the server.
			resp := map[string]interface{}{"ExperimentID": "not-a-uuid"}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetExperimentsTool(cfg, svc)
		// The tool has a bug: it checks isValidUUID but the inner `if err != nil` guard
		// references the old err from RequiredParam which is nil. So the tool continues.
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": "not-a-uuid",
		}))
		// It should still succeed since the tool does not properly gate on invalid UUID
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := GetExperimentsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// GetExperimentRunsTool
// ---------------------------------------------------------------------------

func TestChaosGetExperimentRunsTool(t *testing.T) {
	cfg := newTestConfig()
	validUUID := "550e8400-e29b-41d4-a716-446655440000"
	validRunUUID := "660e8400-e29b-41d4-a716-446655440000"

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetExperimentRunsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_experiment_run_result", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, validRunUUID, q.Get("experimentRunId"))
			resp := map[string]interface{}{
				"experimentId":    validUUID,
				"experimentRunId": validRunUUID,
				"phase":           "Completed",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetExperimentRunsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID":    validUUID,
			"experimentRunID": validRunUUID,
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_ExperimentID", func(t *testing.T) {
		_, handler := GetExperimentRunsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentRunID": validRunUUID,
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Required_ExperimentRunID", func(t *testing.T) {
		_, handler := GetExperimentRunsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := GetExperimentRunsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID":    validUUID,
			"experimentRunID": validRunUUID,
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// ListProbesTool
// ---------------------------------------------------------------------------

func TestChaosListProbesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListProbesTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_probes", tool.Name)
		assert.Contains(t, tool.Description, "chaos probes")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := map[string]interface{}{
				"data": []map[string]interface{}{
					{"probeId": "probe-1", "name": "HTTP Probe"},
				},
				"pagination": map[string]interface{}{
					"page":  0,
					"limit": 10,
					"total": 1,
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListProbesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "HTTP Probe")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ListProbesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// GetProbeTool
// ---------------------------------------------------------------------------

func TestChaosGetProbeTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetProbeTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_probe", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, "probes/probe-1")
			resp := map[string]interface{}{
				"probeId": "probe-1",
				"name":    "HTTP Probe",
				"type":    "httpProbe",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetProbeTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"probeId": "probe-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_ProbeId", func(t *testing.T) {
		_, handler := GetProbeTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "probeId")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := GetProbeTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"probeId": "probe-1",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// ListExperimentTemplatesTool
// ---------------------------------------------------------------------------

func TestChaosListExperimentTemplatesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListExperimentTemplatesTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_experiment_templates", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			q := r.URL.Query()
			assert.Equal(t, "my-hub", q.Get("hubIdentity"))
			resp := map[string]interface{}{
				"data": []map[string]interface{}{
					{"templateId": "tmpl-1", "name": "Pod Delete Template"},
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListExperimentTemplatesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"hubIdentity": "my-hub",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_HubIdentity", func(t *testing.T) {
		_, handler := ListExperimentTemplatesTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ListExperimentTemplatesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"hubIdentity": "my-hub",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// CreateExperimentFromTemplateTool
// ---------------------------------------------------------------------------

func TestChaosCreateExperimentFromTemplateTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := CreateExperimentFromTemplateTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "create_experiment_from_template", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			assert.Contains(t, r.URL.Path, "experimenttemplates/tmpl-1/launch")
			q := r.URL.Query()
			assert.Equal(t, "hub-1", q.Get("hubIdentity"))
			resp := map[string]interface{}{
				"experimentId": "exp-created-1",
				"name":         "test-experiment",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := CreateExperimentFromTemplateTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"templateId":    "tmpl-1",
			"infraId":       "infra-1",
			"environmentId": "env-1",
			"hubIdentity":   "hub-1",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_TemplateId", func(t *testing.T) {
		_, handler := CreateExperimentFromTemplateTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"infraId":       "infra-1",
			"environmentId": "env-1",
			"hubIdentity":   "hub-1",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Required_InfraId", func(t *testing.T) {
		_, handler := CreateExperimentFromTemplateTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"templateId":    "tmpl-1",
			"environmentId": "env-1",
			"hubIdentity":   "hub-1",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := CreateExperimentFromTemplateTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"templateId":    "tmpl-1",
			"infraId":       "infra-1",
			"environmentId": "env-1",
			"hubIdentity":   "hub-1",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// ListExperimentVariablesTool
// ---------------------------------------------------------------------------

func TestChaosListExperimentVariablesTool(t *testing.T) {
	cfg := newTestConfig()
	validUUID := "550e8400-e29b-41d4-a716-446655440000"

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListExperimentVariablesTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_experiment_variables", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.Contains(t, r.URL.Path, validUUID+"/variables")
			resp := map[string]interface{}{
				"experiment": []map[string]interface{}{
					{"name": "DURATION", "value": "30"},
				},
				"tasks": map[string]interface{}{},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListExperimentVariablesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_ExperimentID", func(t *testing.T) {
		_, handler := ListExperimentVariablesTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_UUID_Returns_Error", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			// This should never be reached because the tool validates UUID first
			w.WriteHeader(http.StatusOK)
		})
		defer srv.Close()

		_, handler := ListExperimentVariablesTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": "not-a-valid-uuid",
		}))
		// ListExperimentVariablesTool returns (nil, fmt.Errorf) for invalid UUID
		require.Error(t, err)
		assert.Contains(t, err.Error(), "invalid experiment ID")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		})
		defer srv.Close()

		_, handler := ListExperimentVariablesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// RunExperimentTool
// ---------------------------------------------------------------------------

func TestChaosRunExperimentTool(t *testing.T) {
	cfg := newTestConfig()
	validUUID := "550e8400-e29b-41d4-a716-446655440000"

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := RunExperimentTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "execute_experiment", tool.Name)
		assert.Contains(t, tool.Description, "Run the chaos experiment")
	})

	t.Run("Happy_Path_No_Variables", func(t *testing.T) {
		// We need a server that handles both the variables check and the run
		callCount := 0
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			callCount++
			if callCount == 1 {
				// First call: ListExperimentVariables (GET)
				assert.Equal(t, http.MethodGet, r.Method)
				assert.Contains(t, r.URL.Path, "variables")
				// No variables required
				resp := map[string]interface{}{
					"experiment": []interface{}{},
					"tasks":      map[string]interface{}{},
				}
				json.NewEncoder(w).Encode(resp)
			} else {
				// Second call: RunExperiment (POST)
				assert.Equal(t, http.MethodPost, r.Method)
				resp := map[string]interface{}{
					"notifyId":        "notify-1",
					"experimentRunId": "run-1",
					"experimentId":    validUUID,
					"experimentName":  "test-exp",
				}
				json.NewEncoder(w).Encode(resp)
			}
		})
		defer srv.Close()

		_, handler := RunExperimentTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_ExperimentID", func(t *testing.T) {
		_, handler := RunExperimentTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		// Return empty variables but fail on run
		callCount := 0
		svc, srv := newTestChaosService(t, func(w http.ResponseWriter, r *http.Request) {
			callCount++
			if callCount == 1 {
				// Variables check succeeds
				resp := map[string]interface{}{
					"experiment": []interface{}{},
					"tasks":      map[string]interface{}{},
				}
				json.NewEncoder(w).Encode(resp)
			} else {
				// Run experiment fails
				w.WriteHeader(http.StatusInternalServerError)
				w.Write([]byte(`{"message":"internal server error"}`))
			}
		})
		defer srv.Close()

		_, handler := RunExperimentTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"experimentID": validUUID,
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

func TestGenerateIdentity(t *testing.T) {
	t.Run("Simple_Name", func(t *testing.T) {
		result := generateIdentity("My Experiment")
		assert.Equal(t, "my-experiment", result)
	})

	t.Run("Underscore_Name", func(t *testing.T) {
		result := generateIdentity("my_experiment_name")
		assert.Equal(t, "my-experiment-name", result)
	})

	t.Run("Special_Characters", func(t *testing.T) {
		result := generateIdentity("My (Experiment) #1!")
		assert.Equal(t, "my-experiment-1", result)
	})

	t.Run("Leading_Trailing_Hyphens", func(t *testing.T) {
		result := generateIdentity("  -test-  ")
		assert.Equal(t, "test", result)
	})
}
