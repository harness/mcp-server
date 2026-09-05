import { describe, expect, it, vi } from "vitest";
import { autonomousWorkToolset } from "../../../src/registry/toolsets/autonomous_work.js";
import { Registry } from "../../../src/registry/index.js";
import type { Config } from "../../../src/config.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../../src/registry/types.js";

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

const YAML_CRUD_TYPES = [
  "work_class",
  "work_trigger",
  "capability",
  "risk_evaluator",
  "team",
  "member",
  "member_template",
  "software_component",
] as const;

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test.abc.xyz",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "adlc-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_AUTO_APPROVE_RISK: "none",
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
  if (!resource) throw new Error(`Resource type "${type}" not found in autonomous_work toolset`);
  return resource;
}

function getOp(type: string, op: keyof ResourceDefinition["operations"]): EndpointSpec {
  const spec = findResource(type).operations[op];
  if (!spec) throw new Error(`Operation "${String(op)}" not found on "${type}"`);
  return spec;
}

function getExecute(type: string, action = "run"): EndpointSpec {
  const spec = findResource(type).executeActions?.[action];
  if (!spec) throw new Error(`Execute action "${action}" not found on "${type}"`);
  return spec;
}

function collectEndpointSpecs(): EndpointSpec[] {
  const specs: EndpointSpec[] = [];
  for (const resource of autonomousWorkToolset.resources) {
    specs.push(...Object.values(resource.operations));
    if (resource.executeActions) {
      specs.push(...Object.values(resource.executeActions));
    }
  }
  return specs;
}

describe("autonomous_work toolset structure", () => {
  it("is opt-in and not loaded by default", () => {
    expect(autonomousWorkToolset.optIn).toBe(true);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).not.toContain("work_item");
  });

  it("registers all ADLC resource types when explicitly enabled", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));
    const types = registry.getAllResourceTypes();
    for (const type of EXPECTED_RESOURCE_TYPES) {
      expect(types, `${type} should be registered`).toContain(type);
    }
    expect(autonomousWorkToolset.resources).toHaveLength(EXPECTED_RESOURCE_TYPES.length);
  });

  it("can be enabled with the +autonomous_work modifier alongside defaults", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+autonomous_work" }));
    const types = registry.getAllResourceTypes();
    expect(types).toContain("work_item");
    expect(types).toContain("pipeline");
  });

  it("does not expose internal agent execution callbacks as a public resource", () => {
    const types = autonomousWorkToolset.resources.map((r) => r.resourceType);
    expect(types).not.toContain("agent_execution");
    for (const spec of collectEndpointSpecs()) {
      expect(spec.path).not.toMatch(/\/agent\/executions/);
      expect(spec.path).not.toMatch(/x-internal/i);
    }
  });

  it("uses work_trigger (not trigger) to avoid colliding with the pipelines toolset", () => {
    const types = autonomousWorkToolset.resources.map((r) => r.resourceType);
    expect(types).toContain("work_trigger");
    expect(types).not.toContain("trigger");
  });

  it("keeps every resource project-scoped under /adlc/api/* on the standard gateway", () => {
    for (const resource of autonomousWorkToolset.resources) {
      expect(resource.scope, `${resource.resourceType} scope`).toBe("project");
      expect(resource.toolset).toBe("autonomous_work");

      for (const spec of [...Object.values(resource.operations), ...Object.values(resource.executeActions ?? {})]) {
        expect(spec.path, `${resource.resourceType} path`).toMatch(/^\/adlc\/api\//);
      }
    }
  });

  it("keeps work_item read-only (no public create) while lifecycle actions are separate execute resources", () => {
    const workItem = findResource("work_item");
    expect(workItem.operations.list).toBeDefined();
    expect(workItem.operations.get).toBeDefined();
    expect(workItem.operations.create).toBeUndefined();
    expect(workItem.operations.update).toBeUndefined();
    expect(workItem.operations.delete).toBeUndefined();
    expect(findResource("work_item_resume").executeActions?.run).toBeDefined();
    expect(findResource("work_item_approve").executeActions?.run).toBeDefined();
  });

  it("uses set_default execute action for content_source_connector instead of YAML CRUD", () => {
    const connector = findResource("content_source_connector");
    expect(connector.operations.create).toBeUndefined();
    expect(connector.executeActions?.set_default).toBeDefined();
    expect(connector.executeActions?.set_default?.bodySchema?.fields.some((f) => f.name === "connectors")).toBe(true);
  });
  it("declares YAML ask-body schemas for work-config CRUD resources", () => {
    for (const type of YAML_CRUD_TYPES) {
      const create = getOp(type, "create");
      expect(create.bodySchema?.fields.some((f) => f.name === "yaml" && f.type === "yaml")).toBe(true);
      expect(create.skipScopeBodyInjection, `${type}.create skipScopeBodyInjection`).toBe(true);
    }
  });

  it("marks medium_write execute actions as do_not_retry with empty or explicit bodies", () => {
    for (const type of ["work_item_resume", "work_item_approve", "budget_grant"] as const) {
      const spec = getExecute(type);
      expect(spec.operationPolicy.risk).toBe("medium_write");
      expect(spec.operationPolicy.retryPolicy).toBe("do_not_retry");
      expect(spec.skipScopeBodyInjection).toBe(true);
      expect(spec.bodySchema).toBeDefined();
    }
  });
});

describe("autonomous_work registry dispatch", () => {
  it("lists work items with ADLC scope query params on the gateway path", async () => {
    const request = vi.fn().mockResolvedValue({ items: [] });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatch(makeClient(request), "work_item", "list", {
      org_id: "default",
      project_id: "adlc-project",
      page: 0,
      size: 25,
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/adlc/api/workitems",
        params: expect.objectContaining({
          orgIdentifier: "default",
          projectIdentifier: "adlc-project",
          offset: 0,
          limit: 25,
        }),
      }),
    );
    expect(request.mock.calls[0]?.[0]).not.toHaveProperty("baseUrl");
  });

  it("gets a nested work phase artifact path with work item and phase identifiers", async () => {
    const request = vi.fn().mockResolvedValue({ artifacts: [] });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatch(makeClient(request), "work_phase_artifact", "list", {
      org_id: "default",
      project_id: "adlc-project",
      work_item_id: "wi-123",
      phase_id: "plan",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/adlc/api/workitems/wi-123/phases/plan/artifacts",
      }),
    );
  });

  it("creates a work class with the YAML body and without injecting scope into the body", async () => {
    const request = vi.fn().mockResolvedValue({ id: "wc-1" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));
    const yaml = "apiVersion: adlc/v1\nkind: WorkClass\nmetadata:\n  id: demo\n";

    await registry.dispatch(makeClient(request), "work_class", "create", {
      org_id: "default",
      project_id: "adlc-project",
      body: { yaml },
    });

    const call = request.mock.calls[0]![0] as { method: string; path: string; body: unknown };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/work-classes");
    expect(call.body).toEqual({ yaml });
    expect(call.body).not.toHaveProperty("orgIdentifier");
    expect(call.body).not.toHaveProperty("projectIdentifier");
  });

  it("dispatches work_item resume as a POST execute action with an empty JSON body", async () => {
    const request = vi.fn().mockResolvedValue({ status: "resumed" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatchExecute(makeClient(request), "work_item_resume", "run", {
      org_id: "default",
      project_id: "adlc-project",
      work_item_id: "wi-42",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/adlc/api/workitems/wi-42/resume",
        body: {},
      }),
    );
  });

  it("forwards gate approval decision fields for work_item approve", async () => {
    const request = vi.fn().mockResolvedValue({ status: "approved" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatchExecute(makeClient(request), "work_item_approve", "run", {
      org_id: "default",
      project_id: "adlc-project",
      work_item_id: "wi-42",
      body: { decision: "approve", reason: "budget cleared" },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/adlc/api/workitems/wi-42/approve",
        body: { decision: "approve", reason: "budget cleared" },
      }),
    );
  });
});
