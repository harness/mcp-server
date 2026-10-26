import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parseNpmShrinkwrapPackageVersion,
  parsePnpmLockPackageVersions,
} from "./security-version-floor.js";

const root = process.cwd();
const EXPRESS_RATE_LIMIT_FLOOR = "8.2.2";

describe("express-rate-limit security pins (transitive ip-address consumer)", () => {
  it("keeps pnpm override at the patched floor", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(packageJson.pnpm?.overrides?.["express-rate-limit"]).toBe(`>=${EXPRESS_RATE_LIMIT_FLOOR}`);
  });

  it("resolves express-rate-limit at or above the floor in pnpm-lock.yaml", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lock, "express-rate-limit");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(meetsVersionFloor(version, EXPRESS_RATE_LIMIT_FLOOR), `express-rate-limit@${version}`).toBe(
        true,
      );
    }
  });

  it("pins express-rate-limit in npm-shrinkwrap for MCPB / npm consumers", () => {
    const shrinkwrap = readFileSync(join(root, "npm-shrinkwrap.json"), "utf8");
    const version = parseNpmShrinkwrapPackageVersion(shrinkwrap, "express-rate-limit");
    expect(version).not.toBeNull();
    expect(meetsVersionFloor(version!, EXPRESS_RATE_LIMIT_FLOOR)).toBe(true);
  });
});
