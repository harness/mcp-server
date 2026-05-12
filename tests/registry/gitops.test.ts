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
