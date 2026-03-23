# Test Plan: Project Health Dashboard (`visual_health_dashboard`)

| Field | Value |
|-------|-------|
| **Resource Type** | `visual_health_dashboard` |
| **Display Name** | Project Health Dashboard |
| **Toolset** | visualizations |
| **Scope** | project |
| **Operations** | _(none — virtual resource type)_ |
| **Execute Actions** | None |
| **Identifier Fields** | _(none)_ |
| **Filter Fields** | _(none)_ |
| **Deep Link** | No |

## Test Cases

| Test ID | Category | Description | Prompt | Expected Result |
|---------|----------|-------------|--------|-----------------|
| TC-vhd-001 | Render | Health dashboard default | `harness_status(include_visual=true)` | Returns JSON health data and inline PNG dashboard image |
| TC-vhd-002 | Render | With org_id and project_id | `harness_status(include_visual=true, org_id="<org>", project_id="<project>")` | Returns scoped health dashboard |
| TC-vhd-003 | Render | Health badge check | `harness_status(include_visual=true)` | Dashboard shows health badge (healthy/degraded/failing) |
| TC-vhd-004 | Render | Metric cards | `harness_status(include_visual=true)` | Dashboard shows metric cards (failed, running, recent counts) |
| TC-vhd-005 | Render | Recent execution status bar | `harness_status(include_visual=true)` | Dashboard includes recent execution status bar |
| TC-vhd-006 | Render | Healthy project | `harness_status(include_visual=true)` on healthy project | Shows green/healthy badge |
| TC-vhd-007 | Render | Degraded project | `harness_status(include_visual=true)` on project with failures | Shows degraded/failing badge |
| TC-vhd-008 | Error | Invalid org/project | `harness_status(include_visual=true, org_id="nonexistent", project_id="nonexistent")` | Returns meaningful error |
| TC-vhd-009 | Edge | Empty project | `harness_status(include_visual=true)` on empty project | Returns dashboard with zero counts |
| TC-vhd-010 | Describe | Resource metadata | `harness_describe(resource_type="visual_health_dashboard")` | Returns metadata with diagnosticHint explaining usage |

## Notes
- Virtual resource type — no direct API operations; rendered locally from project status data
- Invoked via `harness_status` with `include_visual: true`
- Optionally scoped with `org_id` and `project_id`
- Shows project health overview: health badge, metric cards, recent execution status bar
- Response includes both JSON health data and an inline PNG image
