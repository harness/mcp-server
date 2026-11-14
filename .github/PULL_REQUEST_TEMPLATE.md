## Description
<!-- What does this PR do? -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Documentation
- [ ] Other

## Checklist
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] `pnpm standards:check` passes (architecture guardrails — see [docs/coding-standards.md](docs/coding-standards.md))
- [ ] `pnpm docs:check` passes (if registry/tool counts changed)
- [ ] Agent context cost and discovery (`docs/coding-standards.md` §15): small default `list` items, bulky fields projected out, a way for agents to find the right item
- [ ] Auth/credential changes follow §16 (closed-by-default allowlists, pinned endpoints, no token contents in logs)
- [ ] New code paths checked against §17 (scope on every call, units, falsy values, risk gating, request/response-shape tests, public surface in sync)

## Coding Standards (registry-driven MCP model)
If this PR adds or changes Harness API coverage:
- [ ] No new `server.registerTool()` calls — only toolset definitions in `src/registry/toolsets/`
- [ ] Cohesive resource taxonomy (`docs/coding-standards.md` §13): no 1-endpoint-per-`resource_type` sprawl (`*_detail` folded into `operations.get` via `EndpointSpec.scope`, RPCs/stats under `executeActions`, no `_v1`/`_v2`/`_v3` suffixes unless a same-name v0/v1 resource coexists)
- [ ] Toolset registered in `ALL_TOOLSETS`, `ToolsetName` union, and `README.md` Toolset Filtering table
- [ ] `operationPolicy` on every new/changed endpoint
- [ ] Shared response extractors imported from `src/registry/extractors.ts` (no inline or toolset-local extractor functions)
- [ ] `compactItem` (or `skipCompact`) defined on new `list` resources when items carry domain-specific fields outside the default compaction whitelist
- [ ] `identifierFields` and `scope` declared on new resources
- [ ] No `console.log()` in `src/` (stdio JSON-RPC safety)
