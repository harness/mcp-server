import type { SearchReadiness } from "../search/types.js";

export interface HttpHealthResponse {
  statusCode: 200;
  body: {
    status: "ok";
    sessions: number;
    search: SearchReadiness;
  };
}

export function buildHttpHealthResponse(search: SearchReadiness, sessions: number): HttpHealthResponse {
  return {
    statusCode: 200,
    body: {
      status: "ok",
      sessions,
      search,
    },
  };
}
