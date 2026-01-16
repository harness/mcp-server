package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	config "github.com/harness/mcp-server/common"
	"github.com/harness/mcp-server/common/pkg/auth"
)

func TestMiddleware_JWTAuthentication_Success(t *testing.T) {
	// Create test JWT with accountId claim
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"accountId": "test-account-123",
	})
	tokenString, _ := token.SignedString([]byte("secret"))

	cfg := &config.McpServerConfig{}
	provider := &ExternalAccountExtractorMiddlewareProvider{}

	handler := provider.CreateAccountExtractorMiddleware(nil, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth is in context
		key, value, ok := auth.GetAuthFromContext(r.Context())
		if !ok {
			t.Error("Expected auth in context")
		}
		if key != "Authorization" {
			t.Errorf("Expected key 'Authorization', got %v", key)
		}
		if value != "IdentityService "+tokenString {
			t.Error("Expected JWT in context value")
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "IdentityService "+tokenString)
	req.Header.Set("Harness-Account", "test-account-123")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestMiddleware_APIKeyAuthentication_Success(t *testing.T) {
	cfg := &config.McpServerConfig{}
	provider := &ExternalAccountExtractorMiddlewareProvider{}

	handler := provider.CreateAccountExtractorMiddleware(nil, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, value, ok := auth.GetAuthFromContext(r.Context())
		if !ok {
			t.Error("Expected auth in context")
		}
		if key != "x-api-key" {
			t.Errorf("Expected key 'x-api-key', got %v", key)
		}
		if value != "pat.account123.token456" {
			t.Errorf("Expected API key in context value, got %v", value)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("x-api-key", "pat.account123.token456")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestMiddleware_NoAuthWithConfigFallback(t *testing.T) {
	cfg := &config.McpServerConfig{
		APIKey:    "pat.fallback-account.token",
		AccountID: "fallback-account",
	}
	provider := &ExternalAccountExtractorMiddlewareProvider{}

	handler := provider.CreateAccountExtractorMiddleware(nil, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}
}

func TestMiddleware_NoAuthNoFallback_Returns401(t *testing.T) {
	cfg := &config.McpServerConfig{}
	provider := &ExternalAccountExtractorMiddlewareProvider{}

	handler := provider.CreateAccountExtractorMiddleware(nil, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestMiddleware_InvalidAuthorizationHeader_Returns401(t *testing.T) {
	cfg := &config.McpServerConfig{}
	provider := &ExternalAccountExtractorMiddlewareProvider{}

	handler := provider.CreateAccountExtractorMiddleware(nil, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	// Invalid format - missing token after "IdentityService "
	req.Header.Set("Authorization", "IdentityService ")
	req.Header.Set("Harness-Account", "test-account")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}

func TestMiddleware_JWTWithoutHarnessAccountHeader_Returns401(t *testing.T) {
	// Create valid JWT but don't provide Harness-Account header
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"accountId": "test-account-123",
	})
	tokenString, _ := token.SignedString([]byte("secret"))

	cfg := &config.McpServerConfig{}
	provider := &ExternalAccountExtractorMiddlewareProvider{}

	handler := provider.CreateAccountExtractorMiddleware(nil, cfg, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called when Harness-Account header is missing")
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "IdentityService "+tokenString)
	// Intentionally NOT setting Harness-Account header
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Expected status 401, got %d", w.Code)
	}
}
