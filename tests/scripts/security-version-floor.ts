/**
 * Shared semver floor helpers for security pin regression tests.
 */

/** Parse >=x.y.z override strings used in package.json pnpm.overrides. */
export function parseMinimumOverride(override: string): string {
  const caret = /^\^([0-9]+(?:\.[0-9]+){0,2}(?:\.[0-9]+)?)/.exec(override);
  if (caret) {
    return caret[1]!;
  }
  const match = /^>=([0-9]+(?:\.[0-9]+){0,2}(?:\.[0-9]+)?)/.exec(override);
  if (!match) {
    throw new Error(`expected >= or ^ semver floor, got: ${override}`);
  }
  return match[1]!;
}

export function meetsMinimum(version: string, floor: string): boolean {
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

export function pnpmLockResolvedVersions(lockContent: string, packageName: string): string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^  ${escaped}@([^:\\n]+):`, "gm");
  const versions = new Set<string>();
  for (const match of lockContent.matchAll(re)) {
    const raw = match[1]!;
    versions.add(raw.replace(/\(.*/, ""));
  }
  return [...versions];
}

export function shrinkwrapRootVersion(
  shrinkwrap: { packages?: Record<string, { version?: string }> },
  packageName: string,
): string | undefined {
  return shrinkwrap.packages?.[`node_modules/${packageName}`]?.version;
}
