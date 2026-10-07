import dotenv from "dotenv";
import { loadPocConfig } from "./config.js";
import { OktaVerifier } from "./okta-jwt.js";
import { startPocProxy } from "./server.js";
import { TokenVault } from "./vault.js";

dotenv.config({ path: ".env.poc" });

const config = loadPocConfig();
const server = startPocProxy({
  config,
  vault: new TokenVault(config.vaultPath),
  okta: new OktaVerifier(config),
});

server.on("listening", () => {
  process.stderr.write(`POC proxy listening at ${config.publicUrl}\n`);
  process.stderr.write(`Later grant: ${config.laterGrant}\n`);
});
