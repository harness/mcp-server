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

const YAML_CRUD_RESOURCES = [
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
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_AUTO_APPROVE_RISK: "none",
    ...overrides,
  } as Config;
}

function resource(type: string): ResourceDefinition {
  const found = autonomousWorkToolset.resources.find((r) => r.resourceType === type);
  if (!found) throw new Error(`${type} missing from autonomous_work toolset`);
  return found;
}

function collectPaths(def: ResourceDefinition): string[] {
  const paths: string[] = [];
  for (const spec of Object.values(def.operations)) {
    if (spec.path) paths.push(spec.path);
  }
  for (const spec of Object.values(def.executeActions ?? {})) {
    if (spec.path) paths.push(spec.path);
  }
  return paths;
}

describe("autonomous_work toolset structure", () => {
  it("is opt-in and excluded from the default registry", () => {
    expect(autonomousWorkToolset.optIn).toBe(true);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).not.toContain("work_item");
  });

  it("registers when HARNESS_TOOLSETS includes autonomous_work", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));
    for (const type of EXPECTED_RESOURCE_TYPES) {
      expect(registry.getAllResourceTypes()).toContain(type);
    }
  });

  it("registers all 20 ADLC resource types", () => {
    expect(autonomousWorkToolset.resources.map((r) => r.resourceType)).toEqual(
      expect.arrayContaining([...EXPECTED_RESOURCE_TYPES]),
    );
    expect(autonomousWorkToolset.resources).toHaveLength(20);
  });

  it("routes every operation through /adlc/api on the standard gateway", () => {
    for (const res of autonomousWorkToolset.resources) {
      for (const path of collectPaths(res)) {
        expect(path, `${res.resourceType} path`).toMatch(/^\/adlc\/api\//);
        expect(path, `${res.resourceType} path`).not.toMatch(/agent[-_]execution|\/internal\//i);
      }
    }
  });

  it("uses work_trigger (not harness trigger) for ADLC trigger CRUD", () => {
    const workTrigger = resource("work_trigger");
    expect(workTrigger.resourceType).toBe("work_trigger");
    expect(workTrigger.operations.create?.path).toBe("/adlc/api/triggers");
    expect(autonomousWorkToolset.resources.map((r) => r.resourceType)).not.toContain("trigger");
  });

  it("YAML CRUD resources require a yaml body field on create and update", () => {
    for (const type of YAML_CRUD_RESOURCES) {
      const res = resource(type);
      for (const op of ["create", "update"] as const) {
        const spec = res.operations[op];
        expect(spec, `${type}.${op}`).toBeDefined();
        const yamlField = spec!.bodySchema?.fields.find((f) => f.name === "yaml");
        expect(yamlField?.required, `${type}.${op} yaml required`).toBe(true);
        expect(yamlField?.type, `${type}.${op} yaml type`).toBe("yaml");
      }
    }
  });

  it("work_item is list/get only (no public create)", () => {
    const workItem = resource("work_item");
    expect(workItem.operations.list).toBeDefined();
    expect(workItem.operations.get).toBeDefined();
    expect(workItem.operations.create).toBeUndefined();
    expect(workItem.operations.update).toBeUndefined();
    expect(workItem.operations.delete).toBeUndefined();
  });
});

describe("autonomous_work dispatch", () => {
  it("dispatches work_class create through the gateway without baseUrl override", async () => {
    const request = vi.fn().mockResolvedValue({ id: "wc-1" });
    const client = { account: "test-account", request } as unknown as HarnessClient;
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatch(client, "work_class", "create", {
      org_id: "default",
      project_id: "test-project",
      body: { yaml: "id: smoke-class\n" },
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/adlc/api/work-classes",
      }),
    );
    expect(request.mock.calls[0]?.[0]).not.toHaveProperty("baseUrl");
  });

  it("dispatches work_item_resume execute to the resume endpoint", async () => {
    const request = vi.fn().mockResolvedValue({ status: "resumed" });
    const client = { account: "test-account", request } as unknown as HarnessClient;
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatchExecute(client, "work_item_resume", "run", {
      org_id: "default",
      project_id: "test-project",
      work_item_id: "wi-42",
    });

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/adlc/api/workitems/wi-42/resume",
      }),
    );
  });

  it("dispatches work_item_approve execute with decision body", async () => {
    const request = vi.fn().mockResolvedValue({ status: "approved" });
    const client = { account: "test-account", request } as unknown as HarnessClient;
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "autonomous_work" }));

    await registry.dispatchExecute(client, "work_item_approve", "run", {
      org_id: "default",
      project_id: "test-project",
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
