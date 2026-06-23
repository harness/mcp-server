/**
 * Regression tests for cost_perspective.create preflight.
 *
 * PR #377 refactored perspectiveCreatePreflight to use HarnessClientInterface
 * instead of casting to HarnessClient. These tests lock in:
 *   1. Account settings defaults are fetched and merged (agent overrides win).
 *   2. Settings API failures degrade gracefully — defaults still applied.
 *   3. Structural client mocks (account + request) satisfy the preflight contract.
 */
import { describe, it, expect, vi } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";
import type { EndpointSpec, PreflightContext, ResourceDefinition } from "../../src/registry/types.js";

function getPerspectiveResource(): ResourceDefinition {
  const resource = ccmToolset.resources.find((r) => r.resourceType === "cost_perspective");
  if (!resource) throw new Error("cost_perspective resource missing");
  return resource;
}

function getCreateSpec(): EndpointSpec {
  const spec = getPerspectiveResource().operations.create;
  if (!spec?.preflight) throw new Error("cost_perspective.create preflight missing");
  return spec;
}

function makeCtx(
  input: Record<string, unknown>,
  request: ReturnType<typeof vi.fn>,
  account = "acct-123",
): PreflightContext {
  return {
    client: {
      account,
      request,
      getCurrentUserId: vi.fn(),
    },
    input,
    registry: {
      dispatch: async () => undefined,
      getResource: () => getPerspectiveResource(),
    },
  };
}

describe("cost_perspective.create preflight — viewPreferences merge", () => {
  it("fetches account settings and overlays agent-provided viewPreferences", async () => {
    const request = vi.fn().mockResolvedValue({
      resource: [
        { identifier: "show_anomalies", value: "true" },
        { identifier: "include_aws_discounts", value: "false" },
        { identifier: "show_aws_cost_as", value: "AMORTISED" },
      ],
    });

    const input: Record<string, unknown> = {
      body: {
        name: "Prod spend",
        viewPreferences: {
          showAnomalies: false,
          awsPreferences: { includeDiscounts: true },
        },
      },
    };

    await getCreateSpec().preflight!(makeCtx(input, request));

    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0][0]).toMatchObject({
      method: "GET",
      path: "/ng/api/settings",
      params: {
        accountIdentifier: "acct-123",
        category: "CE",
        group: "perspective_preferences",
      },
    });

    const prefs = (input.body as Record<string, unknown>).viewPreferences as Record<string, unknown>;
    expect(prefs.showAnomalies).toBe(false);
    expect((prefs.awsPreferences as Record<string, unknown>).includeDiscounts).toBe(true);
    expect((prefs.awsPreferences as Record<string, unknown>).awsCost).toBe("AMORTISED");
  });

  it("accepts a bare settings array response shape", async () => {
    const request = vi.fn().mockResolvedValue([
      { identifier: "show_others", value: "true" },
    ]);

    const input: Record<string, unknown> = { body: { name: "Bare array" } };
    await getCreateSpec().preflight!(makeCtx(input, request));

    const prefs = (input.body as Record<string, unknown>).viewPreferences as Record<string, unknown>;
    expect(prefs.includeOthers).toBe(true);
  });

  it("degrades gracefully when settings fetch fails and still sets view defaults", async () => {
    const request = vi.fn().mockRejectedValue(new Error("503 upstream"));
    const input: Record<string, unknown> = { body: { name: "No settings" } };

    await getCreateSpec().preflight!(makeCtx(input, request));

    const body = input.body as Record<string, unknown>;
    expect(body.viewState).toBe("COMPLETED");
    expect(body.viewType).toBe("CUSTOMER");
    expect(body.viewVersion).toBe("v1");
    expect(body.viewPreferences).toBeUndefined();
  });

  it("skips settings fetch when account id is empty", async () => {
    const request = vi.fn();
    const input: Record<string, unknown> = { body: { name: "No account" } };

    await getCreateSpec().preflight!(makeCtx(input, request, ""));

    expect(request).not.toHaveBeenCalled();
  });
});
