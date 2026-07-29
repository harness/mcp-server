import { describe, expect, it } from "vitest";
import { computeTransitiveOverrides } from "../../scripts/npm-shrinkwrap-lib.mjs";

describe("npm-shrinkwrap-lib", () => {
  it("drops direct dependencies from pnpm overrides to avoid npm EOVERRIDE", () => {
    const overrides = computeTransitiveOverrides(
      {
        "adm-zip": ">=0.6.0",
        sharp: ">=0.35.0",
        "fast-uri": ">=3.1.4",
        hono: ">=4.12.27",
      },
      { "adm-zip": "^0.6.0" },
      { sharp: "^0.35.0" },
    );

    expect(overrides).toEqual({
      "fast-uri": ">=3.1.4",
      hono: ">=4.12.27",
    });
    expect(overrides).not.toHaveProperty("adm-zip");
    expect(overrides).not.toHaveProperty("sharp");
  });

  it("returns all overrides when no direct deps overlap", () => {
    const overrides = computeTransitiveOverrides(
      { postcss: ">=8.5.18", "body-parser": ">=2.3.0" },
      { express: "^5.0.0" },
      {},
    );

    expect(overrides).toEqual({
      postcss: ">=8.5.18",
      "body-parser": ">=2.3.0",
    });
  });

  it("returns an empty object when overrides are missing", () => {
    expect(computeTransitiveOverrides()).toEqual({});
    expect(computeTransitiveOverrides(undefined, {}, {})).toEqual({});
  });
});
