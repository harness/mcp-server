import { describe, it, expect } from "vitest";
import { previewCostCategoryWrite, previewCostPerspectiveWrite } from "../../src/utils/ccm-write-preview.js";
import { buildWriteConfirmationMessage } from "../../src/utils/confirmation-message.js";
import { formatBodyPreview } from "../../src/utils/body-preview.js";

const categoryBody = {
  name: "Business Units",
  costTargets: [
    {
      name: "Production",
      rules: [
        {
          viewConditions: [
            {
              viewField: { fieldId: "awsAccount", fieldName: "Account" },
              viewOperator: "IN",
              values: ["111111111111", "222222222222"],
            },
          ],
        },
      ],
    },
  ],
  sharedCosts: [
    {
      name: "Platform",
      strategy: "FIXED",
      splits: [
        { costTargetName: "Production", percentageContribution: 70 },
        { costTargetName: "Staging", percentageContribution: 30 },
      ],
      rules: [
        {
          viewConditions: [
            { viewField: { fieldName: "Product" }, viewOperator: "IN", values: ["shared"] },
          ],
        },
      ],
    },
    { name: "Overhead", strategy: "PROPORTIONAL", rules: [] },
  ],
  unallocatedCost: { strategy: "HIDE" },
};

describe("previewCostCategoryWrite", () => {
  it("previews bucket rules, shared-cost strategy, and unallocated strategy", () => {
    const preview = previewCostCategoryWrite(categoryBody);

    expect(preview).toContain("Unallocated cost: strategy HIDE");
    expect(preview).toContain("Shared-cost strategies: FIXED=1, PROPORTIONAL=1");
    expect(preview).toContain("Platform: Production 70%, Staging 30%");
    expect(preview).toContain("Production: rule 1: Account IN [111111111111, 222222222222]");
    expect(preview.indexOf("strategy HIDE")).toBeLessThan(preview.indexOf("Bucket rules"));
  });

  it("parses JSON string bodies", () => {
    const preview = previewCostCategoryWrite(JSON.stringify(categoryBody));
    expect(preview).toContain("strategy HIDE");
    expect(preview).toContain("FIXED splits:");
  });

  it("keeps a trailing HIDE strategy visible when bucket rules are huge", () => {
    const body = {
      costTargets: Array.from({ length: 40 }, (_, index) => ({
        name: `bucket-${index}`,
        rules: [
          {
            viewConditions: [
              {
                viewField: { fieldName: "label" },
                viewOperator: "IN",
                values: Array.from({ length: 30 }, (__, value) => `value-${index}-${value}`),
              },
            ],
          },
        ],
      })),
      sharedCosts: [
        ...Array.from({ length: 25 }, (_, index) => ({
          name: `proportional-${index}`,
          strategy: "PROPORTIONAL",
          rules: [],
        })),
        {
          name: "buried-fixed",
          strategy: "FIXED",
          splits: [{ costTargetName: "Production", percentageContribution: 100 }],
          rules: [],
        },
      ],
      unallocatedCost: { strategy: "HIDE" },
    };

    const preview = previewCostCategoryWrite(body);
    const raw = formatBodyPreview(body);

    expect(preview).toContain("strategy HIDE");
    expect(preview).toContain("FIXED=1");
    expect(preview).toContain("buried-fixed: Production 100%");
    expect(raw).toContain("...(truncated");
    expect(raw.indexOf("strategy HIDE")).toBe(-1);
  });

  it("reports a non-object body without throwing", () => {
    expect(previewCostCategoryWrite("not-json")).toContain("not a JSON object");
    expect(previewCostCategoryWrite(null)).toContain("not a JSON object");
  });
});

describe("previewCostPerspectiveWrite", () => {
  const perspectiveBody = {
    name: "Prod AWS",
    dataSources: ["AWS", "GCP"],
    viewRules: [
      {
        viewConditions: [
          {
            viewField: { fieldName: "Account" },
            viewOperator: "IN",
            values: ["111111111111"],
          },
        ],
      },
    ],
    viewPreferences: {
      showAnomalies: false,
      awsPreferences: { awsCost: "UNBLENDED", includeDiscounts: false, includeCredits: true },
      gcpPreferences: { includeDiscounts: true },
      azureViewPreferences: { costType: "ACTUAL" },
    },
  };

  it("previews name, filters, data sources, and cost basis for create", () => {
    const preview = previewCostPerspectiveWrite(perspectiveBody, { publishDefaults: true });

    expect(preview).toContain("Name: Prod AWS");
    expect(preview).toContain("Data sources: AWS, GCP");
    expect(preview).toContain("Filter rules: rule 1: Account IN [111111111111]");
    expect(preview).toContain("showAnomalies=false");
    expect(preview).toContain("AWS UNBLENDED (includeDiscounts=false, includeCredits=true)");
    expect(preview).toContain("GCP includeDiscounts=true");
    expect(preview).toContain("Azure ACTUAL");
    expect(preview).toContain("View state: COMPLETED (applied when omitted");
    expect(preview).toContain("Account cost-basis defaults are merged at dispatch");
  });

  it("does not invent a COMPLETED view state on update", () => {
    const preview = previewCostPerspectiveWrite(perspectiveBody, { publishDefaults: false });

    expect(preview).toContain("View state: omitted from replacement body");
    expect(preview).not.toContain("applied when omitted");
    expect(preview).toContain("Cost basis:");
    expect(preview).not.toContain("merged at dispatch");
  });

  it("keeps an explicit draft state", () => {
    const preview = previewCostPerspectiveWrite(
      { ...perspectiveBody, viewState: "DRAFT" },
      { publishDefaults: true },
    );
    expect(preview).toContain("View state: DRAFT");
  });
});

describe("buildWriteConfirmationMessage", () => {
  it("places the sensitive-field preview ahead of the raw body", () => {
    const message = buildWriteConfirmationMessage({
      headline: "Create cost_category?",
      body: categoryBody,
      confirmationPreview: previewCostCategoryWrite,
    });

    expect(message.startsWith("Create cost_category?")).toBe(true);
    expect(message.indexOf("Chargeback preview:")).toBeLessThan(message.indexOf('"unallocatedCost"'));
  });

  it("returns the focused preview when the preview function throws", () => {
    const message = buildWriteConfirmationMessage({
      headline: "Create cost_category?",
      body: { name: "x" },
      confirmationPreview: () => {
        throw new Error("boom");
      },
    });

    expect(message).toContain("Sensitive-field preview unavailable: boom");
    expect(message).toContain('"name": "x"');
  });
});
