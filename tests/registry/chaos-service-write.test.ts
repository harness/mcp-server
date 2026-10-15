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

  it("omits environment and infrastructure for a code-repository service and maps the linked discovered service", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "repo-svc" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "repo-svc",
      name: "repo svc",
      external_service_id: "ext-repo",
      agent_id: "custom-discovery-agent",
      linked_discovered_service: {
        agent_id: "agent-1",
        environment_id: "env-1",
        external_id: "disc-1",
      },
    });

    const body = mockRequest.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.environmentId).toBeUndefined();
    expect(body.environment_id).toBeUndefined();
    expect(body.infrastructureId).toBeUndefined();
    expect(body.infrastructure_id).toBeUndefined();
    expect(body.infrastructureType).toBeUndefined();
    expect(body.linkedDiscoveredService).toEqual({
      agentId: "agent-1",
      environmentId: "env-1",
      externalId: "disc-1",
    });
  });
});

describe("custom_service", () => {
  let registry: Registry;
  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("creates a CodeRepository service on the custom discovery agent", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "mongo-id", identity: "payments" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "custom_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
      name: "payments",
      type: "CodeRepository",
      repo_url: "https://github.com/acme/payments.git",
      description: "checkout module",
      tags: "repo, code",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gateway/servicediscovery/api/v2/services");
    expect(call.params.agentIdentifier).toBe("custom-discovery-agent");
    expect(call.params.organizationIdentifier).toBe("o");
    expect(call.params.projectIdentifier).toBe("p");
    expect(call.body).toEqual({
      identity: "payments",
      name: "payments",
      type: "CodeRepository",
      description: "checkout module",
      tags: ["repo", "code"],
      spec: { codeRepository: { repoURL: "https://github.com/acme/payments.git", module: "." } },
    });
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
  });

  it("keeps a caller-supplied module and rejects a code repository without repo_url", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "custom_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
      name: "payments",
      type: "CodeRepository",
      repo_url: "git0.harness.io/acme/payments",
      module: "graphql/server",
      branch: "main",
    });
    expect((mockRequest.mock.calls[0][0].body as { spec: { codeRepository: { module: string; branch: string } } }).spec.codeRepository)
      .toMatchObject({ module: "graphql/server", branch: "main" });

    await expect(registry.dispatch(client, "custom_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
      name: "payments",
      type: "CodeRepository",
    })).rejects.toThrow(/repo_url/);
  });

  it("passes a non-repository spec through and requires one", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "vm-1" });
    const client = makeClient(mockRequest);
    const spec = { linuxVM: { hostname: "host-1" } };

    await registry.dispatch(client, "custom_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "vm-1",
      name: "vm-1",
      type: "LinuxVM",
      spec,
    });
    expect((mockRequest.mock.calls[0][0].body as { spec: unknown }).spec).toEqual(spec);

    await expect(registry.dispatch(client, "custom_service", "create", {
      org_id: "o",
      project_id: "p",
      identity: "vm-2",
      name: "vm-2",
      type: "LinuxVM",
    })).rejects.toThrow(/spec is required/);
  });

  it("updates a CodeRepository service with the branch, identity on the path only", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "payments" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "custom_service", "update", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
      name: "payments",
      type: "CodeRepository",
      repo_url: "https://github.com/acme/payments.git",
      module: "graphql/server",
      branch: "code-scan",
      tags: "repo, code",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/gateway/servicediscovery/api/v2/services/payments");
    expect(call.params.agentIdentifier).toBe("custom-discovery-agent");
    expect(call.params.organizationIdentifier).toBe("o");
    expect(call.params.projectIdentifier).toBe("p");
    expect(call.body).toEqual({
      name: "payments",
      type: "CodeRepository",
      tags: ["repo", "code"],
      spec: {
        codeRepository: {
          repoURL: "https://github.com/acme/payments.git",
          module: "graphql/server",
          branch: "code-scan",
        },
      },
    });
  });

  it("requires name and type on update", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({}));
    await expect(registry.dispatch(client, "custom_service", "update", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
      type: "CodeRepository",
      repo_url: "https://github.com/acme/payments.git",
    })).rejects.toThrow(/name is required/);
    await expect(registry.dispatch(client, "custom_service", "update", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
      name: "payments",
    })).rejects.toThrow(/type is required/);
  });

  it("lists and gets with the v2 service paths", async () => {
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ items: [{ identity: "payments" }], pagination: { total: 1 } })
      .mockResolvedValueOnce({ identity: "payments", id: "mongo-id" });
    const client = makeClient(mockRequest);

    const listed = await registry.dispatch(client, "custom_service", "list", {
      org_id: "o",
      project_id: "p",
      type: "CodeRepository",
    });
    expect(mockRequest.mock.calls[0][0].path).toBe("/gateway/servicediscovery/api/v2/services");
    expect(mockRequest.mock.calls[0][0].params.type).toBe("CodeRepository");
    expect(listed).toMatchObject({ total: 1 });

    await registry.dispatch(client, "custom_service", "get", {
      org_id: "o",
      project_id: "p",
      identity: "payments",
    });
    expect(mockRequest.mock.calls[1][0].path).toBe("/gateway/servicediscovery/api/v2/services/payments");
    expect(mockRequest.mock.calls[1][0].params.agentIdentifier).toBe("custom-discovery-agent");
  });

  it("list unwraps the v2 envelope and drops correlationID", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [{ identity: "payments" }, { identity: "orders" }],
      pagination: { total: 7, pageSize: 2, pageCount: 4, pageNumber: 0 },
      correlationID: "corr-1",
    });
    const client = makeClient(mockRequest);

    const listed = (await registry.dispatch(client, "custom_service", "list", {
      org_id: "o", project_id: "p",
    })) as Record<string, unknown>;

    expect(Object.keys(listed).sort()).toEqual(["items", "total"]);
    expect(listed).toMatchObject({
      items: [{ identity: "payments" }, { identity: "orders" }],
      total: 7,
    });
    expect(mockRequest.mock.calls[0][0].params.agentIdentifier).toBeUndefined();
  });

  it("links get and list results to the custom service page", async () => {
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ identity: "payments", id: "mongo-id" })
      .mockResolvedValueOnce({ items: [{ identity: "payments" }], pagination: { total: 1 } });
    const client = makeClient(mockRequest);
    const link =
      "https://app.harness.io/ng/account/test-account/module/chaos/orgs/o/projects/p/settings/discovery/custom-discovery-agent/custom-service/payments";

    const got = (await registry.dispatch(client, "custom_service", "get", {
      org_id: "o", project_id: "p", identity: "payments",
    })) as Record<string, unknown>;
    const listed = (await registry.dispatch(client, "custom_service", "list", {
      org_id: "o", project_id: "p",
    })) as { items: Array<Record<string, unknown>> };

    expect(got.openInHarness).toBe(link);
    expect(listed.items[0].openInHarness).toBe(link);
  });

  it("list returns an empty page when the response has no items or pagination", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ correlationID: "corr-1" });
    const client = makeClient(mockRequest);

    const listed = await registry.dispatch(client, "custom_service", "list", { org_id: "o", project_id: "p" });

    expect(listed).toEqual({ items: [], total: 0 });
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

  it("normalizes comma-separated tags to a trimmed string array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "update", {
      ...REQUIRED,
      tags: "team:payments, tier:1,,",
      probes: [],
    });

    const body = mockRequest.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.tags).toEqual(["team:payments", "tier:1"]);
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

  it("attaches a discovered service on a code-repository update and omits empty infra", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "update", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
      name: "svc-1",
      external_service_id: "ext-1",
      agent_id: "custom-discovery-agent",
      probes: [],
      linked_discovered_service: {
        agent_id: "test27",
        environment_id: "test",
        external_id: "disc-1",
      },
    });

    const body = mockRequest.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.environment_id).toBeUndefined();
    expect(body.infrastructure_id).toBeUndefined();
    expect(body.linkedDiscoveredService).toEqual({
      agentId: "test27",
      environmentId: "test",
      externalId: "disc-1",
    });
  });

  it("sends the mapped discovery agent's infrastructure on a code-repository update", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "svc-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_service", "update", {
      identity: "svc-1",
      org_id: "o",
      project_id: "p",
      name: "svc-1",
      external_service_id: "ext-1",
      agent_id: "custom-discovery-agent",
      environment_id: "test",
      infrastructure_id: "test27",
      infrastructure_type: "KubernetesV2",
      probes: [],
      linked_discovered_service: {
        agent_id: "test27",
        environment_id: "test",
        external_id: "disc-1",
      },
    });

    const body = mockRequest.mock.calls[0][0].body as Record<string, unknown>;
    expect(body.agentId).toBe("custom-discovery-agent");
    expect(body.environmentId).toBe("test");
    expect(body.infrastructureId).toBe("test27");
    expect(body.infrastructureType).toBe("KubernetesV2");
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
