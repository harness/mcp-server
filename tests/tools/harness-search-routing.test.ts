import { describe, it, expect } from "vitest";
import {
  SEMANTIC_ROUTING_SAFETY_FLOOR,
  extractRoutingTypes,
  applyRoutingSafetyFloor,
} from "../../src/tools/harness-search.js";
import type { SearchResult } from "../../src/search/types.js";

function makeSemanticHit(resourceType: string, score: number): SearchResult {
  return {
    id: `resource-def:${resourceType}`,
    content: resourceType,
    score,
    corpus: "mcp_resources",
    metadata: { resource_type: resourceType },
  };
}

describe("harness_search semantic routing", () => {
  const candidateTypes = [
    "pipeline",
    "service",
    "environment",
    "connector",
    "secret",
    "template",
    "trigger",
  ];

  it("extracts high-confidence resource types from semantic hits", () => {
    const predicted = extractRoutingTypes(
      [makeSemanticHit("secret", 0.8)],
      candidateTypes,
    );
    expect(predicted).toEqual(["secret"]);
  });

  it("ignores semantic hits below the routing threshold", () => {
    const predicted = extractRoutingTypes(
      [makeSemanticHit("secret", 0.4)],
      candidateTypes,
    );
    expect(predicted).toBeNull();
  });

  it("always includes tier-1 safety floor types in the routed set", () => {
    const predicted = ["secret"];
    const routed = applyRoutingSafetyFloor(predicted, candidateTypes);
    for (const rt of SEMANTIC_ROUTING_SAFETY_FLOOR) {
      expect(routed).toContain(rt);
    }
    expect(routed).toContain("secret");
  });

  it("only adds safety floor types that are in the candidate set", () => {
    const routed = applyRoutingSafetyFloor(["secret"], ["secret", "pipeline"]);
    expect(routed).toEqual(expect.arrayContaining(["secret", "pipeline"]));
    expect(routed).not.toContain("service");
  });
});
