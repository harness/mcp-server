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
import { fileContentGetExtract, fileContentListExtract } from "../../src/registry/extractors.js";
import { normalizeCodeFilePath } from "../../src/registry/toolsets/repositories.js";

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

  it("keeps slashes in nested paths instead of encoding them as %2F", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: { encoding: "base64", data: "YQ==" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "src/index.ts",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content/src/index.ts",
    }));
  });

  it("encodes spaces in path segments but still keeps slashes", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: { encoding: "base64", data: "YQ==" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "docs/my file.md",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content/docs/my%20file.md",
    }));
  });

  it("treats empty or omitted path as the repo root listing", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "dir", content: { entries: [] } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "",
    });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content",
    }));

    mockRequest.mockClear();
    await registry.dispatch(client, "file_content", "get", { repo_id: "my-repo" });
    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content",
    }));
  });

  it("strips leading slashes so /README.md hits the same tree path as README.md", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: { encoding: "base64", data: "YQ==" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "/README.md",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content/README.md",
    }));
  });

  it("aliases branch onto git_ref and forwards flatten_directories", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "dir", content: { entries: [] } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "src",
      branch: "develop",
      flatten_directories: true,
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        git_ref: "develop",
        flatten_directories: true,
      }),
    }));
  });

  it("does not guess main when git_ref is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: { encoding: "base64", data: "YQ==" } });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "file_content", "get", {
      repo_id: "my-repo",
      path: "README.md",
    });

    const params = (mockRequest.mock.calls[0]![0] as { params: Record<string, unknown> }).params;
    expect(params.git_ref).toBeUndefined();
  });
});

describe("file_content list — Code GET /paths", () => {
  it("lists file paths and optional directories as items", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({
      files: ["README.md", "src/index.ts"],
      directories: ["src"],
    });
    const client = makeClient(mockRequest);

    const result = (await registry.dispatch(client, "file_content", "list", {
      repo_id: "my-repo",
      git_ref: "main",
      include_directories: true,
    })) as { items: Array<{ path: string; type: string }>; total: number };

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/code/api/v1/repos/my-repo/paths",
      params: expect.objectContaining({
        git_ref: "main",
        include_directories: true,
      }),
    }));
    expect(result.total).toBe(3);
    expect(result.items).toEqual([
      expect.objectContaining({ path: "README.md", type: "file" }),
      expect.objectContaining({ path: "src/index.ts", type: "file" }),
      expect.objectContaining({ path: "src", type: "directory" }),
    ]);
    expect(result.items[1]).toEqual(expect.objectContaining({
      openInHarness: expect.stringContaining("/repos/my-repo/files/main/~/src%2Findex.ts"),
    }));
  });

  it("fileContentListExtract ignores non-string entries", () => {
    expect(fileContentListExtract({ files: ["a.ts", 1], directories: [null, "src"] })).toEqual({
      items: [
        { path: "a.ts", filePath: "a.ts", type: "file" },
        { path: "src", filePath: "src", type: "directory" },
      ],
      total: 2,
      files: ["a.ts"],
      directories: ["src"],
    });
  });
});

describe("normalizeCodeFilePath", () => {
  it("strips leading slashes, trailing slashes, and backslashes", () => {
    expect(normalizeCodeFilePath("/src/index.ts")).toBe("src/index.ts");
    expect(normalizeCodeFilePath("src\\index.ts")).toBe("src/index.ts");
    expect(normalizeCodeFilePath("src/")).toBe("src");
    expect(normalizeCodeFilePath("")).toBe("");
    expect(normalizeCodeFilePath(".")).toBe("");
  });
});

describe("file_content blame path encoding", () => {
  it("keeps slashes in blame paths", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue([]);
    const client = makeClient(mockRequest);

    await registry.dispatchExecute(client, "file_content", "blame", {
      repo_id: "my-repo",
      path: "src/main.go",
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/blame/src/main.go",
    }));
  });

  it("rejects blame on the repo root", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatchExecute(client, "file_content", "blame", { repo_id: "my-repo", path: "" }),
    ).rejects.toThrow(/path/);
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe("fileContentGetExtract", () => {
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

  it("copies actions.text onto payload", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Update file",
        branch: "main",
        actions: [{ action: "UPDATE", path: "a.txt", sha: "abc", text: "from-text" }],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      body: { actions: Array<{ payload?: string; text?: unknown }> };
    };
    expect(call.body.actions[0]!.payload).toBe("from-text");
    expect(call.body.actions[0]!.text).toBeUndefined();
  });

  it("uses content when payload is an empty string", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Update file",
        branch: "main",
        actions: [{ action: "UPDATE", path: "a.txt", sha: "abc", payload: "", content: "from-content" }],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { actions: Array<{ payload?: string }> } };
    expect(call.body.actions[0]!.payload).toBe("from-content");
  });

  it("copies nested content.data onto payload and sets encoding base64", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);
    const data = Buffer.from([0, 1, 2, 255]).toString("base64");

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Update binary",
        branch: "main",
        actions: [
          {
            action: "UPDATE",
            path: "blob.bin",
            sha: "abc123",
            content: { data },
          },
        ],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      body: { actions: Array<{ payload?: string; encoding?: string; content?: unknown }> };
    };
    expect(call.body.actions[0]!.payload).toBe(data);
    expect(call.body.actions[0]!.encoding).toBe("base64");
    expect(call.body.actions[0]!.content).toBeUndefined();
  });

  it("rejects UPDATE with an empty payload so the file is not wiped", async () => {
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

  it("rejects CREATE when payload is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn();
    const client = makeClient(mockRequest);

    await expect(
      registry.dispatch(client, "commit", "create", {
        repo_id: "my-repo",
        body: {
          title: "Add file",
          branch: "main",
          actions: [{ action: "CREATE", path: "notes.txt" }],
        },
      }),
    ).rejects.toThrow(/payload is required/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("allows CREATE with an explicit empty payload", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Add empty file",
        branch: "main",
        actions: [{ action: "CREATE", path: ".gitkeep", payload: "" }],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { actions: Array<{ payload?: string }> } };
    expect(call.body.actions[0]!.payload).toBe("");
  });

  it("allows MOVE without file bytes (payload is the destination path)", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Rename file",
        branch: "main",
        actions: [{ action: "MOVE", path: "old.txt", payload: "new.txt", sha: "abc" }],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      body: { actions: Array<{ payload?: string; content?: unknown }> };
    };
    expect(call.body.actions[0]!.payload).toBe("new.txt");
    expect(mockRequest).toHaveBeenCalled();
  });

  it("does not reject MOVE when payload is omitted", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Rename file",
        branch: "main",
        actions: [{ action: "MOVE", path: "old.txt" }],
      },
    });

    expect(mockRequest).toHaveBeenCalled();
  });

  it("does not copy file-content aliases onto MOVE payload", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ commit_id: "sha1", files: [] });
    const client = makeClient(mockRequest);

    await registry.dispatch(client, "commit", "create", {
      repo_id: "my-repo",
      body: {
        title: "Rename file",
        branch: "main",
        actions: [
          { action: "MOVE", path: "old.txt", payload: "new.txt", content: "file-bytes-must-not-replace-dest" },
        ],
      },
    });

    const call = mockRequest.mock.calls[0]![0] as { body: { actions: Array<{ payload?: string }> } };
    expect(call.body.actions[0]!.payload).toBe("new.txt");
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

describe("file_content describe metadata", () => {
  it("advertises list, get, blame, and related aliases", () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const def = registry.getResource("file_content");
    expect(def.operations.list).toBeDefined();
    expect(def.operations.get).toBeDefined();
    expect(def.executeActions?.blame).toBeDefined();
    expect(def.searchAliases).toEqual(expect.arrayContaining(["file", "blob", "blame"]));
    expect(def.relatedResources?.map((r) => r.resourceType)).toEqual(
      expect.arrayContaining(["repository", "branch", "commit"]),
    );
    expect(def.diagnosticHint).toMatch(/omit git_ref/i);
    expect(def.listFilterFields?.map((f) => f.name)).toEqual(
      expect.arrayContaining(["git_ref", "include_directories"]),
    );
  });
});

describe("file_content harness_get resource_id mapping", () => {
  it("does not overwrite an explicit empty path with resource_id", async () => {
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    const tools = new Map<string, (args: Record<string, unknown>) => Promise<{ isError?: boolean }>>();
    const server = {
      registerTool: (_name: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<{ isError?: boolean }>) => {
        tools.set("harness_get", handler);
      },
    };
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "dir", content: { entries: [] } });
    registerGetTool(server as never, registry, makeClient(mockRequest));

    await tools.get("harness_get")!({
      resource_type: "file_content",
      resource_id: "README.md",
      params: { repo_id: "my-repo", path: "" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content",
    }));
  });

  it("maps resource_id onto path when path is omitted", async () => {
    const { registerGetTool } = await import("../../src/tools/harness-get.js");
    const tools = new Map<string, (args: Record<string, unknown>) => Promise<{ isError?: boolean }>>();
    const server = {
      registerTool: (_name: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<{ isError?: boolean }>) => {
        tools.set("harness_get", handler);
      },
    };
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({ type: "file", content: { encoding: "base64", data: "YQ==" } });
    registerGetTool(server as never, registry, makeClient(mockRequest));

    await tools.get("harness_get")!({
      resource_type: "file_content",
      resource_id: "README.md",
      params: { repo_id: "my-repo" },
    });

    expect(mockRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: "/code/api/v1/repos/my-repo/content/README.md",
    }));
  });
});

describe("file_content list compact", () => {
  it("keeps path, type, and openInHarness after harness_list compact", async () => {
    const { registerListTool } = await import("../../src/tools/harness-list.js");
    const tools = new Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>>();
    const server = {
      registerTool: (_name: string, _schema: unknown, handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>) => {
        tools.set("harness_list", handler);
      },
    };
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "repositories" }));
    const mockRequest = vi.fn().mockResolvedValue({
      files: ["src/index.ts"],
      directories: [],
    });
    registerListTool(server as never, registry, makeClient(mockRequest));

    const result = await tools.get("harness_list")!({
      resource_type: "file_content",
      params: { repo_id: "my-repo", git_ref: "main" },
    });
    const payload = JSON.parse(result.content[0]!.text) as {
      items: Array<{ path?: string; type?: string; openInHarness?: string; filePath?: string }>;
    };
    expect(payload.items[0]).toEqual(expect.objectContaining({
      path: "src/index.ts",
      type: "file",
      openInHarness: expect.stringContaining("/repos/my-repo/files/main/~/src%2Findex.ts"),
    }));
    expect(payload.items[0]?.filePath).toBeUndefined();
  });
});
