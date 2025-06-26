package utils

import (
	"math"
	"strings"
	"time"

	"github.com/harness/harness-mcp/client/dto"
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

func FormatUnixToMMDDYYYY(ts int64) string {
	t := time.Unix(ts, 0)
	return t.Format("01/02/2006")
}

func FormatUnixMillisToMMDDYYYY(ms int64) string {
	t := time.Unix(0, ms*int64(time.Millisecond))
	return t.Format("01/02/2006")
}

func CurrentMMDDYYYY() string {
	return time.Now().Format("01/02/2006")
}

func FormatMMDDYYYYToUnixMillis(dateStr string) (int64, error) {
	t, err := time.Parse("01/02/2006", dateStr)
	if err != nil {
		return 0, err
	}
	return t.UnixNano() / int64(time.Millisecond), nil
}

func SafeIntToInt32(value int, valueIfOverflow int32) int32 {
	if value > math.MaxInt32 || value < math.MinInt32 {
		return valueIfOverflow
	}
	return int32(value)
}

func SafeFloatToInt32(value float64, valueIfOverflow int32) int32 {
	if value > math.MaxInt32 || value < math.MinInt32 {
		return valueIfOverflow
	}
	return int32(value)
}
