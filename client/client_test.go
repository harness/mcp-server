package client

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/pkg/harness/common"
	"github.com/stretchr/testify/assert"
)

// TestUnmarshalResponse_StringPointer tests the string pointer handling in unmarshalResponse function
func TestUnmarshalResponse_StringPointer(t *testing.T) {
	tests := []struct {
		name           string
		responseBody   string
		expectedResult string
	}{
		{
			name:           "Plain text response",
			responseBody:   "This is a plain text response",
			expectedResult: "This is a plain text response",
		},
		{
			name:           "JSON-like text response",
			responseBody:   "{\"key\": \"value\"}",
			expectedResult: "{\"key\": \"value\"}",
		},
		{
			name:           "Empty response",
			responseBody:   "",
			expectedResult: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock response
			resp := &http.Response{
				Body: io.NopCloser(bytes.NewBufferString(tt.responseBody)),
			}

			// Create a string pointer to unmarshal into
			var result string

			// Call the function
			err := unmarshalResponse(resp, &result)

			// Assert no error occurred
			if err != nil {
				t.Errorf("Expected no error, got %v", err)
			}

			// Assert the result matches expected
			if tt.expectedResult != result {
				t.Errorf("Expected result %v, got %v", tt.expectedResult, result)
			}
		})
	}
}

// TestUnmarshalResponse_JSONStruct tests the JSON unmarshaling into struct types
func TestUnmarshalResponse_JSONStruct(t *testing.T) {
	// Define a test struct that matches a sample JSON response
	type testStruct struct {
		Name    string `json:"name"`
		Value   int    `json:"value"`
		Enabled bool   `json:"enabled"`
	}

	tests := []struct {
		name           string
		responseBody   string
		expectedResult testStruct
	}{
		{
			name:         "Valid JSON struct",
			responseBody: `{"name":"test","value":42,"enabled":true}`,
			expectedResult: testStruct{
				Name:    "test",
				Value:   42,
				Enabled: true,
			},
		},
		{
			name:         "Partial JSON struct",
			responseBody: `{"name":"partial"}`,
			expectedResult: testStruct{
				Name:    "partial",
				Value:   0,
				Enabled: false,
			},
		},
		{
			name:         "Complex nested JSON",
			responseBody: `{"name":"nested","value":123,"enabled":true}`,
			expectedResult: testStruct{
				Name:    "nested",
				Value:   123,
				Enabled: true,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock response
			resp := &http.Response{
				Body: io.NopCloser(bytes.NewBufferString(tt.responseBody)),
			}

			// Create a struct to unmarshal into
			var result testStruct

			// Call the function
			err := unmarshalResponse(resp, &result)

			// Assert no error occurred
			if err != nil {
				t.Errorf("Expected no error, got %v", err)
			}

			// Assert the result matches expected
			if tt.expectedResult.Name != result.Name ||
				tt.expectedResult.Value != result.Value ||
				tt.expectedResult.Enabled != result.Enabled {
				t.Errorf("Expected result %+v, got %+v", tt.expectedResult, result)
			}
		})
	}
}

// TestUnmarshalResponse_ErrorResponse tests the error response handling in unmarshalResponse function
func TestUnmarshalResponse_ErrorResponse(t *testing.T) {
	tests := []struct {
		name          string
		responseBody  string
		statusCode    int
		expectedError string
	}{
		{
			name:          "API error response",
			responseBody:  `{"code":"INVALID_REQUEST","message":"Invalid input parameters"}`,
			statusCode:    400,
			expectedError: "API error: Invalid input parameters",
		},
		{
			name:         "Non-JSON error response",
			responseBody: "Internal server error occurred",
			statusCode:   500,
			// Non-JSON content will cause unmarshal error
			expectedError: "error deserializing response body",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock response with error status code
			resp := &http.Response{
				StatusCode: tt.statusCode,
				Body:       io.NopCloser(bytes.NewBufferString(tt.responseBody)),
			}

			// Create a struct to unmarshal into
			var result map[string]interface{}

			// Call the function
			err := unmarshalResponse(resp, &result)

			// Assert error occurred and contains expected message
			if err == nil {
				t.Errorf("Expected error, got nil")
			} else if !strings.Contains(err.Error(), tt.expectedError) {
				t.Errorf("Expected error containing '%s', got '%s'", tt.expectedError, err.Error())
			}
		})
	}
}

// TestUnmarshalResponse_ErrorCases tests various error handling scenarios in unmarshalResponse function
func TestUnmarshalResponse_ErrorCases(t *testing.T) {
	tests := []struct {
		name          string
		resp          *http.Response
		expectedError string
	}{
		{
			name:          "Nil response",
			resp:          nil,
			expectedError: "http response body is not available",
		},
		{
			name: "Nil body",
			resp: &http.Response{
				Body: nil,
			},
			expectedError: "http response body is not available",
		},
		{
			name: "Read body error",
			resp: &http.Response{
				Body: &errorReader{},
			},
			expectedError: "error reading response body",
		},
		{
			name: "Invalid JSON",
			resp: &http.Response{
				Body: io.NopCloser(bytes.NewBufferString("{invalid json:}")),
			},
			expectedError: "error deserializing response body",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a struct to unmarshal into
			var result map[string]interface{}

			// Call the function
			err := unmarshalResponse(tt.resp, &result)

			// Assert error occurred and contains expected message
			if err == nil {
				t.Errorf("Expected error, got nil")
			} else if !strings.Contains(err.Error(), tt.expectedError) {
				t.Errorf("Expected error containing '%s', got '%s'", tt.expectedError, err.Error())
			}
		})
	}
}

type errorReader struct{}

func (e *errorReader) Read(p []byte) (n int, err error) {
	return 0, errors.New("mock read error")
}

func (e *errorReader) Close() error {
	return nil
}

// --- New tests for Harness-Account header injection via scope ---

type mockAuthProvider struct{}

func (m mockAuthProvider) GetHeader(ctx context.Context) (string, string, error) {
	return "Authorization", "Bearer test-token", nil
}

type recordingTransport struct {
	sawAccount string
}

func (rt *recordingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	rt.sawAccount = req.Header.Get("Harness-Account")
	return &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader("ok")),
		Header:     make(http.Header),
		Request:    req,
	}, nil
}

func TestClientDo_AddsHarnessAccountHeader_FromScope(t *testing.T) {
	// Prepare client with recording transport
	rt := &recordingTransport{}
	c := &Client{
		client:       &http.Client{Transport: rt},
		AuthProvider: mockAuthProvider{},
	}

	// Build request with scope in context
	req, err := http.NewRequest(http.MethodGet, "http://example.com/test", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	scope := dto.Scope{AccountID: "acc_123", OrgID: "org", ProjectID: "proj"}
	ctx := common.WithScopeContext(context.Background(), scope)
	req = req.WithContext(ctx)

	// Execute
	if _, err := c.Do(req); err != nil {
		t.Fatalf("Do() returned error: %v", err)
	}

	// Assert
	if rt.sawAccount != scope.AccountID {
		t.Fatalf("expected Harness-Account header %q, got %q", scope.AccountID, rt.sawAccount)
	}
}

func TestClientDo_DoesNotAddHarnessAccountHeader_WhenNoScope(t *testing.T) {
	rt := &recordingTransport{}
	c := &Client{
		client:       &http.Client{Transport: rt},
		AuthProvider: mockAuthProvider{},
	}

	req, err := http.NewRequest(http.MethodGet, "http://example.com/test", nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}

	if _, err := c.Do(req); err != nil {
		t.Fatalf("Do() returned error: %v", err)
	}

	if rt.sawAccount != "" {
		t.Fatalf("expected no Harness-Account header, got %q", rt.sawAccount)
	}
}

func TestAddQueryParams(t *testing.T) {
	tests := []struct {
		name           string
		baseURL        string
		params         map[string]string
		expectedQuery  string
		description    string
	}{
		{
			name:          "Empty params - no query string added",
			baseURL:       "https://api.example.com/endpoint",
			params:        map[string]string{},
			expectedQuery: "",
			description:   "Should not modify URL when params are empty",
		},
		{
			name:    "Single param without special characters",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"key": "value",
			},
			expectedQuery: "key=value",
			description:   "Should add simple key-value pair",
		},
		{
			name:    "Param with space - should encode as %20",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"searchKey": "Team/Department Cost",
			},
			expectedQuery: "searchKey=Team%2FDepartment%20Cost",
			description:   "Spaces should be encoded as %20 for Java backend compatibility",
		},
		{
			name:    "Param with comma - should split into multiple values",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"ids": "id1,id2,id3",
			},
			expectedQuery: "ids=id1&ids=id2&ids=id3",
			description:   "Comma-separated values should be split into multiple params",
		},
		{
			name:    "Multiple params",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"accountId": "abc123",
				"pageSize":  "10",
				"sortOrder": "ASCENDING",
			},
			expectedQuery: "accountId=abc123&pageSize=10&sortOrder=ASCENDING",
			description:   "Should handle multiple parameters",
		},
		{
			name:    "Param with special characters",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"filter": "name=test&status=active",
			},
			expectedQuery: "filter=name%3Dtest%26status%3Dactive",
			description:   "Special characters should be properly encoded",
		},
		{
			name:    "Param with plus sign - should be encoded as %2B",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"expression": "a+b",
			},
			expectedQuery: "expression=a%2Bb",
			description:   "Plus signs should be encoded to avoid confusion with space encoding",
		},
		{
			name:    "Complex scenario - spaces, commas, and special chars",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"searchKey": "Cost Analysis Report",
				"accounts":  "acc1,acc2",
				"filter":    "type=AWS",
			},
			expectedQuery: "accounts=acc1&accounts=acc2&filter=type%3DAWS&searchKey=Cost%20Analysis%20Report",
			description:   "Should handle complex combination of encodings",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a request with the base URL
			req, err := http.NewRequest("GET", tt.baseURL, nil)
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}

			// Call the function
			addQueryParams(req, tt.params)

			// Check the result
			if tt.expectedQuery == "" {
				assert.Empty(t, req.URL.RawQuery, tt.description)
			} else {
				// Parse both query strings to compare them regardless of parameter order
				expectedValues, err := url.ParseQuery(tt.expectedQuery)
				if err != nil {
					t.Fatalf("Failed to parse expected query: %v", err)
				}
				actualValues, err := url.ParseQuery(req.URL.RawQuery)
				if err != nil {
					t.Fatalf("Failed to parse actual query: %v", err)
				}

				assert.Equal(t, expectedValues, actualValues,
					"%s\nExpected query: %s\nActual query: %s",
					tt.description, tt.expectedQuery, req.URL.RawQuery)
			}

			// Verify that spaces are encoded as %20, not +
			if strings.Contains(tt.expectedQuery, "%20") {
				assert.NotContains(t, req.URL.RawQuery, "+",
					"Spaces should be encoded as %%20, not + (for Java backend compatibility)")
			}
		})
	}
}

func TestAddQueryParamsWithoutSplittingValuesOnComma(t *testing.T) {
	tests := []struct {
		name           string
		baseURL        string
		params         map[string]string
		expectedQuery  string
		description    string
	}{
		{
			name:          "Empty params - no query string added",
			baseURL:       "https://api.example.com/endpoint",
			params:        map[string]string{},
			expectedQuery: "",
			description:   "Should not modify URL when params are empty",
		},
		{
			name:    "Single param without special characters",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"key": "value",
			},
			expectedQuery: "key=value",
			description:   "Should add simple key-value pair",
		},
		{
			name:    "Param with space - should encode as %20",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"searchKey": "Team/Department Cost",
			},
			expectedQuery: "searchKey=Team%2FDepartment%20Cost",
			description:   "Spaces should be encoded as %20 for Java backend compatibility",
		},
		{
			name:    "Param with comma - should NOT split (key difference from addQueryParams)",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"ids": "id1,id2,id3",
			},
			expectedQuery: "ids=id1%2Cid2%2Cid3",
			description:   "Comma should be preserved as part of the value, not split",
		},
		{
			name:    "Multiple params with commas",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"accountId": "abc123",
				"tags":      "env:prod,team:backend,region:us-east",
			},
			expectedQuery: "accountId=abc123&tags=env%3Aprod%2Cteam%3Abackend%2Cregion%3Aus-east",
			description:   "Commas in values should be preserved and encoded",
		},
		{
			name:    "Param with spaces and commas together",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"filter": "name=Test Project, status=active",
			},
			expectedQuery: "filter=name%3DTest%20Project%2C%20status%3Dactive",
			description:   "Both spaces and commas should be properly encoded without splitting",
		},
		{
			name:    "Complex JSON-like value",
			baseURL: "https://api.example.com/endpoint",
			params: map[string]string{
				"config": `{"key1":"value1","key2":"value2"}`,
			},
			expectedQuery: "config=%7B%22key1%22%3A%22value1%22%2C%22key2%22%3A%22value2%22%7D",
			description:   "JSON-like strings should be fully encoded without splitting on commas",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a request with the base URL
			req, err := http.NewRequest("GET", tt.baseURL, nil)
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}

			// Call the function
			addQueryParamsWithoutSplittingValuesOnComma(req, tt.params)

			// Check the result
			if tt.expectedQuery == "" {
				assert.Empty(t, req.URL.RawQuery, tt.description)
			} else {
				// Parse both query strings to compare them regardless of parameter order
				expectedValues, err := url.ParseQuery(tt.expectedQuery)
				if err != nil {
					t.Fatalf("Failed to parse expected query: %v", err)
				}
				actualValues, err := url.ParseQuery(req.URL.RawQuery)
				if err != nil {
					t.Fatalf("Failed to parse actual query: %v", err)
				}

				assert.Equal(t, expectedValues, actualValues,
					"%s\nExpected query: %s\nActual query: %s",
					tt.description, tt.expectedQuery, req.URL.RawQuery)
			}

			// Verify that spaces are encoded as %20, not +
			if strings.Contains(tt.expectedQuery, "%20") {
				assert.NotContains(t, req.URL.RawQuery, "+",
					"Spaces should be encoded as %%20, not + (for Java backend compatibility)")
			}
		})
	}
}

// TestAddQueryParams_SpaceEncodingCompatibility specifically tests the space encoding fix
func TestAddQueryParams_SpaceEncodingCompatibility(t *testing.T) {
	req, _ := http.NewRequest("GET", "https://api.example.com/perspectives", nil)
	
	params := map[string]string{
		"searchKey": "Team/Department Cost Perspective",
		"accountId": "Z60xsRGoTeqOoAFRCsmlBQ",
	}
	
	addQueryParams(req, params)
	
	// The critical assertion: spaces must be encoded as %20, not +
	assert.Contains(t, req.URL.RawQuery, "Team%2FDepartment%20Cost%20Perspective",
		"Spaces in searchKey should be encoded as %%20")
	assert.NotContains(t, req.URL.RawQuery, "+",
		"Query string should not contain + for space encoding (Java backend compatibility)")
	
	// Verify the full query can be parsed correctly
	parsedQuery := req.URL.Query()
	assert.Equal(t, "Team/Department Cost Perspective", parsedQuery.Get("searchKey"),
		"Parsed searchKey should have spaces decoded correctly")
}

// TestAddQueryParams_CommaHandlingDifference demonstrates the difference between the two functions
func TestAddQueryParams_CommaHandlingDifference(t *testing.T) {
	t.Run("addQueryParams splits on comma", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "https://api.example.com/test", nil)
		params := map[string]string{"ids": "id1,id2,id3"}
		
		addQueryParams(req, params)
		
		parsedQuery := req.URL.Query()
		assert.Equal(t, []string{"id1", "id2", "id3"}, parsedQuery["ids"],
			"addQueryParams should split comma-separated values into multiple params")
	})
	
	t.Run("addQueryParamsWithoutSplittingValuesOnComma preserves comma", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "https://api.example.com/test", nil)
		params := map[string]string{"ids": "id1,id2,id3"}
		
		addQueryParamsWithoutSplittingValuesOnComma(req, params)
		
		parsedQuery := req.URL.Query()
		assert.Equal(t, []string{"id1,id2,id3"}, parsedQuery["ids"],
			"addQueryParamsWithoutSplittingValuesOnComma should preserve comma as part of value")
	})
}

