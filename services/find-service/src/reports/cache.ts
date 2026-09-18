import type { CostEstimate, ReportRow } from "./types";

const TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { rows: ReportRow[]; estimate: CostEstimate; expiresAt: number };

const store = new Map<string, CacheEntry>();

/**
 * Exact-match repeat queries within the TTL are served from here instead of
 * re-hitting the database — the same win BigQuery's own query cache gives
 * for free on unchanged INFORMATION_SCHEMA-style lookups, implemented here
 * since Oracle has no equivalent server-side cache to lean on. Process
 * memory only (resets on restart); a swap to Redis is a drop-in change to
 * this one module if that durability ever matters.
 */
export function cacheKey(orgId: string, dataSourceId: string, sql: string, binds: Record<string, unknown>): string {
  return `${orgId}:${dataSourceId}:${sql}:${JSON.stringify(binds)}`;
}

export function getCached(key: string): CacheEntry | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

export function setCached(key: string, rows: ReportRow[], estimate: CostEstimate): void {
  store.set(key, { rows, estimate, expiresAt: Date.now() + TTL_MS });
}
