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
