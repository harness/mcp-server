/**
 * Request-shape coverage for chaos_service create/update body builders and the
 * discovered_agent list — the pieces the earlier chaos-service.test.ts (list +
 * execute only) did not cover.
 *
 * Backed by hce-saas graphql/server/{handlers,services}/chaosservices/v3 and
 * service-discovery GET /api/v1/agents.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { compactItems } from "../../src/utils/compact.js";
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

// ── create ──────────────────────────────────────────────────────────────
describe("chaos_service create", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("builds the v3 body: probe {probeId,inputs} mapping, dual-write ids, tag normalization", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "svc1",
      name: "svc-1",
      external_service_id: "ext-1",
      agent_id: "agent-1",
      environment_id: "env-1",
      infrastructure_id: "infra-1",
      infrastructure_type: "KubernetesV2",
      tags: "a, b ,c",
      probes: [{ probe_id: "p-1", inputs: [{ name: "url", value: "http://x" }] }],
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/chaos-services");

    const body = call.body as Record<string, unknown>;
    expect(body).toMatchObject({
      identity: "svc1",
      name: "svc-1",
      externalServiceId: "ext-1",
      agentId: "agent-1",
      environmentId: "env-1",
      infrastructureId: "infra-1",
      infrastructureType: "KubernetesV2",
      // Dual-write snake_case keys for the registry required-field validator.
      external_service_id: "ext-1",
      agent_id: "agent-1",
      environment_id: "env-1",
      infrastructure_id: "infra-1",
    });
    expect(body.tags).toEqual(["a", "b", "c"]);
    expect(body.probes).toEqual([
      { probeId: "p-1", inputs: [{ name: "url", value: "http://x" }] },
    ]);
  });

  it("omits probes when none are supplied (new service starts with no probes)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-2" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "svc2",
      name: "svc-2",
      external_service_id: "ext-2",
      agent_id: "agent-2",
      environment_id: "env-2",
      infrastructure_id: "infra-2",
    });

    const body = mockRequest.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.probes).toBeUndefined();
  });
});

// ── update ──────────────────────────────────────────────────────────────
describe("chaos_service update", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  const REQUIRED = {
    identity: "svc-1",
    org_id: "o",
    project_id: "p",
    name: "svc-1",
    external_service_id: "ext-1",
    agent_id: "agent-1",
    environment_id: "env-1",
    infrastructure_id: "infra-1",
  };

  it("sends an explicit probes:[] through (detach all) rather than dropping it", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "update", {
      ...REQUIRED,
      probes: [],
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/chaos/manager/api/v3/chaos-services/svc-1");
    expect((call.body as Record<string, unknown>).probes).toEqual([]);
  });

  it("maps a supplied probe list to {probeId,inputs}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "update", {
      ...REQUIRED,
      probes: [{ probe_id: "p-9", inputs: [{ name: "n", value: "v" }] }],
    });

    const body = mockRequest.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.probes).toEqual([
      { probeId: "p-9", inputs: [{ name: "n", value: "v" }] },
    ]);
  });

  it("rejects an update that omits probes (required full desired-state replace)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "chaos_service", "update", { ...REQUIRED }),
    ).rejects.toThrow(/probes/);
    // Validation must fire before any API call.
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

// ── discovered_agent list ────────────────────────────────────────────────
describe("discovered_agent list", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("lists without environment_id (optional filter, not sent when omitted)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], page: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "discovered_agent", "list", {
      org_id: "o",
      project_id: "p",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/servicediscovery/api/v1/agents");
    expect(call.params.environmentIdentifier).toBeUndefined();
  });

  it("passes environment_id through as environmentIdentifier when supplied", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [], page: { totalItems: 0 } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "discovered_agent", "list", {
      org_id: "o",
      project_id: "p",
      environment_id: "env-1",
    });

    expect(mockRequest.mock.calls[0][0].params.environmentIdentifier).toBe("env-1");
  });

  it("keeps serviceCount/networkMapCount through the compact projection", () => {
    const compactFn = registry.getResource("discovered_agent").compactItem;
    expect(compactFn).toBeDefined();

    const [slim] = compactItems(
      [
        {
          identity: "agent-1",
          name: "my-agent",
          environmentIdentifier: "env-1",
          serviceCount: 12,
          networkMapCount: 3,
          token: "SECRET",
          config: { some: "verbose blob" },
        },
      ],
      compactFn,
    ) as Record<string, unknown>[];

    expect(slim.identity).toBe("agent-1");
    expect(slim.serviceCount).toBe(12);
    expect(slim.networkMapCount).toBe(3);
    // Verbose/secret fields are dropped.
    expect(slim.token).toBeUndefined();
    expect(slim.config).toBeUndefined();
  });
});
