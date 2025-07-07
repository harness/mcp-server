package ccmcommons

import (
	"fmt"
)

var CCMPerspectiveGridDescription = `
Query detailed cost perspective grid data in Harness Cloud Cost Management.
This tool allows you to retrieve tabular cost data for a given perspective (view) with advanced filtering, grouping, and aggregation options.
You can filter by AWS account, service, region, product, and custom labels, as well as group results by fields such as product, region, or cost category.

For example, you can:
- Get the total AWS EC2 cost per region for the last 30 days.
- Retrieve cost trends for specific products or business mappings across multiple accounts.

Supports LIKE-style filtering for arrays and key-value filters for business mappings and labels.
`


var CCMPerspectiveTimeSeriesDescription = `
Query detailed time series perspective data in Harness Cloud Cost Management.
`

var commonFilterDesc = `It is applied using LIKE operator in an array. Example: ["value1", "value2", ...]`
var CCMFilterFields = []map[string]string{
	{
		"name":        "aws_account",
		"description": fmt.Sprintf("Filter results by AWS account identifier. %s", commonFilterDesc),
	},
	{
		"name":        "aws_billing_entity",
		"description": fmt.Sprintf("Filter results by AWS billing entity. %s", commonFilterDesc),

	},
	{
		"name":        "aws_instance_type",
		"description": fmt.Sprintf("Filter results by AWS instance type. %s", commonFilterDesc),

	},
	{
		"name":        "aws_line_item_type",
		"description": fmt.Sprintf("Filter results by AWS line item type. %s", commonFilterDesc),
	},
	{
		"name":        "aws_payer_account",
		"description": fmt.Sprintf("Filter results by AWS payer account. %s", commonFilterDesc),
	},
	{
		"name":        "aws_service",
		"description": fmt.Sprintf("Filter results by AWS service. %s", commonFilterDesc),
	},
	{
		"name":        "aws_usage_type",
		"description": fmt.Sprintf("Filter results by AWS usage type. %s", commonFilterDesc),
	},
	{
		"name":        "region",
		"description": fmt.Sprintf("Filter results by region. %s", commonFilterDesc),
	},
	{
		"name":        "cloud_provider",
		"description": fmt.Sprintf("Filter results by cloud provider. %s", commonFilterDesc),
	},
	{
		"name":        "product",
		"description": fmt.Sprintf("Filter results by product. %s", commonFilterDesc),
	},
}

var commonKvFilterDesc = `Values are provided in the format '{"filterL1": "value1", "filterL2": ["value2", "value3", ...]}', where 'filterL1' represents the selected `
var CCMKeyValueFilterFields = []map[string]string{
	{
		"name":        "bussines_mapping",
		"description": fmt.Sprintf("Filter results by Cost Category and Bucket. Values have to be retrieved from list of Cost Categories names. %s Cost Category and 'filterL2' corresponds to the Buckets within that category.", commonKvFilterDesc),
		"filterL2": "bucket",
		"l2Description": "Buckets corresponding to the Cost Category",
	},
	{
		"name":        "label",
		"description": fmt.Sprintf("Filter results by  Label and Sub Label. Values for this field corresponds to labels list .%s Label and 'filterL2' corresponds to the Sub Label within that Label.", commonKvFilterDesc),
		"filterL2": "value",
		"l2Description": "Value within the label.",
	},
	{
		"name":        "label_v2",
		"description": fmt.Sprintf("Filter results by Label V2 and Sub Label. Values for this field are listed in label v2 list. %s Label and 'filterL2' corresponds to the Sub Label within that Label.", commonKvFilterDesc),
		"filterL2": "value",
		"l2Description": "Value within the label.",
	},
}


