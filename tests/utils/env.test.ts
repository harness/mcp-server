import { chdir, cwd } from "node:process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadEnvFile } from "../../src/utils/env.js";

const envKey = "HARNESS_TEST_DOTENV_QUIET";
let tempDir: string | undefined;
const originalCwd = cwd();

afterEach(() => {
  chdir(originalCwd);
  delete process.env[envKey];
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  vi.restoreAllMocks();
});

describe("loadEnvFile", () => {
  it("loads custom env files without writing dotenv output to stdout", () => {
    tempDir = mkdtempSync(join(tmpdir(), "harness-env-"));
    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, `${envKey}=loaded\n`);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    loadEnvFile(envPath);

    expect(process.env[envKey]).toBe("loaded");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("loads default .env without writing dotenv output to stdout", () => {
    tempDir = mkdtempSync(join(tmpdir(), "harness-env-"));
    writeFileSync(join(tempDir, ".env"), `${envKey}=loaded-default\n`);
    chdir(tempDir);
    const stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    loadEnvFile();

    expect(process.env[envKey]).toBe("loaded-default");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
