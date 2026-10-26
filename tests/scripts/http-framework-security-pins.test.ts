import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  meetsVersionFloor,
  parsePnpmLockPackageVersions,
} from "./security-version-floor.js";

const root = process.cwd();

const HONO_FLOOR = "4.13.11";
const HONO_NODE_SERVER_FLOOR = "2.0.10";
const VITE_FLOOR = "7.3.7";

describe("HTTP framework security pins — hono and vite (#1144)", () => {
  it("keeps pnpm overrides for hono, @hono/node-server, and vite", () => {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const overrides = packageJson.pnpm?.overrides ?? {};
    expect(overrides.hono).toBe(`>=${HONO_FLOOR}`);
    expect(overrides["@hono/node-server"]).toBe(`>=${HONO_NODE_SERVER_FLOOR}`);
    expect(overrides.vite).toBe("^7.3.7");
  });

  it("resolves hono and @hono/node-server at patched versions in pnpm-lock.yaml", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    for (const version of parsePnpmLockPackageVersions(lock, "hono")) {
      expect(meetsVersionFloor(version, HONO_FLOOR), `hono@${version}`).toBe(true);
    }
    for (const version of parsePnpmLockPackageVersions(lock, "@hono/node-server")) {
      expect(meetsVersionFloor(version, HONO_NODE_SERVER_FLOOR), `@hono/node-server@${version}`).toBe(
        true,
      );
    }
  });

  it("resolves vite at or above 7.3.7 for vitest dev tooling", () => {
    const lock = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");
    const versions = parsePnpmLockPackageVersions(lock, "vite");
    expect(versions.length).toBeGreaterThan(0);
    for (const version of versions) {
      expect(meetsVersionFloor(version, VITE_FLOOR), `vite@${version}`).toBe(true);
    }
  });
});
