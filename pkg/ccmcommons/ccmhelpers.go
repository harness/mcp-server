package ccmcommons

import (
	"log/slog"
	"strings"
	"fmt"
	"reflect"
	"github.com/harness/harness-mcp/client/ccmcommons"
	"github.com/harness/harness-mcp/client/dto"
)

func GetFilterInstructions() string {
	// Build a map for fast lookup by fieldId
	fieldsMap := make(map[string]map[string]string)
	for _, field := range ccmcommons.OutputFields {
		fieldsMap[field["fieldId"]] = field
	}

	instructions := "To create a filter rule in a perspective for a specific field, use the corresponding map entry and all its properties as shown below:\n\n"
	for _, desc := range ConditionFieldDescriptions {
		fieldId := desc["fieldId"]
		description := desc["description"]
		if field, ok := fieldsMap[fieldId]; ok {
			instructions += description + "\n"
			instructions += `
			Map: {
				"fieldId": "` + field["fieldId"] + `",
			}`
		}
	}

	for _, desc := range ConditionKeyValueFieldDescriptions {
		fieldId := desc["fieldId"]
		description := desc["description"]
		if _, ok := fieldsMap[fieldId]; ok {
			instructions += description + "\n"
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


// // buildFieldMetaMaps builds lookup maps for OutputFields
// func buildFieldMetaMaps() (map[string]map[string]string) {
// 	fieldMetaMap := make(map[string]map[string]string)
// 	for _, f := range ccmcommons.OutputFields {
// 		if id, ok := f["fieldId"]; ok {
// 			fieldMetaMap[id] = f
// 		}
// 	}
// 	return fieldMetaMap
// }

// // buildFieldMetaMaps builds lookup maps for OutputKeyValueFields
// func buildKeyValueFieldMetaMaps() (map[string]map[string]string) {
// 	keyValueMetaMap := make(map[string]map[string]string)
// 	for _, f := range ccmcommons.OutputKeyValueFields {
// 		if id, ok := f["fieldId"]; ok {
// 			keyValueMetaMap[id] = f
// 		}
// 	}
// 	return keyValueMetaMap
// }

// AdaptViewRulesMap converts an array of rule maps (each with conditions) to []*CCMViewRule.
// Uses OutputFields and OutputKeyValueFields for field metadata.
func AdaptViewRulesMap(input []any) ([]dto.CCMViewRule, error) {
	fieldMap := ccmcommons.BuildOutputFieldsMap()

	slog.Debug("AdaptViewRulesMap", "input", input)
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

			fieldId, ok := viewField["field1_id"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing view field 'field1_id' when adapting perspecive rules for field ")
			}
			// condType, ok := cond["type"].(string)
			// if !ok {
			// 	return nil, fmt.Errorf("Missing condition field 'type' when adapting perspecive rules for field %s", fieldId)
			// }

			operator, ok := cond["view_operator"].(string)
			if !ok {
				return nil, fmt.Errorf("Missing field 'view_operator' when adapting perspecive rules for field %s", fieldId)
			}

			slog.Debug("AdaptViewRulesMap", "condition", cond)
			slog.Debug("AdaptViewRulesMap", "values", cond["values"])
			slog.Debug("AdaptViewRulesMap", "values type", reflect.TypeOf(cond["values"]))
			valuesIface, ok := cond["values"].([]any)
			if !ok {
				return nil, fmt.Errorf("Missing field 'values' when adapting perspecive rules for field %s", fieldId)
			}
			var values []string
			for _, v := range valuesIface {
				values = append(values, v.(string))
			}
			var metaField = "field"
			var fieldMeta map[string]string
			switch fieldId {
			case "label", "label_v2":
				fieldMeta, ok = fieldMap[fieldId][metaField].(map[string]string)
				if !ok {
					return nil, fmt.Errorf("field %s not found in view rules map when adapting", fieldId)
				}
				labelId, ok := viewField["field2_id"].(string)
				if !ok {
					return nil, fmt.Errorf("field2_id not found in view rules map when adapting %s", fieldId)
				}
				fieldMeta["fieldName"] = labelId

			case "business_mapping":
				fieldMeta, ok = fieldMap[fieldId][metaField].(map[string]string)
				if !ok {
					return nil, fmt.Errorf("field %s not found in view rules map when adapting", fieldId)
				}
				costCategoryId, ok := viewField["field2_id"].(string)
				if !ok {
					return nil, fmt.Errorf("field2_id not found in perspective rules map when adapting %s", fieldId)
				}
				costCategoryName, ok := viewField["field3_id"].(string)
				if !ok {
					return nil, fmt.Errorf("field3_id not found in perspective rules map when adapting %s", fieldId)
				}
				fieldMeta["fieldId"] = costCategoryId
				fieldMeta["fieldName"] = costCategoryName

			default:
				fieldMeta, ok = fieldMap[fieldId][metaField].(map[string]string)
				if !ok {
					return nil, fmt.Errorf("field %s not found in perspective rules map when adapting", fieldId)
				}
			}
			if fieldMeta == nil {
				return nil, fmt.Errorf("Error adapting perspective rules for field %s", fieldId)
			}

			rule.ViewConditions = append(rule.ViewConditions, dto.CCMViewCondition{
				Type:         "VIEW_ID_CONDITION",
				ViewOperator: operator,
				Values:       values,
				ViewField: dto.CCMViewField{
					FieldId:        fieldMeta["fieldId"],
					FieldName:      fieldMeta["fieldName"],
					Identifier:     fieldMeta["identifier"],
					IdentifierName: fieldMeta["identifierName"],
				},
			})
		}
		rules = append(rules, rule)
	}
	return rules, nil
}


// func BuildOutputFieldsMap() map[string]map[string]any {
