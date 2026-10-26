/**
 * Minimal semver helpers for lockfile pin regression tests (no external deps).
 */

export function parseSemverTriple(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function meetsVersionFloor(version: string, floor: string): boolean {
  const v = parseSemverTriple(version);
  const f = parseSemverTriple(floor);
  if (!v || !f) return false;
  if (v[0] !== f[0]) return v[0] > f[0];
  if (v[1] !== f[1]) return v[1] > f[1];
  return v[2] >= f[2];
}

/** Collect `name@x.y.z` entries from the pnpm lockfile packages section. */
export function parsePnpmLockPackageVersions(lockText: string, packageName: string): string[] {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^  (?:/)?${escaped}@(\\d+\\.\\d+\\.\\d+)`, "gm");
  const versions: string[] = [];
  for (const match of lockText.matchAll(re)) {
    versions.push(match[1]!);
  }
  return versions;
}

/** Collect installed versions for packageName from npm-shrinkwrap packages entries. */
export function parseNpmShrinkwrapPackageVersions(
  shrinkwrapText: string,
  packageName: string,
): string[] {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  const suffix = `node_modules/${packageName}`;
  const versions: string[] = [];
  for (const [path, metadata] of Object.entries(shrinkwrap.packages ?? {})) {
    if (!path.endsWith(suffix)) continue;
    const version = metadata?.version;
    if (typeof version === "string" && version.length > 0) {
      versions.push(version);
    }
  }
  return versions;
}
