package modules

import (
	"testing"

	config "github.com/harness/mcp-server/common"
	"github.com/stretchr/testify/assert"
)

type LicenseInfo struct {
	AccountID      string
	ModuleLicenses map[string]bool
	IsValid        bool
}

func TestValidateToolsets(t *testing.T) {
	tests := []struct {
		name                    string
		config                  *config.Config
		mockLicense             LicenseInfo
		expectedAllowedToolsets []string
		expectedDeniedToolsets  map[string]string
	}{
		{
			name: "Valid license with CI and CD modules",
			config: &config.Config{
				AccountID: "test-account",
				APIKey:    "test-key",
				BaseURL:   "https://app.harness.io",
				ReadOnly:  true,
				Toolsets:  []string{"idp"},
			},
			mockLicense: LicenseInfo{
				AccountID: "test-account",
				ModuleLicenses: map[string]bool{
					"IDP": true,
				},
				IsValid: true,
			},
			expectedAllowedToolsets: []string{"idp"},
			expectedDeniedToolsets:  map[string]string{},
		},
		{
			name: "CCM module with CE license mapping",
			config: &config.Config{
				AccountID: "test-account",
				APIKey:    "test-key",
				BaseURL:   "https://app.harness.io",
				ReadOnly:  true,
				Toolsets:  []string{"ccm"},
			},
			mockLicense: LicenseInfo{
				AccountID: "test-account",
				ModuleLicenses: map[string]bool{
					"CE": true,
				},
				IsValid: true,
			},
			expectedAllowedToolsets: []string{"ccm"},
			expectedDeniedToolsets:  map[string]string{},
		},
		{
			name: "Denies access to toolset for disabled license module",
			config: &config.Config{
				AccountID: "test-account",
				APIKey:    "test-key",
				BaseURL:   "https://app.harness.io",
				ReadOnly:  true,
				Toolsets:  []string{"idp"},
			},
			mockLicense: LicenseInfo{
				AccountID: "test-account",
				ModuleLicenses: map[string]bool{
					"IDP": false,
				},
				IsValid: true,
			},
			expectedAllowedToolsets: []string{},
			expectedDeniedToolsets: map[string]string{
				"idp": "module IDP is not licensed",
			},
		},
		{
			name: "Enable default module toolsets always",
			config: &config.Config{
				AccountID: "test-account",
				APIKey:    "test-key",
				BaseURL:   "https://app.harness.io",
				ReadOnly:  true,
				Toolsets:  []string{"pipelines", "connectors"},
			},
			mockLicense: LicenseInfo{
				AccountID:      "test-account",
				ModuleLicenses: map[string]bool{},
				IsValid:        true,
			},
			expectedAllowedToolsets: []string{"pipelines", "connectors"},
			expectedDeniedToolsets:  map[string]string{},
		},
	}

	for _, tt := range tests {
		mockmoduleRegistry := NewModuleRegistry(tt.config, nil)
		allowedToolsets, deniedToolsets := mockmoduleRegistry.ValidateToolsets(tt.config.Toolsets, tt.mockLicense.ModuleLicenses)
		assert.Equal(t, tt.expectedAllowedToolsets, allowedToolsets)
		assert.Equal(t, tt.expectedDeniedToolsets, deniedToolsets)
	}

}
