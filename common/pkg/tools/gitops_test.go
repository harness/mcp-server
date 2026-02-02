package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/client"
	"github.com/harness/mcp-server/common/client/gitops/generated"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper to create a test server and client
func newTestClient(t *testing.T, handler http.HandlerFunc) (*client.GitOpsService, *httptest.Server) {
	server := httptest.NewServer(handler)

	// Create a client pointing to the test server using the public constructor
	c, err := client.NewWithAuthProvider(server.URL, &noOpAuthProvider{}, "test-version")
	require.NoError(t, err)

	return &client.GitOpsService{Client: c}, server
}

type noOpAuthProvider struct{}

func (p *noOpAuthProvider) GetHeader(_ context.Context) (string, string, error) {
	return "x-api-key", "test-key", nil
}

// Helper to create test config
func newTestConfig() *config.McpServerConfig {
	return &config.McpServerConfig{
		AccountID: "test-account-123",
	}
}

// Helper to create a tool request with arguments
func newToolRequest(args map[string]interface{}) mcp.CallToolRequest {
	request := mcp.CallToolRequest{}
	request.Params.Arguments = args
	return request
}

// Helper functions for pointer types
func boolPtr(b bool) *bool {
	return &b
}

func int32Ptr(i int32) *int32 {
	return &i
}

func TestListAgentsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListAgentsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_agents", tool.Name)
		assert.Contains(t, tool.Description, "GitOps agents")
		assert.Contains(t, tool.Description, "SCOPE BEHAVIOR")
	})

	t.Run("Account_Scope_No_Org_Project", func(t *testing.T) {
		agentName := "account-agent"
		agentIdentifier := "account.agent1"
		agentType := generated.V1AgentTypeMANAGEDARGOPROVIDER

		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.True(t, strings.HasSuffix(r.URL.Path, "/agents"))

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Empty(t, q.Get("orgIdentifier"), "Account-level should not have org")
			assert.Empty(t, q.Get("projectIdentifier"), "Account-level should not have project")
			assert.Equal(t, "0", q.Get("pageIndex"))
			assert.Equal(t, "5", q.Get("pageSize"))

			resp := generated.V1AgentList{
				Content: &[]generated.V1Agent{
					{
						Name:       &agentName,
						Identifier: &agentIdentifier,
						Type:       &agentType,
					},
				},
				PageIndex:     int32Ptr(0),
				PageSize:      int32Ptr(5),
				TotalPages:    int32Ptr(1),
				TotalItems:    int32Ptr(1),
				PageItemCount: int32Ptr(1),
				Empty:         boolPtr(false),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		
		var agentList generated.V1AgentList
		err = json.Unmarshal([]byte(textContent.Text), &agentList)
		require.NoError(t, err, "Response should be valid JSON")
		
		require.NotNil(t, agentList.Content)
		require.Len(t, *agentList.Content, 1)
		agent := (*agentList.Content)[0]
		assert.Equal(t, agentName, *agent.Name)
		assert.Equal(t, agentIdentifier, *agent.Identifier)
		assert.Equal(t, int32(0), *agentList.PageIndex)
		assert.Equal(t, int32(1), *agentList.TotalItems)
	})

	t.Run("Org_Scope_With_Org_Only", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "my-org", q.Get("orgIdentifier"))
			assert.Empty(t, q.Get("projectIdentifier"), "Org-level should not have project")

			resp := generated.V1AgentList{
				Content:    &[]generated.V1Agent{},
				PageIndex:  int32Ptr(0),
				TotalItems: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id": "my-org",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Project_Scope_With_Org_And_Project", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "my-org", q.Get("orgIdentifier"))
			assert.Equal(t, "my-project", q.Get("projectIdentifier"))

			resp := generated.V1AgentList{
				Content:    &[]generated.V1Agent{},
				PageIndex:  int32Ptr(0),
				TotalItems: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "my-org",
			"project_id": "my-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Include_All_Scopes_Parameter", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "true", q.Get("ignoreScope"))
			assert.Equal(t, "true", q.Get("metadataOnly"))

			resp := generated.V1AgentList{
				Content:    &[]generated.V1Agent{},
				TotalItems: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"include_all_scopes": true,
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Type_Filter", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "MANAGED_ARGO_PROVIDER", q.Get("type"))

			resp := generated.V1AgentList{Content: &[]generated.V1Agent{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"type": "MANAGED_ARGO_PROVIDER",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Search_Term", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "prod-agent", q.Get("searchTerm"))

			resp := generated.V1AgentList{Content: &[]generated.V1Agent{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"search_term": "prod-agent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Custom_Pagination", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "3", q.Get("pageIndex"))
			assert.Equal(t, "20", q.Get("pageSize"))

			resp := generated.V1AgentList{
				Content:       &[]generated.V1Agent{},
				PageIndex:     int32Ptr(3),
				PageSize:      int32Ptr(20),
				TotalPages:    int32Ptr(10),
				TotalItems:    int32Ptr(200),
				PageItemCount: int32Ptr(20),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"page": float64(3),
			"size": float64(20),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var agentList generated.V1AgentList
		err = json.Unmarshal([]byte(textContent.Text), &agentList)
		require.NoError(t, err)
		assert.Equal(t, int32(3), *agentList.PageIndex)
		assert.Equal(t, int32(20), *agentList.PageSize)
		assert.Equal(t, int32(200), *agentList.TotalItems)
	})

	t.Run("Pagination_Beyond_Total_Pages", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "100", q.Get("pageIndex"))
			assert.Equal(t, "50", q.Get("pageSize"))

			resp := generated.V1AgentList{
				Content:    &[]generated.V1Agent{},
				Empty:      boolPtr(true),
				PageIndex:  int32Ptr(100),
				TotalPages: int32Ptr(5),
				TotalItems: int32Ptr(200),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"page": float64(100),
			"size": float64(50),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Empty_Result_Set", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			resp := generated.V1AgentList{
				Content:       &[]generated.V1Agent{},
				Empty:         boolPtr(true),
				PageIndex:     int32Ptr(0),
				PageSize:      int32Ptr(5),
				TotalPages:    int32Ptr(0),
				TotalItems:    int32Ptr(0),
				PageItemCount: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var agentList generated.V1AgentList
		err = json.Unmarshal([]byte(textContent.Text), &agentList)
		require.NoError(t, err)
		assert.True(t, *agentList.Empty)
		assert.Equal(t, int32(0), *agentList.TotalItems)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_JSON_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{invalid json`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_Pagination_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"page": "invalid",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].(mcp.TextContent).Text, "page")
	})

	t.Run("Multiple_Filters_Combined", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "HOSTED_ARGO_PROVIDER", q.Get("type"))
			assert.Equal(t, "staging", q.Get("searchTerm"))
			assert.Equal(t, "my-org", q.Get("orgIdentifier"))
			assert.Equal(t, "2", q.Get("pageIndex"))
			assert.Equal(t, "15", q.Get("pageSize"))

			resp := generated.V1AgentList{Content: &[]generated.V1Agent{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListAgentsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":      "my-org",
			"type":        "HOSTED_ARGO_PROVIDER",
			"search_term": "staging",
			"page":        float64(2),
			"size":        float64(15),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetAgentTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetAgentTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_agent", tool.Name)
		assert.Contains(t, tool.Description, "Get detailed information")
		assert.Contains(t, tool.Description, "SCOPE BEHAVIOR")
	})

	t.Run("Account_Level_Agent", func(t *testing.T) {
		agentName := "account-agent"
		agentIdentifier := "account.agent1"
		agentType := generated.V1AgentTypeMANAGEDARGOPROVIDER
		description := "Production agent"

		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.True(t, strings.HasSuffix(r.URL.Path, "/agents/account.agent1"))

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Empty(t, q.Get("orgIdentifier"))
			assert.Empty(t, q.Get("projectIdentifier"))

			resp := generated.V1Agent{
				Name:              &agentName,
				Identifier:        &agentIdentifier,
				Type:              &agentType,
				Description:       &description,
				AccountIdentifier: strPtr("test-account-123"),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.agent1",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var agent generated.V1Agent
		err = json.Unmarshal([]byte(textContent.Text), &agent)
		require.NoError(t, err, "Response should be valid JSON")

		assert.Equal(t, agentName, *agent.Name)
		assert.Equal(t, agentIdentifier, *agent.Identifier)
		assert.Equal(t, agentType, *agent.Type)
		assert.Equal(t, description, *agent.Description)
	})

	t.Run("Org_Level_Agent", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "my-org", q.Get("orgIdentifier"))
			assert.Empty(t, q.Get("projectIdentifier"))

			agentName := "org-agent"
			resp := generated.V1Agent{
				Name:              &agentName,
				AccountIdentifier: strPtr("test-account-123"),
				OrgIdentifier:     strPtr("my-org"),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "org.myagent",
			"org_id":           "my-org",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Project_Level_Agent", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "my-org", q.Get("orgIdentifier"))
			assert.Equal(t, "my-project", q.Get("projectIdentifier"))

			agentName := "project-agent"
			resp := generated.V1Agent{
				Name:              &agentName,
				AccountIdentifier: strPtr("test-account-123"),
				OrgIdentifier:     strPtr("my-org"),
				ProjectIdentifier: strPtr("my-project"),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "project.myagent",
			"org_id":           "my-org",
			"project_id":       "my-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Agent_Identifier", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "missing required parameter: agent_identifier")
	})

	t.Run("Agent_Not_Found_404", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"message":"agent not found"}`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "unknown",
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

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.agent1",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_JSON_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{invalid json`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.agent1",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Empty_Agent_Identifier", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Full_Agent_Response_Structure", func(t *testing.T) {
		agentName := "full-agent"
		agentIdentifier := "account.full"
		agentType := generated.V1AgentTypeHOSTEDARGOPROVIDER
		description := "Full test agent"
		upgradeAvailable := false

		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			resp := generated.V1Agent{
				Name:             &agentName,
				Identifier:       &agentIdentifier,
				Type:             &agentType,
				Description:      &description,
				UpgradeAvailable: &upgradeAvailable,
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetAgentTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.full",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var agent generated.V1Agent
		err = json.Unmarshal([]byte(textContent.Text), &agent)
		require.NoError(t, err)

		assert.NotNil(t, agent.Name)
		assert.NotNil(t, agent.Identifier)
		assert.NotNil(t, agent.Type)
		assert.NotNil(t, agent.Description)
		assert.NotNil(t, agent.UpgradeAvailable)
		assert.False(t, *agent.UpgradeAvailable)
	})
}

func strPtr(s string) *string {
	return &s
}

func TestListApplicationsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListApplicationsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_applications", tool.Name)
		assert.Contains(t, tool.Description, "List all ArgoCD applications")
	})

	t.Run("Account_Level_No_Scope", func(t *testing.T) {
		appName := "account-app"

		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)

			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)
			assert.Equal(t, "test-account-123", body["accountIdentifier"])

			resp := generated.Servicev1Applicationlist{
				Content: &[]generated.Servicev1Application{
					{Name: &appName},
				},
				PageIndex:  int32Ptr(0),
				TotalItems: int32Ptr(1),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var appList generated.Servicev1Applicationlist
		err = json.Unmarshal([]byte(textContent.Text), &appList)
		require.NoError(t, err)
		require.NotNil(t, appList.Content)
		require.Len(t, *appList.Content, 1)
		assert.Equal(t, appName, *(*appList.Content)[0].Name)
	})

	t.Run("Org_Level_With_Org_Only", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)

			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "my-org", body["orgIdentifier"])

			resp := generated.Servicev1Applicationlist{
				Content:    &[]generated.Servicev1Application{},
				TotalItems: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id": "my-org",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Project_Level_With_Org_And_Project", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)

			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "my-org", body["orgIdentifier"])
			assert.Equal(t, "my-project", body["projectIdentifier"])

			resp := generated.Servicev1Applicationlist{
				Content:    &[]generated.Servicev1Application{},
				TotalItems: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "my-org",
			"project_id": "my-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Agent_Filter", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)

			assert.Equal(t, "my-agent", body["agentIdentifier"])

			resp := generated.Servicev1Applicationlist{Content: &[]generated.Servicev1Application{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "my-agent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Cluster_Filter", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)

			assert.Equal(t, "prod-cluster", body["clusterIdentifier"])

			resp := generated.Servicev1Applicationlist{Content: &[]generated.Servicev1Application{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"cluster_identifier": "prod-cluster",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Search_Term", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)

			assert.Equal(t, "frontend", body["searchTerm"])

			resp := generated.Servicev1Applicationlist{Content: &[]generated.Servicev1Application{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"search_term": "frontend",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Custom_Pagination", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			json.NewDecoder(r.Body).Decode(&body)

			assert.Equal(t, float64(3), body["pageIndex"])
			assert.Equal(t, float64(50), body["pageSize"])

			resp := generated.Servicev1Applicationlist{
				Content:       &[]generated.Servicev1Application{},
				PageIndex:     int32Ptr(3),
				PageSize:      int32Ptr(50),
				TotalPages:    int32Ptr(5),
				TotalItems:    int32Ptr(250),
				PageItemCount: int32Ptr(50),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"page": float64(3),
			"size": float64(50),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var appList generated.Servicev1Applicationlist
		err = json.Unmarshal([]byte(textContent.Text), &appList)
		require.NoError(t, err)
		assert.Equal(t, int32(3), *appList.PageIndex)
		assert.Equal(t, int32(50), *appList.PageSize)
	})

	t.Run("All_Filters_Combined", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			var body map[string]interface{}
			err := json.NewDecoder(r.Body).Decode(&body)
			require.NoError(t, err)

			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "my-org", body["orgIdentifier"])
			assert.Equal(t, "my-project", body["projectIdentifier"])
			assert.Equal(t, "test-agent", body["agentIdentifier"])
			assert.Equal(t, "prod-cluster", body["clusterIdentifier"])
			assert.Equal(t, "backend", body["searchTerm"])
			assert.Equal(t, float64(1), body["pageIndex"])
			assert.Equal(t, float64(20), body["pageSize"])

			resp := generated.Servicev1Applicationlist{
				Content:    &[]generated.Servicev1Application{},
				TotalItems: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":             "my-org",
			"project_id":         "my-project",
			"agent_identifier":   "test-agent",
			"cluster_identifier": "prod-cluster",
			"search_term":        "backend",
			"page":               float64(1),
			"size":               float64(20),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Empty_Result_Set", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			resp := generated.Servicev1Applicationlist{
				Content:       &[]generated.Servicev1Application{},
				PageIndex:     int32Ptr(0),
				TotalItems:    int32Ptr(0),
				TotalPages:    int32Ptr(0),
				PageItemCount: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var appList generated.Servicev1Applicationlist
		err = json.Unmarshal([]byte(textContent.Text), &appList)
		require.NoError(t, err)
		assert.Equal(t, int32(0), *appList.TotalItems)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"internal server error"}`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_JSON_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{invalid json`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_Pagination_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := ListApplicationsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"page": "invalid",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetApplicationTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetApplicationTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_application", tool.Name)
		assert.Contains(t, tool.Description, "Get detailed information")
	})

	t.Run("Valid_Request_With_Full_Response", func(t *testing.T) {
		appName := "my-app"
		agentID := "account.myagent"
		clusterID := "prod-cluster"

		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			assert.True(t, strings.Contains(r.URL.Path, "/applications/my-app"))

			q := r.URL.Query()
			assert.Equal(t, "test-account-123", q.Get("accountIdentifier"))
			assert.Equal(t, "account.myagent", q.Get("agentIdentifier"))

			resp := generated.Servicev1Application{
				Name:              &appName,
				AgentIdentifier:   &agentID,
				ClusterIdentifier: &clusterID,
				AccountIdentifier: strPtr("test-account-123"),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var app generated.Servicev1Application
		err = json.Unmarshal([]byte(textContent.Text), &app)
		require.NoError(t, err)
		assert.Equal(t, appName, *app.Name)
		assert.Equal(t, agentID, *app.AgentIdentifier)
		assert.Equal(t, clusterID, *app.ClusterIdentifier)
	})

	t.Run("Missing_Agent_Identifier", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].(mcp.TextContent).Text, "agent_identifier")
	})

	t.Run("Missing_Application_Name", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].(mcp.TextContent).Text, "application_name")
	})

	t.Run("Application_Not_Found_404", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"message":"application not found"}`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "nonexistent",
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

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_JSON_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{invalid json`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Empty_Application_Name", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetApplicationTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetApplicationResourceTreeTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetApplicationResourceTreeTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_app_resource_tree", tool.Name)
		assert.Contains(t, tool.Description, "resource tree")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.ApplicationsApplicationTree{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationResourceTreeTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier":   "account.myagent",
			"application_name":   "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Agent_Identifier", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetApplicationResourceTreeTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Missing_Application_Name", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetApplicationResourceTreeTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
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

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationResourceTreeTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Invalid_JSON_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Write([]byte(`{invalid json`))
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationResourceTreeTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestListApplicationEventsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListApplicationEventsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_app_events", tool.Name)
		assert.Contains(t, tool.Description, "Kubernetes events")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.ApplicationsEventList{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationEventsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier":   "account.myagent",
			"application_name":   "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("With_Filters", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			q := r.URL.Query()
			assert.Equal(t, "my-pod", q.Get("query.resourceName"))
			assert.Equal(t, "default", q.Get("query.resourceNamespace"))
			
			resp := generated.ApplicationsEventList{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationEventsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier":     "account.myagent",
			"application_name":     "my-app",
			"resource_name":        "my-pod",
			"resource_namespace":   "default",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := ListApplicationEventsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationEventsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetPodLogsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetPodLogsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_pod_logs", tool.Name)
		assert.Contains(t, tool.Description, "container logs")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.ApplicationsLogEntriesBatch{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetPodLogsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier":   "account.myagent",
			"application_name":   "my-app",
			"pod_name":          "my-pod",
			"namespace":         "default",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetPodLogsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetPodLogsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
			"pod_name":        "my-pod",
			"namespace":       "default",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetManagedResourcesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetManagedResourcesTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_managed_resources", tool.Name)
		assert.Contains(t, tool.Description, "managed resources")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.ApplicationsManagedResourcesResponse{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetManagedResourcesTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier":   "account.myagent",
			"application_name":   "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetManagedResourcesTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetManagedResourcesTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestListResourceActionsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListResourceActionsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_resource_actions", tool.Name)
		assert.Contains(t, tool.Description, "available actions")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.ApplicationsResourceActionsListResponse{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListResourceActionsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier":   "account.myagent",
			"application_name":   "my-app",
			"resource_name":      "my-deployment",
			"namespace":          "default",
			"kind":               "Deployment",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := ListResourceActionsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListResourceActionsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"application_name": "my-app",
			"resource_name":    "my-deployment",
			"namespace":        "default",
			"kind":             "Deployment",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestListApplicationSetsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListApplicationSetsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_applicationsets", tool.Name)
		assert.Contains(t, tool.Description, "ApplicationSets")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			resp := generated.Servicev1ApplicationSetList{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationSetsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"org_id":     "my-org",
			"project_id": "my-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("POST_Body_Verification", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			var body map[string]interface{}
			err := json.NewDecoder(r.Body).Decode(&body)
			require.NoError(t, err)
			
			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "test-org", body["orgIdentifier"])
			assert.Equal(t, "test-project", body["projectIdentifier"])
			assert.Equal(t, "my-agent", body["agentIdentifier"])
			assert.Equal(t, float64(1), body["pageIndex"])
			assert.Equal(t, float64(20), body["pageSize"])
			
			resp := generated.Servicev1ApplicationSetList{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListApplicationSetsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"org_id":           "test-org",
			"project_id":       "test-project",
			"agent_identifier": "my-agent",
			"page":             float64(1),
			"size":             float64(20),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetApplicationSetTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetApplicationSetTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_applicationset", tool.Name)
		assert.Contains(t, tool.Description, "ApplicationSet")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.Servicev1ApplicationSet{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationSetTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"org_id":     "my-org",
			"project_id": "my-project",
			"agent_identifier": "account.myagent",
			"identifier": "my-appset",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetApplicationSetTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":     "my-org",
			"project_id": "my-project",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetApplicationSetTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"org_id":           "my-org",
			"project_id":       "my-project",
			"agent_identifier": "account.myagent",
			"identifier":       "my-appset",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestListClustersTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListClustersTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_clusters", tool.Name)
		assert.Contains(t, tool.Description, "Kubernetes clusters")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			resp := generated.V1Clusterlist{Content: &[]generated.Servicev1Cluster{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListClustersTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("POST_Body_Verification_With_Search", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			var body map[string]interface{}
			err := json.NewDecoder(r.Body).Decode(&body)
			require.NoError(t, err)
			
			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "my-agent", body["agentIdentifier"])
			assert.Equal(t, "prod-cluster", body["searchTerm"])
			assert.Equal(t, float64(0), body["pageIndex"])
			assert.Equal(t, float64(10), body["pageSize"])
			
			resp := generated.V1Clusterlist{Content: &[]generated.Servicev1Cluster{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListClustersTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "my-agent",
			"search_term":      "prod-cluster",
			"page":             float64(0),
			"size":             float64(10),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetClusterTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetClusterTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_cluster", tool.Name)
		assert.Contains(t, tool.Description, "cluster")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.Servicev1Cluster{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetClusterTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"identifier": "my-cluster",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetClusterTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetClusterTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"identifier":       "my-cluster",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGitOpsListRepositoriesTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GitOpsListRepositoriesTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_repositories", tool.Name)
		assert.Contains(t, tool.Description, "repositories")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			resp := generated.V1Repositorylist{Content: &[]generated.Servicev1Repository{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GitOpsListRepositoriesTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("POST_Body_Verification", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			var body map[string]interface{}
			err := json.NewDecoder(r.Body).Decode(&body)
			require.NoError(t, err)
			
			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "test-agent", body["agentIdentifier"])
			assert.Equal(t, "github", body["searchTerm"])
			assert.Equal(t, float64(2), body["pageIndex"])
			assert.Equal(t, float64(15), body["pageSize"])
			
			resp := generated.V1Repositorylist{Content: &[]generated.Servicev1Repository{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GitOpsListRepositoriesTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "test-agent",
			"search_term":      "github",
			"page":             float64(2),
			"size":             float64(15),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGitOpsGetRepositoryTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GitOpsGetRepositoryTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_repository", tool.Name)
		assert.Contains(t, tool.Description, "repository")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.Servicev1Repository{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GitOpsGetRepositoryTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"identifier": "my-repo",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GitOpsGetRepositoryTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GitOpsGetRepositoryTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"identifier":       "my-repo",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestListRepoCredentialsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListRepoCredentialsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_list_repo_credentials", tool.Name)
		assert.Contains(t, tool.Description, "repository credential")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			resp := generated.Servicev1RepositoryCredentialsList{Content: &[]generated.Servicev1RepositoryCredentials{}}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListRepoCredentialsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("POST_Body_Verification_With_Pagination", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodPost, r.Method)
			
			var body map[string]interface{}
			err := json.NewDecoder(r.Body).Decode(&body)
			require.NoError(t, err)
			
			assert.Equal(t, "test-account-123", body["accountIdentifier"])
			assert.Equal(t, "cred-agent", body["agentIdentifier"])
			assert.Equal(t, float64(5), body["pageIndex"])
			assert.Equal(t, float64(50), body["pageSize"])
			
			resp := generated.Servicev1RepositoryCredentialsList{
				Content:       &[]generated.Servicev1RepositoryCredentials{},
				PageIndex:     int32Ptr(5),
				PageSize:      int32Ptr(50),
				TotalPages:    int32Ptr(3),
				PageItemCount: int32Ptr(0),
			}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := ListRepoCredentialsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "cred-agent",
			"page":             float64(5),
			"size":             float64(50),
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})
}

func TestGetRepoCredentialsTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetRepoCredentialsTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_repo_credentials", tool.Name)
		assert.Contains(t, tool.Description, "repository credential")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.Servicev1RepositoryCredentials{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetRepoCredentialsTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"identifier": "my-cred",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Required_Parameters", func(t *testing.T) {
		client, server := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer server.Close()

		_, toolHandler := GetRepoCredentialsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetRepoCredentialsTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
			"identifier":       "my-cred",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

func TestGetDashboardOverviewTool(t *testing.T) {
	cfg := newTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetDashboardOverviewTool(cfg, nil)

		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "gitops_get_dashboard_overview", tool.Name)
		assert.Contains(t, tool.Description, "overview")
	})

	t.Run("Valid_Request", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)
			
			resp := generated.V1DashboardOverview{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetDashboardOverviewTool(cfg, client)
		
		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Without_Agent_Identifier", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Equal(t, http.MethodGet, r.Method)

			resp := generated.V1DashboardOverview{}
			json.NewEncoder(w).Encode(resp)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetDashboardOverviewTool(cfg, client)

		request := newToolRequest(map[string]interface{}{})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		client, server := newTestClient(t, handlerFunc)
		defer server.Close()

		_, toolHandler := GetDashboardOverviewTool(cfg, client)

		request := newToolRequest(map[string]interface{}{
			"agent_identifier": "account.myagent",
		})

		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}
