/**
 * Verifies openInHarness deep links for batch-2 chaos resources:
 * probes, faults, actions and their hub-scoped templates. Confirms the
 * correct UI URL shape (/module/chaos/.../settings/chaos/...) and that
 * per-item links use the right identifier (probeId / identity / hubRef)
 * rather than falling back to the display name.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const BASE = "https://app.harness.io/ng/account/test-account/module/chaos/orgs/templatescopetest/projects/templatescopetest";
const SCOPE = { org_id: "templatescopetest", project_id: "templatescopetest" };

describe("chaos batch-2 deep links", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("chaos_probe get: link uses probeId", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ probeId: "frontend-boutique-health-probe", identity: "frontend-boutique-health-probe", name: "Frontend Health" }));
    const result = (await registry.dispatch(client, "chaos_probe", "get", { probe_id: "frontend-boutique-health-probe", ...SCOPE })) as Record<string, unknown>;
    expect(result.openInHarness).toBe(`${BASE}/settings/chaos/probes/frontend-boutique-health-probe`);
  });

  it("chaos_probe list: per-item link uses probeId (not name)", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ probeId: "p1", identity: "p1", name: "Probe One" }], totalNoOfProbes: 1 }));
    const result = (await registry.dispatch(client, "chaos_probe", "list", { ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/probes/p1`);
  });

  it("chaos_fault list: per-item link uses identity (not name)", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ identity: "alb-az-down", name: "ALB AZ Down" }], pagination: { totalItems: 1 } }));
    const result = (await registry.dispatch(client, "chaos_fault", "list", { ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/faults/alb-az-down`);
  });

  it("chaos_action list: per-item link uses identity (not name)", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ identity: "linux-delay-action-89-x-ztd", name: "Linux Delay" }], pagination: { totalItems: 1 } }));
    const result = (await registry.dispatch(client, "chaos_action", "list", { ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/actions/linux-delay-action-89-x-ztd`);
  });

  it("chaos_fault_experiment_run list: per-item link uses the parent fault_id with execution-history tab", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ experimentRunID: "r1", experimentName: "exp", experimentID: "e1" }], pagination: { totalItems: 1 } }));
    const result = (await registry.dispatch(client, "chaos_fault_experiment_run", "list", { fault_id: "alb-az-down", ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/faults/alb-az-down?tab=execution-history`);
  });

  it("chaos_probe_template list: per-item link points to its hub PROBES tab", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ identity: "t1", hubRef: "chaoshub189x", name: "T1" }], pagination: { totalItems: 1 } }));
    const result = (await registry.dispatch(client, "chaos_probe_template", "list", { ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/hubs/chaoshub189x?tab=PROBES`);
  });

  it("chaos_fault_template list: per-item link points to its hub FAULTS tab", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ identity: "t2", hubRef: "custom-hub-templatescopetest" }], pagination: { totalItems: 1 } }));
    const result = (await registry.dispatch(client, "chaos_fault_template", "list", { ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/hubs/custom-hub-templatescopetest?tab=FAULTS`);
  });

  it("chaos_action_template list: per-item link points to its hub ACTIONS tab", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ data: [{ identity: "t3", hubRef: "localhub87x" }], pagination: { totalItems: 1 } }));
    const result = (await registry.dispatch(client, "chaos_action_template", "list", { ...SCOPE })) as { items: Array<Record<string, unknown>> };
    expect(result.items[0].openInHarness).toBe(`${BASE}/settings/chaos/hubs/localhub87x?tab=ACTIONS`);
  });
});
