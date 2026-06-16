import { describe, it, expect, vi } from "vitest";
import { Registry } from "../../src/registry/index.js";
import { AuditManager } from "../../src/audit/manager.js";
import type { AuditEvent, AuditSink } from "../../src/audit/types.js";

function makeConfig(overrides = {}) {
  return {
    HARNESS_API_KEY: "pat.acct1.token.secret",
    HARNESS_ACCOUNT_ID: "acct1",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default",
    HARNESS_PROJECT: "proj1",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info" as const,
    HARNESS_TOOLSETS: "pipelines",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_AUTO_APPROVE_RISK: "none",
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    HARNESS_LOG_UNSAFE_BODIES: false,
    HARNESS_AUDIT_WEBHOOK_BATCH_SIZE: 10,
    HARNESS_AUDIT_WEBHOOK_FLUSH_MS: 5000,
    ...overrides,
  };
}

function collectingSink(): AuditSink & { events: AuditEvent[] } {
  const events: AuditEvent[] = [];
  return {
    name: "test-collector",
    events,
    emit(event: AuditEvent) { events.push(event); },
  };
}

describe("Registry audit emission", () => {
  it("emits an audit event on successful dispatch", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    const mockClient = {
      request: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { identifier: "p1" } }),
      account: "acct1",
    };

    await registry.dispatch(mockClient as any, "pipeline", "list", {}, { tool: "harness_list", confirmation: "not_required" });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.tool).toBe("harness_list");
    expect(event.operation).toBe("list");
    expect(event.resource_type).toBe("pipeline");
    expect(event.outcome).toBe("success");
    expect(event.account_id).toBe("acct1");
    expect(event.confirmation).toBe("not_required");
    expect(event.duration_ms).toBeGreaterThanOrEqual(0);
    expect(event.http_method).toBeDefined();
    expect(event.event_id).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it("emits an audit event on failed dispatch", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    const mockClient = {
      request: vi.fn().mockRejectedValue(new Error("API timeout")),
      account: "acct1",
    };

    await expect(
      registry.dispatch(mockClient as any, "pipeline", "list", {}, { tool: "harness_list" }),
    ).rejects.toThrow("API timeout");

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.outcome).toBe("error");
    expect(event.error).toContain("API timeout");
  });

  it("does not emit audit events when auditManager is not configured", async () => {
    const config = makeConfig();
    const registry = new Registry(config as any);

    const mockClient = {
      request: vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} }),
      account: "acct1",
    };

    // Should not throw — just operates without audit
    await registry.dispatch(mockClient as any, "pipeline", "list", {});
  });

  it("emits audit event for dispatchExecute", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    const mockClient = {
      request: vi.fn().mockResolvedValue({ status: "SUCCESS", data: { planExecution: { uuid: "ex1" } } }),
      account: "acct1",
    };

    await registry.dispatchExecute(mockClient as any, "pipeline", "run", { pipeline_id: "p1" }, { tool: "harness_execute", confirmation: "elicited", action: "run" });

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.tool).toBe("harness_execute");
    expect(event.operation).toBe("execute");
    expect(event.action).toBe("run");
    expect(event.confirmation).toBe("elicited");
  });

  it("auditBlockedAttempt emits a pre-dispatch audit row with outcome=blocked and the caller's confirmation method", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    // The caller passes the actual elicitation method (here "elicited" for an
    // explicit user decline) — the audit row's outcome="blocked" is what
    // signals "operation did not run", not the confirmation value.
    registry.auditBlockedAttempt(
      "pipeline",
      "delete",
      { resource_id: "my-pipe" },
      { tool: "harness_delete", confirmation: "elicited", resource_id: "my-pipe" },
      "Operation declined by user (elicited)",
    );

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.tool).toBe("harness_delete");
    expect(event.operation).toBe("delete");
    expect(event.resource_type).toBe("pipeline");
    expect(event.confirmation).toBe("elicited");
    expect(event.outcome).toBe("blocked");
    expect(event.error).toContain("declined");
    expect(event.duration_ms).toBe(0);
    expect(event.risk).toBe("destructive");
  });

  it("auditBlockedAttempt records confirmation=blocked when the client failed to surface a prompt", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    registry.auditBlockedAttempt(
      "pipeline",
      "delete",
      { resource_id: "my-pipe" },
      { tool: "harness_delete", confirmation: "blocked", resource_id: "my-pipe" },
      "Operation blocked pre-dispatch: client could not surface a confirmation prompt (cancelled)",
    );

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.confirmation).toBe("blocked");
    expect(event.outcome).toBe("blocked");
    expect(event.error).toContain("blocked pre-dispatch");
    // Critical: blocked-path audit error must NOT misattribute to the user.
    expect(event.error).not.toContain("by user");
  });

  it("auditBlockedAttempt is a no-op when auditManager is not configured", () => {
    const config = makeConfig();
    const registry = new Registry(config as any);
    expect(() =>
      registry.auditBlockedAttempt(
        "pipeline",
        "delete",
        {},
        { tool: "harness_delete", confirmation: "blocked" },
        "blocked",
      ),
    ).not.toThrow();
  });

  it("auditBlockedAttempt does not throw when a pathBuilder requires unset identifiers", async () => {
    // Regression for the case where the blocked attempt happens before the
    // tool handler has populated identifier fields on the input map.
    // template.delete's pathBuilder throws "template_id is required" if
    // input.template_id is unset — auditBlockedAttempt must swallow that
    // and still emit a row with the static path (placeholders intact).
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig({ HARNESS_TOOLSETS: "templates" });
    const registry = new Registry(config as any, { auditManager });

    expect(() =>
      registry.auditBlockedAttempt(
        "template",
        "delete",
        { resource_id: "tmpl-1" }, // template_id intentionally not set
        { tool: "harness_delete", confirmation: "blocked", resource_id: "tmpl-1" },
        "Operation declined by user (blocked)",
      ),
    ).not.toThrow();

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.tool).toBe("harness_delete");
    expect(event.resource_type).toBe("template");
    expect(event.confirmation).toBe("blocked");
    // Falls back to the static path template since pathBuilder threw.
    expect(event.http_path).toBe("/template/api/templates/{templateIdentifier}/{versionLabel}");
  });

  it("auditBlockedAttempt resolves the spec for execute actions", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    registry.auditBlockedAttempt(
      "pipeline",
      "execute",
      { pipeline_id: "p1" },
      { tool: "harness_execute", confirmation: "blocked", action: "run", resource_id: "p1" },
      "Operation declined by user (blocked)",
    );

    expect(sink.events).toHaveLength(1);
    const event = sink.events[0]!;
    expect(event.operation).toBe("execute");
    expect(event.action).toBe("run");
    expect(event.confirmation).toBe("blocked");
    expect(event.risk).toBe("high_write");
  });

  it("backward compatible — dispatch still works with AbortSignal", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig();
    const registry = new Registry(config as any, { auditManager });

    const mockClient = {
      request: vi.fn().mockResolvedValue({ status: "SUCCESS", data: {} }),
      account: "acct1",
    };

    const controller = new AbortController();
    await registry.dispatch(mockClient as any, "pipeline", "list", {}, controller.signal);

    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]!.tool).toBe("harness_list");
  });
});
