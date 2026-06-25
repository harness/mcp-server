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
- [ ] `pnpm standards:check` passes (architecture guardrails — see [docs/coding-standards.md](../docs/coding-standards.md))
- [ ] `pnpm docs:check` passes (if registry/tool counts changed)

## Coding Standards (registry-driven MCP model)
If this PR adds or changes Harness API coverage:
- [ ] No new `server.registerTool()` calls — only toolset definitions in `src/registry/toolsets/`
- [ ] Toolset registered in `ALL_TOOLSETS` and `ToolsetName` union
- [ ] `operationPolicy` on every new/changed endpoint
- [ ] Shared response extractors from `src/registry/extractors.ts` (no raw passthrough on real endpoints)
- [ ] `identifierFields` and `scope` declared on new resources
- [ ] No `console.log()` in `src/` (stdio JSON-RPC safety)
