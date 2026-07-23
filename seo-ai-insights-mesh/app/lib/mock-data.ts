import type {
  DashboardData,
  KeywordRow,
  KeywordSegment,
  SerpFeature,
  DecayingPage,
  AiVisibilityData,
  KeywordSuggestion,
  SuggestionSearchState,
  PromptInsight,
  PromptInsightsData,
} from "./types"

// 12 weekly snapshot dates, oldest -> newest, ending near the "last snapshot"
const WEEKS = 12
export const snapshotDates: string[] = Array.from({ length: WEEKS }, (_, i) => {
  const d = new Date("2026-07-13T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - (WEEKS - 1 - i) * 7)
  return d.toISOString().slice(0, 10)
})

const trafficTrend = [
  18200, 18740, 19010, 18650, 19400, 20120, 20890, 21050, 20640, 21580, 22310, 23120,
].map((traffic, i) => ({ date: snapshotDates[i], traffic }))

// Share of voice trend: brand + 3 competitors across 12 snapshots
const sovBrand = [22, 23, 24, 23, 25, 26, 27, 28, 27, 29, 30, 31]
const sovContoso = [34, 33, 33, 34, 32, 31, 31, 30, 31, 30, 29, 28]
const sovGlobex = [26, 26, 25, 25, 26, 26, 25, 24, 24, 23, 24, 23]
const sovInitech = [18, 18, 18, 18, 17, 17, 17, 18, 18, 18, 17, 18]

const shareOfVoiceTrend: AiVisibilityData["shareOfVoiceTrend"] = snapshotDates.map((date, i) => ({
  date,
  "acme.com": sovBrand[i],
  "contoso.com": sovContoso[i],
  "globex.com": sovGlobex[i],
  "initech.com": sovInitech[i],
}))

// ---- Keywords (40 rows across all segments) ----
const keywordSeeds: Array<
  [string, number, number, number, number, number, SerpFeature[], KeywordSegment]
> = [
  // keyword, position, delta, volume, aiVolume, estTraffic, serpFeatures, segment
  ["headless cms", 3, 2, 18100, 4200, 2140, ["featured_snippet", "aio_cited"], "improved"],
  ["composable dxp", 5, 1, 6600, 3100, 640, ["aio_cited", "paa"], "improved"],
  ["best headless cms 2026", 8, 4, 4400, 2600, 310, ["aio", "paa"], "improved"],
  ["content management system", 12, -3, 33100, 5100, 220, ["paa"], "declined"],
  ["headless commerce", 6, 3, 5400, 1900, 470, ["featured_snippet"], "improved"],
  ["what is a headless cms", 4, 0, 8100, 3800, 890, ["aio_cited", "paa"], "stable"],
  ["jamstack cms", 9, 5, 2900, 1200, 190, ["aio"], "new"],
  ["react cms", 7, -2, 3600, 1400, 260, [], "declined"],
  ["nextjs cms", 5, 6, 4800, 2200, 520, ["aio_cited"], "improved"],
  ["enterprise cms", 14, 1, 4100, 1700, 130, ["paa"], "stable"],
  ["personalization engine", 11, 3, 3300, 2400, 170, ["aio", "paa"], "improved"],
  ["ab testing platform", 13, -4, 5900, 1500, 120, [], "declined"],
  ["content federation", 6, 2, 880, 640, 92, ["featured_snippet"], "improved"],
  ["visual editor cms", 8, 7, 1600, 720, 110, ["aio"], "new"],
  ["cms migration", 10, -1, 2400, 980, 140, ["paa"], "stable"],
  ["headless cms pricing", 5, 2, 1900, 810, 210, ["aio_cited"], "improved"],
  ["digital experience platform", 15, 2, 6700, 3200, 90, ["aio", "paa"], "stable"],
  ["omnichannel cms", 9, 4, 1300, 690, 96, ["aio"], "new"],
  ["static site cms", 11, -5, 2100, 540, 74, [], "declined"],
  ["cms for developers", 7, 3, 3900, 1100, 280, ["featured_snippet", "paa"], "improved"],
  ["graphql cms", 6, 1, 2600, 940, 240, ["aio_cited"], "stable"],
  ["headless wordpress", 8, -3, 9900, 2100, 190, ["paa"], "declined"],
  ["contentful alternative", 4, 5, 1500, 880, 380, ["aio_cited", "paa"], "improved"],
  ["sanity vs contentful", 12, 2, 1100, 760, 88, ["paa"], "new"],
  ["composable architecture", 10, 1, 2200, 1500, 120, ["aio"], "stable"],
  ["mach architecture", 13, 3, 1700, 1300, 74, ["aio", "paa"], "improved"],
  ["cms api", 9, -2, 3100, 700, 150, [], "declined"],
  ["edge personalization", 14, 6, 720, 610, 52, ["aio"], "new"],
  ["headless cms comparison", 7, 2, 1800, 940, 210, ["aio_cited", "paa"], "improved"],
  ["content modeling", 8, 0, 2700, 820, 220, ["featured_snippet"], "stable"],
  ["decoupled cms", 11, -4, 1900, 480, 90, [], "declined"],
  ["cms for ecommerce", 6, 3, 4200, 1200, 340, ["paa"], "improved"],
  ["multi-brand cms", 15, 4, 590, 420, 38, ["aio"], "new"],
  ["structured content", 9, 1, 1400, 690, 130, ["featured_snippet"], "stable"],
  ["headless cms seo", 5, 4, 1200, 580, 260, ["aio_cited", "paa"], "improved"],
  ["cms performance", 12, -3, 980, 340, 62, [], "declined"],
  ["real-time personalization", 10, 5, 1600, 1400, 110, ["aio", "paa"], "new"],
  ["content orchestration", 13, 2, 640, 520, 48, ["aio"], "improved"],
  ["digital asset management", 22, -6, 8800, 1900, 30, [], "lost"],
  ["web content management", 26, -8, 5200, 1100, 18, [], "lost"],
]

const keywords: KeywordRow[] = keywordSeeds.map(
  ([keyword, position, delta, volume, aiVolume, estTraffic, serpFeatures, segment]) => ({
    keyword,
    position,
    delta,
    volume,
    aiVolume,
    estTraffic,
    url: `https://acme.com/${keyword.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
    serpFeatures,
    segment,
    strikingDistance: position >= 4 && position <= 15,
  }),
)

const keywordGaps = [
  { keyword: "content platform", volume: 6600, competitor: "contoso.com", competitorPosition: 3, difficulty: "high" as const },
  { keyword: "cms integrations", volume: 2400, competitor: "globex.com", competitorPosition: 5, difficulty: "medium" as const },
  { keyword: "headless seo guide", volume: 1900, competitor: "contoso.com", competitorPosition: 2, difficulty: "medium" as const },
  { keyword: "cms webhooks", volume: 880, competitor: "initech.com", competitorPosition: 4, difficulty: "low" as const },
  { keyword: "content delivery api", volume: 3100, competitor: "globex.com", competitorPosition: 6, difficulty: "medium" as const },
  { keyword: "personalization examples", volume: 1500, competitor: "contoso.com", competitorPosition: 1, difficulty: "high" as const },
  { keyword: "cms localization", volume: 720, competitor: "initech.com", competitorPosition: 7, difficulty: "low" as const },
  { keyword: "composable commerce", volume: 4200, competitor: "globex.com", competitorPosition: 3, difficulty: "high" as const },
]

const decayingPages: DecayingPage[] = [
  {
    path: "/blog/headless-cms-guide",
    trafficDelta: -640,
    trafficSpark: [980, 940, 890, 820, 760, 700, 620, 540, 480, 420, 380, 340],
    keywordsLost: [
      { keyword: "headless cms guide", from: 4, to: 9 },
      { keyword: "what is headless cms", from: 6, to: 14 },
      { keyword: "headless cms tutorial", from: 8, to: 18 },
    ],
    aiCitationsDelta: -4,
    aiCitationsLost: [
      { topic: "headless cms", model: "ChatGPT" },
      { topic: "content modeling", model: "Perplexity" },
    ],
    lastEditedMonthsAgo: 14,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/headless-cms-guide",
  },
  {
    path: "/blog/composable-dxp-explained",
    trafficDelta: -420,
    trafficSpark: [610, 600, 580, 560, 520, 500, 470, 440, 410, 380, 350, 330],
    keywordsLost: [
      { keyword: "composable dxp", from: 3, to: 7 },
      { keyword: "digital experience platform", from: 9, to: 16 },
    ],
    aiCitationsDelta: -3,
    aiCitationsLost: [
      { topic: "composable dxp", model: "Gemini" },
      { topic: "mach architecture", model: "Claude" },
    ],
    lastEditedMonthsAgo: 9,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/composable-dxp-explained",
  },
  {
    path: "/docs/personalization/getting-started",
    trafficDelta: -310,
    trafficSpark: [420, 410, 400, 390, 370, 350, 330, 310, 290, 260, 240, 220],
    keywordsLost: [
      { keyword: "personalization engine", from: 6, to: 11 },
      { keyword: "real-time personalization", from: 8, to: 15 },
    ],
    aiCitationsDelta: 0,
    aiCitationsLost: [],
    lastEditedMonthsAgo: 11,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/personalization-getting-started",
  },
  {
    path: "/blog/nextjs-cms-integration",
    trafficDelta: -280,
    trafficSpark: [390, 380, 370, 360, 340, 320, 300, 280, 260, 240, 220, 210],
    keywordsLost: [
      { keyword: "nextjs cms", from: 5, to: 10 },
      { keyword: "react cms", from: 7, to: 13 },
    ],
    aiCitationsDelta: -1,
    aiCitationsLost: [{ topic: "nextjs cms", model: "Google AIO" }],
    lastEditedMonthsAgo: 7,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/nextjs-cms-integration",
  },
  {
    path: "/blog/cms-migration-checklist",
    trafficDelta: -230,
    trafficSpark: [340, 330, 320, 310, 300, 290, 270, 250, 230, 210, 190, 180],
    keywordsLost: [{ keyword: "cms migration", from: 10, to: 17 }],
    aiCitationsDelta: 0,
    aiCitationsLost: [],
    lastEditedMonthsAgo: 4,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/cms-migration-checklist",
  },
  {
    path: "/blog/graphql-content-api",
    trafficDelta: -190,
    trafficSpark: [280, 270, 265, 255, 245, 235, 225, 215, 205, 190, 175, 165],
    keywordsLost: [
      { keyword: "graphql cms", from: 6, to: 12 },
      { keyword: "content delivery api", from: 9, to: 19 },
    ],
    aiCitationsDelta: 0,
    aiCitationsLost: [],
    lastEditedMonthsAgo: 8,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/graphql-content-api",
  },
  {
    path: "/docs/content-modeling",
    trafficDelta: -160,
    trafficSpark: [240, 235, 230, 225, 215, 205, 195, 185, 175, 165, 155, 150],
    keywordsLost: [{ keyword: "content modeling", from: 8, to: 15 }],
    aiCitationsDelta: 0,
    aiCitationsLost: [],
    lastEditedMonthsAgo: 3,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/content-modeling",
  },
  {
    path: "/blog/static-site-cms",
    trafficDelta: -110,
    trafficSpark: [180, 175, 170, 165, 158, 150, 142, 134, 126, 118, 110, 105],
    keywordsLost: [{ keyword: "static site cms", from: 11, to: 21 }],
    aiCitationsDelta: 0,
    aiCitationsLost: [],
    lastEditedMonthsAgo: 12,
    uniformEditUrl: "https://uniform.app/projects/acme/pages/static-site-cms",
  },
]

/** Fake a plausible 12-month AI-volume ramp ending at the current volume. */
function aiTrend(current: number, direction: "up" | "down" | "flat"): number[] {
  const factor = direction === "up" ? 0.45 : direction === "down" ? 1.6 : 0.95
  const start = Math.round(current * factor)
  return Array.from({ length: 12 }, (_, i) => Math.round(start + ((current - start) * i) / 11))
}

const aiTopics: AiVisibilityData["topics"] = [
  { topic: "headless cms", aiSearchVolume: 4200, trend12mo: aiTrend(4200, "up"), trendDirection: "up" },
  { topic: "composable dxp", aiSearchVolume: 3100, trend12mo: aiTrend(3100, "up"), trendDirection: "up" },
  { topic: "personalization", aiSearchVolume: 2400, trend12mo: aiTrend(2400, "flat"), trendDirection: "flat" },
  { topic: "mach architecture", aiSearchVolume: 1300, trend12mo: aiTrend(1300, "up"), trendDirection: "up" },
  { topic: "content federation", aiSearchVolume: 640, trend12mo: aiTrend(640, "up"), trendDirection: "up" },
  { topic: "digital experience platform", aiSearchVolume: 3200, trend12mo: aiTrend(3200, "down"), trendDirection: "down" },
  { topic: "visual editing", aiSearchVolume: 720, trend12mo: aiTrend(720, "up"), trendDirection: "up" },
  { topic: "content modeling", aiSearchVolume: 820, trend12mo: aiTrend(820, "flat"), trendDirection: "flat" },
  { topic: "omnichannel delivery", aiSearchVolume: 690, trend12mo: aiTrend(690, "flat"), trendDirection: "flat" },
  { topic: "edge personalization", aiSearchVolume: 610, trend12mo: aiTrend(610, "up"), trendDirection: "up" },
  { topic: "content orchestration", aiSearchVolume: 520, trend12mo: aiTrend(520, "flat"), trendDirection: "flat" },
  { topic: "cms migration", aiSearchVolume: 980, trend12mo: aiTrend(980, "down"), trendDirection: "down" },
  { topic: "cms performance", aiSearchVolume: 340, trend12mo: aiTrend(340, "down"), trendDirection: "down" },
  { topic: "graphql content api", aiSearchVolume: 940, trend12mo: aiTrend(940, "up"), trendDirection: "up" },
  { topic: "real-time personalization", aiSearchVolume: 1400, trend12mo: aiTrend(1400, "flat"), trendDirection: "flat" },
]

const aiPrompts: AiVisibilityData["prompts"] = [
  { prompt: "what is the best headless cms for enterprise teams", platform: "ChatGPT", aiSearchVolume: 2900, cited: true, lastSeen: "2026-07-11T08:20:00Z" },
  { prompt: "headless cms vs traditional cms which should i choose", platform: "Google AIO", aiSearchVolume: 2100, cited: true, lastSeen: "2026-07-12T14:05:00Z" },
  { prompt: "how to add personalization to a composable website", platform: "ChatGPT", aiSearchVolume: 1400, cited: false, lastSeen: "2026-07-09T19:44:00Z" },
  { prompt: "what is a digital experience platform", platform: "Google AIO", aiSearchVolume: 1250, cited: false, lastSeen: "2026-07-13T02:31:00Z" },
  { prompt: "best cms for nextjs", platform: "ChatGPT", aiSearchVolume: 990, cited: true, lastSeen: "2026-07-10T11:12:00Z" },
  { prompt: "how does visual editing work in a headless cms", platform: "Google AIO", aiSearchVolume: 480, cited: true, lastSeen: "2026-07-08T16:58:00Z" },
]

const competitorPrompts: AiVisibilityData["competitorPrompts"] = [
  {
    competitor: "contoso.com",
    prompts: [
      { prompt: "what is a digital experience platform", platform: "ChatGPT", aiSearchVolume: 3200, cited: true, lastSeen: "2026-07-12T10:14:00Z" },
      { prompt: "best composable dxp for enterprise", platform: "Google AIO", aiSearchVolume: 1800, cited: true, lastSeen: "2026-07-11T15:02:00Z" },
      { prompt: "dxp vs headless cms differences", platform: "ChatGPT", aiSearchVolume: 1450, cited: true, lastSeen: "2026-07-13T09:41:00Z" },
      { prompt: "how to build a personalization strategy", platform: "Google AIO", aiSearchVolume: 980, cited: true, lastSeen: "2026-07-09T12:20:00Z" },
      { prompt: "enterprise content platform examples", platform: "ChatGPT", aiSearchVolume: 640, cited: true, lastSeen: "2026-07-08T18:33:00Z" },
    ],
  },
  {
    competitor: "globex.com",
    prompts: [
      { prompt: "what is mach architecture", platform: "ChatGPT", aiSearchVolume: 1900, cited: true, lastSeen: "2026-07-12T08:05:00Z" },
      { prompt: "composable commerce platforms compared", platform: "Google AIO", aiSearchVolume: 1600, cited: true, lastSeen: "2026-07-10T14:28:00Z" },
      { prompt: "headless commerce for enterprise", platform: "ChatGPT", aiSearchVolume: 1100, cited: true, lastSeen: "2026-07-11T11:55:00Z" },
      { prompt: "content delivery api best practices", platform: "Google AIO", aiSearchVolume: 720, cited: true, lastSeen: "2026-07-07T16:12:00Z" },
    ],
  },
  {
    competitor: "initech.com",
    prompts: [
      { prompt: "cms localization options", platform: "ChatGPT", aiSearchVolume: 880, cited: true, lastSeen: "2026-07-12T13:47:00Z" },
      { prompt: "how to set up cms webhooks", platform: "Google AIO", aiSearchVolume: 540, cited: true, lastSeen: "2026-07-09T09:30:00Z" },
      { prompt: "structured content modeling guide", platform: "ChatGPT", aiSearchVolume: 420, cited: true, lastSeen: "2026-07-08T10:18:00Z" },
    ],
  },
]

// Build a plausible 12-month trend series from a start value and direction.
function makeTrend(start: number, direction: "up" | "down" | "flat"): number[] {
  const out: number[] = []
  let v = start
  for (let i = 0; i < 12; i++) {
    const drift = direction === "up" ? 0.045 : direction === "down" ? -0.04 : 0
    const wobble = Math.sin(i * 1.3) * 0.03
    v = Math.max(10, Math.round(v * (1 + drift + wobble)))
    out.push(v)
  }
  return out
}

type SuggestionSeed = [
  keyword: string,
  volume: number,
  aiVolume: number | null,
  dir: "up" | "down" | "flat",
  cpc: number,
  competition: number,
  categories: string[],
  tracked: boolean,
]

const suggestionSeeds: SuggestionSeed[] = [
  ["content management system", 33100, 12400, "flat", 6.4, 0.82, ["CMS", "Platform"], true],
  ["headless cms vs traditional cms", 6600, 4200, "up", 4.1, 0.38, ["CMS", "Comparison"], false],
  ["best headless cms 2026", 5400, 3900, "up", 7.8, 0.71, ["CMS", "Buying guide"], false],
  ["composable architecture", 4800, 2600, "up", 5.2, 0.34, ["Architecture", "Composable"], true],
  ["jamstack cms", 4300, 1800, "flat", 3.9, 0.44, ["CMS", "Jamstack"], false],
  ["api first cms", 3900, 2100, "up", 6.1, 0.29, ["CMS", "API"], false],
  ["content federation", 3600, 1500, "up", 4.7, 0.22, ["Architecture", "Content"], false],
  ["composable dxp", 3200, 1900, "up", 8.9, 0.41, ["DXP", "Composable"], true],
  ["digital experience platform", 2900, 1600, "flat", 12.4, 0.77, ["DXP", "Platform"], true],
  ["nextjs cms", 2700, 1400, "up", 3.2, 0.36, ["CMS", "Framework"], false],
  ["content modeling best practices", 2400, 980, "up", 2.8, 0.19, ["Content", "Modeling"], false],
  ["headless commerce", 2300, 1100, "up", 9.6, 0.58, ["Commerce", "Headless"], false],
  ["structured content", 2100, 760, "flat", 2.4, 0.17, ["Content", "Modeling"], false],
  ["mach architecture", 1900, 1250, "up", 7.3, 0.31, ["Architecture", "MACH"], false],
  ["content as a service", 1700, 640, "flat", 5.5, 0.33, ["CaaS", "Content"], false],
  ["edge personalization", 1500, 890, "up", 8.1, 0.27, ["Personalization", "Edge"], true],
  ["cms with graphql api", 1400, 720, "up", 4.9, 0.24, ["CMS", "API"], false],
  ["multi channel publishing", 1300, null, "flat", 6.7, 0.46, ["Content", "Omnichannel"], false],
  ["omnichannel content delivery", 1200, 540, "up", 7.9, 0.29, ["Content", "Omnichannel"], false],
  ["visual editor cms", 1100, 480, "up", 3.6, 0.21, ["CMS", "Editing"], false],
  ["static site generator cms", 980, null, "flat", 2.9, 0.35, ["CMS", "Jamstack"], false],
  ["enterprise headless cms", 880, 610, "up", 14.2, 0.68, ["CMS", "Enterprise"], false],
  ["content orchestration", 760, 420, "up", 6.3, 0.23, ["Content", "Orchestration"], false],
  ["headless cms pricing", 720, null, "flat", 9.1, 0.52, ["CMS", "Pricing"], false],
  ["cms migration guide", 640, 380, "down", 5.8, 0.44, ["CMS", "Migration"], false],
  ["decoupled cms", 590, 260, "flat", 4.4, 0.3, ["CMS", "Architecture"], false],
  ["content delivery api", 470, null, "up", 3.1, 0.18, ["API", "Content"], false],
  ["personalization engine", 390, 210, "up", 11.7, 0.49, ["Personalization", "Platform"], false],
  ["cms for developers", 260, 140, "flat", 2.6, 0.26, ["CMS", "Developers"], false],
  ["what is a headless cms", 90, null, "up", 1.9, 0.12, ["CMS", "Education"], false],
]

const suggestionResults: KeywordSuggestion[] = suggestionSeeds.map(
  ([keyword, volume, aiVolume, dir, cpc, competition, categories, tracked]) => ({
    keyword,
    volume,
    aiVolume,
    trend12mo: makeTrend(Math.max(40, Math.round(volume * 0.7)), dir),
    trendDirection: dir,
    cpc,
    competition,
    categories,
    alreadyTracked: tracked,
  }),
)

export const keywordSuggestions: SuggestionSearchState = {
  seed: "headless cms",
  algorithm: "same_topic",
  location: "United States",
  language: "English",
  results: suggestionResults,
  searchedAt: "2026-07-13T09:12:00Z",
}

/* ---- Topics & Prompts (mock LLM-response insights for the preview) ---- */

const mockPromptSeeds: PromptInsight[] = [
  {
    prompt: "Solutions for headless cms",
    platforms: [
      { platform: "ChatGPT", brandMentions: 3, brandCited: true },
      { platform: "Claude", brandMentions: 2, brandCited: true },
      { platform: "Gemini", brandMentions: 1, brandCited: false },
      { platform: "Perplexity", brandMentions: 2, brandCited: true },
    ],
    visibilityPct: 100,
    brandMentionsTotal: 8,
    brandCitationsTotal: 5,
    ranking: [
      { name: "Acme", isYou: true, mentions: 8, citations: 5 },
      { name: "Contoso", isYou: false, mentions: 6, citations: 4 },
      { name: "Globex", isYou: false, mentions: 4, citations: 2 },
      { name: "Initech", isYou: false, mentions: 1, citations: 0 },
    ],
    topMentions: [
      { text: "Acme is a strong choice for teams that want visual editing on top of a headless architecture.", entity: "Acme", platform: "ChatGPT" },
      { text: "Contoso offers a mature ecosystem with extensive enterprise integrations.", entity: "Contoso", platform: "Claude" },
      { text: "For composable stacks, Acme and Globex both provide well-documented APIs.", entity: "Globex", platform: "Perplexity" },
    ],
    topSources: [
      { domain: "acme.com", url: "https://acme.com/blog/headless-cms-guide", count: 4, owner: "yours" },
      { domain: "contoso.com", url: "https://contoso.com/guides/headless", count: 3, owner: "competitor" },
      { domain: "g2.com", url: "https://g2.com/categories/headless-cms", count: 3, owner: "other" },
      { domain: "cmswire.com", url: "https://cmswire.com/headless-cms-roundup", count: 2, owner: "other" },
      { domain: "globex.com", url: "https://globex.com/platform", count: 1, owner: "competitor" },
    ],
    recommendation:
      "You lead this prompt across the assistants. Keep the cited pages fresh, AI answers follow recency, and a stale page loses its citation to the next-best source.",
  },
  {
    prompt: "Best options for headless cms",
    platforms: [
      { platform: "ChatGPT", brandMentions: 2, brandCited: true },
      { platform: "Claude", brandMentions: 1, brandCited: false },
      { platform: "Gemini", brandMentions: 0, brandCited: false },
      { platform: "Perplexity", brandMentions: 1, brandCited: false },
    ],
    visibilityPct: 75,
    brandMentionsTotal: 4,
    brandCitationsTotal: 1,
    ranking: [
      { name: "Contoso", isYou: false, mentions: 7, citations: 4 },
      { name: "Acme", isYou: true, mentions: 4, citations: 1 },
      { name: "Globex", isYou: false, mentions: 4, citations: 1 },
      { name: "Initech", isYou: false, mentions: 2, citations: 0 },
    ],
    topMentions: [
      { text: "Contoso is frequently ranked first for enterprise deployments thanks to its ecosystem.", entity: "Contoso", platform: "ChatGPT" },
      { text: "Acme stands out for visual editing and personalization on composable stacks.", entity: "Acme", platform: "ChatGPT" },
      { text: "Globex is a solid pick when commerce integration is the priority.", entity: "Globex", platform: "Gemini" },
    ],
    topSources: [
      { domain: "contoso.com", url: "https://contoso.com/why-contoso", count: 5, owner: "competitor" },
      { domain: "g2.com", url: "https://g2.com/categories/headless-cms", count: 4, owner: "other" },
      { domain: "techradar.com", url: "https://techradar.com/best/headless-cms", count: 2, owner: "other" },
      { domain: "acme.com", url: "https://acme.com/composable-dxp", count: 1, owner: "yours" },
      { domain: "globex.com", url: "https://globex.com/blog/mach", count: 1, owner: "competitor" },
    ],
    recommendation:
      "Contoso leads this prompt (you rank #2). Compare their most-cited page with yours and close the gap, fresher data, clearer direct answers, and internal links usually move AI citations within weeks.",
  },
  {
    prompt: "What is headless cms?",
    platforms: [
      { platform: "ChatGPT", brandMentions: 1, brandCited: true },
      { platform: "Claude", brandMentions: 1, brandCited: true },
      { platform: "Gemini", brandMentions: 1, brandCited: true },
      { platform: "Perplexity", brandMentions: 0, brandCited: false },
    ],
    visibilityPct: 75,
    brandMentionsTotal: 3,
    brandCitationsTotal: 4,
    ranking: [
      { name: "Acme", isYou: true, mentions: 3, citations: 4 },
      { name: "Contoso", isYou: false, mentions: 2, citations: 1 },
      { name: "Globex", isYou: false, mentions: 0, citations: 0 },
      { name: "Initech", isYou: false, mentions: 0, citations: 0 },
    ],
    topMentions: [
      { text: "As Acme's guide explains, a headless CMS separates content storage from presentation.", entity: "Acme", platform: "Claude" },
      { text: "Vendors like Acme and Contoso pioneered API-first content delivery.", entity: "Contoso", platform: "ChatGPT" },
    ],
    topSources: [
      { domain: "acme.com", url: "https://acme.com/blog/headless-cms-guide", count: 4, owner: "yours" },
      { domain: "wikipedia.org", url: "https://en.wikipedia.org/wiki/Headless_CMS", count: 3, owner: "other" },
      { domain: "contoso.com", url: "https://contoso.com/learn/headless", count: 1, owner: "competitor" },
      { domain: "smashingmagazine.com", url: "https://smashingmagazine.com/headless-cms", count: 1, owner: "other" },
    ],
    recommendation:
      "You lead this prompt, but Perplexity doesn't surface you yet. Those assistants lean on different sources, earn mentions in the publications they cite to close the gap.",
  },
  {
    prompt: "Solutions for composable dxp",
    platforms: [
      { platform: "ChatGPT", brandMentions: 2, brandCited: true },
      { platform: "Claude", brandMentions: 1, brandCited: false },
      { platform: "Gemini", brandMentions: 1, brandCited: false },
      { platform: "Perplexity", brandMentions: 2, brandCited: true },
    ],
    visibilityPct: 100,
    brandMentionsTotal: 6,
    brandCitationsTotal: 3,
    ranking: [
      { name: "Contoso", isYou: false, mentions: 8, citations: 5 },
      { name: "Acme", isYou: true, mentions: 6, citations: 3 },
      { name: "Initech", isYou: false, mentions: 3, citations: 1 },
      { name: "Globex", isYou: false, mentions: 2, citations: 0 },
    ],
    topMentions: [
      { text: "Contoso's DXP suite remains the reference point for large enterprises.", entity: "Contoso", platform: "Claude" },
      { text: "Acme takes a composable-first approach that avoids suite lock-in.", entity: "Acme", platform: "Perplexity" },
      { text: "Initech is a lighter alternative for mid-market teams.", entity: "Initech", platform: "ChatGPT" },
    ],
    topSources: [
      { domain: "contoso.com", url: "https://contoso.com/guides/dxp", count: 6, owner: "competitor" },
      { domain: "acme.com", url: "https://acme.com/composable-dxp", count: 3, owner: "yours" },
      { domain: "gartner.com", url: "https://gartner.com/dxp-magic-quadrant", count: 2, owner: "other" },
      { domain: "forrester.com", url: "https://forrester.com/dxp-wave", count: 2, owner: "other" },
      { domain: "initech.com", url: "https://initech.com/platform", count: 1, owner: "competitor" },
    ],
    recommendation:
      "Contoso leads this prompt (you rank #2). Compare their most-cited page with yours and close the gap, fresher data, clearer direct answers, and internal links usually move AI citations within weeks.",
  },
  {
    prompt: "Best options for composable dxp",
    platforms: [
      { platform: "ChatGPT", brandMentions: 1, brandCited: false },
      { platform: "Claude", brandMentions: 0, brandCited: false },
      { platform: "Gemini", brandMentions: 0, brandCited: false },
      { platform: "Perplexity", brandMentions: 1, brandCited: false },
    ],
    visibilityPct: 50,
    brandMentionsTotal: 2,
    brandCitationsTotal: 0,
    ranking: [
      { name: "Contoso", isYou: false, mentions: 9, citations: 6 },
      { name: "Globex", isYou: false, mentions: 4, citations: 2 },
      { name: "Acme", isYou: true, mentions: 2, citations: 0 },
      { name: "Initech", isYou: false, mentions: 2, citations: 0 },
    ],
    topMentions: [
      { text: "Contoso consistently tops analyst lists for digital experience platforms.", entity: "Contoso", platform: "Gemini" },
      { text: "Globex pairs its DXP with strong commerce tooling.", entity: "Globex", platform: "ChatGPT" },
      { text: "Acme is worth shortlisting for teams prioritizing visual workflow.", entity: "Acme", platform: "Perplexity" },
    ],
    topSources: [
      { domain: "contoso.com", url: "https://contoso.com/why-contoso", count: 6, owner: "competitor" },
      { domain: "gartner.com", url: "https://gartner.com/dxp-magic-quadrant", count: 4, owner: "other" },
      { domain: "globex.com", url: "https://globex.com/platform", count: 2, owner: "competitor" },
      { domain: "capterra.com", url: "https://capterra.com/dxp", count: 2, owner: "other" },
      { domain: "cmswire.com", url: "https://cmswire.com/dxp-buyers-guide", count: 1, owner: "other" },
    ],
    recommendation:
      "AIs mention you but never cite your pages, you get name-recognition, not traffic. Make your best page on this question more citable: answer it verbatim near the top, add sources and data, and match the structure of contoso.com.",
  },
  {
    prompt: "What is composable dxp?",
    platforms: [
      { platform: "ChatGPT", brandMentions: 1, brandCited: true },
      { platform: "Claude", brandMentions: 1, brandCited: true },
      { platform: "Gemini", brandMentions: 0, brandCited: false },
      { platform: "Perplexity", brandMentions: 1, brandCited: false },
    ],
    visibilityPct: 75,
    brandMentionsTotal: 3,
    brandCitationsTotal: 2,
    ranking: [
      { name: "Acme", isYou: true, mentions: 3, citations: 2 },
      { name: "Contoso", isYou: false, mentions: 3, citations: 1 },
      { name: "Globex", isYou: false, mentions: 1, citations: 0 },
      { name: "Initech", isYou: false, mentions: 0, citations: 0 },
    ],
    topMentions: [
      { text: "Acme describes composable DXP as assembling best-of-breed services behind one experience layer.", entity: "Acme", platform: "ChatGPT" },
      { text: "Contoso frames DXP as an integrated suite with composable extensions.", entity: "Contoso", platform: "Claude" },
    ],
    topSources: [
      { domain: "acme.com", url: "https://acme.com/composable-dxp", count: 2, owner: "yours" },
      { domain: "contoso.com", url: "https://contoso.com/learn/dxp", count: 1, owner: "competitor" },
      { domain: "machalliance.org", url: "https://machalliance.org/what-is-mach", count: 1, owner: "other" },
    ],
    recommendation:
      "You lead this prompt, but Gemini doesn't surface you yet. Those assistants lean on different sources, earn mentions in the publications they cite to close the gap.",
  },
  {
    prompt: "Alternatives for Acme",
    platforms: [
      { platform: "ChatGPT", brandMentions: 4, brandCited: true },
      { platform: "Claude", brandMentions: 3, brandCited: false },
      { platform: "Gemini", brandMentions: 3, brandCited: false },
      { platform: "Perplexity", brandMentions: 4, brandCited: true },
    ],
    visibilityPct: 100,
    brandMentionsTotal: 14,
    brandCitationsTotal: 2,
    ranking: [
      { name: "Acme", isYou: true, mentions: 14, citations: 2 },
      { name: "Contoso", isYou: false, mentions: 8, citations: 3 },
      { name: "Globex", isYou: false, mentions: 6, citations: 2 },
      { name: "Initech", isYou: false, mentions: 5, citations: 1 },
    ],
    topMentions: [
      { text: "Common alternatives to Acme include Contoso, Globex, and Initech, each with different strengths.", entity: "Acme", platform: "ChatGPT" },
      { text: "Contoso is the most frequent enterprise substitute, though migration effort is higher.", entity: "Contoso", platform: "Perplexity" },
      { text: "Globex appeals to commerce-led teams considering a switch.", entity: "Globex", platform: "Claude" },
    ],
    topSources: [
      { domain: "g2.com", url: "https://g2.com/products/acme/competitors", count: 5, owner: "other" },
      { domain: "contoso.com", url: "https://contoso.com/vs/acme", count: 3, owner: "competitor" },
      { domain: "capterra.com", url: "https://capterra.com/acme-alternatives", count: 2, owner: "other" },
      { domain: "acme.com", url: "https://acme.com/compare", count: 2, owner: "yours" },
      { domain: "reddit.com", url: "https://reddit.com/r/cms/acme_alternatives", count: 1, owner: "other" },
    ],
    recommendation:
      "Contoso's comparison page is a top source when AIs answer this, publish your own balanced comparison so the narrative isn't theirs alone.",
  },
  {
    prompt: "Experience with Acme",
    platforms: [
      { platform: "ChatGPT", brandMentions: 3, brandCited: false },
      { platform: "Claude", brandMentions: 2, brandCited: false },
      { platform: "Gemini", brandMentions: 2, brandCited: false },
      { platform: "Perplexity", brandMentions: 3, brandCited: true },
    ],
    visibilityPct: 100,
    brandMentionsTotal: 10,
    brandCitationsTotal: 1,
    ranking: [
      { name: "Acme", isYou: true, mentions: 10, citations: 1 },
      { name: "Contoso", isYou: false, mentions: 2, citations: 0 },
      { name: "Globex", isYou: false, mentions: 1, citations: 0 },
      { name: "Initech", isYou: false, mentions: 0, citations: 0 },
    ],
    topMentions: [
      { text: "Developers generally report a smooth onboarding experience with Acme's visual workspace.", entity: "Acme", platform: "ChatGPT" },
      { text: "Reviews praise Acme's personalization but note the learning curve for content modeling.", entity: "Acme", platform: "Perplexity" },
    ],
    topSources: [
      { domain: "g2.com", url: "https://g2.com/products/acme/reviews", count: 6, owner: "other" },
      { domain: "trustradius.com", url: "https://trustradius.com/products/acme", count: 3, owner: "other" },
      { domain: "reddit.com", url: "https://reddit.com/r/cms/acme_review", count: 2, owner: "other" },
      { domain: "acme.com", url: "https://acme.com/customers", count: 1, owner: "yours" },
    ],
    recommendation:
      "Review sites drive this answer, not your pages. Keep G2 and TrustRadius profiles fresh and publish customer stories, AIs quote the experiences they can find.",
  },
  {
    prompt: "Acme vs. Contoso",
    platforms: [
      { platform: "ChatGPT", brandMentions: 5, brandCited: true },
      { platform: "Claude", brandMentions: 4, brandCited: true },
      { platform: "Gemini", brandMentions: 4, brandCited: false },
      { platform: "Perplexity", brandMentions: 5, brandCited: true },
    ],
    visibilityPct: 100,
    brandMentionsTotal: 18,
    brandCitationsTotal: 4,
    ranking: [
      { name: "Contoso", isYou: false, mentions: 19, citations: 6 },
      { name: "Acme", isYou: true, mentions: 18, citations: 4 },
      { name: "Globex", isYou: false, mentions: 1, citations: 0 },
      { name: "Initech", isYou: false, mentions: 0, citations: 0 },
    ],
    topMentions: [
      { text: "Choose Acme for composable flexibility and visual editing; choose Contoso for an all-in-one suite.", entity: "Acme", platform: "Claude" },
      { text: "Contoso brings deeper out-of-the-box modules, at the cost of flexibility.", entity: "Contoso", platform: "ChatGPT" },
    ],
    topSources: [
      { domain: "contoso.com", url: "https://contoso.com/vs/acme", count: 4, owner: "competitor" },
      { domain: "acme.com", url: "https://acme.com/compare/contoso", count: 4, owner: "yours" },
      { domain: "g2.com", url: "https://g2.com/compare/acme-vs-contoso", count: 3, owner: "other" },
      { domain: "cmswire.com", url: "https://cmswire.com/acme-vs-contoso", count: 1, owner: "other" },
    ],
    recommendation:
      "Contoso leads this prompt (you rank #2). Compare their most-cited page with yours and close the gap, fresher data, clearer direct answers, and internal links usually move AI citations within weeks.",
  },
  {
    prompt: "Acme vs. Globex",
    platforms: [
      { platform: "ChatGPT", brandMentions: 4, brandCited: true },
      { platform: "Claude", brandMentions: 3, brandCited: true },
      { platform: "Gemini", brandMentions: 3, brandCited: true },
      { platform: "Perplexity", brandMentions: 4, brandCited: false },
    ],
    visibilityPct: 100,
    brandMentionsTotal: 14,
    brandCitationsTotal: 5,
    ranking: [
      { name: "Acme", isYou: true, mentions: 14, citations: 5 },
      { name: "Globex", isYou: false, mentions: 12, citations: 3 },
      { name: "Contoso", isYou: false, mentions: 2, citations: 0 },
      { name: "Initech", isYou: false, mentions: 0, citations: 0 },
    ],
    topMentions: [
      { text: "Acme edges out Globex on personalization and editor experience.", entity: "Acme", platform: "Gemini" },
      { text: "Globex is stronger where commerce is the core requirement.", entity: "Globex", platform: "ChatGPT" },
    ],
    topSources: [
      { domain: "acme.com", url: "https://acme.com/compare/globex", count: 5, owner: "yours" },
      { domain: "globex.com", url: "https://globex.com/vs/acme", count: 3, owner: "competitor" },
      { domain: "g2.com", url: "https://g2.com/compare/acme-vs-globex", count: 2, owner: "other" },
    ],
    recommendation:
      "You lead this prompt across the assistants. Keep the cited pages fresh, AI answers follow recency, and a stale page loses its citation to the next-best source.",
  },
]

/** Mock per-topic cited pages for the expandable topic rows. */
function mockTopicSources(topic: string, yourCount: number, compDomain: string | null, compCount: number) {
  const slug = topic.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
  const yours = [
    { url: `https://acme.com/blog/${slug}-guide`, domain: "acme.com", count: yourCount },
    { url: `https://acme.com/docs/${slug}`, domain: "acme.com", count: Math.max(1, yourCount - 2) },
  ].slice(0, yourCount > 0 ? 2 : 0)
  const comp = compDomain
    ? [
        { url: `https://${compDomain}/guides/${slug}`, domain: compDomain, count: compCount },
        { url: `https://${compDomain}/learn/${slug}`, domain: compDomain, count: Math.max(1, compCount - 3) },
      ].slice(0, compCount > 0 ? 2 : 0)
    : []
  return { yourTopSources: yours, competitorTopSources: comp }
}

export const mockPromptInsights: PromptInsightsData = {
  prompts: mockPromptSeeds,
  byAssistant: [
    { platform: "ChatGPT", yourMentions: 26, yourCitations: 8, leader: "Acme", leaderIsYou: true, leaderMentions: 26 },
    { platform: "Claude", yourMentions: 18, yourCitations: 5, leader: "Contoso", leaderIsYou: false, leaderMentions: 21 },
    { platform: "Gemini", yourMentions: 15, yourCitations: 2, leader: "Contoso", leaderIsYou: false, leaderMentions: 24 },
    { platform: "Perplexity", yourMentions: 23, yourCitations: 5, leader: "Acme", leaderIsYou: true, leaderMentions: 23 },
  ],
  topics: [
    { topic: "headless cms", aiSearchVolume: 4200, presencePct: 85, brandPresencePct: 76, citations: 9, trend: aiTrend(76, "up"), topCompetitor: "contoso.com", competitorMentions: 14, ...mockTopicSources("headless cms", 4, "contoso.com", 5) },
    { topic: "composable dxp", aiSearchVolume: 3100, presencePct: 62, brandPresencePct: 58, citations: 5, trend: aiTrend(58, "up"), topCompetitor: "contoso.com", competitorMentions: 20, ...mockTopicSources("composable dxp", 3, "contoso.com", 6) },
    { topic: "visual editing", aiSearchVolume: 720, presencePct: 48, brandPresencePct: 82, citations: 6, trend: aiTrend(82, "up"), topCompetitor: "globex.com", competitorMentions: 4, ...mockTopicSources("visual editing", 4, "globex.com", 1) },
    { topic: "personalization", aiSearchVolume: 2400, presencePct: 44, brandPresencePct: 71, citations: 4, trend: aiTrend(71, "flat"), topCompetitor: "contoso.com", competitorMentions: 6, ...mockTopicSources("personalization", 3, "contoso.com", 2) },
    { topic: "content modeling", aiSearchVolume: 820, presencePct: 38, brandPresencePct: 54, citations: 3, trend: aiTrend(54, "flat"), topCompetitor: "contoso.com", competitorMentions: 5, ...mockTopicSources("content modeling", 2, "contoso.com", 2) },
    { topic: "enterprise integrations", aiSearchVolume: 980, presencePct: 35, brandPresencePct: 31, citations: 1, trend: aiTrend(31, "down"), topCompetitor: "contoso.com", competitorMentions: 11, ...mockTopicSources("enterprise integrations", 1, "contoso.com", 4) },
    { topic: "mach architecture", aiSearchVolume: 1300, presencePct: 29, brandPresencePct: 63, citations: 2, trend: aiTrend(63, "up"), topCompetitor: "globex.com", competitorMentions: 5, ...mockTopicSources("mach architecture", 2, "globex.com", 3) },
    { topic: "api-first delivery", aiSearchVolume: null, presencePct: 27, brandPresencePct: 60, citations: 2, trend: aiTrend(60, "up"), topCompetitor: "initech.com", competitorMentions: 3, ...mockTopicSources("api-first delivery", 2, "initech.com", 1) },
    { topic: "commerce integration", aiSearchVolume: 640, presencePct: 22, brandPresencePct: 24, citations: 0, trend: aiTrend(24, "down"), topCompetitor: "globex.com", competitorMentions: 9, ...mockTopicSources("commerce integration", 0, "globex.com", 4) },
    { topic: "migration effort", aiSearchVolume: null, presencePct: 18, brandPresencePct: 42, citations: 1, trend: aiTrend(42, "flat"), topCompetitor: "contoso.com", competitorMentions: 4, ...mockTopicSources("migration effort", 1, "contoso.com", 2) },
  ],
  fetchedAt: "2026-07-13T09:30:00Z",
  cached: true,
  unavailable: [],
}

export const dashboardData: DashboardData = {
  domain: "acme.com",
  country: "United States",
  language: "English",
  lastSnapshot: snapshotDates[snapshotDates.length - 1],
  overview: {
    kpis: {
      traffic: { value: 23120, deltaPct: 3.6, spark: trafficTrend.map((t) => t.traffic) },
      rankedKeywords: { value: 1284, deltaPct: 2.1, spark: [1180, 1195, 1210, 1220, 1235, 1240, 1255, 1260, 1268, 1272, 1279, 1284] },
      referringDomains: { value: 412, deltaPct: 1.2, spark: [388, 390, 393, 396, 398, 401, 403, 405, 407, 409, 410, 412] },
      siteHealth: { value: 87, deltaPct: -1.4, spark: [90, 90, 89, 89, 88, 88, 89, 88, 88, 87, 88, 87] },
      aiMentions30d: { value: 1846, deltaPct: 12.3, spark: [1280, 1340, 1410, 1450, 1520, 1580, 1610, 1670, 1710, 1760, 1800, 1846] },
    },
    positionDistribution: {
      top3: 142,
      p4to10: 386,
      p11to20: 421,
      p21plus: 335,
      deltas: { top3: 12, p4to10: 8, p11to20: -4, p21plus: -9 },
    },
    movers: {
      gains: [
        { keyword: "visual editor cms", from: 15, to: 8, volume: 1600 },
        { keyword: "edge personalization", from: 20, to: 14, volume: 720 },
        { keyword: "nextjs cms", from: 11, to: 5, volume: 4800 },
        { keyword: "headless cms seo", from: 9, to: 5, volume: 1200 },
        { keyword: "contentful alternative", from: 9, to: 4, volume: 1500 },
      ],
      losses: [
        { keyword: "web content management", from: 18, to: 26, volume: 5200 },
        { keyword: "digital asset management", from: 16, to: 22, volume: 8800 },
        { keyword: "ab testing platform", from: 9, to: 13, volume: 5900 },
        { keyword: "content management system", from: 9, to: 12, volume: 33100 },
        { keyword: "static site cms", from: 6, to: 11, volume: 2100 },
      ],
    },
    alerts: { decayingPages: 8, lostAiCitations: 3, crawlIssues: 12 },
    trafficTrend,
  },
  aiVisibility: {
    kpis: {
      mentions: { value: 1846, deltaPct: 12.3, spark: [1280, 1340, 1410, 1450, 1520, 1580, 1610, 1670, 1710, 1760, 1800, 1846] },
      citations: { value: 612, deltaPct: 8.7, spark: [480, 498, 512, 524, 540, 552, 566, 578, 588, 596, 604, 612] },
      citationRatePct: { value: 33, deltaPct: -2.1, spark: [37, 37, 36, 36, 35, 35, 35, 34, 34, 34, 33, 33] },
      shareOfVoicePct: { value: 31, deltaPct: 3.3, spark: sovBrand },
    },
    byModel: [
      { model: "ChatGPT", mentions: 642, citations: 231 },
      { model: "Gemini", mentions: 418, citations: 142 },
      { model: "Perplexity", mentions: 386, citations: 168 },
      { model: "Claude", mentions: 248, citations: 41 },
      { model: "Google AIO", mentions: 152, citations: 30 },
    ],
    shareOfVoiceTrend,
    ownedCitedPages: [
      {
        url: "https://acme.com/blog/headless-cms-guide",
        citations: 92,
        aiSearchVolume: 4200,
        citationDetails: [
          { prompt: "what is a headless cms and when should i use one", platform: "ChatGPT", aiSearchVolume: 2900, lastSeen: "2026-07-12T10:04:00Z" },
          { prompt: "headless cms explained for marketers", platform: "Google AIO", aiSearchVolume: 1400, lastSeen: "2026-07-11T08:22:00Z" },
          { prompt: "difference between headless and traditional cms", platform: "ChatGPT", aiSearchVolume: 990, lastSeen: "2026-07-09T14:47:00Z" },
        ],
      },
      {
        url: "https://acme.com/composable-dxp",
        citations: 74,
        aiSearchVolume: 3100,
        citationDetails: [
          { prompt: "what is composable dxp", platform: "Google AIO", aiSearchVolume: 1250, lastSeen: "2026-07-13T02:31:00Z" },
          { prompt: "composable vs monolithic dxp", platform: "ChatGPT", aiSearchVolume: 760, lastSeen: "2026-07-10T16:12:00Z" },
        ],
      },
      {
        url: "https://acme.com/docs/personalization",
        citations: 51,
        aiSearchVolume: 2400,
        citationDetails: [
          { prompt: "how to add personalization to a composable website", platform: "ChatGPT", aiSearchVolume: 1400, lastSeen: "2026-07-09T19:44:00Z" },
        ],
      },
      { url: "https://acme.com/blog/graphql-content-api", citations: 38, aiSearchVolume: 940, citationDetails: [] },
      {
        url: "https://acme.com/compare/contoso",
        citations: 31,
        aiSearchVolume: 880,
        citationDetails: [
          { prompt: "acme vs contoso which is better", platform: "ChatGPT", aiSearchVolume: 640, lastSeen: "2026-07-12T09:15:00Z" },
        ],
      },
      { url: "https://acme.com/blog/visual-editing", citations: 27, aiSearchVolume: 720, citationDetails: [] },
      { url: "https://acme.com/docs/content-modeling", citations: 22, aiSearchVolume: 820, citationDetails: [] },
      { url: "https://acme.com/blog/mach-architecture-explained", citations: 18, aiSearchVolume: 1300, citationDetails: [] },
      { url: "https://acme.com/customers", citations: 12, aiSearchVolume: null, citationDetails: [] },
      { url: "https://acme.com/compare/globex", citations: 9, aiSearchVolume: 410, citationDetails: [] },
    ],
    newLostTrend: [
      { date: "2025-08-01", newMentions: 84, lostMentions: 41 },
      { date: "2025-09-01", newMentions: 96, lostMentions: 52 },
      { date: "2025-10-01", newMentions: 110, lostMentions: 48 },
      { date: "2025-11-01", newMentions: 92, lostMentions: 67 },
      { date: "2025-12-01", newMentions: 105, lostMentions: 59 },
      { date: "2026-01-01", newMentions: 128, lostMentions: 62 },
      { date: "2026-02-01", newMentions: 134, lostMentions: 71 },
      { date: "2026-03-01", newMentions: 121, lostMentions: 84 },
      { date: "2026-04-01", newMentions: 142, lostMentions: 76 },
      { date: "2026-05-01", newMentions: 155, lostMentions: 69 },
      { date: "2026-06-01", newMentions: 149, lostMentions: 88 },
      { date: "2026-07-01", newMentions: 163, lostMentions: 74 },
    ],
    competitorBenchmark: { mentionsAvg: 1520, citationsAvg: 668, competitors: 3 },
    // Per configured AI topic: mentions of you vs competitors within answers
    // about that topic (llm_mentions target intersection).
    topicMentions: [
      { topic: "headless cms", yourMentions: 412, aiSearchVolume: 4200, topCompetitor: "contoso.com", topCompetitorMentions: 388 },
      { topic: "composable dxp", yourMentions: 186, aiSearchVolume: 3100, topCompetitor: "contoso.com", topCompetitorMentions: 341 },
      { topic: "personalization", yourMentions: 168, aiSearchVolume: 2400, topCompetitor: "globex.com", topCompetitorMentions: 94 },
      { topic: "mach architecture", yourMentions: 121, aiSearchVolume: 1300, topCompetitor: "globex.com", topCompetitorMentions: 88 },
      { topic: "content federation", yourMentions: 96, aiSearchVolume: 640, topCompetitor: "contoso.com", topCompetitorMentions: 43 },
    ],
    competitorCitedPages: [
      {
        competitor: "contoso.com",
        pages: [
          {
            url: "https://contoso.com/guides/dxp",
            citations: 68,
            aiSearchVolume: 3200,
            citationDetails: [
              { prompt: "what is a digital experience platform", platform: "ChatGPT", aiSearchVolume: 3200, lastSeen: "2026-07-12T10:14:00Z" },
              { prompt: "best composable dxp for enterprise", platform: "Google AIO", aiSearchVolume: 1800, lastSeen: "2026-07-11T15:02:00Z" },
            ],
          },
          { url: "https://contoso.com/why-contoso", citations: 43, aiSearchVolume: 1800, citationDetails: [] },
          {
            url: "https://contoso.com/vs/acme",
            citations: 29,
            aiSearchVolume: 640,
            citationDetails: [
              { prompt: "alternatives to acme cms", platform: "ChatGPT", aiSearchVolume: 480, lastSeen: "2026-07-10T11:40:00Z" },
            ],
          },
          { url: "https://contoso.com/learn/headless", citations: 21, aiSearchVolume: 4200, citationDetails: [] },
        ],
      },
      {
        competitor: "globex.com",
        pages: [
          {
            url: "https://globex.com/blog/mach",
            citations: 44,
            aiSearchVolume: 1300,
            citationDetails: [
              { prompt: "what is mach architecture", platform: "ChatGPT", aiSearchVolume: 1900, lastSeen: "2026-07-12T08:05:00Z" },
            ],
          },
          { url: "https://globex.com/platform", citations: 26, aiSearchVolume: 890, citationDetails: [] },
          { url: "https://globex.com/vs/acme", citations: 14, aiSearchVolume: 380, citationDetails: [] },
        ],
      },
      {
        competitor: "initech.com",
        pages: [
          { url: "https://initech.com/platform", citations: 17, aiSearchVolume: 520, citationDetails: [] },
          { url: "https://initech.com/docs/webhooks", citations: 8, aiSearchVolume: 240, citationDetails: [] },
        ],
      },
    ],
    topics: aiTopics,
    prompts: aiPrompts,
    competitorPrompts,
    sentiment: { positive: 148, neutral: 96, negative: 34 },
  },
  keywords,
  keywordGaps,
  decayingPages,
  backlinks: [
    { urlFrom: "https://techcrunch.com/2026/03/composable-web-roundup", urlTo: "https://acme.com/", anchor: "Acme", rank: 412, dofollow: true, firstSeen: "2026-03-14T00:00:00Z" },
    { urlFrom: "https://smashingmagazine.com/2026/01/headless-cms-comparison", urlTo: "https://acme.com/blog/headless-cms-guide", anchor: "headless CMS guide", rank: 386, dofollow: true, firstSeen: "2026-01-22T00:00:00Z" },
    { urlFrom: "https://dev.to/webdev/best-cms-2026", urlTo: "https://acme.com/", anchor: "Acme CMS", rank: 341, dofollow: true, firstSeen: "2026-02-08T00:00:00Z" },
    { urlFrom: "https://cmswire.com/headless-cms-roundup", urlTo: "https://acme.com/composable-dxp", anchor: "composable DXP", rank: 318, dofollow: true, firstSeen: "2025-11-30T00:00:00Z" },
    { urlFrom: "https://github.com/awesome-cms/awesome-cms", urlTo: "https://acme.com/docs", anchor: "Acme docs", rank: 296, dofollow: false, firstSeen: "2025-09-12T00:00:00Z" },
    { urlFrom: "https://news.ycombinator.com/item?id=39281734", urlTo: "https://acme.com/blog/visual-editing", anchor: null, rank: 270, dofollow: false, firstSeen: "2026-04-02T00:00:00Z" },
    { urlFrom: "https://machalliance.org/members", urlTo: "https://acme.com/", anchor: "Acme", rank: 244, dofollow: true, firstSeen: "2025-08-19T00:00:00Z" },
    { urlFrom: "https://jamstack.org/generators", urlTo: "https://acme.com/docs/content-modeling", anchor: "content modeling", rank: 221, dofollow: true, firstSeen: "2026-05-27T00:00:00Z" },
  ],
  keywordSuggestions,
}
