# Module: REGISTRY

## ARTIFACT REGISTRY

**Scope:** Project
**v1:** 🔵 list_registries, get_registry, list_artifacts, list_artifact_versions, list_artifact_files | **v2:** harness_list, harness_get

---

### Pagination

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-001 | List registries | 🔵 | 🟢 |
| REG-002 | Page 1, size 5 | 🔵 | 🟢 |

```
# REG-001
v1: "List all registries in AI_Devops/Sanity"
v2: "List all registries in AI_Devops/Sanity"

# REG-002
v1: "List first 5 registries in AI_Devops/Sanity"
v2: "List first 5 registries in AI_Devops/Sanity"
```

### Get

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-003 | Get by ID | 🔵 | 🟢 |

```
# REG-003
v1: "Get registry details for test232213 in AI_Devops/Sanity"
v2: "Get registry details for registry_id test232213"
```

### Artifacts

| Test ID | Test | v1 | v2 |
|---------|------|----|----|
| REG-004 | List artifacts in a registry | 🔵 | 🟢 |
| REG-005 | List artifact versions | 🔵 | 🟢 |
| REG-006 | List artifact files | 🔵 | 🟢 |

```
# REG-004
v1: "List artifacts in registry test232213 in AI_Devops/Sanity"
v2: "List artifacts in registry test232213 in AI_Devops/Sanity"

# REG-005
v1: "List versions of artifact <artifact_name> in registry test232213 in AI_Devops/Sanity"
v2: "List versions of artifact <artifact_name> in registry test232213 in AI_Devops/Sanity"

# REG-006
v1: "List files of artifact <artifact_name> version <version> in registry test232213 in AI_Devops/Sanity"
v2: "List files of artifact <artifact_name> version <version> in registry test232213 in AI_Devops/Sanity"
```
