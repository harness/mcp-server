package dto

const (
	CloudProviderAWS   = "AWS"
	CloudProviderGCP   = "GCP"
	CloudProviderAZURE = "AZURE"
)

const (
	GovFilterOperatorsNotIn               = "NOT_IN"
	GovFilterOperatorsIn                  = "IN"
	GovFilterOperatorsEquals              = "EQUALS"
	GovFilterOperatorsNotNull             = "NOT_NULL"
	GovFilterOperatorsNull                = "NULL"
	GovFilterOperatorsLike                = "LIKE"
	GovFilterOperatorsGreaterThan         = "GREATER_THAN"
	GovFilterOperatorsLessThan            = "LESS_THAN"
	GovFilterOperatorsGreaterThanEqualsTo = "GREATER_THAN_EQUALS_TO"
	GovFilterOperatorsLessThanEqualsTo    = "LESS_THAN_EQUALS_TO"
	GovFilterOperatorsAfter               = "AFTER"
	GovFilterOperatorsBefore              = "BEFORE"
)

type CCMGovernanceValuesOptions struct {
	AccountIdentifier string
	CloudProvider     string
	Filters           []map[string]any
}
