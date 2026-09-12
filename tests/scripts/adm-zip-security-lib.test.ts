import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureSecureAdmZip,
  findAdmZipInstallDirs,
  findOnnxRuntimeNodeDirs,
  isSecureAdmZipVersion,
  listInsecureAdmZipInstalls,
  SECURE_ADM_ZIP_VERSION,
} from "../../scripts/adm-zip-security-lib.mjs";

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
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(listInsecureAdmZipInstalls(root)).toHaveLength(1);
  });
});
