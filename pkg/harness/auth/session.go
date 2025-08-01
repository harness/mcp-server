package auth

import (
	"context"
	"fmt"

	"github.com/golang-jwt/jwt"
)

// TODO: move this out of here
// Principal represents the identity of an acting entity
type Principal struct {
	ID          int64
	UID         string
	Email       string
	Type        string
	DisplayName string
	AccountID   string // TODO: account should not be associated with principal, we can move this out
}

// Session contains information of the authenticated principal.
type Session struct {
	// Might need to be extended in the future, right now we just need the principal
	Principal Principal
}

// WithAuthSession returns a copy of parent in which the principal
// value is set.
func WithAuthSession(parent context.Context, v *Session) context.Context {
	return context.WithValue(parent, authSessionKey{}, v)
}

// AuthSessionFrom returns the value of the principal key on the
// context.
func AuthSessionFrom(ctx context.Context) (*Session, bool) {
	v, ok := ctx.Value(authSessionKey{}).(*Session)
	return v, ok && v != nil
}

// AuthenticateSession takes a bearer token, decodes it using the secret,
// validates the claims in JWTClaims, and returns a Session object.
// It ensures that basic info is populated (type is USER and name/id are populated).
func AuthenticateSession(bearerToken string, secret string) (*Session, error) {
	// Extract token from the bearer format
	if bearerToken == "" {
		return nil, fmt.Errorf("bearer token is empty")
	}

	// Parse and validate the token
	token, err := jwt.ParseWithClaims(bearerToken, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate the alg is what we expect
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Validate claims
	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		// Validate required fields
		if claims.Type != "USER" {
			return nil, fmt.Errorf("invalid token type: expected USER, got %s", claims.Type)
		}

		if claims.Name == "" {
			return nil, fmt.Errorf("name is required in token claims")
		}

		// Create and return a session with principal information from the claims
		session := &Session{
			Principal: Principal{
				UID:         claims.Name,
				Email:       claims.Email,
				Type:        claims.Type,
				DisplayName: claims.UserName,
				AccountID:   claims.AccountID,
			},
		}

		return session, nil
	}

	return nil, fmt.Errorf("invalid token claims")
}
