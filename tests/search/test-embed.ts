const DIM = 384;

/** Deterministic bag-of-words style embedding for unit tests (no network). */
export async function testEmbed(text: string): Promise<Float32Array> {
  const vec = new Float32Array(DIM);
  for (const token of text.toLowerCase().split(/\W+/).filter(Boolean)) {
    for (let i = 0; i < token.length; i++) {
      const idx = (token.charCodeAt(i) + i) % DIM;
      vec[idx]! += 1;
    }
  }
  let norm = 0;
  for (let i = 0; i < DIM; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIM; i++) vec[i]! /= norm;
  return vec;
}
