/**
 * Server-side response cache for DataForSEO calls.
 *
 * Two layers:
 *  - in-memory Map (fast path within a running server process)
 *  - JSON files under .cache/seo-insights/ (survives dev-server restarts)
 *
 * Every upstream call is cached by a hash of (endpoint + request body) with a
 * TTL (default 24h, override with DATAFORSEO_CACHE_TTL_HOURS). The dashboard's
 * "Refresh data" button passes `bypass: true`, which re-fetches and rewrites
 * the cache, that is the ONLY path that spends DataForSEO quota again.
 *
 * Note for production: on serverless hosts the filesystem is ephemeral, so
 * promote this to a durable store (KV/Redis/DB) behind the same interface.
 */

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const CACHE_DIR = path.join(process.cwd(), ".cache", "seo-insights")

interface CacheEntry<T> {
  savedAt: string // ISO
  data: T
}

const memory = new Map<string, CacheEntry<unknown>>()

function ttlMs(overrideHours?: number): number {
  const hours = overrideHours ?? Number(process.env.DATAFORSEO_CACHE_TTL_HOURS ?? 24)
  return (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000
}

function keyFor(endpoint: string, body: unknown): string {
  return createHash("sha1").update(`${endpoint}:${JSON.stringify(body)}`).digest("hex")
}

function isFresh(entry: CacheEntry<unknown>, ttlHours?: number): boolean {
  return Date.now() - new Date(entry.savedAt).getTime() < ttlMs(ttlHours)
}

async function readFileEntry<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${key}.json`), "utf8")
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

async function writeFileEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true })
    await writeFile(path.join(CACHE_DIR, `${key}.json`), JSON.stringify(entry), "utf8")
  } catch {
    // Cache writes are best-effort; a read-only filesystem must not break reports.
  }
}

/* ---- refresh gate: when was this domain last force-refreshed? ---- */

function refreshKey(domain: string): string {
  return `refresh-${createHash("sha1").update(domain).digest("hex")}`
}

/** ISO timestamp of the last forced refresh for a domain, or null. */
export async function readRefreshStamp(domain: string): Promise<string | null> {
  const entry = await readFileEntry<string>(refreshKey(domain))
  return entry?.data ?? null
}

export async function writeRefreshStamp(domain: string): Promise<void> {
  const now = new Date().toISOString()
  await writeFileEntry(refreshKey(domain), { savedAt: now, data: now })
}

export interface CachedResult<T> {
  data: T
  /** True when served from cache (memory or file) without an upstream call. */
  cached: boolean
  savedAt: string
}

/**
 * Run `fetcher` with caching. `bypass` skips reads (but still writes), used by
 * the gated refresh action. `ttlHours` overrides the default TTL, reports tie
 * it to the snapshot cadence so data refreshes weekly/bi-weekly, not daily.
 */
export async function cached<T>(
  endpoint: string,
  body: unknown,
  fetcher: () => Promise<T>,
  opts: { bypass?: boolean; ttlHours?: number } = {},
): Promise<CachedResult<T>> {
  const key = keyFor(endpoint, body)

  if (!opts.bypass) {
    const mem = memory.get(key) as CacheEntry<T> | undefined
    if (mem && isFresh(mem, opts.ttlHours)) return { data: mem.data, cached: true, savedAt: mem.savedAt }
    const file = await readFileEntry<T>(key)
    if (file && isFresh(file, opts.ttlHours)) {
      memory.set(key, file)
      return { data: file.data, cached: true, savedAt: file.savedAt }
    }
  }

  const data = await fetcher()
  const entry: CacheEntry<T> = { savedAt: new Date().toISOString(), data }
  memory.set(key, entry)
  await writeFileEntry(key, entry)
  return { data, cached: false, savedAt: entry.savedAt }
}
