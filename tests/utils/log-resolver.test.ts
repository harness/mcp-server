import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveLogContent } from "../../src/utils/log-resolver.js";
import { gzipSync, deflateRawSync } from "node:zlib";
import type { HarnessClient } from "../../src/client/harness-client.js";

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

  // ── Regression tests: Harness-internal hosts with pre-signed params ──────────
  // Pre-signed params on app.harness.io or any *.harness.io host do NOT mean
  // the URL is publicly routable. Internal/on-prem deployments proxy these through
  // their own host. The fix: only bypass client routing for TRUE external storage.

  it("REGRESSION: app.harness.io pre-signed URL routes through client.requestStream, not direct fetch", async () => {
    const blobLink =
      "https://app.harness.io/storage/logs/blob.zip?X-Amz-Signature=abc123&X-Amz-Expires=900";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"log from internal harness"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log from internal harness");
    // Must route through client — NOT bypass via direct fetch
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("/storage/logs/blob.zip") }),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("harness.io"),
      expect.any(Object),
    );
  });

  it("REGRESSION: custom.harness.io pre-signed URL routes through client.requestStream, not direct fetch", async () => {
    const blobLink =
      "https://custom.harness.io/storage/blob?X-Goog-Signature=sig&X-Goog-Expires=3600";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"internal gcs proxy log"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("internal gcs proxy log");
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("/storage/blob") }),
    );
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("harness.io"),
      expect.any(Object),
    );
  });

  // ── On-prem / custom-gateway invariant ───────────────────────────────────────
  // INVARIANT: any *.harness.io blob URL — with or without pre-signed params —
  // MUST route through client.requestStream(), never global fetch().
  // This has broken TWICE (PR #189, fixed in PR #195). If you change routing
  // logic and this test fails, you are re-introducing the same bug.

  it("REGRESSION: app.harness.io blob with custom gateway baseURL routes through client", async () => {
    // On-prem/self-managed scenario: HARNESS_BASE_URL points to a custom gateway host,
    // but the blob link returned by log-service still points to app.harness.io.
    // app.harness.io is not directly reachable — must go through client.requestStream().
    const blobLink =
      "https://app.harness.io/gateway/log-service/blob/download?accountId=jLO&X-Amz-Signature=tok";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"on-prem log line"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://custom-gateway.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("on-prem log line");
    expect(streamFn).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("app.harness.io"),
      expect.any(Object),
    );
  });

  it("REGRESSION: app.harness.io URL with explicit port still classified as Harness host", async () => {
    // URL.host includes port (app.harness.io:443) — isHarnessHost must use .hostname not .host
    const blobLink =
      "https://app.harness.io:443/gateway/log-service/blob/download?X-Amz-Signature=tok";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"port log"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://custom-gateway.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("port log");
    expect(streamFn).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("harness.io"),
      expect.any(Object),
    );
  });

  it("true S3 pre-signed URL still uses direct fetch (external storage host)", async () => {
    const blobLink =
      "https://harness-prod-logs.s3.us-east-1.amazonaws.com/logs.zip?X-Amz-Signature=abc&X-Amz-Expires=900";
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: blobLink }));
    fetchSpy.mockResolvedValue(new Response('{"out":"s3 log line"}', { status: 200 }));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("s3 log line");
    // True external S3 → direct fetch is correct
    expect(fetchSpy).toHaveBeenCalledWith(blobLink, expect.any(Object));
  });

  it("true GCS pre-signed URL still uses direct fetch (external storage host)", async () => {
    const blobLink =
      "https://storage.googleapis.com/harness-logs/run.zip?X-Goog-Signature=sig&X-Goog-Expires=3600";
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: blobLink }));
    fetchSpy.mockResolvedValue(new Response('{"out":"gcs log line"}', { status: 200 }));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("gcs log line");
    expect(fetchSpy).toHaveBeenCalledWith(blobLink, expect.any(Object));
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
