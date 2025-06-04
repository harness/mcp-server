package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"

	"github.com/harness/harness-mcp/client"
	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
	"github.com/harness/harness-mcp/pkg/harness"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/mark3labs/mcp-go/mcp"
)

func main() {
	// Define command line flags for all parameters
	baseURLFlag := flag.String("base-url", "", "Harness API base URL (e.g., https://app.harness.io/)")
	apiKeyFlag := flag.String("api-key", "", "Harness API key")
	orgIDFlag := flag.String("org-id", "", "Organization ID")
	projectIDFlag := flag.String("project-id", "", "Project ID")
	accountIDFlag := flag.String("account-id", "", "Account ID")
	repoIDFlag := flag.String("repo-id", "", "Repository identifier")
	commitIDFlag := flag.String("commit-id", "", "Commit ID to get diff for")

	// Parse command line flags
	flag.Parse()

	// Get values from environment variables if not provided via flags
	baseURL := getValueWithFallback(*baseURLFlag, "HARNESS_BASE_URL", "https://app.harness.io/")
	apiKey := getValueWithFallback(*apiKeyFlag, "HARNESS_API_KEY", "")
	orgID := getValueWithFallback(*orgIDFlag, "HARNESS_ORG_ID", "default")
	projectID := getValueWithFallback(*projectIDFlag, "HARNESS_PROJECT_ID", "")
	accountID := getValueWithFallback(*accountIDFlag, "HARNESS_ACCOUNT_ID", "")
	repoID := getValueWithFallback(*repoIDFlag, "HARNESS_REPO_ID", "")
	commitID := getValueWithFallback(*commitIDFlag, "HARNESS_COMMIT_ID", "")

	// Validate required parameters
	if apiKey == "" {
		log.Fatal("API key is required. Provide it via --api-key flag or HARNESS_API_KEY environment variable")
	}
	if projectID == "" {
		log.Fatal("Project ID is required. Provide it via --project-id flag or HARNESS_PROJECT_ID environment variable")
	}
	if accountID == "" {
		log.Fatal("Account ID is required. Provide it via --account-id flag or HARNESS_ACCOUNT_ID environment variable")
	}
	if repoID == "" {
		log.Fatal("Repository ID is required. Provide it via --repo-id flag or HARNESS_REPO_ID environment variable")
	}
	if commitID == "" {
		log.Fatal("Commit ID is required. Provide it via --commit-id flag or HARNESS_COMMIT_ID environment variable")
	}

	// Create a config
	cfg := &config.Config{
		BaseURL:          baseURL,
		APIKey:           apiKey,
		DefaultOrgID:     orgID,
		DefaultProjectID: projectID,
		AccountID:        accountID,
	}

	// Create auth provider
	authProvider := auth.NewAPIKeyProvider(apiKey)

	// Create client
	c, err := client.NewWithAuthProvider(cfg.BaseURL, authProvider)
	if err != nil {
		log.Fatalf("Failed to create client: %v", err)
	}

	// Create the commit diff tool
	tool, handler := harness.GetCommitDiffTool(cfg, c)

	// Create a request
	request := mcp.CallToolRequest{
		Params: mcp.CallToolParams{
			Name: tool.Name,
			Arguments: map[string]interface{}{
				"repo_identifier": repoID,
				"commit_id":       commitID,
				"org_id":          orgID,
				"project_id":      projectID,
			},
		},
	}

	// Call the handler
	result, err := handler(context.Background(), request)
	if err != nil {
		log.Fatalf("Error calling handler: %v", err)
	}

	// Print the result
	fmt.Println("Result:")
	fmt.Println(result.Result)
}

// getValueWithFallback returns the first non-empty value from:
// 1. The provided flag value
// 2. The environment variable with the given name
// 3. The default value
func getValueWithFallback(flagValue, envName, defaultValue string) string {
	if flagValue != "" {
		return flagValue
	}
	
	envValue := os.Getenv(envName)
	if envValue != "" {
		return envValue
	}
	
	return defaultValue
}
