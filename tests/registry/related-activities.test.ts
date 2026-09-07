import { describe, expect, it } from "vitest";
import { projectRelatedActivity } from "../../src/registry/toolsets/related-activities.js";

describe("projectRelatedActivity", () => {
  it("maps INCIDENT, ALERT, and DEPLOY templateTypeName to registry resource_type values", () => {
    expect(
      projectRelatedActivity({
        prettyId: "INC-42",
        templateTypeName: "INCIDENT",
        name: "causes",
        title: "API outage",
        globalId: "uuid-should-drop",
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
        prettyId: "DEP-3",
        templateTypeName: "DEPLOY",
        name: "duplicates",
        title: "v1.2.3 rollout",
      }),
    ).toEqual({
      prettyId: "DEP-3",
      resource_type: "deploy",
      name: "duplicates",
      title: "v1.2.3 rollout",
    });
  });

  it("omits resource_type for CHANGE and unmapped template types", () => {
    expect(
      projectRelatedActivity({
        prettyId: "CHG-1",
        templateTypeName: "CHANGE",
        name: "relates to",
        title: "Config update",
      }),
    ).toEqual({
      prettyId: "CHG-1",
      name: "relates to",
      title: "Config update",
    });

    expect(
      projectRelatedActivity({
        prettyId: "UNK-1",
        templateTypeName: "UNKNOWN",
        name: "relates to",
      }),
    ).toEqual({
      prettyId: "UNK-1",
      name: "relates to",
    });
  });

  it("omits resource_type when templateTypeName is absent", () => {
    expect(
      projectRelatedActivity({
        prettyId: "PAGE_ALERT_proj-9",
        name: "is correlated with",
        title: "Pager alert",
      }),
    ).toEqual({
      prettyId: "PAGE_ALERT_proj-9",
      name: "is correlated with",
      title: "Pager alert",
    });
  });

  it("drops empty title but keeps non-empty title", () => {
    expect(
      projectRelatedActivity({
        prettyId: "DEP-5",
        templateTypeName: "DEPLOY",
        name: "causes",
        title: "",
      }),
    ).toEqual({
      prettyId: "DEP-5",
      resource_type: "deploy",
      name: "causes",
    });

    expect(
      projectRelatedActivity({
        prettyId: "DEP-6",
        templateTypeName: "DEPLOY",
        name: "causes",
        title: "Production deploy",
      }),
    ).toEqual({
      prettyId: "DEP-6",
      resource_type: "deploy",
      name: "causes",
      title: "Production deploy",
    });
  });

  it("does not forward globalId or other backend-only fields", () => {
    const projected = projectRelatedActivity({
      prettyId: "INC-99",
      templateTypeName: "INCIDENT",
      name: "causes",
      globalId: "00000000-0000-0000-0000-000000000099",
      activityTemplateShortId: "INC",
      activityNumber: 99,
    }) as Record<string, unknown>;

    expect(projected.globalId).toBeUndefined();
    expect(projected.activityTemplateShortId).toBeUndefined();
    expect(projected.activityNumber).toBeUndefined();
  });

  it("returns non-record input unchanged", () => {
    expect(projectRelatedActivity(null)).toBeNull();
    expect(projectRelatedActivity("raw")).toBe("raw");
    expect(projectRelatedActivity(42)).toBe(42);
  });
});
