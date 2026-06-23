/**
 * Regression tests for cost_perspective.create preflight.
 *
 * The preflight fetches account-level perspective preference defaults from the
 * Settings API, deep-merges them into body.viewPreferences (agent values win),
 * and applies viewState/viewType/viewVersion defaults. It uses a narrow
 * CcmPreflightClient interface (account + request only) — not HarnessClient.
 */
import { describe, it, expect, vi } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import type { EndpointSpec, ResourceDefinition, PreflightContext } from "../../src/registry/types.js";

function getPerspectiveResource(): ResourceDefinition {
  const r = ccmToolset.resources.find((x) => x.resourceType === "cost_perspective");
  if (!r) throw new Error("cost_perspective resource not registered");
  return r;
}

function getCreateSpec(): EndpointSpec {
  const spec = getPerspectiveResource().operations.create;
  if (!spec) throw new Error("cost_perspective.create spec missing");
  return spec;
}

function makeCtx(
  input: Record<string, unknown>,
  request: ReturnType<typeof vi.fn>,
  account = "acct-123",
): PreflightContext {
  return {
    client: { account, request } as unknown as PreflightContext["client"],
    input,
    registry: {
      dispatch: async () => undefined,
      getResource: () => getPerspectiveResource(),
    },
  };
}

async function runPreflight(
  input: Record<string, unknown>,
  request: ReturnType<typeof vi.fn>,
): Promise<void> {
  const spec = getCreateSpec();
  if (!spec.preflight) throw new Error("cost_perspective.create has no preflight");
  await spec.preflight(makeCtx(input, request));
}

const SAMPLE_SETTINGS = [
  { identifier: "show_others", value: "true" },
  { identifier: "show_anomalies", value: "false" },
  { identifier: "include_aws_discounts", value: "true" },
  { identifier: "show_aws_cost_as", value: "NET_AMORTISED" },
];

describe("cost_perspective.create preflight", () => {
  it("fetches account settings and merges viewPreferences defaults (agent wins)", async () => {
    const request = vi.fn().mockResolvedValue({ resource: SAMPLE_SETTINGS });
    const input = {
      body: {
        name: "My Perspective",
        viewPreferences: { showAnomalies: true },
      },
    };

    await runPreflight(input, request);

    expect(request).toHaveBeenCalledWith({
      method: "GET",
      path: "/ng/api/settings",
      params: {
        accountIdentifier: "acct-123",
        category: "CE",
        group: "perspective_preferences",
      },
    });

    const prefs = (input.body as Record<string, unknown>).viewPreferences as Record<string, unknown>;
    expect(prefs.includeOthers).toBe(true);
    expect(prefs.showAnomalies).toBe(true);
    expect(prefs.awsPreferences).toEqual({
      includeDiscounts: true,
      awsCost: "NET_AMORTISED",
    });
  });

  it("applies viewState, viewType, and viewVersion defaults when absent", async () => {
    const request = vi.fn().mockResolvedValue([]);
    const input = { body: { name: "Defaults Only" } };

    await runPreflight(input, request);

    const body = input.body as Record<string, unknown>;
    expect(body.viewState).toBe("COMPLETED");
    expect(body.viewType).toBe("CUSTOMER");
    expect(body.viewVersion).toBe("v1");
  });

  it("preserves caller-supplied viewState, viewType, and viewVersion", async () => {
    const request = vi.fn().mockResolvedValue([]);
    const input = {
      body: {
        name: "Custom",
        viewState: "DRAFT",
        viewType: "SAMPLE",
        viewVersion: "v2",
      },
    };

    await runPreflight(input, request);

    const body = input.body as Record<string, unknown>;
    expect(body.viewState).toBe("DRAFT");
    expect(body.viewType).toBe("SAMPLE");
    expect(body.viewVersion).toBe("v2");
  });

  it("gracefully degrades when settings fetch fails", async () => {
    const request = vi.fn().mockRejectedValue(new Error("settings unavailable"));
    const input = { body: { name: "No Settings" } };

    await expect(runPreflight(input, request)).resolves.toBeUndefined();

    const body = input.body as Record<string, unknown>;
    expect(body.viewState).toBe("COMPLETED");
    expect(body.viewType).toBe("CUSTOMER");
    expect(body.viewVersion).toBe("v1");
    expect(body.viewPreferences).toBeUndefined();
  });

  it("works with narrow preflight client (account + request only)", async () => {
    const request = vi.fn().mockResolvedValue({ data: SAMPLE_SETTINGS });
    const input = { body: { name: "Narrow Client" } };

    const spec = getCreateSpec();
    await spec.preflight!({
      client: { account: "narrow-acct", request } as unknown as PreflightContext["client"],
      input,
      registry: { dispatch: async () => undefined, getResource: () => getPerspectiveResource() },
    });

    expect(request).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).viewPreferences).toBeDefined();
  });
});
