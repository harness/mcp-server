import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  blobKeysToTry,
  commandUnitLogKey,
  resolveLogContent,
  resolveLogDownloadUrl,
} from "../../src/utils/log-resolver.js";
import { logKeysFromNode } from "../../src/utils/log-keys.js";
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
        maxResponseBytes: 2 * 1024 * 1024,
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

  it("full mode returns labeled sections for every non-empty unitProgresses key", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValueOnce(Buffer.from("from unitProgresses").buffer)
      .mockResolvedValueOnce(Buffer.from("from execute").buffer);

    const result = await resolveLogContent(makeClient(requestFn), "base", {
      commandUnitNames: ["CustomUnit"],
      mode: "full",
    });
    expect(result).toContain("--- commandUnit: CustomUnit ---");
    expect(result).toContain("from unitProgresses");
    expect(result).toContain("--- commandUnit: Execute ---");
    expect(result).toContain("from execute");
    const keys = requestFn.mock.calls.map((c) => (c[0] as { params: { key: string } }).params.key);
    expect(keys).toEqual(["base", "base-commandUnit:CustomUnit", "base-commandUnit:Execute"]);
  });

  it("snippet mode returns the last non-empty unit so a late Helm failure is not dropped", async () => {
    const base = "acct/pipeline/p1/7/-exec/stage/-helmDeployment";
    const line = (time: string, out: string) =>
      JSON.stringify({ level: "INFO", time, out });
    const units: Record<string, string> = {
      [base]: "",
      [`${base}-commandUnit:Fetch Files`]: line("2026-10-20T10:00:01Z", "Fetching values.yaml"),
      [`${base}-commandUnit:Initialize`]: line("2026-10-20T10:00:02Z", "Initializing helm client"),
      [`${base}-commandUnit:Prepare`]: line("2026-10-20T10:00:03Z", "Rendering chart"),
      [`${base}-commandUnit:Install / Upgrade`]: line(
        "2026-10-20T10:00:04Z",
        'ConfigMap in version "v1" cannot be handled as a ConfigMap',
      ),
      [`${base}-commandUnit:Wait For Steady State`]: "",
      [`${base}-commandUnit:Wrap Up`]: "",
    };
    const requestFn = vi.fn(async (opts: unknown) => {
      const key = (opts as { params: { key: string } }).params.key;
      const buf = Buffer.from(units[key] ?? "");
      // Slice: small Buffers share Node's pool, so `.buffer` alone holds unrelated bytes.
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    });

    const result = await resolveLogContent(makeClient(requestFn), base, {
      logKeys: Object.keys(units).filter((k) => k !== base),
      mode: "snippet",
      snippetLines: 50,
    });

    expect(result).toContain("--- commandUnit: Install / Upgrade ---");
    expect(result).toContain('ConfigMap in version "v1" cannot be handled as a ConfigMap');
    expect(result).not.toContain("Fetching values.yaml");
    // base + Wrap Up (empty) + Wait (empty) + Install (hit) — stop early
    expect(requestFn).toHaveBeenCalledTimes(4);
  });

  it("snippet mode finds an early failure when later units never logged", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0)) // base
      .mockResolvedValueOnce(new ArrayBuffer(0)) // Wrap (from end)
      .mockResolvedValueOnce(Buffer.from("prepare failed here").buffer); // Prepare

    const result = await resolveLogContent(makeClient(requestFn), "base", {
      logKeys: [
        "base-commandUnit:Fetch Files",
        "base-commandUnit:Prepare",
        "base-commandUnit:Wrap Up",
      ],
      mode: "snippet",
    });
    expect(result).toContain("--- commandUnit: Prepare ---");
    expect(result).toContain("prepare failed here");
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it("full mode returns labeled sections for all non-empty Helm units", async () => {
    const base = "acct/pipeline/p1/7/-exec/stage/-helmDeployment";
    const line = (time: string, out: string) =>
      JSON.stringify({ level: "INFO", time, out });
    const units: Record<string, string> = {
      [base]: "",
      [`${base}-commandUnit:Fetch Files`]: line("2026-10-20T10:00:01Z", "Fetching values.yaml"),
      [`${base}-commandUnit:Install / Upgrade`]: line(
        "2026-10-20T10:00:04Z",
        'ConfigMap in version "v1" cannot be handled as a ConfigMap',
      ),
      [`${base}-commandUnit:Wrap Up`]: "",
    };
    const requestFn = vi.fn(async (opts: unknown) => {
      const key = (opts as { params: { key: string } }).params.key;
      const buf = Buffer.from(units[key] ?? "");
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    });

    const result = await resolveLogContent(makeClient(requestFn), base, {
      logKeys: Object.keys(units).filter((k) => k !== base),
      mode: "full",
    });
    expect(result).toContain("--- commandUnit: Fetch Files ---");
    expect(result).toContain("--- commandUnit: Install / Upgrade ---");
    expect(result).toContain("Fetching values.yaml");
    expect(result).toContain("ConfigMap");
  });

  it("prefers exact logKeys over unitProgresses names", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValue(Buffer.from("unit log").buffer);

    await resolveLogContent(makeClient(requestFn), "base", {
      commandUnitNames: ["FromProgress"],
      logKeys: ["base", "base-commandUnit:Exact", "base-commandUnit:Exact"],
      mode: "full",
    });
    const keys = requestFn.mock.calls.map((c) => (c[0] as { params: { key: string } }).params.key);
    expect(keys).toEqual(["base", "base-commandUnit:Exact"]);
  });

  it("caps command-unit keys at 10 from the end and always reserves Execute", async () => {
    const requestFn = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    const names = Array.from({ length: 15 }, (_, i) => `U${i}`);
    await resolveLogContent(makeClient(requestFn), "base", {
      commandUnitNames: names,
      mode: "full",
    });
    const keys = requestFn.mock.calls.map((c) => (c[0] as { params: { key: string } }).params.key);
    expect(keys).toHaveLength(11);
    expect(keys[0]).toBe("base");
    expect(keys.slice(1, 10)).toEqual(names.slice(-9).map((n) => `base-commandUnit:${n}`));
    expect(keys.at(-1)).toBe("base-commandUnit:Execute");
  });

  it("full mode skips a 404 unit key and still returns the others", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValueOnce(Buffer.from("unit A").buffer)
      .mockRejectedValueOnce(new HarnessApiError("Not Found", 404))
      .mockResolvedValueOnce(Buffer.from("unit C").buffer);

    const result = await resolveLogContent(makeClient(requestFn), "base", {
      logKeys: ["base-commandUnit:A", "base-commandUnit:B", "base-commandUnit:C"],
      mode: "full",
    });
    expect(result).toContain("unit A");
    expect(result).toContain("unit C");
    expect(result).toContain("--- commandUnit: A ---");
    expect(result).toContain("--- commandUnit: C ---");
  });

  it("stops on a rate-limit while fetching unit keys", async () => {
    const requestFn = vi
      .fn()
      .mockResolvedValueOnce(new ArrayBuffer(0))
      .mockResolvedValueOnce(Buffer.from("unit A").buffer)
      .mockRejectedValueOnce(new HarnessApiError("Too Many Requests", 429));

    await expect(
      resolveLogContent(makeClient(requestFn), "base", {
        logKeys: ["base-commandUnit:A", "base-commandUnit:B", "base-commandUnit:C"],
        mode: "full",
      }),
    ).rejects.toThrow(/Too Many Requests|429/);
    expect(requestFn).toHaveBeenCalledTimes(3);
  });

  it("falls through on 404 to the next key", async () => {
    const requestFn = vi
      .fn()
      .mockRejectedValueOnce(new HarnessApiError("Not Found", 404))
      .mockResolvedValueOnce(Buffer.from("from execute unit").buffer);

    const result = await resolveLogContent(makeClient(requestFn), "base");
    expect(result).toContain("from execute unit");
    expect(requestFn).toHaveBeenCalledTimes(2);
  });

  it("does not fall through on rate-limit or server errors", async () => {
    const requestFn = vi.fn().mockRejectedValue(new HarnessApiError("Too Many Requests", 429));
    await expect(resolveLogContent(makeClient(requestFn), "prefix")).rejects.toThrow(/Too Many Requests|429/);
    expect(requestFn).toHaveBeenCalledTimes(1);
  });

  it("propagates HTTP errors when every key fetch returns 404", async () => {
    const requestFn = vi.fn().mockRejectedValue(new HarnessApiError("Not Found", 404));
    await expect(resolveLogContent(makeClient(requestFn), "prefix")).rejects.toThrow(/Not Found|404/);
    expect(requestFn).toHaveBeenCalledTimes(2); // base + Execute
  });

  it("throws when log file exceeds max size", async () => {
    const requestFn = vi.fn().mockResolvedValue(new ArrayBuffer(2048));
    await expect(
      resolveLogContent(makeClient(requestFn), "prefix", { maxLogSizeBytes: 1024 }),
    ).rejects.toThrow(/too large/);
    expect(requestFn).toHaveBeenCalledTimes(1);
  });
});

describe("blobKeysToTry / commandUnitLogKey", () => {
  it("builds command-unit key from base logBaseKey", () => {
    expect(commandUnitLogKey("base", "Execute")).toBe("base-commandUnit:Execute");
  });

  it("does not double-append when key already has commandUnit", () => {
    expect(blobKeysToTry("base-commandUnit:Execute")).toEqual(["base-commandUnit:Execute"]);
  });

  it("keeps the last unit names inside the cap and reserves Execute", () => {
    const names = Array.from({ length: 12 }, (_, i) => `U${i}`);
    const keys = blobKeysToTry("base", names);
    expect(keys).toHaveLength(11);
    expect(keys.slice(1, 10)).toEqual(names.slice(-9).map((n) => `base-commandUnit:${n}`));
    expect(keys[10]).toBe("base-commandUnit:Execute");
  });

  it("does not duplicate Execute when already listed in unitProgresses", () => {
    expect(blobKeysToTry("base", ["Execute", "A", "B", "C"])).toEqual([
      "base",
      "base-commandUnit:Execute",
      "base-commandUnit:A",
      "base-commandUnit:B",
      "base-commandUnit:C",
    ]);
  });

  it("uses exact logKeys without adding Execute, de-duplicating the base key", () => {
    expect(blobKeysToTry("base", ["Ignored"], ["base", "base-commandUnit:X", " base-commandUnit:X "])).toEqual([
      "base",
      "base-commandUnit:X",
    ]);
  });
});

describe("logKeysFromNode", () => {
  it("collects de-duplicated keys across executableResponses variants", () => {
    expect(
      logKeysFromNode({
        executableResponses: [
          { task: { logKeys: ["k-commandUnit:A", "k-commandUnit:B"] } },
          { taskChain: { logKeys: ["k-commandUnit:B", "k-commandUnit:C"] } },
          { child: { logKeys: [] } },
          { sync: undefined },
        ],
      }),
    ).toEqual(["k-commandUnit:A", "k-commandUnit:B", "k-commandUnit:C"]);
  });

  it("returns undefined when the node has no log keys", () => {
    expect(logKeysFromNode({})).toBeUndefined();
    expect(logKeysFromNode({ executableResponses: [{ task: {} }] })).toBeUndefined();
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
