import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, unlinkSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { AuditEvent } from "../../src/audit/types.js";
import { StderrSink } from "../../src/audit/sinks/stderr.js";
import { JsonlFileSink } from "../../src/audit/sinks/jsonl-file.js";
import { WebhookSink } from "../../src/audit/sinks/webhook.js";
import { OTelSink } from "../../src/audit/sinks/otel.js";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    event_id: "evt-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    tool: "harness_create",
    operation: "create",
    resource_type: "pipeline",
    account_id: "acct1",
    risk: "low_write",
    outcome: "success",
    duration_ms: 42,
    http_method: "POST",
    http_path: "/pipeline/api/pipelines/v2",
    ...overrides,
  };
}

describe("StderrSink", () => {
  it("writes success events via info log", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = new StderrSink();
    sink.emit(makeEvent());

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged.module).toBe("audit");
    expect(logged.level).toBe("info");
    expect(logged.event_id).toBe("evt-1");
    expect(logged.outcome).toBe("success");
    spy.mockRestore();
  });

  it("writes error events via warn log", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sink = new StderrSink();
    sink.emit(makeEvent({ outcome: "error", error: "something failed" }));

    const logged = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(logged.level).toBe("warn");
    expect(logged.error).toBe("something failed");
    spy.mockRestore();
  });
});

describe("JsonlFileSink", () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `audit-test-${randomUUID()}`);
    testFile = join(testDir, "audit.jsonl");
  });

  afterEach(() => {
    try { unlinkSync(testFile); } catch {}
    try { rmdirSync(testDir); } catch {}
  });

  it("creates directory and appends NDJSON", () => {
    const sink = new JsonlFileSink(testFile);
    sink.emit(makeEvent({ event_id: "e1" }));
    sink.emit(makeEvent({ event_id: "e2" }));

    expect(existsSync(testFile)).toBe(true);
    const lines = readFileSync(testFile, "utf-8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).event_id).toBe("e1");
    expect(JSON.parse(lines[1]!).event_id).toBe("e2");
  });

  it("handles write errors gracefully", () => {
    const sink = new JsonlFileSink("/nonexistent/path/that/should/fail/audit.jsonl");
    expect(() => sink.emit(makeEvent())).not.toThrow();
  });
});

describe("WebhookSink", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("batches events and flushes when batch size is reached", async () => {
    const sink = new WebhookSink({
      url: "https://example.com/audit",
      token: "test-token",
      batchSize: 2,
      flushIntervalMs: 60000,
    });

    sink.emit(makeEvent({ event_id: "e1" }));
    expect(fetchSpy).not.toHaveBeenCalled();

    sink.emit(makeEvent({ event_id: "e2" }));

    // Give the async flush a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, opts] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://example.com/audit");
    expect(opts.headers["Authorization"]).toBe("Bearer test-token");

    const body = JSON.parse(opts.body);
    expect(body.events).toHaveLength(2);

    await sink.close();
  });

  it("flush sends partial batch", async () => {
    const sink = new WebhookSink({
      url: "https://example.com/audit",
      batchSize: 100,
      flushIntervalMs: 60000,
    });

    sink.emit(makeEvent({ event_id: "e1" }));
    await sink.flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    expect(body.events).toHaveLength(1);

    await sink.close();
  });

  it("handles fetch errors gracefully", async () => {
    fetchSpy.mockRejectedValue(new Error("network error"));
    const sink = new WebhookSink({
      url: "https://example.com/audit",
      batchSize: 1,
      flushIntervalMs: 60000,
    });

    sink.emit(makeEvent());
    await new Promise((r) => setTimeout(r, 10));

    // Should not throw
    await sink.close();
  });

  it("flush is a no-op when buffer is empty", async () => {
    const sink = new WebhookSink({
      url: "https://example.com/audit",
      flushIntervalMs: 60000,
    });

    await sink.flush();
    expect(fetchSpy).not.toHaveBeenCalled();

    await sink.close();
  });
});

describe("OTelSink", () => {
  const originalEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  afterEach(() => {
    if (originalEndpoint === undefined) {
      delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    } else {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = originalEndpoint;
    }
  });

  it("emit is a no-op when @opentelemetry/api is not available", () => {
    const sink = new OTelSink();
    expect(() => sink.emit(makeEvent())).not.toThrow();
  });

  it("flush resolves without error", async () => {
    const sink = new OTelSink();
    await expect(sink.flush()).resolves.toBeUndefined();
  });

  it("close resolves without error", async () => {
    const sink = new OTelSink();
    await expect(sink.close()).resolves.toBeUndefined();
  });

  it("has the correct name", () => {
    const sink = new OTelSink();
    expect(sink.name).toBe("otel");
  });

  it("drains events queued before standalone bootstrap completes", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://127.0.0.1:4318/v1/traces";

    const sink = new OTelSink();
    sink.emit(makeEvent({ event_id: "queued-before-init" }));
    sink.emit(makeEvent({ event_id: "queued-before-init-2" }));

    await expect(sink.flush()).resolves.toBeUndefined();
    expect(() => sink.emit(makeEvent({ event_id: "after-init" }))).not.toThrow();
    await expect(sink.close()).resolves.toBeUndefined();
  });
});
