/*
 * Copyright 2026 Harness Inc. All rights reserved.
 * Use of this source code is governed by the PolyForm Free Trial 1.0.0 license
 * that can be found in the licenses directory at the root of this repository, also available at
 * https://polyformproject.org/wp-content/uploads/2020/05/PolyForm-Free-Trial-1.0.0.txt.
 */

import { describe, it, expect, vi } from "vitest";
import {
  evidenceVaultToolset,
  buildAttestationListBody,
} from "../../src/registry/toolsets/evidence-vault.js";
import { attestationListExtract } from "../../src/registry/extractors.js";
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

describe("evidence-vault toolset", () => {
  it("registers attestation list against /ssca-manager/v2/attestations", () => {
    expect(evidenceVaultToolset.name).toBe("evidence-vault");
    const resource = findResource("attestation");
    expect(resource.scope).toBe("account");
    expect(resource.supportedScopes).toEqual(["account", "org", "project"]);
    expect(resource.scopeParams).toEqual({ org: "org", project: "project" });

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

  it("wraps scalar types/sources to arrays and omits null/empty filters", () => {
    expect(buildAttestationListBody({ types: "Security", sources: ["GithubActions"] })).toEqual({
      types: ["Security"],
      sources: ["GithubActions"],
    });
    expect(buildAttestationListBody({ types: null, sources: "" })).toEqual({});
    expect(buildAttestationListBody({ types: ["Build", "Deploy"] })).toEqual({
      types: ["Build", "Deploy"],
    });
  });

  it("parses string epoch ms for start_time/end_time and ignores invalid values", () => {
    expect(buildAttestationListBody({ start_time: "1700000000000", end_time: "not-a-number" })).toEqual({
      start_time: 1700000000000,
    });
    expect(buildAttestationListBody({ start_time: NaN, end_time: "" })).toEqual({});
  });

  it("deletes whitespace-only search_term and ignores non-string search_term", () => {
    const blank = { search_term: "   " };
    buildAttestationListBody(blank);
    expect(blank).not.toHaveProperty("search_term");

    const numeric = { search_term: 42 };
    buildAttestationListBody(numeric);
    expect(numeric.search_term).toBe(42);
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

  it("returns empty items for non-array API responses", () => {
    expect(attestationListExtract(null)).toEqual({
      items: [],
      total: 0,
      _display_hint: expect.stringMatching(/gitoid_sha256/),
    });
    expect(attestationListExtract({ unexpected: "wrapper" })).toEqual({
      items: [],
      total: 0,
      _display_hint: expect.stringMatching(/gitoid_sha256/),
    });
  });

  it("projects non-record rows to empty objects", () => {
    const result = attestationListExtract(["bad-row", null, 42]);
    expect(result.items).toEqual([{}, {}, {}]);
    expect(result.total).toBe(3);
  });

  it("prefers top-level subject and pipeline fields over nested fallbacks", () => {
    const result = attestationListExtract([
      {
        id: "att-top",
        subject_name: "top-level-name",
        subject_digest: "top-level-digest",
        pipeline_id: "top-pipe",
        pipeline_name: "Top Pipeline",
        pipeline_execution_id: "top-exec",
        subject: {
          name: "nested-name",
          digest: { value: "nested-digest" },
          sha256: "nested-sha256",
        },
        execution_context: {
          pipeline_id: "nested-pipe",
          pipeline_name: "Nested Pipeline",
          pipeline_execution_id: "nested-exec",
        },
      },
    ]);
    expect(result.items[0]).toEqual({
      id: "att-top",
      subject_name: "top-level-name",
      subject_digest: "top-level-digest",
      pipeline_id: "top-pipe",
      pipeline_name: "Top Pipeline",
      pipeline_execution_id: "top-exec",
    });
  });

  it("falls back to subject.sha256 when digest.value is absent", () => {
    const result = attestationListExtract([
      {
        id: "att-sha",
        subject: { name: "img", sha256: "sha-only" },
      },
    ]);
    expect((result.items[0] as Record<string, unknown>).subject_digest).toBe("sha-only");
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

  it("injects org query param at org scope without project", async () => {
    const request = vi.fn().mockResolvedValue([]);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    await registry.dispatch(makeClient(request), "attestation", "list", {
      resource_scope: "org",
      org_id: "SSCA",
      types: ["Build", "Security"],
      start_time: 1000,
    });

    const opts = request.mock.calls[0]![0] as {
      params: Record<string, unknown>;
      body: Record<string, unknown>;
    };
    expect(opts.params.org).toBe("SSCA");
    expect(opts.params.project).toBeUndefined();
    expect(opts.body).toEqual({ types: ["Build", "Security"], start_time: 1000 });
  });

  it("applies attestationListExtract on dispatch response", async () => {
    const raw = [
      {
        id: "att-dispatch",
        gitoid_sha256: "gid-dispatch",
        type: "Build",
        status: "INDEXED",
        updated_at: 1,
        subject: { name: "app:1.0", digest: { value: "abc" } },
      },
    ];
    const request = vi.fn().mockResolvedValue(raw);
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "evidence-vault" }));
    const result = await registry.dispatch(makeClient(request), "attestation", "list", {
      resource_scope: "account",
    });

    expect(result).toMatchObject({
      total: 1,
      _display_hint: expect.stringMatching(/gitoid_sha256/),
    });
    expect((result as { items: Record<string, unknown>[] }).items[0]).toEqual({
      id: "att-dispatch",
      type: "Build",
      gitoid_sha256: "gid-dispatch",
      subject_name: "app:1.0",
      subject_digest: "abc",
    });
    expect((result as { items: Record<string, unknown>[] }).items[0]).not.toHaveProperty("status");
  });
});
