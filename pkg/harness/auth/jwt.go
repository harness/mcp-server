package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt"
)

var (
	jwtHeaderName = "Authorization"
)

type authSessionKey struct{}

type JWTClaims struct {
	jwt.StandardClaims

	// Common claims
	Type string `json:"type,omitempty"`
	Name string `json:"name,omitempty"`

	// Used on
	Email     string `json:"email,omitempty"`
	UserName  string `json:"username,omitempty"`
	AccountID string `json:"accountId,omitempty"`
}

type JWTProvider struct {
	secret string

	serviceIdentity string
	lifetime        *time.Duration
}

// NewJWTProvider creates a new JWTProvider
func NewJWTProvider(secret string, serviceIdentity string, lifetime *time.Duration) *JWTProvider {
	return &JWTProvider{
		secret:          secret,
		serviceIdentity: serviceIdentity,
		lifetime:        lifetime,
	}
}

func (p *JWTProvider) GetHeader(ctx context.Context) (string, string, error) {
	session, ok := AuthSessionFrom(ctx)
	if !ok || session == nil {
		return "", "", fmt.Errorf("failed to get session")
	}
	issuedAt := time.Now()
	if p.lifetime == nil {
		return "", "", fmt.Errorf("token lifetime is required")
	}
	expiresAt := issuedAt.Add(*p.lifetime)

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, &JWTClaims{
		StandardClaims: jwt.StandardClaims{
			Issuer:    "Harness Inc",
			IssuedAt:  issuedAt.Unix(),
			ExpiresAt: expiresAt.Unix(),
		},
		Type:      "USER",
		Name:      session.Principal.UID,
		Email:     session.Principal.Email,
		UserName:  session.Principal.DisplayName,
		AccountID: session.Principal.AccountID,
	})

	res, err := jwtToken.SignedString([]byte(p.secret))
	if err != nil {
		return "", "", fmt.Errorf("failed to sign token: %w", err)
	}

	return jwtHeaderName, fmt.Sprintf("%s %s", p.serviceIdentity, res), nil
}
