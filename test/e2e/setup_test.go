// go:build e2e

package e2e_test

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	mcpClient "github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/stretchr/testify/require"
)

var (
	// Shared variables and sync.Once instances to ensure one-time execution
	getTokenOnce sync.Once
	token        string
	tokenErr     error

	getAccountIDOnce sync.Once
	accountID        string
	accountIDErr     error

	getOrgIDOnce sync.Once
	orgID        string

	getProjectIDOnce sync.Once
	projectID        string

	setupClientOnce sync.Once
	testClient      *mcpClient.Client
	setupClientErr  error
)

// getE2EToken ensures the environment variable is checked only once and returns the token
func getE2EToken(t *testing.T) (string, error) {
	getTokenOnce.Do(func() {
		token = os.Getenv("HARNESS_MCP_SERVER_E2E_TOKEN")
		if token == "" {
			tokenErr = fmt.Errorf("HARNESS_MCP_SERVER_E2E_TOKEN environment variable is not set")
		}
	})
	if tokenErr != nil {
		return "", tokenErr
	}
	return token, nil
}

// getE2EAccountID ensures the environment variable is checked only once and returns the account ID
func getE2EAccountID(t *testing.T) (string, error) {
	getAccountIDOnce.Do(func() {
		// First check if explicitly set
		accountID = os.Getenv("HARNESS_MCP_SERVER_E2E_ACCOUNT_ID")
		if accountID != "" {
			return
		}

		// If not set, try to extract from PAT token
		pat, err := getE2EToken(t)
		if err != nil {
			accountIDErr = err
			return
		}
		// PAT format is pat.{account_id}.{token_id}.{token_value}
		parts := strings.Split(pat, ".")
		if len(parts) >= 2 {
			accountID = parts[1]
			return
		}

		// Try to get from HARNESS_MCP_USER_PAT if HARNESS_MCP_SERVER_E2E_TOKEN not set
		pat = os.Getenv("HARNESS_MCP_USER_PAT")
		if pat != "" {
			parts := strings.Split(pat, ".")
			if len(parts) >= 2 {
				accountID = parts[1]
				return
			}
		}

		accountIDErr = fmt.Errorf("could not determine account ID from token or environment variables")
	})
	if accountIDErr != nil {
		return "", accountIDErr
	}
	return accountID, nil
}

// getE2EOrgID ensures the environment variable is checked only once and returns the org ID
func getE2EOrgID() string {
	getOrgIDOnce.Do(func() {
		orgID = os.Getenv("HARNESS_MCP_SERVER_E2E_ORG_ID")
		if orgID == "" {
			// Default to a test org ID if not specified
			orgID = "AI_Devops"
		}
	})
	return orgID
}

// getE2EProjectID ensures the environment variable is checked only once and returns the project ID
func getE2EProjectID() string {
	getProjectIDOnce.Do(func() {
		projectID = os.Getenv("HARNESS_MCP_SERVER_E2E_PROJECT_ID")
		if projectID == "" {
			// Default to a test project ID if not specified
			projectID = "Sanity"
		}
	})
	return projectID
}

// clientOpts holds configuration options for the MCP client setup
type clientOpts struct {
	// Toolsets to enable in the MCP server
	enabledToolsets []string
}

// clientOption defines a function type for configuring ClientOpts
type clientOption func(*clientOpts)

// withToolsets returns an option that sets the toolsets to enable
func withToolsets(toolsets []string) clientOption {
	return func(opts *clientOpts) {
		opts.enabledToolsets = toolsets
	}
}

// setupMCPClient creates and initializes an MCP client for testing
func setupMCPClient(t *testing.T, options ...clientOption) *mcpClient.Client {
	// Only setup once across all tests
	setupClientOnce.Do(func() {
		// Get token
		token, err := getE2EToken(t)
		if err != nil {
			setupClientErr = err
			return
		}
		accountID, err := getE2EAccountID(t)
		if err != nil {
			setupClientErr = err
			return
		}
		// Create and configure options
		opts := &clientOpts{
			enabledToolsets: []string{"ccm", "pipelines", "default"},
		}

		// Apply all options to configure the opts struct
		for _, option := range options {
			option(opts)
		}

		// Create a basic config for the MCP server
		cfg := &config.Config{
			APIKey:           token,
			Toolsets:         opts.enabledToolsets,
			EnableLicense:    false,
			ReadOnly:         true,
			AccountID:        accountID,
			DefaultOrgID:     getE2EOrgID(),
			DefaultProjectID: getE2EProjectID(),
			BaseURL:          os.Getenv("HARNESS_MCP_SERVER_E2E_BASE_URL"),
		}

		// Initialize toolsets
		tsg, err := harness.InitToolsets(context.Background(), cfg)
		if err != nil {
			setupClientErr = err
			return
		}

		// Create an MCP server instance with default options
		mcpServer := harness.NewServer("0.0.1")

		// Register the tools with the server
		tsg.RegisterTools(mcpServer)

		// Create an in-process MCP client
		testClient, err = mcpClient.NewInProcessClient(mcpServer)
		if err != nil {
			setupClientErr = err
			return
		}

		// Initialize the client
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		request := mcp.InitializeRequest{}
		request.Params.ProtocolVersion = "2025-03-26"
		request.Params.ClientInfo = mcp.Implementation{
			Name:    "harness-e2e-test-client",
			Version: "0.0.1",
		}

		_, err = testClient.Initialize(ctx, request)
		if err != nil {
			setupClientErr = err
			return
		}
	})

	// Check if setup was successful
	require.NoError(t, setupClientErr, "expected to setup MCP client successfully")

	return testClient
}

// ensureDockerImageBuilt makes sure the Docker image is built only once across all tests
func ensureDockerImageBuilt(t *testing.T) {
	buildOnce := sync.Once{}
	var buildError error

	buildOnce.Do(func() {
		t.Log("Building Docker image for e2e tests...")
		cmd := exec.Command("docker", "build", "-t", "harness/e2e-mcp-server", ".")
		output, err := cmd.CombinedOutput()
		buildError = err
		if err != nil {
			t.Logf("Docker build output: %s", string(output))
		}
	})

	// Check if the build was successful
	require.NoError(t, buildError, "expected to build Docker image successfully")
}

// runE2ETest is a helper function to run a test with the MCP client
func runE2ETest(t *testing.T, testFunc func(t *testing.T, client *mcpClient.Client, ctx context.Context)) {
	t.Helper()

	// Setup the MCP client
	client := setupMCPClient(t)

	// Create a context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Run the test function
	testFunc(t, client, ctx)
}
