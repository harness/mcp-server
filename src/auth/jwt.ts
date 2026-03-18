import jwt from "jsonwebtoken";
import type { JwtClaims } from "./principal.js";

/**
 * JWT validator for Bearer token authentication.
 * Validates signature, expiration, issuer, and required claims.
 * Based on mcpServerInternal Go implementation (pkg/auth/jwt.go).
 */
export class JwtValidator {
  private readonly secret: string;
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly algorithm: jwt.Algorithm;

  constructor(secret: string, issuer?: string, audience?: string, algorithm: string = "HS256") {
    if (!secret || secret.length < 32) {
      throw new Error("JWT secret must be at least 32 characters long");
    }
    this.secret = secret;
    this.issuer = issuer;
    this.audience = audience;
    this.algorithm = algorithm as jwt.Algorithm;
  }

  /**
   * Validate a JWT token and return typed claims.
   * Throws error if token is invalid, expired, or missing required claims.
   *
   * @param token - JWT token string (without "Bearer " prefix)
   * @returns Validated JWT claims
   * @throws Error if validation fails
   */
  validate(token: string): JwtClaims {
    if (!token) {
      throw new Error("JWT token is empty");
    }

    try {
      // Verify and decode token
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [this.algorithm],
        issuer: this.issuer,
        audience: this.audience,
      }) as JwtClaims;

      // Validate required claims
      if (!decoded.type) {
        throw new Error("Missing required claim: type");
      }

      if (decoded.type !== "USER" && decoded.type !== "SERVICE_ACCOUNT") {
        throw new Error(`Invalid token type: expected USER or SERVICE_ACCOUNT, got ${decoded.type}`);
      }

      if (!decoded.name) {
        throw new Error("Missing required claim: name");
      }

      if (!decoded.accountId) {
        throw new Error("Missing required claim: accountId");
      }

      if (!decoded.email && !decoded.username) {
        throw new Error("Missing required claim: email or username");
      }

      return decoded;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new Error("JWT token has expired");
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new Error(`JWT validation failed: ${err.message}`);
      }
      if (err instanceof jwt.NotBeforeError) {
        throw new Error("JWT token is not yet valid");
      }
      // Re-throw validation errors
      throw err;
    }
  }
}
