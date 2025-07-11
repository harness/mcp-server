package client

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
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
