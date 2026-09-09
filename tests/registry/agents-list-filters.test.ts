/**
 * Verifies agent list forwards search/sort/pagination query params to the agents API,
 * matching platformUI Worker Agents tab (search, sort, order).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { agentsToolset } from "../../src/registry/toolsets/agents.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { ResourceDefinition } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "aiTeam",
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
    request: requestFn ?? vi.fn().mockResolvedValue([]),
    account: "test-account",
  } as unknown as HarnessClient;
}

function findAgentResource(): ResourceDefinition {
  const res = agentsToolset.resources.find((r) => r.resourceType === "agent");
  if (!res) throw new Error('Resource type "agent" not found');
  return res;
}

describe("agent list filters", () => {
  let registry: Registry;

  beforeEach(() => {
    registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "agents" }));
  });

  it("registers listFilterFields and queryParams on agent list", () => {
    const resource = findAgentResource();
    const filterNames = resource.listFilterFields?.map((f) => f.name) ?? [];
    expect(filterNames).toEqual(["search_term", "sort", "order", "page", "size"]);

    const sortField = resource.listFilterFields?.find((f) => f.name === "sort");
    expect(sortField?.enum).toEqual(["created", "last_modified", "name"]);

    const list = resource.operations.list;
    expect(list?.queryParams).toMatchObject({
      search_term: "search",
      sort: "sort",
      order: "order",
      page: "page",
      size: "size",
    });
  });

  it("forwards search_term as search query param", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "list", {
      org_id: "my-org",
      project_id: "my-project",
      search_term: "code reviewer",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/gateway/agents/api/v1/agents");
    expect(call.params.search).toBe("code reviewer");
  });

  it("forwards sort and order query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "list", {
      org_id: "my-org",
      project_id: "my-project",
      sort: "name",
      order: "asc",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.sort).toBe("name");
    expect(call.params.order).toBe("asc");
  });

  it("forwards page and size query params", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "list", {
      org_id: "my-org",
      project_id: "my-project",
      page: 1,
      size: 25,
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.page).toBe(1);
    expect(call.params.size).toBe(25);
  });

  it("omits filter query params when not provided", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "list", {
      org_id: "my-org",
      project_id: "my-project",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.search).toBeUndefined();
    expect(call.params.sort).toBeUndefined();
    expect(call.params.order).toBeUndefined();
    expect(call.params.page).toBeUndefined();
    expect(call.params.size).toBeUndefined();
  });

  it("includes org/project scope params alongside filters", async () => {
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "agent", "list", {
      org_id: "my-org",
      project_id: "my-project",
      search_term: "devops",
      sort: "last_modified",
      order: "desc",
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.params.orgIdentifier).toBe("my-org");
    expect(call.params.projectIdentifier).toBe("my-project");
    expect(call.params.search).toBe("devops");
    expect(call.params.sort).toBe("last_modified");
    expect(call.params.order).toBe("desc");
  });
});
