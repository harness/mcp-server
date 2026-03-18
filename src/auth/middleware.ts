import type { Request, Response, NextFunction } from "express";
import type { JwtValidator } from "./jwt.js";
import { createPrincipalFromClaims } from "./principal.js";
import type { AuthContext } from "./principal.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("auth");

/**
 * Mask sensitive token data for logging.
 * Shows first 20 chars to identify the token, masks the rest.
 */
function maskToken(token: string): string {
  if (token.length <= 20) {
    return "***";
  }
  return `${token.slice(0, 20)}...`;
}

/**
 * Extend Express Request type to include authContext.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

/**
 * Create Express middleware for JWT Bearer token authentication with API key fallback.
 *
 * Authentication flow:
 * 1. Check for "Authorization: Bearer <jwt>" header
 *    - If present: validate JWT → extract principal → set authContext → continue
 *    - If invalid: return 401
 * 2. If no Bearer token and apiKeyFallback enabled:
 *    - Check for x-api-key header
 *    - Set authContext with api_key mode → continue
 * 3. If no auth provided: return 401
 *
 * Based on mcpServerInternal Go middleware (pkg/middleware/auth/auth_provider.go).
 *
 * @param validator - JWT validator instance (null if JWT disabled)
 * @param apiKeyFallback - Whether to allow x-api-key fallback
 * @param apiKeyAccountId - Account ID for API key mode (from config)
 * @returns Express middleware function
 */
export function createJwtAuthMiddleware(
  validator: JwtValidator | null,
  apiKeyFallback: boolean,
  apiKeyAccountId?: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // JWT authentication path
    if (authHeader?.startsWith("Bearer ")) {
      if (!validator) {
        log.error("JWT auth requested but JWT_SECRET not configured");
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "JWT authentication not configured on server" },
          id: null,
        });
        return;
      }

      const token = authHeader.slice(7); // Remove "Bearer " prefix
      try {
        const claims = validator.validate(token);
        const principal = createPrincipalFromClaims(claims);

        req.authContext = {
          principal,
          accountId: claims.accountId,
          authMode: "jwt",
          authHeader, // Store original "Bearer <token>" for passthrough to Harness API
        };

        log.debug("JWT authentication successful", {
          email: principal.email,
          accountId: claims.accountId,
          type: claims.type,
          token: maskToken(token),
        });

        return next();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        log.warn("JWT validation failed", {
          error: message,
          token: maskToken(token),
          ip: req.ip,
        });

        res.status(401).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: `Authentication failed: ${message}` },
          id: null,
        });
        return;
      }
    }

    // API key fallback path
    if (apiKeyFallback && req.headers["x-api-key"]) {
      if (!apiKeyAccountId) {
        log.error("API key auth attempted but HARNESS_ACCOUNT_ID not configured");
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "API key authentication not configured on server" },
          id: null,
        });
        return;
      }

      req.authContext = {
        accountId: apiKeyAccountId,
        authMode: "api_key",
      };

      log.debug("API key authentication successful", { accountId: apiKeyAccountId });
      return next();
    }

    // No authentication provided
    log.warn("Authentication required but not provided", { ip: req.ip });
    res.status(401).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Authentication required: provide Bearer token or x-api-key header",
      },
      id: null,
    });
  };
}
