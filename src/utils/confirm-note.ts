import type { EndpointSpec } from "../registry/types.js";
import { createLogger } from "./logger.js";

const log = createLogger("confirm-note");

/**
 * The extra line an operation adds to its approval prompt, or undefined for none.
 *
 * Only operations that set `confirmNote` get one, so every other prompt stays as it was.
 * A function note gets a copy of the input, so it cannot change what is sent; if it throws
 * or returns nothing, the prompt simply has no note.
 */
export function resolveConfirmNote(
  spec: Pick<EndpointSpec, "confirmNote"> | undefined,
  input: Record<string, unknown>,
): string | undefined {
  const note = spec?.confirmNote;
  if (note === undefined) return undefined;
  let text: unknown;
  try {
    text = typeof note === "function" ? note(structuredClone(input)) : note;
  } catch (err) {
    log.debug("confirmNote failed, prompting without it", { error: err instanceof Error ? err.message : String(err) });
    return undefined;
  }
  return typeof text === "string" && text.trim() ? text.trim() : undefined;
}

/** `message` with the note appended as its own paragraph; unchanged when there is no note. */
export function withConfirmNote(message: string, note: string | undefined): string {
  return note ? `${message}\n\n${note}` : message;
}
