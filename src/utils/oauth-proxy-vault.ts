import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface OAuthProxyVaultRecord {
  linked: boolean;
  refreshToken?: string;
  updatedAt: string;
}

export interface OAuthProxyLinkTransaction {
  issuer: string;
  subject: string;
  state: string;
  codeVerifier: string;
  expiresAt: number;
}

export interface UpstreamTokenBundle {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn?: number;
  expiresAt?: number;
  scope?: string;
}

export interface OAuthBrokerTransaction {
  clientId: string;
  redirectUri: string;
  clientState: string;
  resource: string;
  scope: string;
  codeChallenge: string;
  upstreamState: string;
  upstreamCodeVerifier: string;
  upstreamNonce: string;
  upstreamIssuer?: string;
  upstreamSubject?: string;
  upstreamIdSubject?: string;
  upstreamTokens?: UpstreamTokenBundle;
  harnessState?: string;
  harnessCodeVerifier?: string;
  expiresAt: number;
}

export interface OAuthBrokerAuthorizationCode {
  clientId: string;
  redirectUri: string;
  resource: string;
  scope: string;
  codeChallenge: string;
  upstreamIssuer: string;
  upstreamSubject: string;
  upstreamTokens: UpstreamTokenBundle;
  expiresAt: number;
}

interface VaultData {
  records: Record<string, OAuthProxyVaultRecord>;
  transactions: Record<string, OAuthProxyLinkTransaction>;
  brokerTransactions: Record<string, OAuthBrokerTransaction>;
  brokerCodes: Record<string, OAuthBrokerAuthorizationCode>;
}

interface EncryptedVault {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

export interface OAuthProxyVaultStore {
  getRecord(issuer: string, subject: string): Promise<OAuthProxyVaultRecord | undefined>;
  putRecord(issuer: string, subject: string, record: OAuthProxyVaultRecord): Promise<void>;
  deleteRecord(issuer: string, subject: string): Promise<void>;
  putTransaction(id: string, transaction: OAuthProxyLinkTransaction): Promise<void>;
  getTransaction(id: string): Promise<OAuthProxyLinkTransaction | undefined>;
  takeTransactionByState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthProxyLinkTransaction } | undefined>;
  putBrokerTransaction(id: string, transaction: OAuthBrokerTransaction): Promise<void>;
  deleteBrokerTransaction(id: string): Promise<void>;
  takeBrokerTransactionByUpstreamState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined>;
  takeBrokerTransactionByHarnessState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined>;
  putBrokerCode(digest: string, code: OAuthBrokerAuthorizationCode): Promise<void>;
  takeBrokerCode(digest: string): Promise<OAuthBrokerAuthorizationCode | undefined>;
  withLock?<T>(name: string, work: () => Promise<T>): Promise<T>;
  connect?(): Promise<void>;
}

function recordKey(issuer: string, subject: string): string {
  return `${issuer}\n${subject}`;
}

export function decodeOAuthProxyVaultKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error(
      "HARNESS_MCP_OAUTH_PROXY_VAULT_KEY must be a base64-encoded 32-byte key. " +
      "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

export function sealVaultValue(key: Buffer, value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const envelope: EncryptedVault = {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
  return JSON.stringify(envelope);
}

export function openVaultValue<T>(key: Buffer, sealed: string): T {
  const envelope = JSON.parse(sealed) as Partial<EncryptedVault>;
  if (
    envelope.version !== 1
    || typeof envelope.iv !== "string"
    || typeof envelope.tag !== "string"
    || typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("OAuth proxy vault has an unsupported format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export class OAuthProxyVault implements OAuthProxyVaultStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly key: Buffer,
  ) {}

  getRecord(issuer: string, subject: string): Promise<OAuthProxyVaultRecord | undefined> {
    return this.locked((vault) => vault.records[recordKey(issuer, subject)]);
  }

  putRecord(
    issuer: string,
    subject: string,
    record: OAuthProxyVaultRecord,
  ): Promise<void> {
    return this.locked((vault) => {
      vault.records[recordKey(issuer, subject)] = record;
    });
  }

  deleteRecord(issuer: string, subject: string): Promise<void> {
    return this.locked((vault) => {
      delete vault.records[recordKey(issuer, subject)];
    });
  }

  putTransaction(id: string, transaction: OAuthProxyLinkTransaction): Promise<void> {
    return this.locked((vault) => {
      vault.transactions[id] = transaction;
    });
  }

  getTransaction(id: string): Promise<OAuthProxyLinkTransaction | undefined> {
    return this.locked((vault) => {
      const transaction = vault.transactions[id];
      if (transaction && transaction.expiresAt <= Date.now()) {
        delete vault.transactions[id];
        return undefined;
      }
      return transaction;
    });
  }

  takeTransactionByState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthProxyLinkTransaction } | undefined> {
    return this.locked((vault) => {
      for (const [id, transaction] of Object.entries(vault.transactions)) {
        if (transaction.expiresAt <= Date.now()) {
          delete vault.transactions[id];
          continue;
        }
        if (transaction.state === state) {
          delete vault.transactions[id];
          return { id, transaction };
        }
      }
      return undefined;
    });
  }

  putBrokerTransaction(id: string, transaction: OAuthBrokerTransaction): Promise<void> {
    return this.locked((vault) => {
      vault.brokerTransactions[id] = transaction;
    });
  }

  deleteBrokerTransaction(id: string): Promise<void> {
    return this.locked((vault) => {
      delete vault.brokerTransactions[id];
    });
  }

  takeBrokerTransactionByUpstreamState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined> {
    return this.takeBrokerTransaction((transaction) => transaction.upstreamState === state);
  }

  takeBrokerTransactionByHarnessState(
    state: string,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined> {
    return this.takeBrokerTransaction((transaction) => transaction.harnessState === state);
  }

  putBrokerCode(
    digest: string,
    code: OAuthBrokerAuthorizationCode,
  ): Promise<void> {
    return this.locked((vault) => {
      vault.brokerCodes[digest] = code;
    });
  }

  takeBrokerCode(digest: string): Promise<OAuthBrokerAuthorizationCode | undefined> {
    return this.locked((vault) => {
      const code = vault.brokerCodes[digest];
      delete vault.brokerCodes[digest];
      if (!code || code.expiresAt <= Date.now()) return undefined;
      return code;
    });
  }

  private takeBrokerTransaction(
    matches: (transaction: OAuthBrokerTransaction) => boolean,
  ): Promise<{ id: string; transaction: OAuthBrokerTransaction } | undefined> {
    return this.locked((vault) => {
      for (const [id, transaction] of Object.entries(vault.brokerTransactions)) {
        if (transaction.expiresAt <= Date.now()) {
          delete vault.brokerTransactions[id];
          continue;
        }
        if (matches(transaction)) {
          delete vault.brokerTransactions[id];
          return { id, transaction };
        }
      }
      return undefined;
    });
  }

  private async locked<T>(work: (vault: VaultData) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const vault = await this.read();
      this.pruneExpired(vault);
      const result = await work(vault);
      await this.write(vault);
      return result;
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private pruneExpired(vault: VaultData): void {
    const now = Date.now();
    for (const [id, transaction] of Object.entries(vault.transactions)) {
      if (transaction.expiresAt <= now) delete vault.transactions[id];
    }
    for (const [id, transaction] of Object.entries(vault.brokerTransactions)) {
      if (transaction.expiresAt <= now) delete vault.brokerTransactions[id];
    }
    for (const [digest, code] of Object.entries(vault.brokerCodes)) {
      if (code.expiresAt <= now) delete vault.brokerCodes[digest];
    }
  }

  private async read(): Promise<VaultData> {
    try {
      const parsed = openVaultValue<Partial<VaultData>>(this.key, await readFile(this.path, "utf8"));
      return {
        records: parsed.records ?? {},
        transactions: parsed.transactions ?? {},
        brokerTransactions: parsed.brokerTransactions ?? {},
        brokerCodes: parsed.brokerCodes ?? {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return {
          records: {},
          transactions: {},
          brokerTransactions: {},
          brokerCodes: {},
        };
      }
      throw error;
    }
  }

  private async write(vault: VaultData): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const next = `${this.path}.tmp`;
    await writeFile(next, sealVaultValue(this.key, vault), { mode: 0o600 });
    await chmod(next, 0o600);
    await rename(next, this.path);
    await chmod(this.path, 0o600);
  }
}
