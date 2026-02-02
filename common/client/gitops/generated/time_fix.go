package generated

import (
	"encoding/json"
	"fmt"
	"time"
)

// UnmarshalJSON handles ISO8601 string timestamps from the API.
func (t *V1Time) UnmarshalJSON(data []byte) error {
	var timeStr string
	if err := json.Unmarshal(data, &timeStr); err == nil {
		parsed, err := time.Parse(time.RFC3339, timeStr)
		if err != nil {
			return err
		}
		secondsStr := fmt.Sprintf("%d", parsed.Unix())
		t.Seconds = &secondsStr
		nanos := int32(parsed.Nanosecond())
		t.Nanos = &nanos
		return nil
	}

	type Alias V1Time
	aux := &struct{ *Alias }{Alias: (*Alias)(t)}
	return json.Unmarshal(data, aux)
}

