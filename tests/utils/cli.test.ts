import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { parseArgs } from "../../src/utils/cli.js";

describe("parseArgs", () => {
  let originalPort: string | undefined;

  beforeEach(() => {
    originalPort = process.env.PORT;
    delete process.env.PORT;
  });

  afterEach(() => {
    if (originalPort !== undefined) {
      process.env.PORT = originalPort;
    } else {
      delete process.env.PORT;
    }
    vi.restoreAllMocks();
  });

  it("exits with 0 on --help", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseArgs(["--help"])).toThrow("exit");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("exits with 0 on --version", () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("exit"); });
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => parseArgs(["--version"])).toThrow("exit");
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/^\d+\.\d+\.\d+|unknown$/));
  });

  it("defaults to stdio transport and port 3000", () => {
    const args = parseArgs([]);
    expect(args.transport).toBe("stdio");
    expect(args.port).toBe(3000);
  });

  it("parses http transport", () => {
    const args = parseArgs(["http"]);
    expect(args.transport).toBe("http");
  });

  it("parses stdio transport explicitly", () => {
    const args = parseArgs(["stdio"]);
    expect(args.transport).toBe("stdio");
  });

  it("parses --port flag", () => {
    const args = parseArgs(["http", "--port", "8080"]);
    expect(args.transport).toBe("http");
    expect(args.port).toBe(8080);
  });

  it("parses --port before transport", () => {
    const args = parseArgs(["--port", "9090", "http"]);
    expect(args.transport).toBe("http");
    expect(args.port).toBe(9090);
  });

  it("falls back to PORT env var when --port not specified", () => {
    process.env.PORT = "4000";
    const args = parseArgs(["http"]);
    expect(args.port).toBe(4000);
  });

  it("--port flag takes precedence over PORT env var", () => {
    process.env.PORT = "4000";
    const args = parseArgs(["http", "--port", "5000"]);
    expect(args.port).toBe(5000);
  });

  it("ignores invalid --port value and falls back to default", () => {
    const args = parseArgs(["http", "--port", "not-a-number"]);
    expect(args.port).toBe(3000);
  });

  it("ignores out-of-range port (0) and falls back to default", () => {
    const args = parseArgs(["http", "--port", "0"]);
    expect(args.port).toBe(3000);
  });

  it("ignores out-of-range port (99999) and falls back to default", () => {
    const args = parseArgs(["http", "--port", "99999"]);
    expect(args.port).toBe(3000);
  });

  it("ignores fractional port and falls back to default", () => {
    const args = parseArgs(["http", "--port", "3000.5"]);
    expect(args.port).toBe(3000);
  });

  it("throws on unknown transport", () => {
    expect(() => parseArgs(["grpc"])).toThrow(
      'Unknown transport: "grpc". Supported: stdio, http',
    );
  });

  it("accepts port 1 (minimum)", () => {
    const args = parseArgs(["--port", "1"]);
    expect(args.port).toBe(1);
  });

  it("accepts port 65535 (maximum)", () => {
    const args = parseArgs(["--port", "65535"]);
    expect(args.port).toBe(65535);
  });
});
