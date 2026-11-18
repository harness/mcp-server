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
  readonly app = new App({ name: "Harness", version: "1.0.0" }, { availableDisplayModes: ["inline", "fullscreen"] });
  private view: HarnessView | undefined;
  private listeners = new Set<Listener>();
  private themeListeners = new Set<() => void>();

  constructor() {
    this.app.ontoolresult = (result) => this.setView(readView(result));
    this.app.ontoolcancelled = () => this.setView(undefined);
    this.app.onhostcontextchanged = () => {
      this.applyTheme(this.app.getHostContext());
      for (const listener of this.themeListeners) listener();
    };
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

  /** Notified when the host theme, styles, or display mode change. */
  onContextChange(listener: () => void): () => void {
    this.themeListeners.add(listener);
    return () => this.themeListeners.delete(listener);
  }

  /** Run a read-only tool call named by the server and return its view, without replacing the current one. */
  async fetchView(refresh: ViewRefresh): Promise<HarnessView | undefined> {
    const result = await this.app.callServerTool({ name: refresh.tool, arguments: refresh.arguments });
    if (result.isError) throw new Error("Refresh failed");
    return readView(result);
  }

  /** Repeat a read-only tool call named by the server. Keeps the current view if the call returns none. */
  async refresh(refresh: ViewRefresh): Promise<void> {
    const next = await this.fetchView(refresh);
    if (next) this.setView(next);
  }

  /** Replace what the model knows about this view; used before the next user turn. */
  async updateModelContext(text: string): Promise<void> {
    await this.app.updateModelContext({ content: [{ type: "text", text }] });
  }

  canFullscreen(): boolean {
    return this.app.getHostContext()?.availableDisplayModes?.includes("fullscreen") ?? false;
  }

  displayMode(): string {
    return this.app.getHostContext()?.displayMode ?? "inline";
  }

  async toggleFullscreen(): Promise<void> {
    const mode = this.displayMode() === "fullscreen" ? "inline" : "fullscreen";
    await this.app.requestDisplayMode({ mode });
  }

  async openLink(url: string): Promise<void> {
    await this.app.openLink({ url });
  }

  /** Post a user message to the chat so the agent picks up the next step. */
  async sendMessage(text: string): Promise<void> {
    await this.app.sendMessage({ role: "user", content: [{ type: "text", text }] });
  }

  private applyTheme(context: McpUiHostContext | undefined): void {
    if (!context) return;
    if (context.theme) applyDocumentTheme(context.theme);
    if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
    if (context.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  }
}

export const host = new HostConnection();
