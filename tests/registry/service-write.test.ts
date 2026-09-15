/**
 * Service create/update body shaping — NG drops ``serviceDefinition`` when ``body.yaml``
 * is missing even though flat JSON fields are accepted. Mirrors the infrastructure
 * ensureYamlWrapper contract (AIPLAT-1561).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { servicesToolset } from "../../src/registry/toolsets/services.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const service = servicesToolset.resources.find((r) => r.resourceType === "service");
if (!service) throw new Error("service resource missing from toolset");

describe("service create bodyBuilder", () => {
  const build = service.operations.create!.bodyBuilder!;

  it("synthesizes yaml containing serviceDefinition from JSON body", () => {
    const result = build({
      org_id: "default",
      project_id: "shubh_ai_33",
      body: {
        service: {
          identifier: "nginx_service",
          name: "Nginx Service",
          description: "Nginx service for K8s rolling deployment with 2 replicas",
          serviceDefinition: {
            type: "Kubernetes",
            spec: {
              manifests: [
                {
                  manifest: {
                    identifier: "nginx_manifest",
                    type: "K8sManifest",
                    spec: { store: { type: "Inline", spec: { content: "apiVersion: apps/v1" } } },
                  },
                },
              ],
              artifacts: {
                primary: {
                  primaryArtifactRef: "nginx_image",
                  sources: [{ identifier: "nginx_image", type: "Dockerhub", spec: { imagePath: "nginx" } }],
                },
              },
            },
          },
        },
      },
    }) as Record<string, unknown>;

    expect(typeof result.yaml).toBe("string");
    expect((result.yaml as string).trim().length).toBeGreaterThan(0);
    expect(result.yaml as string).toContain("service:");
    expect(result.yaml as string).toContain("serviceDefinition:");
    expect(result.yaml as string).toContain("type: Kubernetes");
    expect(result.yaml as string).toContain("orgIdentifier: default");
    expect(result.yaml as string).toContain("projectIdentifier: shubh_ai_33");
    expect(result.identifier).toBe("nginx_service");
  });

  it("preserves explicit body.yaml", () => {
    const yaml = "service:\n  identifier: nginx_service\n  name: Nginx Service\n";
    const result = build({
      body: {
        identifier: "nginx_service",
        name: "Nginx Service",
        yaml,
      },
    }) as Record<string, unknown>;

    expect(result.yaml).toBe(yaml);
  });
});

describe("service update bodyBuilder", () => {
  const build = service.operations.update!.bodyBuilder!;

  it("injects service_id as identifier and synthesizes yaml with serviceDefinition", () => {
    const result = build({
      service_id: "nginx_service",
      org_id: "default",
      project_id: "shubh_ai_33",
      body: {
        name: "Updated Nginx Service",
        serviceDefinition: {
          type: "Kubernetes",
          spec: { manifests: [] },
        },
      },
    }) as Record<string, unknown>;

    expect(result.identifier).toBe("nginx_service");
    expect(typeof result.yaml).toBe("string");
    expect(result.yaml as string).toContain("identifier: nginx_service");
    expect(result.yaml as string).toContain("serviceDefinition:");
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

describe("service create dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "services" }));
  });

  it("POST body includes synthesized yaml with serviceDefinition", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { identifier: "nginx_service", name: "Nginx Service" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service", "create", {
      org_id: "default",
      project_id: "avi",
      body: {
        service: {
          identifier: "nginx_service",
          name: "Nginx Service",
          serviceDefinition: {
            type: "Kubernetes",
            spec: { manifests: [], artifacts: { primary: { primaryArtifactRef: "img", sources: [] } } },
          },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/servicesV2");

    const body = call.body as Record<string, unknown>;
    expect(typeof body.yaml).toBe("string");
    expect(body.yaml as string).toContain("serviceDefinition:");
    expect(body.serviceDefinition).toBeDefined();
  });
});

describe("service update dispatch", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "services" }));
  });

  it("PUT body includes synthesized yaml with serviceDefinition and injected identifier", async () => {
    const mockRequest = vi.fn().mockResolvedValue({
      data: { identifier: "nginx_service", name: "Updated Nginx Service" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "service", "update", {
      service_id: "nginx_service",
      org_id: "default",
      project_id: "avi",
      body: {
        name: "Updated Nginx Service",
        serviceDefinition: {
          type: "Kubernetes",
          spec: { manifests: [{ manifest: { identifier: "m1", type: "K8sManifest", spec: {} } }] },
        },
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/ng/api/servicesV2");

    const body = call.body as Record<string, unknown>;
    expect(body.identifier).toBe("nginx_service");
    expect(typeof body.yaml).toBe("string");
    expect(body.yaml as string).toContain("serviceDefinition:");
    expect(body.yaml as string).toContain("identifier: nginx_service");
  });
});
