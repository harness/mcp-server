package utils

import (
	"github.com/harness/harness-mcp/client/dto"
	"strings"
)

func GetScopeRef(scope dto.Scope, params ...string) string {
	result := []string{}
	if len(scope.AccountID) > 0 {
		result = append(result, scope.AccountID)
	}
	if len(scope.OrgID) > 0 {
		result = append(result, scope.OrgID)
	}
	if len(scope.ProjectID) > 0 {
		result = append(result, scope.ProjectID)
	}
	for _, param := range params {
		result = append(result, param)
	}
	return strings.Join(result, "/")
}
