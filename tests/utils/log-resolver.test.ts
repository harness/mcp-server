import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveLogContent } from "../../src/utils/log-resolver.js";
import { gzipSync, deflateRawSync } from "node:zlib";
import type { HarnessClient } from "../../src/client/harness-client.js";

function makeClient(
  requestFn: (...args: unknown[]) => unknown,
  overrides?: Partial<Pick<HarnessClient, "baseURL">>,
): HarnessClient {
  return {
    request: requestFn,
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

/** Build a ZIP with central-directory sizes, optionally reporting unknown output size. */
function buildZipWithCentralDirectory(fileName: string, content: string, reportedUncompressedSize?: number): Buffer {
  const fileNameBuf = Buffer.from(fileName, "utf-8");
  const uncompressed = Buffer.from(content, "utf-8");
  const compressed = deflateRawSync(uncompressed);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(reportedUncompressedSize ?? uncompressed.length, 22);
  localHeader.writeUInt16LE(fileNameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const local = Buffer.concat([localHeader, fileNameBuf, compressed]);

  const centralDirectory = Buffer.alloc(46);
  centralDirectory.writeUInt32LE(0x02014b50, 0);
  centralDirectory.writeUInt16LE(20, 4);
  centralDirectory.writeUInt16LE(20, 6);
  centralDirectory.writeUInt16LE(0, 8);
  centralDirectory.writeUInt16LE(8, 10);
  centralDirectory.writeUInt32LE(0, 16);
  centralDirectory.writeUInt32LE(compressed.length, 20);
  centralDirectory.writeUInt32LE(reportedUncompressedSize ?? uncompressed.length, 24);
  centralDirectory.writeUInt16LE(fileNameBuf.length, 28);
  centralDirectory.writeUInt16LE(0, 30);
  centralDirectory.writeUInt16LE(0, 32);
  centralDirectory.writeUInt32LE(0, 42);

  const cd = Buffer.concat([centralDirectory, fileNameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(local.length, 16);

  return Buffer.concat([local, cd, eocd]);
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
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/blob" }));
    fetchSpy.mockResolvedValue(new Response(logText, { status: 200 }));

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

    const client = makeClient(requestFn);
    fetchSpy.mockResolvedValue(new Response("log output", { status: 200 }));

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
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/gz" }));
    fetchSpy.mockResolvedValue(new Response(gzipped, { status: 200 }));

    const result = await resolveLogContent(client, "prefix");
    expect(result).toContain("gzipped log line 1");
    expect(result).toContain("gzipped log line 2");
  });

  it("handles ZIP archive with log files", async () => {
    const zipBuf = buildZip("logs.txt", "zip entry log content");
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/zip" }));
    fetchSpy.mockResolvedValue(new Response(zipBuf, { status: 200 }));

    const result = await resolveLogContent(client, "prefix");
    expect(result).toContain("zip entry log content");
  });

  it("rejects ZIP entries with unknown size that inflate beyond the decompressed log cap", async () => {
    const zipBuf = buildZipWithCentralDirectory("logs.txt", "x".repeat(2048), 0);
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/zip" }));
    fetchSpy.mockResolvedValue(new Response(zipBuf, { status: 200 }));

    await expect(
      resolveLogContent(client, "prefix", { maxLogSizeBytes: 200 }),
    ).rejects.toThrow(/decompressed log output too large/i);
  });

  it("parses JSON log entries and strips ANSI codes", async () => {
    const jsonLogs = [
      '{"level":"INFO","time":"2026-03-09T17:01:23Z","out":"\\u001b[32m+ mvn clean install\\u001b[0m"}',
      '{"level":"ERROR","time":"2026-03-09T17:01:45Z","out":"BUILD FAILURE"}',
    ].join("\n");

    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/json" }));
    fetchSpy.mockResolvedValue(new Response(jsonLogs, { status: 200 }));

    const result = await resolveLogContent(client, "prefix");
    expect(result).toContain("mvn clean install");
    expect(result).toContain("BUILD FAILURE");
    // ANSI codes should be stripped
    expect(result).not.toContain("\x1b[");
  });

  it("returns (empty log output) for empty content", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/empty" }));
    fetchSpy.mockResolvedValue(new Response("", { status: 200 }));

    const result = await resolveLogContent(client, "prefix");
    expect(result).toBe("(empty log output)");
  });

  it("throws on download failure", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/fail" }));
    fetchSpy.mockResolvedValue(new Response("Not Found", { status: 404 }));

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

  it("rewrites Harness-hosted blob URL to configured base when self-managed", async () => {
    const blobLink = "https://harness0.harness.io/some/blob/path?token=abc";
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://myhost.harness.io/gateway" },
    );
    fetchSpy.mockResolvedValue(new Response('{"out":"log line 1"}', { status: 200 }));

    const result = await resolveLogContent(client, "prefix");

    expect(result).toContain("log line 1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://myhost.harness.io/some/blob/path?token=abc",
      expect.any(Object),
    );
  });

  it("throws when log file exceeds max size", async () => {
    const client = makeClient(vi.fn().mockResolvedValue({ status: "success", link: "https://logs.example.com/big" }));
    const bigContent = "x".repeat(1024);
    fetchSpy.mockResolvedValue(new Response(bigContent, {
      status: 200,
      headers: { "content-length": String(20 * 1024 * 1024) },
    }));

    await expect(
      resolveLogContent(client, "prefix", { maxLogSizeBytes: 1024 }),
    ).rejects.toThrow(/too large/);
  });
});
