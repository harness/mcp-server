import { describe, it, expect, vi, afterEach } from "vitest";
import { clientSupportsElicitation, confirmViaElicitation, configureElicitation } from "../../src/utils/elicitation.js";

/** Minimal stub of the Server class (only the methods we use). */
function makeServerStub(capabilities: unknown, elicitResult?: unknown) {
  const server = {
    getClientCapabilities: vi.fn().mockReturnValue(capabilities),
    elicitInput: vi.fn().mockResolvedValue(elicitResult),
  };
  return { server } as any;
}

describe("clientSupportsElicitation", () => {
  it("returns false when capabilities are undefined", () => {
    const server = { getClientCapabilities: () => undefined } as any;
    expect(clientSupportsElicitation(server)).toBe(false);
  });

  it("returns false when elicitation is absent", () => {
    const server = { getClientCapabilities: () => ({}) } as any;
    expect(clientSupportsElicitation(server)).toBe(false);
  });

  it("returns false when elicitation.form is absent", () => {
    const server = { getClientCapabilities: () => ({ elicitation: {} }) } as any;
    expect(clientSupportsElicitation(server)).toBe(false);
  });

  it("returns true when elicitation.form is present", () => {
    const server = { getClientCapabilities: () => ({ elicitation: { form: {} } }) } as any;
    expect(clientSupportsElicitation(server)).toBe(true);
  });
});

describe("confirmViaElicitation", () => {
  afterEach(() => {
    // Reset skip flag after each test
    configureElicitation({ skip: false });
  });

  it("proceeds when client does not support elicitation (non-destructive)", async () => {
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create pipeline?",
    });
    expect(result).toEqual({ proceed: true });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it("blocks when client does not support elicitation (destructive)", async () => {
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete pipeline?",
      destructive: true,
    });
    expect(result).toEqual({ proceed: false, reason: "declined" });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
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
    });
    expect(result).toEqual({ proceed: true });
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
    });
    expect(result).toEqual({ proceed: false, reason: "declined" });
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
    });
    expect(result).toEqual({ proceed: false, reason: "cancelled" });
  });

  it("proceeds when elicitInput throws (non-destructive)", async () => {
    const mcpServer = makeServerStub({ elicitation: { form: {} } });
    mcpServer.server.elicitInput.mockRejectedValue(new Error("not implemented"));
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create service?",
    });
    expect(result).toEqual({ proceed: true });
  });

  it("blocks when elicitInput throws (destructive)", async () => {
    const mcpServer = makeServerStub({ elicitation: { form: {} } });
    mcpServer.server.elicitInput.mockRejectedValue(new Error("not implemented"));
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete service?",
      destructive: true,
    });
    expect(result).toEqual({ proceed: false, reason: "cancelled" });
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
    });
    const call = mcpServer.server.elicitInput.mock.calls[0][0];
    expect(call.mode).toBe("form");
    expect(call.message).toBe("Delete pipeline 'my-pipe'?");
    expect(call.requestedSchema.properties).toEqual({});
  });

  it("skips elicitation entirely when HARNESS_SKIP_ELICITATION is set", async () => {
    configureElicitation({ skip: true });
    const mcpServer = makeServerStub(
      { elicitation: { form: {} } },
      { action: "decline" },
    );
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_delete",
      message: "Delete pipeline?",
      destructive: true,
    });
    expect(result).toEqual({ proceed: true });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });

  it("skips elicitation for non-destructive ops when HARNESS_SKIP_ELICITATION is set", async () => {
    configureElicitation({ skip: true });
    const mcpServer = makeServerStub(undefined);
    const result = await confirmViaElicitation({
      server: mcpServer,
      toolName: "harness_create",
      message: "Create service?",
    });
    expect(result).toEqual({ proceed: true });
    expect(mcpServer.server.elicitInput).not.toHaveBeenCalled();
  });
});
