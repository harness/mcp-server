/**
 * Regression tests for security_exemption create + approve/reject execute actions.
 *
 * Covers scope routing (/approve vs /promote), scope elevation input mutation,
 * approver/requester auto-injection, and snake_case body mapping.
 */
import { describe, it, expect, vi } from "vitest";
import { stoToolset } from "../../src/registry/toolsets/sto.js";
import { Registry } from "../../src/registry/index.js";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import type { EndpointSpec, ResourceDefinition, PreflightContext } from "../../src/registry/types.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "default-org",
    HARNESS_PROJECT: "default-project",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 3,
    LOG_LEVEL: "info",
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    ...overrides,
  } as Config;
}

function makeClient(
  requestFn: (...args: unknown[]) => unknown = vi.fn().mockResolvedValue({}),
  currentUserId = "approver-uuid-1",
): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
    getCurrentUserId: vi.fn().mockResolvedValue(currentUserId),
  } as unknown as HarnessClient;
}

function getExemptionResource(): ResourceDefinition {
  const r = stoToolset.resources.find((x) => x.resourceType === "security_exemption");
  if (!r) throw new Error("security_exemption resource not registered");
  return r;
}

function getCreateSpec(): EndpointSpec {
  const spec = getExemptionResource().operations.create;
  if (!spec) throw new Error("security_exemption.create spec missing");
  return spec;
}

function getApproveSpec(): EndpointSpec {
  const spec = getExemptionResource().executeActions?.approve;
  if (!spec) throw new Error("security_exemption.approve spec missing");
  return spec;
}

function getRejectSpec(): EndpointSpec {
  const spec = getExemptionResource().executeActions?.reject;
  if (!spec) throw new Error("security_exemption.reject spec missing");
  return spec;
}

function makeCtx(
  input: Record<string, unknown>,
  getCurrentUserId = vi.fn().mockResolvedValue("user-uuid"),
): PreflightContext {
  return {
    client: { account: "test-account", getCurrentUserId } as unknown as PreflightContext["client"],
    input,
    registry: {
      dispatch: async () => undefined,
      getResource: () => getExemptionResource(),
    },
  };
}

// ─── create ─────────────────────────────────────────────────────────────────

describe("security_exemption create", () => {
  it("preflight rejects missing required snake_case fields before HTTP", async () => {
    const spec = getCreateSpec();
    const input = { body: { type: "Other", reason: "test" } };
    await expect(spec.preflight!(makeCtx(input))).rejects.toThrow(/Missing required fields.*issue_id/);
  });

  it("preflight injects requester_id from getCurrentUserId", async () => {
    const spec = getCreateSpec();
    const getCurrentUserId = vi.fn().mockResolvedValue("requester-uuid-99");
    const input = { body: { issue_id: "iss-1", type: "Other", reason: "patched" } };
    await spec.preflight!(makeCtx(input, getCurrentUserId));
    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).requester_id).toBe("requester-uuid-99");
  });

  it("bodyBuilder maps snake_case, defaults durationDays=30, sets exemptFutureOccurrences=true", () => {
    const spec = getCreateSpec();
    const body = spec.bodyBuilder!({
      body: {
        issue_id: "iss-1",
        type: "False Positive",
        reason: "upstream fix",
        requester_id: "req-1",
        scan_id: "scan-42",
        duration_days: 0,
      },
    });
    expect(body).toEqual({
      issueId: "iss-1",
      type: "False Positive",
      reason: "upstream fix",
      requesterId: "req-1",
      exemptFutureOccurrences: true,
      pendingChanges: { durationDays: 0 },
      scanId: "scan-42",
    });
  });
});

// ─── approve preflight + path/body builders ─────────────────────────────────

describe("security_exemption approve", () => {
  it("preflight requires body.scope with actionable error message", async () => {
    const spec = getApproveSpec();
    const input = { exemption_id: "ex-1", body: {} };
    await expect(spec.preflight!(makeCtx(input))).rejects.toThrow(/body\.scope is required/);
  });

  it("preflight rejects invalid scope values", async () => {
    const spec = getApproveSpec();
    const input = { exemption_id: "ex-1", body: { scope: "GLOBAL" } };
    await expect(spec.preflight!(makeCtx(input))).rejects.toThrow(/invalid scope 'GLOBAL'/);
  });

  it("preflight clears org_id and project_id for ACCOUNT elevation", async () => {
    const spec = getApproveSpec();
    const input = {
      exemption_id: "ex-1",
      org_id: "my-org",
      project_id: "my-project",
      body: { scope: "ACCOUNT", approver_id: "already-set" },
    };
    await spec.preflight!(makeCtx(input));
    expect(input.org_id).toBe("");
    expect(input.project_id).toBe("");
  });

  it("preflight clears project_id only for ORG elevation", async () => {
    const spec = getApproveSpec();
    const input = {
      exemption_id: "ex-1",
      org_id: "my-org",
      project_id: "my-project",
      body: { scope: "ORG", approver_id: "already-set" },
    };
    await spec.preflight!(makeCtx(input));
    expect(input.org_id).toBe("my-org");
    expect(input.project_id).toBe("");
  });

  it("preflight auto-injects approver_id when omitted", async () => {
    const spec = getApproveSpec();
    const getCurrentUserId = vi.fn().mockResolvedValue("auto-approver-uuid");
    const input = { exemption_id: "ex-1", body: { scope: "CURRENT" } };
    await spec.preflight!(makeCtx(input, getCurrentUserId));
    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).approver_id).toBe("auto-approver-uuid");
  });

  it("pathBuilder routes CURRENT scope to /approve", () => {
    const spec = getApproveSpec();
    const path = spec.pathBuilder!({ exemption_id: "ex-42", body: { scope: "CURRENT" } });
    expect(path).toBe("/sto/api/v2/exemptions/ex-42/approve");
  });

  it("pathBuilder routes ORG/ACCOUNT/PROJECT elevation to /promote", () => {
    const spec = getApproveSpec();
    for (const scope of ["ORG", "ACCOUNT", "PROJECT"] as const) {
      const path = spec.pathBuilder!({ exemption_id: "ex-42", body: { scope } });
      expect(path).toBe("/sto/api/v2/exemptions/ex-42/promote");
    }
  });

  it("bodyBuilder omits scope on wire for CURRENT but includes it for elevation", () => {
    const spec = getApproveSpec();
    const current = spec.bodyBuilder!({
      exemption_id: "ex-1",
      body: { scope: "CURRENT", approver_id: "u1", comment: "ok" },
    });
    expect(current).toEqual({ approverId: "u1", comment: "ok" });
    expect(current).not.toHaveProperty("scope");

    const elevated = spec.bodyBuilder!({
      exemption_id: "ex-1",
      body: { scope: "ACCOUNT", approver_id: "u1" },
    });
    expect(elevated).toEqual({ approverId: "u1", scope: "ACCOUNT" });
  });
});

// ─── reject ─────────────────────────────────────────────────────────────────

describe("security_exemption reject", () => {
  it("preflight auto-injects approver_id when omitted", async () => {
    const spec = getRejectSpec();
    const getCurrentUserId = vi.fn().mockResolvedValue("rejector-uuid");
    const input = { exemption_id: "ex-1", body: { comment: "not justified" } };
    await spec.preflight!(makeCtx(input, getCurrentUserId));
    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).approver_id).toBe("rejector-uuid");
  });
});

// ─── dispatchExecute integration ───────────────────────────────────────────

describe("security_exemption dispatchExecute", () => {
  it("approve at CURRENT scope hits /approve with stripped scope in body", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));
    const mockRequest = vi.fn().mockResolvedValue({ status: "Approved" });
    const client = makeClient(mockRequest, "dispatch-approver");

    await registry.dispatchExecute(client, "security_exemption", "approve", {
      exemption_id: "ex-dispatch-1",
      org_id: "my-org",
      project_id: "my-project",
      body: { scope: "CURRENT" },
    });

    const call = mockRequest.mock.calls[0]![0] as { method: string; path: string; body: Record<string, unknown> };
    expect(call.method).toBe("PUT");
    expect(call.path).toBe("/sto/api/v2/exemptions/ex-dispatch-1/approve");
    expect(call.body).toEqual({ approverId: "dispatch-approver" });
    expect(call.body).not.toHaveProperty("scope");
  });

  it("approve at ACCOUNT scope hits /promote and clears org/project scope params", async () => {
    const registry = new Registry(makeConfig({ HARNESS_TOOLSETS: "sto" }));
    const mockRequest = vi.fn().mockResolvedValue({ status: "Approved" });
    const client = makeClient(mockRequest, "account-approver");

    await registry.dispatchExecute(client, "security_exemption", "approve", {
      exemption_id: "ex-dispatch-2",
      org_id: "my-org",
      project_id: "my-project",
      body: { scope: "ACCOUNT" },
    });

    const call = mockRequest.mock.calls[0]![0] as {
      method: string;
      path: string;
      body: Record<string, unknown>;
      params: Record<string, string>;
    };
    expect(call.path).toBe("/sto/api/v2/exemptions/ex-dispatch-2/promote");
    expect(call.body).toEqual({ approverId: "account-approver", scope: "ACCOUNT" });
    // Preflight clears org/project to "" so wide-scope promote omits project binding.
    expect(call.params.orgId).toBe("");
    expect(call.params.projectId).toBe("");
  });
});
