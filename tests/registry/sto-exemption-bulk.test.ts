/**
 * Tests for the `security_exemption_bulk` resource that wraps
 * POST /sto/api/v2/exemptions/bulk.
 *
 * Covers:
 *   1. Preflight validates required top-level fields, items array bounds,
 *      per-item required `issue_id`, and the target_id ⟂ pipeline_id mutual
 *      exclusion. Fail-loud — never silently fixes payloads.
 *   2. bodyBuilder maps snake_case → camelCase, preserves item ordering,
 *      defaults durationDays=30, always sets exemptFutureOccurrences=true.
 *   3. responseExtractor surfaces ALL_SUCCEEDED / ALL_FAILED status banners
 *      and an _action_hint on failure so the LLM doesn't retry partial batches.
 *   4. requester_id is auto-derived from the authenticated PAT (never asked
 *      from the user).
 */
import { describe, it, expect, vi } from "vitest";
import { stoToolset } from "../../src/registry/toolsets/sto.js";
import type { EndpointSpec, ResourceDefinition, PreflightContext } from "../../src/registry/types.js";

function getBulkResource(): ResourceDefinition {
  const r = stoToolset.resources.find((x) => x.resourceType === "security_exemption_bulk");
  if (!r) throw new Error("security_exemption_bulk resource not registered");
  return r;
}

function getCreateSpec(): EndpointSpec {
  const spec = getBulkResource().operations.create;
  if (!spec) throw new Error("security_exemption_bulk.create spec missing");
  return spec;
}

function makeCtx(input: Record<string, unknown>, getCurrentUserId = vi.fn().mockResolvedValue("user-uuid")): PreflightContext {
  return {
    client: { account: "test-account", getCurrentUserId } as unknown as PreflightContext["client"],
    input,
    registry: {
      dispatch: async () => undefined,
      getResource: () => getBulkResource(),
    },
  };
}

async function runPreflight(input: Record<string, unknown>, getCurrentUserId?: ReturnType<typeof vi.fn>): Promise<void> {
  const spec = getCreateSpec();
  if (!spec.preflight) throw new Error("preflight missing");
  await spec.preflight(makeCtx(input, getCurrentUserId));
}

// ─── 1. Preflight validation ────────────────────────────────────────────

describe("security_exemption_bulk preflight — required fields", () => {
  it("rejects when type is missing", async () => {
    const input = { body: { reason: "x", items: [{ issue_id: "i1" }] } };
    await expect(runPreflight(input)).rejects.toThrow(/Missing required fields.*type/);
  });

  it("rejects when reason is missing", async () => {
    const input = { body: { type: "Other", items: [{ issue_id: "i1" }] } };
    await expect(runPreflight(input)).rejects.toThrow(/Missing required fields.*reason/);
  });

  it("rejects when items is missing", async () => {
    const input = { body: { type: "Other", reason: "x" } };
    await expect(runPreflight(input)).rejects.toThrow(/Missing required fields.*items/);
  });

  it("rejects when items is empty", async () => {
    const input = { body: { type: "Other", reason: "x", items: [] } };
    await expect(runPreflight(input)).rejects.toThrow(/non-empty array/);
  });

  it("rejects when items exceeds 100 entries", async () => {
    const items = Array.from({ length: 101 }, (_, i) => ({ issue_id: `i${i}` }));
    const input = { body: { type: "Other", reason: "x", items } };
    await expect(runPreflight(input)).rejects.toThrow(/at most 100/);
  });

  it("rejects per-item missing issue_id with the offending index", async () => {
    const input = { body: { type: "Other", reason: "x", items: [{ issue_id: "i1" }, { foo: "bar" }] } };
    await expect(runPreflight(input)).rejects.toThrow(/items\[1\]\.issue_id/);
  });

  it("rejects per-item that sets BOTH target_id and pipeline_id", async () => {
    const input = {
      body: {
        type: "Other",
        reason: "x",
        items: [{ issue_id: "i1", target_id: "t1", pipeline_id: "p1" }],
      },
    };
    await expect(runPreflight(input)).rejects.toThrow(/mutually exclusive/);
  });

  it("auto-derives requester_id from the PAT (never asks the user)", async () => {
    const getCurrentUserId = vi.fn().mockResolvedValue("user-uuid-42");
    const input = { body: { type: "Other", reason: "x", items: [{ issue_id: "i1" }] } };
    await runPreflight(input, getCurrentUserId);
    expect(getCurrentUserId).toHaveBeenCalledOnce();
    expect((input.body as Record<string, unknown>).requester_id).toBe("user-uuid-42");
  });
});

// ─── 2. bodyBuilder transformation ──────────────────────────────────────

describe("security_exemption_bulk bodyBuilder", () => {
  it("maps snake_case → camelCase, preserves item order, defaults durationDays=30", () => {
    const spec = getCreateSpec();
    const body = spec.bodyBuilder!({
      body: {
        type: "False Positive",
        reason: "Patched upstream",
        requester_id: "user-uuid-1",
        items: [
          { issue_id: "i1", pipeline_id: "p1" },
          { issue_id: "i2", target_id: "t2", scan_id: "s2", occurrences: [42, 666], search: "CWE-79" },
          { issue_id: "i3" },
        ],
      },
    }) as Record<string, unknown>;

    expect(body.type).toBe("False Positive");
    expect(body.reason).toBe("Patched upstream");
    expect(body.requesterId).toBe("user-uuid-1");
    expect(body.exemptFutureOccurrences).toBe(true);
    expect(body.pendingChanges).toEqual({ durationDays: 30 });

    const items = body.items as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ issueId: "i1", pipelineId: "p1" });
    expect(items[1]).toEqual({
      issueId: "i2",
      targetId: "t2",
      scanId: "s2",
      occurrences: [42, 666],
      search: "CWE-79",
    });
    expect(items[2]).toEqual({ issueId: "i3" });
  });

  it("honors a caller-supplied duration_days", () => {
    const body = getCreateSpec().bodyBuilder!({
      body: {
        type: "Acceptable Risk",
        reason: "x",
        requester_id: "u1",
        duration_days: 90,
        items: [{ issue_id: "i1" }],
      },
    }) as Record<string, unknown>;
    expect(body.pendingChanges).toEqual({ durationDays: 90 });
  });

  it("forwards optional link and expiration only when set", () => {
    const withOpts = getCreateSpec().bodyBuilder!({
      body: {
        type: "Other",
        reason: "x",
        requester_id: "u1",
        link: "https://j/X-1",
        expiration: 1800000000,
        items: [{ issue_id: "i1" }],
      },
    }) as Record<string, unknown>;
    expect(withOpts.link).toBe("https://j/X-1");
    expect(withOpts.expiration).toBe(1800000000);

    const minimal = getCreateSpec().bodyBuilder!({
      body: { type: "Other", reason: "x", requester_id: "u1", items: [{ issue_id: "i1" }] },
    }) as Record<string, unknown>;
    expect(minimal.link).toBeUndefined();
    expect(minimal.expiration).toBeUndefined();
  });
});

// ─── 3. responseExtractor (all-or-none status banner) ───────────────────

describe("security_exemption_bulk responseExtractor", () => {
  const extract = getCreateSpec().responseExtractor!;

  it("emits ALL_SUCCEEDED when failed=0", () => {
    const out = extract({
      results: [
        { issueId: "i1", id: "e1", statusCode: 201 },
        { issueId: "i2", id: "e2", statusCode: 201 },
      ],
      succeeded: 2,
      failed: 0,
    }) as Record<string, unknown>;
    expect(out.status).toBe("ALL_SUCCEEDED");
    expect(out.succeeded).toBe(2);
    expect(out.failed).toBe(0);
    expect(out.total).toBe(2);
    expect(out._action_hint).toBeUndefined();
  });

  it("emits ALL_FAILED and an _action_hint when succeeded=0", () => {
    const out = extract({
      results: [
        { issueId: "i1", error: "issue not found", statusCode: 404 },
        { issueId: "i2", error: "issue not found", statusCode: 404 },
      ],
      succeeded: 0,
      failed: 2,
    }) as Record<string, unknown>;
    expect(out.status).toBe("ALL_FAILED");
    expect(out._action_hint).toMatch(/rolled back/i);
    expect(out._action_hint).toMatch(/full corrected list/i);
  });

  it("flags MIXED_UNEXPECTED when the server violates the all-or-none contract", () => {
    const out = extract({
      results: [{ issueId: "i1", id: "e1", statusCode: 201 }, { issueId: "i2", error: "x", statusCode: 400 }],
      succeeded: 1,
      failed: 1,
    }) as Record<string, unknown>;
    expect(out.status).toBe("MIXED_UNEXPECTED");
    expect(out._action_hint).toMatch(/server-side bug/i);
  });

  it("emits EMPTY for a zero-item response (defensive)", () => {
    const out = extract({ results: [], succeeded: 0, failed: 0 }) as Record<string, unknown>;
    expect(out.status).toBe("EMPTY");
  });
});
