import { describe, it, expect, vi, beforeEach } from "vitest";
import { autonomousWorkToolset } from "../../../src/registry/toolsets/autonomous_work.js";
import { Registry } from "../../../src/registry/index.js";
import type { Config } from "../../../src/config.js";
import type { HarnessClient } from "../../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../../src/registry/types.js";

const SAMPLE_WORK_CLASS_YAML = `apiVersion: harness.io/v1
kind: WorkClass
metadata:
  identifier: bugfix
spec:
  teamRef: platform`;

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

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const resource = autonomousWorkToolset.resources.find((r) => r.resourceType === type);
  if (!resource) throw new Error(`Resource type "${type}" not found in autonomousWorkToolset`);
  return resource;
}

function getOp(type: string, op: "list" | "get" | "create" | "update" | "delete"): EndpointSpec {
  const spec = findResource(type).operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

function getExecuteAction(type: string, action = "run"): EndpointSpec {
  const spec = findResource(type).executeActions?.[action];
  if (!spec) throw new Error(`Execute action "${action}" not found on "${type}"`);
  return spec;
}

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
  "agent_execution",
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

describe("autonomous_work toolset structure", () => {
  it("has name 'autonomous_work' and is loaded by default", () => {
    expect(autonomousWorkToolset.name).toBe("autonomous_work");
    expect(autonomousWorkToolset.optIn).toBeFalsy();
  });

  it("registers all ADLC resource types", () => {
    expect(autonomousWorkToolset.resources.map((r) => r.resourceType)).toEqual(
      expect.arrayContaining([...EXPECTED_RESOURCE_TYPES]),
    );
    expect(autonomousWorkToolset.resources).toHaveLength(EXPECTED_RESOURCE_TYPES.length);
  });

  it("is present when HARNESS_TOOLSETS is unset", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    for (const resourceType of EXPECTED_RESOURCE_TYPES) {
      expect(registry.getAllResourceTypes()).toContain(resourceType);
    }
  });

  it("all resources are project-scoped under /adlc/api without baseUrlOverride", () => {
    for (const resource of autonomousWorkToolset.resources) {
      expect(resource.scope, `${resource.resourceType} scope`).toBe("project");
      expect(resource.baseUrlOverride, `${resource.resourceType} baseUrlOverride`).toBeUndefined();
      expect(resource.toolset).toBe("autonomous_work");
    }
  });

  it("every endpoint and execute action declares operationPolicy", () => {
    for (const resource of autonomousWorkToolset.resources) {
      for (const [opName, spec] of Object.entries(resource.operations)) {
        expect(spec.operationPolicy, `${resource.resourceType}.${opName}`).toBeDefined();
        expect(spec.operationPolicy!.risk, `${resource.resourceType}.${opName}.risk`).toBeTruthy();
        expect(spec.operationPolicy!.retryPolicy, `${resource.resourceType}.${opName}.retryPolicy`).toBeTruthy();
      }
      for (const [actionName, spec] of Object.entries(resource.executeActions ?? {})) {
        expect(spec.operationPolicy, `${resource.resourceType}.${actionName}`).toBeDefined();
        expect(spec.operationPolicy!.risk, `${resource.resourceType}.${actionName}.risk`).toBeTruthy();
        expect(spec.operationPolicy!.retryPolicy, `${resource.resourceType}.${actionName}.retryPolicy`).toBeTruthy();
      }
    }
  });
});

describe("autonomous_work work item resources", () => {
  it("work_item is list/get only (created via Slack or agent execution)", () => {
    const resource = findResource("work_item");
    expect(resource.operations.list?.path).toBe("/adlc/api/workitems");
    expect(resource.operations.get?.path).toBe("/adlc/api/workitems/{workItemId}");
    expect(resource.operations.create).toBeUndefined();
    expect(resource.operations.update).toBeUndefined();
    expect(resource.operations.delete).toBeUndefined();
    expect(resource.identifierFields).toEqual(["work_item_id"]);
  });

  it("work_item list maps page/size to offset/limit query params", () => {
    expect(getOp("work_item", "list").queryParams).toEqual({ page: "offset", size: "limit" });
  });

  it("work_item_resume posts an empty body with medium_write risk", () => {
    const action = getExecuteAction("work_item_resume");
    expect(action.method).toBe("POST");
    expect(action.path).toBe("/adlc/api/workitems/{workItemId}/resume");
    expect(action.pathParams).toEqual({ work_item_id: "workItemId" });
    expect(action.skipScopeBodyInjection).toBe(true);
    expect(action.operationPolicy?.risk).toBe("medium_write");
    expect(action.bodyBuilder!({})).toEqual({});
    expect(action.bodySchema?.fields).toEqual([]);
  });

  it("work_item_approve forwards decision body and requires approve schema", () => {
    const action = getExecuteAction("work_item_approve");
    expect(action.path).toBe("/adlc/api/workitems/{workItemId}/approve");
    expect(action.bodyBuilder!({ body: { decision: "approve", reason: "looks good" } })).toEqual({
      decision: "approve",
      reason: "looks good",
    });
    expect(action.bodyBuilder!({})).toEqual({});
    expect(action.bodySchema?.fields.map((field) => field.name)).toEqual(["decision", "reason"]);
    expect(action.bodySchema?.fields.find((field) => field.name === "decision")?.required).toBe(true);
  });

  it("nested work phase and artifact paths use camelCase path placeholders", () => {
    expect(getOp("work_phase", "get").path).toBe("/adlc/api/workitems/{workItemId}/phases/{phaseId}");
    expect(getOp("work_phase", "get").pathParams).toEqual({
      work_item_id: "workItemId",
      phase_id: "phaseId",
    });
    expect(getOp("work_artifact", "get").path).toBe(
      "/adlc/api/workitems/{workItemId}/phases/{phaseId}/artifacts/{artifactId}",
    );
    expect(getOp("work_artifact", "get").pathParams).toEqual({
      work_item_id: "workItemId",
      phase_id: "phaseId",
      artifact_id: "artifactId",
    });
  });
});

describe("autonomous_work YAML CRUD resources", () => {
  for (const resourceType of YAML_CRUD_RESOURCES) {
    it(`${resourceType} create/update use skipScopeBodyInjection and yaml body schema`, () => {
      const create = getOp(resourceType, "create");
      const update = getOp(resourceType, "update");
      expect(create.skipScopeBodyInjection).toBe(true);
      expect(update.skipScopeBodyInjection).toBe(true);
      expect(create.bodySchema?.fields).toEqual([
        expect.objectContaining({ name: "yaml", type: "yaml", required: true }),
      ]);
      expect(update.bodySchema?.fields).toEqual([
        expect.objectContaining({ name: "yaml", type: "yaml", required: true }),
      ]);
      expect(create.bodyBuilder!({ body: { yaml: SAMPLE_WORK_CLASS_YAML } })).toEqual({
        yaml: SAMPLE_WORK_CLASS_YAML,
      });
    });
  }

  it("work_class list supports team_id filter and pagination", () => {
    const list = getOp("work_class", "list");
    expect(list.queryParams).toEqual({ team_id: "teamId", page: "offset", size: "limit" });
    expect(findResource("work_class").listFilterFields).toEqual([
      expect.objectContaining({ name: "team_id" }),
    ]);
  });
});

describe("autonomous_work execute actions", () => {
  it("budget_grant and agent_execution post empty bodies with medium_write risk", () => {
    for (const resourceType of ["budget_grant", "agent_execution"] as const) {
      const action = getExecuteAction(resourceType);
      expect(action.method).toBe("POST");
      expect(action.skipScopeBodyInjection).toBe(true);
      expect(action.operationPolicy?.risk).toBe("medium_write");
      expect(action.bodyBuilder!({})).toEqual({});
    }
    expect(getExecuteAction("budget_grant").path).toBe("/adlc/api/budgets/{budgetId}/grant");
    expect(getExecuteAction("agent_execution").path).toBe("/adlc/api/agent/executions");
  });

  it("content_source_connector set_default forwards connectors body", () => {
    const action = getExecuteAction("content_source_connector", "set_default");
    expect(action.method).toBe("PUT");
    expect(action.path).toBe("/adlc/api/content-source-connectors");
    const body = { connectors: { github: "conn-github" } };
    expect(action.bodyBuilder!({ body })).toEqual(body);
    expect(action.bodySchema?.fields.find((field) => field.name === "connectors")?.required).toBe(true);
  });
});

describe("autonomous_work registry dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("work_item list injects orgIdentifier/projectIdentifier query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ items: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_item", "list", {
      org_id: "my_org",
      project_id: "my_proj",
      page: 0,
      size: 25,
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      params: Record<string, string | number>;
    };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/adlc/api/workitems");
    expect(call.params.orgIdentifier).toBe("my_org");
    expect(call.params.projectIdentifier).toBe("my_proj");
    expect(call.params.offset).toBe(0);
    expect(call.params.limit).toBe(25);
  });

  it("work_item get substitutes workItemId in the path", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: "wi-1" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_item", "get", {
      org_id: "my_org",
      project_id: "my_proj",
      work_item_id: "wi-123",
    });

    const call = mockRequest.mock.calls[0][0] as { method: string; path: string };
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/adlc/api/workitems/wi-123");
  });

  it("work_class create posts yaml body without injecting scope into body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "bugfix" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "work_class", "create", {
      org_id: "my_org",
      project_id: "my_proj",
      body: { yaml: SAMPLE_WORK_CLASS_YAML },
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      params: Record<string, string>;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/work-classes");
    expect(call.params.orgIdentifier).toBe("my_org");
    expect(call.params.projectIdentifier).toBe("my_proj");
    expect(call.body).toEqual({ yaml: SAMPLE_WORK_CLASS_YAML });
    expect(call.body.orgIdentifier).toBeUndefined();
    expect(call.body.projectIdentifier).toBeUndefined();
  });

  it("work_item_resume execute posts to resume endpoint with empty body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "resumed" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "work_item_resume", "run", {
      org_id: "my_org",
      project_id: "my_proj",
      work_item_id: "wi-42",
    });

    const call = mockRequest.mock.calls[0][0] as {
      method: string;
      path: string;
      params: Record<string, string>;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/adlc/api/workitems/wi-42/resume");
    expect(call.params.orgIdentifier).toBe("my_org");
    expect(call.params.projectIdentifier).toBe("my_proj");
    expect(call.body).toEqual({});
    expect(call.body.orgIdentifier).toBeUndefined();
  });

  it("work_item_approve execute forwards gate decision body", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ status: "approved" });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "work_item_approve", "run", {
      org_id: "my_org",
      project_id: "my_proj",
      work_item_id: "wi-42",
      body: { decision: "reject", reason: "budget exceeded" },
    });

    const call = mockRequest.mock.calls[0][0] as { body: Record<string, unknown> };
    expect(call.body).toEqual({ decision: "reject", reason: "budget exceeded" });
    expect(call.body.orgIdentifier).toBeUndefined();
  });
});
