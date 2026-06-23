/**
 * Regression tests for idp_workflow execute bodyBuilder.
 *
 * PR #377 replaced console.error debug logging with createLogger and explicit
 * secret redaction. These tests verify:
 *   1. Auth token parameters are auto-injected from workflow YAML.
 *   2. apiKeySecret values reach the API payload but are redacted in debug logs.
 *   3. Missing apiKeySecret fails loud when no fallback key is configured.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { idpToolset } from "../../src/registry/toolsets/idp.js";
import { setLogLevel } from "../../src/utils/logger.js";
import type { EndpointSpec, ResourceDefinition } from "../../src/registry/types.js";

const WORKFLOW_YAML = `
spec:
  steps:
    - id: auth-step
      input:
        apikey: "\${{ parameters.harnessToken }}"
        apiKeySecret: "\${{ parameters.secretKey }}"
`.trim();

function getWorkflowResource(): ResourceDefinition {
  const resource = idpToolset.resources.find((r) => r.resourceType === "idp_workflow");
  if (!resource) throw new Error("idp_workflow resource missing");
  return resource;
}

function getExecuteSpec(): EndpointSpec {
  const spec = getWorkflowResource().executeActions?.execute;
  if (!spec?.bodyBuilder) throw new Error("idp_workflow execute bodyBuilder missing");
  return spec;
}

describe("idp_workflow execute bodyBuilder", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setLogLevel("debug");
    stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    setLogLevel("info");
  });

  it("auto-injects apikey placeholder and apiKeySecret from config fallback", () => {
    const body = getExecuteSpec().bodyBuilder!({
      body: {
        workflow_details: { identifier: "deploy-svc", yaml: WORKFLOW_YAML },
        values: { env: "prod" },
      },
      __config_api_key: "pat.secret.key",
    });

    expect(body).toEqual({
      identifier: "deploy-svc",
      values: {
        env: "prod",
        harnessToken: "user.token",
        secretKey: "pat.secret.key",
      },
    });
  });

  it("redacts apiKeySecret values in debug logs but keeps them in the wire payload", () => {
    getExecuteSpec().bodyBuilder!({
      body: {
        workflow_details: { identifier: "deploy-svc", yaml: WORKFLOW_YAML },
      },
      __config_api_key: "pat.super-secret",
    });

    expect(stderrSpy).toHaveBeenCalled();
    const logLine = stderrSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logLine).toContain("[REDACTED]");
    expect(logLine).not.toContain("pat.super-secret");
  });

  it("prefers body.api_key_secret over the config fallback", () => {
    const body = getExecuteSpec().bodyBuilder!({
      body: {
        workflow_details: { identifier: "wf", yaml: WORKFLOW_YAML },
        api_key_secret: "user-supplied-key",
      },
      __config_api_key: "config-key",
    });

    expect((body as { values: Record<string, string> }).values.secretKey).toBe("user-supplied-key");
  });

  it("fails loud when apiKeySecret is required but no key is available", () => {
    expect(() =>
      getExecuteSpec().bodyBuilder!({
        body: {
          workflow_details: { identifier: "wf", yaml: WORKFLOW_YAML },
        },
      }),
    ).toThrow(/Missing apiKeySecret/);
  });

  it("requires workflow_details with a parseable yaml field", () => {
    expect(() => getExecuteSpec().bodyBuilder!({ body: {} })).toThrow(/workflow_details is required/);
    expect(() =>
      getExecuteSpec().bodyBuilder!({
        body: { workflow_details: { identifier: "wf", yaml: 42 } },
      }),
    ).toThrow(/yaml is missing or not a string/);
  });
});
