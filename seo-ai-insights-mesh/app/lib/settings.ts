/**
 * Integration-level settings for the SEO & AI Insights Mesh integration.
 *
 * These are stored via the Mesh `settings` location (`useMeshLocation('settings').setValue`)
 * and are readable from every other location through `metadata.settings`, which is how
 * the project tool dashboard picks up the configured domain, brands, and tracked lists.
 *
 * Note: DataForSEO credentials intentionally do NOT live here (or anywhere client
 * side). They are server env vars read by the /api proxy routes, see
 * app/lib/server/dataforseo.ts and .env.local.example. Long term they move to a
 * Uniform-operated backend so customers never handle them at all.
 */

export interface IntegrationSettings {
  /** Primary domain to analyze, e.g. "acme.com" (no protocol). */
  targetDomain: string
  /** Brand names and aliases matched in LLM mentions, e.g. ["Acme", "Acme Corp"]. */
  brandAliases: string[]
  /** Competitor domains for share-of-voice and keyword gap (max 5). */
  competitors: string[]
  /** Keywords included in snapshot rank tracking (max 200). */
  trackedKeywords: string[]
  /** Topics tracked for AI visibility / LLM mentions (max 25). */
  aiTopics: string[]
  /**
   * Prompts run through the AI assistants (ChatGPT, Claude, Gemini, Perplexity)
   * for the Topics & Prompts tab (max 10). Empty = auto-generated from brand
   * aliases, AI topics, and competitors via generateDefaultPrompts().
   */
  aiPrompts: string[]
  /**
   * Words that exclude a keyword or AI prompt everywhere it would appear,
   * e.g. "jobs", "careers", or brand misspellings (max 50).
   */
  ignoredTerms: string[]
  /** DataForSEO location name, e.g. "United States". */
  location: string
  /** DataForSEO language name, e.g. "English". */
  language: string
  /** How often scheduled snapshots run. */
  snapshotCadence: "weekly" | "biweekly"
}

export const MAX_COMPETITORS = 5
export const MAX_TRACKED_KEYWORDS = 200
export const MAX_AI_TOPICS = 25
export const MAX_AI_PROMPTS = 10
export const MAX_IGNORED_TERMS = 50

export const DEFAULT_SETTINGS: IntegrationSettings = {
  targetDomain: "",
  brandAliases: [],
  competitors: [],
  trackedKeywords: [],
  aiTopics: [],
  aiPrompts: [],
  ignoredTerms: [],
  location: "United States",
  language: "English",
  snapshotCadence: "weekly",
}

export const LOCATION_OPTIONS = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "Denmark",
  "Sweden",
  "Norway",
  "Spain",
  "Italy",
  "Japan",
]

/**
 * Default language per market, DataForSEO Labs rejects location/language
 * combinations that don't exist (e.g. Denmark + English), so exploring a
 * different market switches to that market's language automatically.
 */
export const LOCATION_DEFAULT_LANGUAGE: Record<string, string> = {
  "United States": "English",
  "United Kingdom": "English",
  Canada: "English",
  Australia: "English",
  Germany: "German",
  France: "French",
  Netherlands: "Dutch",
  Denmark: "Danish",
  Sweden: "Swedish",
  Norway: "Norwegian",
  Spain: "Spanish",
  Italy: "Italian",
  Japan: "Japanese",
}

export const LANGUAGE_OPTIONS = [
  "English",
  "German",
  "French",
  "Dutch",
  "Danish",
  "Swedish",
  "Norwegian",
  "Spanish",
  "Italian",
  "Japanese",
]

/**
 * Rough share of the monthly credit allowance consumed by scheduled snapshots for a
 * given configuration. Used to show a qualitative usage indicator in settings without
 * surfacing raw prices. Mirrors the backend cost model: AI topics dominate, keywords
 * and competitors contribute modestly, and bi-weekly cadence halves recurring usage.
 */
export function estimateSnapshotLoad(s: IntegrationSettings): {
  pct: number
  level: "light" | "moderate" | "heavy" | "over"
} {
  const topicUnits = s.aiTopics.length * 3.6
  const keywordUnits = s.trackedKeywords.length * 0.05
  const competitorUnits = s.competitors.length * 1.2
  // Each prompt fans out to four live LLM responses (ChatGPT/Claude/Gemini/Perplexity).
  const promptUnits = effectiveAiPrompts(s).length * 1.4
  const baseUnits = s.targetDomain ? 4 : 0
  const cadenceFactor = s.snapshotCadence === "biweekly" ? 0.5 : 1
  const pct = Math.round((topicUnits + keywordUnits + competitorUnits + promptUnits + baseUnits) * cadenceFactor)
  const level = pct > 100 ? "over" : pct > 80 ? "heavy" : pct > 45 ? "moderate" : "light"
  return { pct: Math.min(pct, 120), level }
}

/**
 * Normalize any domain-ish input ("https://www.huhtamaki.com/", "Duni.com/en")
 * to a bare domain ("huhtamaki.com"). The data provider rejects anything else,
 * so this runs both on settings input and defensively on the server.
 */
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0]
    .replace(/\.+$/, "")
}

/** "contoso.com" → "Contoso", competitor display name for generated prompts. */
export function competitorName(domain: string): string {
  const label = domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split(".")[0] ?? ""
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : domain
}

/**
 * Default prompts for the Topics & Prompts tab, generated from the configured
 * AI topics, brand aliases, and competitors (in this template order, capped at
 * MAX_AI_PROMPTS). Users can edit the generated list in settings.
 */
export function generateDefaultPrompts(s: Pick<IntegrationSettings, "brandAliases" | "aiTopics" | "competitors">): string[] {
  const out: string[] = []
  const push = (p: string) => {
    if (out.length < MAX_AI_PROMPTS && !out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p)
  }
  for (const topic of s.aiTopics.slice(0, 2)) {
    const t = topic.trim()
    if (!t) continue
    push(`Solutions for ${t}`)
    push(`Best options for ${t}`)
    push(`What is ${t}?`)
  }
  const brand = s.brandAliases.map((b) => b.trim()).find(Boolean)
  if (brand) {
    push(`Alternatives for ${brand}`)
    push(`Experience with ${brand}`)
    for (const c of s.competitors.slice(0, 2)) {
      if (c.trim()) push(`${brand} vs. ${competitorName(c)}`)
    }
  }
  return out
}

/** The prompts actually run: the user's list, or generated defaults when empty. */
export function effectiveAiPrompts(s: IntegrationSettings): string[] {
  const custom = s.aiPrompts.map((p) => p.trim()).filter(Boolean)
  return (custom.length ? custom : generateDefaultPrompts(s)).slice(0, MAX_AI_PROMPTS)
}

/** Type guard used when reading `metadata.settings` from non-settings locations. */
export function isIntegrationSettings(v: unknown): v is Partial<IntegrationSettings> {
  return typeof v === "object" && v !== null
}

/** Merge possibly-partial stored settings over defaults. */
export function withDefaults(v: unknown): IntegrationSettings {
  if (!isIntegrationSettings(v)) return DEFAULT_SETTINGS
  return {
    ...DEFAULT_SETTINGS,
    ...v,
    brandAliases: Array.isArray(v.brandAliases) ? v.brandAliases : [],
    competitors: Array.isArray(v.competitors) ? v.competitors : [],
    trackedKeywords: Array.isArray(v.trackedKeywords) ? v.trackedKeywords : [],
    aiTopics: Array.isArray(v.aiTopics) ? v.aiTopics : [],
    aiPrompts: Array.isArray(v.aiPrompts) ? v.aiPrompts : [],
    ignoredTerms: Array.isArray(v.ignoredTerms) ? v.ignoredTerms : [],
  }
}

/**
 * Word-boundary matcher for the ignore list: "jobs" excludes "uniform jobs"
 * but not "jobsite". Case-insensitive; multi-word terms match as phrases.
 * Returns a function usable on keywords, prompts, and questions.
 */
export function makeIgnoreMatcher(terms: string[]): (text: string) => boolean {
  const patterns = terms
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)
    .map((t) => new RegExp(`(^|[^\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu"))
  if (!patterns.length) return () => false
  return (text: string) => patterns.some((re) => re.test(text))
}
