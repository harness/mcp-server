import jwt from "jsonwebtoken";
import type { JwtClaims } from "../../src/auth/principal.js";

/**
 * Test utility: Generate a JWT token for testing.
 * NOT for production use - genai-service generates production tokens.
 */
export function generateTestToken(
  secret: string,
  claims: Omit<JwtClaims, "iat" | "exp">,
  expiresInSeconds: number = 3600
): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { ...claims, iat: now, exp: now + expiresInSeconds },
    secret,
    { algorithm: "HS256" }
  );
}
