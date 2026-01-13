package dto

import (
	"time"
)

// LogDownloadResponse represents the response from the log download API
type LogDownloadResponse struct {
	Link    string    `json:"link"`
	Status  string    `json:"status"`
	Expires time.Time `json:"expires"`
}
