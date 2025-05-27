package dto

const (
	PeriodTypeHour    string = "HOUR"
	PeriodTypeDay     string = "DAY"
	PeriodTypeMonth   string = "MONTH"
	PeriodTypeWeek    string = "WEEK"
	PeriodTypeQuarter string = "QUARTER"
	PeriodTypeYear    string = "YEAR"
)

type PeriodType string

// CEView represents a basic ccm response.
// The `data` field contains the response data.
type CCMBaseResponse struct {
	Status        string      `json:"state,omitempty"`
	Message	   string      `json:"message,omitempty"`
	CorrelationID string      `json:"correlation_id,omitempty"`
	Error		 []CCMError      `json:"error,omitempty"`
}

// Response error
type CCMError struct {
	FieldId	 string `json:"fieldId,omitempty"`
	Error string `json:"error,omitempty"`
}

type CEView struct {
	CCMBaseResponse
	Data          CCMOverview `json:"data,omitempty"`
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

// CcmCostCategoriesOptions represents options for listing cost categories
type CcmListCostCategoriesOptions struct {
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	CostCategory string `json:"costCategory,omitempty"`
	SearchTerm string `json:"search,omitempty"`
}

// CcmCostCategoryList represents a list of cost categories in CCM
type CCMCostCategoryList struct {
	CCMBaseResponse
	Data []string `json:"data,omitempty"`
}
