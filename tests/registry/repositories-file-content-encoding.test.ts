/**
 * Harness Code's /content/{path} endpoint always base64-encodes file content
 * (FileContent.Encoding is always "base64"). These tests cover the decoded
 * content.text field, the truncation flag, and client-side base64
 * validation on commit-files writes.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { fileContentGetExtract } from "../../src/registry/extractors.js";

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

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

describe("file_content get — dispatched through the registry", () => {
  it("decodes base64 file content into content.text and drops content.data", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({
      type: "file",
      sha: "abc123",
      content: {
        encoding: "base64",
        data: Buffer.from("hello world", "utf8").toString("base64"),
        size: 11,
        data_size: 11,
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "README.md",
    })) as { content: { text?: string; data?: string; encoding?: string; _truncated?: boolean; _hint?: string } };

    expect(result.content.text).toBe("hello world");
    expect(result.content.data).toBeUndefined();
    expect(result.content.encoding).toBe("utf8");
    expect(result.content._truncated).toBeUndefined();
    expect(result.content._hint).toBeUndefined();
  });

  it("flags truncated content when data_size < size", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({
      type: "file",
      content: {
        encoding: "base64",
        data: Buffer.from("partial", "utf8").toString("base64"),
        size: 20_000_000,
        data_size: 7,
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "big-file.bin",
    })) as { content: { _truncated?: boolean; _hint?: string } };

    expect(result.content._truncated).toBe(true);
    expect(result.content._hint).toMatch(/truncated/i);
  });

  it("keeps content.data and sets a hint for binary content that isn't valid UTF-8", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    // 0xFF 0xFE is not a valid UTF-8 byte sequence.
    const data = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    const mockRequest = vi.fn().mockResolvedValue({
      type: "file",
      content: { encoding: "base64", data, size: 4, data_size: 4 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "logo.png",
    })) as { content: { text?: string; data?: string; _hint?: string } };

    expect(result.content.text).toBeUndefined();
    expect(result.content.data).toBe(data);
    expect(result.content.encoding).toBe("base64");
    expect(result.content._hint).toMatch(/binary/i);
  });

  it("keeps content.data and sets a hint when the server's declared base64 is malformed", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({
      type: "file",
      content: { encoding: "base64", data: "not-valid-base64!!", size: 18, data_size: 18 },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "weird-file.bin",
    })) as { content: { text?: string; data?: string; _hint?: string } };

    expect(result.content.text).toBeUndefined();
    expect(result.content.data).toBe("not-valid-base64!!");
    expect(result.content._hint).toMatch(/malformed/i);
  });

  it("flags Git LFS pointer content with a hint", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const pointer = "version https://git-lfs.github.com/spec/v1\noid sha256:abc\nsize 123\n";
    const mockRequest = vi.fn().mockResolvedValue({
      type: "file",
      content: {
        encoding: "base64",
        data: Buffer.from(pointer, "utf8").toString("base64"),
        size: pointer.length,
        data_size: pointer.length,
        lfs_object_id: "abc123",
      },
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "asset.psd",
    })) as { content: { text?: string; _hint?: string } };

    expect(result.content.text).toBe(pointer);
    expect(result.content._hint).toMatch(/LFS pointer/i);
  });

  it("passes through directory listings unchanged (no content.encoding)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const raw = { type: "dir", entries: [{ name: "README.md", type: "file" }] };
    const mockRequest = vi.fn().mockResolvedValue(raw);
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "src",
    });

    expect(result).toEqual(raw);
  });

  it("passes through non-base64 content unchanged (e.g. symlink target)", () => {
    const raw = { type: "symlink", content: { target: "../other/path" } };
    expect(fileContentGetExtract(raw)).toEqual(raw);
  });
});

describe("commit create — client-side base64 validation", () => {
  it("rejects a malformed base64 payload before calling the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "commit", "create", {
        repo_id: "my-repo",
        body: {
          title: "Add binary file",
          branch: "main",
          actions: [
            { action: "CREATE", path: "logo.png", payload: "not-valid-base64!!", encoding: "base64" },
          ],
        },
      }),
    ).rejects.toThrow(/valid base64/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("allows a valid base64 payload through to the API", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);
    const payload = Buffer.from("binary-ish content", "utf8").toString("base64");

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Add file",
        branch: "main",
        actions: [{ action: "CREATE", path: "data.bin", payload, encoding: "base64" }],
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "POST",
      path: "/code/api/v1/repos/my-repo/commits",
    }));
  });

  it("strips embedded whitespace from a base64 payload before sending (the backend rejects it)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);
    const rawPayload = Buffer.from("wrapped base64 payload", "utf8").toString("base64");
    // Simulate a caller that wrapped/pretty-printed the base64 across lines.
    const wrappedPayload = `${rawPayload.slice(0, 4)}\n${rawPayload.slice(4)}`;

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Add file",
        branch: "main",
        actions: [{ action: "CREATE", path: "data.bin", payload: wrappedPayload, encoding: "base64" }],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { actions: Array<{ payload: string }> } };
    expect(call.body.actions[0]!.payload).toBe(rawPayload);
  });

  it("copies actions.content onto payload (file_content GET shape) and drops the alias", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);
    const yaml = "apiVersion: apps/v1\nkind: Deployment\n";

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Update deployment",
        branch: "main",
        actions: [
          { action: "UPDATE", path: "k8s/deployment.yaml", sha: "abc123", content: yaml },
        ],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      body: { actions: Array<{ payload?: string; content?: unknown; text?: unknown }> };
    };
    expect(call.body.actions[0]!.payload).toBe(yaml);
    expect(call.body.actions[0]!.content).toBeUndefined();
    expect(call.body.actions[0]!.text).toBeUndefined();
  });

  it("copies nested content.text onto payload", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Update file",
        branch: "main",
        actions: [
          {
            action: "UPDATE",
            path: "README.md",
            sha: "abc123",
            content: { text: "# hello", encoding: "utf8" },
          },
        ],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { actions: Array<{ payload?: string }> } };
    expect(call.body.actions[0]!.payload).toBe("# hello");
  });

  it("prefers payload over content when both are set", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Update file",
        branch: "main",
        actions: [
          { action: "UPDATE", path: "a.txt", sha: "abc", payload: "keep-me", content: "ignore-me" },
        ],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { actions: Array<{ payload?: string }> } };
    expect(call.body.actions[0]!.payload).toBe("keep-me");
  });

  it("rejects CREATE/UPDATE with an empty payload so the file is not wiped", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "commit", "create", {
        repo_id: "my-repo",
        body: {
          title: "Wipe file",
          branch: "main",
          actions: [{ action: "UPDATE", path: "k8s/deployment.yaml", sha: "abc" }],
        },
      }),
    ).rejects.toThrow(/payload is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("allows DELETE without a payload", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Delete file",
        branch: "main",
        actions: [{ action: "DELETE", path: "gone.txt" }],
      },
    });

    expect(mockRequest).toHaveBeenCalled();
  });

  it("does not validate utf8-encoded payloads as base64", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Add text file",
        branch: "main",
        actions: [{ action: "CREATE", path: "notes.txt", payload: "plain text!", encoding: "utf8" }],
      },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({ method: "POST" }));
  });
});
