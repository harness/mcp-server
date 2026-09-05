import { describe, expect, it } from "vitest";
import { projectRelatedActivity } from "../../src/registry/toolsets/related-activities.js";

describe("projectRelatedActivity", () => {
  it("translates backend templateTypeName enums to harness_get resource_type values", () => {
    expect(
      projectRelatedActivity({
        prettyId: "INC-1",
        templateTypeName: "INCIDENT",
        title: "Checkout outage",
        name: "relates to",
        globalId: "uuid-should-drop",
      }),
    ).toEqual({
      prettyId: "INC-1",
      resource_type: "incident",
      title: "Checkout outage",
      name: "relates to",
    });

    expect(
      projectRelatedActivity({
        prettyId: "ALERT-9",
        templateTypeName: "ALERT",
        title: "CPU spike",
        name: "relates to",
      }),
    ).toEqual({
      prettyId: "ALERT-9",
      resource_type: "alert",
      title: "CPU spike",
      name: "relates to",
    });

    expect(
      projectRelatedActivity({
        prettyId: "DEPLIR1-56",
        templateTypeName: "DEPLOY",
        title: "release 1.2.3",
        name: "is caused by",
      }),
    ).toEqual({
      prettyId: "DEPLIR1-56",
      resource_type: "deploy",
      title: "release 1.2.3",
      name: "is caused by",
    });
  });

  it("omits resource_type for CHANGE and unclassified edges", () => {
    expect(
      projectRelatedActivity({
        prettyId: "CHG-1",
        templateTypeName: "CHANGE",
        title: "config tweak",
        name: "relates to",
      }),
    ).toEqual({
      prettyId: "CHG-1",
      title: "config tweak",
      name: "relates to",
    });

    expect(
      projectRelatedActivity({
        prettyId: "EDGE-1",
        templateTypeName: null,
        title: "",
        name: "relates to",
      }),
    ).toEqual({
      prettyId: "EDGE-1",
      name: "relates to",
    });
  });

  it("drops empty titles but keeps non-empty relationship names", () => {
    expect(
      projectRelatedActivity({
        prettyId: "DEPL-1",
        templateTypeName: "DEPLOY",
        title: "",
        name: "is caused by",
      }),
    ).toEqual({
      prettyId: "DEPL-1",
      resource_type: "deploy",
      name: "is caused by",
    });
  });

  it("returns non-record payloads unchanged", () => {
    expect(projectRelatedActivity(null)).toBe(null);
    expect(projectRelatedActivity("raw")).toBe("raw");
    expect(projectRelatedActivity(["edge"])).toEqual(["edge"]);
  });
});
