package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt"
)

func TestWithAuthSession(t *testing.T) {
	session := &Session{
		Principal: Principal{
			ID:          123,
			UID:         "test-uid",
			Email:       "test@example.com",
			Type:        "USER",
			DisplayName: "Test User",
			AccountID:   "acc123",
		},
	}

	ctx := context.Background()
	sessionCtx := WithAuthSession(ctx, session)

	// Test that we can retrieve the session
	retrievedSession, ok := AuthSessionFrom(sessionCtx)
	if !ok {
		t.Error("Expected session to be retrievable from context")
	}

	if retrievedSession == nil {
		t.Fatal("Retrieved session is nil")
	}

	if retrievedSession.Principal.ID != session.Principal.ID ||
		retrievedSession.Principal.UID != session.Principal.UID ||
		retrievedSession.Principal.Email != session.Principal.Email ||
		retrievedSession.Principal.Type != session.Principal.Type ||
		retrievedSession.Principal.DisplayName != session.Principal.DisplayName ||
		retrievedSession.Principal.AccountID != session.Principal.AccountID {
		t.Errorf("Retrieved session does not match original session")
	}
}

func TestAuthSessionFrom(t *testing.T) {
	tests := []struct {
		name          string
		setupContext  func() context.Context
		expectSession bool
	}{
		{
			name: "Context with session",
			setupContext: func() context.Context {
				return WithAuthSession(context.Background(), &Session{
					Principal: Principal{UID: "test-uid"},
				})
			},
			expectSession: true,
		},
		{
			name: "Context without session",
			setupContext: func() context.Context {
				return context.Background()
			},
			expectSession: false,
		},
		{
			name: "Context with nil session",
			setupContext: func() context.Context {
				return context.WithValue(context.Background(), authSessionKey{}, nil)
			},
			expectSession: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := tt.setupContext()
			session, ok := AuthSessionFrom(ctx)

			if tt.expectSession {
				if !ok || session == nil {
					t.Errorf("Expected session to be present, got ok=%v, session=%v", ok, session)
				}
			} else {
				if ok && session != nil {
					t.Errorf("Expected no session, got ok=%v, session=%v", ok, session)
				}
			}
		})
	}
}

func TestJWTProvider_GetHeader(t *testing.T) {
	secret := "test-secret"
	serviceIdentity := "test-service"
	lifetime := 1 * time.Hour

	tests := []struct {
		name          string
		setupContext  func() context.Context
		wantErr       bool
		errorContains string
		validateToken func(t *testing.T, key string, value string)
	}{
		{
			name: "Valid session in context",
			setupContext: func() context.Context {
				return WithAuthSession(context.Background(), &Session{
					Principal: Principal{
						ID:          123,
						UID:         "test-uid",
						Email:       "test@example.com",
						Type:        "USER",
						DisplayName: "Test User",
						AccountID:   "acc123",
					},
				})
			},
			wantErr: false,
			validateToken: func(t *testing.T, key string, value string) {
				// Validate header key
				if key != "Authorization" {
					t.Errorf("Expected header key to be 'Authorization', got %s", key)
				}

				// Validate token value is not empty
				if value == "" {
					t.Fatalf("Expected token value to not be empty")
				}

				// The token value has format: "{serviceIdentity} {token}"
				parts := strings.Split(value, " ")
				if len(parts) != 2 {
					t.Fatalf("Expected token value format to be '{serviceIdentity} {token}', got %s", value)
				}

				// Validate service identity
				if parts[0] != serviceIdentity {
					t.Errorf("Expected service identity to be '%s', got '%s'", serviceIdentity, parts[0])
				}

				tokenString := parts[1]

				// Parse token
				token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
					return []byte(secret), nil
				})

				if err != nil {
					t.Errorf("Failed to parse token: %v", err)
					return
				}

				if !token.Valid {
					t.Errorf("Token is not valid")
				}

				claims, ok := token.Claims.(jwt.MapClaims)
				if !ok {
					t.Errorf("Failed to extract claims from token")
					return
				}

				// Validate claims
				if claims["name"] != "test-uid" {
					t.Errorf("Expected name claim to be 'test-uid', got %v", claims["name"])
				}

				if claims["email"] != "test@example.com" {
					t.Errorf("Expected email claim to be 'test@example.com', got %v", claims["email"])
				}

				if claims["username"] != "Test User" {
					t.Errorf("Expected username claim to be 'Test User', got %v", claims["username"])
				}

				if claims["accountId"] != "acc123" {
					t.Errorf("Expected accountId claim to be 'acc123', got %v", claims["accountId"])
				}
			},
		},
		{
			name: "No session in context",
			setupContext: func() context.Context {
				return context.Background()
			},
			wantErr:       true,
			errorContains: "failed to get session",
		},
		{
			name: "Nil session in context",
			setupContext: func() context.Context {
				return context.WithValue(context.Background(), authSessionKey{}, nil)
			},
			wantErr:       true,
			errorContains: "failed to get session",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := &JWTProvider{
				secret:          secret,
				serviceIdentity: serviceIdentity,
				lifetime:        &lifetime,
			}

			ctx := tt.setupContext()
			key, value, err := provider.GetHeader(ctx)

			if tt.wantErr {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if tt.errorContains != "" && !strings.Contains(err.Error(), tt.errorContains) {
					t.Errorf("Expected error containing %q, got %q", tt.errorContains, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if tt.validateToken != nil {
				tt.validateToken(t, key, value)
			}
		})
	}
}

func TestJWTProvider_GetHeader_NoLifetime(t *testing.T) {
	provider := &JWTProvider{
		secret:          "test-secret",
		serviceIdentity: "test-service",
		lifetime:        nil, // Missing lifetime
	}

	ctx := WithAuthSession(context.Background(), &Session{
		Principal: Principal{UID: "test-uid"},
	})

	_, _, err := provider.GetHeader(ctx)
	if err == nil {
		t.Error("Expected error for missing lifetime, got none")
	}

	if !strings.Contains(err.Error(), "token lifetime is required") {
		t.Errorf("Expected error about token lifetime, got: %v", err)
	}
}
