import { describe, expect, it } from "vitest";
import { parseMcpAllowedHostnames, resolveHttpHostValidationOptions } from "../../src/utils/http-hosts.js";

describe("parseMcpAllowedHostnames", () => {
  it("returns empty list when unset", () => {
    expect(parseMcpAllowedHostnames(undefined)).toEqual([]);
  });

  it("parses comma-separated hostnames", () => {
    expect(parseMcpAllowedHostnames("a.example.com, b.example.com")).toEqual(["a.example.com", "b.example.com"]);
  });

  it("throws on malformed entries", () => {
    expect(() => parseMcpAllowedHostnames("good.example.com, http://")).toThrow(
      'Invalid HARNESS_MCP_ALLOWED_HOSTS entries: "http://"',
    );
  });
});

describe("resolveHttpHostValidationOptions", () => {
  it("allows the hosted MCP hostname when binding to localhost", () => {
    const options = resolveHttpHostValidationOptions("127.0.0.1", {});

    expect(options).toEqual({
      host: "127.0.0.1",
      allowedHosts: ["localhost", "127.0.0.1", "[::1]", "mcp.harness.io"],
    });
  });

  it("allows hosted MCP hostname when binding to IPv6 localhost", () => {
    const options = resolveHttpHostValidationOptions("::1", {});

    expect(options).toEqual({
      host: "::1",
      allowedHosts: ["localhost", "127.0.0.1", "[::1]", "mcp.harness.io"],
    });
  });

  it("adds configured hostnames without ports or duplicates", () => {
    const options = resolveHttpHostValidationOptions("127.0.0.1", {
      HARNESS_MCP_ALLOWED_HOSTS: "https://mcp.example.com, mcp.example.com:443, localhost",
    });

    expect(options.allowedHosts).toEqual([
      "localhost",
      "127.0.0.1",
      "[::1]",
      "mcp.harness.io",
      "mcp.example.com",
    ]);
  });

  it("preserves SDK defaults for non-local binds without configured hosts", () => {
    const options = resolveHttpHostValidationOptions("0.0.0.0", {});

    expect(options).toEqual({ host: "0.0.0.0" });
  });

  it("throws on malformed configured hosts", () => {
    expect(() =>
      resolveHttpHostValidationOptions("0.0.0.0", {
        HARNESS_MCP_ALLOWED_HOSTS: "mcp.example.com, http://",
      }),
    ).toThrow('Invalid HARNESS_MCP_ALLOWED_HOSTS entries: "http://"');
  });
});
