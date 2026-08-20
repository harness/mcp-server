/**
 * Infrastructure toolset wiring — ensure create/update bodyBuilders synthesize
 * non-empty yaml (NG contract) and pick up tool-level org_id/project_id before
 * yaml synthesis so scope fields appear inside body.yaml.
 *
 * Deep links open the environment details Infrastructure section
 * (`?sectionId=INFRASTRUCTURE`), not a standalone infra settings page.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { infrastructureToolset } from "../../src/registry/toolsets/infrastructure.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

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

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "avi",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "info",
    ...overrides,
  };
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({}),
    account: "test-account",
  } as unknown as HarnessClient;
}

const INFRA_DEEP_LINK =
  "https://app.harness.io/ng/account/test-account/all/orgs/default/projects/avi/settings/environments/preprod/details?sectionId=INFRASTRUCTURE";

describe("infrastructure deep links", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "infrastructure" }));
  });

  it("list: openInHarness is environment details with the Infrastructure section", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          content: [
            {
              identifier: "k8s",
              name: "k8s",
              environmentRef: "preprod",
              orgIdentifier: "default",
              projectIdentifier: "avi",
            },
          ],
          totalElements: 1,
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "list", {
      org_id: "default",
      project_id: "avi",
      environment_id: "preprod",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]!.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("get: openInHarness uses environmentRef from the response", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          identifier: "k8s",
          name: "k8s",
          environmentRef: "preprod",
          orgIdentifier: "default",
          projectIdentifier: "avi",
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "get", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "avi",
      environment_id: "preprod",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("create: openInHarness uses environmentRef when environment_id is not a query param", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          identifier: "k8s",
          name: "k8s",
          environmentRef: "preprod",
          orgIdentifier: "default",
          projectIdentifier: "avi",
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "create", {
      org_id: "default",
      project_id: "avi",
      body: {
        identifier: "k8s",
        name: "k8s",
        type: "KubernetesDirect",
        environmentRef: "preprod",
      },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("get: openInHarness falls back to environment_id param when response omits environmentRef", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          identifier: "k8s",
          name: "k8s",
          orgIdentifier: "default",
          projectIdentifier: "avi",
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "get", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "avi",
      environment_id: "preprod",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("list: openInHarness aliases nested infrastructure.environmentRef onto environmentIdentifier", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          content: [
            {
              identifier: "k8s",
              name: "k8s",
              infrastructure: { environmentRef: "preprod" },
              orgIdentifier: "default",
              projectIdentifier: "avi",
            },
          ],
          totalElements: 1,
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "list", {
      org_id: "default",
      project_id: "avi",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]!.openInHarness).toBe(INFRA_DEEP_LINK);
  });

  it("update: openInHarness aliases nested infrastructure.environmentRef onto environmentIdentifier", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        data: {
          identifier: "k8s",
          name: "k8s",
          infrastructure: { environmentRef: "preprod" },
          orgIdentifier: "default",
          projectIdentifier: "avi",
        },
      }),
    );
    const result = (await registry.dispatch(client, "infrastructure", "update", {
      infrastructure_id: "k8s",
      org_id: "default",
      project_id: "avi",
      body: {
        name: "k8s",
        type: "KubernetesDirect",
        environmentRef: "preprod",
      },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(INFRA_DEEP_LINK);
  });
});
