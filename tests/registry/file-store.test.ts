import { describe, expect, it, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "test-project",
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

function makeClient(requestFn: ReturnType<typeof vi.fn>): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("File Store registry toolset", () => {
  it("lists File Store metadata with expected query params", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file-store" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { content: [], totalElements: 0 } });

    await registry.dispatch(makeClient(mockRequest), "file_store_item", "list", {
      search_term: "config",
      page: 0,
      size: 25,
      identifiers: ["file-a", "file-b"],
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("GET");
    expect(call.path).toBe("/ng/api/file-store");
    expect(call.params).toMatchObject({
      orgIdentifier: "default",
      projectIdentifier: "test-project",
      searchTerm: "config",
      pageIndex: 0,
      pageSize: 25,
      identifiers: ["file-a", "file-b"],
    });
  });

  it("creates a file using multipart form data", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file-store" }));
    const mockRequest = vi.fn().mockResolvedValue({ data: { identifier: "config_file" } });

    await registry.dispatch(makeClient(mockRequest), "file_store_item", "create", {
      body: {
        name: "config.yaml",
        type: "FILE",
        content: "key: value\n",
        mime_type: "application/x-yaml",
      },
    });

    const call = mockRequest.mock.calls[0][0];
    expect(call.method).toBe("POST");
    expect(call.path).toBe("/ng/api/file-store");
    expect(call.body).toBeInstanceOf(FormData);
    const form = call.body as FormData;
    expect(form.get("name")).toBe("config.yaml");
    expect(form.get("type")).toBe("FILE");
    expect(form.get("parentIdentifier")).toBe("Root");
    expect(form.get("mimeType")).toBe("application/x-yaml");
    expect(form.get("content")).toBeInstanceOf(Blob);
  });

  it("hydrates required update metadata before writing file content", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file-store" }));
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({
        data: {
          identifier: "config_file",
          name: "config.yaml",
          type: "FILE",
          parentIdentifier: "Root",
        },
      })
      .mockResolvedValueOnce({ data: { identifier: "config_file" } });

    await registry.dispatch(makeClient(mockRequest), "file_store_item", "update", {
      file_id: "config_file",
      body: {
        content: "key: new-value\n",
        mime_type: "application/x-yaml",
      },
    });

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[0][0]).toMatchObject({
      method: "GET",
      path: "/ng/api/file-store/config_file",
    });
    const updateCall = mockRequest.mock.calls[1][0];
    expect(updateCall).toMatchObject({
      method: "PUT",
      path: "/ng/api/file-store/config_file",
    });
    const form = updateCall.body as FormData;
    expect(form.get("name")).toBe("config.yaml");
    expect(form.get("type")).toBe("FILE");
    expect(form.get("parentIdentifier")).toBe("Root");
    expect(form.get("content")).toBeInstanceOf(Blob);
  });

  it("reads UTF-8 file content from the download endpoint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "file-store" }));
    const mockRequest = vi.fn().mockResolvedValue(new TextEncoder().encode("hello").buffer);

    const result = await registry.dispatch(makeClient(mockRequest), "file_store_content", "get", {
      file_id: "hello_txt",
    });

    expect(mockRequest.mock.calls[0][0]).toMatchObject({
      method: "GET",
      path: "/ng/api/file-store/files/hello_txt/download",
      responseType: "buffer",
    });
    expect(result).toEqual({
      content: "hello",
      encoding: "utf-8",
      size: 5,
      truncated: false,
    });
  });
});
