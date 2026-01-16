package client

import (
	"context"
	"fmt"

	"github.com/harness/mcp-server/common/client/dto"
	"log/slog"
)

const (
	secretsBasePath = "/v2/secrets"
	listSecretsPath = "/v2/secrets/list/secrets"
)

// SecretsClient provides methods to interact with the Harness secrets API
type SecretsClient struct {
	*Client
}

// GetSecret retrieves a secret by its identifier
func (c *SecretsClient) GetSecret(ctx context.Context, scope dto.Scope, secretIdentifier string) (*dto.SecretResponse, error) {
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}

	path := fmt.Sprintf("%s/%s", secretsBasePath, secretIdentifier)
	params := make(map[string]string)
	addScope(ctx, scope, params)

	var response dto.SecretResponse
	err := c.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}

	return &response, nil
}

// ListSecrets retrieves a list of secrets with pagination and filtering options
func (c *SecretsClient) ListSecrets(ctx context.Context, scope dto.Scope, pageIndex, pageSize int, sortOrders []string, filters dto.SecretFilterProperties) (*dto.ListSecretsResponse, error) {
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}

	params := make(map[string]string)
	addScope(ctx, scope, params)

	// Add pagination parameters
	params["pageIndex"] = fmt.Sprintf("%d", pageIndex)
	params["pageSize"] = fmt.Sprintf("%d", pageSize)

	// The API requires filterType in the request body
	// Ensure filterType is set to "Secret" for listing secrets
	if filters.FilterType == "" {
		filters.FilterType = "Secret"
	}
	reqBody := filters
	slog.InfoContext(ctx, "Request body", "body", reqBody)
	var response dto.ListSecretsResponse
	headers := make(map[string]string)
	err := c.Post(ctx, listSecretsPath, params, reqBody, headers, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to list secrets: %w", err)
	}

	return &response, nil
}
