package tools

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/mark3labs/mcp-go/mcp"
)

// Helper functions for parameter handling

// OptionalParamOK is a helper function that can be used to fetch a requested parameter from the request.
// It returns the value, a boolean indicating if the parameter was present, and an error if the type is wrong.
func OptionalParamOK[T any](r mcp.CallToolRequest, p string) (value T, ok bool, err error) {
	// Check if the parameter is present in the request
	val, exists := r.GetArguments()[p]
	if !exists {
		// Not present, return zero value, false, no error
		return
	}

	// Check if the parameter is of the expected type
	value, ok = val.(T)
	if !ok {
		// Present but wrong type
		err = fmt.Errorf("parameter %s is not of type %T, is %T", p, value, val)
		ok = true // Set ok to true because the parameter *was* present, even if wrong type
		return
	}

	// Present and correct type
	ok = true
	return
}

// RequiredParamOK is a helper function to make RequiredParam public without removing it to avoid conflicts.
func RequiredParamOK[T comparable](r mcp.CallToolRequest, p string) (T, error) {
	return RequiredParam[T](r, p)
}

// RequiredParam is a helper function that can be used to fetch a required parameter from the request.
func RequiredParam[T comparable](r mcp.CallToolRequest, p string) (T, error) {
	var zero T

	// Check if the parameter is present in the request
	if _, ok := r.GetArguments()[p]; !ok {
		return zero, fmt.Errorf("missing required parameter: %s", p)
	}

	// Check if the parameter is of the expected type
	if _, ok := r.GetArguments()[p].(T); !ok {
		return zero, fmt.Errorf("parameter %s is not of type %T", p, zero)
	}

	if r.GetArguments()[p].(T) == zero {
		return zero, fmt.Errorf("missing required parameter: %s", p)
	}

	return r.GetArguments()[p].(T), nil
}

// OptionalParam is a helper function that can be used to fetch an optional parameter from the request.
func OptionalParam[T any](r mcp.CallToolRequest, p string) (T, error) {
	var zero T

	// Check if the parameter is present in the request
	if _, ok := r.GetArguments()[p]; !ok {
		return zero, nil
	}

	// Check if the parameter is of the expected type
	if _, ok := r.GetArguments()[p].(T); !ok {
		return zero, fmt.Errorf("parameter %s is not of type %T, is %T", p, zero, r.GetArguments()[p])
	}

	return r.GetArguments()[p].(T), nil
}

func ExtractParam[T any](r mcp.CallToolRequest, key string) (T, error) {
	var zero T

	raw, ok := r.GetArguments()[key]
	if !ok {
		return zero, nil
	}

	switch v := raw.(type) {
	case string:
		// Try unmarshaling the string directly into T.
		// This works for T == string AND T == alias of string.
		jsonStr := fmt.Sprintf(`"%s"`, v)

		if err := json.Unmarshal([]byte(jsonStr), &zero); err == nil {
			return zero, nil
		}

		// If that fails, maybe it was a stringified JSON value (e.g. "[{...}]")
		unquoted, err := strconv.Unquote(v)
		if err != nil {
			unquoted = v // fallback
		}
		raw = json.RawMessage(unquoted)
	}

	// For all other cases (or fallthrough from above), marshal and unmarshal
	bytes, err := json.Marshal(raw)
	if err != nil {
		return zero, fmt.Errorf("parameter %s is not valid JSON (raw=%v): %w", key, raw, err)
	}

	if err := json.Unmarshal(bytes, &zero); err != nil {
		return zero, fmt.Errorf("parameter %s is not of expected type %T: %w", key, zero, err)
	}

	return zero, nil
}

// OptionalIntParam is a helper function that can be used to fetch a requested parameter from the request.
// It does the following checks:
// 1. Checks if the parameter is present in the request, if not, it returns its zero-value
// 2. If it is present, it checks if the parameter is of the expected type and returns it
func OptionalIntParam(r mcp.CallToolRequest, p string) (int, error) {
	v, err := OptionalParam[float64](r, p)
	if err != nil {
		return 0, err
	}
	return int(v), nil
}

// OptionalIntParamWithDefault is a helper function that can be used to fetch a requested parameter from the request
// similar to optionalIntParam, but it also takes a default value.
func OptionalIntParamWithDefault(r mcp.CallToolRequest, p string, d int) (int, error) {
	v, err := OptionalIntParam(r, p)
	if err != nil {
		return 0, err
	}
	if v == 0 {
		return d, nil
	}
	return v, nil
}

// OptionalStringArrayParam is a helper function that can be used to fetch an optional string array parameter.
func OptionalStringArrayParam(r mcp.CallToolRequest, p string) ([]string, error) {
	// Check if the parameter is present in the request
	if _, ok := r.GetArguments()[p]; !ok {
		return []string{}, nil
	}

	switch v := r.GetArguments()[p].(type) {
	case nil:
		return []string{}, nil
	case []string:
		return v, nil
	case []any:
		strSlice := make([]string, len(v))
		for i, val := range v {
			s, ok := val.(string)
			if !ok {
				return []string{}, fmt.Errorf("parameter %s is not of type string, is %T", p, val)
			}
			strSlice[i] = s
		}
		return strSlice, nil
	default:
		return []string{}, fmt.Errorf("parameter %s could not be coerced to []string, is %T", p, r.GetArguments()[p])
	}
}

func OptionalAnyArrayParam(r mcp.CallToolRequest, p string) ([]any, error) {
	// Check if the parameter is present in the request
	value, ok := r.GetArguments()[p]

	if !ok {
		return nil, fmt.Errorf("missing parameter: %s", p)
	}

	switch v := value.(type) {
	case nil:
		return []any{}, nil
	case []any:
		return v, nil
	default:
		return nil, fmt.Errorf("parameter %s could not be coerced to []any, is %T", p, value)
	}
}

// Ensures the parameter exists, is an array, and is not empty.
func RequiredAnyArrayParam(r mcp.CallToolRequest, p string) ([]any, error) {
	// Check if the parameter is present in the request
	value, ok := r.GetArguments()[p]

	if !ok {
		return nil, fmt.Errorf("missing required parameter: %s", p)
	}

	switch v := value.(type) {
	case nil:
		return nil, fmt.Errorf("required parameter %s cannot be nil", p)
	case []any:
		if len(v) == 0 {
			return nil, fmt.Errorf("required parameter %s cannot be empty", p)
		}
		return v, nil
	default:
		return nil, fmt.Errorf("parameter %s could not be coerced to []any, is %T", p, value)
	}
}
