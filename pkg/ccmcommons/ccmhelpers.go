package ccmcommons

import (
	"strings"
	"github.com/harness/harness-mcp/client/ccmcommons"
	"github.com/google/uuid"
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


// buildFieldMetaMaps builds lookup maps for OutputFields
func buildFieldMetaMaps() (map[string]map[string]string) {
	fieldMetaMap := make(map[string]map[string]string)
	for _, f := range OutputFields {
		if id, ok := f["fieldId"]; ok {
			fieldMetaMap[id] = f
		}
	}
	return fieldMetaMap
}

// buildFieldMetaMaps builds lookup maps for OutputKeyValueFields
func buildKeyValueFieldMetaMaps() (map[string]map[string]string) {
	keyValueMetaMap := make(map[string]map[string]string)
	for _, f := range OutputKeyValueFields {
		if id, ok := f["fieldId"]; ok {
			keyValueMetaMap[id] = f
		}
	}
	return keyValueMetaMap
}

// AdaptViewRulesMap converts an array of rule maps (each with conditions) to []*CCMViewRule.
// Uses OutputFields and OutputKeyValueFields for field metadata.
func AdaptViewRulesMap(input []map[string]any) ([]*CCMViewRule, error) {
	fieldMetaMap, keyValueMetaMap := buildFieldMetaMaps()

	var rules []*CCMViewRule
	for _, ruleMap := range input {
		conditionsIface, ok := ruleMap["conditions"].([]any)
		if !ok {
			continue
		}
		var rule CCMViewRule
		for _, condIface := range conditionsIface {
			cond, ok := condIface.(map[string]any)
			if !ok {
				continue
			}
			fieldId, _ := cond["field_id"].(string)
			operator, _ := cond["view_operator"].(string)
			valuesIface, _ := cond["values"].([]string)
			var values []string
			for _, v := range valuesIface {
				values = append(values, s)
			}

			var fieldMeta map[string]string
			switch fieldId {
			case "label", "label_v2", "business_mapping":
				fieldMeta = keyValueMetaMap[fieldId]
			default:
				fieldMeta = fieldMetaMap[fieldId]
			}
			if fieldMeta == nil {
				continue	
			}

			rule.ViewConditions = append(rule.ViewConditions, CCMViewCondition{
				Type:         uuid.New().String(),
				ViewOperator: operator,
				Values:       values,
				ViewField: CCMViewField{
					FieldId:        fieldMeta["fieldId"],
					FieldName:      fieldMeta["fieldName"],
					Identifier:     fieldMeta["identifier"],
					IdentifierName: fieldMeta["identifierName"],
				},
			})
		}
		rules = append(rules, &rule)
	}
	return rules, nil
}
