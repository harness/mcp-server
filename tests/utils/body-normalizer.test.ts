/**
 * Unit tests for body-normalizer — shared request-body shaping for Harness NG APIs.
 *
 * Regression focus (PR #328):
 *  - injectIdentifier must target wrapped bodies (connector.environment.service).
 *  - Conflicting resource_id vs body identifier must fail before the API call.
 *  - injectFields must also target wrapped bodies when wrapKey is set.
 */
import { describe, it, expect } from "vitest";
import {
  buildBodyNormalized,
  ensureYamlField,
  stripNulls,
  unwrapBody,
} from "../../src/utils/body-normalizer.js";

describe("stripNulls", () => {
  it("removes null and undefined values recursively", () => {
    expect(stripNulls({ keep: "x", drop: null, also: undefined, nested: { a: 1, b: null } })).toEqual({
      keep: "x",
      nested: { a: 1 },
    });
  });
});

describe("unwrapBody", () => {
  it("returns the inner object when the wrapper key is present", () => {
    expect(unwrapBody({ connector: { identifier: "c1" } }, "connector")).toEqual({ identifier: "c1" });
  });

  it("returns the original body when the wrapper key is absent", () => {
    expect(unwrapBody({ identifier: "c1" }, "connector")).toEqual({ identifier: "c1" });
  });
});

describe("buildBodyNormalized", () => {
  const connectorUpdateBuilder = buildBodyNormalized({
    wrapKey: "connector",
    injectIdentifier: { inputField: "connector_id", bodyField: "identifier" },
    injectFields: [{ from: "type", to: "connectionType", onlyIfMissing: true }],
  });

  it("injects connector_id into a wrapped connector body when identifier is missing", () => {
    const result = connectorUpdateBuilder({
      connector_id: "dev_connector",
      type: "K8sCluster",
      body: {
        name: "Dev Connector",
        type: "K8sCluster",
        spec: { credential: { type: "InheritFromDelegate" } },
      },
    }) as Record<string, unknown>;

    expect(result.connector).toMatchObject({
      identifier: "dev_connector",
      name: "Dev Connector",
      connectionType: "K8sCluster",
    });
  });

  it("parses YAML bodies and injects identifier into the wrapped connector object", () => {
    const result = connectorUpdateBuilder({
      connector_id: "dev_connector",
      type: "K8sCluster",
      body: `
connector:
  name: Dev Connector
  type: K8sCluster
  spec:
    credential:
      type: InheritFromDelegate
`,
    }) as Record<string, unknown>;

    expect(result.connector).toMatchObject({
      identifier: "dev_connector",
      name: "Dev Connector",
      connectionType: "K8sCluster",
    });
  });

  it("allows matching identifiers in input and wrapped body", () => {
    const result = connectorUpdateBuilder({
      connector_id: "dev_connector",
      body: {
        connector: {
          identifier: "dev_connector",
          name: "Dev Connector",
          type: "K8sCluster",
        },
      },
    }) as Record<string, unknown>;

    expect(result.connector).toMatchObject({ identifier: "dev_connector" });
  });

  it("rejects conflicting identifiers between input and wrapped body", () => {
    expect(() =>
      connectorUpdateBuilder({
        connector_id: "dev_connector",
        body: {
          connector: {
            identifier: "prod_connector",
            name: "Prod Connector",
            type: "K8sCluster",
          },
        },
      }),
    ).toThrow(/Conflicting identifiers/);
  });

  it("does not overwrite an existing connectionType when onlyIfMissing is set", () => {
    const result = connectorUpdateBuilder({
      connector_id: "dev_connector",
      type: "DockerRegistry",
      body: {
        connector: {
          identifier: "dev_connector",
          name: "Dev Connector",
          connectionType: "K8sCluster",
          type: "K8sCluster",
        },
      },
    }) as Record<string, unknown>;

    expect((result.connector as Record<string, unknown>).connectionType).toBe("K8sCluster");
  });

  it("coerces numeric identifiers to strings for conflict detection", () => {
    expect(() =>
      connectorUpdateBuilder({
        connector_id: "42",
        body: {
          connector: {
            identifier: 43,
            name: "Connector",
            type: "K8sCluster",
          },
        },
      }),
    ).toThrow(/Conflicting identifiers/);
  });

  const environmentUpdateBuilder = buildBodyNormalized({
    unwrapKey: "environment",
    injectIdentifier: { inputField: "environment_id", bodyField: "identifier" },
  });

  it("injects environment_id after unwrapping a wrapped environment body", () => {
    const result = environmentUpdateBuilder({
      environment_id: "prod_env",
      body: {
        environment: {
          name: "Production",
          type: "Production",
        },
      },
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      identifier: "prod_env",
      name: "Production",
      type: "Production",
    });
    expect(result).not.toHaveProperty("environment");
  });

  it("rejects conflicting environment_id between input and unwrapped body", () => {
    expect(() =>
      environmentUpdateBuilder({
        environment_id: "dev_env",
        body: {
          environment: {
            identifier: "prod_env",
            name: "Production",
            type: "Production",
          },
        },
      }),
    ).toThrow(/Conflicting identifiers/);
  });
});

describe("ensureYamlField", () => {
  it("preserves an existing non-empty yaml string", () => {
    const body = {
      identifier: "k8s_staging_infra",
      yaml: "infrastructureDefinition:\n  identifier: k8s_staging_infra\n",
    };
    expect(ensureYamlField(body, "infrastructureDefinition")).toEqual(body);
  });

  it("synthesizes yaml from flat fields when omitted (infra NG contract)", () => {
    const result = ensureYamlField(
      {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
        deploymentType: "Kubernetes",
        spec: { connectorRef: "account.cdautomationtest", namespace: "default" },
      },
      "infrastructureDefinition",
    ) as Record<string, unknown>;

    expect(typeof result.yaml).toBe("string");
    expect(result.yaml as string).toContain("infrastructureDefinition:");
    expect(result.yaml as string).toContain("identifier: k8s_staging_infra");
    expect(result.identifier).toBe("k8s_staging_infra");
    expect(result.environmentRef).toBe("staging");
  });

  it("replaces empty yaml string with synthesized content", () => {
    const result = ensureYamlField(
      { identifier: "x", name: "X", type: "KubernetesDirect", environmentRef: "e", yaml: "  " },
      "infrastructureDefinition",
    ) as Record<string, unknown>;
    expect((result.yaml as string).trim().length).toBeGreaterThan(0);
    expect(result.yaml as string).toContain("identifier: x");
  });
});

describe("buildBodyNormalized ensureYamlWrapper", () => {
  const infraCreateBuilder = buildBodyNormalized({
    unwrapKey: "infrastructureDefinition",
    ensureYamlWrapper: "infrastructureDefinition",
  });

  it("synthesizes yaml for the flat JSON body that previously failed NG create", () => {
    const result = infraCreateBuilder({
      body: {
        deploymentType: "Kubernetes",
        description: "Kubernetes infrastructure for staging deployments",
        environmentRef: "staging",
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        orgIdentifier: "default",
        projectIdentifier: "cxe_sandbox",
        spec: {
          connectorRef: "account.cdautomationtest",
          namespace: "default",
          releaseName: "release-<+INFRA_KEY_SHORT_ID>",
        },
        type: "KubernetesDirect",
      },
    }) as Record<string, unknown>;

    expect(typeof result.yaml).toBe("string");
    expect((result.yaml as string).length).toBeGreaterThan(0);
    expect(result.yaml as string).toContain("infrastructureDefinition:");
    expect(result.identifier).toBe("k8s_staging_infra");
  });

  it("unwraps infrastructureDefinition YAML string body and fills yaml", () => {
    const result = infraCreateBuilder({
      body: `
infrastructureDefinition:
  name: K8s Staging Infrastructure
  identifier: k8s_staging_infra
  environmentRef: staging
  type: KubernetesDirect
  deploymentType: Kubernetes
`,
    }) as Record<string, unknown>;

    expect(result.identifier).toBe("k8s_staging_infra");
    expect(typeof result.yaml).toBe("string");
    expect(result.yaml as string).toContain("infrastructureDefinition:");
  });

  it("keeps an explicit body.yaml when provided", () => {
    const yaml =
      "infrastructureDefinition:\n  identifier: k8s_staging_infra\n  name: K8s Staging Infrastructure\n";
    const result = infraCreateBuilder({
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
        yaml,
      },
    }) as Record<string, unknown>;

    expect(result.yaml).toBe(yaml);
  });

  it("includes org/project from tool-level org_id/project_id in synthesized yaml", () => {
    // Common MCP shape: scope outside body; yaml must not lag behind JSON fields.
    const infraWithScope = buildBodyNormalized({
      unwrapKey: "infrastructureDefinition",
      ensureYamlWrapper: "infrastructureDefinition",
      injectFields: [
        { from: "org_id", to: "orgIdentifier", onlyIfMissing: true },
        { from: "project_id", to: "projectIdentifier", onlyIfMissing: true },
      ],
    });

    const result = infraWithScope({
      org_id: "default",
      project_id: "cxe_sandbox",
      body: {
        identifier: "k8s_staging_infra",
        name: "K8s Staging Infrastructure",
        type: "KubernetesDirect",
        environmentRef: "staging",
        deploymentType: "Kubernetes",
      },
    }) as Record<string, unknown>;

    expect(result.orgIdentifier).toBe("default");
    expect(result.projectIdentifier).toBe("cxe_sandbox");
    expect(result.yaml as string).toContain("orgIdentifier: default");
    expect(result.yaml as string).toContain("projectIdentifier: cxe_sandbox");
  });
});
