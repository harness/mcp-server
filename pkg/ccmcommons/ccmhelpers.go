package ccmcommons

import (
	"strings"
	"fmt"
	"github.com/harness/harness-mcp/client/ccmcommons"
	"github.com/harness/harness-mcp/client/dto"
)

func GetFilterInstructions() string {
	// Build a map for fast lookup by fieldId
	fieldsMap :=  ccmcommons.BuildOutputFieldsMap()
	instructions := "To create a filter rule in a perspective for a specific field, use the descriptions shown below:\n\n"
	for _, desc := range ConditionFieldDescriptions {
		fieldId := desc["fieldId"]
		description := desc["description"]
		if field, ok := fieldsMap[fieldId]["field"]; ok {
			fieldObj := field.(map[string]string)
			instructions += description + "\n"
			instructions += `
			Map: {
				"fieldId": "` + fieldObj["fieldId"] + `",
				"fieldName": "` + fieldObj["fieldName"] + `",
				"identifier": "` + fieldObj["identifier"] + `",
				"identifierName": "` + fieldObj["identifierName"] + `",
			}`
		}
	}
	
	return instructions
}

func GetConditionInstructions() string {
	instructions := CreateConditionsInstructions
	instructions = strings.Replace(instructions, "<<VIEW_FIELD_INSTRUCTIONS>>", GetFilterInstructions(), 1) 
	instructions = strings.Replace(instructions, "<<VIEW_OPERATOR_INSTRUCTIONS>>", OperatorsDescription, 1)
	return instructions
}

func ViewFieldIdSupported() []string {
	ids := []string{}
	for _, field := range ccmcommons.OutputFields {
		if id, ok := field["fieldId"]; ok {
			ids = append(ids, id)
		}
	}

	for _, field := range ccmcommons.OutputKeyValueFields {
		if id, ok := field["identifier"]; ok {
			ids = append(ids, strings.ToLower(id))
		}

	}
	return ids
}

func GetSupportedOperators() []string {
	return []string{
		dto.ConditionOperatorIn,
		dto.ConditionOperatorNotIn,
		dto.ConditionOperatorEquals,
		dto.ConditionOperatorNotNull,
		dto.ConditionOperatorNull,
		dto.ConditionOperatorLike,
	}
}

// AdaptViewRulesMap converts an array of rule maps (each with conditions) to []*CCMViewRule.
// Uses OutputFields and OutputKeyValueFields for field metadata.
func AdaptViewRulesMap(input []any) ([]dto.CCMViewRule, error) {

	var rules []dto.CCMViewRule
	for _, ruleMap := range input {
		ruleMapTyped, ok := ruleMap.(map[string]any)
		if !ok {
			continue
		}

		conditionsIface, ok := ruleMapTyped["view_conditions"].([]any)
		if !ok {
			return nil, fmt.Errorf("Couldn't cast conditions when adapting perspective rules %s", conditionsIface)
		}
		var rule dto.CCMViewRule
		for _, condIface := range conditionsIface {
			cond, ok := condIface.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("Couldn't cast condition to map[string]any when adapting %s", condIface)
			}
			viewField, ok := cond["view_field"].(map[string]any) 
			if !ok {
				return nil, fmt.Errorf("Couldn't extract view field from perspective rules map when adapting %s", cond)
			}

			fieldId, ok := viewField["field_id"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing view field 'field1_id' when adapting perspecive rules for field ")
			}

			fieldName, ok := viewField["field_name"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing view field 'field_name' when adapting perspecive rules for field ")
			}

			identifier, ok := viewField["identifier"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing view field 'identifier' when adapting perspecive rules for field ")
			}

			identifierName, ok := viewField["identifier_name"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing view field 'identifier' when adapting perspecive rules for field ")
			}


			operator, ok := cond["view_operator"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing field 'view_operator' when adapting perspecive rules for field %s", fieldId)
			}

			valuesIface, ok := cond["values"].([]any)
			if !ok {
				return nil, fmt.Errorf("Missing field 'values' when adapting perspecive rules for field %s", fieldId)
			}
			var values []string
			for _, v := range valuesIface {
				values = append(values, v.(string))
			}
			viewCondition := dto.CCMViewCondition{
				Type:         "VIEW_ID_CONDITION",
				ViewOperator: operator,
				Values:       values,
				ViewField: dto.CCMViewField{
					FieldId:        fieldId,
					FieldName:      fieldName,
					Identifier:     identifier,
					IdentifierName: identifierName,
				},
			}

			rule.ViewConditions = append(rule.ViewConditions, viewCondition)
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

func AdaptViewVisualization(input map[string]any) (dto.CCMViewVisualization, error) {
	groupBy := dto.CCMGroupBy{}
	gb, ok := input["group_by"].(map[string]any)
	if !ok {
		return dto.CCMViewVisualization{}, fmt.Errorf("groupBy field is missing or not an object")
	}

	var missingFields []string

	if v, ok := gb["field_id"].(string); ok && v != "" {
		groupBy.FieldId = v
	} else {
		missingFields = append(missingFields, "field_id")
	}
	if v, ok := gb["field_name"].(string); ok && v != "" {
		groupBy.FieldName = v
	} else {
		missingFields = append(missingFields, "field_name")
	}
	if v, ok := gb["identifier"].(string); ok && v != "" {
		groupBy.Identifier = v
	} else {
		missingFields = append(missingFields, "identifier")
	}
	if v, ok := gb["identifier_name"].(string); ok && v != "" {
		groupBy.IdentifierName = v
	} else {
		missingFields = append(missingFields, "identifier_name")
	}

	if len(missingFields) > 0 {
		return dto.CCMViewVisualization{}, fmt.Errorf("Missing or empty groupBy fields: %v", missingFields)
	}

	return dto.CCMViewVisualization{
		Granularity: getStringFromMap(input, "granularity"),
		GroupBy:     groupBy,
		ChartType:   getStringFromMap(input, "chart_type"),
	}, nil
}

func getStringFromMap(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
