import { describe, it, expect } from "vitest";
import { connectorHandler } from "../../../src/tools/diagnose/connector.js";
import { makeContext } from "./helpers.js";

describe("connectorHandler", () => {
  it("throws when resource_id is missing", async () => {
    const ctx = makeContext({ input: {} });
    await expect(connectorHandler.diagnose(ctx)).rejects.toThrow("resource_id");
  });

  it("returns healthy connector with successful test", async () => {
    const ctx = makeContext({
      input: { resource_id: "my-docker" },
      dispatchMap: {
        connector: {
          get: {
            connector: { name: "My Docker", identifier: "my-docker", type: "DockerRegistry", spec: { url: "https://index.docker.io/v2/" } },
            status: { status: "SUCCESS", lastTestedAt: 1700000000000, lastConnectedAt: 1700000000000 },
          },
        },
      },
      executeMap: {
        connector: { test_connection: { status: "SUCCESS" } },
      },
    });

    const result = await connectorHandler.diagnose(ctx);

    expect(result.connector).toMatchObject({ name: "My Docker", identifier: "my-docker", type: "DockerRegistry" });
    expect((result.connector as Record<string, unknown>).url).toBe("https://index.docker.io/v2/");
    expect(result.test_result).toMatchObject({ status: "SUCCESS" });
    expect(result.last_known_status).toMatchObject({ status: "SUCCESS" });
  });

  it("reports failed connectivity test with errors", async () => {
    const ctx = makeContext({
      input: { resource_id: "bad-conn" },
      dispatchMap: {
        connector: {
          get: {
            connector: { name: "Bad", identifier: "bad-conn", type: "Git" },
          },
        },
      },
      executeMap: {
        connector: {
          test_connection: {
            status: "FAILURE",
            errorSummary: "Connection refused",
            errors: [{ reason: "UNKNOWN", message: "Connection refused", code: 500 }],
          },
        },
      },
    });

    const result = await connectorHandler.diagnose(ctx);
    const testResult = result.test_result as Record<string, unknown>;

    expect(testResult.status).toBe("FAILURE");
    expect(testResult.error_summary).toBe("Connection refused");
    expect(testResult.errors).toHaveLength(1);
  });

  it("handles test_connection exception gracefully", async () => {
    const ctx = makeContext({
      input: { resource_id: "timeout-conn" },
      dispatchMap: {
        connector: {
          get: { connector: { name: "Timeout", identifier: "timeout-conn", type: "K8s" } },
        },
      },
      executeMap: {
        connector: { test_connection: new Error("Request timeout after 30000ms") },
      },
    });

    const result = await connectorHandler.diagnose(ctx);
    const testResult = result.test_result as Record<string, unknown>;

    expect(testResult.status).toBe("ERROR");
    expect(testResult.error).toContain("timeout");
  });

  it("extracts auth type from various spec shapes", async () => {
    const specVariants = [
      { authentication: { type: "UsernamePassword" } },
      { auth: { type: "ServiceAccount" } },
      { authType: "Anonymous" },
    ];

    for (const spec of specVariants) {
      const ctx = makeContext({
        input: { resource_id: "c1" },
        dispatchMap: {
          connector: { get: { connector: { name: "C", identifier: "c1", type: "Git", spec } } },
        },
        executeMap: { connector: { test_connection: { status: "SUCCESS" } } },
      });

      const result = await connectorHandler.diagnose(ctx);
      const conn = result.connector as Record<string, unknown>;
      expect(conn.auth_type).toBeDefined();
    }
  });

  it("extracts URL from various spec shapes", async () => {
    const urlFields: Record<string, string> = {
      url: "https://github.com",
      dockerRegistryUrl: "https://index.docker.io",
      gitUrl: "https://gitlab.com",
      masterUrl: "https://kubernetes.default.svc",
    };

    for (const [field, value] of Object.entries(urlFields)) {
      const ctx = makeContext({
        input: { resource_id: "c1" },
        dispatchMap: {
          connector: { get: { connector: { name: "C", identifier: "c1", type: "Git", spec: { [field]: value } } } },
        },
        executeMap: { connector: { test_connection: { status: "SUCCESS" } } },
      });

      const result = await connectorHandler.diagnose(ctx);
      const conn = result.connector as Record<string, unknown>;
      expect(conn.url).toBe(value);
    }
  });

  it("generates deep link with org, project, and connector id", async () => {
    const ctx = makeContext({
      input: { resource_id: "my-conn", org_id: "myorg", project_id: "myproj" },
      dispatchMap: {
        connector: { get: { connector: { name: "C", identifier: "my-conn", type: "Git" } } },
      },
      executeMap: { connector: { test_connection: { status: "SUCCESS" } } },
    });

    const result = await connectorHandler.diagnose(ctx);

    expect(result.openInHarness).toBe(
      "https://app.harness.io/ng/account/test-account/all/orgs/myorg/projects/myproj/setup/connectors/my-conn",
    );
  });
});
