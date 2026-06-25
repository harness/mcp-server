import { describe, it, expect } from "vitest";
import { compareSchemaCoverage } from "../../scripts/check-schema-coverage-lib.js";

describe("compareSchemaCoverage", () => {
  it("flags upstream schemas that are neither synced nor excluded", () => {
    const result = compareSchemaCoverage(
      new Set(["pipeline"]),
      new Set(),
      ["pipeline", "newKind"],
    );

    expect(result.missing).toEqual(["newKind"]);
    expect(result.stale).toEqual([]);
  });

  it("does not flag upstream schemas covered by the exclusion list", () => {
    const result = compareSchemaCoverage(
      new Set(["pipeline"]),
      new Set(["experimental"]),
      ["pipeline", "experimental"],
    );

    expect(result.missing).toEqual([]);
    expect(result.stale).toEqual([]);
  });

  it("warns when a synced schema was removed upstream", () => {
    const result = compareSchemaCoverage(
      new Set(["pipeline", "template", "inputSet", "overlayInputSet", "trigger", "service", "infra"]),
      new Set(),
      ["pipeline", "template", "inputSet", "overlayInputSet"],
    );

    expect(result.missing).toEqual([]);
    expect(result.stale.sort()).toEqual(["infra", "service", "trigger"]);
  });
});
