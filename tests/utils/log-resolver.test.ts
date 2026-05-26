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

  // ── Regression tests: Harness CDN blob URLs ──────────────────────────────────
  // The Harness log-service always returns blob links pointing to
  // app.harness.io/storage/... regardless of HARNESS_BASE_URL. On self-managed
  // deployments app.harness.io is not directly reachable, but the CDN is accessible
  // via the configured base URL host (e.g. self-managed.example.com/storage/...).
  //
  // INVARIANT: *.harness.io pre-signed blob links must have their hostname rewritten
  // to match the configured baseURL host and then be fetched directly. Routing through
  // client.requestStream() was tried (PR #195) but produces 403 because the API gateway
  // doesn't serve /storage/... CDN paths.
  //
  // This has broken THREE times. If this test fails you are re-introducing the bug.

  it("REGRESSION: app.harness.io pre-signed blob URL is host-rewritten to baseURL host and direct-fetched", async () => {
    // The log-service returns app.harness.io/storage/... but the client is configured
    // with a custom base URL. Rewrite hostname to baseURL.hostname + direct fetch.
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip?X-Amz-Signature=abc123&X-Amz-Expires=900";
    fetchSpy.mockResolvedValue(new Response('{"out":"log from internal harness"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://custom-gateway.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log from internal harness");
    // STRICT: must use direct fetch with the rewritten URL — NOT client.requestStream()
    // Routing through requestStream sends self-managed.example.com/gateway/storage/... which 403s
    // because the API gateway does not serve /storage CDN paths.
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("custom-gateway.example.com/storage/harness-download/logs.zip"),
      expect.any(Object),
    );
    expect(streamFn).not.toHaveBeenCalled();
    // STRICT: the fetch URL must NOT contain /gateway/storage — that path produces 403
    const fetchUrl = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]![0] as string;
    expect(fetchUrl).not.toContain("/gateway/storage");
  });

  it("REGRESSION: app.harness.io blob URL with explicit port is host-rewritten correctly", async () => {
    // URL.host includes port (app.harness.io:443) — must use .hostname not .host
    const blobLink =
      "https://app.harness.io:443/storage/harness-download/logs.zip?X-Amz-Signature=tok";
    fetchSpy.mockResolvedValue(new Response('{"out":"port log"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://custom-gateway.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("port log");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("custom-gateway.example.com/storage/harness-download/logs.zip"),
      expect.any(Object),
    );
    // STRICT: requestStream must NOT be called — it would produce gateway/storage/... → 403
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("STRICT: non-presigned Harness URLs route through requestStream with gateway prefix, not direct fetch", async () => {
    // Standard log-service API paths (no pre-signed params) must go through the client
    // so auth headers (PAT/JWT) are injected. These are API paths, not CDN paths.
    const blobLink = "https://app.harness.io/gateway/log-service/blob/some-path";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"api log"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://custom-gateway.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("api log");
    // Must go through client — API paths require auth injection
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringContaining("/gateway/log-service/blob/some-path") }),
    );
    // STRICT: must NOT be a direct fetch to app.harness.io (blocked) or gateway/storage (wrong)
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("app.harness.io"),
      expect.any(Object),
    );
  });

  it("STRICT: host-bound presigned CDN URL on self-managed instance rewrites hostname (original host unreachable)", async () => {
    // When X-Amz-SignedHeaders includes `host` AND blob hostname differs from base URL hostname,
    // rewrite anyway — the original app.harness.io is not reachable on self-managed networks.
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip" +
      "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
      "&X-Amz-Credential=GOOG1EXAMPLEKEY%2F20260516%2Fus-east-1%2Fs3%2Faws4_request" +
      "&X-Amz-Date=20260516T040000Z" +
      "&X-Amz-Expires=86400" +
      "&X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=abc123def456";
    fetchSpy.mockResolvedValue(new Response('{"out":"sig preserved"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("self-managed.example.com");
    expect(fetchUrl).not.toContain("app.harness.io");
    expect(fetchUrl).toContain("X-Amz-Signature=abc123def456");
    expect(fetchUrl).toContain("X-Amz-Expires=86400");
    expect(fetchUrl).toContain("X-Amz-SignedHeaders=host");
    expect(fetchUrl).toContain("/storage/harness-download/logs.zip");
    expect(fetchUrl).not.toContain("/gateway/storage");
  });

  it("STRICT: host-bound presigned CDN URL on matching-host SaaS is fetched as-is — no rewrite needed", async () => {
    // When X-Amz-SignedHeaders includes `host` AND blob hostname already matches base URL hostname,
    // skip rewriting — the signature is valid for direct fetch and rewrite would be a no-op.
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip" +
      "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
      "&X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=abc123def456";
    fetchSpy.mockResolvedValue(new Response('{"out":"saas direct"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://app.harness.io" },
    );

    await resolveLogContent(client, "prefix");

    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("app.harness.io");
    expect(fetchUrl).toContain("X-Amz-Signature=abc123def456");
    expect(fetchUrl).toContain("X-Amz-SignedHeaders=host");
    expect(fetchUrl).toContain("/storage/harness-download/logs.zip");
  });

  it("STRICT: GCS host-bound presigned CDN URL on self-managed instance rewrites hostname", async () => {
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip" +
      "?X-Goog-Algorithm=GOOG4-RSA-SHA256" +
      "&X-Goog-SignedHeaders=host" +
      "&X-Goog-Signature=gcs-sig" +
      "&X-Goog-Expires=3600";
    fetchSpy.mockResolvedValue(new Response('{"out":"gcs host-bound"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("self-managed.example.com");
    expect(fetchUrl).not.toContain("app.harness.io");
    expect(fetchUrl).toContain("X-Goog-Signature=gcs-sig");
    expect(fetchUrl).toContain("X-Goog-SignedHeaders=host");
    expect(fetchUrl).not.toContain("/gateway/storage");
  });

  it("STRICT: pre-signed query params are preserved exactly after host rewrite when not host-bound", async () => {
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip" +
      "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
      "&X-Amz-Credential=GOOG1EXAMPLEKEY%2F20260516%2Fus-east-1%2Fs3%2Faws4_request" +
      "&X-Amz-Date=20260516T040000Z" +
      "&X-Amz-Expires=86400" +
      "&X-Amz-SignedHeaders=content-type" +
      "&X-Amz-Signature=abc123def456";
    fetchSpy.mockResolvedValue(new Response('{"out":"sig preserved"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("self-managed.example.com");
    expect(fetchUrl).not.toContain("app.harness.io");
    expect(fetchUrl).toContain("X-Amz-Signature=abc123def456");
    expect(fetchUrl).toContain("X-Amz-Expires=86400");
    expect(fetchUrl).toContain("X-Amz-SignedHeaders=content-type");
    expect(fetchUrl).toContain("/storage/harness-download/logs.zip");
    expect(fetchUrl).not.toContain("/gateway/storage");
  });

  it("STRICT: GCS pre-signed URL on Harness CDN is also host-rewritten (not gateway-routed)", async () => {
    // The Harness CDN sometimes uses GCS-backend pre-signed URLs with X-Goog-Signature.
    // Same routing rules apply — host rewrite + direct fetch, NOT requestStream.
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip?X-Goog-Signature=gcs-sig&X-Goog-Expires=3600";
    fetchSpy.mockResolvedValue(new Response('{"out":"gcs cdn log"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("gcs cdn log");
    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("self-managed.example.com/storage/harness-download/logs.zip");
    expect(fetchUrl).toContain("X-Goog-Signature=gcs-sig");
    expect(fetchUrl).not.toContain("/gateway/storage");
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("STRICT: S3/GCS external hosts are NOT host-rewritten — original URL fetched as-is", async () => {
    // External storage (amazonaws.com, googleapis.com) must NOT have hostname rewritten.
    // The pre-signed signature is host-bound; changing the host invalidates it.
    const blobLink =
      "https://harness-logs.s3.amazonaws.com/logs.zip?X-Amz-Signature=real-sig&X-Amz-Expires=900";
    fetchSpy.mockResolvedValue(new Response('{"out":"s3 log"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    // Original URL unchanged — rewriting would break the AWS signature
    expect(fetchSpy).toHaveBeenCalledWith(blobLink, expect.any(Object));
    expect(fetchSpy.mock.calls[0]![0]).not.toContain("self-managed.example.com");
    expect(streamFn).not.toHaveBeenCalled();
  });

  it("STRICT: non-default port in baseURL is preserved in rewritten blob URL", async () => {
    // If baseURL is https://gateway.example.com:8443/gateway, the rewritten URL must be
    // https://gateway.example.com:8443/storage/... — not https://gateway.example.com/storage/...
    // Dropping the port would send traffic to the wrong server.
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip?X-Amz-Signature=sig&X-Amz-Expires=900";
    fetchSpy.mockResolvedValue(new Response('{"out":"port preserved"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://gateway.example.com:8443/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const fetchUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(fetchUrl).toContain("gateway.example.com:8443/storage/harness-download/logs.zip");
    expect(fetchUrl).not.toContain("app.harness.io");
  });

  it("STRICT: unparseable baseURL throws instead of fetching original blocked URL", async () => {
    // If HARNESS_BASE_URL is misconfigured and unparseable, we must NOT fall back to
    // direct-fetching app.harness.io (which is blocked on self-managed nets → TypeError).
    // A clear error is better than a cryptic network failure.
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip?X-Amz-Signature=sig&X-Amz-Expires=900";
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "not-a-valid-url" },
    );

    await expect(resolveLogContent(client, "prefix")).rejects.toThrow(/HARNESS_BASE_URL.*not a valid URL/);
    // Must NOT have attempted to fetch app.harness.io
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("app.harness.io"),
      expect.any(Object),
    );
  });

  it("STRICT: presigned *.harness.io URL on non-/storage/ path routes through requestStream, not direct fetch", async () => {
    // A *.harness.io URL carrying X-Amz-Signature on a log-service API path (not /storage/...)
    // must go through client.requestStream() for auth injection — Strategy 2 only applies to
    // CDN /storage/ paths. Without the /storage/ guard, this would be misrouted as a CDN blob.
    const blobLink =
      "https://app.harness.io/gateway/log-service/blob/download?accountId=jLO&X-Amz-Signature=tok&X-Amz-Expires=900";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"api path log"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("api path log");
    // Must route through client (auth headers needed for API paths)
    expect(streamFn).toHaveBeenCalled();
    // Must NOT be direct-fetched — API paths require auth, CDN guard prevents misclassification
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
