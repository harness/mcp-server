import { describe, it, expect, vi } from "vitest";
import { gitopsApplicationHandler } from "../../../src/tools/diagnose/gitops-application.js";
import { makeContext, makeRegistry, makeExtra, makeConfig, makeClient } from "./helpers.js";

function healthyApp() {
  return {
    app: {
      metadata: { name: "guestbook", namespace: "default" },
      spec: { source: { repoURL: "https://github.com/argoproj/argocd-example-apps", path: "guestbook", targetRevision: "HEAD" } },
      status: {
        sync: { status: "Synced", revision: "abc123", comparedTo: { source: { repoURL: "https://github.com/argoproj/argocd-example-apps", path: "guestbook", targetRevision: "HEAD" } } },
        health: { status: "Healthy" },
        operationState: { phase: "Succeeded", message: "successfully synced", startedAt: "2025-01-01T00:00:00Z", finishedAt: "2025-01-01T00:01:00Z", syncResult: { revision: "abc123" } },
      },
    },
  };
}

function healthyTree() {
  return {
    nodes: [
      { kind: "Service", name: "guestbook-svc", namespace: "default", health: { status: "Healthy" } },
      { kind: "Deployment", name: "guestbook", namespace: "default", group: "apps", health: { status: "Healthy" } },
      { kind: "ReplicaSet", name: "guestbook-abc", namespace: "default", group: "apps", health: { status: "Healthy" } },
    ],
  };
}

function emptyEvents() {
  return { items: [] };
}

function makeGitopsContext(overrides: {
  input?: Record<string, unknown>;
  appResponse?: unknown;
  treeResponse?: unknown;
  eventsResponse?: unknown;
  treeError?: Error;
  eventsError?: Error;
  appError?: Error;
} = {}) {
  const input = overrides.input ?? { agent_id: "my-agent", resource_id: "guestbook" };

  const dispatchFn = vi.fn(async (_c: unknown, resourceType: string, op: string) => {
    if (resourceType === "gitops_application" && op === "get") {
      if (overrides.appError) throw overrides.appError;
      return overrides.appResponse ?? healthyApp();
    }
    if (resourceType === "gitops_app_resource_tree" && op === "get") {
      if (overrides.treeError) throw overrides.treeError;
      return overrides.treeResponse ?? healthyTree();
    }
    if (resourceType === "gitops_app_event" && op === "list") {
      if (overrides.eventsError) throw overrides.eventsError;
      return overrides.eventsResponse ?? emptyEvents();
    }
    throw new Error(`Unmocked: ${resourceType}.${op}`);
  });

  const registry = { dispatch: dispatchFn, dispatchExecute: vi.fn() } as unknown as ReturnType<typeof makeRegistry>;

  return makeContext({ input, registry });
}

describe("gitopsApplicationHandler", () => {
  it("throws when agent_id is missing", async () => {
    const ctx = makeContext({ input: { resource_id: "app1" } });
    await expect(gitopsApplicationHandler.diagnose(ctx)).rejects.toThrow("agent_id");
  });

  it("throws when resource_id is missing", async () => {
    const ctx = makeContext({ input: { agent_id: "agent1" } });
    await expect(gitopsApplicationHandler.diagnose(ctx)).rejects.toThrow("resource_id");
  });

  it("returns healthy for synced and healthy app", async () => {
    const ctx = makeGitopsContext();
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.healthy).toBe(true);
    expect(result.issues).toBeUndefined();
    expect(result.overall_health).toBe("Healthy");

    const app = result.application as Record<string, unknown>;
    expect(app.name).toBe("guestbook");
    expect(app.sync_status).toBe("Synced");
    expect(app.health_status).toBe("Healthy");
  });

  it("flags OutOfSync app", async () => {
    const app = healthyApp();
    app.app.status.sync.status = "OutOfSync";

    const ctx = makeGitopsContext({ appResponse: app });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.healthy).toBe(false);
    const issues = result.issues as string[];
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("OutOfSync")]));
  });

  it("flags Degraded health", async () => {
    const app = healthyApp();
    app.app.status.health = { status: "Degraded", message: "Pod crash loop" };

    const ctx = makeGitopsContext({ appResponse: app });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.healthy).toBe(false);
    const issues = result.issues as string[];
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("Degraded")]));
    expect((result.application as Record<string, unknown>).health_message).toBe("Pod crash loop");
  });

  it("flags Suspended app", async () => {
    const app = healthyApp();
    app.app.status.health = { status: "Suspended" };

    const ctx = makeGitopsContext({ appResponse: app });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.healthy).toBe(false);
    const issues = result.issues as string[];
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("Suspended")]));
  });

  it("reports failed sync operation with failed resources", async () => {
    const app = healthyApp();
    app.app.status.operationState = {
      phase: "Failed",
      message: "one or more objects failed to apply",
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:01:00Z",
      syncResult: {
        revision: "abc123",
        resources: [
          { kind: "Deployment", name: "bad-deploy", namespace: "default", status: "SyncFailed", message: "apply failed" },
        ],
      },
    };

    const ctx = makeGitopsContext({ appResponse: app });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    const opState = result.last_sync_operation as Record<string, unknown>;
    expect(opState.phase).toBe("Failed");
    expect(opState.failed_resources).toBeDefined();
    const failed = opState.failed_resources as Array<Record<string, unknown>>;
    expect(failed[0].kind).toBe("Deployment");
    expect(failed[0].message).toBe("apply failed");

    const issues = result.issues as string[];
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("Failed")]));
  });

  it("surfaces conditions as issues", async () => {
    const app = healthyApp();
    (app.app.status as Record<string, unknown>).conditions = [
      { type: "ComparisonError", message: "unable to fetch manifest" },
    ];

    const ctx = makeGitopsContext({ appResponse: app });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.conditions).toHaveLength(1);
    const issues = result.issues as string[];
    expect(issues).toEqual(expect.arrayContaining([expect.stringContaining("ComparisonError")]));
  });

  it("reports unhealthy resources from tree", async () => {
    const tree = {
      nodes: [
        { kind: "Deployment", name: "broken", namespace: "default", group: "apps", health: { status: "Degraded", message: "CrashLoopBackOff" } },
        { kind: "Service", name: "svc", namespace: "default", health: { status: "Healthy" } },
      ],
    };

    const ctx = makeGitopsContext({ treeResponse: tree });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    const resourceTree = result.resource_tree as Record<string, unknown>;
    expect(resourceTree.unhealthy_count).toBe(1);
    const unhealthy = resourceTree.unhealthy_resources as Array<Record<string, unknown>>;
    expect(unhealthy[0].kind).toBe("Deployment");
    expect(unhealthy[0].health_message).toBe("CrashLoopBackOff");
  });

  it("reports warning events", async () => {
    const events = {
      items: [
        { type: "Warning", reason: "BackOff", message: "Back-off restarting failed container", count: 5, firstTimestamp: "2025-01-01T00:00:00Z", lastTimestamp: "2025-01-01T00:05:00Z" },
        { type: "Normal", reason: "Pulled", message: "Image pulled", count: 1 },
      ],
    };

    const ctx = makeGitopsContext({ eventsResponse: events });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    const warnings = result.recent_warnings as Array<Record<string, unknown>>;
    expect(warnings).toHaveLength(1);
    expect(warnings[0].reason).toBe("BackOff");
    expect(warnings[0].count).toBe(5);
  });

  it("degrades gracefully when resource tree API fails", async () => {
    const ctx = makeGitopsContext({ treeError: new Error("tree not available") });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.healthy).toBe(true);
    const resourceTree = result.resource_tree as Record<string, unknown>;
    expect(resourceTree.error).toContain("Could not fetch");
  });

  it("degrades gracefully when events API fails", async () => {
    const ctx = makeGitopsContext({ eventsError: new Error("events not available") });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.healthy).toBe(true);
    expect(result.recent_warnings).toBeUndefined();
  });

  it("throws when app API fails (required call)", async () => {
    const ctx = makeGitopsContext({ appError: new Error("Application not found") });
    await expect(gitopsApplicationHandler.diagnose(ctx)).rejects.toThrow("Application not found");
  });

  it("generates correct deep link", async () => {
    const ctx = makeGitopsContext({ input: { agent_id: "agent1", resource_id: "my-app", org_id: "myorg", project_id: "myproj" } });
    const result = await gitopsApplicationHandler.diagnose(ctx);

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/all/orgs/myorg/projects/myproj/gitops/applications/my-app",
    );
  });
});
