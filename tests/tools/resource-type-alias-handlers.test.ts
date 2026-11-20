import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registerAllTools } from "../../src/tools/index.js";
import { canonicalizeResourceTypes } from "../../src/utils/canonical-resource-type.js";

const config = {
  HARNESS_API_KEY: "pat.test.abc.xyz",
  HARNESS_ACCOUNT_ID: "test-account",
  HARNESS_BASE_URL: "https://app.harness.io",
  HARNESS_ORG: "default",
  HARNESS_PROJECT: "test-project",
  HARNESS_API_TIMEOUT_MS: 30000,
  HARNESS_MAX_RETRIES: 3,
  LOG_LEVEL: "info",
} as Config;

function setup() {
  const handlers = new Map<string, (args: unknown, extra: unknown) => Promise<unknown>>();
  const server = {
    server: { getClientCapabilities: () => ({}) },
    registerTool: (name: string, _def: unknown, cb: (args: unknown, extra: unknown) => Promise<unknown>) => {
      handlers.set(name, cb);
    },
  };
  const registry = new Registry(config);
  const dispatch = vi.spyOn(registry, "dispatch").mockResolvedValue({ items: [], total: 0 } as never);
  const dispatchExecute = vi.spyOn(registry, "dispatchExecute").mockResolvedValue({ ok: true } as never);
  const client = { request: vi.fn().mockResolvedValue({}), account: "test-account" } as unknown as HarnessClient;
  registerAllTools(server as never, registry, client, config);
  const call = (name: string, args: Record<string, unknown>) =>
    handlers.get(name)!(args, { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} });
  return { call, dispatch, dispatchExecute, registry };
}

describe("resource_type aliases reach handlers in canonical form", () => {
  it("harness_list dispatches the canonical type", async () => {
    const { call, dispatch } = setup();
    await call("harness_list", { resource_type: "Repos" });
    expect(dispatch.mock.calls[0]![1]).toBe("repository");
  });

  it("harness_execute applies the pipeline interrupt remap and pipeline-run handling for aliases", async () => {
    const { call, dispatchExecute } = setup();
    await call("harness_execute", { resource_type: "pipelines", action: "interrupt", resource_id: "e1", confirm: true });
    expect(dispatchExecute.mock.calls[0]![1]).toBe("execution");
  });

  it("harness_execute passes the canonical type for a plain alias", async () => {
    const { call, dispatchExecute } = setup();
    await call("harness_execute", { resource_type: "Pipeline", action: "retry", resource_id: "p1", confirm: true });
    expect(dispatchExecute.mock.calls[0]![1]).toBe("pipeline");
  });

  it("harness_search canonicalizes resource_types", async () => {
    const { call, dispatch } = setup();
    await call("harness_search", { query: "x", resource_types: ["pipelines", "repo"] });
    const types = dispatch.mock.calls.map((c) => c[1]);
    expect(types).toEqual(expect.arrayContaining(["pipeline", "repository"]));
    expect(types).not.toContain("pipelines");
  });

  it("registry helpers resolve aliases", () => {
    const { registry } = setup();
    expect(registry.supportsOperation("pipelines", "list")).toBe(true);
    expect(registry.getExecuteActions("pipelines")).toBe(registry.getExecuteActions("pipeline"));
  });

  it("leaves unknown types unchanged so the handler reports them", () => {
    const { registry } = setup();
    expect(canonicalizeResourceTypes(registry, { resource_type: "banana" }).resource_type).toBe("banana");
  });
});
