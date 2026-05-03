import { describe, it, expect, vi } from "vitest";
import { AuditManager } from "../../src/audit/manager.js";
import type { AuditEvent, AuditSink } from "../../src/audit/types.js";

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    event_id: "test-id",
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

function makeSink(name: string): AuditSink & { events: AuditEvent[]; flushCount: number; closeCount: number } {
  const sink = {
    name,
    events: [] as AuditEvent[],
    flushCount: 0,
    closeCount: 0,
    emit(event: AuditEvent) {
      sink.events.push(event);
    },
    async flush() {
      sink.flushCount++;
    },
    async close() {
      sink.closeCount++;
    },
  };
  return sink;
}

describe("AuditManager", () => {
  it("fans out events to all registered sinks", () => {
    const mgr = new AuditManager();
    const s1 = makeSink("s1");
    const s2 = makeSink("s2");
    mgr.addSink(s1);
    mgr.addSink(s2);

    const event = makeEvent();
    mgr.emit(event);

    expect(s1.events).toHaveLength(1);
    expect(s2.events).toHaveLength(1);
    expect(s1.events[0]).toEqual(event);
  });

  it("swallows sync errors from sinks", () => {
    const mgr = new AuditManager();
    const badSink: AuditSink = {
      name: "bad",
      emit() { throw new Error("boom"); },
    };
    const goodSink = makeSink("good");
    mgr.addSink(badSink);
    mgr.addSink(goodSink);

    mgr.emit(makeEvent());
    expect(goodSink.events).toHaveLength(1);
  });

  it("swallows async errors from sinks", () => {
    const mgr = new AuditManager();
    const asyncBadSink: AuditSink = {
      name: "async-bad",
      emit() { return Promise.reject(new Error("async boom")); },
    };
    const goodSink = makeSink("good");
    mgr.addSink(asyncBadSink);
    mgr.addSink(goodSink);

    expect(() => mgr.emit(makeEvent())).not.toThrow();
    expect(goodSink.events).toHaveLength(1);
  });

  it("flush() calls flush on all sinks", async () => {
    const mgr = new AuditManager();
    const s1 = makeSink("s1");
    const s2 = makeSink("s2");
    mgr.addSink(s1);
    mgr.addSink(s2);

    await mgr.flush();
    expect(s1.flushCount).toBe(1);
    expect(s2.flushCount).toBe(1);
  });

  it("close() calls flush then close on all sinks", async () => {
    const mgr = new AuditManager();
    const s1 = makeSink("s1");
    mgr.addSink(s1);

    await mgr.close();
    expect(s1.flushCount).toBe(1);
    expect(s1.closeCount).toBe(1);
  });

  it("close() swallows errors from failing sinks", async () => {
    const mgr = new AuditManager();
    const failSink: AuditSink = {
      name: "fail",
      emit() {},
      async flush() { throw new Error("flush fail"); },
      async close() { throw new Error("close fail"); },
    };
    mgr.addSink(failSink);

    await expect(mgr.close()).resolves.toBeUndefined();
  });

  it("works with zero sinks", () => {
    const mgr = new AuditManager();
    expect(() => mgr.emit(makeEvent())).not.toThrow();
  });
});
