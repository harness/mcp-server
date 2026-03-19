# Module: REGISTRY

## ARTIFACT REGISTRY — Test Report

**Date:** 2026-03-19
**Account:** px7xd_BFRCi-pfWPYXVjvw | **Org:** AI_Devops | **Project:** Sanity

---

### Tool Parity

| Check | v1 | v2 | Match |
| ----- | -- | -- | ----- |
| List registries | `list_registries` | `harness_list` (`registry`) | ✅ |
| Get registry | `get_registry` | `harness_get` (`registry`) | ✅ |
| List artifacts | `list_artifacts` | `harness_list` (`artifact`) | ✅ |
| List artifact versions | `list_artifact_versions` | `harness_list` (`artifact_version`) | ✅ |
| List artifact files | `list_artifact_files` | `harness_list` (`artifact_file`) | ✅ |

> v1 tools exist in source but are not exposed — `registries` toolset missing from `--toolsets` in `mcp.json` and may require HAR license.

### Summary

| Metric | Count |
| ------ | ----- |
| Total  | 6     |
| ✅ Pass | 4     |
| ⏭️ Skip | 2     |

### Test Results

| ID | Test | v1 | v2 | Notes |
| -- | ---- | -- | -- | ----- |
| REG-001 | List registries | ⏭️ | ✅ 2 registries, per-item deep links resolve | |
| REG-002 | Pagination (size=5) | ⏭️ | ✅ pageSize=5 honoured | |
| REG-003 | Get `test232213` | ⏭️ | ✅ Full details, deep link → `/registries/test232213` | |
| REG-004 | List artifacts | ⏭️ | ✅ Empty list (no artifacts in registry) | |
| REG-005 | List artifact versions | ⏭️ | ⏭️ No test data | |
| REG-006 | List artifact files | ⏭️ | ⏭️ No test data | |

### Issues

| # | ID | Severity | Description | Status |
| - | -- | -------- | ----------- | ------ |
| 1 | REG-001 | Low | List deep links had unresolved `{registryIdentifier}` placeholder. Fixed via `harListExtract` extractor. | ✅ Fixed |
| 2 | ALL | Info | v1 tools not exposed — `registries` missing from `--toolsets`, HAR license may be inactive. | ℹ️ Info |

---

### Raw Responses

<details>
<summary>REG-001 — harness_list registry</summary>

```json
{
  "items": [
    {
      "description": "",
      "identifier": "test232213",
      "type": "VIRTUAL",
      "openInHarness": "https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/registries/test232213"
    },
    {
      "description": "",
      "identifier": "test-mcp",
      "type": "VIRTUAL",
      "openInHarness": "https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/registries/test-mcp"
    }
  ],
  "total": 2,
  "pageIndex": 0,
  "pageSize": 20,
  "pageCount": 1
}
```
</details>

<details>
<summary>REG-002 — harness_list registry (size=5)</summary>

```json
{
  "items": [
    {
      "description": "",
      "identifier": "test232213",
      "type": "VIRTUAL",
      "openInHarness": "https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/registries/test232213"
    },
    {
      "description": "",
      "identifier": "test-mcp",
      "type": "VIRTUAL",
      "openInHarness": "https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/registries/test-mcp"
    }
  ],
  "total": 2,
  "pageIndex": 0,
  "pageSize": 5,
  "pageCount": 1
}
```
</details>

<details>
<summary>REG-003 — harness_get registry test232213</summary>

```json
{
  "data": {
    "allowedPattern": null,
    "blockedPattern": null,
    "cleanupPolicy": [],
    "config": { "type": "VIRTUAL", "upstreamProxies": [] },
    "createdAt": "1756467212605",
    "description": "",
    "identifier": "test232213",
    "isPublic": false,
    "labels": null,
    "modifiedAt": "1756467212605",
    "packageType": "DOCKER",
    "policyRefs": null,
    "url": "https://pkg.qa.harness.io/px7xd_bfrci-pfwpyxvjvw/test232213",
    "uuid": "189b870d-7526-4379-8e3f-fcdb15c37521"
  },
  "status": "SUCCESS",
  "openInHarness": "https://qa.harness.io/ng/account/px7xd_BFRCi-pfWPYXVjvw/all/orgs/AI_Devops/projects/Sanity/registries/test232213"
}
```
</details>

<details>
<summary>REG-004 — harness_list artifact</summary>

```json
{
  "items": [],
  "total": 0,
  "pageIndex": 0,
  "pageSize": 20,
  "pageCount": 0
}
```
</details>

<details>
<summary>REG-005 — harness_list artifact_version</summary>

```json
{ "error": "Failed to get image: resource not found" }
```
</details>

<details>
<summary>REG-006 — harness_list artifact_file</summary>

```json
{ "error": "Artifact not found" }
```
</details>
