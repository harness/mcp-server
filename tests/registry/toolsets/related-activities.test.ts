/**
 * Unit tests for the shared related-activity projection used by incidents,
 * alerts, and deploys. Integration tests in tests/tools/* assert the wiring;
 * these pin the pure projection contract at the source.
 */
import { describe, it, expect } from "vitest";
import { projectRelatedActivity } from "../../../src/registry/toolsets/related-activities.js";

describe("projectRelatedActivity", () => {
  it("maps known templateTypeName values to harness_get resource_type", () => {
    expect(
      projectRelatedActivity({
        prettyId: "INC-1",
        templateTypeName: "INCIDENT",
        title: "Checkout outage",
        name: "relates to",
        globalId: "uuid-1",
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
        name: "is caused by",
      }),
    ).toEqual({
      prettyId: "ALERT-9",
      resource_type: "alert",
      title: "CPU spike",
      name: "is caused by",
    });

    expect(
      projectRelatedActivity({
        prettyId: "DEPL-56",
        templateTypeName: "DEPLOY",
        title: "release 1.2.3",
        name: "triggers",
      }),
    ).toEqual({
      prettyId: "DEPL-56",
      resource_type: "deploy",
      title: "release 1.2.3",
      name: "triggers",
    });
  });

  it("omits resource_type for CHANGE and other unregistered backend types", () => {
    expect(
      projectRelatedActivity({
        prettyId: "CHG-3",
        templateTypeName: "CHANGE",
        title: "Feature flag flip",
        name: "relates to",
      }),
    ).toEqual({
      prettyId: "CHG-3",
      title: "Feature flag flip",
      name: "relates to",
    });

    expect(
      projectRelatedActivity({
        prettyId: "UNK-1",
        templateTypeName: "CUSTOM_TEMPLATE",
        title: "Unknown activity",
        name: "relates to",
      }),
    ).toEqual({
      prettyId: "UNK-1",
      title: "Unknown activity",
      name: "relates to",
    });
  });

  it("omits resource_type when templateTypeName is null or missing", () => {
    expect(
      projectRelatedActivity({
        prettyId: "DEPL-1",
        templateTypeName: null,
        title: "",
        name: "is caused by",
      }),
    ).toEqual({
      prettyId: "DEPL-1",
      name: "is caused by",
    });
  });

  it("drops empty titles and never forwards globalId or backend noise", () => {
    expect(
      projectRelatedActivity({
        prettyId: "ALERT-1",
        templateTypeName: "ALERT",
        title: "",
        name: "relates to",
        globalId: "global-abc",
        __internalMeta: { trace: "xyz" },
      }),
    ).toEqual({
      prettyId: "ALERT-1",
      resource_type: "alert",
      name: "relates to",
    });
  });

  it("only copies string prettyId, name, and title fields", () => {
    expect(
      projectRelatedActivity({
        prettyId: 42,
        name: ["relates to"],
        title: { text: "CPU spike" },
        templateTypeName: "ALERT",
      }),
    ).toEqual({
      resource_type: "alert",
    });
  });

  it("returns non-record values unchanged", () => {
    expect(projectRelatedActivity(null)).toBeNull();
    expect(projectRelatedActivity("bad-edge")).toBe("bad-edge");
    expect(projectRelatedActivity(["edge"])).toEqual(["edge"]);
  });
});
