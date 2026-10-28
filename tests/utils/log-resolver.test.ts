import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  blobKeysToTry,
  commandUnitLogKey,
  resolveLogContent,
  resolveLogDownloadUrl,
} from "../../src/utils/log-resolver.js";
import { gzipSync, deflateRawSync } from "node:zlib";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";

function makeClient(
  requestFn: (...args: unknown[]) => unknown,
  overrides?: Partial<Pick<HarnessClient, "baseURL" | "requestStream" | "account">>,
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

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(uncompressed.length, 22);
  localHeader.writeUInt16LE(fileNameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);

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
  it("GETs /blob with key and returns plain text log content", async () => {
    const logText = "line 1\nline 2\nline 3";
    const requestFn = vi.fn().mockResolvedValue(Buffer.from(logText).buffer);

    const result = await resolveLogContent(
      makeClient(requestFn),
      "acct/pipeline/p1/1/-exec1",
    );

    expect(result).toContain("line 1");
    expect(result).toContain("line 2");
    expect(result).toContain("line 3");
    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/gateway/log-service/blob",
        params: { key: "acct/pipeline/p1/1/-exec1" },
        responseType: "buffer",
        retryPolicy: "safe",
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call /blob/download", async () => {
    const requestFn = vi.fn().mockResolvedValue(Buffer.from("ok").buffer);
    await resolveLogContent(makeClient(requestFn), "prefix");
    const paths = requestFn.mock.calls.map((c) => (c[0] as { path: string }).path);
    expect(paths).toEqual(["/gateway/log-service/blob"]);
  });

  it("handles gzip-compressed log content", async () => {
    const logText = "gzipped log line 1\ngzipped log line 2";
    const gzipped = gzipSync(Buffer.from(logText));
    const requestFn = vi.fn().mockResolvedValue(
      gzipped.buffer.slice(gzipped.byteOffset, gzipped.byteOffset + gzipped.byteLength),
    );

    const result = await resolveLogContent(makeClient(requestFn), "prefix");
    expect(result).toContain("gzipped log line 1");
    expect(result).toContain("gzipped log line 2");
  });

  it("handles ZIP archive with log files", async () => {
    const zipBuf = buildZip("logs.txt", "zip entry log content");
    const requestFn = vi.fn().mockResolvedValue(
      zipBuf.buffer.slice(zipBuf.byteOffset, zipBuf.byteOffset + zipBuf.byteLength),
    );

    const result = await resolveLogContent(makeClient(requestFn), "prefix");
    expect(result).toContain("zip entry log content");
  });

  it("parses JSON log entries and strips ANSI codes", async () => {
    const jsonLogs = [
      '{"level":"INFO","time":"2026-03-09T17:01:23Z","out":"\\u001b[32m+ mvn clean install\\u001b[0m"}',
      '{"level":"ERROR","time":"2026-03-09T17:01:45Z","out":"BUILD FAILURE"}',
    ].join("\n");

    const requestFn = vi.fn().mockResolvedValue(Buffer.from(jsonLogs).buffer);
    const result = await resolveLogContent(makeClient(requestFn), "prefix");
    expect(result).toContain("mvn clean install");
    expect(result).toContain("BUILD FAILURE");
    expect(result).not.toContain("\x1b[");
  });

  it("returns (empty log output) when base and command-unit keys are empty", async () => {
    const requestFn = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const result = await resolveLogContent(makeClient(requestFn), "prefix");
    expect(result).toBe("(empty log output)");
    const keys = requestFn.mock.calls.map((c) => (c[0] as { params: { key: string } }).params.key);
    expect(keys).toEqual(["prefix", "prefix-commandUnit:Execute"]);
  });

  it("falls back to -commandUnit:Execute when base logBaseKey is empty", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValueOnce(Buffer.from("shell script failed\nexit 1").buffer);

    const result = await resolveLogContent(
      makeClient(requestFn),
      "acct/or/org/pr/proj/pipeline/p1/1/-/pipelineSteps/-promoteServices",
    );

    expect(result).toContain("shell script failed");
    const keys = requestFn.mock.calls.map((c) => (c[0] as { params: { key: string } }).params.key);
    expect(keys).toEqual([
      "acct/or/org/pr/proj/pipeline/p1/1/-/pipelineSteps/-promoteServices",
      "acct/or/org/pr/proj/pipeline/p1/1/-/pipelineSteps/-promoteServices-commandUnit:Execute",
    ]);
  });

  it("does not try command-unit fallback when base key has content", async () => {
    const requestFn = vi.fn().mockResolvedValue(Buffer.from("ci step log").buffer);
    const result = await resolveLogContent(makeClient(requestFn), "ci/base/key");
    expect(result).toContain("ci step log");
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it("prefers unitProgresses names before default Execute", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValueOnce(Buffer.from("from unitProgresses").buffer);

    const result = await resolveLogContent(makeClient(requestFn), "base", {
      commandUnitNames: ["CustomUnit", "Execute"],
    });
    expect(result).toContain("from unitProgresses");
    const keys = requestFn.mock.calls.map((c) => (c[0] as { params: { key: string } }).params.key);
    expect(keys).toEqual(["base", "base-commandUnit:CustomUnit"]);
  });

  it("caps command-unit fallbacks at 3 after empty base", async () => {
    const requestFn = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    await resolveLogContent(makeClient(requestFn), "base", {
      commandUnitNames: ["A", "B", "C", "D", "E"],
    });
    expect(requestFn).toHaveBeenCalledTimes(4); // base + 3 units
  });

  it("propagates HTTP errors when every key fetch fails", async () => {
    const requestFn = vi.fn().mockRejectedValue(new HarnessApiError("Not Found", 404));
    await expect(resolveLogContent(makeClient(requestFn), "prefix")).rejects.toThrow(/Not Found|404/);
  });

  it("throws when log file exceeds max size", async () => {
    const requestFn = vi.fn().mockResolvedValue(new ArrayBuffer(2048));
    await expect(
      resolveLogContent(makeClient(requestFn), "prefix", { maxLogSizeBytes: 1024 }),
    ).rejects.toThrow(/too large/);
  });
});

describe("blobKeysToTry / commandUnitLogKey", () => {
  it("builds command-unit key from base logBaseKey", () => {
    expect(commandUnitLogKey("base", "Execute")).toBe("base-commandUnit:Execute");
  });

  it("does not double-append when key already has commandUnit", () => {
    expect(blobKeysToTry("base-commandUnit:Execute")).toEqual(["base-commandUnit:Execute"]);
  });
});

describe("resolveLogDownloadUrl", () => {
  it("returns signed download URL without fetching blob content", async () => {
    const client = makeClient(
      vi.fn().mockResolvedValue({
        status: "success",
        link: "https://storage.googleapis.com/bucket/logs.zip?signed=1",
      }),
    );

    const result = await resolveLogDownloadUrl(client, "acct/pipeline/p1/1/-exec1");

    expect(result).toBe("https://storage.googleapis.com/bucket/logs.zip?signed=1");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("polls until status becomes success", async () => {
    const requestFn = vi.fn()
      .mockResolvedValueOnce({ status: "queued", link: null })
      .mockResolvedValueOnce({
        status: "success",
        link: "https://storage.googleapis.com/bucket/logs.zip?signed=1",
      });

    const client = makeClient(requestFn);
    const result = await resolveLogDownloadUrl(client, "prefix", { pollIntervalMs: 10 });

    expect(result).toBe("https://storage.googleapis.com/bucket/logs.zip?signed=1");
    expect(requestFn).toHaveBeenCalledTimes(2);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs to /blob/download with prefix for zip URL path", async () => {
    const requestFn = vi.fn().mockResolvedValue({
      status: "success",
      link: "https://storage.googleapis.com/bucket/logs.zip?signed=1",
    });
    await resolveLogDownloadUrl(makeClient(requestFn), "acct/org/proj/pipeline/exec");
    expect(requestFn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/gateway/log-service/blob/download",
        params: { prefix: "acct/org/proj/pipeline/exec" },
      }),
    );
  });

  it("rewrites Harness CDN presigned URL hostname for self-managed deployments", async () => {
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip" +
      "?X-Amz-Signature=abc&X-Amz-SignedHeaders=host&X-Amz-Expires=900";
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    const result = await resolveLogDownloadUrl(client, "prefix");

    expect(result).toContain("self-managed.example.com");
    expect(result).toContain("/storage/harness-download/logs.zip");
    expect(result).toContain("X-Amz-Signature=abc");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves SaaS CDN URL when blob host matches configured base URL host", async () => {
    const blobLink =
      "https://app.harness.io/storage/harness-download/logs.zip" +
      "?X-Amz-Signature=abc&X-Amz-SignedHeaders=host&X-Amz-Expires=900";
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://app.harness.io/gateway" },
    );

    const result = await resolveLogDownloadUrl(client, "prefix");

    expect(result).toBe(blobLink);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns external S3/GCS storage URLs unchanged", async () => {
    const blobLink = "https://my-bucket.s3.amazonaws.com/logs.zip?X-Amz-Signature=s3";
    const client = makeClient(
      vi.fn().mockResolvedValue({ status: "success", link: blobLink }),
      { baseURL: "https://self-managed.example.com/gateway" },
    );

    const result = await resolveLogDownloadUrl(client, "prefix");

    expect(result).toBe(blobLink);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
