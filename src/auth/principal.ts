/**
 * JWT claims structure matching mcpServerInternal Go implementation.
 * Claims are extracted from validated JWT tokens and used to create Principal objects.
 */
export interface JwtClaims {
  /** Token type: USER or SERVICE_ACCOUNT */
  type: "USER" | "SERVICE_ACCOUNT";
  /** User's full name */
  name: string;
  /** User's email address */
  email: string;
  /** Username */
  username: string;
  /** Harness account identifier */
  accountId: string;
  /** JWT issuer (e.g., "https://app.harness.io") */
  iss: string;
  /** Issued at timestamp (Unix seconds) */
  iat: number;
  /** Expiration timestamp (Unix seconds) */
  exp: number;
  /** Optional audience claim */
  aud?: string;
}

/**
 * Principal represents the authenticated user or service account.
 * Extracted from JWT claims and stored in request context.
 */
export interface Principal {
  /** User identifier (typically email or username) */
  uid: string;
  /** User email address */
  email: string;
  /** Display name for UI/logs */
  displayName: string;
  /** Harness account ID */
  accountId: string;
  /** Principal type */
  type: "USER" | "SERVICE_ACCOUNT";
}

/**
 * Authentication context attached to each HTTP request.
 * Contains user identity (for JWT) or just account ID (for API key).
 * Used by HarnessClient to set the correct authentication headers.
 */
export interface AuthContext {
  /** User principal (present only for JWT auth) */
  principal?: Principal;
  /** Harness account ID (always present) */
  accountId: string;
  /** Authentication mode used */
  authMode: "jwt" | "api_key";
  /** Original Authorization header (for JWT passthrough to Harness API) */
  authHeader?: string;
}

/**
 * Create a Principal from validated JWT claims.
 * Maps JWT claim fields to Principal structure.
 */
export function createPrincipalFromClaims(claims: JwtClaims): Principal {
  return {
    uid: claims.email || claims.username,
    email: claims.email,
    displayName: claims.name,
    accountId: claims.accountId,
    type: claims.type,
  };
}
