# Lessons Learned

## MCP SDK v1.27+ Type Compatibility
- **Issue**: `server.tool()` callback return type requires `[key: string]: unknown` index signature on the result object.
- **Fix**: Add `[key: string]: unknown` to the ToolResult interface.
- **Rule**: Always check MCP SDK type expectations for return types before defining custom interfaces.

## MCP SDK Prompt API
- **Issue**: `server.prompt()` does NOT accept an array of `{ name, description, required }` for args. It uses a Zod schema object.
- **Fix**: Use `{ paramName: z.string().describe("...").optional() }` format for prompt argument schemas.
- **Rule**: Check the actual SDK `.d.ts` types, not just documentation examples that may be outdated.

## Harness Artifact Registry (HAR) BuildAndPush Step
- **Issue**: HAR uses a different spec shape than third-party Docker registries in `BuildAndPushDockerRegistry` steps. Initially assumed HAR just swaps `connectorRef` to `account.harnessImage` — wrong.
- **Correct HAR spec**: Uses `registryRef` (NOT `connectorRef`). There is NO `connectorRef` at all. `repo` and `registryRef` are both typically `<+input>`.
- **Correct third-party spec**: Uses `connectorRef` (NOT `registryRef`). There is NO `registryRef`.
- **Rule**: HAR and third-party Docker registries are the same step type (`BuildAndPushDockerRegistry`) but mutually exclusive field sets: `registryRef` for HAR, `connectorRef` for third-party. Never mix them.

## LLM Prompt Reliability: Use Exact YAML Templates, Not Prose
- **Issue**: Prose instructions like "use registryRef instead of connectorRef" are unreliable — LLMs still mix up fields ~50% of the time.
- **Fix**: Embed exact copy-paste YAML templates (labeled TEMPLATE A / TEMPLATE B) directly in prompts. LLMs reliably copy from concrete examples.
- **Rule**: When a prompt needs the LLM to generate YAML with variant configurations, always provide the complete YAML snippet for each variant. Prose descriptions of field differences are insufficient.

## Chaos API Requires /gateway Prefix
- **Issue**: Chaos toolset returned HTTP 404 for all requests (experiments, probes, infrastructures) across projects.
- **Root cause**: Harness Chaos Engineering API is routed through the gateway. Paths like `/chaos/manager/api/experiments` resolve to `https://app.harness.io/chaos/...` but the correct base is `https://app.harness.io/gateway/chaos/manager/api/...`.
- **Fix**: Use `/gateway/chaos/manager/api` as the chaos API base path (see apidocs.harness.io/chaos.html).
- **Rule**: When adding new Harness module toolsets, verify the API base path. Modules such as chaos, SEI, and log-service use `/gateway/` prefix; ng, pipeline, code, cf, etc. do not.
