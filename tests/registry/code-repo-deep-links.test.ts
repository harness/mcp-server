/**
 * Code UI routes use the repository slug. The API also accepts the numeric id,
 * and openInHarness was echoing that id (`/repos/837/...`), which 404s.
 */
import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config.js";
import type { HarnessClient } from "../../src/client/harness-client.js";
import { Registry } from "../../src/registry/index.js";

function makeConfig(): Config {
  return {
    HARNESS_API_KEY: "pat.test",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_ORG: "",
    HARNESS_PROJECT: "",
    HARNESS_API_TIMEOUT_MS: 30000,
    HARNESS_MAX_RETRIES: 0,
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_RATE_LIMIT_RPS: 10,
    HARNESS_READ_ONLY: false,
    HARNESS_SKIP_ELICITATION: false,
    HARNESS_ALLOW_HTTP: false,
    HARNESS_FME_BASE_URL: "https://api.split.io",
    LOG_LEVEL: "error",
  } as Config;
}

function makeClient(requestFn: (...args: unknown[]) => unknown): HarnessClient {
  return {
    request: requestFn,
    account: "test-account",
  } as unknown as HarnessClient;
}

const PR_LINK =
  "https://app.harness.io/ng/account/test-account/module/code/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/1272";

describe("code openInHarness repo slug", () => {
  it("resolves a numeric repo id on pull request get to the repository slug", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ number: 1272, title: "Grant access", target_repo_id: 837, state: "open" })
      .mockResolvedValueOnce({
        id: 837,
        identifier: "dataops-platform",
        path: "PROD/Data_Ops/dataops-platform",
        default_branch: "main",
      });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "pull_request", "get", {
      org_id: "PROD",
      project_id: "Data_Ops",
      repo_id: "837",
      pr_number: "1272",
    }) as { openInHarness?: string };

    expect(result.openInHarness).toBe(PR_LINK);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest.mock.calls[1]![0]).toMatchObject({
      method: "GET",
      path: "/code/api/v1/repos/837",
      params: { orgIdentifier: "PROD", projectIdentifier: "Data_Ops" },
    });
  });

  it("does not look up the repo when the caller already passed the slug", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({ number: 1272, title: "Grant access", state: "open" });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "pull_request", "get", {
      org_id: "PROD",
      project_id: "Data_Ops",
      repo_id: "dataops-platform",
      pr_number: "1272",
    }) as { openInHarness?: string };

    expect(result.openInHarness).toBe(PR_LINK);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("uses a nested repo slug without a follow-up request", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      number: 1272,
      target_repo_id: 837,
      repo: { identifier: "dataops-platform", path: "PROD/Data_Ops/dataops-platform" },
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "pull_request", "get", {
      org_id: "PROD",
      project_id: "Data_Ops",
      repo_id: 837,
      pr_number: "1272",
    }) as { openInHarness?: string };

    expect(result.openInHarness).toBe(PR_LINK);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("keeps the numeric link when slug lookup fails", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn()
      .mockResolvedValueOnce({ number: 1272, state: "open" })
      .mockRejectedValueOnce(new Error("repo lookup failed"));
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "pull_request", "get", {
      org_id: "PROD",
      project_id: "Data_Ops",
      repo_id: "837",
      pr_number: "1272",
    }) as { number: number; openInHarness?: string };

    expect(result.number).toBe(1272);
    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/code/orgs/PROD/projects/Data_Ops/repos/837/pulls/1272",
    );
  });

  it("uses the repository identifier on get without a second request", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn().mockResolvedValue({
      id: 837,
      identifier: "dataops-platform",
      path: "PROD/Data_Ops/dataops-platform",
    });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "repository", "get", {
      org_id: "PROD",
      project_id: "Data_Ops",
      repo_id: "837",
    }) as { openInHarness?: string };

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/code/orgs/PROD/projects/Data_Ops/repos/dataops-platform",
    );
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("stamps each listed pull request with the resolved slug", async () => {
    const registry = new Registry(makeConfig());
    const mockRequest = vi.fn()
      .mockResolvedValueOnce([
        { number: 1272, title: "Grant access", state: "open" },
        { number: 1273, title: "Follow up", state: "open" },
      ])
      .mockResolvedValueOnce({
        id: 837,
        identifier: "dataops-platform",
        path: "PROD/Data_Ops/dataops-platform",
        default_branch: "main",
      });
    const client = makeClient(mockRequest);

    const result = await registry.dispatch(client, "pull_request", "list", {
      org_id: "PROD",
      project_id: "Data_Ops",
      repo_id: "837",
    }) as Array<{ number: number; openInHarness?: string }>;

    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(result[0]!.openInHarness).toBe(PR_LINK);
    expect(result[1]!.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/module/code/orgs/PROD/projects/Data_Ops/repos/dataops-platform/pulls/1273",
    );
  });
});
