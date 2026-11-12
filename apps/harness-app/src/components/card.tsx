import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import type { ViewRefresh, ViewStatus } from "../../../../src/apps/view-types.js";
import { host } from "../host.js";

export function StatusPill({ status }: { status: ViewStatus }) {
  return (
    <span class={`pill pill--${status.tone}`}>
      {status.live && <span class="pill__dot" aria-hidden="true" />}
      {status.label}
    </span>
  );
}

interface CardProps {
  title: string;
  badge?: string;
  status?: ViewStatus;
  aside?: ComponentChildren;
  footer?: string;
  openInHarness?: string;
  refresh?: ViewRefresh;
  actions?: ComponentChildren;
  children?: ComponentChildren;
}

/** Shared frame: header (title, badge, status), body, footer (meta text and actions). */
export function Card({ title, badge, status, aside, footer, openInHarness, refresh, actions, children }: CardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const onRefresh = async () => {
    if (!refresh || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await host.refresh(refresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  const hasActions = Boolean(actions || refresh || openInHarness);

  return (
    <article class="card">
      <header class="card__header">
        <h1 class="card__title" title={title}>
          <span class="card__title-text">{title}</span>
          {badge && <span class="card__badge">{badge}</span>}
        </h1>
        <div class="card__status">
          {status && <StatusPill status={status} />}
          {aside}
        </div>
      </header>
      {children}
      {(footer || hasActions || error) && (
        <footer class="card__footer">
          <span class="card__meta" title={footer}>{error ?? footer}</span>
          {hasActions && (
            <div class="card__actions">
              {actions}
              {refresh && (
                <button type="button" class="btn btn--ghost" onClick={onRefresh} disabled={busy}>
                  {busy ? "Refreshing…" : "Refresh"}
                </button>
              )}
              {openInHarness && (
                <button type="button" class="btn btn--outline" onClick={() => void host.openLink(openInHarness)}>
                  Open in Harness
                </button>
              )}
            </div>
          )}
        </footer>
      )}
    </article>
  );
}
