import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./security-version-floor.js";

const root = process.cwd();
const FAST_URI_FLOOR = "4.2.3";

describe("fast-uri security pins (transitive MCP SDK dependency)", () => {
  it("keeps pnpm override at the patched floor", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.pnpm?.overrides?.["fast-uri"]).toBe(`>=${FAST_URI_FLOOR}`);
  });

  it("resolves fast-uri at or above the floor in pnpm-lock.yaml", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lock, "fast-uri");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(meetsVersionFloor(version, FAST_URI_FLOOR), `fast-uri@${version}`).toBe(true);
    }
  });

  it("pins fast-uri in npm-shrinkwrap for MCPB / npm consumers", () => {
    const shrinkwrap = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrap, "fast-uri");
    expect(version).not.toBeNull();
    expect(meetsVersionFloor(version!, FAST_URI_FLOOR)).toBe(true);
  });
});
