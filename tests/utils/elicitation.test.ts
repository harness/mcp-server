import { describe, it, expect, vi, afterEach } from "vitest";
import { clientSupportsElicitation, confirmViaElicitation, configureElicitation } from "../../src/utils/elicitation.js";
import { isBlockingRisk, requiresConfirmation, shouldAutoApprove } from "../../src/registry/types.js";
import type { RiskLevel, AutoApproveRisk } from "../../src/registry/types.js";

/** Minimal stub of the Server class (only the methods we use). */
function makeServerStub(capabilities: unknown, elicitResult?: unknown) {
  const server = {
    getClientCapabilities: vi.fn().mockReturnValue(capabilities),
    elicitInput: vi.fn().mockResolvedValue(elicitResult),
  };
  return { server } as any;
}

describe("isBlockingRisk (deprecated)", () => {
  it.each<[RiskLevel, boolean]>([
    ["read", false],
    ["low_write", false],
    ["medium_write", false],
    ["high_write", true],
    ["destructive", true],
  ])("isBlockingRisk(%s) → %s", (risk, expected) => {
    expect(isBlockingRisk(risk)).toBe(expected);
  });
});

describe("requiresConfirmation", () => {
  it.each<[RiskLevel, boolean]>([
    ["read", false],
    ["low_write", false],
    ["medium_write", true],
    ["high_write", true],
    ["destructive", true],
  ])("requiresConfirmation(%s) → %s", (risk, expected) => {
    expect(requiresConfirmation(risk)).toBe(expected);
  });
});

describe("shouldAutoApprove", () => {
  it.each<[RiskLevel, AutoApproveRisk, boolean]>([
    ["read", "none", false],
    ["low_write", "none", false],
    ["destructive", "none", false],
    ["read", "low_write", true],
    ["low_write", "low_write", true],
    ["medium_write", "low_write", false],
    ["high_write", "low_write", false],
    ["read", "medium_write", true],
    ["low_write", "medium_write", true],
    ["medium_write", "medium_write", true],
    ["high_write", "medium_write", false],
    ["destructive", "medium_write", false],
    ["high_write", "high_write", true],
    ["destructive", "high_write", false],
    ["read", "all", true],
    ["destructive", "all", true],
  ])("shouldAutoApprove(%s, %s) → %s", (risk, threshold, expected) => {
    expect(shouldAutoApprove(risk, threshold)).toBe(expected);
  });
});

describe("clientSupportsElicitation", () => {
  it("returns false when capabilities are undefined", () => {
    const server = { getClientCapabilities: () => undefined } as any;
    expect(clientSupportsElicitation(server)).toBe(false);
  });

  it("returns false when elicitation is absent", () => {
    const server = { getClientCapabilities: () => ({}) } as any;
    expect(clientSupportsElicitation(server)).toBe(false);
  });

  it("returns true when elicitation is present as empty object (form is default)", () => {
    const server = { getClientCapabilities: () => ({ elicitation: {} }) } as any;
    expect(clientSupportsElicitation(server)).toBe(true);
  });

  it("returns true when elicitation.form is present", () => {
    const server = { getClientCapabilities: () => ({ elicitation: { form: {} } }) } as any;
    expect(clientSupportsElicitation(server)).toBe(true);
  });
});

describe("confirmViaElicitation", () => {
  afterEach(() => {
    configureElicitation({ autoApproveRisk: "none" });
  });

  it("proceeds when client does not support elicitation (low_write)", async () => {
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create pipeline?",
      risk: "low_write",
    });
    expect(result).toEqual({ proceed: true, method: "not_required" });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it("blocks when client does not support elicitation (destructive)", async () => {
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete pipeline?",
      risk: "destructive",
    });
    expect(result).toEqual({ proceed: false, reason: "declined", method: "blocked" });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it("blocks when client does not support elicitation (medium_write)", async () => {
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create repo rule?",
      risk: "medium_write",
    });
    expect(result).toEqual({ proceed: false, reason: "declined", method: "blocked" });
  });

  it("proceeds when user accepts", async () => {
    const mcpServer = makeServerStub(
      { elicitation: { form: {} } },
      { action: "accept" },
    );
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create service?",
      risk: "low_write",
    });
    expect(result).toEqual({ proceed: true, method: "elicited" });
    expect(mcpServer.server.elicitInput).toHaveBeenCalledOnce();
  });

  it("returns declined when user declines", async () => {
    const mcpServer = makeServerStub(
      { elicitation: { form: {} } },
      { action: "decline" },
    );
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete connector?",
      risk: "destructive",
    });
    expect(result).toEqual({ proceed: false, reason: "declined", method: "elicited" });
  });

  it("returns cancelled when user cancels", async () => {
    const mcpServer = makeServerStub(
      { elicitation: { form: {} } },
      { action: "cancel" },
    );
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_execute",
      message: "Run pipeline?",
      risk: "high_write",
    });
    expect(result).toEqual({ proceed: false, reason: "cancelled", method: "elicited" });
  });

  it("proceeds when elicitInput throws (low_write)", async () => {
    const mcpServer = makeServerStub({ elicitation: { form: {} } });
    mcpServer.server.elicitInput.mockRejectedValue(new Error("not implemented"));
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create service?",
      risk: "low_write",
    });
    expect(result).toEqual({ proceed: true, method: "skipped" });
  });

  it("blocks when elicitInput throws (destructive)", async () => {
    const mcpServer = makeServerStub({ elicitation: { form: {} } });
    mcpServer.server.elicitInput.mockRejectedValue(new Error("not implemented"));
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete service?",
      risk: "destructive",
    });
    expect(result).toEqual({ proceed: false, reason: "cancelled", method: "blocked" });
  });

  it("blocks when elicitInput throws (medium_write)", async () => {
    const mcpServer = makeServerStub({ elicitation: { form: {} } });
    mcpServer.server.elicitInput.mockRejectedValue(new Error("not implemented"));
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create repo rule?",
      risk: "medium_write",
    });
    expect(result).toEqual({ proceed: false, reason: "cancelled", method: "blocked" });
  });

  it("passes message to elicitInput with empty schema", async () => {
    const mcpServer = makeServerStub(
      { elicitation: { form: {} } },
      { action: "accept" },
    );
    await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete pipeline 'my-pipe'?",
      risk: "destructive",
    });
    const call = mcpServer.server.elicitInput.mock.calls[0][0];
    expect(call.mode).toBe("form");
    expect(call.message).toBe("Delete pipeline 'my-pipe'?");
    expect(call.requestedSchema.properties).toEqual({});
  });

  it("auto-approves when risk is within AUTO_APPROVE_RISK threshold", async () => {
    configureElicitation({ autoApproveRisk: "all" });
    const mcpServer = makeServerStub(
      { elicitation: { form: {} } },
      { action: "decline" },
    );
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete pipeline?",
      risk: "destructive",
    });
    expect(result).toEqual({ proceed: true, method: "auto_approved" });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it("auto-approves low_write when threshold is low_write", async () => {
    configureElicitation({ autoApproveRisk: "low_write" });
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create service?",
      risk: "low_write",
    });
    expect(result).toEqual({ proceed: true, method: "auto_approved" });
  });

  it("does not auto-approve high_write when threshold is low_write", async () => {
    configureElicitation({ autoApproveRisk: "low_write" });
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_execute",
      message: "Run pipeline?",
      risk: "high_write",
    });
    expect(result).toEqual({ proceed: false, reason: "declined", method: "blocked" });
  });

  it("skips elicitation for non-destructive ops when auto-approve is 'all'", async () => {
    configureElicitation({ autoApproveRisk: "all" });
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create service?",
      risk: "low_write",
    });
    expect(result).toEqual({ proceed: true, method: "auto_approved" });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });
});
