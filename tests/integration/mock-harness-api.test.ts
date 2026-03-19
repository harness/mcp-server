/**
 * Integration tests with a mock Harness API.
 *
 * Tests the full request flow from Registry dispatch through HarnessClient
 * to mocked fetch responses, validating URL construction, auth headers,
 * query params, body building, response extraction, and error handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import { HarnessApiError } from "../../src/utils/errors.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.testaccount.tokenid.secret",
    HARNESS_ACCOUNT_ID: "testaccount",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 0, // No retries for tests
    LOG_LEVEL: "error",
    ...overrides,
  };
}

function mockFetchResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Integration: Registry → HarnessClient → fetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe("pipeline list", () => {
    it("sends correct URL, headers, and body for pipeline list", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({
          status: "SUCCESS",
          data: {
            content: [
              { identifier: "deploy-prod", name: "Deploy to Production" },
              { identifier: "build-test", name: "Build and Test" },
            ],
            totalElements: 2,
            totalPages: 1,
          },
        }),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      const result = (await registry.dispatch(client, "pipeline", "list", {
        org_id: "default",
        project_id: "test-project",
        search_term: "deploy",
        page: 0,
        size: 10,
      })) as { items: unknown[]; total: number };

      // Verify fetch was called
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0]!;
      const urlStr = url instanceof URL ? url.toString() : String(url);

      // Verify URL structure
      expect(urlStr).toContain("app.harness.io");
      expect(urlStr).toContain("/pipeline/api/pipelines/list");
      expect(urlStr).toContain("orgIdentifier=default");
      expect(urlStr).toContain("projectIdentifier=test-project");
      expect(urlStr).toContain("searchTerm=deploy");
      expect(urlStr).toContain("page=0");
      expect(urlStr).toContain("size=10");

      // Verify auth header
      const headers = (options as RequestInit)?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("pat.testaccount.tokenid.secret");

      // Verify method
      expect((options as RequestInit)?.method).toBe("POST");

      // Verify response extraction
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  describe("pipeline get", () => {
    it("resolves path params and extracts response", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({
          status: "SUCCESS",
          data: {
            identifier: "my-pipeline",
            name: "My Pipeline",
            yamlPipeline: "pipeline:\n  name: My Pipeline",
          },
        }),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      const result = (await registry.dispatch(client, "pipeline", "get", {
        org_id: "default",
        project_id: "test-project",
        pipeline_id: "my-pipeline",
      })) as Record<string, unknown>;

      const [url] = fetchSpy.mock.calls[0]!;
      const urlStr = String(url);

      // Path param substitution
      expect(urlStr).toContain("/pipeline/api/pipelines/my-pipeline");
      // Scope params present
      expect(urlStr).toContain("orgIdentifier=default");

      // Response extracted from data wrapper
      expect(result.identifier).toBe("my-pipeline");
      expect(result.yamlPipeline).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("throws HarnessApiError for 401 unauthorized", async () => {
      const mock401Body = {
        status: "ERROR",
        code: "INVALID_TOKEN",
        message: "Token is invalid or expired",
        correlationId: "corr-123",
      };
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mock401Body, 401));
      fetchSpy.mockResolvedValueOnce(mockFetchResponse(mock401Body, 401));

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      await expect(
        registry.dispatch(client, "pipeline", "list", {}),
      ).rejects.toThrow(HarnessApiError);

      try {
        await registry.dispatch(client, "pipeline", "list", {});
      } catch (err) {
        // The first call already threw — this will too, but let's catch for assertion
        if (err instanceof HarnessApiError) {
          expect(err.statusCode).toBe(401);
        }
      }
    });

    it("throws HarnessApiError for 404 not found", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse(
          {
            status: "ERROR",
            code: "RESOURCE_NOT_FOUND",
            message: "Pipeline not found",
          },
          404,
        ),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      try {
        await registry.dispatch(client, "pipeline", "get", { pipeline_id: "missing" });
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(404);
      }
    });

    it("throws HarnessApiError for 500 server error", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ status: "ERROR", message: "Internal server error" }, 500),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      try {
        await registry.dispatch(client, "pipeline", "list", {});
        expect.unreachable();
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(500);
      }
    });
  });

  describe("scope injection", () => {
    it("injects org and project for project-scoped resources when provided in input", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ status: "SUCCESS", data: { content: [], totalElements: 0 } }),
      );

      const config = makeConfig({
        HARNESS_DEFAULT_ORG_ID: "my-org",
        HARNESS_DEFAULT_PROJECT_ID: "my-project",
      });
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      await registry.dispatch(client, "pipeline", "list", {
        org_id: "my-org",
        project_id: "my-project",
      });

      const [url] = fetchSpy.mock.calls[0]!;
      const urlStr = String(url);
      expect(urlStr).toContain("orgIdentifier=my-org");
      expect(urlStr).toContain("projectIdentifier=my-project");
    });

    it("allows overriding org and project via input", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ status: "SUCCESS", data: { content: [], totalElements: 0 } }),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      await registry.dispatch(client, "pipeline", "list", {
        org_id: "custom-org",
        project_id: "custom-project",
      });

      const [url] = fetchSpy.mock.calls[0]!;
      const urlStr = String(url);
      expect(urlStr).toContain("orgIdentifier=custom-org");
      expect(urlStr).toContain("projectIdentifier=custom-project");
    });
  });

  describe("body building", () => {
    it("pipeline create sends YAML body with correct Content-Type", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({ status: "SUCCESS", data: { identifier: "new-pipe" } }),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      const yaml = "pipeline:\n  name: New Pipeline\n  identifier: new-pipe";
      await registry.dispatch(client, "pipeline", "create", {
        body: { yamlPipeline: yaml },
      });

      const [, options] = fetchSpy.mock.calls[0]!;
      const init = options as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/yaml");
      // Body is the raw YAML string
      expect(init.body).toBe(yaml);
    });
  });

  describe("execution lifecycle", () => {
    it("list → get flow works end-to-end", async () => {
      // List executions
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({
          status: "SUCCESS",
          data: {
            content: [
              { planExecutionId: "exec-1", status: "Failed", pipelineIdentifier: "deploy" },
            ],
            totalElements: 1,
          },
        }),
      );

      const config = makeConfig();
      const client = new HarnessClient(config);
      const registry = new Registry(config);

      const listResult = (await registry.dispatch(client, "execution", "list", {
        status: "Failed",
      })) as { items: Array<{ planExecutionId: string }> };

      expect(listResult.items).toHaveLength(1);
      const execId = listResult.items[0]!.planExecutionId;

      // Get execution details
      fetchSpy.mockResolvedValueOnce(
        mockFetchResponse({
          status: "SUCCESS",
          data: {
            pipelineExecutionSummary: {
              planExecutionId: execId,
              status: "Failed",
              pipelineIdentifier: "deploy",
              executionErrorInfo: { message: "Step 3 failed" },
            },
          },
        }),
      );

      const getResult = (await registry.dispatch(client, "execution", "get", {
        execution_id: execId,
      })) as Record<string, unknown>;

      expect(getResult).toBeDefined();
    });
  });
});
