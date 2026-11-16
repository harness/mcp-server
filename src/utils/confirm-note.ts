import type { EndpointSpec, HarnessClientInterface, RegistryDispatchInterface } from "../registry/types.js";
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

/** `message` with the note on the next line; unchanged when there is no note. */
export function withConfirmNote(message: string, note: string | undefined): string {
  return note ? `${message}\n${note}` : message;
}

/**
 * A prompt with a title and a long body. The note is one line right under the title, before the body:
 * clients fold a long prompt after about three lines ("… +4 more lines"), and anything later is hidden.
 * Unchanged (`title`, blank line, `body`) when there is no note.
 */
export function withConfirmNoteFirst(title: string, body: string, note: string | undefined): string {
  return note ? `${title}\n${note}\n\n${body}` : `${title}\n\n${body}`;
}

const PREFETCH_TIMEOUT_MS = 3_000;

/**
 * resolveConfirmNote, after the operation's `confirmPrefetch` (if any) has run on a copy of the
 * input. Operations without a prefetch behave exactly like resolveConfirmNote. A prefetch that
 * throws or takes over 3s is dropped, and the note is built without what it would have added.
 */
export async function resolveConfirmNoteAsync(
  spec: Pick<EndpointSpec, "confirmNote" | "confirmPrefetch"> | undefined,
  input: Record<string, unknown>,
  deps: { client: HarnessClientInterface; registry: RegistryDispatchInterface; accountId?: string; signal?: AbortSignal },
): Promise<string | undefined> {
  if (!spec?.confirmPrefetch || spec.confirmNote === undefined) return resolveConfirmNote(spec, input);
  let copy: Record<string, unknown>;
  try {
    copy = structuredClone(input);
  } catch {
    return resolveConfirmNote(spec, input);
  }
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), PREFETCH_TIMEOUT_MS);
  const signal = deps.signal ? AbortSignal.any([deps.signal, timeout.signal]) : timeout.signal;
  try {
    await Promise.race([
      spec.confirmPrefetch({ ...deps, signal, input: copy }),
      new Promise<void>((resolve) => timeout.signal.addEventListener("abort", () => resolve(), { once: true })),
    ]);
  } catch (err) {
    log.debug("confirmPrefetch failed, prompting without it", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    clearTimeout(timer);
  }
  return resolveConfirmNote(spec, copy);
}
