/**
 * v3 coverage added for the RT MCP wiki TODOs that exist on chaos-manager:
 * list-metadata, experiment cron updates, dashboards, and image registries.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(): Config {
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
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const scope = { org_id: "default", project_id: "chaos-proj" };

describe("chaos v3 list_metadata", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it.each([
    ["chaos_experiment", "/chaos/manager/api/v3/experiments/list-metadata"],
    ["chaos_probe", "/chaos/manager/api/v3/probes/list-metadata"],
    ["chaos_fault", "/chaos/manager/api/v3/faults/list-metadata"],
    ["chaos_action", "/chaos/manager/api/v3/actions/list-metadata"],
    ["chaos_hub", "/chaos/manager/api/v3/hubs/list-metadata"],
  ])("%s posts list-metadata and unwraps items", async (resourceType, path) => {
    const mockRequest = vi.fn().mockResolvedValue({
      items: [{ identity: "pod-delete", name: "Pod Delete", description: "", tags: ["k8s"] }],
      pagination: { totalItems: 4 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatchExecute(client, resourceType, "list_metadata", {
      ...scope,
      search: "pod",
      sort_field: "name",
      sort_ascending: true,
      tags: "k8s",
      include_all_scope: false,
      body: { identifiers: ["pod-delete", "pod-network-loss"] },
    })) as { items: unknown[]; total: number };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe(path);
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
      page: "0",
      limit: "15",
      search: "pod",
      sortField: "name",
      sortAscending: true,
      tags: "k8s",
      includeAllScope: false,
    });
    expect(call.body).toEqual({ identifiers: ["pod-delete", "pod-network-loss"] });
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(4);
  });
});

describe("chaos_experiment update_cron", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("posts Enable with experiment IDs", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ successIDs: ["exp-1"], failedIDs: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "update_cron", {
      ...scope,
      body: { experiment_ids: "exp-1, exp-2", action: "enable" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/experiments/update-cron");
    expect(call.body).toMatchObject({
      experimentIDs: ["exp-1", "exp-2"],
      action: "Enable",
    });
  });

  it("requires cron_syntax when action is Update", async () => {
    const client = makeClient();
    await expect(
      registry.dispatchExecute(client, "chaos_experiment", "update_cron", {
        ...scope,
        body: { experiment_ids: ["exp-1"], action: "Update" },
      }),
    ).rejects.toThrow(/cron_syntax is required/);
  });

  it("accepts snake_case aliases and sends only the API field names", async () => {
    const def = registry.getResource("chaos_experiment");
    const names = def.executeActions?.update_cron.bodySchema?.fields.map((field) => field.name);
    expect(names).toEqual(["experimentIDs", "action", "cronSyntax"]);

    const mockRequest = vi.fn().mockResolvedValue({ successIDs: ["exp-1"], failedIDs: [] });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_experiment", "update_cron", {
      ...scope,
      body: { experiment_ids: ["ef9199b6-0248-4c0b-9d63-9176bf2b7123"], action: "Update", cron_syntax: "*/5 * * * *" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body).toEqual({
      experimentIDs: ["ef9199b6-0248-4c0b-9d63-9176bf2b7123"],
      action: "Update",
      cronSyntax: "*/5 * * * *",
    });
  });

  it("rejects more than 20 experiments", async () => {
    const client = makeClient();
    const experiment_ids = Array.from({ length: 21 }, (_, i) => `exp-${i}`);
    await expect(
      registry.dispatchExecute(client, "chaos_experiment", "update_cron", {
        ...scope,
        body: { experiment_ids, action: "Disable" },
      }),
    ).rejects.toThrow(/only 20 experiments/);
  });
});

describe("chaos_dashboard", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("list maps filters and keeps counts", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: [{ identity: "experiments-by-target", name: "Experiments by Target", category: "Experiment Activity", isFavourite: true }],
      pagination: { totalItems: 7 },
      counts: { all: 7, favourites: 1, categories: [], tags: ["chaos"] },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "chaos_dashboard", "list", {
      ...scope,
      search: "target",
      category: "Experiment Activity",
      favourite: true,
      sort_field: "name",
      sort_ascending: true,
    })) as { items: Array<{ identity: string }>; total: number; counts: { all: number } };

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/dashboards");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
      search: "target",
      category: "Experiment Activity",
      favourite: true,
      sortField: "name",
      sortAscending: true,
    });
    expect(result.items[0]?.identity).toBe("experiments-by-target");
    expect(result.total).toBe(7);
    expect(result.counts.all).toBe(7);
  });

  it("get uses the dashboard identity path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "service-test-coverage" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_dashboard", "get", {
      ...scope,
      identity: "service-test-coverage",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toBe("/chaos/manager/api/v3/dashboards/service-test-coverage");
  });

  it("update sends tags and isFavourite", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identity: "experiments-by-target", isFavourite: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_dashboard", "update", {
      ...scope,
      identity: "experiments-by-target",
      body: { tags: ["chaos", "activity"], is_favourite: false },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/chaos/manager/api/v3/dashboards/experiments-by-target");
    expect(call.body).toEqual({ tags: ["chaos", "activity"], isFavourite: false });
  });

  it("update rejects a missing tag list", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_dashboard", "update", {
        ...scope,
        identity: "experiments-by-target",
        body: { is_favourite: true },
      }),
    ).rejects.toThrow(/tags is required/);
  });
});

describe("chaos_image_registry", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("get is the scope singleton and passes infraID", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ registryServer: "docker.io", isDefault: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_image_registry", "get", {
      ...scope,
      infra_id: "infra-1",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/image-registries");
    expect(call.params).toMatchObject({
      organizationIdentifier: "default",
      projectIdentifier: "chaos-proj",
      infraID: "infra-1",
    });
  });

  it("account scope omits org and project", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ isDefault: true });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_image_registry", "get", {
      resource_scope: "account",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.organizationIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("create maps the legacy registry body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ registryServer: "registry.example" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_image_registry", "create", {
      ...scope,
      infra_id: "infra-1",
      body: {
        registry_server: "registry.example",
        registry_account: "harness",
        is_private: true,
        secret_name: "regcred",
        allow_child_override: true,
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/chaos/manager/api/v3/image-registries");
    expect(call.params.infraID).toBe("infra-1");
    expect(call.body).toMatchObject({
      registryServer: "registry.example",
      registryAccount: "harness",
      infraID: "infra-1",
      isPrivate: true,
      secretName: "regcred",
      allowChildOverride: true,
    });
  });

  it("create accepts an Ecr connector", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ artifactType: "Ecr" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_image_registry", "create", {
      ...scope,
      body: {
        artifact_type: "Ecr",
        connector_ref: "ecr-conn",
        connector_spec: { region: "us-east-1" },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body).toEqual({
      artifactType: "Ecr",
      connectorRef: "ecr-conn",
      connectorSpec: { region: "us-east-1" },
    });
  });

  it("refuses is_default together with infra_id", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_image_registry", "create", {
        ...scope,
        infra_id: "infra-1",
        body: { registry_server: "registry.example", registry_account: "harness", is_default: true },
      }),
    ).rejects.toThrow(/cannot be combined with infra_id/);
  });

  it("update requires the fields the API replaces", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_image_registry", "update", {
        ...scope,
        body: { artifact_type: "", registry_server: "registry.example", registry_account: "harness" },
      }),
    ).rejects.toThrow(/update replaces every stored image-registry field/);
  });

  it("update rejects a missing artifact_type so a connector registry is not cleared", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_image_registry", "update", {
        ...scope,
        body: {
          registry_server: "registry.example",
          registry_account: "harness",
          is_private: false,
          is_default: false,
          allow_child_override: true,
          use_custom_images: false,
          custom_images: {},
        },
      }),
    ).rejects.toThrow(/artifact_type is required on update/);
  });

  it("update sends the full replace body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ registryServer: "registry.example" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "chaos_image_registry", "update", {
      ...scope,
      infra_id: "infra-1",
      body: {
        registry_server: "registry.example",
        registry_account: "harness",
        is_private: true,
        secret_name: "regcred",
        is_default: false,
        allow_child_override: true,
        use_custom_images: true,
        custom_images: { log_watcher: "example/log-watcher:1" },
        artifact_type: "",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.params.infraID).toBe("infra-1");
    expect(call.body).toMatchObject({
      registryServer: "registry.example",
      registryAccount: "harness",
      infraID: "infra-1",
      isPrivate: true,
      secretName: "regcred",
      isDefault: false,
      allowChildOverride: true,
      useCustomImages: true,
      customImages: { logWatcher: "example/log-watcher:1" },
    });
  });

  it("update schema field names are the API json names", () => {
    const fields = registry.getResource("chaos_image_registry").operations.update?.bodySchema?.fields ?? [];
    const required = fields.filter((field) => field.required).map((field) => field.name);
    expect(required).toEqual([
      "isPrivate",
      "isDefault",
      "allowChildOverride",
      "useCustomImages",
      "customImages",
      "artifactType",
    ]);
  });

  it("documents infra_id on get, create, and update", () => {
    const def = registry.getResource("chaos_image_registry");
    for (const operation of ["get", "create", "update"] as const) {
      const names = def.operations[operation]?.paramsSchema?.fields.map((field) => field.name);
      expect(names).toContain("infra_id");
    }
  });

  it("create rejects Google Artifact Registry without hostname, project, or repository", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_image_registry", "create", {
        ...scope,
        body: {
          artifact_type: "GoogleArtifactRegistry",
          connector_ref: "gar-conn",
          connector_spec: { registry_hostname: "us-docker.pkg.dev" },
        },
      }),
    ).rejects.toThrow(/registryHostname, project, and repository are required/);
  });

  it("create rejects Ecr without a region", async () => {
    const client = makeClient();
    await expect(
      registry.dispatch(client, "chaos_image_registry", "create", {
        ...scope,
        body: { artifact_type: "Ecr", connector_ref: "ecr-conn" },
      }),
    ).rejects.toThrow(/region is required/);
  });

  it("resolve walks the scope hierarchy", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      effectiveConfig: { registryServer: "docker.io" },
      blockedByScope: "account",
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "chaos_image_registry", "resolve", {
      ...scope,
      infra_id: "infra-1",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/chaos/manager/api/v3/image-registries/resolve");
    expect(call.params.infraID).toBe("infra-1");
  });
});
