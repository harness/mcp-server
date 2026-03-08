import type { HarnessClient } from "../../client/harness-client.js";
import type { Registry } from "../../registry/index.js";
import type { Config } from "../../config.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";

export type Extra = RequestHandlerExtra<ServerRequest, ServerNotification>;

export interface DiagnoseContext {
  client: HarnessClient;
  registry: Registry;
  config: Config;
  input: Record<string, unknown>;
  args: Record<string, unknown>;
  extra: Extra;
}

export interface DiagnoseHandler {
  entityType: string;
  description: string;
  diagnose(ctx: DiagnoseContext): Promise<Record<string, unknown>>;
}
