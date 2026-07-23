export interface Snapshot {
  date: string // ISO date, weekly
}

export interface Kpi {
  value: number
  deltaPct: number
  spark: number[]
}

export interface Mover {
  keyword: string
  from: number
  to: number
  volume: number
}

export interface OverviewData {
  kpis: {
    traffic: Kpi
    rankedKeywords: Kpi
    /** Null when the live data source can't provide it (card is hidden). */
    referringDomains: Kpi | null
    siteHealth: Kpi | null
    aiMentions30d: Kpi | null
  }
  positionDistribution: {
    top3: number
    p4to10: number
    p11to20: number
    p21plus: number
    deltas: Record<string, number>
  }
  movers: { gains: Mover[]; losses: Mover[] }
  alerts: { decayingPages: number; lostAiCitations: number; crawlIssues: number }
  trafficTrend: { date: string; traffic: number }[]
}

export type AiModel = "ChatGPT" | "Gemini" | "Perplexity" | "Claude" | "Google AIO"

/** Mentions within AI answers about one configured topic: you vs competitors. */
export interface TopicMentionRow {
  topic: string
  /** Mentions of your domain in answers about this topic. */
  yourMentions: number
  /** Monthly AI search volume for the topic; null when unknown. */
  aiSearchVolume: number | null
  /** Competitor with the most mentions in answers about this topic. */
  topCompetitor: string | null
  topCompetitorMentions: number
}

/** One concrete citation of a page: the question whose AI answer cited it. */
export interface PageCitation {
  prompt: string
  platform: string // "ChatGPT" | "Google AIO"
  aiSearchVolume: number
  lastSeen: string | null // ISO
}

/** A page cited as a source in AI answers (llm_mentions top_mentioned_pages). */
export interface CitedPage {
  url: string
  /** Times the page appears among an answer's cited sources. */
  citations: number
  /** AI search demand associated with the answers citing it; null when unknown. */
  aiSearchVolume: number | null
  /** The specific questions whose answers cite this page (up to 6, by volume). */
  citationDetails: PageCitation[]
}

export interface AiVisibilityData {
  kpis: {
    mentions: Kpi
    citations: Kpi
    citationRatePct: Kpi
    shareOfVoicePct: Kpi
  }
  byModel: { model: AiModel; mentions: number; citations: number }[]
  shareOfVoiceTrend: { date: string; [brandOrCompetitor: string]: number | string }[]
  /** Your most-cited pages in AI answers (top 20). */
  ownedCitedPages: CitedPage[]
  /** Each tracked competitor's most-cited pages (top 10 per competitor). */
  competitorCitedPages: { competitor: string; pages: CitedPage[] }[]
  /** Monthly new vs lost AI mentions for your domain (timeseries_new_lost). */
  newLostTrend: { date: string; newMentions: number; lostMentions: number }[]
  /** Per configured AI topic: mentions of you vs competitors in answers about it. */
  topicMentions: TopicMentionRow[]
  /** Average monthly mentions/citations across tracked competitors; null when none tracked. */
  competitorBenchmark: { mentionsAvg: number; citationsAvg: number; competitors: number } | null
  /** AI search demand for the configured AI topics (ai_keyword_data). */
  topics: AiTopic[]
  /** Actual prompts/questions whose AI answers surface the domain (search_mentions). */
  prompts: AiPrompt[]
  /** Per tracked competitor: the prompts whose AI answers cite that competitor most. */
  competitorPrompts: CompetitorPrompts[]
  sentiment: { positive: number; neutral: number; negative: number }
}

export interface CompetitorPrompts {
  /** Competitor domain, e.g. "contoso.com". */
  competitor: string
  /** Top prompts (by AI search volume) whose answers cite this competitor as a source. */
  prompts: AiPrompt[]
}

export interface AiTopic {
  topic: string
  aiSearchVolume: number
  /** Monthly AI search volumes, oldest → newest (up to 12). */
  trend12mo: number[]
  trendDirection: "up" | "down" | "flat"
}

export interface AiPrompt {
  /** The question users ask the AI assistant (verbatim from the mentions data). */
  prompt: string
  platform: string // "ChatGPT" | "Google AIO"
  aiSearchVolume: number
  /** True when one of your pages is cited as a source in the answer. */
  cited: boolean
  /** When this prompt's answer was last observed (ISO), if known. */
  lastSeen: string | null
}

/* ---------------- Topics & Prompts (live LLM responses) ---------------- */

/** The AI assistants each prompt is run through (llm_responses live endpoints). */
export type AiPlatform = "ChatGPT" | "Claude" | "Gemini" | "Perplexity"

/** Domain used for the platform's logo (logo.dev). */
export const AI_PLATFORM_DOMAIN: Record<AiPlatform, string> = {
  ChatGPT: "openai.com",
  Claude: "anthropic.com",
  Gemini: "gemini.google.com",
  Perplexity: "perplexity.ai",
}

/** One platform's answer to one prompt, reduced to brand-presence facts. */
export interface PromptPlatformPresence {
  platform: AiPlatform
  /** Times a brand alias (or your domain) appears in this platform's answer. */
  brandMentions: number
  /** True when one of your pages is cited as a source in the answer. */
  brandCited: boolean
  /** True when the platform call failed, excluded from aggregates. */
  error?: boolean
}

/** You + each competitor, ranked by presence across all platform answers. */
export interface PromptEntityRank {
  name: string
  isYou: boolean
  mentions: number
  citations: number
}

/** A quote from an AI answer where a tracked brand is mentioned. */
export interface PromptMentionSnippet {
  text: string
  entity: string
  platform: AiPlatform
}

export interface PromptCitedSource {
  domain: string
  url: string
  /** Citations across all platform answers for this prompt. */
  count: number
  owner: "yours" | "competitor" | "other"
}

/** Everything we learned from running one configured prompt across the platforms. */
export interface PromptInsight {
  prompt: string
  platforms: PromptPlatformPresence[]
  /** Share of platform answers that mention your brand (0–100). */
  visibilityPct: number
  brandMentionsTotal: number
  brandCitationsTotal: number
  /** You + competitors, best presence first. */
  ranking: PromptEntityRank[]
  /** Up to 3 quotes showing how tracked brands come up in the answers. */
  topMentions: PromptMentionSnippet[]
  /** Up to 5 most-cited sources across the answers. */
  topSources: PromptCitedSource[]
  /** One actionable next step derived from the numbers above. */
  recommendation: string
}

/** A cited page grouped under a topic, what "winning content" looks like. */
export interface TopicSourceLink {
  url: string
  domain: string
  /** Citations of this page across the topic's answers. */
  count: number
}

/** A topic derived from the AI answers themselves (n-grams + fan-out queries). */
export interface DerivedTopic {
  topic: string
  /** Monthly AI search volume for the topic (ai_keyword_data); null when unknown. */
  aiSearchVolume: number | null
  /** Share of all AI answers that touch this topic (0–100). */
  presencePct: number
  /** Share of answers touching this topic that mention your brand (0–100). */
  brandPresencePct: number
  /** Citations of your pages in answers touching this topic. */
  citations: number
  /** Historical trend; empty in live mode until snapshots accumulate (hidden). */
  trend: number[]
  /** Competitor with the most mentions in answers touching this topic. */
  topCompetitor: string | null
  competitorMentions: number
  /** Your most-cited pages in answers touching this topic (up to 3). */
  yourTopSources: TopicSourceLink[]
  /** The top competitor's most-cited pages in those answers (up to 3). */
  competitorTopSources: TopicSourceLink[]
}

/** Per-assistant totals across all prompt answers, who wins each assistant. */
export interface AssistantSummary {
  platform: AiPlatform
  yourMentions: number
  yourCitations: number
  /** Most-mentioned tracked entity in this assistant's answers (you or a competitor). */
  leader: string | null
  leaderIsYou: boolean
  leaderMentions: number
}

export interface PromptInsightsData {
  prompts: PromptInsight[]
  topics: DerivedTopic[]
  /** Aggregated per assistant across all prompts. */
  byAssistant: AssistantSummary[]
  fetchedAt: string // ISO
  /** True when every underlying LLM call was served from the server cache. */
  cached: boolean
  /** Sections/metrics this source can't provide (mirrors ReportMeta.unavailable). */
  unavailable: string[]
}

export type SerpFeature = "featured_snippet" | "aio" | "aio_cited" | "paa"
export type KeywordSegment = "new" | "lost" | "improved" | "declined" | "stable"

export interface KeywordRow {
  keyword: string
  position: number
  delta: number
  volume: number
  /** Null when the live data source can't provide AI search volume. */
  aiVolume: number | null
  estTraffic: number
  url: string
  serpFeatures: SerpFeature[]
  segment: KeywordSegment
  strikingDistance: boolean
}

export interface KeywordGapRow {
  keyword: string
  volume: number
  competitor: string
  competitorPosition: number
  difficulty: "low" | "medium" | "high"
}

export interface DecayingPage {
  path: string
  trafficDelta: number
  /** Empty when no per-page history is available (trend chart is hidden). */
  trafficSpark: number[]
  keywordsLost: { keyword: string; from: number; to: number }[]
  aiCitationsDelta: number
  aiCitationsLost: { topic: string; model: string }[]
  /** Null when the CMS edit date isn't known (pill is hidden). */
  lastEditedMonthsAgo: number | null
  uniformEditUrl: string
}

export type SuggestionAlgorithm = "related" | "contains_phrase" | "same_topic" | "from_site"

export interface KeywordSuggestion {
  keyword: string
  volume: number
  aiVolume: number | null
  trend12mo: number[] // 12 monthly values
  trendDirection: "up" | "down" | "flat"
  cpc: number // USD
  competition: number // 0..1
  categories: string[]
  alreadyTracked: boolean
}

export interface SuggestionSearchState {
  seed: string
  algorithm: SuggestionAlgorithm
  depth?: 1 | 2 | 3 // related only
  location: string // "United States"
  language: string // "English"
  results: KeywordSuggestion[]
  searchedAt: string // ISO
}

/** One inbound link (backlinks/backlinks live endpoint). */
export interface Backlink {
  urlFrom: string
  urlTo: string
  anchor: string | null
  /** DataForSEO rank of the linking page (0–1000). */
  rank: number
  dofollow: boolean
  firstSeen: string | null // ISO
}

export interface DashboardData {
  domain: string
  country: string
  language: string
  lastSnapshot: string
  overview: OverviewData
  /** Null when AI visibility isn't wired to a live data source yet. */
  aiVisibility: AiVisibilityData | null
  keywords: KeywordRow[]
  keywordGaps: KeywordGapRow[]
  decayingPages: DecayingPage[]
  keywordSuggestions: SuggestionSearchState
  /** Top inbound links by page rank (empty when the backlinks API isn't subscribed). */
  backlinks: Backlink[]
}

/** Metadata returned alongside a live report from the API proxy. */
export interface ReportMeta {
  source: "dataforseo"
  fetchedAt: string // ISO
  /** True when every upstream call was served from the server-side cache. */
  cached: boolean
  /** Human-readable names of sections/metrics not yet wired to live data. */
  unavailable: string[]
  /** Why aiVisibility is null (setup guidance or upstream error), when it is. */
  aiVisibilityMessage?: string
}

export interface ReportResponse {
  data: DashboardData
  meta: ReportMeta
}
