package ccmcommons

var OutputFields = []map[string]string{
	{
		"fieldId":        "region",
		"fieldName":      "Region",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
	{
		"fieldId":        "awsUsageaccountid",
		"fieldName":      "Account",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsServicecode",
		"fieldName":      "Service",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsBillingEntity",
		"fieldName":      "Billing Entity",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsUsageaccountid",
		"fieldName":      "Account",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsInstancetype",
		"fieldName":      "Instance Type",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsLineItemType",
		"fieldName":      "Line Item Type",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awspayeraccountid",
		"fieldName":      "Payer Account",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "awsUsageType",
		"fieldName":      "Usage Type",
		"identifier":     "AWS",
		"identifierName": "AWS",
	},
	{
		"fieldId":        "cloudProvider",
		"fieldName":      "Cloud Provider",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
	{
		"fieldId":        "none",
		"fieldName":      "None",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
	{
		"fieldId":        "product",
		"fieldName":      "Product",
		"identifier":     "COMMON",
		"identifierName": "Common",
	},
}

var OutputKeyValueFields = []map[string]string{
	{
		"fieldId":        "labels.value",
		"fieldName":      "", // Label name
		"identifier":     "LABEL",
		"identifierName": "Label",
	},
	{
		"fieldId":        "labels.value",
		"fieldName":      "", // Label name
		"identifier":     "LABEL_V2",
		"identifierName": "Label V2",
	},
	{
		"fieldId":        "", // Cost Category Id
		"fieldName":      "", // Cost Category Name
		"identifier":     "BUSINESS_MAPPING",
		"identifierName": "Cost Categories",
	},
}

var OutputKeyFields = []map[string]string{
	{
		"fieldId":        "labels.key",
		"fieldName":      "",
		"identifier":     "LABEL",
	},
	{
		"fieldId":        "labels.key2",
		"fieldName":      "",
		"identifier":     "LABEL_V2",
	},
}

var DefaultGroupBy = []map[string]any{ 
		{	
			"entityGroupBy": map[string]any{
				"fieldId":        "product",
				"fieldName":      "Product",
				"identifier":     "COMMON",
				"identifierName": "Common",
			},
		},
	}

var ConditionFieldDescriptions = []map[string]string{
	{
		"fieldId":     "region",
		"description": "Use this field to create a view filter rule to filter by cloud region.",
	},
	{
		"fieldId":     "awsUsageaccountid",
		"description": "Use this field to create a view filter rule to filter by AWS usage account ID.",
	},
	{
		"fieldId":     "awsServicecode",
		"description": "Use this field to create a view filter rule to filter by AWS service code.",
	},
	{
		"fieldId":     "awsBillingEntity",
		"description": "Use this field to create a view filter rule to filter by AWS billing entity.",
	},
	{
		"fieldId":     "awsInstancetype",
		"description": "Use this field to create a view filter rule to filter by AWS instance type.",
	},
	{
		"fieldId":     "awsLineItemType",
		"description": "Use this field to create a view filter rule to filter by AWS line item type.",
	},
	{
		"fieldId":     "awspayeraccountid",
		"description": "Use this field to create a view filter rule to filter by AWS payer account ID.",
	},
	{
		"fieldId":     "awsUsageType",
		"description": "Use this field to create a view filter rule to filter by AWS usage type.",
	},
	{
		"fieldId":     "cloudprovider",
		"description": "use this field to create a view filter rule to filter by cloud provider.",
	},
	{
		"fieldId":     "none",
		"description": "use this field to create a view filter rule with no filter or grouping applied.",
	},
	{
		"fieldId":     "product",
		"description": "use this field to create a view filter rule to filter by product.",
	},
}

var labelDescription = `
Use this field to create a view filter rule to filter by Label.
Use the following Map format:
{
	"field1_id": "label",
	"field2_id": Select a value from the list returned by the 'ccm_filter_values' tool with field_type set to 'label'
}
`

var labelV2Description = `
Use this field to create a view filter rule to filter by Label V2.
Use the following Map format:
{
	"field1_id": "label_v2",
	"field2_id": Select a value from the list returned by the 'ccm_filter_values' tool with field_type set to 'label_v2'
}
`
var costCategoryDescription = `
Use this field to create a view filter rule to filter by Cost Category.
Use the following Map format:
{
	"field1_id": "business_mapping",
	"field2_id": "Select a value from the 'uuid' field returned by the tool list_ccm_cost_categories_detail.",
	"field3_id": Select the value from 'name' field corresonding to the 'uuid' field returned by the list_ccm_cost_categories_detail used in 'field_id'
}
`

var ConditionKeyValueFieldDescriptions = []map[string]string{
	{
		"fieldId":     "label",
		"description": labelDescription,
	},
	{
		"fieldId":     "label_v2",
		"description": labelV2Description, 
	},
	{
		"fieldId":     "business_mapping",
		"description": costCategoryDescription, 
	},
}
