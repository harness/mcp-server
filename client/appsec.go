package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/pkg/harness/auth"
)

// AppSecService handles communication with the AppSec GraphQL API
type AppSecService struct {
	Client *Client
}

// GraphQLRequest represents a GraphQL request payload
type GraphQLRequest struct {
	Query     string                 `json:"query"`
	Variables map[string]interface{} `json:"variables,omitempty"`
}

// GraphQLResponse represents a GraphQL response
type GraphQLResponse struct {
	Data   interface{} `json:"data"`
	Errors []struct {
		Message string        `json:"message"`
		Path    []interface{} `json:"path,omitempty"`
	} `json:"errors,omitempty"`
}

// LLMChatQuery executes a query against the AppSec GraphQL llmChat API and returns structured data
func (s *AppSecService) LLMChatQuery(ctx context.Context, query string) ([]dto.AppSecResponseItem, error) {
	// Get authentication session from context
	session, ok := auth.AuthSessionFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("authentication session not found in context")
	}

	// Prepare the GraphQL subscription for llmChat
	graphqlQuery := `
		subscription {
			llmChat(
				chatRequest: {
					chatRequestType: CHAT_QUERY,
					userInputs: [$userInput]
				}
			) {
				count
				total
				results {
					agentResponse
				}
			}
		}
	`

	reqBody := GraphQLRequest{
		Query: graphqlQuery,
		Variables: map[string]interface{}{
			"userInput": query,
		},
	}

	// Marshal request body
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", s.Client.BaseURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("accountId", session.Principal.AccountID)
	req.Header.Set("origin", "mcp-server") // Set origin as mcp-server

	// Set appsec-token from session or config
	// For now, we'll use the AccountID as appsec-token, but this might need to be adjusted
	// based on the actual AppSec authentication requirements
	req.Header.Set("appsec-token", session.Principal.AccountID)

	// Add any additional authentication headers from the base client
	if s.Client.AuthProvider != nil {
		authKey, authValue, err := s.Client.AuthProvider.GetHeader(ctx)
		if err == nil && authKey != "" && authValue != "" {
			req.Header.Set(authKey, authValue)
		}
	}

	// Execute request
	resp, err := s.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AppSec API returned status %d: %s", resp.StatusCode, resp.Status)
	}

	// Parse response as array of AppSecResponseItem
	var appSecResp []dto.AppSecResponseItem
	if err := json.NewDecoder(resp.Body).Decode(&appSecResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return appSecResp, nil
}
