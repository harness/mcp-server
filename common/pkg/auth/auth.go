package auth

import "context"

// Provider is the interface for different authentication mechanisms
type Provider interface {
	GetHeader(ctx context.Context) (key, value string, err error)
}