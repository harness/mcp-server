/**
 * Harness Code's /content/{path} endpoint always base64-encodes file content
 * (gitness content_get.go: FileContent.Encoding is always "base64"). These
 * tests cover the decoded content.text field, the truncation flag, and
 * client-side base64 validation on commit-files writes.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";
import { fileContentGetExtract } from "../../src/registry/toolsets/repositories.js";

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

describe("fileContentGetExtract", () => {
  it("decodes base64 file content into content.text", () => {
    const raw = {
      type: "file",
      sha: "abc123",
      content: {
        encoding: "base64",
        data: Buffer.from("hello world", "utf8").toString("base64"),
        size: 11,
        data_size: 11,
      },
    };
    const result = fileContentGetExtract(raw) as { content: { text?: string; _truncated?: boolean } };
    expect(result.content.text).toBe("hello world");
    expect(result.content._truncated).toBeUndefined();
  });

  it("flags truncated content when data_size < size", () => {
    const raw = {
      type: "file",
      content: {
        encoding: "base64",
        data: Buffer.from("partial", "utf8").toString("base64"),
        size: 20_000_000,
        data_size: 7,
      },
    };
    const result = fileContentGetExtract(raw) as { content: { _truncated?: boolean; _hint?: string } };
    expect(result.content._truncated).toBe(true);
    expect(result.content._hint).toMatch(/truncated/i);
  });

  it("leaves content.data intact alongside the decoded text", () => {
    const data = Buffer.from("keep me", "utf8").toString("base64");
    const raw = { type: "file", content: { encoding: "base64", data, size: 7, data_size: 7 } };
    const result = fileContentGetExtract(raw) as { content: { data?: string } };
    expect(result.content.data).toBe(data);
  });

  it("passes through directory listings unchanged (no content.encoding)", () => {
    const raw = { type: "dir", entries: [{ name: "README.md", type: "file" }] };
    expect(fileContentGetExtract(raw)).toEqual(raw);
  });

  it("passes through non-base64 content unchanged (e.g. symlink target)", () => {
    const raw = { type: "symlink", content: { target: "../other/path" } };
    expect(fileContentGetExtract(raw)).toEqual(raw);
  });

  it("omits content.text for binary content that isn't valid UTF-8", () => {
    // 0xFF 0xFE is not a valid UTF-8 byte sequence.
    const data = Buffer.from([0xff, 0xfe, 0x00, 0x01]).toString("base64");
    const raw = { type: "file", content: { encoding: "base64", data, size: 4, data_size: 4 } };
    const result = fileContentGetExtract(raw) as { content: { text?: string; data?: string } };
    expect(result.content.text).toBeUndefined();
    expect(result.content.data).toBe(data);
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

  it("strips embedded whitespace from a base64 payload before sending (Go's decoder rejects it)", async () => {
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
