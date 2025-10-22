package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	// HTTPRequestsTotal counts the total number of HTTP requests received
	HTTPRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "mcp_http_requests_total",
		Help: "The total number of received requests",
	}, []string{"status", "method", "api"})

	// HTTPRequestsDuration measures the duration of HTTP requests in milliseconds
	HTTPRequestsDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "mcp_http_requests_duration",
		Help:    "A histogram of request duration in millis",
		Buckets: []float64{50, 100, 200, 300, 400, 500, 750, 1000, 2000, 5000, 10000, 25000, 100000},
	}, []string{"status", "method", "api"})
)
