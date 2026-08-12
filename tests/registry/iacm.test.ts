import { describe, it, expect, vi } from "vitest";
import { iacmToolset } from "../../src/registry/toolsets/iacm.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ResourceDefinition, EndpointSpec, PreflightContext } from "../../src/registry/types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "Testim",
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
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
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
  const res = iacmToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in iacmToolset`);
  return res;
}

function getOp(type: string, op: "list" | "get" | "create" | "update"): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

// ─── Toolset structure ───────────────────────────────────────────────────────

describe("iacmToolset structure", () => {
  it("has name 'iacm'", () => {
    expect(iacmToolset.name).toBe("iacm");
  });

  it("is loaded by default (not opt-in)", () => {
    expect(iacmToolset.optIn).toBe(false);
  });

  it("registers all 5 resource types", () => {
    const types = iacmToolset.resources.map((r) => r.resourceType);
    expect(types).toContain("iacm_workspace");
    expect(types).toContain("iacm_resource");
    expect(types).toContain("iacm_module");
    expect(types).toContain("iacm_workspace_costs");
    expect(types).toContain("iacm_activity_resource_change");
    expect(types).toHaveLength(5);
  });

  it("iacm_module is account-scoped", () => {
    expect(findResource("iacm_module").scope).toBe("account");
  });

  it("iacm_module list has pageOneIndexed=true", () => {
    expect(getOp("iacm_module", "list").pageOneIndexed).toBe(true);
  });

  it("iacm_workspace, iacm_resource, iacm_workspace_costs, iacm_activity_resource_change are project-scoped", () => {
    for (const type of ["iacm_workspace", "iacm_resource", "iacm_workspace_costs", "iacm_activity_resource_change"]) {
      expect(findResource(type).scope).toBe("project");
    }
  });

  it("all endpoint specs have operationPolicy", () => {
    for (const resource of iacmToolset.resources) {
      for (const [opName, spec] of Object.entries(resource.operations)) {
        expect(
          spec.operationPolicy,
          `${resource.resourceType}.${opName} is missing operationPolicy`,
        ).toBeDefined();
        expect(spec.operationPolicy!.risk).toBe(
          opName === "create" || opName === "update" ? "medium_write" : "read",
        );
      }
    }
  });
});

// ─── Workspace write contract ───────────────────────────────────────────────

describe("iacm_workspace write contract", () => {
  it("registers project-scoped create and update operations", () => {
    const create = getOp("iacm_workspace", "create");
    const update = getOp("iacm_workspace", "update");
    const list = getOp("iacm_workspace", "list");

    expect(create.method).toBe("POST");
    expect(create.path).toBe("/iacm/api/orgs/{org}/projects/{project}/workspaces");
    expect(create.pathParams).toEqual({ org_id: "org", project_id: "project" });
    expect(create.preflight).toBeDefined();
    expect(create.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });

    expect(update.method).toBe("PUT");
    expect(update.path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/workspaces/{workspaceId}",
    );
    expect(update.pathParams).toEqual({
      org_id: "org",
      project_id: "project",
      workspace_id: "workspaceId",
    });
    expect(update.preflight).toBeDefined();
    expect(update.operationPolicy).toEqual({
      risk: "medium_write",
      retryPolicy: "do_not_retry",
    });
    expect(create.description).toContain("policy_evaluation");
    expect(create.description).toContain("harness_get");
    expect(update.description).toContain("policy_evaluation");
    expect(update.description).toContain("harness_get");
    // Create/update share the same project-scope preflight as list.
    expect(create.preflight).toBe(list.preflight);
    expect(update.preflight).toBe(list.preflight);
  });

  it("create/update use skipScopeBodyInjection and identity bodyBuilder", () => {
    for (const op of ["create", "update"] as const) {
      const spec = getOp("iacm_workspace", op);
      expect(spec.skipScopeBodyInjection).toBe(true);
      expect(spec.bodyBuilder).toBeDefined();
      expect(spec.bodyBuilder!({ body: { name: "x", provisioner: "terraform" } })).toEqual({
        name: "x",
        provisioner: "terraform",
      });
    }
  });

  it("documents the API-required create body and optional template association", () => {
    const create = getOp("iacm_workspace", "create");
    const fields = create.bodySchema!.fields;
    const required = fields.filter((field) => field.required).map((field) => field.name);

    expect(create.bodySchema!.description).toMatch(/workspace definition|associated_template/i);
    expect(required).toEqual([
      "identifier",
      "name",
      "provider_connector",
      "provisioner",
      "terraform_variables",
      "environment_variables",
    ]);
    expect(fields.find((field) => field.name === "associated_template")).toMatchObject({
      type: "object",
      required: false,
      fields: [
        expect.objectContaining({ name: "template_id", required: true }),
        expect.objectContaining({ name: "version", required: true }),
      ],
    });
    expect(fields.find((field) => field.name === "provisioner_configuration")).toMatchObject({
      type: "object",
      required: false,
      description: expect.stringMatching(/map\[string\]string|string-to-string map/i),
    });
    expect(fields.find((field) => field.name === "sparse_checkout")).toMatchObject({
      type: "array",
      itemType: "string",
      required: false,
      description: expect.stringMatching(/string array|string\[\]/i),
    });
    expect(fields.find((field) => field.name === "terraform_variables")).toMatchObject({
      type: "object",
      required: true,
      fields: [
        expect.objectContaining({ name: "key", required: true }),
        expect.objectContaining({ name: "value", required: true }),
        expect.objectContaining({ name: "value_type", required: true }),
      ],
    });
  });

  it("documents the API-required update body", () => {
    const update = getOp("iacm_workspace", "update");
    const fields = update.bodySchema!.fields;
    const required = fields.filter((field) => field.required).map((field) => field.name);

    expect(update.bodySchema!.description).toMatch(/full workspace body|not a partial patch/i);
    expect(required).toEqual([
      "name",
      "provider_connector",
      "provisioner",
      "terraform_variables",
      "environment_variables",
    ]);
    expect(fields.some((field) => field.name === "identifier")).toBe(false);
  });
});

// ─── Response extractor: workspaceWriteExtract ───────────────────────────────

describe("workspaceWriteExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_workspace", "create").responseExtractor!(raw);
  }

  it.each([
    [null, {}],
    [undefined, {}],
    ["string", {}],
    [42, {}],
    [[], {}],
    [{ policy_evaluation: { status: "success" } }, { policy_evaluation: { status: "success" } }],
    [{ policy_evaluation: null, workspace: { id: "x" } }, { policy_evaluation: null }],
    [{}, { policy_evaluation: null }],
    [
      { policy_evaluation: { status: "failed" }, id: "ws-1", identifier: "ws-1" },
      { policy_evaluation: { status: "failed" } },
    ],
  ])("projects create/update response %j", (raw, expected) => {
    expect(extract(raw)).toEqual(expected);
  });

  it("update uses the same extractor as create", () => {
    expect(getOp("iacm_workspace", "update").responseExtractor).toBe(
      getOp("iacm_workspace", "create").responseExtractor,
    );
  });
});

// ─── Registry default-on behaviour ───────────────────────────────────────────

describe("iacm default-on with Registry", () => {
  it("IS present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace");
  });

  it("IS present when explicitly enabled with HARNESS_TOOLSETS=iacm", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace");
    expect(registry.getAllResourceTypes()).toContain("iacm_resource");
    expect(registry.getAllResourceTypes()).toContain("iacm_module");
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace_costs");
    expect(registry.getAllResourceTypes()).toContain("iacm_activity_resource_change");
  });

  it("IS present when enabled with +iacm modifier", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+iacm" }));
    expect(registry.getAllResourceTypes()).toContain("iacm_workspace");
  });
});

// ─── requireProjectScope preflight ───────────────────────────────────────────

describe("requireProjectScope preflight", () => {
  const preflight = getOp("iacm_workspace", "list").preflight!;

  it("passes when both org_id and project_id are provided in input", async () => {
    const ctx: PreflightContext = {
      input: { org_id: "default", project_id: "Testim" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" })),
    };
    await expect(preflight(ctx)).resolves.toBeUndefined();
  });

  it("passes when org_id and project_id come from config defaults (input omits them)", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "default", HARNESS_PROJECT: "Testim" })),
    };
    await expect(preflight(ctx)).resolves.toBeUndefined();
  });

  it("throws when org_id is missing from both input and config", async () => {
    const ctx: PreflightContext = {
      input: { project_id: "Testim" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "" })),
    };
    await expect(preflight(ctx)).rejects.toThrow("org_id");
  });

  it("throws when project_id is missing from both input and config", async () => {
    const ctx: PreflightContext = {
      input: { org_id: "default" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("project_id");
  });

  it("throws when both org_id and project_id are missing from input and config", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("org_id");
    await expect(preflight(ctx)).rejects.toThrow("project_id");
  });

  it("error message mentions IaCM and explicit scope requirement", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("IaCM");
  });

  it("is present on all project-scoped list operations", () => {
    for (const type of ["iacm_workspace", "iacm_resource", "iacm_workspace_costs", "iacm_activity_resource_change"]) {
      const spec = getOp(type, "list");
      expect(spec.preflight, `${type}.list is missing preflight`).toBeDefined();
    }
  });

  it("is present on iacm_workspace create and update", () => {
    expect(getOp("iacm_workspace", "create").preflight).toBe(preflight);
    expect(getOp("iacm_workspace", "update").preflight).toBe(preflight);
  });

  it("is NOT present on account-scoped iacm_module list", () => {
    expect(getOp("iacm_module", "list").preflight).toBeUndefined();
  });
});

// ─── Response extractor: workspaceListExtract ─────────────────────────────────

describe("workspaceListExtract (via registry dispatch)", () => {
  function extract(raw: unknown) {
    return getOp("iacm_workspace", "list").responseExtractor!(raw);
  }

  it("wraps array into { items, page_count, has_more }", () => {
    const items = [{ identifier: "ws1" }, { identifier: "ws2" }];
    const result = extract(items) as Record<string, unknown>;
    expect(result.items).toEqual(items);
    expect(result.page_count).toBe(2);
    expect(result.has_more).toBe(false);
  });

  it("has_more=true when page is full (30 items)", () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ identifier: `ws${i}` }));
    const result = extract(items) as Record<string, unknown>;
    expect(result.has_more).toBe(true);
  });

  it("handles non-array gracefully", () => {
    const result = extract(null) as Record<string, unknown>;
    expect(result.items).toEqual([]);
    expect(result.page_count).toBe(0);
    expect(result.has_more).toBe(false);
  });
});

// ─── Response extractor: iacmResourcesExtract ────────────────────────────────

describe("iacmResourcesExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_resource", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("extracts resources, outputs, data_sources sections", () => {
    const raw = {
      resources: [{ name: "aws_instance.main" }],
      outputs: [{ name: "vpc_id", value: "vpc-123" }],
      data_sources: [],
      hasMore: false,
      totalItems: 1,
    };
    const result = extract(raw);
    expect(result.items).toEqual(raw.resources);
    expect((result.resources as unknown[]).length).toBe(1);
    expect((result.outputs as unknown[]).length).toBe(1);
    expect(result.total_items).toBe(1);
    expect(result.has_more).toBe(false);
  });

  it("total_items defaults to -1 when absent", () => {
    const result = extract({ resources: [] });
    expect(result.items).toEqual([]);
    expect(result.total_items).toBe(-1);
  });

  it("returns empty items when the API response has no state sections", () => {
    const result = extract({});
    expect(result.items).toEqual([]);
    expect(result.resources).toEqual([]);
    expect(result.outputs).toEqual([]);
    expect(result.data_sources).toEqual([]);
    expect(result.page_count).toBe(0);
    expect(result.has_more).toBe(false);
  });

  it("has_more reflects hasMore from API", () => {
    const result = extract({ resources: Array(30).fill({}), hasMore: true });
    expect(result.has_more).toBe(true);
  });
});

// ─── Response extractor: moduleListExtract ───────────────────────────────────

describe("moduleListExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_module", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("wraps module array correctly", () => {
    const modules = [{ name: "vpc" }, { name: "ecs" }];
    const result = extract(modules);
    expect(result.items).toEqual(modules);
    expect(result.page_count).toBe(2);
    expect(result.has_more).toBe(false);
  });

  it("has_more=true for full page", () => {
    const result = extract(Array(30).fill({ name: "mod" }));
    expect(result.has_more).toBe(true);
  });
});

// ─── Response extractor: costsListExtract ────────────────────────────────────

describe("costsListExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_workspace_costs", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("wraps costs array correctly", () => {
    const costs = [{ amount: 1.23, currency: "USD" }];
    const result = extract(costs);
    expect(result.items).toEqual(costs);
    expect(result.page_count).toBe(1);
    expect(result.has_more).toBe(false);
  });
});

// ─── Response extractor: activityChangesExtract ──────────────────────────────

describe("activityChangesExtract", () => {
  function extract(raw: unknown) {
    return getOp("iacm_activity_resource_change", "list").responseExtractor!(raw) as Record<string, unknown>;
  }

  it("passes through documented execution resource-change sections", () => {
    const raw = {
      pipeline_execution: "exec-123",
      workspace_id: "ws-abc",
      resources: [{ name: "aws_instance.main" }],
      planned_changes: [{ name: "aws_instance.main", change: "changed" }],
      drift_changes: [],
      outputs: [],
      data_sources: [],
    };
    const result = extract(raw);
    expect(result.pipeline_execution).toBe("exec-123");
    expect(result.workspace_id).toBe("ws-abc");
    expect(result.resources).toEqual([{ name: "aws_instance.main" }]);
    expect(result.planned_changes).toEqual([{ name: "aws_instance.main", change: "changed" }]);
  });

  it("adds resource_changes alias from planned_changes when absent", () => {
    const result = extract({ planned_changes: [{ name: "aws_instance.main" }] });
    expect(result.resource_changes).toEqual([{ name: "aws_instance.main" }]);
  });
});

// ─── API paths ───────────────────────────────────────────────────────────────

describe("endpoint paths", () => {
  it("iacm_workspace list uses /iacm/api/orgs/{org}/projects/{project}/workspaces", () => {
    expect(getOp("iacm_workspace", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/workspaces",
    );
  });

  it("iacm_resource list uses /workspaces/{workspaceId}/resources", () => {
    expect(getOp("iacm_resource", "list").path).toContain("/resources");
  });

  it("iacm_module list uses /iacm/api/modules (account-scoped, no org/project)", () => {
    expect(getOp("iacm_module", "list").path).toBe("/iacm/api/modules");
    expect(getOp("iacm_module", "list").pathParams).toBeUndefined();
  });

  it("iacm_module get uses /iacm/api/modules/{moduleId}", () => {
    expect(getOp("iacm_module", "get").path).toBe("/iacm/api/modules/{moduleId}");
  });

  it("iacm_activity_resource_change list uses the activity resource-changes endpoint", () => {
    expect(getOp("iacm_activity_resource_change", "list").path).toContain(
      "/activities/{activityId}/resource-changes",
    );
  });
});

// ─── Registry dispatch integration ───────────────────────────────────────────

describe("iacm registry dispatch", () => {
  const workspaceBody = {
    identifier: "payments-prod",
    name: "Payments Production",
    provider_connector: "account.aws",
    provisioner: "terraform",
    terraform_variables: {},
    environment_variables: {},
  };

  it("dispatches workspace create with the IaCM body unchanged", async () => {
    const response = {
      policy_evaluation: { status: "success" },
      extra_server_field: "should-be-dropped",
    };
    const mockRequest = vi.fn().mockResolvedValue(response);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    const result = await registry.dispatch(makeClient(mockRequest), "iacm_workspace", "create", {
      org_id: "default",
      project_id: "Testim",
      body: workspaceBody,
    });

    const request = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/iacm/api/orgs/default/projects/Testim/workspaces");
    expect(request.body).toEqual(workspaceBody);
    expect(result).toEqual({ policy_evaluation: { status: "success" } });
  });

  it("dispatches workspace update by workspace identifier", async () => {
    const response = {
      policy_evaluation: { status: "success" },
      extra_server_field: "should-be-dropped",
    };
    const mockRequest = vi.fn().mockResolvedValue(response);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));
    const updateBody = { ...workspaceBody };
    delete (updateBody as Partial<typeof workspaceBody>).identifier;

    const result = await registry.dispatch(makeClient(mockRequest), "iacm_workspace", "update", {
      org_id: "default",
      project_id: "Testim",
      workspace_id: "payments-prod",
      body: updateBody,
    });

    const request = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(request.method).toBe("PUT");
    expect(request.path).toBe(
      "/iacm/api/orgs/default/projects/Testim/workspaces/payments-prod",
    );
    expect(request.body).toEqual(updateBody);
    expect(result).toEqual({ policy_evaluation: { status: "success" } });
  });

  it("rejects workspace create when an API-required field is missing", async () => {
    const mockRequest = vi.fn();
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));
    const invalidBody = { ...workspaceBody };
    delete (invalidBody as Partial<typeof workspaceBody>).provider_connector;

    await expect(
      registry.dispatch(makeClient(mockRequest), "iacm_workspace", "create", {
        org_id: "default",
        project_id: "Testim",
        body: invalidBody,
      }),
    ).rejects.toThrow("provider_connector");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("rejects workspace update when an API-required field is missing", async () => {
    const mockRequest = vi.fn();
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));
    const invalidBody = { ...workspaceBody };
    delete (invalidBody as Partial<typeof workspaceBody>).identifier;
    delete (invalidBody as Partial<typeof workspaceBody>).name;

    await expect(
      registry.dispatch(makeClient(mockRequest), "iacm_workspace", "update", {
        org_id: "default",
        project_id: "Testim",
        workspace_id: "payments-prod",
        body: invalidBody,
      }),
    ).rejects.toThrow("name");
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("dispatches template-based workspace create with associated_template", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      policy_evaluation: { status: "success" },
    });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));
    const templateBody = {
      ...workspaceBody,
      associated_template: { template_id: "ws-template", version: "1" },
    };

    const result = await registry.dispatch(makeClient(mockRequest), "iacm_workspace", "create", {
      org_id: "default",
      project_id: "Testim",
      body: templateBody,
    });

    const request = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/iacm/api/orgs/default/projects/Testim/workspaces");
    expect(request.body).toEqual(templateBody);
    expect(request.body).not.toHaveProperty("orgIdentifier");
    expect(request.body).not.toHaveProperty("projectIdentifier");
    expect(result).toEqual({ policy_evaluation: { status: "success" } });
  });

  it("blocks workspace create when project scope is missing", async () => {
    const mockRequest = vi.fn();
    const registry = new Registry(
      makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "", HARNESS_PROJECT: undefined }),
    );

    await expect(
      registry.dispatch(makeClient(mockRequest), "iacm_workspace", "create", {
        body: workspaceBody,
      }),
    ).rejects.toThrow(/org_id|project_id|IaCM/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("blocks workspace update when project scope is missing", async () => {
    const mockRequest = vi.fn();
    const registry = new Registry(
      makeConfig({ HARNESS_TOOLSETS: "iacm", HARNESS_ORG: "", HARNESS_PROJECT: undefined }),
    );
    const updateBody = { ...workspaceBody };
    delete (updateBody as Partial<typeof workspaceBody>).identifier;

    await expect(
      registry.dispatch(makeClient(mockRequest), "iacm_workspace", "update", {
        workspace_id: "payments-prod",
        body: updateBody,
      }),
    ).rejects.toThrow(/org_id|project_id|IaCM/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("does not inject org/project identifiers into workspace write bodies", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ policy_evaluation: { status: "success" } });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_workspace", "create", {
      org_id: "default",
      project_id: "Testim",
      body: workspaceBody,
    });

    const request = mockRequest.mock.calls[0]![0] as { body: Record<string, unknown> };
    expect(request.body).toEqual(workspaceBody);
    expect(request.body).not.toHaveProperty("orgIdentifier");
    expect(request.body).not.toHaveProperty("projectIdentifier");
    expect(request.body).not.toHaveProperty("accountIdentifier");
  });

  it("dispatches iacm_module get using the numeric id from harness_get resource_id mapping", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ id: 4640, name: "vpc" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_module", "get", { id: "4640" });

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/iacm/api/modules/4640");
  });

  it("iacm_module list converts harness_list page 0 to API page 1", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_module", "list", {
      page: 0,
      size: 20,
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(request.path).toBe("/iacm/api/modules");
    expect(request.params.page).toBe(1);
    expect(request.params.size).toBe(20);
  });

  it("iacm_module list converts harness_list page 1 to API page 2", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_module", "list", {
      page: 1,
      size: 20,
    });

    const request = mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> };
    expect(request.params.page).toBe(2);
  });

  it("dispatches activity resource changes by activity id", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ planned_changes: [] });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "iacm" }));

    await registry.dispatch(makeClient(mockRequest), "iacm_activity_resource_change", "list", {
      org_id: "default",
      project_id: "Testim",
      activity_id: "exec-123",
      workspace_id: "ws-1",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string; params: Record<string, unknown> };
    expect(request.path).toBe("/iacm/api/orgs/default/projects/Testim/activities/exec-123/resource-changes");
    expect(request.params.workspace).toBe("ws-1");
  });
});
