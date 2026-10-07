import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface VaultRecord {
  refreshToken?: string;
  linked: boolean;
  updatedAt: string;
}

export interface LinkTransaction {
  oktaIssuer: string;
  oktaSubject: string;
  oktaEmail?: string;
  codeVerifier: string;
  state: string;
  expiresAt: number;
}

interface VaultFile {
  records: Record<string, VaultRecord>;
  transactions: Record<string, LinkTransaction>;
}

export function vaultKey(issuer: string, subject: string): string {
  return `${issuer}\n${subject}`;
}

export class TokenVault {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  getRecord(issuer: string, subject: string): Promise<VaultRecord | undefined> {
    return this.locked(async (vault) => vault.records[vaultKey(issuer, subject)]);
  }

  putRecord(issuer: string, subject: string, record: VaultRecord): Promise<void> {
    return this.locked(async (vault) => {
      vault.records[vaultKey(issuer, subject)] = record;
    });
  }

  putTransaction(id: string, transaction: LinkTransaction): Promise<void> {
    return this.locked(async (vault) => {
      vault.transactions[id] = transaction;
    });
  }

  takeTransaction(id: string, state: string): Promise<LinkTransaction | undefined> {
    return this.locked(async (vault) => {
      const transaction = vault.transactions[id];
      if (!transaction || transaction.state !== state || transaction.expiresAt <= Date.now()) {
        if (transaction && transaction.expiresAt <= Date.now()) delete vault.transactions[id];
        return undefined;
      }
      delete vault.transactions[id];
      return transaction;
    });
  }

  getTransaction(id: string): Promise<LinkTransaction | undefined> {
    return this.locked(async (vault) => {
      const transaction = vault.transactions[id];
      if (!transaction || transaction.expiresAt <= Date.now()) return undefined;
      return transaction;
    });
  }

  findTransactionByState(state: string): Promise<{ id: string; transaction: LinkTransaction } | undefined> {
    return this.locked(async (vault) => {
      for (const [id, transaction] of Object.entries(vault.transactions)) {
        if (transaction.state === state && transaction.expiresAt > Date.now()) {
          return { id, transaction };
        }
      }
      return undefined;
    });
  }

  private async locked<T>(work: (vault: VaultFile) => Promise<T> | T): Promise<T> {
    const run = this.queue.then(async () => {
      const vault = await this.read();
      const result = await work(vault);
      await this.write(vault);
      return result;
    });
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async read(): Promise<VaultFile> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as Partial<VaultFile>;
      return {
        records: parsed.records ?? {},
        transactions: parsed.transactions ?? {},
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { records: {}, transactions: {} };
      }
      throw error;
    }
  }

  private async write(vault: VaultFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const next = `${this.path}.tmp`;
    await writeFile(next, JSON.stringify(vault), { mode: 0o600 });
    await chmod(next, 0o600);
    await rename(next, this.path);
    await chmod(this.path, 0o600);
  }
}
