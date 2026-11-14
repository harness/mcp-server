/**
 * reviewCard declarations: optional, pure data, paths must exist in the
 * resource's create/update bodySchema, labels unique.
 */
import { describe, it, expect } from "vitest";
import { ccmToolset } from "../../src/registry/toolsets/ccm.js";

const withCard = ccmToolset.resources.filter((r) => r.reviewCard);

describe("reviewCard declarations", () => {
  it("declares cards for cost_perspective and cost_category", () => {
    expect(withCard.map((r) => r.resourceType).sort()).toEqual(["cost_category", "cost_perspective"]);
  });

  for (const def of withCard) {
    describe(def.resourceType, () => {
      const card = def.reviewCard!;

      it("is version 1 with unique labels and is JSON-serializable", () => {
        expect(card.version).toBe(1);
        const labels = card.fields.map((f) => f.label);
        expect(new Set(labels).size).toBe(labels.length);
        expect(JSON.parse(JSON.stringify(card))).toEqual(card);
      });

      it("every path's top-level key exists in the create and update bodySchema", () => {
        for (const op of ["create", "update"] as const) {
          const names = (def.operations[op]?.bodySchema?.fields ?? []).map((f) => f.name);
          for (const field of card.fields) {
            expect(names, `${def.resourceType}.${op} missing ${field.path}`).toContain(field.path.split(".")[0]);
          }
        }
      });
    });
  }

  it("resources without reviewCard are untouched", () => {
    const other = ccmToolset.resources.find((r) => !r.reviewCard);
    expect(other?.reviewCard).toBeUndefined();
  });
});
