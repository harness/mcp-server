package dto

const (
	HOUR    PeriodType = "HOUR"
	DAY     PeriodType = "DAY"
	MONTH   PeriodType = "MONTH"
	WEEK    PeriodType = "WEEK"
	QUARTER PeriodType = "QUARTER"
	YEAR    PeriodType = "YEAR"
)

type PeriodType string

// CEView represents a ccm overview
type CEView struct {
	Status        string      `json:"state,omitempty"`
	Data          CCMOverview `json:"data,omitempty"`
	CorrelationID string      `json:"correlation_id,omitempty"`
}

// CCMOverview represents the Overview data from a CCM Overview
type CCMOverview struct {
	CostPerDay           []TimeSeriesDataPoints `json:"costPerDay,omitempty"`
	TotalCost            float64                `json:"totalCost,omitempty"`
	TotalCostTrend       float64                `json:"totalCostTrend,omitempty"`
	RecommendationsCount int32                  `json:"recommendationsCount,omitempty"`
}

// TimeSeriesDataPoints represents the data points for a time series
type TimeSeriesDataPoints struct {
	Values []CcmDataPoint `json:"values,omitempty"`
	Time   int64          `json:"time,omitempty"`
}

// CcmDataPoint represents a data point in the time series
type CcmDataPoint struct {
	Key   CCMReference `json:"key,omitempty"`
	Value float64      `json:"value,omitempty"`
}

// CCMReference represents a reference to a CCM entity
type CCMReference struct {
	Id   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
	Type string `json:"type,omitempty"`
}
