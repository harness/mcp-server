package tools

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	config "github.com/harness/mcp-server/common"
	generated "github.com/harness/mcp-server/common/client/scs/generated"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newSCSTestConfig returns a config with account, org, and project IDs set
// (SCS tools require org+project scope).
func newSCSTestConfig() *config.McpServerConfig {
	return &config.McpServerConfig{
		AccountID:        "test-account-123",
		DefaultOrgID:     "test-org",
		DefaultProjectID: "test-project",
		BaseURL:          "https://app.harness.io",
	}
}

// newSCSClient creates a generated SCS ClientWithResponses pointing at a test server.
func newSCSClient(t *testing.T, handler http.HandlerFunc) (*generated.ClientWithResponses, *httptest.Server) {
	t.Helper()
	srv := httptest.NewServer(handler)
	client, err := generated.NewClientWithResponses(srv.URL)
	require.NoError(t, err)
	return client, srv
}

// ---------------------------------------------------------------------------
// TestSCSGetArtifactOverview
// ---------------------------------------------------------------------------
func TestSCSGetArtifactOverview(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetArtifactV2OverviewTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_artifact_overview", tool.Name)
		assert.Contains(t, tool.Description, "overview")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		artifactName := "docker.io/library/alpine"
		artifactID := "abc-123"
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/artifact-sources/")
			assert.Contains(t, r.URL.Path, "/artifacts/")
			assert.Contains(t, r.URL.Path, "/overview")
			w.Header().Set("Content-Type", "application/json")
			resp := generated.ArtifactV2Overview{
				Name: artifactName,
				Id:   &artifactID,
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactV2OverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"source":              "source-1",
			"artifact_identifier": "art-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, artifactName)
	})

	t.Run("Missing_Source_Param", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactV2OverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "source")
	})

	t.Run("Missing_Artifact_Identifier", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactV2OverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"source": "source-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "artifact_identifier")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"internal"}`))
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactV2OverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"source":              "source-1",
			"artifact_identifier": "art-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})

	t.Run("Missing_Scope", func(t *testing.T) {
		noScopeCfg := &config.McpServerConfig{
			AccountID: "test-account-123",
		}
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactV2OverviewTool(noScopeCfg, client)
		request := newToolRequest(map[string]interface{}{
			"source":              "source-1",
			"artifact_identifier": "art-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// TestSCSGetArtifactChainOfCustody
// ---------------------------------------------------------------------------
func TestSCSGetArtifactChainOfCustody(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetArtifactChainOfCustodyV2Tool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_artifact_chain_of_custody", tool.Name)
		assert.Contains(t, tool.Description, "chain of custody")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/chain-of-custody")
			w.Header().Set("Content-Type", "application/json")
			createdAt := int64(1704067200000)
			resp := []generated.ArtifactChainOfCustodyV2{
				{
					CreatedAt: &createdAt,
				},
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactChainOfCustodyV2Tool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "12345678-1234-4123-8123-123456789abc",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Artifact_Identifier", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactChainOfCustodyV2Tool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactChainOfCustodyV2Tool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "12345678-1234-4123-8123-123456789abc",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})

	t.Run("Empty_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]generated.ArtifactChainOfCustodyV2{})
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactChainOfCustodyV2Tool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "12345678-1234-4123-8123-123456789abc",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// TestSCSGetArtifactComponentRemediation
// ---------------------------------------------------------------------------
func TestSCSGetArtifactComponentRemediation(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetArtifactComponentRemediationByPurlTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_artifact_component_remediation", tool.Name)
		assert.Contains(t, tool.Description, "remediation")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/component/remediation")
			assert.Contains(t, r.URL.RawQuery, "purl=")
			w.Header().Set("Content-Type", "application/json")
			resp := generated.ComponentRemediationResponse{
				CurrentVersion:     "4.17.20",
				RecommendedVersion: "4.17.21",
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactComponentRemediationByPurlTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-123",
			"purl":                "pkg:npm/lodash@4.17.20",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "4.17.21")
	})

	t.Run("With_Target_Version", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.RawQuery, "target_version=")
			w.Header().Set("Content-Type", "application/json")
			resp := generated.ComponentRemediationResponse{
				CurrentVersion:     "4.17.20",
				RecommendedVersion: "5.0.0",
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactComponentRemediationByPurlTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-123",
			"purl":                "pkg:npm/lodash@4.17.20",
			"target_version":      "5.0.0",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})

	t.Run("Missing_Artifact_Identifier", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactComponentRemediationByPurlTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"purl": "pkg:npm/lodash@4.17.20",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "artifact_identifier")
	})

	t.Run("Missing_Purl", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactComponentRemediationByPurlTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-123",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "purl")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactComponentRemediationByPurlTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-123",
			"purl":                "pkg:npm/lodash@4.17.20",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})
}

// ---------------------------------------------------------------------------
// TestSCSGetCodeRepositoryOverview
// ---------------------------------------------------------------------------
func TestSCSGetCodeRepositoryOverview(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetCodeRepositoryOverviewTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_code_repository_overview", tool.Name)
		assert.Contains(t, tool.Description, "overview")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/code-repos/")
			assert.Contains(t, r.URL.Path, "/overview")
			w.Header().Set("Content-Type", "application/json")
			resp := generated.CodeRepositoryOverview{
				Name:           "my-repo",
				RepoIdentifier: "repo-uuid-1",
				Url:            "https://github.com/org/my-repo",
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetCodeRepositoryOverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"repo_identifier": "repo-uuid-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "my-repo")
	})

	t.Run("Missing_Repo_Identifier", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetCodeRepositoryOverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "repo_identifier")
	})

	t.Run("Server_Error_404", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetCodeRepositoryOverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"repo_identifier": "nonexistent-repo",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetCodeRepositoryOverviewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"repo_identifier": "repo-uuid-1",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})
}

// ---------------------------------------------------------------------------
// TestSCSDownloadSbom
// ---------------------------------------------------------------------------
func TestSCSDownloadSbom(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := DownloadSbomTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "download_sbom", tool.Name)
		assert.Contains(t, tool.Description, "SBOM")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		// DownloadSbomTool does not call the SCS API; it constructs a URL.
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := DownloadSbomTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"orchestration_id": "orch-abc-123",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var sbomResp SbomDownloadResponse
		err = json.Unmarshal([]byte(textContent.Text), &sbomResp)
		require.NoError(t, err)
		assert.Equal(t, "orch-abc-123", sbomResp.OrchestrationID)
		assert.Contains(t, sbomResp.DownloadURL, "/sbom-download")
		assert.Contains(t, sbomResp.DownloadURL, "test-org")
		assert.Contains(t, sbomResp.DownloadURL, "test-project")
		assert.Contains(t, sbomResp.DownloadURL, "orch-abc-123")
	})

	t.Run("Missing_Orchestration_ID", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := DownloadSbomTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("URL_Uses_Correct_Base", func(t *testing.T) {
		customCfg := &config.McpServerConfig{
			AccountID:        "test-account-123",
			DefaultOrgID:     "custom-org",
			DefaultProjectID: "custom-project",
			BaseURL:          "https://custom.harness.io",
		}
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := DownloadSbomTool(customCfg, client)
		request := newToolRequest(map[string]interface{}{
			"orchestration_id": "orch-xyz",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var sbomResp SbomDownloadResponse
		err = json.Unmarshal([]byte(textContent.Text), &sbomResp)
		require.NoError(t, err)
		assert.Contains(t, sbomResp.DownloadURL, "https://custom.harness.io/ssca-manager")
		assert.Contains(t, sbomResp.DownloadURL, "custom-org")
		assert.Contains(t, sbomResp.DownloadURL, "custom-project")
	})
}

// ---------------------------------------------------------------------------
// TestSCSCreateOPAPolicy
// ---------------------------------------------------------------------------
func TestSCSCreateOPAPolicy(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := CreateOPAPolicyTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "create_opa_policy", tool.Name)
		assert.Contains(t, tool.Description, "OPA policy")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := CreateOPAPolicyTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"licenses": []interface{}{"GPL-2.0-only", "AGPL-3.0"},
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var opaContent OPAContent
		err = json.Unmarshal([]byte(textContent.Text), &opaContent)
		require.NoError(t, err)
		assert.Equal(t, "deny-list", opaContent.Policy.Name)
		assert.Contains(t, opaContent.Policy.Content, "GPL-2.0-only")
		assert.Contains(t, opaContent.Policy.Content, "AGPL-3.0")
		assert.Equal(t, []string{"GPL-2.0-only", "AGPL-3.0"}, opaContent.Metadata.DeniedLicenses)
	})

	t.Run("Empty_Licenses_Returns_Error", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := CreateOPAPolicyTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"licenses": []interface{}{},
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "licenses")
	})

	t.Run("Missing_Licenses_Param", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := CreateOPAPolicyTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Single_License", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := CreateOPAPolicyTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"licenses": []interface{}{"MIT"},
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)

		var opaContent OPAContent
		err = json.Unmarshal([]byte(textContent.Text), &opaContent)
		require.NoError(t, err)
		assert.Contains(t, opaContent.Policy.Content, "MIT")
		assert.Equal(t, []string{"MIT"}, opaContent.Metadata.DeniedLicenses)
	})
}

// ---------------------------------------------------------------------------
// TestSCSFetchComplianceResults
// ---------------------------------------------------------------------------
func TestSCSFetchComplianceResults(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := FetchComplianceResultsByArtifactTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_repository_compliance_results", tool.Name)
		assert.Contains(t, tool.Description, "compliance")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/artifact/")
			assert.Contains(t, r.URL.Path, "/compliance")
			w.Header().Set("Content-Type", "application/json")
			title := "CIS benchmark check"
			resp := []generated.FetchComplianceResultByArtifactResponseBody{
				{
					Title: &title,
				},
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchComplianceResultsByArtifactTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-uuid-123",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "CIS benchmark check")
	})

	t.Run("Missing_Artifact_Identifier", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := FetchComplianceResultsByArtifactTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchComplianceResultsByArtifactTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-uuid-123",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})

	t.Run("Empty_Response", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]generated.FetchComplianceResultByArtifactResponseBody{})
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := FetchComplianceResultsByArtifactTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-uuid-123",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// TestSCSGetArtifactDetailComponentView
// ---------------------------------------------------------------------------
func TestSCSGetArtifactDetailComponentView(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := GetArtifactDetailComponentViewTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "get_artifact_component_view", tool.Name)
		assert.Contains(t, tool.Description, "component view")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/artifacts/")
			assert.Contains(t, r.URL.Path, "/components")
			w.Header().Set("Content-Type", "application/json")
			pkgName := "lodash"
			resp := []generated.ArtifactComponentViewResponse{
				{
					PackageName: &pkgName,
				},
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactDetailComponentViewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-uuid-456",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "lodash")
	})

	t.Run("Missing_Artifact_Identifier", func(t *testing.T) {
		client, srv := newSCSClient(t, func(w http.ResponseWriter, r *http.Request) {})
		defer srv.Close()

		_, toolHandler := GetArtifactDetailComponentViewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		assert.True(t, result.IsError)
		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "artifact_identifier")
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactDetailComponentViewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-uuid-456",
		})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})

	t.Run("Empty_Component_List", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]generated.ArtifactComponentViewResponse{})
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := GetArtifactDetailComponentViewTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"artifact_identifier": "art-uuid-456",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})
}

// ---------------------------------------------------------------------------
// TestSCSListCodeRepos
// ---------------------------------------------------------------------------
func TestSCSListCodeRepos(t *testing.T) {
	cfg := newSCSTestConfig()

	t.Run("Tool_Creation", func(t *testing.T) {
		tool, handler := ListSCSCodeReposTool(cfg, nil)
		assert.NotNil(t, tool)
		assert.NotNil(t, handler)
		assert.Equal(t, "list_code_repositories", tool.Name)
		assert.Contains(t, tool.Description, "code repositories")
	})

	t.Run("Happy_Path", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			assert.Contains(t, r.URL.Path, "/code-repos")
			w.Header().Set("Content-Type", "application/json")
			repoName := "my-repo"
			repoID := "repo-uuid-1"
			resp := []generated.CodeRepositoryListingResponse{
				{
					Name: &repoName,
					Id:   &repoID,
				},
			}
			json.NewEncoder(w).Encode(resp)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListSCSCodeReposTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)

		textContent, ok := result.Content[0].(mcp.TextContent)
		require.True(t, ok)
		assert.Contains(t, textContent.Text, "my-repo")
	})

	t.Run("With_Search_Term", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]generated.CodeRepositoryListingResponse{})
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListSCSCodeReposTool(cfg, client)
		request := newToolRequest(map[string]interface{}{
			"search_term": "harness-mcp",
		})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})

	t.Run("Server_Error_500", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListSCSCodeReposTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "non-2xx")
	})

	t.Run("Empty_Results", func(t *testing.T) {
		handlerFunc := func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode([]generated.CodeRepositoryListingResponse{})
		}
		client, srv := newSCSClient(t, handlerFunc)
		defer srv.Close()

		_, toolHandler := ListSCSCodeReposTool(cfg, client)
		request := newToolRequest(map[string]interface{}{})
		result, err := toolHandler(context.Background(), request)
		require.NoError(t, err)
		require.NotNil(t, result)
		assert.False(t, result.IsError)
	})
}
