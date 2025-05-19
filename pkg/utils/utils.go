package utils

import (
	"github.com/harness/harness-mcp/client/dto"
	"strings"
)

func GetRef(scope dto.Scope, params ...string) string {
	var result []string
	ref := scope.GetScopeRef()
	if ref != "" {
		result = append(result, ref)
	}
	for _, param := range params {
		result = append(result, param)
	}
	return strings.Join(result, "/")
}
