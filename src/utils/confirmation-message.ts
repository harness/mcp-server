import { formatBodyPreview } from "./body-preview.js";

export function readConfirmationPreview(
  preview: ((body: unknown) => string) | undefined,
  body: unknown,
): string | undefined {
  if (!preview) return undefined;
  try {
    const text = preview(body).trim();
    return text.length > 0 ? text : undefined;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Sensitive-field preview unavailable: ${message}`;
  }
}

/**
 * Build the create/update confirmation prompt. The sensitive-field summary is
 * placed before the raw body so it stays visible when the body preview truncates.
 */
export function buildWriteConfirmationMessage(options: {
  headline: string;
  body: unknown;
  confirmationPreview?: (body: unknown) => string;
}): string {
  const parts = [options.headline];
  const focused = readConfirmationPreview(options.confirmationPreview, options.body);
  if (focused) parts.push(focused);
  parts.push(formatBodyPreview(options.body));
  return parts.join("\n\n");
}
