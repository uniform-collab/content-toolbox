/**
 * Assembles a live DashboardData report from DataForSEO Labs endpoints.
 *
 * Endpoints used (all "live", cached via ./cache):
 *  - dataforseo_labs/google/domain_rank_overview/live    → position distribution, ranked-keyword count
 *  - dataforseo_labs/google/historical_rank_overview/live → traffic trend, KPI deltas/sparks
 *  - dataforseo_labs/google/ranked_keywords/live          → keywords table, movers, decaying pages
 *  - backlinks/summary/live                               → referring domains (optional subscription)
 *
 * AI visibility comes from the AI Optimization / LLM Mentions API, see
 * ./ai-visibility.ts.
 *
 * Honesty policy: anything the source can't provide is returned as null/empty
 * and listed in meta.unavailable, the UI hides those cards instead of showing
 * invented numbers. Site health (needs OnPage crawl) and keyword gap (needs
 * domain_intersection) are the current gaps.
 */

import type {
  Backlink,
  DashboardData,
  DecayingPage,
  KeywordGapRow,
  KeywordRow,
  Mover,
  ReportMeta,
  ReportResponse,
  SerpFeature,
} from "../types"
import { makeIgnoreMatcher, normalizeDomain } from "../settings"
import { buildAiVisibility } from "./ai-visibility"
import { cached } from "./cache"
import { dfsPost } from "./dataforseo"

/* ---------- minimal shapes of the DataForSEO responses we read ---------- */

interface OrganicMetrics {
  pos_1?: number
  pos_2_3?: number
  pos_4_10?: number
  pos_11_20?: number
  pos_21_30?: number
  pos_31_40?: number
  pos_41_50?: number
  pos_51_60?: number
  pos_61_70?: number
  pos_71_80?: number
  pos_81_90?: number
  pos_91_100?: number
  etv?: number
  count?: number
}

interface RankOverviewResult {
  items?: { metrics?: { organic?: OrganicMetrics } }[]
}

interface HistoricalResult {
  items?: { year?: number; month?: number; metrics?: { organic?: OrganicMetrics } }[]
}

interface RankedKeywordItem {
  keyword_data?: {
    keyword?: string
    keyword_info?: { search_volume?: number; cpc?: number; competition?: number }
    serp_info?: { serp_item_types?: string[] }
  }
  ranked_serp_element?: {
    serp_item?: {
      type?: string
      rank_absolute?: number
      relative_url?: string
      etv?: number
      rank_changes?: { previous_rank_absolute?: number | null; is_new?: boolean; is_up?: boolean; is_down?: boolean }
    }
  }
}

interface RankedKeywordsResult {
  items?: RankedKeywordItem[]
}

interface BacklinksSummaryResult {
  referring_domains?: number
}

interface BacklinksListResult {
  items?: {
    url_from?: string
    url_to?: string
    anchor?: string | null
    rank?: number
    dofollow?: boolean
    first_seen?: string
  }[]
}

/** Cache TTL by snapshot cadence, reports refresh weekly or bi-weekly. */
export function cadenceTtlHours(cadence: "weekly" | "biweekly" | undefined): number {
  return cadence === "biweekly" ? 14 * 24 : 7 * 24
}

/* ------------------------------ helpers ------------------------------ */

const round = (n: number) => Math.round(n)

function pctDelta(current: number, previous: number): number {
  if (!previous) return 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function p21plus(m: OrganicMetrics): number {
  return (
    (m.pos_21_30 ?? 0) + (m.pos_31_40 ?? 0) + (m.pos_41_50 ?? 0) + (m.pos_51_60 ?? 0) +
    (m.pos_61_70 ?? 0) + (m.pos_71_80 ?? 0) + (m.pos_81_90 ?? 0) + (m.pos_91_100 ?? 0)
  )
}

function serpFeatures(types: string[] | undefined): SerpFeature[] {
  const out: SerpFeature[] = []
  if (!types) return out
  if (types.includes("featured_snippet")) out.push("featured_snippet")
  if (types.includes("ai_overview")) out.push("aio")
  if (types.includes("people_also_ask")) out.push("paa")
  return out
}

/**
 * Deep link into the Uniform dashboard for "act on this page" buttons.
 * `origin` comes from Mesh metadata.dashboardOrigin so links stay on the same
 * app instance the user is working in (uniform.app, eu.uniform.app, …).
 */
function uniformCanvasUrl(origin: string | undefined, projectId: string | undefined, pagePath: string): string {
  if (!projectId) return ""
  const base = (origin ?? "https://uniform.app").replace(/\/+$/, "")
  return `${base}/projects/${projectId}/dashboards/canvas?search=${encodeURIComponent(pagePath)}`
}

/* ------------------------------ assembly ------------------------------ */

export interface ReportParams {
  domain: string
  location: string // DataForSEO location_name, e.g. "United States"
  language: string // DataForSEO language_name, e.g. "English"
  /** Brand names/aliases from settings; the first alias drives AI mention tracking. */
  brandAliases?: string[]
  /** Competitor domains from settings; drive AI share of voice. */
  competitors?: string[]
  /** AI visibility topics from settings; drive the AI search demand table. */
  aiTopics?: string[]
  /** Words that exclude a keyword or AI prompt everywhere (from settings). */
  ignoredTerms?: string[]
  projectId?: string
  /** Origin of the embedding Uniform app instance, from Mesh metadata.dashboardOrigin. */
  dashboardOrigin?: string
  /** Snapshot cadence, drives how long cached data stays fresh. */
  cadence?: "weekly" | "biweekly"
  refresh?: boolean
}

export async function buildReport(params: ReportParams): Promise<ReportResponse> {
  const { location, language, projectId, refresh } = params
  // Defensive normalization: settings may hold pasted URLs, but the data
  // provider only accepts bare domains ("https://www.x.com/" → "x.com").
  const domain = normalizeDomain(params.domain)
  const base = { target: domain, location_name: location, language_name: language }
  const bypass = { bypass: refresh, ttlHours: cadenceTtlHours(params.cadence) }
  const competitorDomains = (params.competitors ?? [])
    .map(normalizeDomain)
    .filter(Boolean)
    .slice(0, 5)

  // Fire the required calls in parallel; backlinks is optional (separate API
  // subscription) and degrades to null instead of failing the report, and AI
  // visibility degrades to null with an explanatory message.
  const [overviewRes, historyRes, rankedRes, backlinksRes, backlinksListRes, competitorRankedRes, ai] = await Promise.all([
    cached("labs/domain_rank_overview", base, () => dfsPost<RankOverviewResult>("/v3/dataforseo_labs/google/domain_rank_overview/live", base), bypass),
    cached("labs/historical_rank_overview", base, () => dfsPost<HistoricalResult>("/v3/dataforseo_labs/google/historical_rank_overview/live", base), bypass),
    cached(
      "labs/ranked_keywords",
      { ...base, limit: 100 },
      () =>
        dfsPost<RankedKeywordsResult>("/v3/dataforseo_labs/google/ranked_keywords/live", {
          ...base,
          limit: 100,
          order_by: ["ranked_serp_element.serp_item.etv,desc"],
        }),
      bypass,
    ),
    cached("backlinks/summary", { target: domain }, () => dfsPost<BacklinksSummaryResult>("/v3/backlinks/summary/live", { target: domain, include_subdomains: true }), bypass)
      .catch(() => null),
    cached(
      "backlinks/list",
      { target: domain, limit: 20, mode: "one_per_domain" },
      () =>
        dfsPost<BacklinksListResult>("/v3/backlinks/backlinks/live", {
          target: domain,
          include_subdomains: true,
          // One link per referring domain, a top-20 of distinct sources beats
          // twenty links from the same site.
          mode: "one_per_domain",
          limit: 20,
          order_by: ["rank,desc"],
        }),
      bypass,
    ).catch(() => null),
    // Competitor page-one keywords, for the keyword gap card. One call per
    // competitor, cached for the snapshot interval, degrading per-competitor.
    Promise.all(
      competitorDomains.map((c) => {
        const compBase = { target: c, location_name: location, language_name: language, limit: 100 }
        return cached(
          "labs/ranked_keywords",
          compBase,
          () =>
            dfsPost<RankedKeywordsResult>("/v3/dataforseo_labs/google/ranked_keywords/live", {
              ...compBase,
              order_by: ["keyword_data.keyword_info.search_volume,desc"],
            }),
          bypass,
        ).catch(() => null)
      }),
    ),
    buildAiVisibility({
      domain,
      competitors: params.competitors ?? [],
      aiTopics: params.aiTopics ?? [],
      location,
      language,
      ignoredTerms: params.ignoredTerms ?? [],
      ttlHours: cadenceTtlHours(params.cadence),
      refresh,
    }),
  ])

  const unavailable: string[] = ["Site health", "AI search volume for keywords", ...ai.unavailable]
  if (!competitorDomains.length) unavailable.push("Keyword gap (add competitors in settings)")
  if (!ai.data) unavailable.push("AI visibility")

  /* ---- history → trend, sparks, deltas ---- */
  const months = (historyRes.data[0]?.items ?? [])
    .filter((i) => i.year && i.month)
    .sort((a, b) => (a.year! - b.year!) || (a.month! - b.month!))
    .slice(-13) // 12 points + one earlier month for deltas
  const organicByMonth = months.map((i) => i.metrics?.organic ?? {})
  const last = organicByMonth[organicByMonth.length - 1] ?? {}
  const prev = organicByMonth[organicByMonth.length - 2] ?? {}

  const trafficTrend = months.slice(-12).map((i) => ({
    date: `${i.year}-${String(i.month).padStart(2, "0")}-01`,
    traffic: round(i.metrics?.organic?.etv ?? 0),
  }))
  const etvSpark = organicByMonth.slice(-12).map((m) => round(m.etv ?? 0))
  const countSpark = organicByMonth.slice(-12).map((m) => m.count ?? 0)

  /* ---- current overview metrics ---- */
  const current = overviewRes.data[0]?.items?.[0]?.metrics?.organic ?? last

  /* ---- ranked keywords → table, movers, decaying ---- */
  // The ignore list drops a keyword before anything downstream (table, movers,
  // decaying pages, opportunities) can pick it up.
  const isIgnored = makeIgnoreMatcher(params.ignoredTerms ?? [])
  const items = (rankedRes.data[0]?.items ?? []).filter(
    (i) =>
      i.ranked_serp_element?.serp_item?.type === "organic" &&
      i.keyword_data?.keyword &&
      !isIgnored(i.keyword_data.keyword),
  )

  const keywords: KeywordRow[] = items.map((i) => {
    const kw = i.keyword_data!
    const serp = i.ranked_serp_element!.serp_item!
    const pos = serp.rank_absolute ?? 0
    const prevPos = serp.rank_changes?.previous_rank_absolute ?? null
    const delta = prevPos != null && pos ? prevPos - pos : 0 // positive = moved up
    const segment = serp.rank_changes?.is_new
      ? "new"
      : serp.rank_changes?.is_up
        ? "improved"
        : serp.rank_changes?.is_down
          ? "declined"
          : "stable"
    return {
      keyword: kw.keyword!,
      position: pos,
      delta,
      volume: kw.keyword_info?.search_volume ?? 0,
      aiVolume: null,
      estTraffic: round(serp.etv ?? 0),
      url: serp.relative_url ?? "/",
      serpFeatures: serpFeatures(kw.serp_info?.serp_item_types),
      segment,
      strikingDistance: pos >= 4 && pos <= 15,
    }
  })

  const withPrev = items
    .map((i) => {
      const serp = i.ranked_serp_element!.serp_item!
      const prevPos = serp.rank_changes?.previous_rank_absolute
      if (prevPos == null || !serp.rank_absolute) return null
      return {
        keyword: i.keyword_data!.keyword!,
        from: prevPos,
        to: serp.rank_absolute,
        volume: i.keyword_data!.keyword_info?.search_volume ?? 0,
        etv: serp.etv ?? 0,
        url: serp.relative_url ?? "/",
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const gains: Mover[] = withPrev
    .filter((m) => m.to < m.from)
    .sort((a, b) => (b.from - b.to) * Math.log10(b.volume + 10) - (a.from - a.to) * Math.log10(a.volume + 10))
    .slice(0, 5)
    .map(({ keyword, from, to, volume }) => ({ keyword, from, to, volume }))
  const losses: Mover[] = withPrev
    .filter((m) => m.to > m.from)
    .sort((a, b) => (b.to - b.from) * Math.log10(b.volume + 10) - (a.to - a.from) * Math.log10(a.volume + 10))
    .slice(0, 5)
    .map(({ keyword, from, to, volume }) => ({ keyword, from, to, volume }))

  // Decaying pages: group declined keywords by page; "traffic at risk" is the
  // summed estimated traffic (etv) of the keywords that slipped.
  const byPage = new Map<string, { etv: number; lost: { keyword: string; from: number; to: number; etv: number }[] }>()
  for (const m of withPrev) {
    if (m.to <= m.from) continue
    const entry = byPage.get(m.url) ?? { etv: 0, lost: [] }
    entry.etv += m.etv
    entry.lost.push({ keyword: m.keyword, from: m.from, to: m.to, etv: m.etv })
    byPage.set(m.url, entry)
  }
  const decayingPages: DecayingPage[] = [...byPage.entries()]
    .sort((a, b) => b[1].etv - a[1].etv)
    .slice(0, 8)
    .map(([pagePath, v]) => ({
      path: pagePath,
      trafficDelta: -round(v.etv),
      trafficSpark: [], // no per-page history from this source yet
      keywordsLost: v.lost.sort((a, b) => b.etv - a.etv).slice(0, 5).map(({ keyword, from, to }) => ({ keyword, from, to })),
      aiCitationsDelta: 0,
      aiCitationsLost: [],
      lastEditedMonthsAgo: null,
      uniformEditUrl: uniformCanvasUrl(params.dashboardOrigin, projectId, pagePath),
    }))

  /* ---- keyword gaps: competitor ranks on page one, you don't rank at all ---- */
  const yourKeywordSet = new Set(items.map((i) => i.keyword_data!.keyword!.toLowerCase()))
  const gapByKeyword = new Map<string, KeywordGapRow>()
  competitorRankedRes.forEach((res, i) => {
    const competitor = competitorDomains[i]
    for (const item of res?.data?.[0]?.items ?? []) {
      const kw = item.keyword_data?.keyword
      const serp = item.ranked_serp_element?.serp_item
      if (!kw || serp?.type !== "organic" || isIgnored(kw)) continue
      const pos = serp.rank_absolute ?? 0
      if (pos < 1 || pos > 10) continue
      if (yourKeywordSet.has(kw.toLowerCase())) continue
      const volume = item.keyword_data?.keyword_info?.search_volume ?? 0
      if (volume < 50) continue
      const competition = item.keyword_data?.keyword_info?.competition ?? 0
      const existing = gapByKeyword.get(kw.toLowerCase())
      // Keep the best-ranking competitor per keyword.
      if (existing && existing.competitorPosition <= pos) continue
      gapByKeyword.set(kw.toLowerCase(), {
        keyword: kw,
        volume,
        competitor,
        competitorPosition: pos,
        difficulty: competition < 0.33 ? "low" : competition < 0.66 ? "medium" : "high",
      })
    }
  })
  const keywordGaps = [...gapByKeyword.values()].sort((a, b) => b.volume - a.volume).slice(0, 12)

  const referringDomains = backlinksRes?.data?.[0]?.referring_domains
  if (referringDomains == null) unavailable.push("Referring domains")

  /* ---- top backlinks (optional subscription; hidden when unavailable) ---- */
  const backlinks: Backlink[] = (backlinksListRes?.data?.[0]?.items ?? [])
    .filter((b) => b.url_from && b.url_to)
    .map((b) => ({
      urlFrom: b.url_from!,
      urlTo: b.url_to!,
      anchor: b.anchor ?? null,
      rank: b.rank ?? 0,
      dofollow: b.dofollow ?? false,
      firstSeen: b.first_seen ?? null,
    }))
  if (!backlinks.length) unavailable.push("Top backlinks")

  const data: DashboardData = {
    domain,
    country: location,
    language,
    lastSnapshot: new Date().toISOString().slice(0, 10),
    overview: {
      kpis: {
        traffic: { value: round(current.etv ?? 0), deltaPct: pctDelta(last.etv ?? 0, prev.etv ?? 0), spark: etvSpark },
        rankedKeywords: { value: current.count ?? 0, deltaPct: pctDelta(last.count ?? 0, prev.count ?? 0), spark: countSpark },
        referringDomains:
          referringDomains != null
            ? { value: referringDomains, deltaPct: 0, spark: Array(12).fill(referringDomains) }
            : null,
        siteHealth: null,
        aiMentions30d: null,
      },
      positionDistribution: {
        top3: (current.pos_1 ?? 0) + (current.pos_2_3 ?? 0),
        p4to10: current.pos_4_10 ?? 0,
        p11to20: current.pos_11_20 ?? 0,
        p21plus: p21plus(current),
        deltas: {
          top3: pctDelta((last.pos_1 ?? 0) + (last.pos_2_3 ?? 0), (prev.pos_1 ?? 0) + (prev.pos_2_3 ?? 0)),
          p4to10: pctDelta(last.pos_4_10 ?? 0, prev.pos_4_10 ?? 0),
          p11to20: pctDelta(last.pos_11_20 ?? 0, prev.pos_11_20 ?? 0),
          p21plus: pctDelta(p21plus(last), p21plus(prev)),
        },
      },
      movers: { gains, losses },
      alerts: { decayingPages: decayingPages.length, lostAiCitations: 0, crawlIssues: 0 },
      trafficTrend,
    },
    aiVisibility: ai.data, // from the AI Optimization / LLM Mentions API
    keywords,
    keywordGaps,
    decayingPages,
    backlinks,
    keywordSuggestions: {
      seed: "",
      algorithm: "same_topic",
      location,
      language,
      results: [],
      searchedAt: "",
    },
  }

  const meta: ReportMeta = {
    source: "dataforseo",
    fetchedAt: new Date().toISOString(),
    cached: [overviewRes, historyRes, rankedRes].every((r) => r.cached),
    unavailable,
    aiVisibilityMessage: ai.message,
  }

  return { data, meta }
}
