package license

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/harness/harness-go-sdk/harness/nextgen"
	config "github.com/harness/mcp-server/common"
)

// CustomLicensesApiService is a custom implementation of the LicensesApiService
// that allows for more customization of the client configuration
type CustomLicensesApiService struct {
	Client *CustomAPIClient
}

// CustomAPIClient is a custom implementation of the nextgen.APIClient
// that allows for more customization of the client configuration
type CustomAPIClient struct {
	cfg        *nextgen.Configuration
	httpClient *http.Client
}

// NewCustomAPIClient creates a new CustomAPIClient
func NewCustomAPIClient(cfg *nextgen.Configuration) *CustomAPIClient {
	return &CustomAPIClient{
		cfg:        cfg,
		httpClient: cfg.HTTPClient.StandardClient(),
	}
}

// prepareRequest builds the request
func (c *CustomAPIClient) prepareRequest(
	ctx context.Context,
	path string,
	method string,
	postBody interface{},
	headerParams map[string]string,
	queryParams url.Values,
	formParams url.Values,
	fileName string,
	fileBytes []byte) (localVarRequest *http.Request, err error) {

	var body *strings.Reader

	// Detect postBody type and set body content
	if postBody != nil {
		contentType := headerParams["Content-Type"]
		if contentType == "" {
			contentType = detectContentType(postBody)
			headerParams["Content-Type"] = contentType
		}

		body, err = setBody(postBody, contentType)
		if err != nil {
			return nil, err
		}
	}

	// Setup path and query parameters
	url, err := url.Parse(path)
	if err != nil {
		return nil, err
	}

	// Adding Query Param
	query := url.Query()
	for k, v := range queryParams {
		for _, iv := range v {
			query.Add(k, iv)
		}
	}

	// Encode the parameters.
	url.RawQuery = query.Encode()

	// Generate a new request
	if body != nil {
		localVarRequest, err = http.NewRequest(method, url.String(), body)
	} else {
		localVarRequest, err = http.NewRequest(method, url.String(), nil)
	}
	if err != nil {
		return nil, err
	}

	// add header parameters, if any
	if len(headerParams) > 0 {
		headers := http.Header{}
		for h, v := range headerParams {
			headers.Set(h, v)
		}
		localVarRequest.Header = headers
	}

	// Add the user agent to the request.
	localVarRequest.Header.Add("User-Agent", c.cfg.UserAgent)

	if ctx != nil {
		// add context to the request
		localVarRequest = localVarRequest.WithContext(ctx)

		// Walk through any authentication.
		if auth, ok := ctx.Value(nextgen.ContextAPIKey).(nextgen.APIKey); ok {
			var key string
			if auth.Prefix != "" {
				key = auth.Prefix + " " + auth.Key
			} else {
				key = auth.Key
			}
			localVarRequest.Header.Add("x-api-key", key)
		}
	}

	for header, value := range c.cfg.DefaultHeader {
		localVarRequest.Header.Add(header, value)
	}

	return localVarRequest, nil
}

// callAPI do the request.
func (c *CustomAPIClient) callAPI(ctx context.Context, request *http.Request) (*http.Response, error) {
	// Log request details
	slog.InfoContext(ctx, "Request", "method", request.Method, "url", request.URL)

	response, err := c.httpClient.Do(request)
	if err != nil {
		return response, err
	}

	// Log response details
	slog.InfoContext(ctx, "Response", "status", response.Status)
	return response, err
}

// decode handles decoding response bodies into target types
func (c *CustomAPIClient) decode(v interface{}, b []byte, contentType string) (err error) {
	// Use the standard JSON decoder for simplicity
	if strings.Contains(contentType, "application/json") {
		return json.Unmarshal(b, v)
	}
	// For other content types, just return the raw data
	return fmt.Errorf("unsupported content type: %s", contentType)
}

// detectContentType detects the content type of the given body
func detectContentType(body interface{}) string {
	// Default to JSON for all requests
	return "application/json"
}

// setBody sets the body of the request
func setBody(body interface{}, contentType string) (bodyBuf *strings.Reader, err error) {
	// Convert the body to JSON
	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyBuf = strings.NewReader(string(jsonData))
	} else {
		bodyBuf = strings.NewReader("{}")
	}
	return bodyBuf, nil
}

// selectHeaderContentType selects the best content type from the available options
func selectHeaderContentType(contentTypes []string) string {
	if len(contentTypes) == 0 {
		return ""
	}
	if contains(contentTypes, "application/json") {
		return "application/json"
	}
	return contentTypes[0]
}

// selectHeaderAccept selects the best accept header from the available options
func selectHeaderAccept(accepts []string) string {
	if len(accepts) == 0 {
		return ""
	}
	if contains(accepts, "application/json") {
		return "application/json"
	}
	return accepts[0]
}

// contains checks if a string is in a slice
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}

// GetAccountLicenses gets all module license information in account
func (a *CustomLicensesApiService) GetAccountLicenses(ctx context.Context, accountIdentifier string) (nextgen.ResponseDtoAccountLicense, *http.Response, error) {
	var (
		localVarHttpMethod  = strings.ToUpper("Get")
		localVarPostBody    interface{}
		localVarFileName    string
		localVarFileBytes   []byte
		localVarReturnValue nextgen.ResponseDtoAccountLicense
	)

	// create path and map variables
	localVarPath := a.Client.cfg.BasePath + "/licenses/account"

	localVarHeaderParams := make(map[string]string)
	localVarQueryParams := url.Values{}
	localVarFormParams := url.Values{}

	localVarQueryParams.Add("accountIdentifier", accountIdentifier)

	// to determine the Content-Type header
	localVarHttpContentTypes := []string{}

	// set Content-Type header
	localVarHttpContentType := selectHeaderContentType(localVarHttpContentTypes)
	if localVarHttpContentType != "" {
		localVarHeaderParams["Content-Type"] = localVarHttpContentType
	}

	// to determine the Accept header
	localVarHttpHeaderAccepts := []string{"application/json", "application/yaml"}

	// set Accept header
	localVarHttpHeaderAccept := selectHeaderAccept(localVarHttpHeaderAccepts)
	if localVarHttpHeaderAccept != "" {
		localVarHeaderParams["Accept"] = localVarHttpHeaderAccept
	}

	r, err := a.Client.prepareRequest(ctx, localVarPath, localVarHttpMethod, localVarPostBody, localVarHeaderParams, localVarQueryParams, localVarFormParams, localVarFileName, localVarFileBytes)
	if err != nil {
		return localVarReturnValue, nil, err
	}

	localVarHttpResponse, err := a.Client.callAPI(ctx, r)
	if err != nil || localVarHttpResponse == nil {
		return localVarReturnValue, localVarHttpResponse, err
	}

	localVarBody, err := ioutil.ReadAll(localVarHttpResponse.Body)
	localVarHttpResponse.Body.Close()
	if err != nil {
		return localVarReturnValue, localVarHttpResponse, err
	}

	if localVarHttpResponse.StatusCode < 300 {
		// If we succeed, return the data, otherwise pass on to decode error.
		err = a.Client.decode(&localVarReturnValue, localVarBody, localVarHttpResponse.Header.Get("Content-Type"))
		if err == nil {
			return localVarReturnValue, localVarHttpResponse, err
		}
	}

	if localVarHttpResponse.StatusCode >= 300 {
		// Create a custom error with the response body and status
		return localVarReturnValue, localVarHttpResponse, fmt.Errorf("HTTP error %s with body: %s", localVarHttpResponse.Status, string(localVarBody))
	}

	return localVarReturnValue, localVarHttpResponse, nil
}

// // CreateCustomLicenseClient creates a custom license client using the registered provider
// func CreateCustomLicenseClient(config *config.Config, licenseBaseURL, baseURL, path, secret string) (*CustomLicensesApiService, error) {
//     return CreateCustomLicenseClientWithContext(context.Background(), config, licenseBaseURL, baseURL, path, secret)
// }

// CreateCustomLicenseClientWithContext creates a custom license client using the registered provider
func CreateCustomLicenseClientWithContext(ctx context.Context, config *config.Config, licenseBaseURL, baseURL, path, secret string) (*CustomLicensesApiService, error) {
	if DefaultProvider == nil {
		return nil, fmt.Errorf("no license client provider registered")
	}
	return DefaultProvider.CreateClient(ctx, config, licenseBaseURL, baseURL, path, secret)
}

// // Default JWT token lifetime
// var defaultJWTLifetime = 1 * 60 * 60 * time.Second // 1 hour

// var serviceIdentity = "genaiservice"
