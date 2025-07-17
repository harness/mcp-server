package ccmcommons

import (
	"time"
	"strings"
	"encoding/json"
	"log/slog"
	"github.com/harness/harness-mcp/client/dto"
)

func BuildFilters(viewId string ,timeFilters string, idFilters dto.CCMGraphQLFilters, keyValueFilters dto.CCMGraphQLKeyValueFilters) ([]map[string]any) {
	filters := []map[string]any{}
	viewFilter := BuildViewFilter(viewId) 
	filters = append(filters, viewFilter...)
	filters = append(filters, BuildTimeFilters(timeFilters)...)
	filters = append(filters, BuildFieldFilters(idFilters, OutputFields)...)
	filters = append(filters, BuildKeyValueFieldFilters(keyValueFilters, OutputKeyValueFields)...)

	return filters
}

func BuildViewFilter(viewId string) []map[string]any {
	return []map[string]any{
		{
			"viewMetadataFilter": map[string]any{
				"viewId": viewId,
				"isPreview": false,
			},
		},
	}
}

func BuildFilterValues(options  *dto.CCMPerspectiveFilterValuesOptions) []map[string]any {
	filters := []map[string]any{}
	viewFilter := BuildViewFilter(options.ViewId) 
	filters = append(filters, viewFilter...)
	filters = append(filters, BuildTimeFilters(options.TimeFilter)...)

	if options.ValueType == dto.ValueTypeCostCategory || 
		options.ValueType == dto.ValueTypeLabel || 
		options.ValueType == dto.ValueTypeLabelV2 {
		filter := BuildKeyValueFieldFilters(buildFilterForKeyValue(options.ValueType, options.ValueSubType), OutputKeyValueFields)
		filters = append(filters, filter...)
	
	} else {
		filter := BuildFieldFilters(buildFilterForValue(options.ValueType), OutputFields)
		filters = append(filters, filter...)
	}
	return filters 
}

func buildFilterForValue(valueType string) dto.CCMGraphQLFilters {
	return map[string][]string{valueType: []string{""}}
}

func buildFilterForKeyValue(valueType string, valueSubtype string) dto.CCMGraphQLKeyValueFilters {

	filterType := "labels.value"
	if strings.EqualFold(valueType, dto.ValueTypeCostCategory) {	
		filterType = "bussines_mapping"
	}

	return map[string]map[string]any{
		filterType: {
			"filterL1": valueSubtype, 
			"filterL2": []string{""},
		},
	}
}

func BuildTimeFilters(timeFilter string) []map[string]any {
	start, end := GetTimeRangeFromFilter(timeFilter, time.Now())
	return []map[string]any{
		{
			"timeFilter": map[string]any{
				"field": map[string]any{
					"fieldId":    "startTime",
					"fieldName":  "startTime",
					"identifier": "COMMON",
				},
				"operator": "AFTER",
				"value":    start.UnixMilli(),
			},
		},
		{
			"timeFilter": map[string]any{
				"field": map[string]any{
					"fieldId":    "startTime",
					"fieldName":  "startTime",
					"identifier": "COMMON",
				},
				"operator": "BEFORE",
				"value":    end.UnixMilli(),
			},
		},
	}
} 

func BuildAggregateFunction() ([]map[string]any) {

	return []map[string]any{
		{
			"operationType": "SUM",
			"columnName": "cost",
		},
	}
} 

func BuildPreferences() (map[string]any) {
	return map[string]any{
		"includeOthers": false,
		"includeUnallocatedCost": false,
		"awsPreferences": map[string]any{
			"includeDiscounts": false,
			"includeCredits": false,
			"includeRefunds": false,
			"includeTaxes": false,
			"awsCost": "UNBLENDED",
		},
		"gcpPreferences": nil,
		"azureViewPreferences": nil,
		"showAnomalies": false,
	}
}

func GetTimeRangeFromFilter(filter string, now time.Time) (start, end time.Time) {
	end = now
	switch filter {
	case dto.TimeFilterLast7:
		start = now.AddDate(0, 0, -7)
	case dto.TimeFilterThisMonth:
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	case dto.TimeFilterLast30Days:
		start = now.AddDate(0, 0, -30)
	case dto.TimeFilterThisQuarter:
		month := ((int(now.Month())-1)/3)*3 + 1
		start = time.Date(now.Year(), time.Month(month), 1, 0, 0, 0, 0, now.Location())
	case dto.TimeFilterThisYear:
		start = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	case dto.TimeFilterLastMonth:
		firstOfThisMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		lastMonth := firstOfThisMonth.AddDate(0, -1, 0)
		start = lastMonth
		end = firstOfThisMonth.Add(-time.Nanosecond)
	case dto.TimeFilterLastQuarter:
		month := ((int(now.Month())-1)/3)*3 + 1
		firstOfThisQuarter := time.Date(now.Year(), time.Month(month), 1, 0, 0, 0, 0, now.Location())
		lastQuarter := firstOfThisQuarter.AddDate(0, -3, 0)
		start = lastQuarter
		end = firstOfThisQuarter.Add(-time.Nanosecond)
	case dto.TimeFilterLastYear:
		start = time.Date(now.Year()-1, 1, 1, 0, 0, 0, 0, now.Location())
		end = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()).Add(-time.Nanosecond)
	case dto.TimeFilterLast3Months:
		start = now.AddDate(0, -3, 0)
	case dto.TimeFilterLast6Months:
		start = now.AddDate(0, -6, 0)
	case dto.TimeFilterLast12Months:
		start = now.AddDate(0, -12, 0)
	default:
		start = now
	}
	return start, end
}


func BuildFieldFilters(input map[string][]string, output []map[string]string) []map[string]any {
	return BuildFieldFiltersWithOperator(input, output, "IN")
}

func BuildFieldFiltersWithOperator(input map[string][]string, output []map[string]string, operator string) []map[string]any {
	result := make([]map[string]any, 0)
	for fName, values := range input {
		slog.Debug("PerspectiveGraphQL", "Field ID ", fName)
		for _, out := range output {
			slog.Debug("PerspectiveGraphQL", "Field ID OUT", out["fieldId"])
			if strings.EqualFold(fName, out["fieldId"]) {
				var idFilterMap = map[string]any{
					"idFilter": map[string]any{
						"values":   values,
						"operator": operator,
						"field": out,
					},
				}

			result = append(result, idFilterMap)
			}
		}
	}

	slog.Debug("PerspectiveGraphQL", "Field ID filters", result)
	return result
}

func BuildKeyValueFieldFilters(input dto.CCMGraphQLKeyValueFilters, output []map[string]string) []map[string]any {
	return BuildKeyValueFieldFiltersWithOperator(input, output, "LIKE")
}

func BuildKeyValueFieldFiltersWithOperator(input dto.CCMGraphQLKeyValueFilters, output []map[string]string, operator string) []map[string]any {
	result := make([]map[string]any, 0)
	for fName, values := range input {
		slog.Debug("PerspectiveGraphQL", "KV Field ID ", fName)
		for _, out := range output {
			slog.Debug("PerspectiveGraphQL", "KV Field ID OUT", out["fieldId"])
			slog.Debug("PerspectiveGraphQL", "KV Field identifier OUT", out["identifier"])
			if strings.EqualFold(fName, out["identifier"]) {
				fieldName, ok := values["filterL1"].(string)
				slog.Debug("PerspectiveGraphQL", "KV Field filterL1 OK", fieldName)
				if ok {
					slog.Debug("PerspectiveGraphQL", "Is OK", fieldName)
					out["fieldName"] = fieldName 
					var idFilterMap = map[string]any{
						"idFilter": map[string]any{
							"values":   values["filterL2"],
							"operator": operator,
							"field": out,
						},
					}
				result = append(result, idFilterMap)
				}
			}
		}
	}
	slog.Debug("PerspectiveGraphQL", "KV Field ID filters", result)
	return result
}

func BuildGroupBy(input map[string]any, outputFields []map[string]string, outputKeyValueFields []map[string]string) []map[string]any {
	// Get the value when grouping by field only.
	field, ok1 := input["field"].(string)
	if ok1 == false {
		return DefaultGroupBy 
	}	

	for _, out := range outputFields {
		if strings.EqualFold(field, out["fieldId"]) {
			return []map[string]any{
				{
					"entityGroupBy": out,
				},
			}
		}
	}

	// Get the value when grouping by key,value.
	value, ok2 := input["value"].(string)
	if ok2 == false {
		return DefaultGroupBy 
	}
	for _, out := range outputKeyValueFields {
		if strings.EqualFold(field, out["identifier"]) {
			out["fieldName"] = value
			return []map[string]any{
				{
					"entityGroupBy": out,
				},
			}
		}
	}
	return DefaultGroupBy 
}

func DebugPayload(operation string, payload map[string]any) {
	jsonPayload := MapToJSONString(payload)
	slog.Debug("-----------", "----------", "--------------")
	slog.Debug(operation, "Payload", jsonPayload)
	slog.Debug("-----------", "----------", "--------------")
}

func MapToJSONString(m map[string]any) (string) {
	b, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return ""
	}
	return string(b)
}

func GetFilterFieldByType(fieldType string) map[string]string {
	for _, field := range OutputFields {
		if field["fieldId"] == fieldType {
			return field
		}
	}
	return nil
}
