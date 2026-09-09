import { describe, it, expect } from "vitest";
import { projectRelatedActivity } from "../../src/registry/toolsets/related-activities.js";

describe("projectRelatedActivity", () => {
  it("maps templateTypeName to a followable resource_type", () => {
    expect(projectRelatedActivity({
      prettyId: "INC-42",
      templateTypeName: "INCIDENT",
      name: "causes",
      title: "Checkout outage",
      globalId: "uuid-should-be-dropped",
    })).toEqual({
      prettyId: "INC-42",
      resource_type: "incident",
      name: "causes",
      title: "Checkout outage",
    });
  });

  it.each([
    ["ALERT", "alert"],
    ["DEPLOY", "deploy"],
  ])("maps %s to resource_type=%s", (templateTypeName, resourceType) => {
    expect(projectRelatedActivity({
      prettyId: "X-1",
      templateTypeName,
      name: "is correlated with",
    })).toEqual({
      prettyId: "X-1",
      resource_type: resourceType,
      name: "is correlated with",
    });
  });

  it("omits resource_type for CHANGE (no registered resource type)", () => {
    expect(projectRelatedActivity({
      prettyId: "CHG-9",
      templateTypeName: "CHANGE",
      name: "relates to",
      title: "Config change",
    })).toEqual({
      prettyId: "CHG-9",
      name: "relates to",
      title: "Config change",
    });
  });

  it("omits resource_type when templateTypeName is null or unknown", () => {
    expect(projectRelatedActivity({
      prettyId: "UNK-1",
      templateTypeName: null,
      name: "relates to",
    })).toEqual({
      prettyId: "UNK-1",
      name: "relates to",
    });

    expect(projectRelatedActivity({
      prettyId: "UNK-2",
      templateTypeName: "PIPELINE",
      name: "relates to",
    })).toEqual({
      prettyId: "UNK-2",
      name: "relates to",
    });
  });

  it("omits empty titles but keeps non-empty titles", () => {
    expect(projectRelatedActivity({
      prettyId: "DEPL-1",
      templateTypeName: "DEPLOY",
      name: "caused by",
      title: "",
    })).toEqual({
      prettyId: "DEPL-1",
      resource_type: "deploy",
      name: "caused by",
    });

    expect(projectRelatedActivity({
      prettyId: "DEPL-2",
      templateTypeName: "DEPLOY",
      name: "caused by",
      title: "v2.3.1 rollout",
    })).toEqual({
      prettyId: "DEPL-2",
      resource_type: "deploy",
      name: "caused by",
      title: "v2.3.1 rollout",
    });
  });

  it("passes through non-record values unchanged", () => {
    expect(projectRelatedActivity(null)).toBe(null);
    expect(projectRelatedActivity("bad")).toBe("bad");
  });
});
