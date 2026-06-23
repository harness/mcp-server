import { describe, expect, it } from "vitest";
import { buildBodyNormalized, stripNulls, unwrapBody } from "../../src/utils/body-normalizer.js";

describe("stripNulls", () => {
  it("removes null and undefined keys from objects", () => {
    expect(stripNulls({ keep: "x", dropNull: null, dropUndef: undefined })).toEqual({ keep: "x" });
  });

  it("preserves zero and false values", () => {
    expect(stripNulls({ timeout_ms: 0, enabled: false })).toEqual({ timeout_ms: 0, enabled: false });
  });
});

describe("unwrapBody", () => {
  it("returns the wrapper value when present", () => {
    expect(unwrapBody({ connector: { identifier: "c1" } }, "connector")).toEqual({ identifier: "c1" });
  });

  it("returns the original body when the wrapper key is missing", () => {
    const body = { identifier: "c1" };
    expect(unwrapBody(body, "connector")).toBe(body);
  });
});

describe("buildBodyNormalized", () => {
  it("injects identifier from input when the body field is missing", () => {
    const builder = buildBodyNormalized({
      unwrapKey: "connector",
      injectIdentifier: { inputField: "connector_id", bodyField: "identifier" },
    });

    const body = builder({
      connector_id: "dev_connector",
      body: { connector: { name: "Dev", type: "K8sCluster" } },
    }) as Record<string, unknown>;

    expect((body as Record<string, unknown>).identifier).toBe("dev_connector");
  });

  it("rejects conflicting identifiers between input and body", () => {
    const builder = buildBodyNormalized({
      unwrapKey: "connector",
      injectIdentifier: { inputField: "connector_id", bodyField: "identifier" },
    });

    expect(() =>
      builder({
        connector_id: "dev_connector",
        body: { connector: { identifier: "prod_connector", name: "Prod" } },
      }),
    ).toThrow(/Conflicting identifiers/);
  });

  it("parses YAML string bodies before validation and injection", () => {
    const builder = buildBodyNormalized({
      unwrapKey: "connector",
      injectIdentifier: { inputField: "connector_id", bodyField: "identifier" },
    });

    expect(() =>
      builder({
        connector_id: "dev_connector",
        body: `
connector:
  identifier: prod_connector
  name: Prod Connector
`,
      }),
    ).toThrow(/Conflicting identifiers/);
  });

  it("injects into wrapped bodies when wrapKey is configured", () => {
    const builder = buildBodyNormalized({
      wrapKey: "connector",
      injectIdentifier: { inputField: "connector_id", bodyField: "identifier" },
    });

    const body = builder({
      connector_id: "acct_connector",
      body: { name: "Account Connector", type: "Github" },
    }) as Record<string, unknown>;

    expect((body.connector as Record<string, unknown>).identifier).toBe("acct_connector");
  });

  it("injects additional fields using != null semantics", () => {
    const builder = buildBodyNormalized({
      injectFields: [{ from: "timeout_ms", to: "timeout", onlyIfMissing: true }],
    });

    const body = builder({
      timeout_ms: 0,
      body: { name: "svc" },
    }) as Record<string, unknown>;

    expect(body.timeout).toBe(0);
  });

  it("rejects non-object bodies", () => {
    const builder = buildBodyNormalized();
    expect(() => builder({ body: "not yaml" })).toThrow(/body must be a JSON object or YAML object/);
  });
});
