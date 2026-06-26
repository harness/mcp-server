#!/usr/bin/env node

/**
 * Pre-download the HuggingFace embedding model for local semantic search.
 * Run during Docker image build so runtime startup needs no network egress.
 */

import { pipeline, env } from "@huggingface/transformers";

const MODEL = "Xenova/all-MiniLM-L6-v2";
const cacheDir = process.argv[2] ?? process.env.HARNESS_HF_CACHE_DIR ?? "/tmp/hf-cache";

env.cacheDir = cacheDir;
console.error(`[preload-hf-model] downloading ${MODEL} to ${cacheDir}`);
await pipeline("feature-extraction", MODEL, { dtype: "fp32" });
console.error("[preload-hf-model] done");
