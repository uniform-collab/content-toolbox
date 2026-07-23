/**
 * Live keyword discovery via DataForSEO Labs. The dashboard's four algorithms
 * map directly onto Labs endpoints:
 *
 *   related         → related_keywords/live        (depth 1–3 supported natively)
 *   contains_phrase → keyword_suggestions/live     (long-tail variations containing the seed)
 *   same_topic      → keyword_ideas/live           (same category, different words)
 *   from_site       → keywords_for_site/live       (derived from the configured domain)
 *
 * Results are then enriched with exact per-keyword AI search volume via one
 * batched ai_keyword_data call (all keywords in a single request). Keywords
 * the AI dataset can't price stay null, the client falls back to a
 * topic-matched estimate from the Topics & Prompts data.
 */

import type { KeywordSuggestion, SuggestionAlgorithm } from "../types"
import { normalizeDomain } from "../settings"
import { cached } from "./cache"
import { dfsPost } from "./dataforseo"

interface KeywordInfo {
  search_volume?: number
  cpc?: number
  competition?: number
  monthly_searches?: { year: number; month: number; search_volume: number }[]
}

/** Items differ slightly per endpoint; normalize both flat and nested shapes. */
interface SuggestionItem {
  keyword?: string
  keyword_info?: KeywordInfo
  keyword_data?: { keyword?: string; keyword_info?: KeywordInfo }
}

interface SuggestionsResult {
  items?: SuggestionItem[]
}

interface AiVolumeResult {
  items?: { keyword?: string; ai_search_volume?: number }[]
}

export interface SuggestionParams {
  algorithm: SuggestionAlgorithm
  seed: string
  domain: string
  location: string
  language: string
  depth?: 1 | 2 | 3
  refresh?: boolean
}

const LIMIT = 100

function endpointAndBody(p: SuggestionParams): { path: string; body: Record<string, unknown> } {
  const base = { location_name: p.location, language_name: p.language, limit: LIMIT }
  switch (p.algorithm) {
    case "related":
      return { path: "/v3/dataforseo_labs/google/related_keywords/live", body: { ...base, keyword: p.seed, depth: p.depth ?? 2 } }
    case "contains_phrase":
      return { path: "/v3/dataforseo_labs/google/keyword_suggestions/live", body: { ...base, keyword: p.seed } }
    case "same_topic":
      return { path: "/v3/dataforseo_labs/google/keyword_ideas/live", body: { ...base, keywords: [p.seed] } }
    case "from_site":
      return { path: "/v3/dataforseo_labs/google/keywords_for_site/live", body: { ...base, target: normalizeDomain(p.domain) } }
  }
}

function trendOf(info: KeywordInfo | undefined): { trend12mo: number[]; trendDirection: "up" | "down" | "flat" } {
  const monthly = (info?.monthly_searches ?? [])
    .slice()
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((m) => m.search_volume)
    .slice(-12)
  const trend12mo = monthly.length ? monthly : Array(12).fill(info?.search_volume ?? 0)
  const head = trend12mo.slice(0, 3).reduce((a, b) => a + b, 0) / 3 || 1
  const tail = trend12mo.slice(-3).reduce((a, b) => a + b, 0) / 3
  const ratio = tail / head
  return { trend12mo, trendDirection: ratio > 1.15 ? "up" : ratio < 0.85 ? "down" : "flat" }
}

export async function fetchSuggestions(p: SuggestionParams): Promise<KeywordSuggestion[]> {
  const { path, body } = endpointAndBody(p)
  const res = await cached(path, body, () => dfsPost<SuggestionsResult>(path, body), { bypass: p.refresh })

  const items = res.data[0]?.items ?? []
  const seen = new Set<string>()
  const out: KeywordSuggestion[] = []
  for (const item of items) {
    const keyword = item.keyword ?? item.keyword_data?.keyword
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)
    const info = item.keyword_info ?? item.keyword_data?.keyword_info
    const { trend12mo, trendDirection } = trendOf(info)
    out.push({
      keyword,
      volume: info?.search_volume ?? 0,
      aiVolume: null, // filled from ai_keyword_data below
      trend12mo,
      trendDirection,
      cpc: info?.cpc ?? 0,
      competition: info?.competition ?? 0,
      categories: [],
      alreadyTracked: false, // overlay happens client-side against settings
    })
  }

  /* ---- exact AI search volume, one batched call for the whole result set ---- */
  if (out.length) {
    try {
      const volBody = {
        location_name: p.location,
        language_name: p.language,
        keywords: out.map((o) => o.keyword.toLowerCase()).slice(0, 1000),
      }
      const volRes = await cached(
        "llm/suggestions_ai_volume",
        volBody,
        () => dfsPost<AiVolumeResult>("/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live", volBody),
        { bypass: p.refresh },
      )
      const volumes = new Map(
        (volRes.data[0]?.items ?? [])
          .filter((i) => i.keyword)
          .map((i) => [i.keyword!.toLowerCase(), i.ai_search_volume ?? null] as const),
      )
      for (const o of out) o.aiVolume = volumes.get(o.keyword.toLowerCase()) ?? null
    } catch {
      // AI volumes stay null, the client shows the topic-matched estimate instead.
    }
  }

  return out.sort((a, b) => b.volume - a.volume)
}
