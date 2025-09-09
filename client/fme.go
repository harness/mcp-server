package client

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/pkg/harness/auth"
)

const (
	fmeWorkspaceListPath          = "/internal/api/v2/workspaces"
	fmeEnvironmentListPath        = "/internal/api/v2/environments/ws/%s"
	fmeFeatureFlagListPath        = "/internal/api/v2/splits/ws/%s"
	fmeFeatureFlagEnvironmentPath = "/internal/api/v2/splits/ws/%s/%s/environments/%s"
)

type FMEService struct {
	client  *http.Client
	baseURL string
	auth    auth.Provider
}

func NewFMEService(baseURL string, authProvider auth.Provider) *FMEService {
	return &FMEService{
		client:  defaultHTTPClient(),
		baseURL: baseURL,
		auth:    authProvider,
	}
}

// ListWorkspaces retrieves a list of FME workspaces
func (s *FMEService) ListWorkspaces(ctx context.Context, nameFilter *string) ([]dto.FMEWorkspace, error) {
	params := make(map[string]string)
	if nameFilter != nil && *nameFilter != "" {
		params["name"] = *nameFilter
	}

	var response dto.FMEWorkspaceListResponse
	err := s.makeRequest(ctx, "GET", fmeWorkspaceListPath, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list workspaces: %w", err)
	}

	return response.Objects, nil
}

// ListEnvironments retrieves a list of environments for a given workspace
func (s *FMEService) ListEnvironments(ctx context.Context, workspaceID string, nameFilter *string) ([]dto.FMEEnvironment, error) {
	path := fmt.Sprintf(fmeEnvironmentListPath, workspaceID)
	params := make(map[string]string)

	var environments []dto.FMEEnvironment
	err := s.makeRequest(ctx, "GET", path, params, nil, &environments)
	if err != nil {
		return nil, fmt.Errorf("failed to list environments: %w", err)
	}

	// Apply client-side name filtering if provided
	if nameFilter != nil && *nameFilter != "" {
		filtered := make([]dto.FMEEnvironment, 0)
		for _, env := range environments {
			if strings.Contains(strings.ToLower(env.Name), strings.ToLower(*nameFilter)) {
				filtered = append(filtered, env)
			}
		}
		return filtered, nil
	}

	return environments, nil
}

// ListFeatureFlags retrieves a list of feature flags for a given workspace
func (s *FMEService) ListFeatureFlags(ctx context.Context, workspaceID string, nameFilter *string, limit *int) ([]dto.FMEFeatureFlag, error) {
	path := fmt.Sprintf(fmeFeatureFlagListPath, workspaceID)
	params := make(map[string]string)

	if nameFilter != nil && *nameFilter != "" {
		params["name"] = *nameFilter
	}
	if limit != nil && *limit > 0 {
		params["limit"] = strconv.Itoa(*limit)
	}

	var response dto.FMEFeatureFlagListResponse
	err := s.makeRequest(ctx, "GET", path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list feature flags: %w", err)
	}

	return response.Objects, nil
}

// GetFeatureFlagRolloutStatus retrieves the rollout status for a specific feature flag in an environment
func (s *FMEService) GetFeatureFlagRolloutStatus(ctx context.Context, workspaceID, environmentID, flagName string) (*dto.FMEFeatureFlagRollout, error) {
	path := fmt.Sprintf(fmeFeatureFlagEnvironmentPath, workspaceID, flagName, environmentID)
	params := make(map[string]string)

	var rollout dto.FMEFeatureFlagRollout
	err := s.makeRequest(ctx, "GET", path, params, nil, &rollout)
	if err != nil {
		return nil, fmt.Errorf("failed to get feature flag rollout status: %w", err)
	}

	return &rollout, nil
}

// makeRequest is a helper method to make HTTP requests to the FME API
func (s *FMEService) makeRequest(ctx context.Context, method, path string, params map[string]string, body interface{}, response interface{}) error {
	// Build the URL
	fullURL := s.baseURL + path
	parsedURL, err := url.Parse(fullURL)
	if err != nil {
		return fmt.Errorf("failed to parse URL: %w", err)
	}

	// Add query parameters
	if len(params) > 0 {
		q := parsedURL.Query()
		for key, value := range params {
			q.Add(key, value)
		}
		parsedURL.RawQuery = q.Encode()
	}

	// Create the request
	req, err := http.NewRequestWithContext(ctx, method, parsedURL.String(), nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Add authentication headers
	if s.auth != nil {
		if err := s.auth.Apply(req); err != nil {
			return fmt.Errorf("failed to apply authentication: %w", err)
		}
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	// Make the request
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make HTTP request: %w", err)
	}
	defer resp.Body.Close()

	// Handle HTTP error status codes
	if resp.StatusCode >= 400 {
		return fmt.Errorf("HTTP %d: request failed", resp.StatusCode)
	}

	// Decode the response
	if response != nil {
		if err := json.NewDecoder(resp.Body).Decode(response); err != nil {
			return fmt.Errorf("failed to decode response: %w", err)
		}
	}

	return nil
}