import { describe, it, expect, vi } from "vitest";
import {
  evidenceVaultToolset,
  buildAttestationListBody,
  attestationListExtract,
  attestationDetailsExtract,
  attestationDownloadExtract,
} from "../../src/registry/toolsets/evidence-vault.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test-account.token.secret",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: undefined,
    HARNESS_PROJECT: undefined,
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
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue([]),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findResource(type: string): ResourceDefinition {
  const res = evidenceVaultToolset.resources.find((r) => r.resourceType === type);
  if (!res) throw new Error(`Resource type "${type}" not found`);
  return res;
}

function getListOp(): EndpointSpec {
  const spec = findResource("attestation").operations.list;
  if (!spec) throw new Error("list operation missing on attestation");
  return spec;
}

function getGetOp(): EndpointSpec {
  const spec = findResource("attestation").operations.get;
  if (!spec) throw new Error("get operation missing on attestation");
  return spec;
}

function getDownloadOp(): EndpointSpec {
  const spec = findResource("attestation").executeActions?.download;
  if (!spec) throw new Error("download execute action missing on attestation");
  return spec;
}

describe("evidence-vault toolset", () => {
  it("registers attestation list against /ssca-manager/v2/attestations", () => {
    expect(evidenceVaultToolset.name).toBe("evidence_vault");
    const resource = findResource("attestation");
    expect(resource.scope).toBe("account");
    expect(resource.supportedScopes).toEqual(["account", "org", "project"]);
    expect(resource.scopeParams).toEqual({ org: "org", project: "project" });
    expect(resource.identifierFields).toEqual(["gitoid_sha256"]);

    const list = getListOp();
    expect(list.method).toBe("POST");
    expect(list.path).toBe("/ssca-manager/v2/attestations");
    expect(list.skipScopeBodyInjection).toBe(true);
    expect(list.defaultQueryParams).toMatchObject({ sort: "created_at", order: "DESC" });
    expect(list.queryParams).toMatchObject({
      page: "page",
      size: "limit",
      search_term: "search",
    });
  });

  it("registers attestation get by gitoid against details path", () => {
    const get = getGetOp();
    expect(get.method).toBe("GET");
    expect(get.path).toBe(
      "/ssca-manager/v2/orgs/{org}/projects/{project}/attestations/{attestation}/details",
    );
    expect(get.pathParams).toEqual({
      org_id: "org",
      project_id: "project",
      gitoid_sha256: "attestation",
    });
    expect(get.defaultQueryParams).toEqual({ identifier_type: "gitoid_sha256" });
    expect(get.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });

  it("registers attestation download execute action against download-attestation path", () => {
    const download = getDownloadOp();
    expect(download.method).toBe("GET");
    expect(download.path).toBe(
      "/ssca-manager/v2/orgs/{org}/projects/{project}/attestations/download-attestation/{digest}",
    );
    expect(download.pathParams).toEqual({
      org_id: "org",
      project_id: "project",
      gitoid_sha256: "digest",
    });
    expect(download.operationPolicy).toEqual({ risk: "read", retryPolicy: "safe" });
  });

  it("loads into Registry by default", () => {
    const registry = new Registry(makeConfig());
    expect(registry.getResource("attestation").resourceType).toBe("attestation");
  });
});

describe("buildAttestationListBody", () => {
  it("returns empty body when no filters", () => {
    expect(buildAttestationListBody({})).toEqual({});
  });

  it("does not put singular search into body (search is a query param)", () => {
    const input: Record<string, unknown> = { search_term: "ci-build" };
    const body = buildAttestationListBody(input);
    expect(body).toEqual({});
    expect(input.search_term).toBe("ci-build");
  });

  it("maps subject_name to Name/Contains subject_filter", () => {
    expect(buildAttestationListBody({ subject_name: "my-image:latest" })).toEqual({
      subject_filter: [{ field_name: "Name", operator: "Contains", value: "my-image:latest" }],
    });
  });

  it("maps subject_digest to Digest/Equals subject_filter", () => {
    expect(buildAttestationListBody({ subject_digest: "sha256:abc" })).toEqual({
      subject_filter: [{ field_name: "Digest", operator: "Equals", value: "sha256:abc" }],
    });
  });

  it("combines search_term (query) with subject_name and subject_digest", () => {
    const input: Record<string, unknown> = {
      search_term: "ci-build",
      subject_name: "artifact-foo",
      subject_digest: "sha256:abc",
      types: "Build",
      sources: ["Harness"],
      start_time: 1000,
      end_time: 2000,
    };
    const body = buildAttestationListBody(input);
    expect(body).toEqual({
      types: ["Build"],
      sources: ["Harness"],
      start_time: 1000,
      end_time: 2000,
      subject_filter: [
        { field_name: "Name", operator: "Contains", value: "artifact-foo" },
        { field_name: "Digest", operator: "Equals", value: "sha256:abc" },
      ],
    });
    expect(body).not.toHaveProperty("data_source");
    expect(input.search_term).toBe("ci-build");
  });

  it("truncates search_term to 100 characters", () => {
    const long = "x".repeat(150);
    const input: Record<string, unknown> = { search_term: `  ${long}  ` };
    buildAttestationListBody(input);
    expect((input.search_term as string).length).toBe(100);
  });

  it("passes scopes through", () => {
    const scopes = { myOrg: ["projA"] };
    expect(buildAttestationListBody({ scopes })).toEqual({ scopes });
  });
});

describe("attestationListExtract", () => {
  const rawItem = {
    id: "att-1",
    gitoid_sha256: "gid123",
    created_at: 1700000000000,
    updated_at: 1700000001000,
    type: "Build",
    source: "Harness",
    status: "INDEXED",
    description: "Build attestation for container image",
    org: "SSCA",
    project: "Sanity",
    additional_subject_count: 1,
    subject: {
      name: "registry/app:1.0",
      digest: { algorithm: "sha256", value: "deadbeef" },
    },
    subjects: [{ name: "extra" }],
    execution_context: {
      type: "harness",
      pipeline_id: "ci-build",
      pipeline_name: "CI Build",
      pipeline_execution_id: "exec-9",
      stage_id: "build",
    },
  };

  it("projects slim fields and drops status/updated_at/raw context", () => {
    const result = attestationListExtract([rawItem]);
    expect(result.items[0]).toEqual({
      id: "att-1",
      type: "Build",
      source: "Harness",
      description: "Build attestation for container image",
      created_at: 1700000000000,
      org: "SSCA",
      project: "Sanity",
      subject_name: "registry/app:1.0",
      subject_digest: "deadbeef",
      additional_subject_count: 1,
      gitoid_sha256: "gid123",
      pipeline_id: "ci-build",
      pipeline_name: "CI Build",
      pipeline_execution_id: "exec-9",
    });
    const projected = result.items[0] as Record<string, unknown>;
    expect(projected).not.toHaveProperty("status");
    expect(projected).not.toHaveProperty("updated_at");
    expect(projected).not.toHaveProperty("execution_context");
    expect(projected).not.toHaveProperty("subjects");
  });

  it("wraps bare array as { items, total } using page length", () => {
    const result = attestationListExtract([rawItem, { id: "att-2", type: "Deploy" }]);
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect((result.items[0] as Record<string, unknown>).id).toBe("att-1");
    expect(result._display_hint).toMatch(/gitoid_sha256/);
  });

  it("is idempotent under compactItem re-application (harness_list default compact)", () => {
    const compactItem = findResource("attestation").compactItem;
    expect(compactItem).toBeTypeOf("function");
    const once = attestationListExtract([rawItem]).items[0] as Record<string, unknown>;
    const twice = compactItem!(once);
    expect(twice).toEqual(once);
    expect(twice.subject_name).toBe("registry/app:1.0");
    expect(twice.subject_digest).toBe("deadbeef");
    expect(twice.pipeline_id).toBe("ci-build");
    expect(twice.pipeline_name).toBe("CI Build");
    expect(twice.pipeline_execution_id).toBe("exec-9");
  });
});

describe("attestation list dispatch", () => {
  it("sends account-scoped list without org/project query params", async () => {
    const request = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    await registry.dispatch(makeClient(request), "attestation", "list", {
      resource_scope: "account",
      page: 0,
      size: 20,
      search_term: "my-pipeline",
    });

    expect(request).toHaveBeenCalledTimes(1);
    const opts = request.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
      body: Record<string, unknown>;
    };
    expect(opts.method).toBe("POST");
    expect(opts.path).toBe("/ssca-manager/v2/attestations");
    expect(opts.params.org).toBeUndefined();
    expect(opts.params.project).toBeUndefined();
    expect(opts.params.search).toBe("my-pipeline");
    expect(opts.params.sort).toBe("created_at");
    expect(opts.params.order).toBe("DESC");
    expect(opts.params.page).toBe(0);
    expect(opts.params.limit).toBe(20);
    expect(opts.body).toEqual({});
    expect(opts.params).not.toHaveProperty("data_source");
  });

  it("injects org/project query params at project scope with subject_filter", async () => {
    const request = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    await registry.dispatch(makeClient(request), "attestation", "list", {
      resource_scope: "project",
      org_id: "SSCA",
      project_id: "Sanity",
      search_term: "ci-build",
      subject_name: "artifact-foo",
    });

    const opts = request.mock.calls[0]![0] as {
      params: Record<string, unknown>;
      body: Record<string, unknown>;
    };
    expect(opts.params.org).toBe("SSCA");
    expect(opts.params.project).toBe("Sanity");
    expect(opts.params.search).toBe("ci-build");
    expect(opts.body).toEqual({
      subject_filter: [{ field_name: "Name", operator: "Contains", value: "artifact-foo" }],
    });
  });
});

describe("attestationDetailsExtract", () => {
  const rawDetails = {
    type: "Build",
    source: "Harness",
    description: "Build attestation for container image",
    gitoid_sha256: "gid123",
    artifact_id: "art-1",
    payload_type: "application/vnd.in-toto+json",
    created_at: 1700000000000,
    updated_at: 1700000001000,
    signature: "sig-bytes",
    subjects: [
      { name: "registry/app:1.0", digest: { algorithm: "sha256", value: "deadbeef" } },
      { name: "extra", digest: { algorithm: "sha256", value: "cafebabe" } },
    ],
    execution_context: {
      type: "harness",
      pipeline_id: "ci-build",
      pipeline_name: "CI Build",
      pipeline_execution_id: "exec-9",
      stage_id: "build",
    },
  };

  it("projects subjects and pipeline fields; drops artifact_id/payload_type/updated_at", () => {
    const result = attestationDetailsExtract(rawDetails);
    expect(result).toEqual({
      type: "Build",
      source: "Harness",
      description: "Build attestation for container image",
      gitoid_sha256: "gid123",
      created_at: 1700000000000,
      signature: "sig-bytes",
      subjects: [
        { name: "registry/app:1.0", digest_algorithm: "sha256", digest_value: "deadbeef" },
        { name: "extra", digest_algorithm: "sha256", digest_value: "cafebabe" },
      ],
      pipeline_id: "ci-build",
      pipeline_name: "CI Build",
      pipeline_execution_id: "exec-9",
    });
    expect(result).not.toHaveProperty("updated_at");
    expect(result).not.toHaveProperty("artifact_id");
    expect(result).not.toHaveProperty("payload_type");
    expect(result).not.toHaveProperty("execution_context");
  });
});

describe("attestation get dispatch", () => {
  it("GETs details path with gitoid path param and identifier_type query", async () => {
    const request = vi.fn().mockResolvedValue({
      type: "Build",
      source: "Harness",
      gitoid_sha256: "gid123",
      subjects: [],
    });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    await registry.dispatch(makeClient(request), "attestation", "get", {
      org_id: "SSCA",
      project_id: "Sanity",
      gitoid_sha256: "gid123",
    });

    expect(request).toHaveBeenCalledTimes(1);
    const opts = request.mock.calls[0]![0] as {
      method: string;
      path: string;
      params: Record<string, unknown>;
    };
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(
      "/ssca-manager/v2/orgs/SSCA/projects/Sanity/attestations/gid123/details",
    );
    expect(opts.params.identifier_type).toBe("gitoid_sha256");
  });

  it("requires org_id and project_id for get", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    await expect(
      registry.dispatch(makeClient(), "attestation", "get", { gitoid_sha256: "gid123" }),
    ).rejects.toThrow(/org_id/);
  });
});

describe("attestationDownloadExtract", () => {
  it("keeps download_url and expires_at with display hint", () => {
    const result = attestationDownloadExtract({
      download_url: "https://s3.example/presigned?X=1",
      expires_at: 1700003600000,
      extra: "drop-me",
    });
    expect(result).toEqual({
      download_url: "https://s3.example/presigned?X=1",
      expires_at: 1700003600000,
      _display_hint: expect.stringMatching(/download_url/),
    });
    expect(result).not.toHaveProperty("extra");
  });
});

describe("attestation download dispatch", () => {
  it("GETs download-attestation path with gitoid as digest", async () => {
    const request = vi.fn().mockResolvedValue({
      download_url: "https://s3.example/presigned",
      expires_at: 1700003600000,
    });
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    const result = await registry.dispatchExecute(makeClient(request), "attestation", "download", {
      org_id: "SSCA",
      project_id: "Sanity",
      gitoid_sha256: "gid123",
    });

    expect(request).toHaveBeenCalledTimes(1);
    const opts = request.mock.calls[0]![0] as {
      method: string;
      path: string;
    };
    expect(opts.method).toBe("GET");
    expect(opts.path).toBe(
      "/ssca-manager/v2/orgs/SSCA/projects/Sanity/attestations/download-attestation/gid123",
    );
    expect(result).toMatchObject({
      download_url: "https://s3.example/presigned",
      expires_at: 1700003600000,
      _display_hint: expect.stringMatching(/download_url/),
    });
  });

  it("requires org_id and project_id for download", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    await expect(
      registry.dispatchExecute(makeClient(), "attestation", "download", { gitoid_sha256: "gid123" }),
    ).rejects.toThrow(/org_id/);
  });

  it("allows download under HARNESS_READ_ONLY (risk read)", async () => {
    const request = vi.fn().mockResolvedValue({
      download_url: "https://s3.example/presigned",
      expires_at: 1700003600000,
    });
    const registry = new Registry(
      makeConfig({ HARNESS_TOOLSETS: "evidence-vault", HARNESS_READ_ONLY: true }),
    );
    await expect(
      registry.dispatchExecute(makeClient(request), "attestation", "download", {
        org_id: "SSCA",
        project_id: "Sanity",
        gitoid_sha256: "gid123",
      }),
    ).resolves.toMatchObject({ download_url: "https://s3.example/presigned" });
  });
});
