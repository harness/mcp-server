package config

type Config struct {
	Version          string
	BaseURL          string
	AccountID        string
	DefaultOrgID     string
	DefaultProjectID string
	APIKey           string
	ReadOnly         bool
	Toolsets         []string
	LogFilePath      string
	Debug            bool
}
