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
