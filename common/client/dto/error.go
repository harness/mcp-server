package dto

// ErrorResponse represents the standard error response format
// returned by the API when an error occurs
type ErrorResponse struct {
	Code    string `json:"code,omitempty"`
	Message string `json:"message,omitempty"`
}
