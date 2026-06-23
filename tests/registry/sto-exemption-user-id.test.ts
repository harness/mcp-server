/**
 * Regression tests for STO exemption preflights that derive user IDs.
 *
 * PR #377 removed HarnessClient casts in favor of HarnessClientInterface
 * (getCurrentUserId on the structural client). Covers single-create and
 * execute approve/reject paths that were not exercised by bulk-create tests.
 */
import { describe, it, expect, vi } from "vitest";
import { stoToolset } from "../../src/registry/toolsets/sto.js";
import type { EndpointSpec, PreflightContext, ResourceDefinition } from "../../src/registry/types.js";

function getExemptionResource(): ResourceDefinition {
  const resource = stoToolset.resources.find((r) => r.resourceType === "security_exemption");
  if (!resource) throw new Error("security_exemption resource missing");
  return resource;
}

function makeCtx(
  input: Record<string, unknown>,
  getCurrentUserId = vi.fn().mockResolvedValue("pat-user-99"),
): PreflightContext {
  return {
    client: {
      account: "test-account",
      getCurrentUserId,
      request: vi.fn(),
    },
    input,
    registry: {
      dispatch: async () => undefined,
      getResource: () => getExemptionResource(),
    },
  };
}

describe("security_exemption.create preflight — requester_id", () => {
  it("auto-derives requester_id via HarnessClientInterface.getCurrentUserId()", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("user-from-pat");
    const input = {
      body: { issue_id: "iss-1", type: "False Positive", reason: "patched" },
    };

    const spec = getExemptionResource().operations.create as EndpointSpec;
    await spec.preflight!(makeCtx(input, getCurrentUserId));

    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).requester_id).toBe("user-from-pat");
  });

  it("rejects missing required fields before calling getCurrentUserId()", async () => {
    const getCurrentUserId = vi.fn();
    const spec = getExemptionResource().operations.create as EndpointSpec;

    await expect(
      spec.preflight!(makeCtx({ body: { issue_id: "iss-1" } }, getCurrentUserId)),
    ).rejects.toThrow(/Missing required fields/);
    expect(getCurrentUserId).not.toHaveBeenCalled();
  });
});

describe("security_exemption approve preflight — approver_id", () => {
  const approveSpec = () => {
    const spec = getExemptionResource().executeActions?.approve;
    if (!spec?.preflight) throw new Error("approve preflight missing");
    return spec;
  };

  it("auto-derives approver_id when scope is provided and approver_id is omitted", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("approver-uuid");
    const input = { body: { scope: "CURRENT" }, exemption_id: "ex-1" };

    await approveSpec().preflight!(makeCtx(input, getCurrentUserId));

    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).approver_id).toBe("approver-uuid");
  });

  it("preserves caller-supplied approver_id without calling getCurrentUserId()", async () => {
    const getCurrentUserId = vi.fn();
    const input = { body: { scope: "ORG", approver_id: "explicit-approver" } };

    await approveSpec().preflight!(makeCtx(input, getCurrentUserId));

    expect(getCurrentUserId).not.toHaveBeenCalled();
    expect((input.body as Record<string, unknown>).approver_id).toBe("explicit-approver");
  });

  it("clears org/project scope fields when elevating to ACCOUNT scope", async () => {
    const input = {
      org_id: "my-org",
      project_id: "my-project",
      body: { scope: "ACCOUNT" },
    };

    await approveSpec().preflight!(makeCtx(input));

    expect(input.org_id).toBe("");
    expect(input.project_id).toBe("");
  });
});

describe("security_exemption reject preflight — approver_id", () => {
  it("auto-derives approver_id when omitted", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("rejector-uuid");
    const input = { body: { comment: "not acceptable" } };
    const spec = getExemptionResource().executeActions?.reject;
    if (!spec?.preflight) throw new Error("reject preflight missing");

    await spec.preflight(makeCtx(input, getCurrentUserId));

    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).approver_id).toBe("rejector-uuid");
  });
});
