# React CI/CD for Harness

Harness pipeline generated from [react/react](https://github.com/react/react) (cloned at commit on disk under `/tmp/react-clone/react`).

## What was detected

| Signal | Value |
|--------|-------|
| Package manager | Yarn 1.22.22 (`packageManager` + workspaces) |
| Node | `v20.19.0` (`.nvmrc`) |
| Lint | `yarn prettier-check`, `node ./scripts/tasks/eslint`, `./scripts/ci/check_license.sh` |
| Test | `yarn test` via custom Jest CLI (`scripts/jest/jest-cli.js`) |
| Build | `yarn build --r=<channel> --ci` (Rollup release channels) |
| Upstream CI | `.github/workflows/runtime_build_and_test.yml`, `shared_lint.yml` |
| Deploy target | None (library) — CD stage is optional npm publish behind approval |

## Files

- `react_ci_pipeline.yaml` — Harness **v0** CI pipeline (Lint → Test → Build → Validate → Approve → Publish)
- `react_ci_trigger.yaml` — GitHub push + PR webhook trigger stubs

## Before you import

Replace every `<+input>` with your values:

1. `orgIdentifier` / `projectIdentifier`
2. Codebase `connectorRef` (GitHub connector that can clone `react/react`)
3. Approval `userGroups`
4. Trigger `connectorRef`

Create a Harness text secret named `NPM_TOKEN` if you enable the Publish stage.

## Import options

**Pipeline Studio (YAML)**  
Continuous Integration → Pipelines → Create Pipeline → YAML → paste `react_ci_pipeline.yaml`.

**MCP** (when authenticated):

```text
harness_create
  resource_type: pipeline
  org_id: <org>
  project_id: <project>
  body: { yamlPipeline: "<contents of react_ci_pipeline.yaml>" }
```

## Notes vs upstream GitHub Actions

Upstream shards builds across 25 workers × 2 channels and runs a much larger Jest matrix (www-classic/modern, Flow host configs, etc.). This Harness pipeline covers the **core** path:

- Shared lint jobs
- Stable + experimental Jest envs
- Full `yarn build` per release channel (not worker-sharded)
- Flags + inline Fizz runtime checks
- Optional publish gate on `main` / `releases/*`

Harness Cloud supplies a current Node toolchain; pin to 20.19.x in the install step if your cloud image differs.
