import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensureSecureAdmZip,
  findAdmZipInstallDirs,
  findOnnxRuntimeNodeDirs,
  isSecureAdmZipVersion,
  listInsecureAdmZipInstalls,
  readAdmZipVersion,
  SECURE_ADM_ZIP_VERSION,
  validateNpmShrinkwrapMetadata,
} from "../../scripts/adm-zip-security-lib.mjs";

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
    expect(isSecureAdmZipVersion("0.6.0", SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(isSecureAdmZipVersion("0.6.1", SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(isSecureAdmZipVersion("0.7.0", SECURE_ADM_ZIP_VERSION)).toBe(true);
    expect(isSecureAdmZipVersion("0.5.18", SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("0.6.0-beta.1", SECURE_ADM_ZIP_VERSION)).toBe(true);
  });

  it("treats missing or invalid versions as insecure", () => {
    expect(isSecureAdmZipVersion(null, SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("", SECURE_ADM_ZIP_VERSION)).toBe(false);
    expect(isSecureAdmZipVersion("not-a-version", SECURE_ADM_ZIP_VERSION)).toBe(false);
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

  it("readAdmZipVersion returns version from package.json", () => {
    const root = mkdtempSync(join(tmpdir(), "adm-zip-lib-"));
    tempDirs.push(root);
    const admZipDir = join(root, "node_modules", "adm-zip");
    writeAdmZip(admZipDir, "0.6.0");

    expect(readAdmZipVersion(admZipDir)).toBe("0.6.0");
    expect(readAdmZipVersion(join(root, "missing"))).toBeNull();
  });
});

describe("validateNpmShrinkwrapMetadata", () => {
  const basePkg = {
    name: "harness-mcp-v2",
    version: "3.2.13",
    dependencies: { "adm-zip": "^0.6.0", zod: "^4.0.0" },
    optionalDependencies: { "@huggingface/transformers": "^4.2.0" },
  };

  function makeShrinkwrap(overrides: Record<string, unknown> = {}) {
    return {
      packages: {
        "": {
          name: basePkg.name,
          version: basePkg.version,
          dependencies: basePkg.dependencies,
          optionalDependencies: basePkg.optionalDependencies,
        },
        "node_modules/adm-zip": { version: "0.6.0" },
        ...overrides,
      },
    };
  }

  it("accepts shrinkwrap that matches package.json with secure adm-zip", () => {
    expect(validateNpmShrinkwrapMetadata(makeShrinkwrap(), basePkg)).toBeNull();
  });

  it("rejects missing root package metadata", () => {
    expect(
      validateNpmShrinkwrapMetadata({ packages: {} }, basePkg),
    ).toBe("root package metadata is missing");
  });

  it("rejects version mismatch", () => {
    const shrinkwrap = makeShrinkwrap();
    (shrinkwrap.packages[""] as { version: string }).version = "0.0.0";
    expect(validateNpmShrinkwrapMetadata(shrinkwrap, basePkg)).toMatch(/root metadata does not match/);
  });

  it("rejects dependency drift from package.json", () => {
    const shrinkwrap = makeShrinkwrap();
    (shrinkwrap.packages[""] as { dependencies: Record<string, string> }).dependencies = {
      zod: "^4.0.0",
    };
    expect(validateNpmShrinkwrapMetadata(shrinkwrap, basePkg)).toBe(
      "root dependencies do not match package.json",
    );
  });

  it("rejects insecure hoisted adm-zip", () => {
    const shrinkwrap = makeShrinkwrap({
      "node_modules/adm-zip": { version: "0.5.18" },
    });
    expect(validateNpmShrinkwrapMetadata(shrinkwrap, basePkg)).toBe(
      "hoisted adm-zip is 0.5.18",
    );
  });

  it("rejects missing hoisted adm-zip", () => {
    const shrinkwrap = makeShrinkwrap();
    delete (shrinkwrap.packages as Record<string, unknown>)["node_modules/adm-zip"];
    expect(validateNpmShrinkwrapMetadata(shrinkwrap, basePkg)).toBe(
      "hoisted adm-zip is missing",
    );
  });
});
