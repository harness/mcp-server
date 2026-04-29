import { config as loadDotenv } from "dotenv";

export function loadEnvFile(envFile?: string): void {
  if (envFile) {
    loadDotenv({ path: envFile, quiet: true });
  } else {
    loadDotenv({ quiet: true });
  }
}
