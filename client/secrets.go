package client

import (
	"context"
	"fmt"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	secretsBasePath = "/v2/secrets"
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
	addScope(scope, params)

	var response dto.SecretResponse
	err := c.Get(ctx, path, params, nil, &response)
	if err != nil {
		return nil, fmt.Errorf("failed to get secret: %w", err)
	}

	return &response, nil
}
