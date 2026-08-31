/**
 * Deep links for AI agents must carry the agent UID.
 *
 * Regression: the template used {agentIdentifier} while create/get responses
 * only return `id` (the UID), so openInHarness kept the placeholder
 * (".../agents/{agentIdentifier}/details"). Chat navigated to that URL as-is.
 *
 * Correct UI 2.0 path (same layout as the worker-agents list):
 * /ng/account/{accountId}/all/ai-agents/orgs/{org}/projects/{project}/agents/{id}
 *
 * Create with only `id`/`uid` (no `agent_id` on input) is what would have caught
 * the original bug. List also has no `agent_id`; items must not include `name`
 * or the registry would fill the placeholder from name without the extractor.
 * Get already has `agent_id` on input — it only asserts the new path string.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "",
    HARNESS_PROJECT: "",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0,
    LOG_LEVEL: "error",
  } as Config;
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const EXPECTED_PATH =
  "https://app.harness.io/ng/account/testaccount/all/ai-agents/orgs/default/projects/aiTeam/agents/pipeline_lister_agent";
const EXPECTED_CUSTOM_LINK = `${EXPECTED_PATH}?type=custom`;
const EXPECTED_SYSTEM_LINK = `${EXPECTED_PATH}?type=system`;

const createBody = {
  uid: "pipeline_lister_agent",
  name: "Pipeline Lister Agent",
  spec: "agent:\n  name: Pipeline Lister Agent\n",
};

describe("agent deep links", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("resolves {agentIdentifier} from a create response that only returns `id`", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ id: "pipeline_lister_agent" }));

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "create", {
      org_id: "default",
      project_id: "aiTeam",
      body: createBody,
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(EXPECTED_PATH);
    expect(String(result.openInHarness)).not.toContain("{agentIdentifier}");
  });

  it("resolves {agentIdentifier} from a create response that only returns `uid`", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ uid: "pipeline_lister_agent" }));

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "create", {
      org_id: "default",
      project_id: "aiTeam",
      body: createBody,
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(EXPECTED_PATH);
  });

  it("resolves {agentIdentifier} from a { data: { id } } create envelope", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: { id: "pipeline_lister_agent" },
      }),
    );

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "create", {
      org_id: "default",
      project_id: "aiTeam",
      body: createBody,
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(EXPECTED_PATH);
    expect(result.identifier).toBe("pipeline_lister_agent");
  });

  it("resolves {agentIdentifier} from list items that only have `id`", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse([{ id: "pipeline_lister_agent" }]));

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "list", {
      org_id: "default",
      project_id: "aiTeam",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]!.openInHarness).toBe(EXPECTED_PATH);
    expect(result.items[0]!.identifier).toBe("pipeline_lister_agent");
    expect(String(result.items[0]!.openInHarness)).not.toContain("{agentIdentifier}");
  });

  it("resolves {agentIdentifier} from a { data: [{ id }] } list envelope", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: [{ id: "pipeline_lister_agent" }],
      }),
    );

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "list", {
      org_id: "default",
      project_id: "aiTeam",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]!.openInHarness).toBe(EXPECTED_PATH);
    expect(result.items[0]!.identifier).toBe("pipeline_lister_agent");
  });

  it("uses the UI 2.0 ai-agents path on get (agent_id is already on the input)", async () => {
    fetchSpy.mockResolvedValueOnce(mockFetchResponse({ id: "pipeline_lister_agent" }));

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "get", {
      org_id: "default",
      project_id: "aiTeam",
      agent_id: "pipeline_lister_agent",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(EXPECTED_PATH);
  });

  it("appends ?type=custom when create/get role is custom", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({ id: "pipeline_lister_agent", role: "custom" }),
    );

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "create", {
      org_id: "default",
      project_id: "aiTeam",
      body: createBody,
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(EXPECTED_CUSTOM_LINK);
  });

  it("appends ?type=system for list items with role system", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse([{ id: "pipeline_lister_agent", role: "system" }]),
    );

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "list", {
      org_id: "default",
      project_id: "aiTeam",
    })) as { items: Array<Record<string, unknown>> };

    expect(result.items[0]!.openInHarness).toBe(EXPECTED_SYSTEM_LINK);
  });

  it("resolves {agentIdentifier} from a { data: { id } } get envelope", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockFetchResponse({
        status: "SUCCESS",
        data: { id: "pipeline_lister_agent", role: "custom" },
      }),
    );

    const registry = new Registry(makeConfig());
    const result = (await registry.dispatch(new HarnessClient(makeConfig()), "agent", "get", {
      org_id: "default",
      project_id: "aiTeam",
      agent_id: "pipeline_lister_agent",
    })) as Record<string, unknown>;

    expect(result.openInHarness).toBe(EXPECTED_CUSTOM_LINK);
    expect(result.identifier).toBe("pipeline_lister_agent");
  });
});
