import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assetNameForVersion,
  bundlePackageJson,
  normalizeBundleManifest,
} from "../scripts/prepare-mcpb.js";

const root = process.cwd();

function readDirectoryManifest() {
  return JSON.parse(readFileSync(join(root, "mcp-directory/manifest.json"), "utf8"));
}

describe("prepare-mcpb helpers", () => {
  describe("assetNameForVersion", () => {
    it("names versioned MCPB assets for stable and prerelease versions", () => {
      expect(assetNameForVersion("3.2.20")).toBe("harness-mcp-server-3.2.20.mcpb");
      expect(assetNameForVersion("3.2.20-beta.1")).toBe("harness-mcp-server-3.2.20-beta.1.mcpb");
    });

    it("rejects invalid release versions before packaging", () => {
      expect(() => assetNameForVersion("v3.2.20")).toThrow(/Invalid MCPB version/);
      expect(() => assetNameForVersion("latest")).toThrow(/Invalid MCPB version/);
      expect(() => assetNameForVersion("")).toThrow(/Invalid MCPB version/);
    });
  });

  describe("normalizeBundleManifest", () => {
    it("rejects manifest/package version drift", () => {
      const manifest = readDirectoryManifest();
      expect(() => normalizeBundleManifest(manifest, "9.9.9")).toThrow(
        /does not match package version/,
      );
    });

    it("rewrites only legacy build entry points and leaves other args intact", () => {
      const manifest = readDirectoryManifest();
      manifest.server.entry_point = "build/index.js";
      manifest.server.mcp_config.args = [
        "${__dirname}/build/index.js",
        "--verbose",
        "stdio",
      ];

      expect(normalizeBundleManifest(manifest, manifest.version).server).toMatchObject({
        entry_point: "server/index.js",
        mcp_config: {
          args: ["${__dirname}/server/index.js", "--verbose", "stdio"],
        },
      });
    });

    it("is idempotent for manifests already using server/index.js", () => {
      const manifest = readDirectoryManifest();
      const normalized = normalizeBundleManifest(manifest, manifest.version);

      expect(normalized.server.entry_point).toBe("server/index.js");
      expect(normalized.server.mcp_config.args).toEqual([
        "${__dirname}/server/index.js",
        "stdio",
      ]);
    });
  });

  describe("bundlePackageJson", () => {
    it("mirrors only transitive pnpm overrides needed for npm ci", () => {
      const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
      const bundled = bundlePackageJson(packageJson);

      expect(bundled.overrides.sharp).toBe(packageJson.pnpm.overrides.sharp);
      expect(bundled.overrides).not.toHaveProperty("hono");
    });

    it("handles minimal runtime manifests without optionalDependencies or pnpm overrides", () => {
      const bundled = bundlePackageJson({
        name: "example",
        version: "1.0.0",
        type: "module",
        license: "MIT",
        dependencies: { express: "^5.0.0" },
      });

      expect(bundled).toMatchObject({
        name: "example",
        version: "1.0.0",
        private: true,
        dependencies: { express: "^5.0.0" },
      });
      expect(bundled).not.toHaveProperty("devDependencies");
      expect(bundled).not.toHaveProperty("scripts");
      expect(bundled.overrides).toEqual({});
    });

    it("drops direct-dependency overrides that npm would ignore anyway", () => {
      const bundled = bundlePackageJson({
        name: "example",
        version: "1.0.0",
        dependencies: { hono: "^4.0.0" },
        pnpm: { overrides: { hono: "4.12.25", sharp: "0.34.5" } },
      });

      expect(bundled.overrides).toEqual({ sharp: "0.34.5" });
    });
  });
});
