# Test Plan: Cost Recommendation Detail (`cost_recommendation_detail`)

| Field | Value |
|-------|-------|
| **Resource Type** | `cost_recommendation_detail` |
| **Display Name** | Cost Recommendation Detail |
| **Toolset** | ccm |
| **Scope** | account |
| **Operations** | get |
| **Execute Actions** | None |
| **Identifier Fields** | type_path |
| **Filter Fields** | None |
| **Deep Link** | Yes |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-crd-001 | Get | Get EC2 instance recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="ec2-instance")` | Returns detailed EC2 instance recommendations |
| TC-crd-002 | Get | Get Azure VM recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="azure-vm")` | Returns detailed Azure VM recommendations |
| TC-crd-003 | Get | Get ECS service recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="ecs-service")` | Returns detailed ECS service recommendations |
| TC-crd-004 | Get | Get node pool recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="node-pool")` | Returns detailed node pool recommendations |
| TC-crd-005 | Get | Get workload recommendations | `harness_get(resource_type="cost_recommendation_detail", type_path="workload")` | Returns detailed workload recommendations |
| TC-crd-006 | Get | Get with invalid type_path | `harness_get(resource_type="cost_recommendation_detail", type_path="invalid-type")` | Returns error or 404 |
| TC-crd-007 | Get | Get missing type_path | `harness_get(resource_type="cost_recommendation_detail")` | Returns validation error for missing type_path |
| TC-crd-008 | Deep Link | Verify deep link in response | `harness_get(resource_type="cost_recommendation_detail", type_path="ec2-instance")` | Response includes deep link to `/ng/account/{accountId}/ce/recommendations` |
| TC-crd-009 | Edge | Detail when no recommendations for type | `harness_get(resource_type="cost_recommendation_detail", type_path="azure-vm")` | Returns empty detail or appropriate message |
| TC-crd-010 | Error | Attempt list operation (not supported) | `harness_list(resource_type="cost_recommendation_detail")` | Returns error indicating list is not supported |

## Notes
- REST endpoint: GET `/ccm/api/recommendation/details/{typePath}`
- `type_path` maps to `typePath` path parameter
- Valid type_path values: ec2-instance, azure-vm, ecs-service, node-pool, workload
- Deep link: `/ng/account/{accountId}/ce/recommendations`
- Returns detailed recommendation data specific to the resource type
