import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveLogContent } from "../../src/utils/log-resolver.js";
import { gzipSync, deflateRawSync } from "node:zlib";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";

function makeClient(
  requestFn: (...args: unknown[]) => unknown,
  overrides?: Partial<Pick<HarnessClient, "baseURL" | "requestStream">>,
): HarnessClient {
  return {
    request: requestFn,
    requestStream: vi.fn().mockResolvedValue(new Response("", { status: 200 })),
    account: "test-account",
    baseURL: "https://custom.harness.example/gateway",
    ...overrides,
  } as unknown as HarnessClient;
}

/** Build a minimal ZIP file with a single entry. */
function buildZip(fileName: string, content: string): Buffer {
  const fileNameBuf = Buffer.from(fileName, "utf-8");
  const uncompressed = Buffer.from(content, "utf-8");
  const compressed = deflateRawSync(uncompressed);

  // Local file header (30 + nameLen + compressed)
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // signature
  localHeader.writeUInt16LE(20, 4);          // version needed
  localHeader.writeUInt16LE(0, 6);           // flags
  localHeader.writeUInt16LE(8, 8);           // method: DEFLATE
  localHeader.writeUInt32LE(0, 14);          // crc32 (simplified)
  localHeader.writeUInt32LE(compressed.length, 18);   // compressed size
  localHeader.writeUInt32LE(uncompressed.length, 22); // uncompressed size
  localHeader.writeUInt16LE(fileNameBuf.length, 26);  // file name length
  localHeader.writeUInt16LE(0, 28);                   // extra length

  return Buffer.concat([localHeader, fileNameBuf, compressed]);
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLogContent", () => {
  it("downloads and returns plain text log content", async () => {
    const logText = "line 1\nline 2\nline 3";
    const streamFn = vi.fn().mockResolvedValue(new Response(logText, { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/blob" }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "acct/pipeline/p1/1/-exec1");
    expect(result).toContain("line 1");
    expect(result).toContain("line 2");
    expect(result).toContain("line 3");
  });

  it("polls until status becomes success", async () => {
    const requestFn = vi.fn()
      .mockResolvedValueOnce({ status: "queued", link: null })
      .mockResolvedValueOnce({ status: "queued", link: null })
      .mockResolvedValueOnce({ status: "success", link: "https://logs.example.com/blob" });

    const streamFn = vi.fn().mockResolvedValue(new Response("log output", { status: 200 }));
    const client = makeClient(requestFn, { requestStream: streamFn });

    const result = await resolveLogContent(client, "prefix", { pollIntervalMs: 10 });
    expect(result).toContain("log output");
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it("throws after exhausting poll attempts", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ status: "queued" }));

    await expect(
      resolveLogContent(client, "prefix", { maxPollAttempts: 2, pollIntervalMs: 10 }),
    ).rejects.toThrow(/not ready after 2 attempts/);
  });

  it("handles gzip-compressed log content", async () => {
    const logText = "gzipped log line 1\ngzipped log line 2";
    const gzipped = gzipSync(Buffer.from(logText));
    const streamFn = vi.fn().mockResolvedValue(new Response(gzipped, { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/gz" }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");
    expect(result).toContain("gzipped log line 1");
    expect(result).toContain("gzipped log line 2");
  });

  it("handles ZIP archive with log files", async () => {
    const zipBuf = buildZip("logs.txt", "zip entry log content");
    const streamFn = vi.fn().mockResolvedValue(new Response(zipBuf, { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/zip" }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");
    expect(result).toContain("zip entry log content");
  });

  it("parses JSON log entries and strips ANSI codes", async () => {
    const jsonLogs = [
      '{"level":"INFO","time":"2026-03-09T17:01:23Z","out":"\\u001b[32m+ mvn clean install\\u001b[0m"}',
      '{"level":"ERROR","time":"2026-03-09T17:01:45Z","out":"BUILD FAILURE"}',
    ].join("\n");

    const streamFn = vi.fn().mockResolvedValue(new Response(jsonLogs, { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/json" }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");
    expect(result).toContain("mvn clean install");
    expect(result).toContain("BUILD FAILURE");
    expect(result).not.toContain("\x1b[");
  });

  it("returns (empty log output) for empty content", async () => {
    const streamFn = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/empty" }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");
    expect(result).toBe("(empty log output)");
  });

  it("throws on download failure", async () => {
    const streamFn = vi.fn().mockResolvedValue(new Response("Not Found", { status: 404 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/fail" }),
      { requestStream: streamFn },
    );

    await expect(resolveLogContent(client, "prefix")).rejects.toThrow(/HTTP 404/);
  });

  it("uses external storage URL as-is (GCS — no host rewrite)", async () => {
    const blobLink = "https://storage.googleapis.com/harness-logs/bucket/path/logs.zip?Expires=123";
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: blobLink }));
    fetchSpy.mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(fetchSpy).toHaveBeenCalledWith(blobLink, expect.any(Object));
  });

  it("routes non-external blob URL through client.requestStream with gateway prefix", async () => {
    const blobLink = "https://harness0.harness.io/some/blob/path?token=abc";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://myhost.harness.io/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/gateway/log-service/some/blob/path?token=abc",
      }),
    );
  });

  it("REGRESSION routes Harness-hosted pre-signed blob URLs through client.requestStream", async () => {
    const blobLink = "https://app.harness.io/some/blob/path?X-Amz-Signature=sig&token=abc";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { requestStream: streamFn },
    );
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/some/blob/path?X-Amz-Signature=sig&token=abc",
      }),
    );
  });

  it("REGRESSION routes Harness-hosted pre-signed blob URLs with explicit ports through client.requestStream", async () => {
    const blobLink = "https://app.harness.io:443/some/blob/path?X-Goog-Signature=sig&token=abc";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { requestStream: streamFn },
    );
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/some/blob/path?X-Goog-Signature=sig&token=abc",
      }),
    );
  });

  it("direct-fetches true external storage pre-signed URLs", async () => {
    const blobLink = "https://bucket.s3.us-west-2.amazonaws.com/logs.zip?X-Amz-Signature=sig";
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: blobLink }));
    fetchSpy.mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(fetchSpy).toHaveBeenCalledWith(blobLink, expect.any(Object));
    expect(client.requestStream).not.toHaveBeenCalled();
  });

  it("normalizes relative blob paths before adding the gateway prefix", async () => {
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "some/blob/path?token=abc" }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/gateway/log-service/some/blob/path?token=abc",
      }),
    );
  });

  it("preserves HarnessApiError details from client-routed blob downloads", async () => {
    const apiError = new HarnessApiError("Forbidden", 403, "FORBIDDEN", "corr-123");
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/blob" }),
      { requestStream: vi.fn().mockRejectedValue(apiError) },
    );

    await expect(resolveLogContent(client, "prefix")).rejects.toBe(apiError);
  });

  it("throws when log file exceeds max size", async () => {
    const bigContent = "x".repeat(1024);
    const streamFn = vi.fn().mockResolvedValue(new Response(bigContent, {
      status: 200,
      headers: { "content-length": String(20 * 1024 * 1024) },
    }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/big" }),
      { requestStream: streamFn },
    );

    await expect(
      resolveLogContent(client, "prefix", { maxLogSizeBytes: 1024 }),
    ).rejects.toThrow(/too large/);
  });
});
