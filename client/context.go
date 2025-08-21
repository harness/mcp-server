package client

import (
	"context"
)

// accountIDKey is the key for account ID in the context
// Using a string directly for simplicity and cross-package compatibility
const accountIDKey = "accountID"

// GetAccountIDFromContext retrieves the account ID from the context if present
func GetAccountIDFromContext(ctx context.Context) string {
	if accountID, ok := ctx.Value(accountIDKey).(string); ok {
		return accountID
	}
	return ""
}
