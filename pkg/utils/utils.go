package utils

import (
	"github.com/harness/harness-mcp/client/dto"
	"strings"
	"math"
)

func GetRef(scope dto.Scope, params ...string) string {
	var result []string
	ref := scope.GetRef()
	if ref != "" {
		result = append(result, ref)
	}
	for _, param := range params {
		result = append(result, param)
	}
	return strings.Join(result, "/")
}

func SafeIntToInt32(value int, valueIfOverflow int32) (int32) {
	if value > math.MaxInt32 || value < math.MinInt32 {
		return valueIfOverflow
	}
	return int32(value)
}

func SafeFloatToInt32(value float64, valueIfOverflow int32) (int32) {
	if value > math.MaxInt32 || value < math.MinInt32 {
		return valueIfOverflow
	}
	return int32(value)
}
