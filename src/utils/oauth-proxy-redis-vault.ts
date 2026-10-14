import { createHash, randomBytes } from "node:crypto";
import { createClient } from "redis";
import { createLogger } from "./logger.js";
import {
  openVaultValue,
  sealVaultValue,
  type OAuthBrokerAuthorizationCode,
  type OAuthBrokerTransaction,
  type OAuthProxyLinkTransaction,
  type OAuthProxyVaultRecord,
  type OAuthProxyVaultStore,
} from "./oauth-proxy-vault.js";

const log = createLogger("oauth-proxy-vault");
const LOCK_TTL_MS = 30_000;
const LOCK_WAIT_MS = 20_000;
const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface OAuthVaultRedis {
  connect(): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { nx?: boolean; px?: number }): Promise<boolean>;
  getDel(key: string): Promise<string | null>;
  del(keys: string[]): Promise<void>;
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export function createNodeRedisCommands(url: string): OAuthVaultRedis {
  const created = createClient({ url });
  let connecting: Promise<typeof created> | undefined;
  created.on("error", (error: unknown) => {
    log.warn("OAuth vault Redis client error", { error: safeRedisError(error) });
  });

  function client(): Promise<typeof created> {
    if (!connecting) {
      connecting = created.connect().then(() => created).catch((error: unknown) => {
        connecting = undefined;
        throw error;
      });
    }
    return connecting;
  }

  return {
    async connect() {
      try {
        const connected = await client();
        await connected.ping();
      } catch (error) {
        throw new Error(`OAuth proxy Redis connection failed: ${safeRedisError(error)}`);
      }
    },
    async get(key) {
      return (await client()).get(key);
    },
    async set(key, value, options) {
      const result = await (await client()).set(key, value, {
        ...(options?.nx ? { condition: "NX" as const } : {}),
        ...(options?.px !== undefined
          ? { expiration: { type: "PX" as const, value: options.px } }
          : {}),
      });
      return result === "OK";
    },
    async getDel(key) {
      return (await client()).getDel(key);
    },
    async del(keys) {
      if (keys.length > 0) await (await client()).del(keys);
    },
    async eval(script, keys, args) {
      return (await client()).eval(script, { keys, arguments: args });
    },
  };
}

export class RedisOAuthProxyVault implements OAuthProxyVaultStore {
  constructor(
    private readonly key: Buffer,
    private readonly prefix: string,
    private readonly redis: OAuthVaultRedis,
  ) {}

  connect(): Promise<void> {
    return this.redis.connect();
  }

  async getRecord(issuer: string, subject: string): Promise<OAuthProxyVaultRecord | undefined> {
    return this.read(this.recordKey(issuer, subject));
  }

  async putRecord(
    issuer: string,
    subject: string,
    record: OAuthProxyVaultRecord,
  ): Promise<void> {
    await this.redis.set(this.recordKey(issuer, subject), sealVaultValue(this.key, record));
  }

  async deleteRecord(issuer: string, subject: string): Promise<void> {
    await this.redis.del([this.recordKey(issuer, subject)]);
  }

  async putTransaction(id: string, transaction: OAuthProxyLinkTransaction): Promise<void> {
    await this.writeExpiring(this.linkKey(id), transaction, transaction.expiresAt);
    await this.writeExpiring(
      this.linkStateKey(transaction.state),
      id,
      transaction.expiresAt,
      false,
    );
  }

  async getTransaction(id: string): Promise<OAuthProxyLinkTransaction | undefined> {
    const transaction = await this.read<OAuthProxyLinkTransaction>(this.linkKey(id));
    if (!transaction || transaction.expiresAt > Date.now()) return transaction;
    await this.redis.del([this.linkKey(id), this.linkStateKey(transaction.state)]);
    return undefined;
  }

  async takeTransactionByState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthProxyLinkTransaction } | undefined> {
    const id = await this.redis.getDel(this.linkStateKey(state));
    if (!id) return undefined;
    const transaction = await this.takeValue<OAuthProxyLinkTransaction>(this.linkKey(id));
    if (!transaction || transaction.expiresAt <= Date.now()) return undefined;
    return { id, transaction };
  }

  async putBrokerTransaction(id: string, transaction: OAuthBrokerTransaction): Promise<void> {
    const existing = await this.read<OAuthBrokerTransaction>(this.brokerKey(id));
    if (existing) {
      const stale = [
        existing.upstreamState !== transaction.upstreamState
          ? this.brokerUpstreamKey(existing.upstreamState)
          : undefined,
        existing.harnessState && existing.harnessState !== transaction.harnessState
          ? this.brokerHarnessKey(existing.harnessState)
          : undefined,
      ].filter((value): value is string => value !== undefined);
      if (stale.length > 0) await this.redis.del(stale);
    }
    await this.writeExpiring(this.brokerKey(id), transaction, transaction.expiresAt);
    await this.writeExpiring(
      this.brokerUpstreamKey(transaction.upstreamState),
      id,
      transaction.expiresAt,
      false,
    );
    if (transaction.harnessState) {
      await this.writeExpiring(
        this.brokerHarnessKey(transaction.harnessState),
        id,
        transaction.expiresAt,
        false,
      );
    }
  }

  async deleteBrokerTransaction(id: string): Promise<void> {
    const transaction = await this.takeValue<OAuthBrokerTransaction>(this.brokerKey(id));
    if (!transaction) return;
    await this.redis.del([
      this.brokerUpstreamKey(transaction.upstreamState),
      ...(transaction.harnessState ? [this.brokerHarnessKey(transaction.harnessState)] : []),
    ]);
  }

  takeBrokerTransactionByUpstreamState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined> {
    return this.takeBrokerTransaction(this.brokerUpstreamKey(state));
  }

  takeBrokerTransactionByHarnessState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined> {
    return this.takeBrokerTransaction(this.brokerHarnessKey(state));
  }

  async putBrokerCode(digest: string, code: OAuthBrokerAuthorizationCode): Promise<void> {
    await this.writeExpiring(this.codeKey(digest), code, code.expiresAt);
  }

  async takeBrokerCode(digest: string): Promise<OAuthBrokerAuthorizationCode | undefined> {
    const code = await this.takeValue<OAuthBrokerAuthorizationCode>(this.codeKey(digest));
    if (!code || code.expiresAt <= Date.now()) return undefined;
    return code;
  }

  async withLock<T>(name: string, work: () => Promise<T>): Promise<T> {
    const lockKey = this.scoped("lock", digest(name));
    const token = randomBytes(16).toString("base64url");
    const deadline = Date.now() + LOCK_WAIT_MS;
    while (Date.now() <= deadline) {
      const acquired = await this.redis.set(lockKey, token, { nx: true, px: LOCK_TTL_MS });
      if (acquired) {
        try {
          return await work();
        } finally {
          await this.redis.eval(UNLOCK_SCRIPT, [lockKey], [token]);
        }
      }
      await sleep(25 + Math.floor(Math.random() * 25));
    }
    throw new Error("Timed out waiting for the OAuth refresh lock.");
  }

  private async takeBrokerTransaction(
    indexKey: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined> {
    const id = await this.redis.getDel(indexKey);
    if (!id) return undefined;
    const transaction = await this.takeValue<OAuthBrokerTransaction>(this.brokerKey(id));
    if (!transaction || transaction.expiresAt <= Date.now()) return undefined;
    const extra = [
      this.brokerUpstreamKey(transaction.upstreamState),
      transaction.harnessState ? this.brokerHarnessKey(transaction.harnessState) : undefined,
    ].filter((key): key is string => key !== undefined && key !== indexKey);
    if (extra.length > 0) await this.redis.del(extra);
    return { id, transaction };
  }

  private async read<T>(key: string): Promise<T | undefined> {
    const sealed = await this.redis.get(key);
    if (!sealed) return undefined;
    return openVaultValue<T>(this.key, sealed);
  }

  private async takeValue<T>(key: string): Promise<T | undefined> {
    const sealed = await this.redis.getDel(key);
    if (!sealed) return undefined;
    return openVaultValue<T>(this.key, sealed);
  }

  private async writeExpiring(
    key: string,
    value: unknown,
    expiresAt: number,
    encrypt = true,
  ): Promise<void> {
    const ttl = expiresAt - Date.now();
    if (ttl <= 0) return;
    const stored = encrypt ? sealVaultValue(this.key, value) : String(value);
    await this.redis.set(key, stored, { px: ttl });
  }

  private recordKey(issuer: string, subject: string): string {
    return this.scoped("record", digest(`${issuer}\n${subject}`));
  }

  private linkKey(id: string): string {
    return this.scoped("link", digest(id));
  }

  private linkStateKey(state: string): string {
    return this.scoped("link-state", digest(state));
  }

  private brokerKey(id: string): string {
    return this.scoped("broker", digest(id));
  }

  private brokerUpstreamKey(state: string): string {
    return this.scoped("broker-upstream", digest(state));
  }

  private brokerHarnessKey(state: string): string {
    return this.scoped("broker-harness", digest(state));
  }

  private codeKey(digestValue: string): string {
    return this.scoped("code", digest(digestValue));
  }

  private scoped(kind: string, id: string): string {
    return `${this.prefix}:${kind}:${id}`;
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

function safeRedisError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return message.replace(/rediss?:\/\/\S+/gi, "redis://***");
}
