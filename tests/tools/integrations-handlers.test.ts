import { describe, it, expect, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { registerAllTools } from "../../src/tools/index.js";

// End-to-end through the real tool handlers (not registry.dispatch): resource_id mapping, confirm
// gating and response shaping for the opt-in integrations toolset. Only the HTTP client is mocked.
const config = {
  HARNESS_API_KEY: "pat.test-account.tok.secret",
  HARNESS_ACCOUNT_ID: "test-account",
  HARNESS_BASE_URL: "https://app.harness.io",
  HARNESS_ORG: "default",
  HARNESS_PROJECT: "test-project",
  HARNESS_API_TIMEOUT_MS: 30000,
  HARNESS_MAX_RETRIES: 3,
  LOG_LEVEL: "info",
  HARNESS_READ_ONLY: false,
  HARNESS_AUTO_APPROVE_RISK: "none",
  HARNESS_TOOLSETS: "integrations",
} as Config;

const BASE = "/connector-control-plane/v1/integrations";
type Req = { method: string; path: string; body?: unknown };

function setup(respond: (req: Req) => unknown) {
  const handlers = new Map<string, (args: unknown, extra: unknown) => Promise<unknown>>();
  const server = {
    server: { getClientCapabilities: () => ({}) },
    registerTool: (name: string, _def: unknown, cb: (args: unknown, extra: unknown) => Promise<unknown>) => {
      handlers.set(name, cb);
    },
  };
  const request = vi.fn(async (req: Req & { onResponseHeaders?: (h: Record<string, string>) => void }) => {
    req.onResponseHeaders?.({});
    return respond(req);
  });
  const client = { request, account: "test-account" } as unknown as HarnessClient;
  registerAllTools(server as never, new Registry(config), client, config);
  const call = async (name: string, args: Record<string, unknown>) => {
    const r = (await handlers.get(name)!(args, { signal: new AbortController().signal, sendNotification: vi.fn(), _meta: {} })) as {
      isError?: boolean; content: { text?: string }[];
    };
    const text = r.content.map((c) => c.text ?? "").join("");
    return { isError: r.isError === true, text };
  };
  const reqs = () => request.mock.calls.map((c) => c[0] as Req);
  return { call, reqs };
}

const job = {
  id: "x", identifier: "nightly", name: "Nightly", default: false, enabled: false,
  action: { uses: "githubIngest", with: {} }, trigger: { uses: "schedule", with: { frequency: "1d" } },
  streams: [], health: { state: "healthy" },
};

describe("integrations through the tool handlers", () => {
  it("harness_list returns compact integration items", async () => {
    const { call, reqs } = setup(() => [{
      identifier: "gh", name: "GH", connector: { uses: "github", with: { url: "u" } },
      auth: { uses: "token", with: { token: "account.t" } }, runner: { type: "self_hosted", selectors: ["a"] }, version: 1,
    }]);
    const r = await call("harness_list", { resource_type: "integration", resource_scope: "account" });
    expect(r.isError).toBe(false);
    expect(reqs()[0]!.path).toBe(BASE);
    expect(r.text).toContain('"connector":"github"');
    expect(r.text).not.toContain("account.t");
  });

  it("harness_get maps resource_id to job_id", async () => {
    const { call, reqs } = setup(() => job);
    const r = await call("harness_get", { resource_type: "integration_job", resource_scope: "account", params: { integration_id: "gh" }, resource_id: "nightly" });
    expect(r.isError).toBe(false);
    expect(reqs()[0]!.path).toBe(`${BASE}/gh/jobs/nightly`);
  });

  it("harness_update (job) reads then writes, keeps enabled:false and returns the reset hint", async () => {
    const { call, reqs } = setup((req) => (req.method === "GET" ? job : { ...job, name: "Renamed" }));
    const r = await call("harness_update", {
      resource_type: "integration_job", resource_scope: "account", params: { integration_id: "gh" },
      resource_id: "nightly", body: { name: "Renamed" }, confirm: true,
    });
    expect(r.isError).toBe(false);
    const [get, put] = reqs();
    expect(get!.method).toBe("GET");
    expect(put!.method).toBe("PUT");
    expect(put!.path).toBe(`${BASE}/gh/jobs/nightly`);
    expect(put!.body).toMatchObject({ identifier: "nightly", name: "Renamed", enabled: false });
    expect(put!.body).not.toHaveProperty("health");
    expect(r.text).toContain("syncModes and reconcile");
  });

  it("harness_update without confirm is blocked when the client cannot prompt, and sends nothing", async () => {
    const { call, reqs } = setup(() => job);
    const r = await call("harness_update", {
      resource_type: "integration_job", resource_scope: "account", params: { integration_id: "gh" },
      resource_id: "nightly", body: { name: "x" },
    });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/confirm: true/);
    expect(reqs()).toHaveLength(0);
  });

  it("harness_delete maps resource_id to job_id", async () => {
    const { call, reqs } = setup(() => undefined);
    const r = await call("harness_delete", {
      resource_type: "integration_job", resource_scope: "account", params: { integration_id: "gh" }, resource_id: "nightly", confirm: true,
    });
    expect(r.isError).toBe(false);
    expect(reqs()[0]!.method).toBe("DELETE");
    expect(reqs()[0]!.path).toBe(`${BASE}/gh/jobs/nightly`);
  });

  it("harness_execute list_options maps resource_id to the integration and needs no confirm (read)", async () => {
    const { call, reqs } = setup(() => ({ options: [{ value: "harness", label: "harness" }], truncated: false, cached: false, age: "PT0S" }));
    const r = await call("harness_execute", {
      resource_type: "integration", action: "list_options", resource_scope: "account", resource_id: "gh",
      body: { source: { action: "githubListOrgs", items: "organizations", value: "login", label: "login" } },
    });
    expect(r.isError).toBe(false);
    expect(reqs()[0]!.path).toBe("/connector-control-plane/v1/options");
    expect(reqs()[0]!.body).toMatchObject({ source: { integration: "gh", action: "githubListOrgs" } });
    expect(r.text).toContain('"value":"harness"');
  });
});
