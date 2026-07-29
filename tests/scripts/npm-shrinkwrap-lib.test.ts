import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildStagingManifest,
  buildTransitiveOverrides,
  sortedEntries,
  validateShrinkwrapMetadata,
} from "../../scripts/npm-shrinkwrap-lib.mjs";

const repoPkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

function validShrinkwrap(pkg = repoPkg) {
  return {
    packages: {
      "": {
        name: pkg.name,
        version: pkg.version,
        dependencies: pkg.dependencies,
        optionalDependencies: pkg.optionalDependencies,
      },
      "node_modules/adm-zip": { version: "0.6.0" },
    },
  };
}

describe("npm-shrinkwrap-lib", () => {
  describe("sortedEntries", () => {
    it("sorts dependency keys alphabetically for stable comparison", () => {
      expect(sortedEntries({ zod: "^4", "adm-zip": "^0.6", hono: "^4" })).toEqual([
        ["adm-zip", "^0.6"],
        ["hono", "^4"],
        ["zod", "^4"],
      ]);
    });
  });

  describe("buildTransitiveOverrides", () => {
    it("drops direct dependencies to avoid npm EOVERRIDE conflicts", () => {
      const overrides = buildTransitiveOverrides(repoPkg);

      expect(overrides).not.toHaveProperty("hono");
      expect(overrides).not.toHaveProperty("@hono/node-server");
      expect(overrides).not.toHaveProperty("adm-zip");
      expect(overrides).not.toHaveProperty("@huggingface/transformers");
    });

    it("keeps transitive security pins from pnpm.overrides", () => {
      const overrides = buildTransitiveOverrides(repoPkg);

      expect(overrides.sharp).toBe(">=0.35.0");
      expect(overrides.esbuild).toBe(">=0.28.1");
      expect(overrides.protobufjs).toBe(">=8.6.0");
      expect(overrides["fast-uri"]).toBe(">=3.1.4");
    });
  });

  describe("buildStagingManifest", () => {
    it("mirrors root metadata and transitive overrides for npm install staging", () => {
      const manifest = buildStagingManifest(repoPkg);

      expect(manifest).toEqual({
        name: repoPkg.name,
        version: repoPkg.version,
        private: true,
        dependencies: repoPkg.dependencies,
        optionalDependencies: repoPkg.optionalDependencies,
        overrides: buildTransitiveOverrides(repoPkg),
      });
    });
  });

  describe("validateShrinkwrapMetadata", () => {
    it("accepts shrinkwrap metadata that matches package.json and secure adm-zip", () => {
      expect(validateShrinkwrapMetadata(repoPkg, validShrinkwrap())).toBeNull();
    });

    it("rejects missing root package metadata", () => {
      expect(validateShrinkwrapMetadata(repoPkg, { packages: {} })).toBe(
        "root package metadata is missing",
      );
    });

    it("rejects name or version drift from package.json", () => {
      const shrinkwrap = validShrinkwrap();
      shrinkwrap.packages[""].version = "0.0.0";

      expect(validateShrinkwrapMetadata(repoPkg, shrinkwrap)).toBe(
        `root metadata does not match ${repoPkg.name}@${repoPkg.version}`,
      );
    });

    it("rejects dependency drift from package.json", () => {
      const shrinkwrap = validShrinkwrap();
      shrinkwrap.packages[""].dependencies = { hono: "^0.0.0" };

      expect(validateShrinkwrapMetadata(repoPkg, shrinkwrap)).toBe(
        "root dependencies do not match package.json",
      );
    });

    it("rejects optionalDependency drift from package.json", () => {
      const shrinkwrap = validShrinkwrap();
      shrinkwrap.packages[""].optionalDependencies = {};

      expect(validateShrinkwrapMetadata(repoPkg, shrinkwrap)).toBe(
        "root optionalDependencies do not match package.json",
      );
    });

    it("rejects missing hoisted adm-zip entry", () => {
      const shrinkwrap = validShrinkwrap();
      delete shrinkwrap.packages["node_modules/adm-zip"];

      expect(validateShrinkwrapMetadata(repoPkg, shrinkwrap)).toBe("hoisted adm-zip is missing");
    });

    it("rejects insecure hoisted adm-zip versions", () => {
      const shrinkwrap = validShrinkwrap();
      shrinkwrap.packages["node_modules/adm-zip"] = { version: "0.5.18" };

      expect(validateShrinkwrapMetadata(repoPkg, shrinkwrap)).toBe("hoisted adm-zip is 0.5.18");
    });
  });
});
