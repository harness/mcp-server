package dto

import (
	"time"
)

// FormatUnixMillisToRFC3339 converts Unix timestamp in milliseconds to RFC3339 format
func FormatUnixMillisToRFC3339(ms int64) string {
	if ms <= 0 {
		return ""
	}
	// Convert milliseconds to seconds and nanoseconds for Unix time
	sec := ms / 1000
	nsec := (ms % 1000) * 1000000
	t := time.Unix(sec, nsec)
	return t.Format(time.RFC3339)
}

// FormatUnixMillisToMMDDYYYY converts Unix timestamp in milliseconds to MM/DD/YYYY format
func FormatUnixMillisToMMDDYYYY(ms int64) string {
	if ms <= 0 {
		return ""
	}
	// Convert milliseconds to seconds and nanoseconds for Unix time
	sec := ms / 1000
	nsec := (ms % 1000) * 1000000
	t := time.Unix(sec, nsec)
	return t.Format("01/02/2006")
}
