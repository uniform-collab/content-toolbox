/**
 * Topics & Prompts: run the configured prompts through the AI assistants via
 * DataForSEO's AI Optimization → LLM Responses live endpoints, then reduce the
 * raw answers to brand-presence insights.
 *
 * Endpoints (one call per prompt × platform, all cached via ./cache):
 *  - /v3/ai_optimization/chat_gpt/llm_responses/live    (gpt-4.1-mini, web_search)
 *  - /v3/ai_optimization/claude/llm_responses/live      (claude-sonnet-4-0, web_search)
 *  - /v3/ai_optimization/gemini/llm_responses/live      (gemini-2.5-flash, web_search)
 *  - /v3/ai_optimization/perplexity/llm_responses/live  (sonar, web search built in)
 *
 * From each answer we extract:
 *  - mentions of the brand (aliases + domain) and each competitor
 *  - citations (the answer's annotated sources) grouped by domain
 *  - quote snippets around brand/competitor mentions
 *
 * Topic derivation: llm_responses caps user_prompt at 500 chars, so we can't
 * feed the answers back through an LLM for summarization. Instead topics are
 * derived from the AI output we already have: the models' own fan-out queries
 * (the related searches they ran) plus recurring phrases across the answers,
 * scored by how many answers touch them. Configured AI topics that appear in
 * answers are always considered.
 *
 * Failure policy: a single platform call failing marks that platform errored
 * for that prompt and is excluded from aggregates, it never fails the tab.
 */

import type {
  AiPlatform,
  AssistantSummary,
  DerivedTopic,
  PromptCitedSource,
  PromptEntityRank,
  PromptInsight,
  PromptInsightsData,
  PromptMentionSnippet,
  PromptPlatformPresence,
  TopicSourceLink,
} from "../types"
import { cached } from "./cache"
import { dfsPost } from "./dataforseo"

/* ------------------------- platform definitions ------------------------- */

interface PlatformDef {
  platform: AiPlatform
  path: string
  body: (prompt: string, countryIso?: string) => Record<string, unknown>
}

/*
 * Models mirror what each consumer assistant runs (checked against each
 * endpoint's /models catalog, the docs lag behind it):
 *   ChatGPT    → gpt-5.3-chat-latest (the ChatGPT-aligned model line)
 *   Claude     → claude-sonnet-4-6   (claude.ai default tier)
 *   Gemini     → gemini-3.5-flash    (Gemini app default tier)
 *   Perplexity → sonar               (Perplexity default, web search built in)
 */
const PLATFORMS: PlatformDef[] = [
  {
    platform: "ChatGPT",
    path: "/v3/ai_optimization/chat_gpt/llm_responses/live",
    body: (user_prompt, iso) => ({
      user_prompt,
      model_name: "gpt-5.3-chat-latest",
      max_output_tokens: 1024,
      web_search: true,
      ...(iso ? { web_search_country_iso_code: iso } : {}),
    }),
  },
  {
    platform: "Claude",
    path: "/v3/ai_optimization/claude/llm_responses/live",
    body: (user_prompt, iso) => ({
      user_prompt,
      model_name: "claude-sonnet-4-6",
      max_output_tokens: 1024,
      web_search: true,
      ...(iso ? { web_search_country_iso_code: iso } : {}),
    }),
  },
  {
    platform: "Gemini",
    path: "/v3/ai_optimization/gemini/llm_responses/live",
    // Gemini's endpoint rejects web_search_country_iso_code (40501).
    body: (user_prompt) => ({
      user_prompt,
      model_name: "gemini-3.5-flash",
      max_output_tokens: 1024,
      web_search: true,
    }),
  },
  {
    platform: "Perplexity",
    path: "/v3/ai_optimization/perplexity/llm_responses/live",
    // sonar models search the web by default; country ISO is sonar-only.
    body: (user_prompt, iso) => ({
      user_prompt,
      model_name: "sonar",
      max_output_tokens: 1024,
      ...(iso ? { web_search_country_iso_code: iso } : {}),
    }),
  },
]

/** DataForSEO location_name → ISO code for llm_responses web search targeting. */
const LOCATION_ISO: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  Canada: "CA",
  Australia: "AU",
  Germany: "DE",
  France: "FR",
  Netherlands: "NL",
  Denmark: "DK",
  Sweden: "SE",
  Norway: "NO",
  Spain: "ES",
  Italy: "IT",
  Japan: "JP",
}

/* --------------------- minimal LLM response shapes --------------------- */

interface LlmAnnotation {
  title?: string
  url?: string
}

interface LlmSection {
  text?: string
  annotations?: LlmAnnotation[] | null
}

interface LlmItem {
  type?: string // "message" | "reasoning"
  sections?: LlmSection[]
}

interface LlmResult {
  model_name?: string
  items?: LlmItem[]
  fan_out_queries?: string[] | null
}

interface KeywordVolumeResult {
  items?: { keyword?: string; ai_search_volume?: number }[]
}

/** One answer, flattened: which platform said what, citing which sources. */
interface Answer {
  prompt: string
  platform: AiPlatform
  text: string
  citations: { domain: string; url: string }[]
  fanOutQueries: string[]
  cached: boolean
}

/* ------------------------------ helpers ------------------------------ */

/** Bounded-concurrency map, DataForSEO caps concurrent live tasks per account. */
async function pMap<T, R>(items: T[], fn: (item: T, i: number) => Promise<R>, limit: number): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

function normalizeHost(urlOrDomain: string): string {
  try {
    const u = urlOrDomain.includes("://") ? new URL(urlOrDomain) : new URL(`https://${urlOrDomain}`)
    return u.hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return urlOrDomain.replace(/^www\./, "").toLowerCase()
  }
}

function hostBelongsTo(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Strip markdown noise from an answer before analysis: inline links become
 * their text (otherwise a domain in a URL inflates mention counts and turns
 * snippets into link soup), and formatting markers disappear.
 */
function cleanAnswerText(raw: string): string {
  return raw
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/https?:\/\/\S+/g, " ") // bare URLs
    .replace(/[#*_`>]+/g, " ") // markdown markers
    .replace(/\(\s*\)/g, " ") // parens emptied by the link cleanup
    .replace(/[ \t]+/g, " ")
    .trim()
}

/** Count occurrences of any of the terms in text (word-boundary, case-insensitive). */
function countMentions(text: string, terms: string[]): number {
  let count = 0
  for (const term of terms) {
    const t = term.trim()
    if (t.length < 2) continue
    const re = new RegExp(`(?<![\\w-])${escapeRe(t)}(?![\\w-])`, "gi")
    count += text.match(re)?.length ?? 0
  }
  return count
}

/** First sentence in text containing any of the terms, trimmed for display. */
function findSnippet(text: string, terms: string[]): string | null {
  const sentences = text.split(/(?<=[.!?])\s+/)
  for (const s of sentences) {
    if (countMentions(s, terms) > 0) {
      const clean = s.replace(/\s+/g, " ").replace(/[#*_`]/g, "").trim()
      if (clean.length < 20) continue
      return clean.length > 240 ? `${clean.slice(0, 239)}…` : clean
    }
  }
  return null
}

/** "contoso.com" → "Contoso" (display name used in prompts and matching). */
function nameOf(domain: string): string {
  const label = normalizeHost(domain).split(".")[0] ?? ""
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : domain
}

/** Terms that identify an entity in answer text: its name label + bare domain. */
function entityTerms(domain: string): string[] {
  const host = normalizeHost(domain)
  const label = host.split(".")[0]
  return label && label.length >= 3 ? [host, label] : [host]
}

/* --------------------------- topic derivation --------------------------- */

const STOPWORDS = new Set(
  (
    "a an and are as at be best but by can could do does for from has have how in is it its " +
    "more most not of on or other our some such than that the their there these this to was we " +
    "what when where which while who why will with you your top options solutions alternatives " +
    "vs versus experience tools tool platform platforms software service services company companies " +
    "using use used based including like also both each between provides offers offering great good " +
    "over into onto across within around through need needs want wants without really depends " +
    "full key main several many different various popular common well known strong choice choices"
  ).split(/\s+/),
)

function isStop(word: string): boolean {
  return word.length < 3 || STOPWORDS.has(word)
}

/** Candidate phrases (2–3 word n-grams) from one answer, deduped per answer. */
function phrasesOf(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
  const phrases = new Set<string>()
  for (let n = 2; n <= 3; n++) {
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n)
      // Interior stopwords are fine ("share of voice"); edges must be content words.
      if (isStop(gram[0]) || isStop(gram[n - 1])) continue
      phrases.add(gram.join(" "))
    }
  }
  return phrases
}

function deriveTopics(
  answers: Answer[],
  configuredTopics: string[],
  brandTerms: string[],
  competitors: string[],
  yourDomain: string,
): DerivedTopic[] {
  const texts = answers.map((a) => a.text.toLowerCase())

  /* Candidates: configured topics + fan-out queries + recurring answer phrases. */
  const candidates = new Map<string, number>() // topic → score boost
  for (const t of configuredTopics) {
    const topic = t.trim().toLowerCase()
    if (topic) candidates.set(topic, 3) // configured topics get priority
  }
  const fanOutCount = new Map<string, number>()
  for (const a of answers) {
    for (const q of a.fanOutQueries) {
      const topic = q.trim().toLowerCase()
      if (topic && topic.length <= 60) fanOutCount.set(topic, (fanOutCount.get(topic) ?? 0) + 1)
    }
  }
  for (const [topic, n] of fanOutCount) {
    if (n >= 2) candidates.set(topic, Math.max(candidates.get(topic) ?? 0, 2))
  }
  const phraseDocs = new Map<string, number>()
  for (const text of texts) {
    for (const phrase of phrasesOf(text)) phraseDocs.set(phrase, (phraseDocs.get(phrase) ?? 0) + 1)
  }
  const minDocs = Math.max(3, Math.ceil(answers.length * 0.15))
  for (const [phrase, docs] of phraseDocs) {
    if (docs >= minDocs && !candidates.has(phrase)) candidates.set(phrase, 1)
  }

  /* Score every candidate by answer coverage, drop brand/competitor names. */
  const skipTerms = [...brandTerms, ...competitors.flatMap(entityTerms)].map((t) => t.toLowerCase())
  const scored = [...candidates.entries()]
    .filter(([topic]) => !skipTerms.some((t) => topic === t || topic.includes(t)))
    .map(([topic, boost]) => {
      const matching = answers.filter((a) => a.text.toLowerCase().includes(topic))
      return { topic, boost, matching }
    })
    .filter((c) => c.matching.length > 0)
    // Prefer topics that appear across answers; boost configured/fan-out ones.
    .sort((a, b) => b.matching.length * b.boost - a.matching.length * a.boost || b.topic.length - a.topic.length)

  /* Drop near-duplicates: containment ("headless cms" in "best headless cms")
     or shared word stems ("visual editor" vs "visual editing"). */
  const stemsMatch = (a: string, b: string) => {
    const [short, long] = a.length <= b.length ? [a.split(" "), b.split(" ")] : [b.split(" "), a.split(" ")]
    return short.every((w) => long.some((x) => x.slice(0, 4) === w.slice(0, 4)))
  }
  const picked: typeof scored = []
  for (const c of scored) {
    if (picked.length >= 10) break
    if (picked.some((p) => p.topic.includes(c.topic) || c.topic.includes(p.topic) || stemsMatch(p.topic, c.topic))) continue
    picked.push(c)
  }

  /** Most-cited pages of `domain` across the topic's answers (up to 3). */
  const topSourcesFor = (matching: Answer[], domain: string): TopicSourceLink[] => {
    const byUrl = new Map<string, { domain: string; count: number }>()
    for (const a of matching) {
      for (const c of a.citations) {
        if (!hostBelongsTo(c.domain, domain)) continue
        const entry = byUrl.get(c.url) ?? { domain: c.domain, count: 0 }
        entry.count += 1
        byUrl.set(c.url, entry)
      }
    }
    return [...byUrl.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([url, v]) => ({ url, domain: v.domain, count: v.count }))
  }

  return picked.map(({ topic, matching }) => {
    const withBrand = matching.filter((a) => countMentions(a.text, brandTerms) > 0)
    const yourTopSources = topSourcesFor(matching, yourDomain)
    const citations = matching.reduce(
      (sum, a) => sum + a.citations.filter((c) => hostBelongsTo(c.domain, yourDomain)).length,
      0,
    )
    let topCompetitor: string | null = null
    let competitorMentions = 0
    for (const comp of competitors) {
      const mentions = matching.reduce((sum, a) => sum + countMentions(a.text, entityTerms(comp)), 0)
      if (mentions > competitorMentions) {
        competitorMentions = mentions
        topCompetitor = comp
      }
    }
    return {
      topic,
      aiSearchVolume: null, // enriched with ai_keyword_data after derivation
      presencePct: Math.round((matching.length / answers.length) * 100),
      brandPresencePct: Math.round((withBrand.length / matching.length) * 100),
      citations,
      trend: [], // needs snapshot history, hidden in live mode
      topCompetitor,
      competitorMentions,
      yourTopSources,
      competitorTopSources: topCompetitor ? topSourcesFor(matching, topCompetitor) : [],
    }
  })
}

/* --------------------------- recommendations --------------------------- */

function buildRecommendation(
  visibilityPct: number,
  citations: number,
  ranking: PromptEntityRank[],
  missingPlatforms: AiPlatform[],
  topSources: PromptCitedSource[],
): string {
  const you = ranking.find((r) => r.isYou)
  const leader = ranking[0]
  const rank = you ? ranking.indexOf(you) + 1 : ranking.length
  const sourceHint = topSources.filter((s) => s.owner !== "yours").slice(0, 2).map((s) => s.domain)

  if (visibilityPct === 0) {
    return `You're invisible for this prompt. Publish a page that answers it directly${
      sourceHint.length ? `, study how ${sourceHint.join(" and ")} structure the content the AIs cite today` : ""
    }, then link to it from your strongest related pages.`
  }
  if (citations === 0) {
    return `AIs mention you but never cite your pages, you get name-recognition, not traffic. Make your best page on this question more citable: answer it verbatim near the top, add sources and data${
      sourceHint.length ? `, and match the structure of ${sourceHint[0]}` : ""
    }.`
  }
  if (leader && !leader.isYou) {
    return `${leader.name} leads this prompt (you rank #${rank}). Compare their most-cited page with yours and close the gap, fresher data, clearer direct answers, and internal links usually move AI citations within weeks.`
  }
  if (missingPlatforms.length) {
    return `You lead this prompt, but ${missingPlatforms.join(" and ")} ${
      missingPlatforms.length === 1 ? "doesn't" : "don't"
    } surface you yet. Those assistants lean on different sources, earn mentions in the publications they cite to close the gap.`
  }
  return "You lead this prompt across the assistants. Keep the cited pages fresh, AI answers follow recency, and a stale page loses its citation to the next-best source."
}

/* ------------------------------ assembly ------------------------------ */

export interface PromptInsightsParams {
  domain: string
  brandAliases: string[]
  competitors: string[]
  /** Topics from settings, prioritized as derived-topic candidates. */
  aiTopics: string[]
  prompts: string[]
  location: string
  /** DataForSEO language_name for the topic volume lookup, e.g. "English". */
  language: string
  /** Cache TTL in hours (from the snapshot cadence). */
  ttlHours?: number
  refresh?: boolean
}

export async function buildPromptInsights(p: PromptInsightsParams): Promise<PromptInsightsData> {
  const domain = normalizeHost(p.domain)
  const prompts = p.prompts.map((x) => x.trim()).filter(Boolean).slice(0, 10)
  const iso = LOCATION_ISO[p.location]
  const brandTerms = [...new Set([...p.brandAliases.map((b) => b.trim()).filter(Boolean), ...entityTerms(domain)])]
  const competitors = p.competitors.map(normalizeHost).filter(Boolean)

  /* ---- run every prompt × platform (bounded concurrency, cached) ---- */
  const calls = prompts.flatMap((prompt) => PLATFORMS.map((def) => ({ prompt, def })))
  const settled = await pMap(
    calls,
    async ({ prompt, def }) => {
      const body = def.body(prompt.slice(0, 500), iso)
      try {
        const res = await cached(`llm/${def.platform}`, body, () => dfsPost<LlmResult>(def.path, body), {
          bypass: p.refresh,
          ttlHours: p.ttlHours,
        })
        const result = res.data[0]
        const sections = (result?.items ?? [])
          .filter((i) => i.type === "message")
          .flatMap((i) => i.sections ?? [])
        const text = cleanAnswerText(sections.map((s) => s.text ?? "").join("\n"))
        const citations = sections
          .flatMap((s) => s.annotations ?? [])
          .filter((a): a is LlmAnnotation & { url: string } => Boolean(a?.url))
          .map((a) => {
            let host = normalizeHost(a.url)
            // Gemini wraps sources in a grounding redirect; the annotation
            // title carries the real domain, unwrap it or drop the citation.
            if (host.endsWith("vertexaisearch.cloud.google.com")) {
              const title = (a.title ?? "").trim().toLowerCase()
              if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(title)) return null
              host = title.replace(/^www\./, "")
            }
            return { domain: host, url: a.url }
          })
          .filter((c): c is { domain: string; url: string } => c !== null)
        const answer: Answer = {
          prompt,
          platform: def.platform,
          text,
          citations,
          fanOutQueries: (result?.fan_out_queries ?? []).filter((q): q is string => typeof q === "string"),
          cached: res.cached,
        }
        return { prompt, platform: def.platform, answer }
      } catch {
        return { prompt, platform: def.platform, answer: null }
      }
    },
    6,
  )

  const answers = settled.map((s) => s.answer).filter((a): a is Answer => a !== null && a.text.length > 0)

  /* ---- per-prompt aggregation ---- */
  const insights: PromptInsight[] = prompts.map((prompt) => {
    const rows = settled.filter((s) => s.prompt === prompt)
    const promptAnswers = rows.map((r) => r.answer).filter((a): a is Answer => a !== null && a.text.length > 0)

    const platforms: PromptPlatformPresence[] = PLATFORMS.map(({ platform }) => {
      const answer = promptAnswers.find((a) => a.platform === platform)
      if (!answer) return { platform, brandMentions: 0, brandCited: false, error: true }
      return {
        platform,
        brandMentions: countMentions(answer.text, brandTerms),
        brandCited: answer.citations.some((c) => hostBelongsTo(c.domain, domain)),
      }
    })

    const ok = platforms.filter((pl) => !pl.error)
    const visible = ok.filter((pl) => pl.brandMentions > 0 || pl.brandCited)
    const brandMentionsTotal = ok.reduce((s, pl) => s + pl.brandMentions, 0)
    const brandCitationsTotal = promptAnswers.reduce(
      (s, a) => s + a.citations.filter((c) => hostBelongsTo(c.domain, domain)).length,
      0,
    )

    /* ranking: you + competitors by mentions, then citations */
    const ranking: PromptEntityRank[] = [
      {
        name: p.brandAliases[0]?.trim() || nameOf(domain),
        isYou: true,
        mentions: brandMentionsTotal,
        citations: brandCitationsTotal,
      },
      ...competitors.map((comp) => ({
        name: nameOf(comp),
        isYou: false,
        mentions: promptAnswers.reduce((s, a) => s + countMentions(a.text, entityTerms(comp)), 0),
        citations: promptAnswers.reduce(
          (s, a) => s + a.citations.filter((c) => hostBelongsTo(c.domain, comp)).length,
          0,
        ),
      })),
    ].sort((a, b) => b.mentions - a.mentions || b.citations - a.citations)

    /* top mentions: brand quotes first, then leading competitors */
    const topMentions: PromptMentionSnippet[] = []
    const snippetOrder = [
      { entity: ranking.find((r) => r.isYou)!.name, terms: brandTerms },
      ...ranking.filter((r) => !r.isYou && r.mentions > 0).map((r) => ({ entity: r.name, terms: [r.name] })),
    ]
    for (const { entity, terms } of snippetOrder) {
      for (const a of promptAnswers) {
        if (topMentions.length >= 3) break
        const text = findSnippet(a.text, terms)
        if (text && !topMentions.some((m) => m.text === text)) {
          topMentions.push({ text, entity, platform: a.platform })
          break // one snippet per entity, move on
        }
      }
      if (topMentions.length >= 3) break
    }

    /* top 5 cited sources across the prompt's answers, each links to the
       domain's single most-cited page, so "what works" is one click away */
    const byDomain = new Map<string, { urls: Map<string, number>; count: number }>()
    for (const a of promptAnswers) {
      for (const c of a.citations) {
        const entry = byDomain.get(c.domain) ?? { urls: new Map(), count: 0 }
        entry.count += 1
        entry.urls.set(c.url, (entry.urls.get(c.url) ?? 0) + 1)
        byDomain.set(c.domain, entry)
      }
    }
    const topSources: PromptCitedSource[] = [...byDomain.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([d, v]) => ({
        domain: d,
        url: [...v.urls.entries()].sort((a, b) => b[1] - a[1])[0][0],
        count: v.count,
        owner: hostBelongsTo(d, domain)
          ? ("yours" as const)
          : competitors.some((comp) => hostBelongsTo(d, comp))
            ? ("competitor" as const)
            : ("other" as const),
      }))

    const visibilityPct = ok.length ? Math.round((visible.length / ok.length) * 100) : 0
    const missingPlatforms = ok.filter((pl) => pl.brandMentions === 0 && !pl.brandCited).map((pl) => pl.platform)

    return {
      prompt,
      platforms,
      visibilityPct,
      brandMentionsTotal,
      brandCitationsTotal,
      ranking,
      topMentions,
      topSources,
      recommendation: buildRecommendation(visibilityPct, brandCitationsTotal, ranking, missingPlatforms, topSources),
    }
  })

  /* ---- per-assistant totals: who wins each assistant across all prompts ---- */
  const yourName = p.brandAliases[0]?.trim() || nameOf(domain)
  const byAssistant: AssistantSummary[] = PLATFORMS.map(({ platform }): AssistantSummary | null => {
    const platformAnswers = answers.filter((a) => a.platform === platform)
    if (!platformAnswers.length) return null
    const totalFor = (terms: string[]) => platformAnswers.reduce((s, a) => s + countMentions(a.text, terms), 0)
    const entities = [
      { name: yourName, isYou: true, mentions: totalFor(brandTerms) },
      ...competitors.map((c) => ({ name: nameOf(c), isYou: false, mentions: totalFor(entityTerms(c)) })),
    ].sort((a, b) => b.mentions - a.mentions)
    const leader = entities[0]?.mentions ? entities[0] : null
    return {
      platform,
      yourMentions: entities.find((e) => e.isYou)?.mentions ?? 0,
      yourCitations: platformAnswers.reduce(
        (s, a) => s + a.citations.filter((c) => hostBelongsTo(c.domain, domain)).length,
        0,
      ),
      leader: leader?.name ?? null,
      leaderIsYou: leader?.isYou ?? false,
      leaderMentions: leader?.mentions ?? 0,
    }
  }).filter((s): s is AssistantSummary => s !== null)

  const topics = deriveTopics(answers, p.aiTopics, brandTerms, competitors, domain)

  /* Enrich derived topics with AI search demand (single batched call; a
     failure here degrades to null volumes rather than failing the tab). */
  if (topics.length) {
    try {
      const body = {
        location_name: p.location,
        language_name: p.language,
        keywords: topics.map((t) => t.topic),
      }
      const res = await cached(
        "llm/topic_volume",
        body,
        () => dfsPost<KeywordVolumeResult>("/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live", body),
        { bypass: p.refresh, ttlHours: p.ttlHours },
      )
      const volumes = new Map(
        (res.data[0]?.items ?? [])
          .filter((i) => i.keyword)
          .map((i) => [i.keyword!.toLowerCase(), i.ai_search_volume ?? null] as const),
      )
      for (const t of topics) t.aiSearchVolume = volumes.get(t.topic.toLowerCase()) ?? null
    } catch {
      // volumes stay null, the column shows "—"
    }
  }

  return {
    prompts: insights,
    topics,
    byAssistant,
    fetchedAt: new Date().toISOString(),
    cached: settled.every((s) => s.answer?.cached ?? true),
    unavailable: ["Topic trend (needs snapshot history)"],
  }
}
