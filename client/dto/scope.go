package dto

import "strings"

// Scope represents a scope in the system
type Scope struct {
	AccountID string `json:"accountIdentifier"`
	OrgID     string `json:"orgIdentifier"`
	ProjectID string `json:"projectIdentifier"`
}

func (s Scope) GetRef() string {
	var result []string
	if s.AccountID != "" {
		result = append(result, s.AccountID)
		if s.OrgID != "" {
			result = append(result, s.OrgID)
			if s.ProjectID != "" {
				result = append(result, s.ProjectID)
			}
		}
	}

	return strings.Join(result, "/")
}
