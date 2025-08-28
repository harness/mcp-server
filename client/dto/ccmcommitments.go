package dto

import "time"

const (
	CommitmentType           string = "Commitment Type"
	CommitmentInstanceFamily string = "Instance Family"
	CommitmentRegion         string = "Regions"
)

const (
	CommitmentCoverageStatusWellOptimized string = "Well Optimized"
	CommitmentCoverageStatusGood          string = "Good Coverage"
	CommitmentCoverageStatusAdequate      string = "Adequate Coverage"
)

type CommitmentCoverageRow struct {
	Key                *string  `json:"key"`
	CoveragePercentage *float64 `json:"coveragePercentage"`
	Cost               *float64 `json:"cost"`
	CoverageStatus     *string  `json:"coverageStatus"`
	OndemandCost       *float64 `json:"ondemandCost"`
	Grouping           string   `json:"grouping"`
}

type ComputeCoveragesDetailTable struct {
	ReservationCost    *float64 `json:"reservation_cost,omitempty"`
	TotalCost          *float64 `json:"total_cost,omitempty"`
	OnDemandCost       *float64 `json:"on_demand_cost,omitempty"`
	TotalHours         *float64 `json:"total_hours,omitempty"`
	TotalCoveredHours  *float64 `json:"total_covered_hours,omitempty"`
	OnDemandHours      *float64 `json:"on_demand_hours,omitempty"`
	SavingsPlanHours   *float64 `json:"savings_plan_hours,omitempty"`
	RICoverageHours    *float64 `json:"ri_coverage_hours,omitempty"`
	CoveragePercentage *float64 `json:"coverage,omitempty"`
	Region             *string  `json:"region,omitempty"`
	MachineType        *string  `json:"machine_type,omitempty"`
	Trend              *float64 `json:"trend,omitempty"`
	SpotCost           *float64 `json:"spot_cost,omitempty"`
	SpotHours          *float64 `json:"spot_hours,omitempty"`
}

type ComputeCoverageChart struct {
	Day          time.Time `json:"date"`
	CoverageCost float64   `json:"coverage_cost"`
}

type ComputeCoveragesDetail struct {
	Table *ComputeCoveragesDetailTable `json:"table,omitempty"`
	Chart []*ComputeCoverageChart      `json:"chart,omitempty"`
}

type CommitmentEstimatedSavings struct {
	AnnualizedSavings float64 `json:"annualized_savings,omitempty"`
	CloudAccountID    string  `json:"cloud_account_id,omitempty"`
}

type CommitmentEstimatedSavingsResponse struct {
	Data []*CommitmentEstimatedSavings `json:"data,omitempty"`
}

type EstimatedSavingsRemoteResponse struct {
	CurrentCoverage  float64 `json:"current_coverage"`
	TargetCoverage   float64 `json:"target_coverage"`
	CurrentSavings   float64 `json:"current_savings"`
	EstimatedSavings float64 `json:"estimated_savings"`
}

type ComputeSpendsDetail struct {
	Table *ComputeSpendsDetailTable `json:"table,omitempty"`
	Chart []*ComputeSpendChart      `json:"chart,omitempty"`
}

type ComputeSpendsDetailTable struct {
	TotalSpend float64  `json:"total_spend"`
	Trend      *float64 `json:"trend,omitempty"`
	Service    *string  `json:"service"`
}

type ComputeSpendChart struct {
	Day         time.Time `json:"date"`
	SpendAmount float64   `json:"spend_amount"`
}

type CommitmentUtilisationSummary struct {
	Overall   *CommitmentUtilisationResponse   `json:"overall,omitempty"`
	Breakdown []*CommitmentUtilisationResponse `json:"breakdown,omitempty"`
}

type CommitmentEC2AnalysisResponse struct {
	CommitmentSpends      []*CommitmentSpendsResponse   `json:"commitment_spend,omitempty"`
	CommitmentUtilisation *CommitmentUtilisationSummary `json:"commitment_utilization,omitempty"`
	EstimatedSavings      []*CommitmentEstimatedSavings `json:"estimated_savings,omitempty"`
	CurrentSavings        float64                       `json:"current_savings,omitempty"`
	ESRYearly             float64                       `json:"esr_yearly,omitempty"`
}

type CommitmentSpendsResponse struct {
	Key        string   `json:"key"`
	Cost       float64  `json:"cost"`
	YearlyCost float64  `json:"yearly_cost"`
	Trend      *float64 `json:"trend,omitempty"`
}

type CommitmentUtilisationResponse struct {
	Key          string  `json:"key"`
	ComputeSpend float64 `json:"compute_spend"`
	Percentage   float64 `json:"percentage"`
	Trend        float64 `json:"trend"`
	Utilization  float64 `json:"utilization"`
}

type CommitmentUtilizationChart struct {
	Day                   time.Time `json:"date"`
	UtilizationPercentage float64   `json:"utilization_percentage"`
}

type CommitmentUtlizationsDetail struct {
	Table *CommitmentUtilizationsDetailTable `json:"table,omitempty"`
	Chart []*CommitmentUtilizationChart      `json:"chart,omitempty"`
}

type CommitmentUtilizationsDetailTable struct {
	ComputeSpend float64  `json:"compute_spend"`
	Utilization  float64  `json:"utilization"`
	Percentage   float64  `json:"percentage"`
	Trend        *float64 `json:"trend,omitempty"`
}

type SavingsDetail struct {
	Table *SavingsDetailTable   `json:"table,omitempty"`
	Chart []*SavingsDetailChart `json:"chart,omitempty"`
}

type SavingsDetailTable struct {
	Total      float64  `json:"total"`
	Percentage float64  `json:"percentage"`
	Trend      *float64 `json:"trend,omitempty"`
}

type SavingsDetailChart struct {
	Day     time.Time `json:"date"`
	Savings float64   `json:"savings"`
}
