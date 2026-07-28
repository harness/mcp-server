/**
 * Infrastructure toolset wiring — ensure create/update bodyBuilders synthesize
 * non-empty yaml (NG contract) and pick up tool-level org_id/project_id before
 * yaml synthesis so scope fields appear inside body.yaml.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { infrastructureToolset } from "../../src/registry/toolsets/infrastructure.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_MCP_MODE: "single-user",
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_MCP_ALLOWED_HOSTS: undefined,
    HARNESS_MCP_AUTH_TOKEN: undefined,
    HARNESS_MCP_ALLOW_UNAUTHENTICATED_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_PIPELINE_VERSION: undefined,
    HARNESS_AUDIT_FILE: undefined,
    HARNESS_AUDIT_WEBHOOK_URL: undefined,
    HARNESS_AUDIT_WEBHOOK_TOKEN: undefined,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const infra = infrastructureToolset.resources.find((r) => r.resourceType === "infrastructure");
if (!infra) throw new Error("infrastructure resource missing from toolset");

describe("infrastructure create bodyBuilder", () => {
  const build = infra.operations.create!.bodyBuilder!;

  it("synthesizes non-empty yaml from flat body without yaml", () => {
    const result = build({
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
        deploymentType: "Kubernetes",
        spec: { connectorRef: "account.k8s", namespace: "default" },
      },
    }) as Record<string, unknown>;

    expect(typeof result.yaml).toBe("string");
    expect((result.yaml as string).trim().length).toBeGreaterThan(0);
    expect(result.yaml as string).toContain("infrastructureDefinition:");
    expect(result.identifier).toBe("k8s_staging_infra");
  });

  it("injects org_id/project_id into body and synthesized yaml", () => {
    const result = build({
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
      },
    }) as Record<string, unknown>;

    expect(result.orgIdentifier).toBe("default");
    expect(result.projectIdentifier).toBe("cxe_sandbox");
    expect(result.yaml as string).toContain("orgIdentifier: default");
    expect(result.yaml as string).toContain("projectIdentifier: cxe_sandbox");
  });

  it("preserves explicit body.yaml", () => {
    const yaml =
      "infrastructureDefinition:\n  identifier: k8s_staging_infra\n  name: Explicit\n";
    const result = build({
      body: {
        identifier: "k8s_staging_infra",
        name: "Explicit",
        type: "KubernetesDirect",
        environmentRef: "staging",
        yaml,
      },
    }) as Record<string, unknown>;

    expect(result.yaml).toBe(yaml);
  });
});

describe("infrastructure update bodyBuilder", () => {
  const build = infra.operations.update!.bodyBuilder!;

  it("injects infrastructure_id as identifier and synthesizes yaml", () => {
    const result = build({
      infrastructure_id: "k8s_staging_infra",
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        name: "Updated Infra",
        type: "KubernetesDirect",
        environmentRef: "staging",
      },
    }) as Record<string, unknown>;

    expect(result.identifier).toBe("k8s_staging_infra");
    expect(typeof result.yaml).toBe("string");
    expect(result.yaml as string).toContain("identifier: k8s_staging_infra");
    expect(result.yaml as string).toContain("orgIdentifier: default");
  });
});

describe("infrastructure registry dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig());
  });

  it("create: synthesizes non-empty yaml for flat JSON bodies (NG contract)", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "k8s_staging_infra" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "infrastructure", "create", {
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
        deploymentType: "Kubernetes",
        spec: { connectorRef: "account.k8s", namespace: "default" },
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/infrastructures");
    expect(typeof call.body.yaml).toBe("string");
    expect((call.body.yaml as string).trim().length).toBeGreaterThan(0);
    expect(call.body.yaml as string).toContain("infrastructureDefinition:");
    expect(call.body.orgIdentifier).toBe("default");
    expect(call.body.projectIdentifier).toBe("cxe_sandbox");
    expect(call.body.yaml as string).toContain("orgIdentifier: default");
    expect(call.body.yaml as string).toContain("projectIdentifier: cxe_sandbox");
  });

  it("update: injects infrastructure_id and synthesizes yaml", async () => {
    const mockRequest = vi.fn().mockResolvedValue({ identifier: "k8s_staging_infra" });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "infrastructure", "update", {
      infrastructure_id: "k8s_staging_infra",
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        name: "Updated Infra",
        type: "KubernetesDirect",
        environmentRef: "staging",
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
    };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/ng/api/infrastructures");
    expect(call.body.identifier).toBe("k8s_staging_infra");
    expect(typeof call.body.yaml).toBe("string");
    expect(call.body.yaml as string).toContain("identifier: k8s_staging_infra");
    expect(call.body.yaml as string).toContain("orgIdentifier: default");
  });
});
