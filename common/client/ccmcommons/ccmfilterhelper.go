package ccmcommons

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/harness/mcp-server/common/client/dto"
)

func BuildFilters(viewId string, timeFilters string, idFilters dto.CCMGraphQLFilters, keyValueFilters dto.CCMGraphQLKeyValueFilters) []map[string]any {
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
				"viewId":    viewId,
				"isPreview": false,
			},
		},
	}
}

func BuildFilterValues(options *dto.CCMPerspectiveFilterValuesOptions) []map[string]any {
	filters := []map[string]any{}
	viewFilter := BuildViewFilter(options.ViewId)
	filters = append(filters, viewFilter...)
	filters = append(filters, BuildTimeFilters(options.TimeFilter)...)

	if options.ValueType == dto.ValueTypeCostCategory ||
		options.ValueType == dto.ValueTypeLabel ||
		options.ValueType == dto.ValueTypeLabelV2 {

		filter, err := BuildKeyValueFieldFilter(options.ValueType, options.ValueSubType, BuildOutputFieldsMap())
		if err == nil {
			filters = append(filters, filter...)
		}
	} else if options.ValueType == dto.ValueTypeLabelKey ||
		options.ValueType == dto.ValueTypeLabelV2Key {
		filter, err := BuildKeyFieldFilter(options.ValueType, BuildOutputFieldsMap())
		if err == nil {
			filters = append(filters, filter...)
		}

	} else {
		filter := BuildFieldFilters(buildFilterForValue(options.ValueType), OutputFields)
		filters = append(filters, filter...)
	}
	return filters
}

func buildFilterForValue(valueType string) dto.CCMGraphQLFilters {
	return map[string][]string{valueType: {""}}
}

func buildFilterForKeyValue(valueType string, valueSubtype string) dto.CCMGraphQLKeyValueFilters {

	filterType := "labels.value"
	if strings.EqualFold(valueType, dto.ValueTypeCostCategory) {
		filterType = "business_mapping"
	}

	return map[string]map[string]any{
		filterType: {
			"filterL1": valueSubtype,
			"filterL2": filterType,
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

func BuildAggregateFunction() []map[string]any {

	return []map[string]any{
		{
			"operationType": "SUM",
			"columnName":    "cost",
		},
	}
}

func BuildPreferences() map[string]any {
	return map[string]any{
		"includeOthers":          false,
		"includeUnallocatedCost": false,
		"awsPreferences": map[string]any{
			"includeDiscounts": false,
			"includeCredits":   false,
			"includeRefunds":   false,
			"includeTaxes":     false,
			"awsCost":          "UNBLENDED",
		},
		"gcpPreferences":       nil,
		"azureViewPreferences": nil,
		"showAnomalies":        false,
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
		for _, out := range output {
			if strings.EqualFold(fName, out["fieldId"]) {
				var idFilterMap = map[string]any{
					"idFilter": map[string]any{
						"values":   values,
						"operator": operator,
						"field":    out,
					},
				}

				result = append(result, idFilterMap)
			}
		}
	}

	return result
}

func BuildKeyValueFieldFilters(input dto.CCMGraphQLKeyValueFilters, output []map[string]string) []map[string]any {
	return BuildKeyValueFieldFiltersWithOperator(input, output, "LIKE")
}

func BuildKeyValueFieldFiltersWithOperator(input dto.CCMGraphQLKeyValueFilters, output []map[string]string, operator string) []map[string]any {
	result := make([]map[string]any, 0)
	for fName, values := range input {
		for _, out := range output {
			if strings.EqualFold(fName, out["identifier"]) {
				fieldName, ok := values["filterL1"].(string)
				if ok {
					out["fieldName"] = fieldName
					var idFilterMap = map[string]any{
						"idFilter": map[string]any{
							"values":   values["filterL2"],
							"operator": operator,
							"field":    out,
						},
					}
					result = append(result, idFilterMap)
				}
			}
		}
	}
	return result
}

func BuildKeyFieldFilter(input string, output map[string]map[string]any) ([]map[string]any, error) {
	return BuildKeyFieldFilterWithOperator(input, output, "LIKE")
}

func BuildKeyFieldFilterWithOperator(fieldKey string, output map[string]map[string]any, operator string) ([]map[string]any, error) {
	result := make([]map[string]any, 0)

	fieldOut, ok := output[fieldKey]
	if !ok {
		return nil, fmt.Errorf("Field key not found when building filter %s", fieldKey)
	}

	out, ok := fieldOut["field"]
	if !ok {
		return nil, fmt.Errorf("Field 'field' key not found in object %s building filter.", fieldKey)
	}
	var idFilterMap = map[string]any{
		"idFilter": map[string]any{
			"values":   []string{""},
			"operator": operator,
			"field":    out,
		},
	}
	result = append(result, idFilterMap)
	return result, nil
}

func BuildKeyValueFieldFilter(fieldKey string, fieldSubKey string, output map[string]map[string]any) ([]map[string]any, error) {
	return BuildKeyValueFieldFilterWithOperator(fieldKey, fieldSubKey, output, "LIKE")
}

func BuildKeyValueFieldFilterWithOperator(fieldKey string, fieldSubKey string, output map[string]map[string]any, operator string) ([]map[string]any, error) {
	result := make([]map[string]any, 0)

	fieldOut, ok := output[fieldKey]

	if !ok {
		return nil, fmt.Errorf("Field key not found when building filter %s", fieldKey)
	}

	out, ok := fieldOut["field"].(map[string]string)

	if !ok {
		return nil, fmt.Errorf("Field 'field' key not found in object %s building filter.", fieldKey)
	}
	out["fieldName"] = fieldSubKey
	var idFilterMap = map[string]any{
		"idFilter": map[string]any{
			"values":   []string{""},
			"operator": operator,
			"field":    out,
		},
	}
	result = append(result, idFilterMap)
	return result, nil
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

func DebugPayload(ctx context.Context, operation string, payload map[string]any) {
	jsonPayload := MapToJSONString(payload)
	slog.DebugContext(ctx, "-----------", "----------", "--------------")
	slog.DebugContext(ctx, operation, "Payload", jsonPayload)
	slog.DebugContext(ctx, "-----------", "----------", "--------------")
}

func MapToJSONString(m map[string]any) string {
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

func BuildOutputFieldsMap() map[string]map[string]any {
	result := make(map[string]map[string]any)
	// regular type from OutputFieldsList
	for _, field := range OutputFields {
		if id, ok := field["fieldId"]; ok {
			result[id] = map[string]any{
				"field": field,
				"type":  "regular",
			}
		}
	}
	// keyValue type from OutputKeyValueFields
	for _, field := range OutputKeyValueFields {
		if id, ok := field["identifier"]; ok {
			result[strings.ToLower(id)] = map[string]any{
				"field": field,
				"type":  "keyValue",
			}
		}
	}
	// key type from OutputKeyFields
	for _, field := range OutputKeyFields {
		if id, ok := field["identifier"]; ok {
			result[strings.ToLower(id)+"_key"] = map[string]any{
				"field": field,
				"type":  "key",
			}
		}
	}
	return result
}
