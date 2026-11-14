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

describe("cost_perspective update preflight", () => {
  function getUpdatePreflight() {
    const spec = ccmToolset.resources.find((r) => r.resourceType === "cost_perspective")
      ?.operations.update;
    if (!spec?.preflight) throw new Error("cost_perspective update preflight missing");
    return spec.preflight;
  }

  function makeUpdateCtx(body: Record<string, unknown>, existing: unknown | Error) {
    const dispatch = vi.fn().mockImplementation(async () => {
      if (existing instanceof Error) throw existing;
      return existing;
    });
    const ctx = {
      client: { account: "acct", request: vi.fn() } as unknown as PreflightContext["client"],
      input: { body },
      registry: { dispatch, getResource: vi.fn(), orgId: undefined, projectId: undefined },
    } as PreflightContext;
    return { ctx, dispatch };
  }

  const existing = {
    uuid: "p1",
    name: "Old",
    viewVersion: "v1",
    viewType: "CUSTOMER",
    viewState: "COMPLETED",
    folderId: "f1",
    viewRules: [{ viewConditions: [] }],
    viewPreferences: { includeOthers: true },
    unitMetricInfo: [{ name: "u" }],
  };

  it("fills missing fields (incl. viewVersion) from the existing perspective", async () => {
    const body: Record<string, unknown> = { uuid: "p1", name: "Renamed" };
    const { ctx, dispatch } = makeUpdateCtx(body, existing);
    await getUpdatePreflight()(ctx);
    expect(dispatch).toHaveBeenCalledWith(expect.anything(), "cost_perspective", "get", { perspective_id: "p1" }, undefined);
    expect(body.name).toBe("Renamed");
    expect(body.viewVersion).toBe("v1");
    expect(body.folderId).toBe("f1");
    expect(body.viewPreferences).toEqual({ includeOthers: true });
    expect(body.unitMetricInfo).toEqual([{ name: "u" }]);
  });

  it("keeps caller values, including an explicit empty unitMetricInfo", async () => {
    const body: Record<string, unknown> = { uuid: "p1", name: "X", folderId: "f2", unitMetricInfo: [] };
    const { ctx } = makeUpdateCtx(body, existing);
    await getUpdatePreflight()(ctx);
    expect(body.folderId).toBe("f2");
    expect(body.unitMetricInfo).toEqual([]);
  });

  it("still defaults viewVersion to v1 when the lookup fails", async () => {
    const body: Record<string, unknown> = { uuid: "p1", name: "X" };
    const { ctx } = makeUpdateCtx(body, new Error("boom"));
    await getUpdatePreflight()(ctx);
    expect(body.viewVersion).toBe("v1");
  });
});
