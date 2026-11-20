import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Credentials for the HTTP request currently on the stack.
 * One process-wide HarnessClient reads these so concurrent requests do not
 * overwrite each other's account or token.
 */
export interface HarnessRequestCredentials {
  apiKey?: string;
  accountId?: string;
  accessToken?: string;
  appsecApiKey?: string;
}

const requestCredentials = new AsyncLocalStorage<HarnessRequestCredentials>();

export function currentHarnessRequestCredentials(): HarnessRequestCredentials | undefined {
  return requestCredentials.getStore();
}

export function runWithHarnessRequestCredentials<T>(
  credentials: HarnessRequestCredentials,
  fn: () => T,
): T {
  return requestCredentials.run(credentials, fn);
}
