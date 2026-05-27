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

  // ─── REGRESSION GUARD: blob hostname rewriting (breaks repeatedly) ──────────
  //
  // This logic has regressed multiple times. Every strategy change in
  // downloadBlobContent() MUST leave all tests below green. The invariants:
  //
  //   A) blob host ≠ base URL host  →  ALWAYS rewrite (even when host in SignedHeaders)
  //      Rationale: original app.harness.io is unreachable on self-managed nets.
  //   B) blob host = base URL host  →  skip rewrite when host is in SignedHeaders
  //      Rationale: signature already valid; rewriting is a no-op anyway.
  //   C) requestStream must NEVER be called for /storage/ CDN blob URLs.
  //   D) External S3/GCS host URLs bypass rewriting entirely (Strategy 1).

  it("REGRESSION-GUARD [A]: self-managed instance (corp.harness.example) + host in SignedHeaders → rewrites to corp host", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=sig123" +
      "&X-Amz-Expires=3600";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://corp.harness.example/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("corp.harness.example");
    expect(url).not.toContain("app.harness.io");
    expect(url).toContain("X-Amz-Signature=sig123");
    expect(url).toContain("/storage/blob.zip");
  });

  it("REGRESSION-GUARD [A]: multiple headers in SignedHeaders including host → self-managed still rewrites", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=content-type%3Bhost%3Bx-amz-date" +
      "&X-Amz-Signature=multi123";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.corp.example/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.corp.example");
    expect(url).not.toContain("app.harness.io");
    expect(url).toContain("X-Amz-Signature=multi123");
  });

  it("REGRESSION-GUARD [A]: SignedHeaders host value is case-insensitive → self-managed rewrites", async () => {
    // The check must handle 'Host', 'HOST', 'host' — all the same
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=Host" +
      "&X-Amz-Signature=case123";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("app.harness.io");
  });

  it("REGRESSION-GUARD [B]: SaaS base URL = app.harness.io + host in SignedHeaders → no rewrite, direct fetch", async () => {
    // Standard SaaS: blob URL host matches base URL host — no rewrite needed.
    // If rewrite were applied it would be a no-op, but it must NOT be applied to
    // preserve the original URL for cases where signature covers the Host header.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=saas456";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://app.harness.io" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("app.harness.io");
    expect(url).toContain("/storage/blob.zip");
    expect(url).toContain("X-Amz-Signature=saas456");
  });

  it("REGRESSION-GUARD [B]: GCS blob, host in X-Goog-SignedHeaders, base = app.harness.io → no rewrite", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Goog-SignedHeaders=host" +
      "&X-Goog-Signature=gcssaas789";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://app.harness.io" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("app.harness.io");
    expect(url).not.toContain("self-managed");
    expect(url).toContain("X-Goog-Signature=gcssaas789");
  });

  it("REGRESSION-GUARD [C]: requestStream is NEVER called for host-bound /storage/ CDN blob on self-managed", async () => {
    // Strategy 2 (direct fetch with host rewrite) must handle this — not Strategy 3 (requestStream).
    // If requestStream is called, it would prepend /gateway/log-service/ → 404.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=s1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(streamFn).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
  });

  it("REGRESSION-GUARD [A]: network error after host rewrite surfaces rewritten hostname in error message", async () => {
    // When the rewritten URL is also unreachable, the error must name the rewritten host —
    // not app.harness.io — so operators know the rewrite happened and look at the right host.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=err1";
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await expect(resolveLogContent(client, "prefix")).rejects.toThrow("self-managed.example.com");
  });

  it("REGRESSION-GUARD [A]: self-managed with non-default port + host in SignedHeaders → rewrites with port preserved", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=port1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://corp.harness.example:8443/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("corp.harness.example:8443");
    expect(url).not.toContain("app.harness.io");
    expect(url).toContain("/storage/blob.zip");
  });

  it("REGRESSION-GUARD [A]: non-host-bound URL on self-managed always rewrites (unchanged baseline)", async () => {
    // SignedHeaders that do NOT include host — rewrite must happen regardless of this fix.
    // Guards against the fix accidentally narrowing the rewrite condition too far.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=content-type%3Bx-amz-date" +
      "&X-Amz-Signature=noh1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("app.harness.io");
    expect(url).toContain("X-Amz-Signature=noh1");
  });

  it("REGRESSION-GUARD [A+C]: host-bound blob returns HTTP 403 after rewrite — error propagates, requestStream not attempted", async () => {
    // When CDN returns 403 (e.g. host-bound signature mismatch after rewrite), the error
    // must be surfaced immediately. Strategy 3 (requestStream) must NOT be tried as fallback.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=sig403";
    fetchSpy.mockResolvedValue(new Response("Forbidden", { status: 403 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await expect(resolveLogContent(client, "prefix")).rejects.toThrow(/HTTP 403/);
    expect(streamFn).not.toHaveBeenCalled();
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
  });

  // ─── Extended coverage: every routing branch and edge case ──────────────────
  //
  // Strategy 1 (external S3/GCS) — direct fetch, no rewrite, no auth headers
  // Strategy 2 (*.harness.io /storage/ CDN) — rewrite hostname, direct fetch
  // Strategy 3 (everything else) — requestStream via gateway prefix

  // ── Strategy 1 edge cases ───────────────────────────────────────────────────

  it("Strategy 1: regional S3 bucket URL is fetched directly (external host)", async () => {
    const blobLink = "https://my-bucket.s3.us-east-1.amazonaws.com/logs/run.zip?X-Amz-Signature=s1&X-Amz-Expires=3600";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(streamFn).not.toHaveBeenCalled();
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("my-bucket.s3.us-east-1.amazonaws.com");
    expect(url).not.toContain("self-managed.example.com");
  });

  it("Strategy 1: regional S3 path-style URL is fetched directly (external host)", async () => {
    // my-bucket.s3.us-west-2.amazonaws.com matches S3_BUCKET_HOST_RE → external storage.
    const blobLink = "https://my-bucket.s3.us-west-2.amazonaws.com/logs/run.zip?X-Amz-Signature=s2";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("s3.us-west-2.amazonaws.com");
    expect(url).not.toContain("self-managed.example.com");
  });

  it("Strategy 1: GCS subdomain bucket URL is fetched directly (external host)", async () => {
    const blobLink = "https://my-bucket.storage.googleapis.com/logs/run.zip?X-Goog-Signature=gcs1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("storage.googleapis.com");
    expect(url).not.toContain("self-managed.example.com");
  });

  it("Strategy 1 beats Strategy 2: S3 URL with host in X-Amz-SignedHeaders is still direct-fetched as external", async () => {
    // isExternalStorageHost takes priority over the /storage/ presigned-URL path.
    // An S3 URL must never be routed through Strategy 2 (Harness CDN rewrite).
    const blobLink = "https://my-bucket.s3.amazonaws.com/storage/run.zip?X-Amz-Signature=s3&X-Amz-SignedHeaders=host";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const streamFn = vi.fn();
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(streamFn).not.toHaveBeenCalled();
    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("s3.amazonaws.com");
    expect(url).not.toContain("self-managed.example.com");
  });

  // ── Strategy 2 edge cases ───────────────────────────────────────────────────

  it("Strategy 2: baseURL without a path suffix still rewrites hostname correctly", async () => {
    // Covers: baseURL = "https://corp.example.com" (no /gateway path).
    const blobLink = "https://app.harness.io/storage/blob.zip?X-Amz-Signature=np1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://corp.example.com" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("corp.example.com");
    expect(url).not.toContain("app.harness.io");
    expect(url).not.toContain("/gateway");
    expect(url).toContain("/storage/blob.zip");
  });

  it("Strategy 2: protocol is also rewritten when baseURL uses HTTP", async () => {
    const blobLink = "https://app.harness.io/storage/blob.zip?X-Amz-Signature=http1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "http://corp-internal.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toMatch(/^http:\/\/corp-internal\.example\.com/);
    expect(url).not.toContain("https://app.harness.io");
  });

  it("Strategy 2: non-app.harness.io Harness host in blob URL is still host-rewritten on self-managed", async () => {
    // qa.harness.io is a valid Harness SaaS host — isHarnessHost matches it.
    // When baseURL points to a different self-managed host, it must be rewritten.
    const blobLink = "https://qa.harness.io/storage/blob.zip?X-Amz-Signature=qa1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("qa.harness.io");
  });

  it("Strategy 2: GCS blob on self-managed (no host in SignedHeaders) — rewrites hostname", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Goog-Algorithm=GOOG4-RSA-SHA256" +
      "&X-Goog-SignedHeaders=content-type" +
      "&X-Goog-Signature=gcsnoh1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("app.harness.io");
    expect(url).toContain("X-Goog-Signature=gcsnoh1");
  });

  it("Strategy 2: X-Amz-SignedHeaders with host at end of semicolon list — self-managed still rewrites", async () => {
    // Checks the split+includes logic handles trailing position correctly.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=x-amz-date%3Bcontent-type%3Bhost" +
      "&X-Amz-Signature=tailhost1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("app.harness.io");
  });

  it("Strategy 2: X-Amz-SignedHeaders present but empty — treated as not including host, rewrite happens", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=" +
      "&X-Amz-Signature=empty1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("app.harness.io");
  });

  it("Strategy 2: presigned URL path is exactly /storage/ with no further segments — still rewritten", async () => {
    const blobLink = "https://app.harness.io/storage/?X-Amz-Signature=root1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).toContain("/storage/");
  });

  it("Strategy 2 not triggered: presigned app.harness.io URL on /api/ path routes to requestStream", async () => {
    // /api/ does not start with /storage/ — must go to Strategy 3, not Strategy 2.
    const blobLink =
      "https://app.harness.io/api/logs/stream" +
      "?X-Amz-Signature=api1" +
      "&X-Amz-SignedHeaders=host";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(streamFn).toHaveBeenCalledTimes(1);
  });

  // ── Strategy 3 edge cases ───────────────────────────────────────────────────

  it("Strategy 3: URL already starting with /gateway/log-service/ is not double-prefixed", async () => {
    const blobLink = "/gateway/log-service/blob/download?prefix=abc";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(fetchSpy).not.toHaveBeenCalled();
    const calledPath = (streamFn.mock.calls[0]![0] as { path: string }).path;
    expect(calledPath).toMatch(/^\/gateway\/log-service\//);
    expect(calledPath).not.toContain("/gateway/log-service/gateway/log-service/");
  });

  it("Strategy 3: non-presigned Harness URL gets /gateway/log-service/ prefix added", async () => {
    const blobLink = "/log-service/blob/some-id";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(fetchSpy).not.toHaveBeenCalled();
    const calledPath = (streamFn.mock.calls[0]![0] as { path: string }).path;
    expect(calledPath).toContain("/gateway/log-service/");
  });

  it("Strategy 3: HarnessApiError from requestStream propagates without wrapping", async () => {
    class HarnessApiError extends Error {
      constructor(msg: string) { super(msg); this.name = "HarnessApiError"; }
    }
    const blobLink = "/log-service/blob/error-id";
    const apiErr = new HarnessApiError("401 Unauthorized");
    const streamFn = vi.fn().mockRejectedValue(apiErr);
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await expect(resolveLogContent(client, "prefix")).rejects.toThrow("401 Unauthorized");
  });

  // ── isPresignedUrl detection edge cases ─────────────────────────────────────

  it("URL with X-Goog-Signature but no X-Amz-Signature is detected as presigned", async () => {
    // Validates isPresignedUrl() handles GCS-only signatures correctly.
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Goog-Signature=gcsonlysig" +
      "&X-Goog-SignedHeaders=content-type";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
  });

  it("URL with neither X-Amz-Signature nor X-Goog-Signature routes to requestStream (not presigned)", async () => {
    const blobLink = "https://app.harness.io/storage/blob.zip?some-other-param=abc";
    const streamFn = vi.fn().mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway", requestStream: streamFn },
    );

    await resolveLogContent(client, "prefix");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(streamFn).toHaveBeenCalledTimes(1);
  });

  // ── Full decision-matrix: signedHeadersIncludeHost × hostname-match ─────────
  //
  // This table must stay complete. Any change to the condition
  // `signedHeadersIncludeHost(blobUrl) && blobUrl.hostname === baseUrl.hostname`
  // will break at least one of these four tests.
  //
  //  signedHeadersIncludeHost | hosts match | expected action
  //  false                    | false       | rewrite  (covered by REGRESSION tests above)
  //  false                    | true        | rewrite (no-op)
  //  true                     | false       | rewrite  ← the bug fixed by this PR
  //  true                     | true        | direct fetch, no rewrite

  it("MATRIX [false×true]: SignedHeaders has no host, blob host = base host → rewrite (no-op)", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=content-type" +
      "&X-Amz-Signature=noh-same1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://app.harness.io" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    // hostname unchanged (no-op rewrite), path and params intact
    expect(url).toContain("app.harness.io");
    expect(url).toContain("/storage/blob.zip");
    expect(url).toContain("X-Amz-Signature=noh-same1");
  });

  it("MATRIX [true×false]: SignedHeaders has host, blob host ≠ base host → rewrite (the fixed bug)", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=yh-diff1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("self-managed.example.com");
    expect(url).not.toContain("app.harness.io");
    expect(url).toContain("X-Amz-Signature=yh-diff1");
  });

  it("MATRIX [true×true]: SignedHeaders has host, blob host = base host → direct fetch, no rewrite", async () => {
    const blobLink =
      "https://app.harness.io/storage/blob.zip" +
      "?X-Amz-SignedHeaders=host" +
      "&X-Amz-Signature=yh-same1";
    fetchSpy.mockResolvedValue(new Response('{"out":"ok"}', { status: 200 }));
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://app.harness.io" },
    );

    await resolveLogContent(client, "prefix");

    const url = fetchSpy.mock.calls[0]![0] as string;
    expect(url).toContain("app.harness.io");
    expect(url).toContain("X-Amz-Signature=yh-same1");
    // no rewrite → original URL fetched as-is
    expect(url).toMatch(/^https:\/\/app\.harness\.io\/storage\/blob\.zip/);
  });
});
