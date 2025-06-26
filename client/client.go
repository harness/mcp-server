package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cenkalti/backoff/v4"
	"github.com/harness/harness-mcp/client/dto"
	"github.com/harness/harness-mcp/pkg/harness/auth"
	"github.com/rs/zerolog/log"
)

var (
	// these can be moved to a level above if we want to make this a generic
	// client, keeping these here to ensure we don't end up returning too much info
	// when different tools get added.
	defaultPageSize = 5
	maxPageSize     = 20

	apiKeyHeader = "x-api-key"
)

var (
	ErrBadRequest = fmt.Errorf("bad request")
	ErrNotFound   = fmt.Errorf("not found")
	ErrInternal   = fmt.Errorf("internal error")
)

type Client struct {
	client *http.Client // HTTP client used for communicating with the Harness API

	// Base URL for API requests. Defaults to the public Harness API, but can be
	// set to a domain endpoint to use with custom Harness installations
	BaseURL *url.URL

	// AuthProvider used for authentication
	AuthProvider auth.Provider
}

type service struct {
	client *Client
}

func defaultHTTPClient(timeout ...time.Duration) *http.Client {
	// Use default timeout of 10 seconds if not specified
	clientTimeout := 10 * time.Second
	if len(timeout) > 0 {
		clientTimeout = timeout[0]
	}
	return &http.Client{
		Timeout: clientTimeout,
	}
}

// NewWithToken creates a new client with the specified base URL and API token
func NewWithAuthProvider(uri string, authProvider auth.Provider, timeout ...time.Duration) (*Client, error) {
	parsedURL, err := url.Parse(uri)
	if err != nil {
		return nil, err
	}
	c := &Client{
		client:       defaultHTTPClient(timeout...),
		BaseURL:      parsedURL,
		AuthProvider: authProvider,
	}
	return c, nil
}

// Get is a simple helper that builds up the request URL, adding the path and parameters.
// The response from the request is unmarshalled into the data parameter.
func (c *Client) Get(
	ctx context.Context,
	path string,
	params map[string]string,
	headers map[string]string,
	response interface{},
) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, appendPath(c.BaseURL.String(), path), nil)
	if err != nil {
		return fmt.Errorf("unable to create new http request : %w", err)
	}

	addQueryParams(httpReq, params)
	for key, value := range headers {
		httpReq.Header.Add(key, value)
	}
	// Execute the request
	resp, err := c.Do(httpReq)

	// ensure the body is closed after we read (independent of status code or error)
	if resp != nil && resp.Body != nil {
		// Use function to satisfy the linter which complains about unhandled errors otherwise
		defer func() { _ = resp.Body.Close() }()
	}

	if err != nil {
		return fmt.Errorf("request execution failed: %w", err)
	}

	// map the error from the status code
	err = mapStatusCodeToError(resp.StatusCode)

	// response output is optional
	if response == nil || resp == nil || resp.Body == nil {
		return err
	}

	// Try to unmarshal the response
	if err := unmarshalResponse(resp, response); err != nil {
		// If we already have a status code error, wrap it with the unmarshal error
		if statusErr := mapStatusCodeToError(resp.StatusCode); statusErr != nil {
			return fmt.Errorf("%w: %v", statusErr, err)
		}
		return err
	}

	// Return any status code error if present
	if err != nil {
		return err
	}

	return err
}

// Post is a simple helper that builds up the request URL, adding the path and parameters.
// The response from the request is unmarshalled into the out parameter.
func (c *Client) Post(
	ctx context.Context,
	path string,
	params map[string]string,
	body interface{},
	out interface{},
	b ...backoff.BackOff,
) error {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to serialize body: %w", err)
	}

	return c.PostRaw(ctx, path, params, bytes.NewBuffer(bodyBytes), nil, out, b...)
}

// PostRaw is a simple helper that builds up the request URL, adding the path and parameters.
// The response from the request is unmarshalled into the out parameter.
func (c *Client) PostRaw(
	ctx context.Context,
	path string,
	params map[string]string,
	body io.Reader,
	headers map[string]string,
	out interface{},
	b ...backoff.BackOff,
) error {
	var retryCount int

	operation := func() error {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, appendPath(c.BaseURL.String(), path), body)
		if err != nil {
			return backoff.Permanent(fmt.Errorf("unable to create HTTP request: %w", err))
		}

		req.Header.Set("Content-Type", "application/json")
		// Add custom headers from the headers map
		for key, value := range headers {
			req.Header.Add(key, value)
		}
		addQueryParams(req, params)

		resp, err := c.Do(req)

		if resp != nil && resp.Body != nil {
			defer resp.Body.Close()
		}

		if err != nil || resp == nil {
			return fmt.Errorf("request failed: %w", err)
		}

		if isRetryable(resp.StatusCode) {
			return fmt.Errorf("retryable status code: %d", resp.StatusCode)
		}

		if statusErr := mapStatusCodeToError(resp.StatusCode); statusErr != nil {
			return backoff.Permanent(statusErr)
		}

		if out != nil && resp.Body != nil {
			if err := unmarshalResponse(resp, out); err != nil {
				return fmt.Errorf("unmarshal error: %w", err)
			}
		}

		return nil
	}

	notify := func(err error, next time.Duration) {
		retryCount++
		log.Warn().
			Int("retry_count", retryCount).
			Dur("next_retry_in", next).
			Err(err).
			Msg("Retrying request due to error")
	}

	if len(b) > 0 {
		if err := backoff.RetryNotify(operation, b[0], notify); err != nil {
			return fmt.Errorf("request failed after %d retries: %w", retryCount, err)
		}
	} else {
		if err := operation(); err != nil {
			return err
		}
	}

	return nil
}

// Do is a wrapper of http.Client.Do that injects the auth header in the request.
func (c *Client) Do(r *http.Request) (*http.Response, error) {
	slog.Debug("Request", "method", r.Method, "url", r.URL.String())

	// set the auth header
	ctx := r.Context()
	k, v, err := c.AuthProvider.GetHeader(ctx)
	if err != nil {
		return nil, err
	}
	r.Header.Set(k, v)

	return c.client.Do(r)
}

// appendPath appends the provided path to the uri
// any redundant '/' between uri and path will be removed.
func appendPath(uri string, path string) string {
	if path == "" {
		return uri
	}

	return strings.TrimRight(uri, "/") + "/" + strings.TrimLeft(path, "/")
}

// nolint:godot
// unmarshalResponse reads the response body and if there are no errors marshall's it into data.
func unmarshalResponse(resp *http.Response, data interface{}) error {
	if resp == nil || resp.Body == nil {
		return fmt.Errorf("http response body is not available")
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("error reading response body : %w", err)
	}

	// For non-success status codes, try to unmarshal as an error response first
	if resp.StatusCode >= 400 {
		var errResp dto.ErrorResponse
		if jsonErr := json.Unmarshal(body, &errResp); jsonErr == nil && (errResp.Code != "" || errResp.Message != "") {
			return fmt.Errorf("API error: %s", errResp.Message)
		}
		// If we couldn't parse it as an error response, continue with normal unmarshaling
	}

	err = json.Unmarshal(body, data)
	if err != nil {
		return fmt.Errorf("error deserializing response body : %w - original response: %s", err, string(body))
	}

	return nil
}

// helper function.
func isRetryable(status int) bool {
	return status == http.StatusTooManyRequests || status >= http.StatusInternalServerError
}

func mapStatusCodeToError(statusCode int) error {
	switch {
	case statusCode == 500:
		return ErrInternal
	case statusCode >= 500:
		return fmt.Errorf("received server side error status code %d", statusCode)
	case statusCode == 404:
		return ErrNotFound
	case statusCode == 400:
		return ErrBadRequest
	case statusCode >= 400:
		return fmt.Errorf("received client side error status code %d", statusCode)
	case statusCode >= 300:
		return fmt.Errorf("received further action required status code %d", statusCode)
	default:
		// TODO: definitely more things to consider here ...
		return nil
	}
}

// addQueryParams if the params map is not empty, it adds each key/value pair to
// the request URL.
func addQueryParams(req *http.Request, params map[string]string) {
	if len(params) == 0 {
		return
	}

	q := req.URL.Query()

	for key, value := range params {
		for _, value := range strings.Split(value, ",") {
			q.Add(key, value)
		}
	}

	req.URL.RawQuery = q.Encode()
}

func addScope(scope dto.Scope, params map[string]string) {
	if scope.AccountID == "" {
		slog.Error("Account ID is empty in scope")
	} else {
		params["accountIdentifier"] = scope.AccountID
		params["accountId"] = scope.AccountID
	}

	if scope.OrgID != "" {
		params["orgIdentifier"] = scope.OrgID
		params["orgId"] = scope.OrgID
	}

	if scope.ProjectID != "" {
		params["projectIdentifier"] = scope.ProjectID
		params["projectId"] = scope.ProjectID
	}
}

func setDefaultPagination(opts *dto.PaginationOptions) {
	if opts != nil {
		if opts.Size == 0 {
			opts.Size = defaultPageSize
		}
		// too many entries will lower the quality of responses
		// can be tweaked later based on feedback
		if opts.Size > maxPageSize {
			opts.Size = maxPageSize
		}
	}
}
