import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADM_ZIP_ADVISORIES,
  ensureSecureAdmZip,
  findAdmZipInstallDirs,
  findOnnxRuntimeNodeDirs,
  isSecureAdmZipVersion,
  listInsecureAdmZipInstalls,
  readAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

const repoRoot = process.cwd();

function parsePnpmLockAdmZipVersions(lockfileText: string): string[] {
  const versions = new Set<string>();
  for (const match of lockfileText.matchAll(/^\s+adm-zip@([0-9]+\.[0-9]+\.[0-9]+):/gm)) {
    versions.add(match[1]);
  }
  return [...versions];
}

function listNpmShrinkwrapAdmZipVersions(shrinkwrapText: string): Array<{ path: string; version: string | null }> {
  const shrinkwrap = JSON.parse(shrinkwrapText) as {
    packages?: Record<string, { version?: string }>;
  };
  return Object.entries(shrinkwrap.packages ?? {})
    .filter(([path]) => path.endsWith("node_modules/adm-zip"))
    .map(([path, metadata]) => ({
      path,
      version: typeof metadata?.version === "string" ? metadata.version : null,
    }));
}

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip") as new () => {
  addFile(name: string, content: Buffer): void;
  extractAllTo(target: string, overwrite?: boolean): void;
};

function writePackage(root: string, name: string, version = "1.0.0") {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "package.json"), JSON.stringify({ name, version }));
}

function writeAdmZip(root: string, version: string) {
  writePackage(root, "adm-zip", version);
}

describe("adm-zip-security-lib", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("compares semver patch levels", () => {
    expect(isSecureAdmZipVersion("0.6.0", SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("0.6.1", SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(isSecureAdmZipVersion("0.7.0", SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(isSecureAdmZipVersion("0.5.18", SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("0.6.0-beta.1", SECURE_ADM_ZIP_VERSION)).toBe(false);
  });

  it("ignores pre-release suffixes when comparing CVE pin floors", () => {
    expect(isSecureAdmZipVersion("0.6.0-rc.1", SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("0.6.1-beta.0", SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(isSecureAdmZipVersion("0.6.1+build", SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("keeps pnpm overrides, npm parent override, and lockfiles on patched adm-zip", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      overrides: { "onnxruntime-node": { "adm-zip": string } };
      pnpm: { overrides: Record<string, string> };
      dependencies: Record<string, string>;
    };

    expect(packageJson.pnpm.overrides["adm-zip"]).toBe(`>=${SECURE_ADM_ZIP_VERSION}`);
    expect(packageJson.overrides["onnxruntime-node"]["adm-zip"]).toBe(SECURE_ADM_ZIP_VERSION);
    expect(isSecureAdmZipVersion(packageJson.dependencies["adm-zip"].replace(/^\^/, ""))).toBe(true);

    const lockVersions = parsePnpmLockAdmZipVersions(readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8"));
    expect(lockVersions.length).toBeGreaterThan(0);
    for (const version of lockVersions) {
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION)).toBe(true);
    }

    const shrinkwrapInstalls = listNpmShrinkwrapAdmZipVersions(
      readFileSync(join(repoRoot, "npm-shrinkwrap.json"), "utf8"),
    );
    expect(shrinkwrapInstalls.length).toBeGreaterThan(0);
    for (const { path, version } of shrinkwrapInstalls) {
      expect(version, `${path} missing version in npm-shrinkwrap.json`).not.toBeNull();
      expect(isSecureAdmZipVersion(version, SECURE_ADM_ZIP_VERSION), `${path}@${version}`).toBe(true);
    }
  });

  it("ships postinstall fallback scripts in the published npm package manifest", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      files: string[];
      scripts: { postinstall?: string };
    };

    expect(packageJson.scripts.postinstall).toBe("node scripts/ensure-secure-adm-zip.mjs");
    expect(packageJson.files).toEqual(
      expect.arrayContaining([
        "scripts/adm-zip-security-lib.mjs",
        "scripts/ensure-secure-adm-zip.mjs",
      ]),
    );
  });

  it("readAdmZipVersion returns null for missing or invalid package metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-read-"));
    tempDirs.push(root);
    const admZipDir = join(root, "node_modules", "adm-zip");

    expect(readAdmZipVersion(admZipDir)).toBeNull();

    mkdirSync(admZipDir, { recursive: true });
    writeFileSync(join(admZipDir, "package.json"), JSON.stringify({ name: "adm-zip" }));
    expect(readAdmZipVersion(admZipDir)).toBeNull();

    writeFileSync(join(admZipDir, "package.json"), JSON.stringify({ name: "adm-zip", version: "" }));
    expect(readAdmZipVersion(admZipDir)).toBeNull();

    writeAdmZip(admZipDir, SECURE_ADM_ZIP_VERSION);
    expect(readAdmZipVersion(admZipDir)).toBe(SECURE_ADM_ZIP_VERSION);
  });

  it("flags no insecure adm-zip installs in the workspace node_modules tree", () => {
    expect(listInsecureAdmZipInstalls(repoRoot)).toEqual([]);
  });

  it("treats missing or invalid versions as insecure", () => {
    expect(isSecureAdmZipVersion(null, SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("", SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("not-a-version", SECURE_ADM_ZIP_VERSION)).toBe(false);
  });

  it("blocks extraction through a destination symlink", () => {
    if (process.platform === "win32") {
      return;
    }

    const root = mkdtempSync(join(tmpdir(), "adm-zip-symlink-"));
    tempDirs.push(root);
    const extractRoot = join(root, "extract");
    const outsideRoot = join(root, "outside");
    mkdirSync(extractRoot);
    mkdirSync(outsideRoot);
    symlinkSync(outsideRoot, join(extractRoot, "link"), "dir");

    const zip = new AdmZip();
    zip.addFile("link/payload.txt", Buffer.from("attacker content"));

    expect(() => zip.extractAllTo(extractRoot, true)).toThrow();
    expect(existsSync(join(outsideRoot, "payload.txt"))).toBe(false);
  });

  it("finds nested adm-zip installs", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), "0.5.18");
    writePackage(join(root, "node_modules", "onnxruntime-node"));
    writeAdmZip(
      join(root, "node_modules", "onnxruntime-node", "node_modules", "adm-zip"),
      "0.5.18",
    );

    const dirs = findAdmZipInstallDirs(root);
    expect(dirs).toHaveLength(2);
    expect(findOnnxRuntimeNodeDirs(root)).toHaveLength(1);
    expect(listInsecureAdmZipInstalls(root)).toHaveLength(2);
  });

  it("flags missing package.json versions as insecure", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    const admZipDir = join(root, "node_modules", "adm-zip");
    mkdirSync(admZipDir, { recursive: true });
    writeFileSync(join(admZipDir, "package.json"), JSON.stringify({ name: "adm-zip" }));

    expect(listInsecureAdmZipInstalls(root)).toHaveLength(1);
  });

  it("dry-run reports prefixes without mutating node_modules", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), "0.5.18");

    const result = ensureSecureAdmZip(root, { dryRun: true });
    expect(result.skipped).toBe(false);
    expect(result.patched).toEqual([root]);
    expect(result.warnings).toEqual([]);
    expect(listInsecureAdmZipInstalls(root)).toHaveLength(1);
  });

  it("returns warnings instead of throwing when strict is false", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), "0.5.18");

    const result = ensureSecureAdmZip(root, {
      npmCommand: "__missing-npm-binary__",
      strict: false,
    });
    expect(result.warnings.some((message) => message.includes("failed to upgrade adm-zip"))).toBe(true);
    expect(listInsecureAdmZipInstalls(root)).toHaveLength(1);
  });

  it("surfaces advisory ids when insecure copies remain after a failed patch", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), "0.5.18");

    const result = ensureSecureAdmZip(root, {
      npmCommand: "__missing-npm-binary__",
      strict: false,
      dryRun: false,
    });

    expect(result.warnings.some((message) => message.includes(ADM_ZIP_ADVISORIES))).toBe(true);
  });

  it("no-ops when every adm-zip install is already at the secure floor", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), SECURE_ADM_ZIP_VERSION);

    const result = ensureSecureAdmZip(root, { dryRun: true });
    expect(result).toEqual({ patched: [], skipped: true, warnings: [] });
  });

  it("throws in strict mode when npm upgrade cannot run", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), "0.5.18");

    expect(() =>
      ensureSecureAdmZip(root, {
        npmCommand: "__missing-npm-binary__",
        strict: true,
      }),
    ).toThrow(/failed to upgrade adm-zip/);
  });

  it("dry-run schedules nested onnxruntime-node adm-zip prefixes separately", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    writeAdmZip(join(root, "node_modules", "adm-zip"), "0.5.18");
    const ortDir = join(root, "node_modules", "onnxruntime-node");
    writePackage(ortDir, "onnxruntime-node");
    writeAdmZip(join(ortDir, "node_modules", "adm-zip"), "0.5.18");

    const result = ensureSecureAdmZip(root, { dryRun: true });
    expect(result.skipped).toBe(false);
    expect(result.patched.sort()).toEqual([root, ortDir].sort());
  });
});
