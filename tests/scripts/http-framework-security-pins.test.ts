/**
 * Regression guards for HTTP stack dependency floors (Hono, Vite) from #1144.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../..");

const MIN_HONO_VERSION = "4.13.11";
const MIN_HONO_NODE_SERVER_VERSION = "2.0.10";
const MIN_VITE_VERSION = "7.3.7";

function parseMinimumOverride(override: string): string {
  const match = /^>=([0-9]+(?:\.[0-9]+){0,2}(?:\.[0-9]+)?)/.exec(override);
  if (!match) {
    throw new Error(`expected >= semver floor, got: ${override}`);
  }
  return match[1]!;
}

function parseCaretMinimum(range: string): string {
  const match = /^\^([0-9]+(?:\.[0-9]+){0,2}(?:\.[0-9]+)?)/.exec(range);
  if (!match) {
    throw new Error(`expected ^ semver range, got: ${range}`);
  }
  return match[1]!;
}

function meetsMinimum(version: string, floor: string): boolean {
  const parse = (value: string) =>
    value
      .split(".")
      .slice(0, 3)
      .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10));

  const parts = parse(version);
  const floorParts = parse(floor);
  for (let index = 0; index < 3; index += 1) {
    const current = parts[index] ?? 0;
    const minimum = floorParts[index] ?? 0;
    if (current > minimum) {
      return true;
    }
    if (current < minimum) {
      return false;
    }
  }
  return true;
}

describe("HTTP framework security pin floors — package.json", () => {
  const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    pnpm: { overrides: Record<string, string> };
  };

  const overrides = packageJson.pnpm.overrides;

  it("keeps hono override and direct dependency on patched releases", () => {
    const overrideFloor = parseMinimumOverride(overrides.hono);
    expect(meetsMinimum(overrideFloor, MIN_HONO_VERSION)).toBe(true);
    expect(meetsMinimum("4.13.11", overrideFloor)).toBe(true);
    expect(meetsMinimum("4.13.10", overrideFloor)).toBe(false);

    const directFloor = parseCaretMinimum(packageJson.dependencies.hono);
    expect(meetsMinimum(directFloor, MIN_HONO_VERSION)).toBe(true);
    expect(meetsMinimum("4.13.11", directFloor)).toBe(true);
    expect(meetsMinimum("4.13.10", directFloor)).toBe(false);
  });

  it("keeps @hono/node-server override and direct dependency on patched releases", () => {
    const overrideFloor = parseMinimumOverride(overrides["@hono/node-server"]);
    expect(meetsMinimum(overrideFloor, MIN_HONO_NODE_SERVER_VERSION)).toBe(true);
    expect(meetsMinimum("2.0.10", overrideFloor)).toBe(true);
    expect(meetsMinimum("2.0.9", overrideFloor)).toBe(false);

    const directFloor = parseCaretMinimum(packageJson.dependencies["@hono/node-server"]);
    expect(meetsMinimum(directFloor, MIN_HONO_NODE_SERVER_VERSION)).toBe(true);
    expect(meetsMinimum("2.0.10", directFloor)).toBe(true);
    expect(meetsMinimum("2.0.9", directFloor)).toBe(false);
  });

  it("keeps vite override and devDependency on patched releases", () => {
    const overrideFloor = parseCaretMinimum(overrides.vite);
    expect(meetsMinimum(overrideFloor, MIN_VITE_VERSION)).toBe(true);
    expect(meetsMinimum("7.3.7", overrideFloor)).toBe(true);
    expect(meetsMinimum("7.3.6", overrideFloor)).toBe(false);

    const devFloor = parseCaretMinimum(packageJson.devDependencies.vite);
    expect(meetsMinimum(devFloor, MIN_VITE_VERSION)).toBe(true);
    expect(meetsMinimum("7.3.7", devFloor)).toBe(true);
    expect(meetsMinimum("7.3.6", devFloor)).toBe(false);
  });
});
