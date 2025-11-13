package metrics

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/prometheus/client_golang/prometheus/promhttp"
	"log/slog"
)

// MetricsServer represents a Prometheus metrics HTTP server
type MetricsServer struct {
	server *http.Server
	logger *slog.Logger
}

// NewMetricsServer creates a new Prometheus metrics server
func NewMetricsServer(port int, logger *slog.Logger) *MetricsServer {
	if logger == nil {
		logger = slog.Default()
	}

	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	return &MetricsServer{
		server: server,
		logger: logger,
	}
}

// Start starts the metrics server in a goroutine
func (ms *MetricsServer) Start() error {
	ms.logger.Info("Starting Prometheus metrics server", "addr", ms.server.Addr)

	go func() {
		if err := ms.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			ms.logger.Error("Metrics server failed", "error", err)
		}
	}()

	return nil
}

// Stop gracefully stops the metrics server
func (ms *MetricsServer) Stop(ctx context.Context) error {
	ms.logger.Info("Stopping Prometheus metrics server")
	return ms.server.Shutdown(ctx)
}

// GetAddr returns the server address
func (ms *MetricsServer) GetAddr() string {
	return ms.server.Addr
}
