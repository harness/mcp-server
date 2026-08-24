/**
 * Deep links for v1 pipelines must carry the pipeline identifier.
 *
 * Regression: the template asked for {pipelineIdentifier} while v1 paths name the
 * param {pipeline}, so openInHarness came back with the placeholder intact
 * (".../pipelines/{pipelineIdentifier}/pipeline-studio"). ml-infra forwards that
 * URL verbatim in its entity_mutation event, which broke the chat redirect.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

function makeV1Config(): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "",
    HARNESS_PROJECT: "",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0,
    LOG_LEVEL: "error",
    HARNESS_PIPELINE_VERSION: "1",
  } as Config;
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("pipeline_v1 deep links", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("resolves the identifier from a create response that only returns `identifier`", async () => {
    // PipelineCreateResponseBody carries no name or pipelineIdentifier field.
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({ identifier: "hello_harness", governance_metadata: {} }),
    );

    const config = makeV1Config();
    const registry = new Registry(config);
    const result = (await registry.dispatch(new HarnessClient(config), "pipeline_v1", "create", {
      org_id: "avitest",
      project_id: "avi",
      body: {
        identifier: "hello_harness",
        name: "Hello Harness",
        pipeline_yaml: "pipeline:\n  name: Hello Harness\n",
      },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/testaccount/all/orgs/avitest/projects/avi/pipelines/hello_harness/pipeline-studio",
    );
  });

  it("resolves the identifier on update, where it comes from the input", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ identifier: "hello_harness" }));

    const config = makeV1Config();
    const registry = new Registry(config);
    const result = (await registry.dispatch(new HarnessClient(config), "pipeline_v1", "update", {
      org_id: "avitest",
      project_id: "avi",
      pipeline_id: "hello_harness",
      store_type: "INLINE",
      body: {
        identifier: "hello_harness",
        pipeline_yaml: "pipeline:\n  name: Hello Harness\n",
      },
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/testaccount/all/orgs/avitest/projects/avi/pipelines/hello_harness/pipeline-studio",
    );
  });
});
