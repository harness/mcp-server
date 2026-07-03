/**
 * Regression tests for idp_workflow execute: auth-parameter auto-injection,
 * request body shape, and dispatch integration.
 *
 * The bodyBuilder inspects workflow_details.yaml spec.steps[] to fill
 * HarnessAuthToken-style parameters — incorrect injection breaks workflow runs
 * or leaks credentials via logging (console.* is forbidden in toolsets).
 */
import { describe, it, expect, vi } from "vitest";
import { idpToolset } from "../../src/registry/toolsets/idp.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

const WORKFLOW_YAML_WITH_AUTH = `spec:
  steps:
    - input:
        apikey: \${{ parameters.harnessToken }}
        apiKeySecret: \${{ parameters.apiKeyParam }}
`;

const WORKFLOW_YAML_APIKEY_ONLY = `spec:
  steps:
    - input:
        apikey: \${{ parameters.harnessToken }}
`;

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.testtoken.testsecret",
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
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

function makeClient(requestFn?: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn ?? vi.fn().mockResolvedValue({ status: "SUCCESS", data: { executionId: "exec-1" } }),
    account: "test-account",
  } as unknown as HarnessClient;
}

function getExecuteAction() {
  const resource = idpToolset.resources.find((r) => r.resourceType === "idp_workflow");
  if (!resource) throw new Error("idp_workflow resource missing");
  const action = resource.executeActions?.execute;
  if (!action?.bodyBuilder) throw new Error("idp_workflow execute action or bodyBuilder missing");
  return action;
}

function buildBody(
  input: Record<string, unknown>,
  configApiKey = "pat.testaccount.testtoken.testsecret",
) {
  const action = getExecuteAction();
  const enriched = { ...input, __config_api_key: configApiKey };
  return action.bodyBuilder!(enriched) as { identifier: string; values: Record<string, unknown> };
}

describe("idp_workflow execute bodyBuilder", () => {
  it("throws when workflow_details is missing", () => {
    expect(() => buildBody({ body: {} })).toThrow(/workflow_details is required/);
  });

  it("throws when workflow_details.yaml is missing or not a string", () => {
    expect(() =>
      buildBody({
        body: { workflow_details: { identifier: "wf-1" } },
      }),
    ).toThrow(/workflow_details\.yaml is missing or not a string/);
  });

  it("throws when workflow identifier cannot be resolved", () => {
    expect(() =>
      buildBody({
        body: {
          workflow_details: { yaml: WORKFLOW_YAML_APIKEY_ONLY },
        },
      }),
    ).toThrow(/missing required parameter: workflow identifier/);
  });

  it("auto-fills apikey parameter refs with the user.token placeholder", () => {
    const body = buildBody({
      body: {
        identifier: "my-workflow",
        workflow_details: {
          identifier: "my-workflow",
          yaml: WORKFLOW_YAML_APIKEY_ONLY,
        },
        values: { otherParam: "x" },
      },
    });

    expect(body).toEqual({
      identifier: "my-workflow",
      values: {
        otherParam: "x",
        harnessToken: "user.token",
      },
    });
  });

  it("fills apiKeySecret refs from body.api_key_secret when provided", () => {
    const body = buildBody({
      body: {
        identifier: "my-workflow",
        workflow_details: {
          identifier: "my-workflow",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        api_key_secret: "user-supplied-key",
        values: {},
      },
    });

    expect(body.values.harnessToken).toBe("user.token");
    expect(body.values.apiKeyParam).toBe("user-supplied-key");
  });

  it("falls back to HARNESS_API_KEY for apiKeySecret when body omits api_key_secret", () => {
    const body = buildBody(
      {
        body: {
          identifier: "my-workflow",
          workflow_details: {
            identifier: "my-workflow",
            yaml: WORKFLOW_YAML_WITH_AUTH,
          },
          values: {},
        },
      },
      "config-fallback-api-key",
    );

    expect(body.values.apiKeyParam).toBe("config-fallback-api-key");
  });

  it("throws when apiKeySecret is required but neither body nor config provides a key", () => {
    expect(() =>
      buildBody(
        {
          body: {
            identifier: "my-workflow",
            workflow_details: {
              identifier: "my-workflow",
              yaml: WORKFLOW_YAML_WITH_AUTH,
            },
            values: {},
          },
        },
        "",
      ),
    ).toThrow(/Missing apiKeySecret/);
  });

  it("does not overwrite user-supplied values for auth parameter refs", () => {
    const body = buildBody({
      body: {
        identifier: "my-workflow",
        workflow_details: {
          identifier: "my-workflow",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        values: {
          harnessToken: "already-set",
          apiKeyParam: "already-set-secret",
        },
      },
    });

    expect(body.values.harnessToken).toBe("already-set");
    expect(body.values.apiKeyParam).toBe("already-set-secret");
  });

  it("resolves identifier from workflow_details.identifier when body.identifier is omitted", () => {
    const body = buildBody({
      workflow_id: "from-resource-id",
      body: {
        workflow_details: {
          identifier: "from-workflow-details",
          yaml: WORKFLOW_YAML_APIKEY_ONLY,
        },
      },
    });

    expect(body.identifier).toBe("from-workflow-details");
  });

  it("does not call console.* during body construction", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    buildBody({
      body: {
        identifier: "my-workflow",
        workflow_details: {
          identifier: "my-workflow",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        api_key_secret: "secret",
      },
    });

    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe("idp_workflow dispatchExecute", () => {
  it("POSTs to /v2/workflows/execute with injected auth values in the request body", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      status: "SUCCESS",
      data: { executionId: "exec-99" },
    });
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "idp_workflow", "execute", {
      org_id: "default",
      project_id: "test-project",
      body: {
        identifier: "deploy-service",
        workflow_details: {
          identifier: "deploy-service",
          yaml: WORKFLOW_YAML_WITH_AUTH,
        },
        values: { serviceName: "payments" },
      },
    });

    expect(mockRequest).toHaveBeenCalledOnce();
    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/v2/workflows/execute");
    expect(call.params).toMatchObject({
      orgIdentifier: "default",
      projectIdentifier: "test-project",
    });
    expect(call.body).toEqual({
      identifier: "deploy-service",
      orgIdentifier: "default",
      projectIdentifier: "test-project",
      values: {
        serviceName: "payments",
        harnessToken: "user.token",
        apiKeyParam: "pat.testaccount.testtoken.testsecret",
      },
    });
  });

  it("execute action declares high_write risk (confirmation-gated)", () => {
    const action = getExecuteAction();
    expect(action.operationPolicy).toEqual({
      risk: "high_write",
      retryPolicy: "do_not_retry",
    });
  });
});
