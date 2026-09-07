import { describe, expect, it, vi } from "vitest";
import { autonomousWorkToolset } from "../../../src/registry/toolsets/autonomous_work.js";
import { Registry } from "../../../src/registry/index.js";
import type { Config } from "../../../src/config.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { ResourceDefinition } from "../../../src/registry/types.js";

const EXPECTED_RESOURCE_TYPES = [
  "work_item",
  "work_item_resume",
  "work_item_approve",
  "work_timeline",
  "work_budget",
  "work_phase",
  "work_phase_artifact",
  "work_artifact",
  "budget",
  "budget_grant",
  "budget_usage",
  "work_class",
  "work_trigger",
  "capability",
  "risk_evaluator",
  "team",
  "member",
  "member_template",
  "software_component",
  "content_source_connector",
] as const;

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "dh-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ items: [] }),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const resource = autonomousWorkToolset.resources.find((r) => r.resourceType === type);
  if (!resource) throw new Error(`Resource type "${type}" not found in autonomousWorkToolset`);
  return resource;
}

function collectEndpointPaths(): string[] {
  const paths: string[] = [];
  for (const resource of autonomousWorkToolset.resources) {
    for (const spec of Object.values(resource.operations)) {
      if (spec?.path) paths.push(spec.path);
    }
    for (const spec of Object.values(resource.executeActions ?? {})) {
      if (spec?.path) paths.push(spec.path);
    }
  }
  return paths;
}

describe("autonomous_work toolset structure", () => {
  it("is opt-in and named autonomous_work", () => {
    expect(autonomousWorkToolset.name).toBe("autonomous_work");
    expect(autonomousWorkToolset.optIn).toBe(true);
  });

  it("registers all 20 ADLC resource types", () => {
    const types = autonomousWorkToolset.resources.map((r) => r.resourceType);
    expect(types).toEqual([...EXPECTED_RESOURCE_TYPES]);
  });

  it("uses work_trigger (not trigger) to avoid colliding with pipeline triggers", () => {
    expect(autonomousWorkToolset.resources.map((r) => r.resourceType)).toContain("work_trigger");
    expect(autonomousWorkToolset.resources.map((r) => r.resourceType)).not.toContain("trigger");
  });

  it("routes every endpoint under /adlc/api/*", () => {
    for (const path of collectEndpointPaths()) {
      expect(path.startsWith("/adlc/api/"), `unexpected path: ${path}`).toBe(true);
    }
  });

  it("does not expose agent-execution or internal ADLC routes", () => {
    for (const path of collectEndpointPaths()) {
      expect(path).not.toMatch(/agent[-_]execution/i);
      expect(path).not.toMatch(/\/internal\//i);
    }
  });

  it("all resources are project-scoped", () => {
    for (const resource of autonomousWorkToolset.resources) {
      expect(resource.scope, `${resource.resourceType} should be project-scoped`).toBe("project");
    }
  });

  it("work_item is list/get only (created via Slack or agent flow, not public POST)", () => {
    const workItem = findResource("work_item");
    expect(workItem.operations.list).toBeDefined();
    expect(workItem.operations.get).toBeDefined();
    expect(workItem.operations.create).toBeUndefined();
    expect(workItem.operations.update).toBeUndefined();
    expect(workItem.operations.delete).toBeUndefined();
  });

  it("YAML CRUD resources require a yaml body field on create/update", () => {
    for (const type of [
      "work_class",
      "work_trigger",
      "capability",
      "risk_evaluator",
      "team",
      "member",
      "member_template",
      "software_component",
    ]) {
      const resource = findResource(type);
      const createSchema = resource.operations.create?.bodySchema;
      const updateSchema = resource.operations.update?.bodySchema;
      expect(createSchema?.fields.some((f) => f.name === "yaml" && f.required)).toBe(true);
      expect(updateSchema?.fields.some((f) => f.name === "yaml" && f.required)).toBe(true);
      expect(resource.operations.create?.bodyBuilder?.({ body: { yaml: "id: x" } })).toEqual({
        yaml: "id: x",
      });
    }
  });

  it("execute-only resources declare medium_write resume/approve actions", () => {
    const resume = findResource("work_item_resume").executeActions?.run;
    const approve = findResource("work_item_approve").executeActions?.run;
    expect(resume?.path).toBe("/adlc/api/workitems/{workItemId}/resume");
    expect(resume?.operationPolicy?.risk).toBe("medium_write");
    expect(approve?.path).toBe("/adlc/api/workitems/{workItemId}/approve");
    expect(approve?.operationPolicy?.risk).toBe("medium_write");
    expect(approve?.bodySchema?.fields.some((f) => f.name === "decision" && f.required)).toBe(true);
  });
});

describe("autonomous_work opt-in with Registry", () => {
  it("is NOT present when HARNESS_TOOLSETS is unset", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    for (const type of EXPECTED_RESOURCE_TYPES) {
      expect(registry.getAllResourceTypes()).not.toContain(type);
    }
  });

  it("IS present when enabled with HARNESS_TOOLSETS=autonomous_work", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));
    for (const type of EXPECTED_RESOURCE_TYPES) {
      expect(registry.getAllResourceTypes()).toContain(type);
    }
  });

  it("IS present when added to defaults with +autonomous_work", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+autonomous_work" }));
    expect(registry.getAllResourceTypes()).toContain("work_item");
    expect(registry.getAllResourceTypes()).toContain("pipeline");
  });
});

describe("autonomous_work registry dispatch", () => {
  it("dispatches work_item list to /adlc/api/workitems with org/project scope params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [] });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatch(makeClient(mockRequest), "work_item", "list", {
      org_id: "default",
      project_id: "dh-project",
    });

    const request = mockRequest.mock.calls[0]![0] as { method: string; path: string; params: Record<string, unknown> };
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/adlc/api/workitems");
    expect(request.params.orgIdentifier).toBe("default");
    expect(request.params.projectIdentifier).toBe("dh-project");
  });

  it("dispatches work_item_resume execute to POST /adlc/api/workitems/{id}/resume", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "resumed" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatchExecute(makeClient(mockRequest), "work_item_resume", "run", {
      org_id: "default",
      project_id: "dh-project",
      work_item_id: "wi-42",
    });

    const request = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: unknown };
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/adlc/api/workitems/wi-42/resume");
    expect(request.body).toEqual({});
  });

  it("dispatches work_item_approve execute with decision body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "approved" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatchExecute(makeClient(mockRequest), "work_item_approve", "run", {
      org_id: "default",
      project_id: "dh-project",
      work_item_id: "wi-42",
      body: { decision: "approve", reason: "budget cleared" },
    });

    const request = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/adlc/api/workitems/wi-42/approve");
    expect(request.body).toEqual({ decision: "approve", reason: "budget cleared" });
  });

  it("dispatches work_class create with YAML ask-body passthrough", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "wc-1" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatch(makeClient(mockRequest), "work_class", "create", {
      org_id: "default",
      project_id: "dh-project",
      body: { yaml: "workClass:\n  identifier: bugfix\n" },
    });

    const request = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/adlc/api/work-classes");
    expect(request.body).toEqual({ yaml: "workClass:\n  identifier: bugfix\n" });
  });
});
