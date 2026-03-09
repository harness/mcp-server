import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HarnessClient } from "../../src/client/harness-client.js";
import { HarnessApiError } from "../../src/utils/errors.js";
import type { Config } from "../../src/config.js";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    HARNESS_API_KEY: "pat.test-account.token.secret",
    HARNESS_ACCOUNT_ID: "test-account",
    HARNESS_BASE_URL: "https://app.harness.io",
    HARNESS_DEFAULT_ORG_ID: "default",
    HARNESS_DEFAULT_PROJECT_ID: "test-project",
    HARNESS_API_TIMEOUT_MS: 5000,
    HARNESS_MAX_RETRIES: 2,
    LOG_LEVEL: "error",
    HARNESS_RATE_LIMIT_RPS: 1000, // high limit so rate limiter doesn't interfere
    HARNESS_MAX_BODY_SIZE_MB: 10,
    HARNESS_READ_ONLY: false,
    ...overrides,
  };
}

describe("HarnessClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor and account getter", () => {
    it("exposes account ID", () => {
      const client = new HarnessClient(makeConfig());
      expect(client.account).toBe("test-account");
    });
  });

  describe("request — URL building", () => {
    it("builds URL with accountIdentifier and custom params", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ method: "GET", path: "/ng/api/projects", params: { orgIdentifier: "myorg" } });

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.origin).toBe("https://app.harness.io");
      expect(url.pathname).toBe("/ng/api/projects");
      expect(url.searchParams.get("accountIdentifier")).toBe("test-account");
      expect(url.searchParams.get("orgIdentifier")).toBe("myorg");
    });

    it("adds accountID param for log-service paths", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ path: "/gateway/log-service/blob/download" });

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get("accountID")).toBe("test-account");
      expect(url.searchParams.get("accountIdentifier")).toBe("test-account");
    });

    it("strips trailing slash from base URL", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig({ HARNESS_BASE_URL: "https://app.harness.io/" }));

      await client.request({ path: "/ng/api/test" });

      const url = fetchSpy.mock.calls[0][0] as string;
      expect(url).toContain("https://app.harness.io/ng/api/test?");
    });

    it("omits undefined and empty params", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ path: "/test", params: { a: "1", b: undefined, c: "" } });

      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.searchParams.get("a")).toBe("1");
      expect(url.searchParams.has("b")).toBe(false);
      expect(url.searchParams.has("c")).toBe(false);
    });
  });

  describe("request — headers", () => {
    it("sets x-api-key and Harness-Account headers", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ path: "/test" });

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("pat.test-account.token.secret");
      expect(headers["Harness-Account"]).toBe("test-account");
    });

    it("sets Content-Type to application/json for object body", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ method: "POST", path: "/test", body: { key: "value" } });

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("sets Content-Type to application/yaml for string body", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ method: "PUT", path: "/test", body: "pipeline:\n  name: test" });

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/yaml");
    });

    it("allows Content-Type override via options.headers", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ method: "POST", path: "/test", body: "data", headers: { "Content-Type": "text/plain" } });

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("text/plain");
    });
  });

  describe("request — success", () => {
    it("returns parsed JSON on 200", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: { id: "p1" } }), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      const result = await client.request<{ data: { id: string } }>({ path: "/test" });
      expect(result.data.id).toBe("p1");
    });
  });

  describe("request — error handling", () => {
    it("throws HarnessApiError with parsed message on 400", async () => {
      fetchSpy.mockResolvedValue(new Response(
        JSON.stringify({ message: "Invalid input", code: "INVALID", correlationId: "corr-1" }),
        { status: 400 },
      ));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 0 }));

      try {
        await client.request({ path: "/test" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        const e = err as HarnessApiError;
        expect(e.message).toBe("Invalid input");
        expect(e.statusCode).toBe(400);
        expect(e.harnessCode).toBe("INVALID");
        expect(e.correlationId).toBe("corr-1");
      }
    });

    it("throws HarnessApiError with raw body on non-JSON error", async () => {
      fetchSpy.mockResolvedValue(new Response("Bad Gateway", { status: 502 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 0 }));

      await expect(client.request({ path: "/test" })).rejects.toThrow(/HTTP 502: Bad Gateway/);
    });

    it("does not retry on 400", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ message: "bad" }), { status: 400 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 2 }));

      await expect(client.request({ path: "/test" })).rejects.toThrow(HarnessApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("does not retry on 401", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ message: "unauthorized" }), { status: 401 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 2 }));

      await expect(client.request({ path: "/test" })).rejects.toThrow(HarnessApiError);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("request — retry logic", () => {
    it("retries on 500 and succeeds", async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({ message: "fail" }), { status: 500 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 2 }));

      const result = await client.request<{ data: string }>({ path: "/test" });
      expect(result.data).toBe("ok");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("retries on 429 and succeeds", async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response(JSON.stringify({ message: "rate limited" }), { status: 429 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 2 }));

      const result = await client.request<{ data: string }>({ path: "/test" });
      expect(result.data).toBe("ok");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws after exhausting retries on 503", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ message: "unavailable" }), { status: 503 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 1 }));

      await expect(client.request({ path: "/test" })).rejects.toThrow(HarnessApiError);
      // initial + 1 retry = 2 calls
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("request — timeout", () => {
    it("throws HarnessApiError with 408 on timeout", async () => {
      fetchSpy.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        }, 10);
      }));
      const client = new HarnessClient(makeConfig({ HARNESS_API_TIMEOUT_MS: 1, HARNESS_MAX_RETRIES: 0 }));

      try {
        await client.request({ path: "/test" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(408);
        expect((err as HarnessApiError).message).toContain("timed out");
      }
    });
  });

  describe("request — network errors", () => {
    it("wraps fetch errors as HarnessApiError with 502", async () => {
      fetchSpy.mockRejectedValue(new Error("DNS resolution failed"));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 0 }));

      try {
        await client.request({ path: "/test" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(502);
        expect((err as HarnessApiError).message).toContain("DNS resolution failed");
      }
    });
  });

  describe("request — abort signal", () => {
    it("throws 499 immediately when signal is already aborted", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 0 }));
      const controller = new AbortController();
      controller.abort();

      try {
        await client.request({ path: "/test", signal: controller.signal });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(499);
        expect((err as HarnessApiError).message).toContain("cancelled");
      }
      // fetch should NOT have been called
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("throws 499 when signal aborts during request (no retry)", async () => {
      const controller = new AbortController();
      fetchSpy.mockImplementation(() => {
        // Abort mid-request
        controller.abort();
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      });
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 3 }));

      try {
        await client.request({ path: "/test", signal: controller.signal });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(499);
        expect((err as HarnessApiError).message).toContain("cancelled");
      }
      // Should NOT retry — only 1 call
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("passes signal through to fetch", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
      const client = new HarnessClient(makeConfig());
      const controller = new AbortController();

      await client.request({ path: "/test", signal: controller.signal });

      // The signal passed to fetch should be a combined signal (AbortSignal.any)
      const fetchOptions = fetchSpy.mock.calls[0][1] as RequestInit;
      expect(fetchOptions.signal).toBeDefined();
    });
  });

  describe("request — non-JSON responses", () => {
    it("throws clear error for HTML response (proxy error page)", async () => {
      const html = "<html><body><h1>502 Bad Gateway</h1></body></html>";
      fetchSpy.mockResolvedValue(new Response(html, { status: 200, headers: { "Content-Type": "text/html" } }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 0 }));

      try {
        await client.request({ path: "/test" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(502);
        expect((err as HarnessApiError).message).toContain("Non-JSON response");
        expect((err as HarnessApiError).message).toContain("502 Bad Gateway");
      }
    });

    it("throws clear error for empty response body", async () => {
      fetchSpy.mockResolvedValue(new Response("", { status: 200 }));
      const client = new HarnessClient(makeConfig({ HARNESS_MAX_RETRIES: 0 }));

      try {
        await client.request({ path: "/test" });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(HarnessApiError);
        expect((err as HarnessApiError).statusCode).toBe(502);
        expect((err as HarnessApiError).message).toContain("Empty response body");
      }
    });

    it("parses valid JSON response normally", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      const result = await client.request<{ data: string }>({ path: "/test" });
      expect(result.data).toBe("ok");
    });
  });

  describe("request — body serialization", () => {
    it("sends JSON-stringified body for objects", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ method: "POST", path: "/test", body: { key: "val" } });

      const body = fetchSpy.mock.calls[0][1]?.body as string;
      expect(JSON.parse(body)).toEqual({ key: "val" });
    });

    it("sends raw string body as-is", async () => {
      fetchSpy.mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
      const client = new HarnessClient(makeConfig());

      await client.request({ method: "PUT", path: "/test", body: "raw yaml content" });

      const body = fetchSpy.mock.calls[0][1]?.body as string;
      expect(body).toBe("raw yaml content");
    });
  });
});
