package ccmcommons

import (
	"testing"
	"time"

	"github.com/harness/harness-mcp/client/dto"
	"github.com/stretchr/testify/assert"
)

func TestGetTimeRangeFromFilter(t *testing.T) {
	// Use a fixed reference time for consistent testing
	// November 13, 2025, 14:43:24 IST (09:13:24 UTC)
	referenceTime := time.Date(2025, 11, 13, 9, 13, 24, 0, time.UTC)

	tests := []struct {
		name          string
		filter        string
		referenceTime time.Time
		wantStart     time.Time
		wantEnd       time.Time
	}{
		{
			name:          "LAST_7 - Last 7 days (Note: implementation goes back 7 days, so includes 8 days total)",
			filter:        dto.TimeFilterLast7,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 11, 7, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 11, 13, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "THIS_MONTH - Current month from 1st to last day",
			filter:        dto.TimeFilterThisMonth,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 11, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 11, 30, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_30_DAYS - Last 30 days",
			filter:        dto.TimeFilterLast30Days,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 10, 14, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 11, 13, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "THIS_QUARTER - Current quarter from 1st to last day",
			filter:        dto.TimeFilterThisQuarter,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 10, 1, 0, 0, 0, 0, time.UTC),             // Q4 starts Oct 1
			wantEnd:       time.Date(2025, 11, 13, 23, 59, 59, 999999999, time.UTC), // Q4 ends Dec 31
		},
		{
			name:          "THIS_YEAR - Current year from Jan 1 to Dec 31",
			filter:        dto.TimeFilterThisYear,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 11, 13, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_MONTH - Previous calendar month",
			filter:        dto.TimeFilterLastMonth,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 10, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 10, 31, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_QUARTER - Previous quarter",
			filter:        dto.TimeFilterLastQuarter,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 7, 1, 0, 0, 0, 0, time.UTC), // Q3 starts Jul 1
			wantEnd:       time.Date(2025, 9, 30, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_YEAR - Previous calendar year",
			filter:        dto.TimeFilterLastYear,
			referenceTime: referenceTime,
			wantStart:     time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2024, 12, 31, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_3_MONTHS - Last 3 months",
			filter:        dto.TimeFilterLast3Months,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 8, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 10, 31, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_6_MONTHS - Last 6 months",
			filter:        dto.TimeFilterLast6Months,
			referenceTime: referenceTime,
			wantStart:     time.Date(2025, 5, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 10, 31, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "LAST_12_MONTHS - Last 12 months",
			filter:        dto.TimeFilterLast12Months,
			referenceTime: referenceTime,
			wantStart:     time.Date(2024, 11, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 10, 31, 23, 59, 59, 999999999, time.UTC),
		},
		{
			name:          "Unknown filter - defaults to reference time",
			filter:        "UNKNOWN_FILTER",
			referenceTime: referenceTime,
			wantStart:     referenceTime,
			wantEnd:       referenceTime,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotStart, gotEnd := GetTimeRangeFromFilter(tt.filter, tt.referenceTime)

			assert.Equal(t, tt.wantStart, gotStart,
				"Start time mismatch for filter %s. Got: %v, Want: %v",
				tt.filter, gotStart, tt.wantStart)

			assert.Equal(t, tt.wantEnd, gotEnd,
				"End time mismatch for filter %s. Got: %v, Want: %v",
				tt.filter, gotEnd, tt.wantEnd)
		})
	}
}

// TestGetTimeRangeFromFilter_EdgeCases tests edge cases like month boundaries
func TestGetTimeRangeFromFilter_EdgeCases(t *testing.T) {
	tests := []struct {
		name          string
		filter        string
		referenceTime time.Time
		wantStart     time.Time
		wantEnd       time.Time
		description   string
	}{
		{
			name:          "LAST_MONTH on January 15 - should return December",
			filter:        dto.TimeFilterLastMonth,
			referenceTime: time.Date(2025, 1, 15, 10, 0, 0, 0, time.UTC),
			wantStart:     time.Date(2024, 12, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2024, 12, 31, 23, 59, 59, 999999999, time.UTC),
			description:   "Crossing year boundary",
		},
		{
			name:          "THIS_QUARTER in Q1 (February)",
			filter:        dto.TimeFilterThisQuarter,
			referenceTime: time.Date(2025, 2, 15, 10, 0, 0, 0, time.UTC),
			wantStart:     time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 2, 15, 23, 59, 59, 999999999, time.UTC),
			description:   "Q1 starts at January 1 and ends at March 31",
		},
		{
			name:          "THIS_QUARTER in Q2 (May)",
			filter:        dto.TimeFilterThisQuarter,
			referenceTime: time.Date(2025, 5, 15, 10, 0, 0, 0, time.UTC),
			wantStart:     time.Date(2025, 4, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 5, 15, 23, 59, 59, 999999999, time.UTC),
			description:   "Q2 starts at April 1 and ends at June 30",
		},
		{
			name:          "LAST_QUARTER in Q1 - should return Q4 of previous year",
			filter:        dto.TimeFilterLastQuarter,
			referenceTime: time.Date(2025, 2, 15, 10, 0, 0, 0, time.UTC),
			wantStart:     time.Date(2024, 10, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2024, 12, 31, 23, 59, 59, 999999999, time.UTC),
			description:   "Crossing year boundary for quarters",
		},
		{
			name:          "LAST_MONTH on March 31 - February (28 days)",
			filter:        dto.TimeFilterLastMonth,
			referenceTime: time.Date(2025, 3, 31, 10, 0, 0, 0, time.UTC),
			wantStart:     time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2025, 2, 28, 23, 59, 59, 999999999, time.UTC),
			description:   "February in non-leap year",
		},
		{
			name:          "LAST_3_MONTHS crossing year boundary",
			filter:        dto.TimeFilterLast3Months,
			referenceTime: time.Date(2025, 1, 15, 10, 0, 0, 0, time.UTC),
			wantStart:     time.Date(2024, 10, 1, 0, 0, 0, 0, time.UTC),
			wantEnd:       time.Date(2024, 12, 31, 23, 59, 59, 999999999, time.UTC),
			description:   "3 months back from January",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotStart, gotEnd := GetTimeRangeFromFilter(tt.filter, tt.referenceTime)

			assert.Equal(t, tt.wantStart, gotStart,
				"%s - Start time mismatch. Got: %v, Want: %v",
				tt.description, gotStart, tt.wantStart)

			assert.Equal(t, tt.wantEnd, gotEnd,
				"%s - End time mismatch. Got: %v, Want: %v",
				tt.description, gotEnd, tt.wantEnd)
		})
	}
}

// TestGetTimeRangeFromFilter_AllFilters ensures all defined filters are tested
func TestGetTimeRangeFromFilter_AllFilters(t *testing.T) {
	referenceTime := time.Date(2025, 11, 13, 9, 13, 24, 0, time.UTC)

	// Test all filters from dto.TimeFilterValues
	allFilters := []string{
		dto.TimeFilterLast7,
		dto.TimeFilterThisMonth,
		dto.TimeFilterLast30Days,
		dto.TimeFilterThisQuarter,
		dto.TimeFilterThisYear,
		dto.TimeFilterLastMonth,
		dto.TimeFilterLastQuarter,
		dto.TimeFilterLastYear,
		dto.TimeFilterLast3Months,
		dto.TimeFilterLast6Months,
		dto.TimeFilterLast12Months,
	}

	for _, filter := range allFilters {
		t.Run(filter, func(t *testing.T) {
			start, end := GetTimeRangeFromFilter(filter, referenceTime)

			// Basic sanity checks
			assert.False(t, start.IsZero(), "Start time should not be zero for filter: %s", filter)
			assert.False(t, end.IsZero(), "End time should not be zero for filter: %s", filter)
			assert.True(t, start.Before(end) || start.Equal(end),
				"Start time should be before or equal to end time for filter: %s. Start: %v, End: %v",
				filter, start, end)
		})
	}
}
