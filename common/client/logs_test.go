package client

import (
	"net/url"
	"testing"
)

func TestRewriteDownloadURLHost(t *testing.T) {
	tests := []struct {
		name         string
		downloadLink string
		baseURL      string
		wantURL      string
		wantErr      bool
	}{
		{
			name:         "rewrites app.harness.io to custom domain",
			downloadLink: "https://app.harness.io/storage/harness-download/logs/abc123?token=xyz",
			baseURL:      "https://mycompany.harness.io",
			wantURL:      "https://mycompany.harness.io/storage/harness-download/logs/abc123?token=xyz",
		},
		{
			name:         "no rewrite when hosts match",
			downloadLink: "https://app.harness.io/storage/logs/abc123",
			baseURL:      "https://app.harness.io",
			wantURL:      "https://app.harness.io/storage/logs/abc123",
		},
		{
			name:         "nil base URL returns original link",
			downloadLink: "https://app.harness.io/storage/logs/abc123",
			baseURL:      "",
			wantURL:      "https://app.harness.io/storage/logs/abc123",
		},
		{
			name:         "preserves query parameters",
			downloadLink: "https://app.harness.io/storage/logs?accountID=abc&prefix=key&X-Amz-Signature=sig123",
			baseURL:      "https://mycompany.harness.io",
			wantURL:      "https://mycompany.harness.io/storage/logs?accountID=abc&prefix=key&X-Amz-Signature=sig123",
		},
		{
			name:         "preserves path structure",
			downloadLink: "https://app.harness.io/storage/harness-download/comp-log-service/deep/nested/path.zip",
			baseURL:      "https://custom.example.com",
			wantURL:      "https://custom.example.com/storage/harness-download/comp-log-service/deep/nested/path.zip",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var baseURL *url.URL
			if tt.baseURL != "" {
				var err error
				baseURL, err = url.Parse(tt.baseURL)
				if err != nil {
					t.Fatalf("failed to parse base URL: %v", err)
				}
			}

			got, err := rewriteDownloadURLHost(tt.downloadLink, baseURL)
			if (err != nil) != tt.wantErr {
				t.Errorf("rewriteDownloadURLHost() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantURL {
				t.Errorf("rewriteDownloadURLHost() = %v, want %v", got, tt.wantURL)
			}
		})
	}
}
