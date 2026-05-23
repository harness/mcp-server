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

  it("emits audit event for template_v1 explicit scope using config defaults", async () => {
    const sink = collectingSink();
    const auditManager = new AuditManager();
    auditManager.addSink(sink);

    const config = makeConfig({
      HARNESS_TOOLSETS: "templates",
      HARNESS_ORG: "default",
      HARNESS_PROJECT: "proj1",
    });
    const registry = new Registry(config as any, { auditManager });

    const mockClient = {
      request: vi.fn().mockResolvedValue({ identifier: "tpl", label: "v2" }),
      account: "acct1",
    };

    await registry.dispatch(
      mockClient as any,
      "template_v1",
      "update",
      {
        resource_scope: "org",
        template_id: "tpl",
        version_label: "v2",
        body: {
          template_yaml: "version: 1\ntemplate:\n  identifier: tpl\n  name: Test\n  step:\n    run:\n      script: echo ok\n",
        },
      },
      { tool: "harness_update", confirmation: "elicited", resource_id: "tpl" },
    );

    expect(mockClient.request).toHaveBeenCalledOnce();
    expect(mockClient.request.mock.calls[0]![0].path).toBe("/v1/orgs/default/templates/tpl/versions/v2");
    expect(sink.events).toHaveLength(1);
    expect(sink.events[0]).toMatchObject({
      tool: "harness_update",
      outcome: "success",
      org_id: "default",
      project_id: undefined,
      http_path: "/v1/orgs/default/templates/tpl/versions/v2",
    });
  });
});
