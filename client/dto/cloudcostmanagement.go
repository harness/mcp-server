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

<<<<<<< HEAD
// CCMBaseResponse represents a basic ccm response.
=======

// CEView represents a basic ccm response.
// The `data` field contains the response data.
>>>>>>> 1554fc7 (Added List Cloud Cost Management tool)
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

<<<<<<< HEAD
// CEView represents a basic ccm response.
// The `data` field contains the response data.
=======
>>>>>>> 1554fc7 (Added List Cloud Cost Management tool)
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

<<<<<<< HEAD
// ***************************
// Cost Category (name) List
// ***************************

=======
>>>>>>> 1554fc7 (Added List Cloud Cost Management tool)
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
<<<<<<< HEAD

// ***************************
// Cost Category Details List
// ***************************

type CCMPaginationOptions struct {
	Limit             int32  `json:"limit,omitempty"`
	Offset            int32  `json:"offset,omitempty"`
}

type CCMListCostCategoriesDetailOptions struct {
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	SearchKey         string `json:"searchKey,omitempty"`
	SortType          string `json:"sortType,omitempty"` // Enum: "NAME", "LAST_EDIT"
	SortOrder         string `json:"sortOrder,omitempty"` // Enum: "ASCENDING", "DESCENDING"
	CCMPaginationOptions
}

type CCMCostCategoryDetailList struct {
	MetaData         map[string]interface{}          `json:"metaData"`
	Resource         CCMCostCategoryResource          `json:"resource"`
	ResponseMessages []CCMResponseMessage `json:"responseMessages"`
}

type CCMCostCategoryResource struct {
	BusinessMappings []CCMBusinessMapping `json:"businessMappings"`
	TotalCount       int                  `json:"totalCount"`
}

type CCMBusinessMapping struct {
	UUID           string            `json:"uuid"`
	Name           string            `json:"name"`
	AccountID      string            `json:"accountId"`
	CostTargets    []CCMCostTarget   `json:"costTargets"`
	SharedCosts    []CCMSharedCost   `json:"sharedCosts"`
	UnallocatedCost CCMUnallocatedCost `json:"unallocatedCost"`
	DataSources    []string          `json:"dataSources"`
	CreatedAt      int64             `json:"createdAt"`
	LastUpdatedAt  int64             `json:"lastUpdatedAt"`
	CreatedBy      CCMUser           `json:"createdBy"`
	LastUpdatedBy  CCMUser           `json:"lastUpdatedBy"`
}

type CCMCostTarget struct {
	Name  string        `json:"name"`
	Rules []CCMRule     `json:"rules"`
}

type CCMSharedCost struct {
	Name      string        `json:"name"`
	Rules     []CCMRule     `json:"rules"`
	Strategy  string        `json:"strategy"`
	Splits    []CCMSplit    `json:"splits"`
}

type CCMUnallocatedCost struct {
	Strategy        string     `json:"strategy"`
	Label           string     `json:"label"`
	SharingStrategy string     `json:"sharingStrategy"`
	Splits          []CCMSplit `json:"splits"`
}

type CCMSplit struct {
	CostTargetName        *string  `json:"costTargetName"`
	PercentageContribution *float64 `json:"percentageContribution"`
}

type CCMRule struct {
	ViewConditions []interface{} `json:"viewConditions"`
}

type CCMUser struct {
	UUID           string `json:"uuid"`
	Name           string `json:"name"`
	Email          string `json:"email"`
	ExternalUserID string `json:"externalUserId"`
}

type CCMResponseMessage struct {
	Code           string                 `json:"code"`
	Level          string                 `json:"level"`
	Message        string                 `json:"message"`
	Exception      *CCMException          `json:"exception"`
	FailureTypes   []string               `json:"failureTypes"`
	AdditionalInfo map[string]string      `json:"additionalInfo"`
}

type CCMException struct {
	StackTrace       []CCMStackTraceElement `json:"stackTrace"`
	Message          string                 `json:"message"`
	Suppressed       []CCMSuppressed        `json:"suppressed"`
	LocalizedMessage string                 `json:"localizedMessage"`
}

type CCMStackTraceElement struct {
	ClassLoaderName *string `json:"classLoaderName"`
	ModuleName      *string `json:"moduleName"`
	ModuleVersion   *string `json:"moduleVersion"`
	MethodName      *string `json:"methodName"`
	FileName        *string `json:"fileName"`
	LineNumber      *int    `json:"lineNumber"`
	NativeMethod    *bool   `json:"nativeMethod"`
	ClassName       *string `json:"className"`
}

type CCMSuppressed struct {
	StackTrace       []CCMStackTraceElement `json:"stackTrace"`
	Message          string                 `json:"message"`
	LocalizedMessage string                 `json:"localizedMessage"`
}

// CCMCostCategory represents the details of a cost category in CCM
type CCMCostCategory struct {
	MetaData         map[string]interface{}	`json:"metaData"`
	Resource       	 CCMBusinessMapping     `json:"resource"`
	ResponseMessages []CCMResponseMessage 	`json:"responseMessages"`
}

// CcmGetCostCategoryOptions represents options for listing cost categories
type CCMGetCostCategoryOptions struct {
	AccountIdentifier string `json:"accountIdentifier,omitempty"`
	CostCategoryId string `json:"id,omitempty"`
}
<<<<<<< HEAD
=======
>>>>>>> 1554fc7 (Added List Cloud Cost Management tool)
=======
>>>>>>> 243276b (Added Get Cost Category by Id)
