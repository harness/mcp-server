import { describe, expect, it } from "vitest";
import { applyCodeRepoSlug, codeRepoSlugFromRecord, isNumericRepoRef } from "../../src/utils/code-repo-link.js";

describe("code repo slug for UI links", () => {
  it("treats an all-digit ref as a numeric repository id", () => {
    expect(isNumericRepoRef("837")).toBe(true);
    expect(isNumericRepoRef("dataops-platform")).toBe(false);
    expect(isNumericRepoRef("837a")).toBe(false);
  });

  it("reads the slug from a repository payload", () => {
    expect(codeRepoSlugFromRecord({
      id: 837,
      identifier: "dataops-platform",
      path: "PROD/Data_Ops/dataops-platform",
      default_branch: "main",
    })).toBe("dataops-platform");
  });

  it("reads the target repo slug nested on a pull request", () => {
    expect(codeRepoSlugFromRecord({
      number: 1272,
      target_repo_id: 837,
      repo: { id: 837, identifier: "dataops-platform", path: "PROD/Data_Ops/dataops-platform" },
    })).toBe("dataops-platform");
  });

  it("ignores a fork source repo", () => {
    expect(codeRepoSlugFromRecord({
      number: 9,
      target_repo_id: 837,
      source_repo: { id: 900, identifier: "fork-of-dataops", path: "other/fork-of-dataops" },
    })).toBeUndefined();
  });

  it("uses the source repo when it is the same repository", () => {
    expect(codeRepoSlugFromRecord({
      number: 9,
      target_repo_id: 837,
      source_repo: { id: 837, identifier: "dataops-platform", path: "PROD/Data_Ops/dataops-platform" },
    })).toBe("dataops-platform");
  });

  it("replaces a numeric link segment and keeps an existing slug", () => {
    const numeric: Record<string, string> = { repoIdentifier: "837" };
    applyCodeRepoSlug(numeric, undefined, "dataops-platform");
    expect(numeric.repoIdentifier).toBe("dataops-platform");

    const slug: Record<string, string> = { repoIdentifier: "dataops-platform" };
    applyCodeRepoSlug(slug, undefined, "other-repo");
    expect(slug.repoIdentifier).toBe("dataops-platform");
  });

  it("lets a row's own repo slug override the parent", () => {
    const params: Record<string, string> = { repoIdentifier: "837" };
    applyCodeRepoSlug(params, {
      number: 3,
      repo: { identifier: "other-repo", path: "PROD/Data_Ops/other-repo" },
    }, "dataops-platform");
    expect(params.repoIdentifier).toBe("other-repo");
  });
});
