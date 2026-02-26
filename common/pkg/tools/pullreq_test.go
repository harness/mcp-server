package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetPullRequestTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetPullRequestTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_pull_request", tool.Name)
		assert.Contains(t, tool.Description, "pull request")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := map[string]interface{}{
				"number":        42,
				"title":         "Fix bug",
				"state":         "open",
				"source_branch": "feature/fix",
				"target_branch": "main",
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetPullRequestTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":    "my-repo",
			"pr_number":  float64(42),
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Repo_ID", func(t *testing.T) {
		_, handler := GetPullRequestTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"pr_number":  float64(42),
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_PR_Number", func(t *testing.T) {
		_, handler := GetPullRequestTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":    "my-repo",
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetPullRequestTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":    "my-repo",
			"pr_number":  float64(42),
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get pull request")
	})
}

func TestListPullRequestsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListPullRequestsTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_pull_requests", tool.Name)
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := []map[string]interface{}{
				{"number": 1, "title": "PR 1", "state": "open"},
				{"number": 2, "title": "PR 2", "state": "merged"},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListPullRequestsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":    "my-repo",
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Filters", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			resp := []interface{}{}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := ListPullRequestsTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":        "my-repo",
			"state":          "open,merged",
			"source_branch":  "feature/test",
			"target_branch":  "main",
			"query":          "fix",
			"include_checks": true,
			"page":           float64(1),
			"limit":          float64(5),
			"org_id":         "test-org",
			"project_id":     "test-project",
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Repo_ID", func(t *testing.T) {
		_, handler := ListPullRequestsTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := ListPullRequestsTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":    "my-repo",
			"org_id":     "test-org",
			"project_id": "test-project",
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to list pull requests")
	})
}

func TestGetPullRequestChecksTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetPullRequestChecksTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_pull_request_checks", tool.Name)
		assert.Contains(t, tool.Description, "status checks")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := map[string]interface{}{
				"checks": []map[string]interface{}{
					{"uid": "check-1", "status": "success"},
				},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetPullRequestChecksTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_identifier": "my-repo",
			"pr_number":       float64(42),
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Repo_Identifier", func(t *testing.T) {
		_, handler := GetPullRequestChecksTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"pr_number": float64(42),
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetPullRequestChecksTool(cfg, svc)
		_, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_identifier": "my-repo",
			"pr_number":       float64(42),
		}))
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to get pull request checks")
	})
}

func TestGetPullRequestActivitiesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetPullRequestActivitiesTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_pull_request_activities", tool.Name)
		assert.Contains(t, tool.Description, "activities")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			resp := []map[string]interface{}{
				{"type": "comment", "text": "LGTM"},
			}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetPullRequestActivitiesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":   "my-repo",
			"pr_number": float64(42),
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Filters", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			resp := []interface{}{}
			json.NewEncoder(w).Encode(resp)
		})
		defer srv.Close()

		_, handler := GetPullRequestActivitiesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":   "my-repo",
			"pr_number": float64(42),
			"kind":      "comment",
			"type":      "code-comment",
			"after":     float64(1704067200000),
			"before":    float64(1704153600000),
			"limit":     float64(50),
		}))
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Repo_ID", func(t *testing.T) {
		_, handler := GetPullRequestActivitiesTool(cfg, nil)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"pr_number": float64(42),
		}))
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		svc, srv := newTestPullRequestService(t, func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})
		defer srv.Close()

		_, handler := GetPullRequestActivitiesTool(cfg, svc)
		result, err := handler(context.Background(), newToolRequest(map[string]interface{}{
			"repo_id":   "my-repo",
			"pr_number": float64(42),
		}))
		// GetPullRequestActivities returns validation errors, not Go errors
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestParseCommaSeparatedList(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{"empty string", "", nil},
		{"single value", "open", []string{"open"}},
		{"multiple values", "open,closed,merged", []string{"open", "closed", "merged"}},
		{"values with spaces", "open , closed , merged", []string{"open", "closed", "merged"}},
		{"trailing comma", "open,closed,", []string{"open", "closed"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := parseCommaSeparatedList(tc.input)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestSplitAndTrim(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		sep      string
		expected []string
	}{
		{"empty string", "", ",", nil},
		{"single item", "hello", ",", []string{"hello"}},
		{"multiple items", "a,b,c", ",", []string{"a", "b", "c"}},
		{"items with spaces", " a , b , c ", ",", []string{"a", "b", "c"}},
		{"empty items filtered", "a,,b,,c", ",", []string{"a", "b", "c"}},
		{"different separator", "a|b|c", "|", []string{"a", "b", "c"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result := splitAndTrim(tc.input, tc.sep)
			assert.Equal(t, tc.expected, result)
		})
	}
}
