package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	"github.com/harness/harness-mcp/cmd/harness-mcp-server/config"
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

	// Create a config for reference
	cfg := &config.Config{
		BaseURL:          baseURL,
		APIKey:           apiKey,
		DefaultOrgID:     orgID,
		DefaultProjectID: projectID,
		AccountID:        accountID,
	}

	// Make a direct API call to get commit diff using a custom HTTP client
	// Since we're removing the handler approach, we'll use a simple HTTP request instead
	// Create the URL for the API call
	apiPath := fmt.Sprintf("%scode/api/v1/repos/%s/+/diff/%s", cfg.BaseURL, repoID, commitID)
	
	// Create HTTP request
	req, err := http.NewRequestWithContext(context.Background(), "GET", apiPath, nil)
	if err != nil {
		log.Fatalf("Error creating request: %v", err)
	}
	
	// Add query parameters
	q := req.URL.Query()
	q.Add("accountIdentifier", accountID)
	q.Add("orgIdentifier", orgID)
	q.Add("projectIdentifier", projectID)
	req.URL.RawQuery = q.Encode()
	
	// Add headers
	req.Header.Set("x-api-key", apiKey)
	
	// Create HTTP client and make the request
	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		log.Fatalf("Error making request: %v", err)
	}
	defer resp.Body.Close()
	
	// Read and parse the response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Error reading response: %v", err)
	}
	
	// Print the result
	fmt.Println("Result:")
	fmt.Println(string(body))
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
