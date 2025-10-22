package metrics

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"testing"
	"time"
)

func TestMetricsServer(t *testing.T) {
	// Create a metrics server on a test port
	testPort := 9999
	server := NewMetricsServer(testPort, slog.Default())

	// Start the server
	err := server.Start()
	if err != nil {
		t.Fatalf("Failed to start metrics server: %v", err)
	}

	// Give the server a moment to start
	time.Sleep(100 * time.Millisecond)

	// Test that the metrics endpoint is accessible
	resp, err := http.Get(fmt.Sprintf("http://localhost:%d/metrics", testPort))
	if err != nil {
		t.Fatalf("Failed to access metrics endpoint: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		t.Error("Expected Content-Type header to be set")
	}

	// Stop the server
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = server.Stop(ctx)
	if err != nil {
		t.Errorf("Failed to stop metrics server: %v", err)
	}
}

func TestMetricsServerGetAddr(t *testing.T) {
	testPort := 9998
	server := NewMetricsServer(testPort, slog.Default())

	expectedAddr := fmt.Sprintf(":%d", testPort)
	if server.GetAddr() != expectedAddr {
		t.Errorf("Expected address %s, got %s", expectedAddr, server.GetAddr())
	}
}
