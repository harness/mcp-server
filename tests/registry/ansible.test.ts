import { describe, it, expect, vi } from "vitest";
import { ansibleToolset } from "../../src/registry/toolsets/ansible.js";
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
    HARNESS_PROJECT: "stephenAnsible",
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
    request: requestFn ?? vi.fn().mockResolvedValue([]),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = ansibleToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found in ansibleToolset`);
  return res;
}

function getOp(type: string, op: "list" | "get"): EndpointSpec {
  const res = findResource(type);
  const spec = res.operations[op];
  if (!spec) throw new Error(`Operation "${op}" not found on "${type}"`);
  return spec;
}

// ─── Toolset structure ────────────────────────────────────────────────────────

describe("ansibleToolset structure", () => {
  it("has name 'ansible'", () => {
    expect(ansibleToolset.name).toBe("ansible");
  });

  it("is opt-in (not loaded by default)", () => {
    expect(ansibleToolset.optIn).toBe(true);
  });

  it("registers all 5 resource types", () => {
    const types = ansibleToolset.resources.map((r) => r.resourceType);
    expect(types).toContain("ansible_inventory");
    expect(types).toContain("ansible_playbook");
    expect(types).toContain("ansible_host");
    expect(types).toContain("ansible_activity");
    expect(types).toContain("ansible_host_activity");
    expect(types).toHaveLength(5);
  });

  it("all resources are project-scoped", () => {
    for (const resource of ansibleToolset.resources) {
      expect(resource.scope, `${resource.resourceType} should be project-scoped`).toBe("project");
    }
  });

  it("all endpoint specs have operationPolicy with risk=read", () => {
    for (const resource of ansibleToolset.resources) {
      for (const [opName, spec] of Object.entries(resource.operations)) {
        expect(
          spec.operationPolicy,
          `${resource.resourceType}.${opName} is missing operationPolicy`,
        ).toBeDefined();
        expect(
          spec.operationPolicy!.risk,
          `${resource.resourceType}.${opName} should be read risk`,
        ).toBe("read");
      }
    }
  });

  it("all list operations have skipCompact=true", () => {
    for (const resource of ansibleToolset.resources) {
      const listSpec = resource.operations["list"];
      if (listSpec) {
        expect(
          listSpec.skipCompact,
          `${resource.resourceType}.list should have skipCompact=true`,
        ).toBe(true);
      }
    }
  });

  it("all list operations have pageOneIndexed=true", () => {
    for (const resource of ansibleToolset.resources) {
      const listSpec = resource.operations["list"];
      if (listSpec) {
        expect(
          listSpec.pageOneIndexed,
          `${resource.resourceType}.list should have pageOneIndexed=true`,
        ).toBe(true);
      }
    }
  });

  it("ansible_inventory and ansible_playbook are read-only (no create/update/delete)", () => {
    for (const type of ["ansible_inventory", "ansible_playbook"]) {
      const res = findResource(type);
      expect(res.operations["create"], `${type} should not have create`).toBeUndefined();
      expect(res.operations["update"], `${type} should not have update`).toBeUndefined();
      expect(res.operations["delete"], `${type} should not have delete`).toBeUndefined();
    }
  });

  it("ansible_host and ansible_activity are read-only (no write operations)", () => {
    for (const type of ["ansible_host", "ansible_activity", "ansible_host_activity"]) {
      const res = findResource(type);
      expect(res.operations["create"], `${type} should not have create`).toBeUndefined();
      expect(res.operations["update"], `${type} should not have update`).toBeUndefined();
      expect(res.operations["delete"], `${type} should not have delete`).toBeUndefined();
    }
  });
});

// ─── Registry opt-in behaviour ────────────────────────────────────────────────

describe("ansible opt-in with Registry", () => {
  it("is NOT present when HARNESS_TOOLSETS is unset (all defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: undefined }));
    expect(registry.getAllResourceTypes()).not.toContain("ansible_inventory");
    expect(registry.getAllResourceTypes()).not.toContain("ansible_playbook");
  });

  it("IS present when explicitly enabled with HARNESS_TOOLSETS=ansible", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible" }));
    const types = registry.getAllResourceTypes();
    expect(types).toContain("ansible_inventory");
    expect(types).toContain("ansible_playbook");
    expect(types).toContain("ansible_host");
    expect(types).toContain("ansible_activity");
    expect(types).toContain("ansible_host_activity");
  });

  it("IS present when enabled with +ansible modifier", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+ansible" }));
    expect(registry.getAllResourceTypes()).toContain("ansible_inventory");
  });

  it("can be combined with other toolsets (+ansible alongside defaults)", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "+ansible" }));
    const types = registry.getAllResourceTypes();
    expect(types).toContain("ansible_inventory");
    expect(types).toContain("pipeline"); // default toolset still present
  });
});

// ─── requireProjectScope preflight ───────────────────────────────────────────

describe("requireProjectScope preflight", () => {
  const preflight = getOp("ansible_inventory", "list").preflight!;

  it("passes when both org_id and project_id are provided in input", async () => {
    const ctx: PreflightContext = {
      input: { org_id: "default", project_id: "stephenAnsible" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible" })),
    };
    await expect(preflight(ctx)).resolves.toBeUndefined();
  });

  it("passes when org_id and project_id come from config defaults", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible", HARNESS_ORG: "default", HARNESS_PROJECT: "stephenAnsible" })),
    };
    await expect(preflight(ctx)).resolves.toBeUndefined();
  });

  it("throws when org_id is missing from both input and config", async () => {
    const ctx: PreflightContext = {
      input: { project_id: "stephenAnsible" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible", HARNESS_ORG: "" })),
    };
    await expect(preflight(ctx)).rejects.toThrow("org_id");
  });

  it("throws when project_id is missing from both input and config", async () => {
    const ctx: PreflightContext = {
      input: { org_id: "default" },
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("project_id");
  });

  it("throws when both are missing", async () => {
    const ctx: PreflightContext = {
      input: {},
      client: makeClient(),
      registry: new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible", HARNESS_ORG: "", HARNESS_PROJECT: undefined })),
    };
    await expect(preflight(ctx)).rejects.toThrow("org_id");
    await expect(preflight(ctx)).rejects.toThrow("project_id");
  });

  it("preflight is present on all list operations", () => {
    for (const type of ["ansible_inventory", "ansible_playbook", "ansible_host", "ansible_activity"]) {
      const spec = getOp(type, "list");
      expect(spec.preflight, `${type}.list is missing preflight`).toBeDefined();
    }
  });
});

// ─── ansibleListExtract ───────────────────────────────────────────────────────

describe("ansibleListExtract", () => {
  function extract(raw: unknown, input?: Record<string, unknown>) {
    return getOp("ansible_inventory", "list").responseExtractor!(raw, input) as Record<string, unknown>;
  }

  it("wraps array into { items, page_count, has_more, pagination_note }", () => {
    const items = [{ identifier: "inv1" }, { identifier: "inv2" }];
    const result = extract(items);
    expect(result.items).toEqual(items);
    expect(result.page_count).toBe(2);
    expect(result.has_more).toBe(false);
    expect(typeof result.pagination_note).toBe("string");
  });

  it("does not set a total field (avoids fake total)", () => {
    const result = extract([{ identifier: "inv1" }]);
    expect(result.total).toBeUndefined();
  });

  it("has_more=true when items.length >= requested size", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ identifier: `inv${i}` }));
    const result = extract(items, { size: 20 });
    expect(result.has_more).toBe(true);
  });

  it("has_more=false when items.length < requested size", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ identifier: `inv${i}` }));
    const result = extract(items, { size: 20 });
    expect(result.has_more).toBe(false);
  });

  it("has_more=false when size=100 and only 22 items returned", () => {
    const items = Array.from({ length: 22 }, (_, i) => ({ identifier: `inv${i}` }));
    const result = extract(items, { size: 100 });
    expect(result.has_more).toBe(false);
  });

  it("uses default page size (20) when input has no size", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ identifier: `inv${i}` }));
    const result = extract(items);
    expect(result.has_more).toBe(true);
  });

  it("throws on non-array payload (fail loudly)", () => {
    expect(() => extract(null)).toThrow("expected a JSON array");
    expect(() => extract({ items: [] })).toThrow("expected a JSON array");
    expect(() => extract("string")).toThrow("expected a JSON array");
  });

  it("pagination_note warns about page count on full page", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ identifier: `inv${i}` }));
    const result = extract(items, { size: 20 });
    expect(result.pagination_note as string).toContain("page+1");
    expect(result.pagination_note as string).toContain("Do NOT report");
  });

  it("pagination_note confirms last page when has_more=false", () => {
    const result = extract([{ identifier: "inv1" }], { size: 20 });
    expect(result.pagination_note as string).toContain("last page");
  });

  it("same extractor is used by all list operations", () => {
    for (const type of ["ansible_inventory", "ansible_playbook", "ansible_host", "ansible_activity", "ansible_host_activity"]) {
      const spec = getOp(type, "list");
      expect(spec.responseExtractor, `${type}.list is missing responseExtractor`).toBeDefined();
    }
  });
});

// ─── Endpoint paths ───────────────────────────────────────────────────────────

describe("endpoint paths", () => {
  it("ansible_inventory list path", () => {
    expect(getOp("ansible_inventory", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/ansible/inventory",
    );
  });

  it("ansible_inventory get path", () => {
    expect(getOp("ansible_inventory", "get").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/ansible/inventory/{inventoryId}",
    );
  });

  it("ansible_playbook list path", () => {
    expect(getOp("ansible_playbook", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/ansible/playbook",
    );
  });

  it("ansible_host list path uses /hosts (plural)", () => {
    expect(getOp("ansible_host", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/ansible/hosts",
    );
  });

  it("ansible_activity list path", () => {
    expect(getOp("ansible_activity", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/ansible/activities",
    );
  });

  it("ansible_host_activity list path includes hostId", () => {
    expect(getOp("ansible_host_activity", "list").path).toBe(
      "/iacm/api/orgs/{org}/projects/{project}/ansible/hosts/{hostId}/activities",
    );
  });
});

// ─── Registry dispatch integration ───────────────────────────────────────────

describe("ansible registry dispatch", () => {
  it("dispatches ansible_inventory list with org/project path params", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible" }));

    await registry.dispatch(makeClient(mockRequest), "ansible_inventory", "list", {
      org_id: "default",
      project_id: "stephenAnsible",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/iacm/api/orgs/default/projects/stephenAnsible/ansible/inventory");
  });

  it("dispatches ansible_playbook get with identifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "GoldenPlaybook" });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible" }));

    await registry.dispatch(makeClient(mockRequest), "ansible_playbook", "get", {
      org_id: "default",
      project_id: "stephenAnsible",
      playbook_id: "GoldenPlaybook",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/iacm/api/orgs/default/projects/stephenAnsible/ansible/playbook/GoldenPlaybook");
  });

  it("dispatches ansible_host_activity list with hostId in path", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "ansible" }));

    await registry.dispatch(makeClient(mockRequest), "ansible_host_activity", "list", {
      org_id: "default",
      project_id: "stephenAnsible",
      host_id: "abc-123",
    });

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/iacm/api/orgs/default/projects/stephenAnsible/ansible/hosts/abc-123/activities");
  });

  it("falls back to config org/project when not in input", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({
      HARNESS_TOOLSETS: "ansible",
      HARNESS_ORG: "default",
      HARNESS_PROJECT: "stephenAnsible",
    }));

    await registry.dispatch(makeClient(mockRequest), "ansible_inventory", "list", {});

    const request = mockRequest.mock.calls[0]![0] as { path: string };
    expect(request.path).toBe("/iacm/api/orgs/default/projects/stephenAnsible/ansible/inventory");
  });
});
