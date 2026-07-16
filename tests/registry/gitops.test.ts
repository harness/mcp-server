/**
 * Verifies GitOps toolset: identifier mapping, path building, body construction,
 * and response extraction for all GitOps resource types.
 *
 * GitOps APIs use gRPC-gateway style with scope-prefixed agent identifiers
 * and POST-for-list patterns. These tests ensure the registry dispatch layer
 * correctly wires inputs to the Harness GitOps API contract.
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

// ---------------------------------------------------------------------------
// gitops_agent
// ---------------------------------------------------------------------------

describe("gitops_agent", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: GET with searchTerm and type query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      content: [{ identifier: "myagent", name: "My Agent" }],
      totalItems: 1,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_agent", "list", {
      search_term: "sanity",
      type: "MANAGED_ARGO_PROVIDER",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents");
    expect(call.params.searchTerm).toBe("sanity");
    expect(call.params.type).toBe("MANAGED_ARGO_PROVIDER");
  });

  it("get: agent_id maps to path param {agentIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "myagent", name: "My Agent" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_agent", "get", {
      agent_id: "account.myagent",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent");
  });

  it("delete: raw agent_id → DELETE /gitops/api/v1/agents/{agentIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_agent", "delete", {
      resource_id: "agent1779094157087",
      agent_id: "agent1779094157087",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/agents/agent1779094157087");
  });
});

// ---------------------------------------------------------------------------
// gitops_application
// ---------------------------------------------------------------------------

describe("gitops_application", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: POST with pageIndex, pageSize, searchTerm, metadataOnly in body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      content: [{ name: "my-app" }],
      totalItems: 1,
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "list", {
      page: 1,
      size: 10,
      search_term: "guest",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/applications");
    expect(call.body).toMatchObject({
      pageIndex: 1,
      pageSize: 10,
      searchTerm: "guest",
      metadataOnly: true,
    });
  });

  it("get: agent_id → {agentIdentifier}, app_name → {appName}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ metadata: { name: "demo-app" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "get", {
      agent_id: "account.myagent",
      app_name: "demo-app",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app");
  });

  it("create: agent_id → {agentIdentifier}, query params for cluster/repo/skip", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ metadata: { name: "new-app" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "create", {
      agent_id: "account.myagent",
      cluster_identifier: "account.incluster",
      skip_repo_validation: "true",
      body: {
        application: {
          metadata: { name: "new-app" },
          spec: {
            source: { repoURL: "https://github.com/org/repo", path: "manifests", targetRevision: "HEAD" },
            destination: { server: "https://kubernetes.default.svc", namespace: "default" },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications");
    expect(call.params.clusterIdentifier).toBe("account.incluster");
    expect(call.params.skipRepoValidation).toBe("true");
    expect(call.body.application.metadata.name).toBe("new-app");
  });

  it("create: throws when body.application is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_application", "create", {
        agent_id: "account.myagent",
        body: {},
      }),
    ).rejects.toThrow(/body\.application is required/);
  });

  it("update: agent_id → {agentIdentifier}, app_name → {appName}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ metadata: { name: "demo-app" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "update", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      cluster_identifier: "account.incluster",
      skip_repo_validation: "true",
      body: {
        application: {
          metadata: { name: "demo-app", labels: { env: "test" } },
          spec: {
            source: { repoURL: "https://github.com/org/repo", path: "manifests", targetRevision: "HEAD" },
            destination: { server: "https://kubernetes.default.svc", namespace: "default" },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app");
    expect(call.params.clusterIdentifier).toBe("account.incluster");
    expect(call.params.skipRepoValidation).toBe("true");
    expect(call.body.application.metadata.labels.env).toBe("test");
  });

  it("update: throws when body.application is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_application", "update", {
        agent_id: "account.myagent",
        app_name: "demo-app",
        body: {},
      }),
    ).rejects.toThrow(/body\.application is required/);
  });

  it("delete: foreground cascade — cascade + propagation_policy forwarded as query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "delete", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      cascade: "true",
      propagation_policy: "foreground",
      remove_existing_finalizers: "false",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app");
    // queryParams maps: cascade → request.cascade, propagation_policy → request.propagationPolicy
    expect(call.params["request.cascade"]).toBe("true");
    expect(call.params["request.propagationPolicy"]).toBe("foreground");
    expect(call.params["options.removeExistingFinalizers"]).toBe("false");
  });

  it("delete: non-cascading — cascade=false, no propagation_policy needed", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "delete", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      cascade: "false",
      remove_existing_finalizers: "false",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.params["request.cascade"]).toBe("false");
    expect(call.params["request.propagationPolicy"]).toBeUndefined();
  });

  it("delete: throws when cascade and remove_existing_finalizers are not provided", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_application", "delete", {
        agent_id: "account.myagent",
        app_name: "demo-app",
      }),
    ).rejects.toThrow(/Missing required param\(s\) for gitops_application\.delete: cascade, remove_existing_finalizers/);
  });

  it("delete: throws when cascade=true but propagation_policy is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_application", "delete", {
        agent_id: "account.myagent",
        app_name: "demo-app",
        cascade: "true",
        remove_existing_finalizers: "false",
      }),
    ).rejects.toThrow(/propagation_policy is required when cascade=true/);
  });
});

// ---------------------------------------------------------------------------
// gitops_application execute actions
// ---------------------------------------------------------------------------

describe("gitops_application execute actions", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("sync: agent_id → {agentIdentifier}, app_name → {appName}, path ends /sync", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "Syncing" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "sync", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      body: { prune: true, dryRun: false },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/sync");
    expect(call.body).toMatchObject({ prune: true, dryRun: false });
  });

  it("refresh: builds applicationTargets from single app (agent_id + app_name)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "refresh", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      body: { refresh: "hard" },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/applications/bulk/refresh");
    expect(call.body.applicationTargets).toEqual([
      { applicationName: "demo-app", agentIdentifier: "account.myagent" },
    ]);
    expect(call.body.refresh).toBe("hard");
  });

  it("refresh: throws when no targets provided", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_application", "refresh", {
        body: { refresh: "normal" },
      }),
    ).rejects.toThrow(/requires at least one target/);
  });

  it("bulk_sync: builds applicationTargets from body.targets array", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "bulk_sync", {
      body: {
        targets: [
          { agent_id: "account.myagent", app_name: "app1" },
          { agent_id: "account.myagent", app_name: "app2" },
        ],
        prune: true,
        syncOptions: ["CreateNamespace=true"],
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/applications/bulk/sync");
    expect(call.body.applicationTargets).toEqual([
      { applicationName: "app1", agentIdentifier: "account.myagent" },
      { applicationName: "app2", agentIdentifier: "account.myagent" },
    ]);
    expect(call.body.prune).toBe(true);
    expect(call.body.syncOptions).toEqual({ items: ["CreateNamespace=true"] });
  });

  it("cancel_operation: DELETE with agent_id and app_name in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "cancel_operation", {
      agent_id: "account.myagent",
      app_name: "demo-app",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/operation");
  });

  it("run_resource_action: validates required body fields", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_application", "run_resource_action", {
        agent_id: "account.myagent",
        app_name: "demo-app",
        body: { kind: "Deployment" },
      }),
    ).rejects.toThrow(/requires body\.namespace.*body\.resourceName.*body\.kind.*body\.action/);
  });

  it("run_resource_action: builds correct path and body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "run_resource_action", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      body: {
        namespace: "default",
        resourceName: "my-deploy",
        kind: "Deployment",
        group: "apps",
        action: "restart",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/resource/actions");
    expect(call.body).toMatchObject({
      namespace: "default",
      resourceName: "my-deploy",
      kind: "Deployment",
      group: "apps",
      action: "restart",
    });
  });
});

// ---------------------------------------------------------------------------
// gitops_applicationset
// ---------------------------------------------------------------------------

describe("gitops_applicationset", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: POST body with optional agentIdentifier filter", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [], totalItems: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "list", {
      agent_id: "account.myagent",
      search_term: "my-appset",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/applicationsets");
    expect(call.body).toMatchObject({
      agentIdentifier: "account.myagent",
      searchTerm: "my-appset",
    });
  });

  it("get: appset_id → {identifier}, agent_id → query param agentIdentifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ metadata: { name: "my-appset" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "get", {
      appset_id: "cce8a056-8059-4abc-def0-123456789abc",
      agent_id: "account.myagent",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/applicationset/cce8a056-8059-4abc-def0-123456789abc");
    expect(call.params.agentIdentifier).toBe("account.myagent");
  });

  it("create: agent_id → query param, bodyBuilder validates body.applicationset", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ metadata: { name: "new-appset" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "create", {
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: { name: "new-appset" },
          spec: {
            generators: [{ list: { elements: [{ ns: "dev" }] } }],
            template: {
              metadata: { name: "app-{{.ns}}" },
              spec: {
                source: { repoURL: "https://github.com/org/repo", path: "manifests", targetRevision: "HEAD" },
                destination: { server: "https://kubernetes.default.svc", namespace: "{{.ns}}" },
              },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/applicationset");
    expect(call.params.agentIdentifier).toBe("account.myagent");
    expect(call.body.applicationset.metadata.name).toBe("new-appset");
  });

  it("create: throws when body.applicationset is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_applicationset", "create", {
        agent_id: "account.myagent",
        body: {},
      }),
    ).rejects.toThrow(/body\.applicationset is required/);
  });

  it("update: agent_id → query param, bodyBuilder requires metadata.uid", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "update", {
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: { name: "my-appset", uid: "cce8a056-8059-4abc-def0-123456789abc" },
          spec: {
            generators: [{ list: { elements: [{ ns: "staging" }] } }],
            template: {
              metadata: { name: "app-{{.ns}}" },
              spec: {
                source: { repoURL: "https://github.com/org/repo", path: "manifests", targetRevision: "HEAD" },
                destination: { server: "https://kubernetes.default.svc", namespace: "{{.ns}}" },
              },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/gitops/api/v1/applicationset");
    expect(call.params.agentIdentifier).toBe("account.myagent");
    expect(call.body.applicationset.metadata.uid).toBe("cce8a056-8059-4abc-def0-123456789abc");
  });

  it("update: throws when metadata.uid is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_applicationset", "update", {
        agent_id: "account.myagent",
        body: {
          applicationset: {
            metadata: { name: "my-appset" },
            spec: { generators: [], template: {} },
          },
        },
      }),
    ).rejects.toThrow(/metadata\.uid is REQUIRED/);
  });

  it("delete: appset_id → {identifier}, agent_id → query param agentIdentifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "delete", {
      appset_id: "cce8a056-8059-4abc-def0-123456789abc",
      agent_id: "account.myagent",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/applicationset/cce8a056-8059-4abc-def0-123456789abc");
    expect(call.params.agentIdentifier).toBe("account.myagent");
  });
});

// ---------------------------------------------------------------------------
// gitops_cluster
// ---------------------------------------------------------------------------

describe("gitops_cluster", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: POST with pageIndex, pageSize in body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [], totalItems: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster", "list", {
      page: 0,
      size: 5,
      search_term: "prod",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/clusters");
    expect(call.body).toMatchObject({
      pageIndex: 0,
      pageSize: 5,
      searchTerm: "prod",
    });
  });

  it("get: agent_id → {agentIdentifier}, cluster_id → {clusterIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "incluster" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster", "get", {
      agent_id: "account.myagent",
      cluster_id: "incluster",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/clusters/incluster");
  });

  it("delete: cluster_id → {clusterIdentifier}, force_delete forwarded as forceDelete query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster", "delete", {
      agent_id: "account.myagent",
      cluster_id: "cluster11",
      force_delete: "true",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/clusters/cluster11");
    expect(call.params.forceDelete).toBe("true");
  });

  it("delete: query_name forwarded as query.name — used for renamed clusters", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster", "delete", {
      agent_id: "account.myagent",
      cluster_id: "cluster11",
      query_name: "cluster11-jh_9",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params["query.name"]).toBe("cluster11-jh_9");
  });
});

// ---------------------------------------------------------------------------
// gitops_repository
// ---------------------------------------------------------------------------

describe("gitops_repository", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: POST with pageIndex, pageSize, searchTerm in body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [], totalItems: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "list", {
      search_term: "argocd",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/repositories");
    expect(call.body.searchTerm).toBe("argocd");
  });

  it("get: agent_id → {agentIdentifier}, repo_id → {repoIdentifier}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ repo: { url: "https://github.com/org/repo" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "get", {
      agent_id: "account.myagent",
      repo_id: "my-repo",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/repositories/my-repo");
  });

  it("delete: repo_id → {repoIdentifier}, DELETE path correct", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "delete", {
      agent_id: "account.gitopssanityagent-qa-12201bdd96",
      repo_id: "rolloutsDemoRepo",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/agents/account.gitopssanityagent-qa-12201bdd96/repositories/rolloutsDemoRepo");
  });

  it("delete: force_delete forwarded as forceDelete query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "delete", {
      agent_id: "account.myagent",
      repo_id: "my-repo",
      force_delete: "true",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.forceDelete).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// gitops_repo_credential
// ---------------------------------------------------------------------------

describe("gitops_repo_credential", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: POST body with optional agentIdentifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [], totalItems: 0 });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repo_credential", "list", {
      agent_id: "account.myagent",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/gitops/api/v1/repocreds");
    expect(call.body.agentIdentifier).toBe("account.myagent");
  });

  it("get: agent_id → {agentIdentifier}, credential_id → {credentialId}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repo_credential", "get", {
      agent_id: "account.myagent",
      credential_id: "my-cred",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/repocreds/my-cred");
  });

  it("delete: credential_id → {credentialId}, DELETE path correct", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repo_credential", "delete", {
      agent_id: "account.tomylocal",
      credential_id: "ashinsabu3_donlxgyi",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/gitops/api/v1/agents/account.tomylocal/repocreds/ashinsabu3_donlxgyi");
  });
});

// ---------------------------------------------------------------------------
// gitops_cluster_link
// ---------------------------------------------------------------------------

describe("gitops_cluster_link", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("list: GET with environmentIdentifier query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { content: [{ name: "account.incluster" }], totalElements: 1 },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "list", {
      environment_id: "my-env",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/gitops/clusters");
    expect(call.params.environmentIdentifier).toBe("my-env");
  });

  it("create: bodyBuilder validates identifier, envRef, agentIdentifier, scope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { clusterRef: "account.incluster" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "create", {
      body: {
        identifier: "incluster",
        envRef: "my-env",
        agentIdentifier: "myagent",
        scope: "ACCOUNT",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/gitops/clusters");
    expect(call.body).toMatchObject({
      identifier: "incluster",
      envRef: "my-env",
      agentIdentifier: "myagent",
      scope: "ACCOUNT",
    });
  });

  it("create: throws when required fields are missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_cluster_link", "create", {
        body: { identifier: "incluster" },
      }),
    ).rejects.toThrow(/requires body\.identifier.*body\.envRef.*body\.agentIdentifier.*body\.scope/);
  });

  it("delete: cluster_id → {clusterIdentifier}, query params for env/agent/scope", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: {},
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "delete", {
      cluster_id: "incluster",
      environment_id: "my-env",
      agent_id: "myagent",
      scope: "ACCOUNT",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/ng/api/gitops/clusters/incluster");
    expect(call.params.environmentIdentifier).toBe("my-env");
    expect(call.params.agentIdentifier).toBe("myagent");
    expect(call.params.scope).toBe("ACCOUNT");
  });
});

// ---------------------------------------------------------------------------
// gitops sub-resources (read-only, agent_id + app_name pattern)
// ---------------------------------------------------------------------------

describe("gitops sub-resources", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("gitops_app_event list: agent_id + app_name in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_app_event", "list", {
      agent_id: "account.myagent",
      app_name: "demo-app",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/events");
  });

  it("gitops_pod_log get: path params + query params (podName, namespace, container, tailLines)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ logs: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_pod_log", "get", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      pod_name: "demo-pod-abc123",
      namespace: "default",
      container: "main",
      tail_lines: 100,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/logs");
    expect(call.params.podName).toBe("demo-pod-abc123");
    expect(call.params.namespace).toBe("default");
    expect(call.params.container).toBe("main");
    expect(call.params.tailLines).toBe(100);
  });

  it("gitops_managed_resource list: agent_id + app_name in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_managed_resource", "list", {
      agent_id: "account.myagent",
      app_name: "demo-app",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/managed-resources");
  });

  it("gitops_resource_action list: path params + query params for resource filter", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ actions: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_resource_action", "list", {
      agent_id: "account.myagent",
      app_name: "demo-app",
      namespace: "default",
      resource_name: "my-deploy",
      kind: "Deployment",
      group: "apps",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/resource/actions");
    expect(call.params["request.namespace"]).toBe("default");
    expect(call.params["request.resourceName"]).toBe("my-deploy");
    expect(call.params["request.kind"]).toBe("Deployment");
    expect(call.params["request.group"]).toBe("apps");
  });

  it("gitops_app_resource_tree get: agent_id + app_name in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ nodes: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_app_resource_tree", "get", {
      agent_id: "account.myagent",
      app_name: "demo-app",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/agents/account.myagent/applications/demo-app/resource-tree");
  });

  it("gitops_dashboard get: simple GET with no identifiers", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ summary: {} });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_dashboard", "get", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gitops/api/v1/dashboard/overview");
  });
});

// ---------------------------------------------------------------------------
// Scope behavior — scopeOptional resources omit org/project unless explicit
// ---------------------------------------------------------------------------

describe("gitops scope behavior", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("gitops_agent get: omits orgIdentifier/projectIdentifier when not provided (account scope)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "myagent" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_agent", "get", {
      agent_id: "account.myagent",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("gitops_agent list: includes org/project when explicitly provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_agent", "list", {
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBe("my-org");
    expect(call.params.projectIdentifier).toBe("my-project");
  });

  it("gitops_cluster list: scopeOptional means org/project omitted when not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });

    const registryNoDefaults = new Registry(makeConfig({
      HARNESS_TOOLSETS: "gitops",
      HARNESS_ORG: "",
      HARNESS_PROJECT: "",
    }));

    await registryNoDefaults.dispatch(makeClient(mockRequest), "gitops_cluster", "list", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBeDefined();
    expect(call.params.orgIdentifier).toBeUndefined();
    expect(call.params.projectIdentifier).toBeUndefined();
  });

  it("gitops_repository get: includes org/project when provided (project scope)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "get", {
      agent_id: "myagent",
      repo_id: "my-repo",
      org_id: "custom-org",
      project_id: "custom-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBe("custom-org");
    expect(call.params.projectIdentifier).toBe("custom-project");
  });
});

// ---------------------------------------------------------------------------
// injectAccountInBody — GitOps list POST endpoints inject accountIdentifier
// ---------------------------------------------------------------------------

describe("gitops injectAccountInBody", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("gitops_application list: accountIdentifier injected into POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "list", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBe("test-account");
  });

  it("gitops_cluster list: accountIdentifier injected into POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster", "list", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBe("test-account");
  });

  it("gitops_repository list: accountIdentifier injected into POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "list", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBe("test-account");
  });

  it("gitops_applicationset list: accountIdentifier injected into POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "list", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.accountIdentifier).toBe("test-account");
  });
});

// ---------------------------------------------------------------------------
// encodeAppSetJsonFields — gRPC-gateway base64 encoding for ApplicationSets
// ---------------------------------------------------------------------------

describe("gitops_applicationset gRPC-gateway encoding", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("create: list generator elements are base64-encoded as {raw: ...}", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "create", {
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: { name: "test-appset" },
          spec: {
            generators: [{
              list: {
                elements: [
                  { cluster: "staging", url: "https://1.2.3.4" },
                  { cluster: "prod", url: "https://2.3.4.5" },
                ],
              },
            }],
            template: {
              metadata: { name: "app-{{.cluster}}" },
              spec: { source: { repoURL: "https://github.com/org/repo" }, destination: { server: "{{.url}}" } },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    const elements = call.body.applicationset.spec.generators[0].list.elements;
    expect(elements).toHaveLength(2);
    expect(elements[0]).toHaveProperty("raw");
    expect(typeof elements[0].raw).toBe("string");
    const decoded = JSON.parse(Buffer.from(elements[0].raw, "base64").toString("utf-8"));
    expect(decoded).toEqual({ cluster: "staging", url: "https://1.2.3.4" });
  });

  it("create: plugin input parameters are base64-encoded", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "create", {
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: { name: "plugin-appset" },
          spec: {
            generators: [{
              plugin: {
                configMapRef: { name: "my-plugin" },
                input: {
                  parameters: {
                    key1: "simple-string",
                    key2: { nested: true },
                  },
                },
              },
            }],
            template: {
              metadata: { name: "app" },
              spec: { source: { repoURL: "https://github.com/org/repo" }, destination: { server: "https://k8s" } },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    const params = call.body.applicationset.spec.generators[0].plugin.input.parameters;
    expect(params.key1).toHaveProperty("raw");
    expect(params.key2).toHaveProperty("raw");
    const decoded2 = JSON.parse(Buffer.from(params.key2.raw, "base64").toString("utf-8"));
    expect(decoded2).toEqual({ nested: true });
  });

  it("create: pre-encoded values (already have raw) pass through unchanged", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);
    const preEncoded = { raw: Buffer.from(JSON.stringify({ pre: "encoded" })).toString("base64") };

    await registry.dispatch(client, "gitops_applicationset", "create", {
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: { name: "pre-encoded-appset" },
          spec: {
            generators: [{
              list: { elements: [preEncoded] },
            }],
            template: {
              metadata: { name: "app" },
              spec: { source: { repoURL: "https://github.com/org/repo" }, destination: { server: "https://k8s" } },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    const elements = call.body.applicationset.spec.generators[0].list.elements;
    expect(elements[0]).toEqual(preEncoded);
  });

  it("create: nested matrix generators encode sub-generator matrix/merge as base64 blobs", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_applicationset", "create", {
      agent_id: "account.myagent",
      body: {
        applicationset: {
          metadata: { name: "matrix-appset" },
          spec: {
            generators: [{
              matrix: {
                generators: [
                  { list: { elements: [{ env: "dev" }] } },
                  { matrix: { generators: [{ list: { elements: [{ x: 1 }] } }] } },
                ],
              },
            }],
            template: {
              metadata: { name: "app" },
              spec: { source: { repoURL: "https://github.com/org/repo" }, destination: { server: "https://k8s" } },
            },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    const nestedGenerators = call.body.applicationset.spec.generators[0].matrix.generators;
    expect(nestedGenerators[0].list.elements[0]).toHaveProperty("raw");
    expect(nestedGenerators[1].matrix).toHaveProperty("raw");
  });
});

// ---------------------------------------------------------------------------
// emptyOnErrorPatterns — validate declarations exist (not yet wired in executeSpec)
// ---------------------------------------------------------------------------

describe("gitops emptyOnErrorPatterns declarations", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("gitops_applicationset list: has emptyOnErrorPatterns declared", () => {
    const def = registry.getResource("gitops_applicationset");
    const spec = def.operations.list;
    expect(spec?.emptyOnErrorPatterns).toBeDefined();
    expect(spec!.emptyOnErrorPatterns!.length).toBeGreaterThan(0);
    expect(spec!.emptyOnErrorPatterns!.some(p => p.test("agent is not registered"))).toBe(true);
    expect(spec!.emptyOnErrorPatterns!.some(p => p.test("Not Implemented"))).toBe(true);
  });

  it("gitops_repo_credential list: has emptyOnErrorPatterns declared", () => {
    const def = registry.getResource("gitops_repo_credential");
    const spec = def.operations.list;
    expect(spec?.emptyOnErrorPatterns).toBeDefined();
    expect(spec!.emptyOnErrorPatterns!.some(p => p.test("never connected"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildBulkTargets — validation and single-app fallback
// ---------------------------------------------------------------------------

describe("gitops buildBulkTargets validation", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("bulk_sync: throws when targets array has items missing agent_id", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_application", "bulk_sync", {
        body: {
          targets: [{ app_name: "my-app" }],
        },
      }),
    ).rejects.toThrow(/must have agent_id and app_name/);
  });

  it("bulk_sync: throws when targets array has items missing app_name", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_application", "bulk_sync", {
        body: {
          targets: [{ agent_id: "account.myagent" }],
        },
      }),
    ).rejects.toThrow(/must have agent_id and app_name/);
  });

  it("refresh: throws with descriptive error when neither resource_id nor body.targets given", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatchExecute(client, "gitops_application", "refresh", {}),
    ).rejects.toThrow(/requires at least one target/);
  });

  it("bulk_sync: single app via agent_id + app_name (no body.targets)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "bulk_sync", {
      agent_id: "org.myagent",
      app_name: "single-app",
      body: { prune: false },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.applicationTargets).toEqual([
      { applicationName: "single-app", agentIdentifier: "org.myagent" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// gitops_cluster_link — negative path validation
// ---------------------------------------------------------------------------

describe("gitops_cluster_link negative paths", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("create: throws when envRef is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_cluster_link", "create", {
        body: { identifier: "incluster", agentIdentifier: "myagent", scope: "ACCOUNT" },
      }),
    ).rejects.toThrow(/requires body\.identifier.*body\.envRef.*body\.agentIdentifier.*body\.scope/);
  });

  it("create: throws when scope is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_cluster_link", "create", {
        body: { identifier: "incluster", envRef: "my-env", agentIdentifier: "myagent" },
      }),
    ).rejects.toThrow(/requires body\.identifier.*body\.envRef.*body\.agentIdentifier.*body\.scope/);
  });

  it("create: throws when agentIdentifier is missing", async () => {
    const client = makeClient(vi.fn());

    await expect(
      registry.dispatch(client, "gitops_cluster_link", "create", {
        body: { identifier: "incluster", envRef: "my-env", scope: "ACCOUNT" },
      }),
    ).rejects.toThrow(/requires body\.identifier.*body\.envRef.*body\.agentIdentifier.*body\.scope/);
  });
});

// ---------------------------------------------------------------------------
// gitops_cluster_link delete — path building and required query params
// ---------------------------------------------------------------------------

describe("gitops_cluster_link delete", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("delete: builds correct DELETE path with cluster_id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "delete", {
      cluster_id: "incluster",
      environment_id: "my-env",
      agent_id: "myagent",
      scope: "ACCOUNT",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("DELETE");
    expect(call.path).toBe("/ng/api/gitops/clusters/incluster");
  });

  it("delete: forwards environment_id, agent_id, scope as query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "delete", {
      cluster_id: "prod-cluster",
      environment_id: "prod-env",
      agent_id: "prodagent",
      scope: "PROJECT",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.environmentIdentifier).toBe("prod-env");
    expect(call.params.agentIdentifier).toBe("prodagent");
    expect(call.params.scope).toBe("PROJECT");
  });

  it("delete: uses NG API path (not GitOps agent API path)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "delete", {
      cluster_id: "staging-cluster",
      environment_id: "staging",
      agent_id: "stagingagent",
      scope: "ORGANIZATION",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.path).toContain("/ng/api/gitops/clusters/");
    expect(call.path).not.toContain("/gitops/api/v1/");
  });
});

// ---------------------------------------------------------------------------
// gitops_application sync — retry, prune, and strategy options
// ---------------------------------------------------------------------------

describe("gitops_application sync options", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("sync: passes prune and dryRun in request body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "sync", {
      agent_id: "account.myagent",
      app_name: "my-app",
      body: { prune: true, dryRun: true },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.prune).toBe(true);
    expect(call.body.dryRun).toBe(true);
  });

  it("sync: passes strategy (apply vs hook) in request body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "sync", {
      agent_id: "account.myagent",
      app_name: "my-app",
      body: { strategy: { apply: { force: true } } },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.strategy).toEqual({ apply: { force: true } });
  });

  it("sync: passes retryStrategy in request body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({});
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "gitops_application", "sync", {
      agent_id: "account.myagent",
      app_name: "my-app",
      body: { retryStrategy: { limit: 3, backoff: { duration: "5s", factor: 2 } } },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.retryStrategy).toEqual({ limit: 3, backoff: { duration: "5s", factor: 2 } });
  });
});

// ---------------------------------------------------------------------------
// Toolset filtering — only gitops resources loaded
// ---------------------------------------------------------------------------

describe("gitops toolset filtering", () => {
  it("HARNESS_TOOLSETS=gitops loads only gitops resources", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const types = registry.getAllResourceTypes();

    expect(types.length).toBeGreaterThan(0);
    for (const t of types) {
      expect(t).toMatch(/^gitops_/);
    }
  });

  it("gitops toolset includes all expected resource types", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const types = registry.getAllResourceTypes();

    const expected = [
      "gitops_agent",
      "gitops_application",
      "gitops_cluster",
      "gitops_repository",
      "gitops_applicationset",
      "gitops_repo_credential",
      "gitops_cluster_link",
    ];

    for (const e of expected) {
      expect(types).toContain(e);
    }
  });

  it("gitops resources not loaded when HARNESS_TOOLSETS excludes gitops", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "pipelines" }));
    const types = registry.getAllResourceTypes();

    for (const t of types) {
      expect(t).not.toMatch(/^gitops_/);
    }
  });
});

// ---------------------------------------------------------------------------
// Identifier field ordering — validates resource definitions
// ---------------------------------------------------------------------------

describe("gitops identifier field ordering", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("gitops_application: identifierFields are [agent_id, app_name]", () => {
    const def = registry.getResource("gitops_application");
    expect(def.identifierFields).toEqual(["agent_id", "app_name"]);
  });

  it("gitops_applicationset: identifierFields are [agent_id, appset_id]", () => {
    const def = registry.getResource("gitops_applicationset");
    expect(def.identifierFields).toEqual(["agent_id", "appset_id"]);
  });

  it("gitops_cluster: identifierFields are [agent_id, cluster_id]", () => {
    const def = registry.getResource("gitops_cluster");
    expect(def.identifierFields).toEqual(["agent_id", "cluster_id"]);
  });

  it("gitops_agent: identifierFields are [agent_id]", () => {
    const def = registry.getResource("gitops_agent");
    expect(def.identifierFields).toEqual(["agent_id"]);
  });

  it("gitops_cluster_link: identifierFields are [cluster_id]", () => {
    const def = registry.getResource("gitops_cluster_link");
    expect(def.identifierFields).toEqual(["cluster_id"]);
  });
});

// ---------------------------------------------------------------------------
// Pagination param forwarding for list operations
// ---------------------------------------------------------------------------

describe("gitops pagination", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
  });

  it("gitops_agent list: forwards page/size as pageIndex/pageSize query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_agent", "list", { page: 2, size: 50 });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.pageIndex).toBe(2);
    expect(call.params.pageSize).toBe(50);
  });

  it("gitops_application list: forwards page/size as pageIndex/pageSize in POST body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_application", "list", { page: 3, size: 10 });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.pageIndex).toBe(3);
    expect(call.body.pageSize).toBe(10);
  });

  it("gitops_cluster list: defaults to page 0, size 20 when not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster", "list", {});

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.pageIndex).toBe(0);
    expect(call.body.pageSize).toBe(20);
  });

  it("gitops_cluster_link list: forwards page/size as query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_cluster_link", "list", {
      environment_id: "my-env",
      page: 1,
      size: 30,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.page).toBe(1);
    expect(call.params.size).toBe(30);
  });

  it("gitops_repository list: search_term forwarded in POST body as searchTerm", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ content: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "gitops_repository", "list", {
      search_term: "my-repo",
      page: 0,
      size: 5,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.body.searchTerm).toBe("my-repo");
    expect(call.body.pageIndex).toBe(0);
    expect(call.body.pageSize).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// supportedScopes — account/org/project (regression: scopeOptional resources
// without supportedScopes rejected resource_scope:"account")
// ---------------------------------------------------------------------------

describe("gitops supportedScopes", () => {
  const multiScopeResources = [
    "gitops_agent",
    "gitops_cluster",
    "gitops_repository",
    "gitops_repo_credential",
  ] as const;

  it.each(multiScopeResources)("declares account/org/project supportedScopes for %s", (resourceType) => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    expect(registry.getResource(resourceType).supportedScopes).toEqual(["account", "org", "project"]);
    expect(registry.getSupportedScopes(resourceType)).toEqual(["account", "org", "project"]);
  });

  it.each(multiScopeResources)(
    "accepts explicit resource_scope account for %s list without scope validation error",
    async (resourceType) => {
      const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
      const mockRequest = vi.fn().mockResolvedValue({ content: [] });
      const client = makeClient(mockRequest);

      await expect(
        registry.dispatch(client, resourceType, "list", { resource_scope: "account" }),
      ).resolves.toBeDefined();

      const call = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
      expect(call.params.orgIdentifier).toBeUndefined();
      expect(call.params.projectIdentifier).toBeUndefined();
    },
  );

  it("rejects account scope when supportedScopes is absent (documents fallback behavior)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "gitops" }));
    const client = makeClient(vi.fn());

    // gitops_application is scopeOptional but does NOT declare supportedScopes —
    // getSupportedScopes falls back to [def.scope] = ["project"] only.
    await expect(
      registry.dispatch(client, "gitops_application", "list", { resource_scope: "account" }),
    ).rejects.toThrow(/gitops_application does not support account scope/);
  });
});
