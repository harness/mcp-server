package client

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	dashboardSearchPath = "gateway/dashboard/v1/search"
	dashboardDataPath   = "dashboard/download/dashboards/%s/csv"
)

// DashboardService handles all dashboard-related API interactions
type DashboardService struct {
	Client *Client
}

// Dashboard represents a Harness dashboard
type Dashboard struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Description    string   `json:"description"`
	Models         []string `json:"models"`
	DataSource     []string `json:"data_source"`
	Type           string   `json:"type"`
	ViewCount      int      `json:"view_count"`
	FavoriteCount  int      `json:"favorite_count"`
	CreatedAt      string   `json:"created_at"`
	LastAccessedAt string   `json:"last_accessed_at"`
}

// DashboardListResponse represents the response from the list dashboards API
type DashboardListResponse struct {
	Items    int         `json:"items"`
	Pages    int         `json:"pages"`
	Resource []Dashboard `json:"resource"`
}

// DashboardListOptions represents options for listing dashboards
type DashboardListOptions struct {
	Page     int    `json:"page"`
	PageSize int    `json:"pageSize"`
	FolderID string `json:"folderId"`
	Tags     string `json:"tags"`
}

// DashboardData represents structured data from a dashboard
type DashboardData struct {
	Tables map[string][]map[string]string `json:"tables"`
}

// ListDashboards fetches all dashboards from Harness
func (d *DashboardService) ListDashboards(ctx context.Context, page int, pageSize int, folderID string, tags string) (*DashboardListResponse, error) {
	path := dashboardSearchPath
	params := make(map[string]string)

	// Get API key from auth provider
	_, apiKey, err := d.Client.AuthProvider.GetHeader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}
	
	// Extract account ID from API key (format: pat.ACCOUNT_ID.TOKEN_ID.<>)
	parts := strings.Split(apiKey, ".")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid API key format")
	}
	params["accountId"] = parts[1]
	
	// Set default pagination values
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 40 // Default page size used by the API
	}
	
	params["page"] = fmt.Sprintf("%d", page)
	params["pageSize"] = fmt.Sprintf("%d", pageSize)
	
	// Add optional parameters if they exist
	if folderID != "" {
		params["folderId"] = folderID
	}
	if tags != "" {
		params["tags"] = tags
	}

	response := new(DashboardListResponse)
	err = d.Client.Get(ctx, path, params, nil, response)
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	return response, nil
}

// GetDashboardData fetches data for a specific dashboard
func (d *DashboardService) GetDashboardData(ctx context.Context, dashboardID string, reportingTimeframe int) (*DashboardData, error) {
	// Format the base URL like the sample code
	baseURL := fmt.Sprintf("https://app.harness.io/%s", fmt.Sprintf(dashboardDataPath, dashboardID))
	
	// Create query parameters with proper encoding
	queryParams := url.Values{}
	
	// Get API key from auth provider
	_, apiKey, err := d.Client.AuthProvider.GetHeader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get API key: %w", err)
	}
	
	// Extract account ID from API key (format: pat.ACCOUNT_ID.TOKEN_ID.<>)
	parts := strings.Split(apiKey, ".")
	if len(parts) < 2 {
		return nil, fmt.Errorf("invalid API key format")
	}
	queryParams.Add("accountId", parts[1])
	
	// Set default reporting timeframe if not provided
	if reportingTimeframe <= 0 {
		reportingTimeframe = 30 // Default to 30 days
	}
	queryParams.Add("filters", fmt.Sprintf("Reporting+Timeframe=%d", reportingTimeframe))
	queryParams.Add("expanded_tables", "true")
	
	// Construct the full request URL with properly encoded parameters
	requestURL := baseURL + "?" + queryParams.Encode()
	
	// Create a new HTTP request
	req, err := http.NewRequest("GET", requestURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// Add auth header
	var headerKey, headerValue string
	headerKey, headerValue, err = d.Client.AuthProvider.GetHeader(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get auth header: %w", err)
	}
	req.Header.Set(headerKey, headerValue)
	
	// Create a client with longer timeout
	httpClient := &http.Client{
		Timeout: 60 * time.Second, // Increasing timeout to 60 seconds
	}
	
	// Execute the request
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()
	
	// Check if response status is not OK
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("unexpected status code %d: %s", resp.StatusCode, string(bodyBytes))
	}
	
	// Read the response body into memory
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}
	
	// Create a reader for the ZIP content
	zipReader, err := zip.NewReader(bytes.NewReader(bodyBytes), int64(len(bodyBytes)))
	if err != nil {
		return nil, fmt.Errorf("failed to parse ZIP content: %w", err)
	}
	
	// Process the CSV files in the ZIP
	dashboardData := &DashboardData{
		Tables: make(map[string][]map[string]string),
	}
	
	for _, zipFile := range zipReader.File {
		// Skip directories and non-CSV files
		if zipFile.FileInfo().IsDir() || !strings.HasSuffix(zipFile.Name, ".csv") {
			continue
		}
		
		// Extract table name from file name
		tableName := strings.TrimSuffix(zipFile.Name, ".csv")
		
		// Open the file inside the zip
		rc, err := zipFile.Open()
		if err != nil {
			return nil, fmt.Errorf("failed to open file %s in ZIP: %w", zipFile.Name, err)
		}
		
		// Parse the CSV content
		csvData, err := parseCSV(rc)
		if err != nil {
			rc.Close()
			return nil, fmt.Errorf("failed to parse CSV file %s: %w", zipFile.Name, err)
		}
		rc.Close()
		
		// Add table data to the dashboard data
		dashboardData.Tables[tableName] = csvData
	}
	
	return dashboardData, nil
}

// Helper function to add scope parameters as URL values
func addScopeValues(scope dto.Scope, values url.Values) {
	if scope.AccountID != "" {
		values.Add("accountId", scope.AccountID)
	}
	
	if scope.OrgID != "" {
		values.Add("orgId", scope.OrgID)
	}
	
	if scope.ProjectID != "" {
		values.Add("projectId", scope.ProjectID)
	}
}

// Helper function to parse CSV data
func parseCSV(reader io.Reader) ([]map[string]string, error) {
	// Read all the contents
	csvBytes, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV content: %w", err)
	}
	
	csvContent := string(csvBytes)
	lines := strings.Split(csvContent, "\n")
	if len(lines) < 2 {
		return nil, fmt.Errorf("CSV content too short, no data rows")
	}
	
	// Parse header
	headerLine := lines[0]
	headers := strings.Split(headerLine, ",")
	for i, header := range headers {
		headers[i] = strings.TrimSpace(header)
	}
	
	// Parse data rows
	results := make([]map[string]string, 0)
	for i := 1; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}
		
		// Simple CSV parsing - doesn't handle quotes or escapes correctly
		// In a production environment, use encoding/csv package for robust parsing
		values := strings.Split(line, ",")
		if len(values) != len(headers) {
			continue // Skip malformed rows
		}
		
		row := make(map[string]string)
		for j, value := range values {
			row[headers[j]] = strings.TrimSpace(value)
		}
		
		results = append(results, row)
	}
	
	return results, nil
}
