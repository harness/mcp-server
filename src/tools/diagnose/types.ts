import type { HarnessClient } from "../../client/harness-client.js";
import type { Registry } from "../../registry/index.js";
import type { Config } from "../../config.js";
import type { ServerContext } from "@modelcontextprotocol/server";

export type Extra = ServerContext;

export interface DiagnoseContext {
  client: HarnessClient;
  registry: Registry;
  config: Config;
  input: Record<string, unknown>;
  args: Record<string, unknown>;
  extra: Extra;
  signal: AbortSignal;
}

export interface DiagnoseHandler {
  entityType: string;
  description: string;
  diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>>;
}
