package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

const (
	jwtHeaderName = "Authorization"
	jwtPrefix     = "IdentityService"
)

type JWTProvider struct {
	token string
}

// JWTClaims represents the expected claims in a Harness JWT token
type JWTClaims struct {
	AccountID         string `json:"accountId"`
	AccountIdentifier string `json:"accountIdentifier"`
	Subject           string `json:"sub"`
	jwt.RegisteredClaims
}

// NewJWTProvider creates a new JWTProvider
func NewJWTProvider(token string) *JWTProvider {
	return &JWTProvider{token: token}
}

// GetHeader returns the JWT authorization header
func (p *JWTProvider) GetHeader(ctx context.Context) (string, string, error) {
	if p.token == "" {
		return "", "", fmt.Errorf("JWT token is empty")
	}
	return jwtHeaderName, fmt.Sprintf("%s %s", jwtPrefix, p.token), nil
}

// ExtractAccountIDFromJWT parses the JWT token and extracts the account ID
// Note: This does NOT verify the signature - it only decodes the claims
// Signature verification should be done by the downstream services
func ExtractAccountIDFromJWT(tokenString string) (string, error) {
	// Parse without verification (we're just extracting claims as a pass-through proxy)
	token, _, err := jwt.NewParser().ParseUnverified(tokenString, &JWTClaims{})
	if err != nil {
		return "", fmt.Errorf("failed to parse JWT: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims type")
	}

	// Try multiple possible claim fields for account ID
	if claims.AccountID != "" {
		return claims.AccountID, nil
	}
	if claims.AccountIdentifier != "" {
		return claims.AccountIdentifier, nil
	}
	if claims.Subject != "" {
		return claims.Subject, nil
	}

	return "", fmt.Errorf("no account ID found in JWT claims")
}

// ParseAuthorizationHeader extracts the JWT token from an Authorization header value
// Expected format: "IdentityService <token>"
func ParseAuthorizationHeader(authHeader string) (string, error) {
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid authorization header format")
	}

	if parts[0] != jwtPrefix {
		return "", fmt.Errorf("invalid authorization scheme, expected %s", jwtPrefix)
	}

	token := strings.TrimSpace(parts[1])
	if token == "" {
		return "", fmt.Errorf("authorization token is empty")
	}

	return token, nil
}
