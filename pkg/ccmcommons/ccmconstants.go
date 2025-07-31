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

var CCMPerspectiveSummaryWithBudgetDescription = `
Query detailed time series perspective data in Harness Cloud Cost Management.
`
var CCMGetCcmMetadataDescription = `
Get metadata about available cloud connectors, cost data sources, default perspectives, and currency preferences in Harness Cloud Cost Management.
`

var CCMPerspectiveRecommendationsDescription = `
Returns monthly cost, savings, and a list of open recommendations for a perspective in Harness Cloud Cost Management.
`

var CCMPerspectiveFilterValuesDescription = `
Returns available filter values for a given cost perspective in Harness Cloud Cost Management, allowing you to dynamically discover valid filter options (such as AWS accounts, regions, products, or cost categories) based on your selected perspective, time range, and other criteria. This tool helps you build advanced queries by listing all possible values for a filter field.
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
	{
		"name":        "label_key",
		"description": fmt.Sprintf("Filter results by label. %s", commonFilterDesc),
	},
	{
		"name":        "label_v2_key",
		"description": fmt.Sprintf("Filter results by label v2. %s", commonFilterDesc),
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

var OperatorsDescription = `
	Operators used to filters values in the perspective	

	**IN / NOT_IN**
	These operators check whether a field’s value exists (or does not exist) within a provided list.

	**IN** returns true if the value matches any in the list.

	**NOT_IN** returns true if the value matches none of the list.
	This is efficient for matching or excluding multiple specific values 

	**EQUALS**
	A simple equality check: returns true if the field equals the provided value exactly.

	**NULL / NOT_NULL**
	These handle missing or present values.

	**NULL** checks if the field has no value.

	**NOT_NULL** checks if the field contains any value.
	Unlike standard comparisons, = NULL or != NULL don’t work correctly in SQL—you must use IS NULL or IS NOT NULL 

	**LIKE**
	Pattern matching using wildcards: % (any sequence of characters) or _ (single character).
	Returns true if the field’s value matches the specified pattern. Conversely, NOT LIKE matches if it does not match the pattern
	`


var CreateConditionsInstructions = `
To genere rules for filtering views in a cloud cost management system. Your output must be a JSON object matching the <CONDITIONS> format below, which will be transformed into a Go struct format described by the MCP Server.

<CONDITIONS>
{
  "view_conditions": [
    {
      "view_field": {
        "field_id": "<string>",
        "field2_id": "<string>"
      },
      "view_operator": "<string>",
      "values": ["<string>", ...]
    }
  ]
}
</CONDITIONS>

Instructions:
1. For each rule, create a condition object in the "view_conditions" array.
2. For "view_field":
<<VIEW_FIELD_INSTRUCTIONS>>
3. For "view_operator",
<<VIEW_OPERATOR_INSTRUCTIONS>>
4. "values" is an array of strings to filter against.
5. Ensure all required fields are present: "view_field", "view_operator", "values".
6. The output must be valid JSON matching the <CONDITIONS> format.

Use the provided field_id values and descriptions to select the correct field identifiers and values.`

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
	{
		"fieldId":     "label",
		"description": "Use this field to create a view filter rule to filter by Labels",
	},
	{
		"fieldId":     "label_v2",
		"description": "Use this field to create a view filter rule to filter by Labels",
	},
	{
		"fieldId":     "business_mapping",
		"description": "Use this field to create a view filter rule to filter by Labels", 
	},
}

var ListRecommendationsDescription = `
Lists recommendation items with metadata such as resource identifiers, potential savings, current vs. recommended size, severity/status, and recommendation type.
Supports rich filtering (for example by cloud account, Kubernetes attributes, resource type) so teams only fetch what’s relevant to them or their Perspective/RBAC scope in Harness Cloud Cost Management.
`

var ListRecommendationsByResourceTypeDescription = `
Retrieves aggregated statistics of cloud cost optimization recommendations grouped by resource type within a given account. This includes counts and potential savings information for each resource type, helping to understand which resource categories offer the most cost optimization opportunities. Ideal for monitoring and prioritizing cloud resource cost-saving actions.
`

var GetRecommendationsStatsDescription = `
Retrieves overall statistics for cloud cost optimization recommendations within a given account. The response provides aggregated metrics such as the total number of recommendations, total estimated cost savings, and the count of open and applied recommendations. This helps track the overall state and impact of cost optimization efforts across all resources.
`
