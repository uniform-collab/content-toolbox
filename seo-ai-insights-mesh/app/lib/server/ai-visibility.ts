/**
 * Live AI Visibility via DataForSEO's AI Optimization → LLM Mentions API
 * (https://docs.dataforseo.com/v3/ai_optimization-llm_mentions-overview/).
 *
 * The LLM Mentions database covers the `google` (AI Overviews) and `chat_gpt`
 * platforms. All metrics are DOMAIN-based, keyword/brand-name matching proved
 * too noisy for generic brand names (e.g. "Uniform" matches school uniforms
 * and the Uniform Commercial Code):
 *  - mention  = an AI answer where the domain appears anywhere
 *               (domain target, search_scope "any": sources or search results)
 *  - citation = the domain appears among an answer's cited sources
 *               (domain target, search_scope "sources")
 *  - share of voice = your domain's monthly mentions vs competitors'
 *
 * Endpoints (all cached via ./cache, refresh bypasses):
 *  - llm_mentions/target_metrics/live         → totals + per-platform breakdown
 *  - llm_mentions/historical/live             → monthly series (sparks, deltas, SoV trend)
 *  - llm_mentions/top_mentioned_pages/live    → top cited pages per domain
 *  - llm_mentions/search_mentions/live        → the actual prompts surfacing the domain
 *  - ai_keyword_data/keywords_search_volume/live → AI search demand for the configured topics
 *
 * Not derivable from this source yet (listed in meta.unavailable): sentiment,
 * per-topic breakdown, and the Gemini/Perplexity/Claude platforms.
 */

import type {
  AiPrompt,
  AiTopic,
  AiVisibilityData,
  CitedPage,
  CompetitorPrompts,
  Kpi,
  PageCitation,
  TopicMentionRow,
} from "../types"
import { makeIgnoreMatcher, normalizeDomain } from "../settings"
import { cached } from "./cache"
import { DataForSeoError, dfsPost } from "./dataforseo"

/* ---------- minimal response shapes ---------- */

interface PlatformBucket {
  key?: string
  mentions?: number
  ai_search_volume?: number
}

interface TargetMetricsResult {
  aggregated_metrics?: {
    platform?: PlatformBucket[]
    total?: { mentions?: number; ai_search_volume?: number }
  }
}

interface HistoricalResult {
  items?: { year?: number; month?: number; metrics?: { mentions?: number; ai_search_volume?: number } }[]
}

interface TopPagesResult {
  items?: { page?: string; total?: { mentions?: number; ai_search_volume?: number } }[]
}

interface KeywordVolumeResult {
  items?: {
    keyword?: string
    ai_search_volume?: number
    ai_monthly_searches?: { year: number; month: number; ai_search_volume: number }[]
  }[]
}

interface NewLostResult {
  items?: { date?: string; new_mentions?: number; lost_mentions?: number }[]
}

interface SearchMentionItem {
  platform?: string
  model_name?: string
  question?: string
  sources?: { domain?: string; url?: string }[]
  ai_search_volume?: number
  last_response_at?: string
}

interface SearchMentionsResult {
  items?: SearchMentionItem[]
}

/* ------------------------------ helpers ------------------------------ */

/** The LLM Mentions database starts 2025-08-01. */
const DATASET_START = "2025-08-01"

interface MonthPoint {
  date: string // yyyy-mm-01
  mentions: number
}

function monthsOf(res: HistoricalResult | undefined): MonthPoint[] {
  return (res?.items ?? [])
    .filter((i) => i.year && i.month)
    .sort((a, b) => (a.year! - b.year!) || (a.month! - b.month!))
    .map((i) => ({
      date: `${i.year}-${String(i.month).padStart(2, "0")}-01`,
      mentions: i.metrics?.mentions ?? 0,
    }))
}

function kpiFrom(points: MonthPoint[], fallbackValue: number): Kpi {
  const spark = points.length ? points.map((p) => p.mentions) : [fallbackValue]
  const value = points.length ? spark[spark.length - 1] : fallbackValue
  const prev = spark.length > 1 ? spark[spark.length - 2] : 0
  const deltaPct = prev ? Math.round(((value - prev) / prev) * 1000) / 10 : 0
  return { value, deltaPct, spark: spark.slice(-12) }
}

function platformBuckets(res: TargetMetricsResult | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const b of res?.aggregated_metrics?.platform ?? []) {
    if (b.key) map.set(b.key, b.mentions ?? 0)
  }
  return map
}

function hostMatches(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    return host === domain || host.endsWith(`.${domain}`)
  } catch {
    return false
  }
}

function domainMatches(sourceDomain: string | undefined, domain: string): boolean {
  if (!sourceDomain) return false
  const host = sourceDomain.replace(/^www\./, "").toLowerCase()
  return host === domain || host.endsWith(`.${domain}`)
}

function trendDirection(series: number[]): "up" | "down" | "flat" {
  if (series.length < 4) return "flat"
  const head = series.slice(0, 3).reduce((a, b) => a + b, 0) / 3 || 1
  const tail = series.slice(-3).reduce((a, b) => a + b, 0) / 3
  const ratio = tail / head
  return ratio > 1.15 ? "up" : ratio < 0.85 ? "down" : "flat"
}

const PLATFORM_LABEL: Record<string, string> = { chat_gpt: "ChatGPT", google: "Google AIO" }

/** Whether an answer's cited sources include the given domain. */
function promptCites(item: SearchMentionItem, domain: string): boolean {
  return (item.sources ?? []).some(
    (s) => domainMatches(s.domain, domain) || (s.url ? hostMatches(s.url, domain) : false),
  )
}

/** Map a search_mentions item to an AiPrompt, with `cited` computed for `domain`. */
function toPrompt(item: SearchMentionItem, domain: string): AiPrompt {
  return {
    prompt: item.question!,
    platform: PLATFORM_LABEL[item.platform ?? ""] ?? item.model_name ?? item.platform ?? "AI",
    aiSearchVolume: item.ai_search_volume ?? 0,
    cited: promptCites(item, domain),
    lastSeen: item.last_response_at ?? null,
  }
}

/* ------------------------------ assembly ------------------------------ */

export interface AiVisibilityParams {
  domain: string
  competitors: string[]
  /** AI visibility topics from settings, drive the AI search demand table. */
  aiTopics: string[]
  location: string
  language: string
  /** Words that exclude an AI prompt/question everywhere (from settings). */
  ignoredTerms?: string[]
  /** Cache TTL in hours (from the snapshot cadence). */
  ttlHours?: number
  refresh?: boolean
}

export interface AiVisibilityOutcome {
  data: AiVisibilityData | null
  /** Shown in the AI tab when data is null (upstream error / subscription gap). */
  message?: string
  unavailable: string[]
}

export async function buildAiVisibility(p: AiVisibilityParams): Promise<AiVisibilityOutcome> {
  const common = { location_name: p.location, language_name: p.language }
  const dateRange = { date_from: DATASET_START, date_to: new Date().toISOString().slice(0, 10) }
  const bypass = { bypass: p.refresh, ttlHours: p.ttlHours }
  // Defensive: pasted URLs become bare domains, the only form the API accepts.
  const primaryDomain = normalizeDomain(p.domain)
  const domains = [primaryDomain, ...p.competitors.map(normalizeDomain).filter(Boolean)].slice(0, 6)

  const domainTarget = (d: string, scope?: string[]) => [
    { domain: d, include_subdomains: true, ...(scope ? { search_scope: scope } : {}) },
  ]

  const call = <T,>(path: string, body: Record<string, unknown>) =>
    cached(path, body, () => dfsPost<T>(path, body), bypass)

  try {
    const TM = "/v3/ai_optimization/llm_mentions/target_metrics/live"
    const HIST = "/v3/ai_optimization/llm_mentions/historical/live"
    const PAGES = "/v3/ai_optimization/llm_mentions/top_mentioned_pages/live"
    const SEARCH = "/v3/ai_optimization/llm_mentions/search_mentions/live"
    const NEW_LOST = "/v3/ai_optimization/llm_mentions/timeseries_new_lost/live"
    const KW_VOLUME = "/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live"

    const topicKeywords = p.aiTopics.map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 25)
    const competitorDomains = domains.slice(1)
    // Topic × domain intersections are one call each, cap topics to contain cost.
    const intersectTopics = topicKeywords.slice(0, 5)
    const topicPairs = intersectTopics.flatMap((topic) => domains.map((d) => ({ topic, domain: d })))

    const [
      mentionsNow,
      citationsNow,
      citationsHist,
      pagesPerDomain,
      sovHists,
      promptsRes,
      topicVolumesRes,
      competitorPromptsRes,
      newLostRes,
      topicPairMetrics,
      citationMentionsRes,
      competitorCitationsRes,
    ] =
      await Promise.all([
        call<TargetMetricsResult>(TM, { ...common, target: domainTarget(primaryDomain) }),
        call<TargetMetricsResult>(TM, { ...common, target: domainTarget(primaryDomain, ["sources"]) }),
        call<HistoricalResult>(HIST, { ...common, ...dateRange, target: domainTarget(primaryDomain, ["sources"]) }),
        Promise.all(
          domains.map((d) =>
            call<TopPagesResult>(PAGES, {
              ...common,
              target: domainTarget(d, ["sources"]),
              links_scope: "sources",
              limit: 100,
            }),
          ),
        ),
        // One monthly series per domain (yours + competitors): share of voice,
        // and the first one doubles as the mentions trend for your domain.
        Promise.all(
          domains.map((d) => call<HistoricalResult>(HIST, { ...common, ...dateRange, target: domainTarget(d) })),
        ),
        // The actual prompts whose AI answers surface the domain (both platforms).
        call<SearchMentionsResult>(SEARCH, {
          ...common,
          target: domainTarget(primaryDomain),
          order_by: ["ai_search_volume,desc"],
          limit: 20,
        }),
        // AI search demand for the configured topics (single batched call).
        topicKeywords.length
          ? call<KeywordVolumeResult>(KW_VOLUME, { ...common, keywords: topicKeywords })
          : Promise.resolve(null),
        // The prompts whose AI answers surface each competitor (one call each),
        // so we can show the top prompts each competitor is cited in.
        Promise.all(
          competitorDomains.map((d) =>
            call<SearchMentionsResult>(SEARCH, {
              ...common,
              target: domainTarget(d),
              order_by: ["ai_search_volume,desc"],
              limit: 20,
            }),
          ),
        ),
        // Monthly new vs lost mentions for your domain (momentum signal).
        // Degrades to null instead of failing the whole report.
        call<NewLostResult>(NEW_LOST, {
          ...common,
          ...dateRange,
          group_range: "month",
          target: domainTarget(primaryDomain),
        }).catch(() => null),
        // Mentions per (topic, domain): the target array intersects a domain
        // entity with a keyword entity, giving "mentions of this domain in
        // answers about this topic". One call per pair, degrading per-pair.
        Promise.all(
          topicPairs.map(({ topic, domain: d }) =>
            call<TargetMetricsResult>(TM, {
              ...common,
              target: [
                { domain: d, include_subdomains: true },
                { keyword: topic, match_type: "partial_match", search_scope: ["question", "answer", "fan_out_queries"] },
              ],
            }).catch(() => null),
          ),
        ),
        // The questions whose answers cite YOUR pages as sources, joined to
        // the top-cited-pages rows so each page can list its actual citations.
        call<SearchMentionsResult>(SEARCH, {
          ...common,
          target: domainTarget(primaryDomain, ["sources"]),
          order_by: ["ai_search_volume,desc"],
          limit: 100,
        }).catch(() => null),
        // Citations per competitor (sources scope), powers the "vs competitor
        // average" benchmark on the hero cards.
        Promise.all(
          competitorDomains.map((d) =>
            call<TargetMetricsResult>(TM, { ...common, target: domainTarget(d, ["sources"]) }).catch(() => null),
          ),
        ),
      ])

    /* ---- KPIs ---- */
    const mentionsTotal = mentionsNow.data[0]?.aggregated_metrics?.total?.mentions ?? 0
    const citationsTotal = citationsNow.data[0]?.aggregated_metrics?.total?.mentions ?? 0
    const mentionsMonths = monthsOf(sovHists[0]?.data[0])
    const citationsMonths = monthsOf(citationsHist.data[0])

    const mentionsKpi = kpiFrom(mentionsMonths, mentionsTotal)
    const citationsKpi = kpiFrom(citationsMonths, citationsTotal)

    const rateSeries: MonthPoint[] = mentionsMonths.map((m) => {
      const cited = citationsMonths.find((c) => c.date === m.date)?.mentions ?? 0
      return { date: m.date, mentions: m.mentions ? Math.round((cited / m.mentions) * 100) : 0 }
    })
    const currentRate = mentionsTotal ? Math.round((citationsTotal / mentionsTotal) * 100) : 0
    const citationRateKpi = kpiFrom(rateSeries, currentRate)

    /* ---- share of voice (domain mentions, monthly) ---- */
    const sovByDomain = domains.map((d, i) => ({ domain: d, months: monthsOf(sovHists[i]?.data[0]) }))
    const allDates = [...new Set(sovByDomain.flatMap((s) => s.months.map((m) => m.date)))].sort()
    const shareOfVoiceTrend = allDates.map((date) => {
      const row: { date: string; [k: string]: number | string } = { date }
      const totals = sovByDomain.map((s) => s.months.find((m) => m.date === date)?.mentions ?? 0)
      const sum = totals.reduce((a, b) => a + b, 0)
      sovByDomain.forEach((s, i) => {
        row[s.domain] = sum ? Math.round((totals[i] / sum) * 1000) / 10 : 0
      })
      return row
    })
    const sovSeries: MonthPoint[] = shareOfVoiceTrend.map((r) => ({
      date: r.date as string,
      mentions: (r[primaryDomain] as number) ?? 0,
    }))
    const shareOfVoiceKpi = kpiFrom(sovSeries, 0)

    /* ---- by model (platforms present in the mentions database) ---- */
    const mentionsByPlatform = platformBuckets(mentionsNow.data[0])
    const citationsByPlatform = platformBuckets(citationsNow.data[0])
    const byModel = (Object.entries(PLATFORM_LABEL) as [string, "ChatGPT" | "Google AIO"][])
      .filter(([key]) => mentionsByPlatform.has(key) || citationsByPlatform.has(key))
      .map(([key, model]) => ({
        model,
        mentions: mentionsByPlatform.get(key) ?? 0,
        citations: citationsByPlatform.get(key) ?? 0,
      }))

    /* ---- AI search demand for the configured topics ---- */
    const topics: AiTopic[] = (topicVolumesRes?.data[0]?.items ?? [])
      .filter((i) => i.keyword)
      .map((i) => {
        const trend12mo = (i.ai_monthly_searches ?? [])
          .slice()
          .sort((a, b) => a.year - b.year || a.month - b.month)
          .map((m) => m.ai_search_volume)
          .slice(-12)
        return {
          topic: i.keyword!,
          aiSearchVolume: i.ai_search_volume ?? 0,
          trend12mo,
          trendDirection: trendDirection(trend12mo),
        }
      })
      .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume)

    /* ---- prompts whose AI answers surface the domain ---- */
    // The ignore list from settings drops questions before any list sees them.
    const isIgnored = makeIgnoreMatcher(p.ignoredTerms ?? [])
    const prompts: AiPrompt[] = (promptsRes.data[0]?.items ?? [])
      .filter((i) => i.question && !isIgnored(i.question))
      .map((i) => toPrompt(i, primaryDomain))
      .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume)
      .slice(0, 12)

    /* ---- top prompts each competitor is cited in (top 5 by AI search volume) ---- */
    const competitorPrompts: CompetitorPrompts[] = competitorPromptsRes
      .map((res, i) => {
        const d = competitorDomains[i]
        const cited = (res.data[0]?.items ?? [])
          .filter((it) => it.question && !isIgnored(it.question) && promptCites(it, d))
          .map((it) => ({ ...toPrompt(it, d), cited: true }))
          .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume)
          .slice(0, 5)
        return { competitor: d, prompts: cited }
      })
      .filter((c) => c.prompts.length > 0)

    /* ---- cited pages: your top 20, and top 10 per competitor ---- */

    // URL key for joining a top_mentioned_pages row to search-mention sources:
    // protocol/www/fragment/trailing-slash insensitive.
    const urlKey = (u: string) =>
      u.replace(/^https?:\/\//, "").replace(/^www\./, "").split("#")[0].replace(/\/+$/, "").toLowerCase()

    /** url → the questions whose answers cite that url, from search-mention items. */
    const citationLookup = (items: SearchMentionItem[] | undefined): Map<string, PageCitation[]> => {
      const map = new Map<string, PageCitation[]>()
      for (const item of items ?? []) {
        if (!item.question || isIgnored(item.question)) continue
        for (const s of item.sources ?? []) {
          if (!s.url) continue
          const key = urlKey(s.url)
          const list = map.get(key) ?? []
          if (list.some((c) => c.prompt === item.question)) continue
          list.push({
            prompt: item.question,
            platform: PLATFORM_LABEL[item.platform ?? ""] ?? item.model_name ?? item.platform ?? "AI",
            aiSearchVolume: item.ai_search_volume ?? 0,
            lastSeen: item.last_response_at ?? null,
          })
          map.set(key, list)
        }
      }
      return map
    }

    // Your pages join against the dedicated sources-scope call (100 mentions);
    // competitor pages reuse the per-competitor mention calls already made.
    const detailByDomainIndex = [
      citationLookup(citationMentionsRes?.data[0]?.items),
      ...competitorDomains.map((_, i) => citationLookup(competitorPromptsRes[i]?.data[0]?.items)),
    ]

    const citedPagesOf = (i: number, limit: number): CitedPage[] =>
      (pagesPerDomain[i]?.data[0]?.items ?? [])
        .filter((item) => item.page && hostMatches(item.page, domains[i]))
        .sort((a, b) => (b.total?.mentions ?? 0) - (a.total?.mentions ?? 0))
        .slice(0, limit)
        .map((item) => ({
          url: item.page!,
          citations: item.total?.mentions ?? 0,
          aiSearchVolume: item.total?.ai_search_volume ?? null,
          citationDetails: (detailByDomainIndex[i]?.get(urlKey(item.page!)) ?? [])
            .sort((a, b) => b.aiSearchVolume - a.aiSearchVolume)
            .slice(0, 6),
        }))

    const ownedCitedPages = citedPagesOf(0, 20)
    const competitorCitedPages = domains
      .slice(1)
      .map((d, idx) => ({ competitor: d, pages: citedPagesOf(idx + 1, 10) }))
      .filter((c) => c.pages.length > 0)

    /* ---- monthly new vs lost mentions (momentum) ---- */
    const newLostTrend = (newLostRes?.data[0]?.items ?? [])
      .filter((i) => i.date)
      .sort((a, b) => a.date!.localeCompare(b.date!))
      .map((i) => ({
        date: i.date!.slice(0, 10),
        newMentions: i.new_mentions ?? 0,
        lostMentions: i.lost_mentions ?? 0,
      }))

    /* ---- mentions by topic: you vs competitors within each topic's answers ---- */
    const topicVolumeByKeyword = new Map(
      (topicVolumesRes?.data[0]?.items ?? [])
        .filter((i) => i.keyword)
        .map((i) => [i.keyword!.toLowerCase(), i.ai_search_volume ?? null] as const),
    )
    const topicMentions: TopicMentionRow[] = intersectTopics
      .map((topic) => {
        const mentionsFor = (d: string) => {
          const idx = topicPairs.findIndex((pair) => pair.topic === topic && pair.domain === d)
          return topicPairMetrics[idx]?.data[0]?.aggregated_metrics?.total?.mentions ?? 0
        }
        const yourMentions = mentionsFor(primaryDomain)
        const perCompetitor = competitorDomains
          .map((d) => ({ domain: d, mentions: mentionsFor(d) }))
          .sort((a, b) => b.mentions - a.mentions)
        const top = perCompetitor[0]
        return {
          topic,
          yourMentions,
          aiSearchVolume: topicVolumeByKeyword.get(topic) ?? null,
          topCompetitor: top && top.mentions > 0 ? top.domain : null,
          topCompetitorMentions: top?.mentions ?? 0,
        }
      })
      .filter((r) => r.yourMentions > 0 || r.topCompetitorMentions > 0)
      .sort((a, b) => b.yourMentions + b.topCompetitorMentions - (a.yourMentions + a.topCompetitorMentions))

    /* ---- competitor benchmark: average monthly mentions & citations ---- */
    const competitorBenchmark = competitorDomains.length
      ? {
          mentionsAvg: Math.round(
            competitorDomains.reduce((sum, _, i) => {
              const months = sovByDomain[i + 1]?.months ?? []
              return sum + (months[months.length - 1]?.mentions ?? 0)
            }, 0) / competitorDomains.length,
          ),
          citationsAvg: Math.round(
            competitorCitationsRes.reduce(
              (sum, res) => sum + (res?.data[0]?.aggregated_metrics?.total?.mentions ?? 0),
              0,
            ) / competitorDomains.length,
          ),
          competitors: competitorDomains.length,
        }
      : null

    const data: AiVisibilityData = {
      kpis: {
        mentions: mentionsKpi,
        citations: citationsKpi,
        citationRatePct: citationRateKpi,
        shareOfVoicePct: shareOfVoiceKpi,
      },
      byModel,
      shareOfVoiceTrend,
      ownedCitedPages,
      competitorCitedPages,
      newLostTrend,
      topicMentions,
      competitorBenchmark,
      topics,
      prompts,
      competitorPrompts,
      sentiment: { positive: 0, neutral: 0, negative: 0 }, // not provided by this source
    }

    // Per-topic mentions and Gemini/Claude/Perplexity coverage were once here —
    // topic intersections and the prompt runs now provide both.
    return {
      data,
      unavailable: ["Sentiment analysis"],
    }
  } catch (e) {
    // AI visibility must never take down the rest of the report.
    const message =
      e instanceof DataForSeoError
        ? `AI visibility data could not be loaded: ${e.message}`
        : "AI visibility data could not be loaded from the data provider."
    return { data: null, message, unavailable: [] }
  }
}
