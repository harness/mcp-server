/**
 * cost_perspective create preflight: publish defaults without client.account,
 * and load preference defaults from the registry-resolved accountId.
 */
import { describe, it, expect, vi } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import type { PreflightContext } from "../../src/registry/types.js";

function getPreflight() {
  const spec = ccmToolset.resources.find((r) => r.resourceType === "cost_perspective")
    ?.operations.create;
  if (!spec?.preflight) throw new Error("cost_perspective create preflight missing");
  return spec.preflight;
}

function makeCtx(overrides: {
  account?: string;
  accountId?: string;
  body?: Record<string, unknown>;
  request?: ReturnType<typeof vi.fn>;
}): PreflightContext {
  const request = overrides.request ?? vi.fn().mockResolvedValue([]);
  return {
    client: {
      account: overrides.account ?? "",
      request,
      getCurrentUserId: vi.fn(),
    } as unknown as PreflightContext["client"],
    input: { body: overrides.body ?? { name: "Test View" } },
    registry: {
      dispatch: vi.fn(),
      getResource: vi.fn(),
      orgId: undefined,
      projectId: undefined,
    },
    accountId: overrides.accountId,
  };
}

describe("cost_perspective create preflight", () => {
  it("sets COMPLETED/CUSTOMER/v1 when client.account is empty", async () => {
    const body: Record<string, unknown> = { name: "Sandy GCP Test" };
    await getPreflight()(makeCtx({ account: "", body }));
    expect(body.viewState).toBe("COMPLETED");
    expect(body.viewType).toBe("CUSTOMER");
    expect(body.viewVersion).toBe("v1");
  });

  it("does not overwrite caller-provided viewState", async () => {
    const body: Record<string, unknown> = { name: "Draft", viewState: "DRAFT" };
    await getPreflight()(makeCtx({ account: "", body }));
    expect(body.viewState).toBe("DRAFT");
  });

  it("fetches preference defaults with ctx.accountId when client.account is empty", async () => {
    const request = vi.fn().mockResolvedValue([]);
    const body: Record<string, unknown> = { name: "Prefs" };
    await getPreflight()(makeCtx({
      account: "",
      accountId: "session-acct",
      body,
      request,
    }));
    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      method: "GET",
      path: "/ng/api/settings",
      params: expect.objectContaining({ accountIdentifier: "session-acct" }),
    }));
    expect(body.viewState).toBe("COMPLETED");
  });

  it("skips settings fetch when neither ctx.accountId nor client.account is set", async () => {
    const request = vi.fn();
    await getPreflight()(makeCtx({ account: "", body: { name: "No tenant" }, request }));
    expect(request).not.toHaveBeenCalled();
  });
});
