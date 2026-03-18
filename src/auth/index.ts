/**
 * Authentication module for JWT Bearer token validation.
 * Based on mcpServerInternal Go implementation.
 */

export { JwtValidator } from "./jwt.js";
export { createJwtAuthMiddleware } from "./middleware.js";
export type { JwtClaims, Principal, AuthContext } from "./principal.js";
export { createPrincipalFromClaims } from "./principal.js";
