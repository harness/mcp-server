package client

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/harness/harness-mcp/client/dto"
)

const (
	dashboardSearchPath = "/v1/search"
	dashboardDataPath   = "/download/dashboards/%s/csv"
)

// DashboardService handles all dashboard-related API interactions
type DashboardService struct {
	Client *Client
}

// ListDashboards fetches all dashboards from Harness
func (d *DashboardService) ListDashboards(ctx context.Context, scope dto.Scope, page int, pageSize int, folderID string, tags string) (*dto.DashboardListResponse, error) {
	path := dashboardSearchPath
	params := make(map[string]string)

	// Add scope parameters
	addScope(ctx, scope, params)

	params["page"] = fmt.Sprintf("%d", page)
	params["pageSize"] = fmt.Sprintf("%d", pageSize)

	// Add optional parameters if they exist
	if folderID != "" {
		params["folderId"] = folderID
	}
	if tags != "" {
		params["tags"] = tags
	}

	response := new(dto.DashboardListResponse)
	err := d.Client.Get(ctx, path, params, nil, response)
	if err != nil {
		return nil, fmt.Errorf("failed to list dashboards: %w", err)
	}

	return response, nil
}

// GetDashboardData fetches data for a specific dashboard
func (d *DashboardService) GetDashboardData(ctx context.Context, scope dto.Scope, dashboardID string, reportingTimeframe int) (*dto.DashboardData, error) {
	// Format the path with the dashboard ID using the standard pattern
	path := fmt.Sprintf(dashboardDataPath, dashboardID)

	// Create params map for query parameters
	params := make(map[string]string)

	// Add scope parameters including account ID
	if scope.AccountID == "" {
		return nil, fmt.Errorf("accountIdentifier cannot be null")
	}
	addScope(ctx, scope, params)

	// Set default reporting timeframe if not provided
	if reportingTimeframe <= 0 {
		reportingTimeframe = 30 // Default to 30 days
	}
	params["filters"] = fmt.Sprintf("Reporting+Timeframe=%d", reportingTimeframe)
	params["expanded_tables"] = "true"

	// For this specific endpoint, we need the raw response to process the ZIP file
	// Use the standard URL construction but handle the response manually
	httpReq, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		appendPath(d.Client.BaseURL.String(), path),
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Add query parameters using the standard helper function
	addQueryParams(httpReq, params)

	resp, err := d.Client.Do(httpReq)
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
	dashboardData := &dto.DashboardData{
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

// Helper function to parse CSV data using the standard library's csv package for robust parsing
func parseCSV(reader io.Reader) ([]map[string]string, error) {
	// Create a new CSV reader
	csvReader := csv.NewReader(reader)

	// Read all records at once
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV content: %w", err)
	}

	// Check if we have enough data (at least header row)
	if len(records) < 1 {
		return nil, fmt.Errorf("CSV content empty, no header row")
	}

	// Extract headers from the first row
	headers := records[0]
	for i, header := range headers {
		headers[i] = strings.TrimSpace(header)
	}

	// No data rows
	if len(records) < 2 {
		return []map[string]string{}, nil // Return empty result, not an error
	}

	// Process data rows
	results := make([]map[string]string, 0, len(records)-1)
	for i := 1; i < len(records); i++ {
		values := records[i]

		// Skip rows with mismatched field counts
		if len(values) != len(headers) {
			continue
		}

		// Create a map for this row
		row := make(map[string]string)
		for j, value := range values {
			row[headers[j]] = strings.TrimSpace(value)
		}

		results = append(results, row)
	}

	return results, nil
}
