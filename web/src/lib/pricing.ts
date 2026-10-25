// USD per million tokens, the same table as api/app/agent/pricing.py.
const PRICES: Record<string, { input: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4.0, cacheRead: 0.2, cacheWrite: 5.0 },
  "claude-sonnet-5-5": { input: 2.0, cacheRead: 0.2, cacheWrite: 2.5 },
};

// What the request would have cost with every cached token billed as plain
// input, or null when the model is unknown or nothing was cached.
export function costWithoutCache(
  model: string,
  costUsd: number,
  usage: { cache_read_tokens: number; cache_write_tokens: number },
): number | null {
  const price = PRICES[model];
  const cached = usage.cache_read_tokens + usage.cache_write_tokens;

  if (!price || cached === 0) return null;
  const readDelta = (usage.cache_read_tokens * (price.input - price.cacheRead)) / 1e6;
  const writeDelta = (usage.cache_write_tokens * (price.input - price.cacheWrite)) / 1e6;

  return costUsd + readDelta + writeDelta;
}
