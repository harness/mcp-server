import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { HarnessView, ViewRefresh } from "../../../src/apps/view-types.js";

const VIEW_META_KEY = "harness.io/view";

type Listener = (view: HarnessView | undefined) => void;

interface ToolResultLike {
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

export function readView(result: ToolResultLike | undefined): HarnessView | undefined {
  if (!result || result.isError) return undefined;
  const view = result._meta?.[VIEW_META_KEY] as HarnessView | undefined;
  return view && typeof view === "object" && typeof view.kind === "string" ? view : undefined;
}

export class HostConnection {
  readonly app = new App({ name: "Harness", version: "1.0.0" }, { availableDisplayModes: ["inline"] });
  private view: HarnessView | undefined;
  private listeners = new Set<Listener>();

  constructor() {
    this.app.ontoolresult = (result) => this.setView(readView(result));
    this.app.ontoolcancelled = () => this.setView(undefined);
    this.app.onhostcontextchanged = () => this.applyTheme(this.app.getHostContext());
  }

  async connect(): Promise<void> {
    await this.app.connect();
    this.applyTheme(this.app.getHostContext());
  }

  current(): HarnessView | undefined {
    return this.view;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setView(view: HarnessView | undefined): void {
    this.view = view;
    for (const listener of this.listeners) listener(view);
  }

  /** Repeat a read-only tool call named by the server. Keeps the current view if the call returns none. */
  async refresh(refresh: ViewRefresh): Promise<void> {
    const result = await this.app.callServerTool({ name: refresh.tool, arguments: refresh.arguments });
    if (result.isError) throw new Error("Refresh failed");
    const next = readView(result);
    if (next) this.setView(next);
  }

  async openLink(url: string): Promise<void> {
    await this.app.openLink({ url });
  }

  private applyTheme(context: McpUiHostContext | undefined): void {
    if (!context) return;
    if (context.theme) applyDocumentTheme(context.theme);
    if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
    if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  }
}

export const host = new HostConnection();
