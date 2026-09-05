import { describe, expect, it } from "vitest";
import { projectRelatedActivity } from "../../src/registry/toolsets/related-activities.js";

describe("projectRelatedActivity", () => {
  it("maps backend templateTypeName to harness_get resource_type", () => {
    expect(
      projectRelatedActivity({
        prettyId: "INC-42",
        templateTypeName: "INCIDENT",
        name: "causes",
        title: "API outage",
      }),
    ).toEqual({
      prettyId: "INC-42",
      resource_type: "incident",
      name: "causes",
      title: "API outage",
    });

    expect(
      projectRelatedActivity({
        prettyId: "ALRTHET-7",
        templateTypeName: "ALERT",
        name: "is correlated with",
        title: "High error rate",
      }),
    ).toEqual({
      prettyId: "ALRTHET-7",
      resource_type: "alert",
      name: "is correlated with",
      title: "High error rate",
    });

    expect(
      projectRelatedActivity({
        prettyId: "DEP-99",
        templateTypeName: "DEPLOY",
        name: "triggered by",
        title: "Release 1.2.3",
      }),
    ).toEqual({
      prettyId: "DEP-99",
      resource_type: "deploy",
      name: "triggered by",
      title: "Release 1.2.3",
    });
  });

  it("omits resource_type for CHANGE and unknown template types", () => {
    expect(
      projectRelatedActivity({
        prettyId: "CHG-1",
        templateTypeName: "CHANGE",
        name: "relates to",
        title: "Schema migration",
      }),
    ).toEqual({
      prettyId: "CHG-1",
      name: "relates to",
      title: "Schema migration",
    });

    expect(
      projectRelatedActivity({
        prettyId: "UNK-1",
        templateTypeName: "CUSTOM",
        name: "relates to",
        title: "Unknown edge",
      }),
    ).toEqual({
      prettyId: "UNK-1",
      name: "relates to",
      title: "Unknown edge",
    });
  });

  it("omits empty titles but keeps non-empty titles", () => {
    expect(
      projectRelatedActivity({
        prettyId: "DEP-1",
        templateTypeName: "DEPLOY",
        name: "duplicates",
        title: "",
      }),
    ).toEqual({
      prettyId: "DEP-1",
      resource_type: "deploy",
      name: "duplicates",
    });

    expect(
      projectRelatedActivity({
        prettyId: "DEP-2",
        templateTypeName: "DEPLOY",
        name: "duplicates",
        title: "Prod rollout",
      }),
    ).toEqual({
      prettyId: "DEP-2",
      resource_type: "deploy",
      name: "duplicates",
      title: "Prod rollout",
    });
  });

  it("drops globalId and other backend fields agents cannot act on", () => {
    expect(
      projectRelatedActivity({
        prettyId: "INC-3",
        templateTypeName: "INCIDENT",
        name: "causes",
        title: "Latency spike",
        globalId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "incident-template",
      }),
    ).toEqual({
      prettyId: "INC-3",
      resource_type: "incident",
      name: "causes",
      title: "Latency spike",
    });
  });

  it("passes through non-record values unchanged", () => {
    expect(projectRelatedActivity(null)).toBeNull();
    expect(projectRelatedActivity("bad-edge")).toBe("bad-edge");
  });
});
