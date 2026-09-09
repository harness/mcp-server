import { describe, it, expect } from "vitest";
import { appendAgentTypeQuery, buildDeepLink } from "../../src/utils/deep-links.js";

describe("buildDeepLink", () => {
  const baseUrl = "https://app.harness.io";
  const accountId = "abc123";

  it("substitutes accountId and params", () => {
    const url = buildDeepLink(
      baseUrl,
      accountId,
      "/ng/account/{accountId}/orgs/{orgIdentifier}/projects/{projectIdentifier}",
      { orgIdentifier: "default", projectIdentifier: "myProject" },
    );
    expect(url).toBe(
      "https://app.harness.io/ng/account/abc123/orgs/default/projects/myProject",
    );
  });

  it("URL-encodes special characters in param values", () => {
    const url = buildDeepLink(
      baseUrl,
      accountId,
      "/ng/account/{accountId}/pipelines/{pipelineId}",
      { pipelineId: "my pipeline/test" },
    );
    expect(url).toBe(
      "https://app.harness.io/ng/account/abc123/pipelines/my%20pipeline%2Ftest",
    );
  });

  it("strips trailing slash from base URL", () => {
    const url = buildDeepLink(
      "https://app.harness.io/",
      accountId,
      "/ng/account/{accountId}",
      {},
    );
    expect(url).toBe("https://app.harness.io/ng/account/abc123");
  });

  it("handles empty params", () => {
    const url = buildDeepLink(baseUrl, accountId, "/ng/account/{accountId}/home", {});
    expect(url).toBe("https://app.harness.io/ng/account/abc123/home");
  });

  const connectorTemplate =
    "/ng/account/{accountId}/all/orgs/{orgIdentifier}/projects/{projectIdentifier}/settings/connectors/{connectorIdentifier}";

  it("keeps /all at account scope after stripping empty org/project segments", () => {
    const url = buildDeepLink(baseUrl, accountId, connectorTemplate, {
      orgIdentifier: "",
      projectIdentifier: "",
      connectorIdentifier: "github_random_7x4k",
    });
    expect(url).toBe(
      "https://app.harness.io/ng/account/abc123/all/settings/connectors/github_random_7x4k",
    );
  });

  it("keeps /all at org scope after stripping empty project segment", () => {
    const url = buildDeepLink(baseUrl, accountId, connectorTemplate, {
      orgIdentifier: "default",
      projectIdentifier: "",
      connectorIdentifier: "github_random_7x4k",
    });
    expect(url).toBe(
      "https://app.harness.io/ng/account/abc123/all/orgs/default/settings/connectors/github_random_7x4k",
    );
  });

  it("keeps /all at project scope", () => {
    const url = buildDeepLink(baseUrl, accountId, connectorTemplate, {
      orgIdentifier: "default",
      projectIdentifier: "GitX_Test",
      connectorIdentifier: "github_random_7x4k",
    });
    expect(url).toBe(
      "https://app.harness.io/ng/account/abc123/all/orgs/default/projects/GitX_Test/settings/connectors/github_random_7x4k",
    );
  });
});

describe("appendAgentTypeQuery", () => {
  const link = "https://app.harness.io/ng/account/a/all/ai-agents/orgs/o/projects/p/agents/x";

  it("appends type=custom or type=system from role", () => {
    expect(appendAgentTypeQuery(link, { role: "custom" })).toBe(`${link}?type=custom`);
    expect(appendAgentTypeQuery(link, { role: "system" })).toBe(`${link}?type=system`);
  });

  it("does not append type when role is missing or unknown", () => {
    expect(appendAgentTypeQuery(link, {})).toBe(link);
    expect(appendAgentTypeQuery(link, { role: "other" })).toBe(link);
  });
});
