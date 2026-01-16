package auth

import (
	"context"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

func TestJWTProvider_GetHeader(t *testing.T) {
	tests := []struct {
		name      string
		token     string
		wantKey   string
		wantValue string
		wantErr   bool
	}{
		{
			name:      "Valid token",
			token:     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
			wantKey:   "Authorization",
			wantValue: "IdentityService eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
			wantErr:   false,
		},
		{
			name:    "Empty token",
			token:   "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := NewJWTProvider(tt.token)
			key, value, err := p.GetHeader(context.Background())

			if (err != nil) != tt.wantErr {
				t.Errorf("GetHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if key != tt.wantKey {
					t.Errorf("GetHeader() key = %v, want %v", key, tt.wantKey)
				}
				if value != tt.wantValue {
					t.Errorf("GetHeader() value = %v, want %v", value, tt.wantValue)
				}
			}
		})
	}
}

func TestExtractAccountIDFromJWT(t *testing.T) {
	// Helper to create test JWT
	createTestJWT := func(claims jwt.MapClaims) string {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
		tokenString, _ := token.SignedString([]byte("test-secret"))
		return tokenString
	}

	tests := []struct {
		name    string
		token   string
		wantID  string
		wantErr bool
	}{
		{
			name:    "JWT with accountId",
			token:   createTestJWT(jwt.MapClaims{"accountId": "acc123"}),
			wantID:  "acc123",
			wantErr: false,
		},
		{
			name:    "JWT with accountIdentifier",
			token:   createTestJWT(jwt.MapClaims{"accountIdentifier": "acc456"}),
			wantID:  "acc456",
			wantErr: false,
		},
		{
			name:    "JWT with sub claim",
			token:   createTestJWT(jwt.MapClaims{"sub": "acc789"}),
			wantID:  "acc789",
			wantErr: false,
		},
		{
			name:    "JWT without account claims",
			token:   createTestJWT(jwt.MapClaims{"other": "value"}),
			wantErr: true,
		},
		{
			name:    "Invalid JWT",
			token:   "invalid.token.here",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotID, err := ExtractAccountIDFromJWT(tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractAccountIDFromJWT() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && gotID != tt.wantID {
				t.Errorf("ExtractAccountIDFromJWT() = %v, want %v", gotID, tt.wantID)
			}
		})
	}
}

func TestParseAuthorizationHeader(t *testing.T) {
	tests := []struct {
		name      string
		header    string
		wantToken string
		wantErr   bool
	}{
		{
			name:      "Valid header",
			header:    "IdentityService eyJhbGc.token.here",
			wantToken: "eyJhbGc.token.here",
			wantErr:   false,
		},
		{
			name:    "Wrong prefix",
			header:  "Bearer token",
			wantErr: true,
		},
		{
			name:    "Missing token",
			header:  "IdentityService",
			wantErr: true,
		},
		{
			name:    "No space",
			header:  "IdentityServicetoken",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := ParseAuthorizationHeader(tt.header)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseAuthorizationHeader() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && token != tt.wantToken {
				t.Errorf("ParseAuthorizationHeader() = %v, want %v", token, tt.wantToken)
			}
		})
	}
}
