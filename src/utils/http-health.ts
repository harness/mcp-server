import type { SearchReadiness } from "../search/types.js";

export interface HttpHealthResponse {
  statusCode: number;
  body: {
    status: "ok" | "degraded";
    sessions: number;
    search: SearchReadiness;
  };
}

/**
 * Semantic search is an optional routing enhancement. Keep probe status tied to
 * the MCP server's ability to accept traffic, while exposing search degradation.
 */
export function buildHttpHealthResponse(search: SearchReadiness, sessions: number): HttpHealthResponse {
  const degraded = search.state === "failed";
  return {
    statusCode: 200,
    body: {
      status: degraded ? "degraded" : "ok",
      sessions,
      search,
    },
  };
}
