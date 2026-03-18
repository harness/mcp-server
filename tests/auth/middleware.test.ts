import { describe, it, expect, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { JwtValidator, createJwtAuthMiddleware } from "../../src/auth/index.js";
import { generateTestToken } from "./test-utils.js";

describe("JWT Auth Middleware", () => {
  const secret = "test-secret-minimum-32-characters-long-for-hmac";
  let validator: JwtValidator;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let statusCode: number;
  let responseBody: unknown;

  beforeEach(() => {
    validator = new JwtValidator(secret, "https://app.harness.io");

    req = {
      headers: {},
      ip: "127.0.0.1",
    };

    statusCode = 200;
    responseBody = null;

    res = {
      status: (code: number) => {
        statusCode = code;
        return res as Response;
      },
      json: (body: unknown) => {
        responseBody = body;
        return res as Response;
      },
    };

    next = () => {}; // No-op next function
  });

  describe("JWT authentication", () => {
    it("should accept valid Bearer token", () => {
      const token = generateTestToken(secret, {
        type: "USER",
        name: "Test User",
        email: "test@harness.io",
        username: "testuser",
        accountId: "acc123",
        iss: "https://app.harness.io",
      });

      req.headers = { authorization: `Bearer ${token}` };

      const middleware = createJwtAuthMiddleware(validator, false, undefined);
      middleware(req as Request, res as Response, next);

      expect(req.authContext).toBeDefined();
      expect(req.authContext?.authMode).toBe("jwt");
      expect(req.authContext?.principal?.email).toBe("test@harness.io");
      expect(req.authContext?.accountId).toBe("acc123");
      expect(statusCode).toBe(200); // Should not set error status
    });

    it("should reject invalid Bearer token", () => {
      req.headers = { authorization: "Bearer invalid-token" };

      const middleware = createJwtAuthMiddleware(validator, false, undefined);
      middleware(req as Request, res as Response, next);

      expect(statusCode).toBe(401);
      expect(responseBody).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: expect.stringContaining("Authentication failed"),
        },
      });
    });

    it("should reject expired Bearer token", () => {
      const token = generateTestToken(
        secret,
        {
          type: "USER",
          name: "Test User",
          email: "test@harness.io",
          username: "testuser",
          accountId: "acc123",
          iss: "https://app.harness.io",
        },
        -1, // Expired
      );

      req.headers = { authorization: `Bearer ${token}` };

      const middleware = createJwtAuthMiddleware(validator, false, undefined);
      middleware(req as Request, res as Response, next);

      expect(statusCode).toBe(401);
      expect(responseBody).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: expect.stringContaining("JWT token has expired"),
        },
      });
    });

    it("should handle missing Bearer prefix", () => {
      const token = generateTestToken(secret, {
        type: "USER",
        name: "Test User",
        email: "test@harness.io",
        username: "testuser",
        accountId: "acc123",
        iss: "https://app.harness.io",
      });

      req.headers = { authorization: token }; // Missing "Bearer " prefix

      const middleware = createJwtAuthMiddleware(validator, true, "fallback-account");
      middleware(req as Request, res as Response, next);

      // Should fall through to API key fallback or return 401
      expect(statusCode).toBe(401);
    });
  });

  describe("API key fallback", () => {
    it("should fall back to API key when Bearer token absent", () => {
      req.headers = { "x-api-key": "pat.acc123.token.secret" };

      const middleware = createJwtAuthMiddleware(validator, true, "acc123");
      middleware(req as Request, res as Response, next);

      expect(req.authContext).toBeDefined();
      expect(req.authContext?.authMode).toBe("api_key");
      expect(req.authContext?.accountId).toBe("acc123");
      expect(req.authContext?.principal).toBeUndefined(); // No principal for API key
      expect(statusCode).toBe(200);
    });

    it("should not allow API key fallback if disabled", () => {
      req.headers = { "x-api-key": "pat.acc123.token.secret" };

      const middleware = createJwtAuthMiddleware(validator, false, "acc123");
      middleware(req as Request, res as Response, next);

      expect(statusCode).toBe(401);
      expect(responseBody).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: expect.stringContaining("Authentication required"),
        },
      });
    });
  });

  describe("No authentication", () => {
    it("should return 401 when no auth provided", () => {
      req.headers = {}; // No Authorization or x-api-key

      const middleware = createJwtAuthMiddleware(validator, false, undefined);
      middleware(req as Request, res as Response, next);

      expect(statusCode).toBe(401);
      expect(responseBody).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: expect.stringContaining("Authentication required"),
        },
      });
    });
  });

  describe("Validator configuration errors", () => {
    it("should return 500 if JWT auth requested but validator not configured", () => {
      const token = generateTestToken(secret, {
        type: "USER",
        name: "Test User",
        email: "test@harness.io",
        username: "testuser",
        accountId: "acc123",
        iss: "https://app.harness.io",
      });

      req.headers = { authorization: `Bearer ${token}` };

      const middleware = createJwtAuthMiddleware(null, false, undefined);
      middleware(req as Request, res as Response, next);

      expect(statusCode).toBe(500);
      expect(responseBody).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: expect.stringContaining("JWT authentication not configured"),
        },
      });
    });

    it("should return 500 if API key fallback requested but account ID not configured", () => {
      req.headers = { "x-api-key": "pat.acc123.token.secret" };

      const middleware = createJwtAuthMiddleware(validator, true, undefined);
      middleware(req as Request, res as Response, next);

      expect(statusCode).toBe(500);
      expect(responseBody).toMatchObject({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: expect.stringContaining("API key authentication not configured"),
        },
      });
    });
  });
});
