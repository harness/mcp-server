import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import type { Config } from "../../src/config.js";
import { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec } from "../../src/registry/types.js";
import { ALL_TOOLSET_NAMES, Registry } from "../../src/registry/index.js";
import { encodePathSegment } from "../../src/utils/path.js";

const config = {
  HARNESS_API_KEY: "pat.test.abc.xyz",
  HARNESS_ACCOUNT_ID: "account",
  HARNESS_BASE_URL: "https://app.harness.io",
  HARNESS_ORG: "org",
  HARNESS_PROJECT: "project",
  HARNESS_TOOLSETS: ALL_TOOLSET_NAMES.map((name) => `+${name}`).join(","),
  HARNESS_READ_ONLY: false,
} as Config;
const registry = new Registry(config);
const attack = "id/child?accountIdentifier=other#fragment\\\u0000\nend";

function builtPath(spec: EndpointSpec, input: Record<string, unknown>): string {
  if (spec.routeResolver) return spec.routeResolver(input, config).path;
  if (spec.pathBuilder) return spec.pathBuilder(input, config);
  throw new Error("Expected a custom route");
}

function clientWith(response: unknown = {}) {
  const request = vi.fn().mockResolvedValue(response);
  return { request, client: { request } as unknown as HarnessClient };
}

describe("shared path segment encoding", () => {
  it.each([".", ".."])('rejects URL-normalized segment "%s"', (value) => {
    expect(() => encodePathSegment(value)).toThrow(/Path segment/);
  });

  it.each([attack, "%2e", ".%2E", "%2e%2e", "release..stable", "日本語", ""])('encodes literal input %j once', (value) => {
    expect(encodePathSegment(value)).toBe(encodeURIComponent(value));
  });

  it("prevents normalization through generic path substitution before any request", async () => {
    for (const value of [".", ".."]) {
      const { client, request } = clientWith();
      await expect(registry.dispatch(client, "cost_budget", "get", { budget_id: value }))
        .rejects.toThrow(/Path segment/);
      expect(request).not.toHaveBeenCalled();
    }
  });

  it("encodes delimiters through generic substitution", async () => {
    const { client, request } = clientWith();
    await registry.dispatch(client, "cost_budget", "get", { budget_id: attack });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      path: `/ccm/api/budgets/${encodeURIComponent(attack)}`,
    }));
  });
});

// Exercise the actual registered builder/resolver, including the dot-only hole
// left by plain encodeURIComponent. Keep one row per independently-built segment.
const customRoutes: Array<[string, string, string, Record<string, unknown>]> = [
  ["registry", "list", "org_id", {}],
  ["registry", "list", "project_id", {}],
  ["registry", "get", "registry_id", {}],
  ["registry", "update", "registry_id", {}],
  ["artifact", "list", "registry_id", {}],
  ["artifact_version", "list", "artifact_id", { registry_id: "reg" }],
  ["artifact_file", "list", "artifact_id", { registry_id: "reg", version: "v1" }],
  ["artifact_file", "list", "version", { registry_id: "reg", artifact_id: "pkg" }],
  ["quarantine", "update", "registry_id", {}],
  ["quarantine", "delete", "registry_id", {}],
  ["ai_budget", "get", "budget_id", {}],
  ["ai_budget", "update", "budget_id", {}],
  ["ai_budget", "delete", "budget_id", {}],
  ["ai_budget_overview", "get", "budget_id", {}],
  ["ai_budget_override_request", "list", "budget_id", {}],
  ["ai_budget_override_request", "get", "budget_id", { override_request_id: "request" }],
  ["ai_budget_override_request", "get", "override_request_id", { budget_id: "budget" }],
  ["ai_budget_override_request", "approve", "budget_id", {}],
  ["ai_budget_override_request", "reject", "budget_id", {}],
  ["cost_commitment", "get", "cloud_account_id", { aspect: "estimated_savings" }],
  ["cost_commitment", "get", "account_id", {}],
  ["scs_component_enrichment", "get", "org_id", { artifact_id: "artifact" }],
  ["scs_component_enrichment", "get", "project_id", { artifact_id: "artifact" }],
  ["scs_component_enrichment", "get", "artifact_id", {}],
  ["scs_component_vulnerability", "list", "artifact_id", {}],
  ["scs_component_vulnerability", "list", "org_id", { artifact_id: "artifact" }],
  ["scs_component_vulnerability", "list", "project_id", { artifact_id: "artifact" }],
  ["idp_entity", "get", "entity_id", { kind: "component" }],
  ["security_exemption", "approve", "exemption_id", {}],
  ["iacm_variable_set", "get", "variable_set_id", {}],
  ["eval_dataset", "get", "dataset_id", {}],
  ["eval_dataset", "list", "org_id", {}],
  ["observability_eval", "list", "org_id", {}],
  ["template", "delete", "template_id", {}],
  ["template_v1", "get", "template_id", {}],
  ["template_v1", "get", "org_id", { template_id: "template", project_id: "project" }],
  ["sei_team_detail", "list", "team_ref_id", {}],
  ["sei_org_tree_detail", "get", "org_tree_id", {}],
  ["fme_environment", "get", "environment_id", { org_id: "org", project_id: "project" }],
  ["gitops_app_project_mapping", "delete", "argoproject", { agent_id: "agent", org_id: "org", project_id: "project" }],
  ["pull_request", "update", "pr_number", { repo_id: "repo" }],
  ["release_execution_phase_output", "get", "release_id", { phase_identifier: "phase" }],
  ["release_execution_phase_input", "get", "phase_identifier", { release_id: "release" }],
  ["release_execution_activity_output", "get", "activity_identifier", { release_id: "release", phase_identifier: "phase" }],
];

describe.each(customRoutes)("%s.%s segment %s", (resource, operation, field, defaults) => {
  function spec(): EndpointSpec {
    const def = registry.getResource(resource);
    const endpoint = def.operations[operation as keyof typeof def.operations] ?? def.executeActions?.[operation];
    expect(endpoint).toBeDefined();
    return endpoint!;
  }

  it("encodes tool argument delimiters as data", () => {
    const path = builtPath(spec(), { ...defaults, [field]: attack });
    expect(path).toContain(encodeURIComponent(attack));
    expect(path).not.toMatch(/[?#\\\u0000-\u001f]/);
    expect(new URL(path, config.HARNESS_BASE_URL).pathname).toBe(path);
  });

  it.each([".", ".."])('rejects exact dot segment "%s"', (value) => {
    expect(() => builtPath(spec(), { ...defaults, [field]: value })).toThrow(/Path segment/);
  });
});

describe("nested Code paths", () => {
  it.each([
    ["file_content", "path", "src/folder/my file.ts"],
    ["branch", "branch_name", "feature/my branch"],
    ["tag", "tag_name", "release/my tag"],
  ])("preserves intentional slashes for %s", async (resource, field, value) => {
    const { client, request } = clientWith();
    const operation = resource === "tag" ? "delete" : "get";
    await registry.dispatch(client, resource, operation, { repo_id: "repo", [field]: value });
    expect(request.mock.calls[0][0].path).toContain(value.split("/").map(encodeURIComponent).join("/"));
  });

  it.each(["src/../secret", "src/./secret", "../secret", "feature/../main", "src\\..\\secret"])("rejects traversal in %s before I/O", async (value) => {
    for (const [resource, field] of [["file_content", "path"], ["branch", "branch_name"]]) {
      const { client, request } = clientWith();
      await expect(registry.dispatch(client, resource, "get", { repo_id: "repo", [field]: value }))
        .rejects.toThrow(/Path segment/);
      expect(request).not.toHaveBeenCalled();
    }
  });

  it("keeps percent-encoded dot text literal, rather than decoding it into traversal", async () => {
    const { client, request } = clientWith();
    await registry.dispatch(client, "file_content", "get", { repo_id: "repo", path: "src/%2e%2e/file" });
    expect(request.mock.calls[0][0].path).toBe("/code/api/v1/repos/repo/content/src/%252e%252e/file");
  });
});

describe("preflight and query paths", () => {
  it.each([attack, ".", ".."])('protects retry execution ID %j before a request', async (executionId) => {
    const { client, request } = clientWith({ data: { groups: [{ info: [{ identifier: "stage" }] }] } });
    const preflight = registry.getResource("pipeline").executeActions!.retry.preflight!;
    const input = { pipeline_id: "pipeline", execution_id: executionId };
    const result = preflight({ client, input, registry, accountId: "account" });
    if (executionId === "." || executionId === "..") {
      await expect(result).rejects.toThrow(/Path segment/);
      expect(request).not.toHaveBeenCalled();
    } else {
      await result;
      expect(request).toHaveBeenCalledWith(expect.objectContaining({
        path: `/pipeline/api/pipeline/execute/${encodeURIComponent(executionId)}/retryStages`,
      }));
    }
  });

  it("keeps HAR query and body refs unencoded, with no query string in the path", async () => {
    const { client, request } = clientWith();
    await registry.dispatch(client, "registry", "create", {
      org_id: attack,
      project_id: "project",
      space_ref: "attacker-supplied",
      body: { identifier: "registry", packageType: "NPM", isPublic: false, config: { type: "VIRTUAL" } },
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      path: "/har/api/v1/registry",
      params: expect.objectContaining({ space_ref: `account/${attack}/project/+` }),
      body: expect.objectContaining({ parentRef: `account/${attack}/project` }),
    }));
  });
});

describe("registry paths through the real HTTP client", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const scope = { org_id: "team space", project_id: "project%literal" };

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      status: "SUCCESS",
      data: { groups: [{ info: [{ identifier: "stage" }] }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function realClient(): HarnessClient {
    return new HarnessClient({
      ...config,
      HARNESS_API_TIMEOUT_MS: 1000,
      HARNESS_MAX_RETRIES: 0,
      HARNESS_RATE_LIMIT_RPS: 100,
    });
  }

  function expectRequest(pathname: string, method: string): { url: URL; init: RequestInit } {
    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl, init] = fetchMock.mock.calls[0]!;
    const url = new URL(String(requestUrl));
    expect(url.origin).toBe(config.HARNESS_BASE_URL);
    expect(url.pathname).toBe(pathname);
    expect(url.hash).toBe("");
    expect(url.searchParams.getAll("accountIdentifier")).toEqual([config.HARNESS_ACCOUNT_ID]);
    expect(url.searchParams.getAll("routingId")).toEqual([config.HARNESS_ACCOUNT_ID]);
    expect(init?.method).toBe(method);
    return { url, init: init! };
  }

  describe.each([
    "id?accountIdentifier=other&routingId=other",
    "id/../target?accountIdentifier=other&routingId=other",
  ])("malicious identifier %j", (identifier) => {
    it("dispatches registry update as PUT with an encoded path and raw body refs", async () => {
      const body = { identifier, packageType: "NPM", isPublic: false, config: { type: "VIRTUAL" } };
      await registry.dispatch(realClient(), "registry", "update", {
        ...scope,
        registry_id: identifier,
        body,
      });

      const { init } = expectRequest(
        `/har/api/v1/registry/account/team%20space/project%25literal/${encodeURIComponent(identifier)}/+`,
        "PUT",
      );
      expect(JSON.parse(init.body as string)).toEqual({
        ...body,
        parentRef: "account/team space/project%literal",
      });
      expect(body).not.toHaveProperty("parentRef");
    });

    it.each([
      ["cost_budget", "/ccm/api/budgets"],
      ["ai_budget", "/lw/api/accounts/account/ai-governance/policies"],
    ])("dispatches CCM %s get without changing GET or account scoping", async (resource, prefix) => {
      await registry.dispatch(realClient(), resource, "get", { budget_id: identifier });
      expectRequest(`${prefix}/${encodeURIComponent(identifier)}`, "GET");
    });

    it("invokes pipeline retry preflight with an encoded execution ID and GET", async () => {
      const input: Record<string, unknown> = { pipeline_id: "pipeline", execution_id: identifier };
      const preflight = registry.getResource("pipeline").executeActions!.retry.preflight!;
      await preflight({ client: realClient(), input, registry, accountId: config.HARNESS_ACCOUNT_ID });

      const { url } = expectRequest(
        `/pipeline/api/pipeline/execute/${encodeURIComponent(identifier)}/retryStages`,
        "GET",
      );
      expect(url.searchParams.get("pipelineIdentifier")).toBe("pipeline");
      expect(input.execution_id).toBe(identifier);
      expect(input.retry_stages).toEqual(["stage"]);
    });
  });

  it("serializes HAR create space_ref once and preserves an explicit raw parentRef", async () => {
    const body = {
      identifier: "registry",
      packageType: "NPM",
      isPublic: false,
      config: { type: "VIRTUAL" },
      parentRef: "account/explicit org/project%name",
    };
    await registry.dispatch(realClient(), "registry", "create", { ...scope, body });

    const { url, init } = expectRequest("/har/api/v1/registry", "POST");
    expect(url.searchParams.getAll("space_ref")).toEqual(["account/team space/project%literal/+"]);
    expect(JSON.parse(init.body as string)).toEqual(body);
  });
});

it("registry encoders use the shared dot-safe helper", () => {
  const root = new URL("../../src/registry/", import.meta.url);
  function check(directory: URL): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
      if (entry.isDirectory()) check(path);
      else if (entry.name.endsWith(".ts")) {
        const source = readFileSync(path, "utf8");
        // Also catch simple direct interpolation; this is a tripwire, not taint analysis.
        expect(source, path.pathname).not.toMatch(/encodeURIComponent\s*\(|\$\{input(?:\.|\[)/);
      }
    }
  }
  check(root);
});
