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

  it("treats boolean identifiers as matching their string form", () => {
    const result = connectorUpdateBuilder({
      connector_id: "true",
      body: {
        connector: {
          identifier: true,
          name: "Flag Connector",
          type: "K8sCluster",
        },
      },
    }) as Record<string, unknown>;

    expect(result.connector).toMatchObject({ identifier: true });
  });

  const serviceUpdateBuilder = buildBodyNormalized({
    unwrapKey: "service",
    injectIdentifier: { inputField: "service_id", bodyField: "identifier" },
  });

  it("injects service_id into an unwrapped service body when identifier is missing", () => {
    const result = serviceUpdateBuilder({
      service_id: "my_service",
      body: {
        service: {
          name: "My Service",
          type: "Kubernetes",
        },
      },
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      identifier: "my_service",
      name: "My Service",
      type: "Kubernetes",
    });
    expect(result).not.toHaveProperty("service");
  });

  it("rejects conflicting service identifiers between input and wrapped body", () => {
    expect(() =>
      serviceUpdateBuilder({
        service_id: "dev_service",
        body: {
          service: {
            identifier: "prod_service",
            name: "Prod Service",
            type: "Kubernetes",
          },
        },
      }),
    ).toThrow(/Conflicting identifiers/);
  });

  const environmentUpdateBuilder = buildBodyNormalized({
    unwrapKey: "environment",
    injectIdentifier: { inputField: "environment_id", bodyField: "identifier" },
  });

  it("injects environment_id from YAML bodies after unwrap", () => {
    const result = environmentUpdateBuilder({
      environment_id: "staging",
      body: `
environment:
  name: Staging
  type: PreProduction
`,
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      identifier: "staging",
      name: "Staging",
      type: "PreProduction",
    });
  });

  const overrideUpdateBuilder = buildBodyNormalized({
    injectIdentifier: { inputField: "override_id", bodyField: "identifier" },
    injectFields: [
      { from: "org_id", to: "orgIdentifier", onlyIfMissing: true },
      { from: "project_id", to: "projectIdentifier", onlyIfMissing: true },
    ],
  });

  it("injects override_id and scope fields into a flat update body", () => {
    const result = overrideUpdateBuilder({
      override_id: "svc_env_override",
      org_id: "my-org",
      project_id: "my-proj",
      body: {
        environmentRef: "staging",
        type: "ENV_SERVICE_OVERRIDE",
        spec: { variables: [] },
      },
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      identifier: "svc_env_override",
      environmentRef: "staging",
      orgIdentifier: "my-org",
      projectIdentifier: "my-proj",
    });
  });
});
