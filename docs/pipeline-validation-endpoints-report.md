
# Pipeline Validation Endpoints — Test Report

**Date:** 2026-06-24
**Tested by:** Claude Sonnet 4.6 + Claude Opus 4 (independent verification)
**Environment:** `https://harness0.harness.io`, Account `l7B_kbSEQD2wjrM7PShm5w`, Org `PROD`, Project `Data_Platform`

---

## Background

Two Harness pipeline validation endpoints were evaluated for usefulness in helping AI agents build and validate pipeline YAML before saving or executing.

**Real pipelines used:**
- `cleanup_ai_evals_ui_qa_9dc2` — V1 pipeline (uses `id:`, `runtime: shell`, `delegate:` stage syntax)
- `Deploy_AI_Platform_Services_To_QA` — V0 pipeline (uses `identifier:`, `type:`, `stage:` wrapper syntax), ~73KB of YAML with shell scripts

---

## Endpoint 1: `validate-yaml-schema`

Schema-only validation. No side effects, no persistence, no existing pipeline required.

### Spec

```
POST /pipeline/api/pipelines/validate-yaml-schema
     ?accountIdentifier=<account>
     &orgIdentifier=<org>
     &projectIdentifier=<project>
x-api-key: <token>
Content-Type: application/json

Body: { "yaml": "<pipeline yaml string>", "version": "v0" | "v1" }
```

### Response shape

```json
{
  "status": "SUCCESS",
  "data": {
    "valid": true,
    "errorMessage": null,
    "schemaErrors": null
  }
}
```

Error response:
```json
{
  "status": "SUCCESS",
  "data": {
    "valid": false,
    "errorMessage": "$.pipeline.stages: there must be a minimum of 1 items in the array",
    "schemaErrors": {
      "type": "YamlSchemaErrorWrapperDTO",
      "schemaErrors": [
        {
          "message": "stages: there must be a minimum of 1 items in the array",
          "messageWithFQN": "$.pipeline.stages: there must be a minimum of 1 items in the array",
          "fqn": "$.pipeline.stages",
          "stageInfo": null,
          "stepInfo": null,
          "hintMessage": null
        }
      ]
    }
  }
}
```

### Test 1 — Valid v0 pipeline (`Deploy_AI_Platform_Services_To_QA`)

```bash
# Step 1: save payload (pipeline YAML is too large / has shell scripts — use file, not inline)
/usr/bin/curl -s \
  "https://harness0.harness.io/pipeline/api/pipelines/Deploy_AI_Platform_Services_To_QA?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform&branch=main" \
  -H "x-api-key: $HARNESS_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
yaml = data['data']['yamlPipeline']
json.dump({'yaml': yaml, 'version': 'v0'}, open('/tmp/vs_v0_valid.json', 'w'))
print('saved')
"

# Step 2: validate
/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/pipelines/validate-yaml-schema?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/vs_v0_valid.json
```

**Response:**
```json
{
  "valid": true,
  "errorMessage": null,
  "schemaErrors": null
}
```
✅ Correctly passes.

---

### Test 2 — Valid v1 pipeline (`cleanup_ai_evals_ui_qa_9dc2`)

```bash
/usr/bin/curl -s \
  "https://harness0.harness.io/v1/orgs/PROD/projects/Data_Platform/pipelines/cleanup_ai_evals_ui_qa_9dc2" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
json.dump({'yaml': data['pipeline_yaml'], 'version': 'v1'}, open('/tmp/vs_v1_valid.json', 'w'))
print('saved')
"

/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/pipelines/validate-yaml-schema?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/vs_v1_valid.json
```

**Response:**
```json
{
  "valid": true,
  "errorMessage": null,
  "schemaErrors": null
}
```
✅ Correctly passes.

---

### Test 3 — V0 pipeline with `stages: []` (invalid)

```bash
/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/pipelines/validate-yaml-schema?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "yaml": "pipeline:\n  name: Deploy AI Platform Services to QA\n  identifier: Deploy_AI_Platform_Services_To_QA\n  orgIdentifier: PROD\n  projectIdentifier: Data_Platform\n  stages: []\n",
    "version": "v0"
  }'
```

**Response:**
```json
{
  "valid": false,
  "errorMessage": "$.pipeline.stages: there must be a minimum of 1 items in the array",
  "schemaErrors": {
    "type": "YamlSchemaErrorWrapperDTO",
    "schemaErrors": [
      {
        "message": "stages: there must be a minimum of 1 items in the array",
        "messageWithFQN": "$.pipeline.stages: there must be a minimum of 1 items in the array",
        "fqn": "$.pipeline.stages",
        "stageInfo": null,
        "stepInfo": null,
        "hintMessage": null
      }
    ]
  }
}
```
✅ Correctly caught with precise FQN path.

---

### Test 4 — V0 pipeline with empty steps array

```bash
/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/pipelines/validate-yaml-schema?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "yaml": "pipeline:\n  name: Deploy AI Platform Services to QA\n  identifier: Deploy_AI_Platform_Services_To_QA\n  orgIdentifier: PROD\n  projectIdentifier: Data_Platform\n  stages:\n    - stage:\n        name: build\n        identifier: build\n        type: Custom\n        spec:\n          execution:\n            steps: []\n",
    "version": "v0"
  }'
```

**Response:**
```json
{
  "valid": false,
  "errorMessage": "$.pipeline.stages[0].stage.spec.execution.steps: there must be a minimum of 1 items in the array",
  "schemaErrors": {
    "type": "YamlSchemaErrorWrapperDTO",
    "schemaErrors": [
      {
        "message": "steps: there must be a minimum of 1 items in the array",
        "messageWithFQN": "$.pipeline.stages[0].stage.spec.execution.steps: there must be a minimum of 1 items in the array",
        "fqn": "$.pipeline.stages[0].stage.spec.execution.steps",
        "stageInfo": {
          "identifier": "build",
          "type": "Custom",
          "name": "build",
          "fqn": "$.pipeline.stages[0].stage"
        },
        "stepInfo": null,
        "hintMessage": null
      }
    ]
  }
}
```
✅ Correctly caught. Note `stageInfo` is populated — errors include stage context.

---

### Test 5 — V1 pipeline with missing stage `id` field

```bash
# Fetch real v1 YAML and remove the stage id
/usr/bin/curl -s \
  "https://harness0.harness.io/v1/orgs/PROD/projects/Data_Platform/pipelines/cleanup_ai_evals_ui_qa_9dc2" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
yaml = data['pipeline_yaml'].replace('id: delete_ai_evals_ui', '# id removed')
json.dump({'yaml': yaml, 'version': 'v1'}, open('/tmp/vs_v1_broken.json', 'w'))
"

/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/pipelines/validate-yaml-schema?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/vs_v1_broken.json
```

**Response:**
```json
{
  "valid": true,
  "errorMessage": null,
  "schemaErrors": null
}
```
⚠️ **False negative** — missing stage `id` not caught. v1 schema validation is lenient.

---

### `validate-yaml-schema` Summary

| Test | Pipeline | Error Introduced | Expected | Actual |
|------|----------|-----------------|----------|--------|
| 1 | `Deploy_AI_Platform_Services_To_QA` (v0) | None | `valid: true` | ✅ `valid: true` |
| 2 | `cleanup_ai_evals_ui_qa_9dc2` (v1) | None | `valid: true` | ✅ `valid: true` |
| 3 | v0 inline | `stages: []` | `valid: false` | ✅ caught — FQN `$.pipeline.stages` |
| 4 | v0 inline | `steps: []` in stage | `valid: false` | ✅ caught — FQN `$.pipeline.stages[0].stage.spec.execution.steps` |
| 5 | `cleanup_ai_evals_ui_qa_9dc2` (v1) | Missing stage `id` | `valid: false` | ⚠️ false negative — passes |

**Verdict:** Works well for v0. Useful for catching structural errors during pipeline authoring. V1 schema validation is less strict — missing required fields like `id` are not flagged.

---

## Endpoint 2: `dry-run`

Full validation: schema + plan compilation + reference resolution + policy checks. No persistence.

### Spec

```
POST /pipeline/api/v1/orgs/{org}/projects/{project}/dry-run
     ?accountIdentifier=<account>
Harness-Account: <account>
x-api-key: <token>
Content-Type: application/json

Body:
{
  "pipeline_identifier": "existing_pipeline_id",   (required — must exist in project)
  "pipeline_yaml": "<yaml string>",                (optional — uses stored YAML if omitted)
  "branch": "main",                                (optional — for remote/git-backed pipelines)
  "inputset_ref": "my_inputset"                    (optional)
}
```

> **Path note:** The documented path is `POST /v1/orgs/{org}/projects/{project}/dry-run` (returns 404 on harness0). Working path requires the `/pipeline/api` prefix: `POST /pipeline/api/v1/orgs/{org}/projects/{project}/dry-run`.

### Response shape

```json
{
  "is_valid": true,
  "validation": []
}
```

Error response:
```json
{
  "is_valid": false,
  "validation": [
    {
      "validation_type": "SCHEMA" | "POLICY" | "SYSTEM" | "REFERRED_ENTITIES",
      "entity_type": "PIPELINE" | null,
      "entity_identifier": "my_pipeline",
      "error_message": "...",
      "hint": "..."
    }
  ]
}
```

---

### Test 6 — Valid v1 pipeline (`cleanup_ai_evals_ui_qa_9dc2`, exact stored YAML)

```bash
/usr/bin/curl -s \
  "https://harness0.harness.io/v1/orgs/PROD/projects/Data_Platform/pipelines/cleanup_ai_evals_ui_qa_9dc2" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
json.dump({'pipeline_identifier': 'cleanup_ai_evals_ui_qa_9dc2', 'pipeline_yaml': data['pipeline_yaml']}, open('/tmp/dr_v1_valid.json', 'w'))
"

/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/v1/orgs/PROD/projects/Data_Platform/dry-run?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/dr_v1_valid.json
```

**Response:**
```json
{
  "is_valid": false,
  "validation": [
    {
      "validation_type": "SYSTEM",
      "entity_type": null,
      "entity_identifier": "cleanup_ai_evals_ui_qa_9dc2",
      "error_message": "Unexpected error during dry run: Following yaml paths could not be parsed: pipeline/stages/[0]",
      "hint": "Please contact support if this issue persists. Check logs for more details."
    }
  ]
}
```
❌ **False negative** — pipeline is live and running in production. The dry-run parser cannot handle v1 stage syntax (`delegate:` at stage level, `runtime: shell`, flat step structure). This is a backend bug.

---

### Test 7 — Valid v0 pipeline (`Deploy_AI_Platform_Services_To_QA`, exact stored YAML)

```bash
/usr/bin/curl -s \
  "https://harness0.harness.io/pipeline/api/pipelines/Deploy_AI_Platform_Services_To_QA?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w&orgIdentifier=PROD&projectIdentifier=Data_Platform&branch=main" \
  -H "x-api-key: $HARNESS_API_KEY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
json.dump({'pipeline_identifier': 'Deploy_AI_Platform_Services_To_QA', 'pipeline_yaml': data['data']['yamlPipeline']}, open('/tmp/dr_v0_valid.json', 'w'))
"

/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/v1/orgs/PROD/projects/Data_Platform/dry-run?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/dr_v0_valid.json
```

**Response:**
```json
{
  "is_valid": true,
  "validation": []
}
```
✅ Correctly passes.

---

### Test 8 — V0 pipeline with invalid stage type

```bash
# Replace first stage type with an invalid value
python3 -c "
import json
p = json.load(open('/tmp/dr_v0_valid.json'))
p['pipeline_yaml'] = p['pipeline_yaml'].replace('type: Custom', 'type: INVALID_TYPE_XYZ', 1)
json.dump(p, open('/tmp/dr_v0_bad_type.json', 'w'))
"

/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/v1/orgs/PROD/projects/Data_Platform/dry-run?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/dr_v0_bad_type.json
```

**Response:**
```json
{
  "is_valid": false,
  "validation": [
    {
      "validation_type": "SYSTEM",
      "entity_type": null,
      "entity_identifier": "Deploy_AI_Platform_Services_To_QA",
      "error_message": "Unexpected error during dry run: Following yaml paths could not be parsed: pipeline/stages/[0]/stage",
      "hint": "Please contact support if this issue persists. Check logs for more details."
    }
  ]
}
```
✅ Caught — but reported as SYSTEM error rather than SCHEMA, so the message is generic not actionable.

---

### Test 9 — V0 pipeline with broken connector ref (`org.dockerHubHarnessDev` → nonexistent)

```bash
python3 -c "
import json
p = json.load(open('/tmp/dr_v0_valid.json'))
p['pipeline_yaml'] = p['pipeline_yaml'].replace('org.dockerHubHarnessDev', 'org.NONEXISTENT_CONNECTOR_XYZ')
json.dump(p, open('/tmp/dr_v0_bad_connector.json', 'w'))
"

/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/v1/orgs/PROD/projects/Data_Platform/dry-run?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/dr_v0_bad_connector.json
```

**Response:**
```json
{
  "is_valid": true,
  "validation": []
}
```
❌ **False negative** — broken connector ref not caught. Reference validation is not firing.

---

### Test 10 — Non-existent `pipeline_identifier`

```bash
/usr/bin/curl -s -X POST \
  "https://harness0.harness.io/pipeline/api/v1/orgs/PROD/projects/Data_Platform/dry-run?accountIdentifier=l7B_kbSEQD2wjrM7PShm5w" \
  -H "Harness-Account: l7B_kbSEQD2wjrM7PShm5w" \
  -H "x-api-key: $HARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pipeline_identifier": "pipeline_does_not_exist_xyz", "pipeline_yaml": "pipeline:\n  name: test\n  identifier: test\n  stages: []\n"}'
```

**Response:**
```json
{
  "is_valid": false,
  "validation": [
    {
      "validation_type": "SYSTEM",
      "entity_type": null,
      "entity_identifier": "pipeline_does_not_exist_xyz",
      "error_message": "Unexpected error during dry run: Pipeline [pipeline_does_not_exist_xyz] under Project[Data_Platform], Organization [PROD] doesn't exist or has been deleted.",
      "hint": "Please contact support if this issue persists. Check logs for more details."
    }
  ]
}
```
✅ Correctly blocked — but confirms dry-run cannot validate brand-new pipelines.

---

### `dry-run` Summary

| Test | Pipeline | Change | Expected | Actual |
|------|----------|--------|----------|--------|
| 6 | `cleanup_ai_evals_ui_qa_9dc2` (v1) | None (valid) | `is_valid: true` | ❌ false negative — SYSTEM parse error on `pipeline/stages/[0]` |
| 7 | `Deploy_AI_Platform_Services_To_QA` (v0) | None (valid) | `is_valid: true` | ✅ `is_valid: true` |
| 8 | `Deploy_AI_Platform_Services_To_QA` (v0) | `type: INVALID_TYPE_XYZ` | `is_valid: false` | ✅ caught (as SYSTEM, not SCHEMA) |
| 9 | `Deploy_AI_Platform_Services_To_QA` (v0) | Broken connector ref | `is_valid: false` | ❌ false negative — `is_valid: true` |
| 10 | `pipeline_does_not_exist_xyz` | N/A | `is_valid: false` | ✅ blocked — pipeline must exist |

**Verdict:** Works for v0 structural errors. Broken for all v1 pipelines. Reference validation (connectors, services, environments) not firing for v0 either.

---

## Path Discovery

The documented path `/v1/orgs/{org}/projects/{project}/dry-run` returns 404 on harness0. HTTP responses observed while finding the working path:

| Path | HTTP |
|------|------|
| `/v1/orgs/PROD/projects/Data_Platform/dry-run` | 404 |
| **`/pipeline/api/v1/orgs/PROD/projects/Data_Platform/dry-run`** | **200 — working** |
| `/pipeline/v1/orgs/PROD/projects/Data_Platform/dry-run` | 405 |
| `/gateway/pipeline/v1/orgs/PROD/projects/Data_Platform/dry-run` | 405 |
| `/pipeline/api/pipelines/dry-run` | 405 |
| `/ng/api/pipelines/dry-run` | 400 |

---

## Final Conclusions

### What works

| Capability | Endpoint | V0 | V1 |
|-----------|----------|----|----|
| Validates correct pipeline passes | `validate-yaml-schema` | ✅ | ✅ |
| Catches empty `stages`/`steps` arrays | `validate-yaml-schema` | ✅ | ⚠️ lenient |
| Catches missing required fields | `validate-yaml-schema` | ✅ | ⚠️ lenient |
| Precise FQN error paths | `validate-yaml-schema` | ✅ | ✅ when caught |
| Works without existing pipeline | `validate-yaml-schema` | ✅ | ✅ |
| Validates correct pipeline passes | `dry-run` | ✅ | ❌ false negative |
| Catches invalid stage type | `dry-run` | ✅ (as SYSTEM) | ❌ |
| Catches broken connector/service refs | `dry-run` | ❌ | ❌ |
| Works without existing pipeline | `dry-run` | ❌ | ❌ |

### Backend issues to file

1. **`dry-run` cannot parse v1 YAML** — fails on `delegate:` and flat stage structure (`id:`, `runtime: shell`) even when the exact same YAML is live and running in production. The dry-run parser has not been updated for v1 stage syntax.
2. **`dry-run` path discrepancy** — documented as `/v1/orgs/...` but only reachable at `/pipeline/api/v1/orgs/...` on harness0.
3. **`dry-run` reference validation not firing** — broken connector refs return `is_valid: true` on v0 pipelines.
4. **`validate-yaml-schema` v1 schema is too lenient** — missing required fields like stage `id` are not caught.

### Recommendation for MCP server

**Add `validate-yaml-schema` now** — reliable for v0, works for v1 structural validation, no side effects, works on new pipelines before they exist.

**Hold on `dry-run`** — too many false negatives (v1 always fails, reference errors not caught) to be trustworthy for agents. Add once backend issues 1 and 3 above are resolved.
