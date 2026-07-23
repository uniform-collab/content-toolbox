/**
 * Opportunity derivation for the Opportunities tab (and the Overview's
 * "What to do next" card, which shows the top slice of the same lists).
 *
 * Everything is computed from data the dashboard already holds
 * (DashboardData + PromptInsightsData), no additional DataForSEO calls.
 * Every opportunity names a concrete action AND, where possible, a "model"
 * page to imitate: the competitor page AI assistants cite most for the topic,
 * or the top source cited for a prompt.
 */

import type { DashboardData, PromptInsightsData } from "./types"
import { formatCompact } from "./format"

export type OpportunityTab = "overview" | "opportunities" | "ai" | "prompts" | "keywords" | "suggestions" | "decaying"

export type OpportunityAction = "create" | "expand" | "refresh" | "citability" | "earn"

export const ACTION_LABEL: Record<OpportunityAction, string> = {
  create: "Create page",
  expand: "Expand page",
  refresh: "Refresh page",
  citability: "Make citable",
  earn: "Earn mentions",
}

export interface Opportunity {
  id: string
  action: OpportunityAction
  title: string
  /** The data behind it, volumes, positions, mention gaps. */
  why: string
  impact: "high" | "medium" | "low"
  /** Internal ranking weight (roughly monthly demand at stake). */
  score: number
  /** The page to imitate, what "winning content" looks like for this item. */
  model?: { url: string; domain: string; note: string }
  /** Your page to work on, when one already exists. */
  target?: { url?: string; uniformEditUrl?: string }
  cta: { label: string; tab?: OpportunityTab; href?: string }
}

/* ------------------------------ helpers ------------------------------ */

/** What kind of page fits this keyword's intent. */
function pageTypeFor(keyword: string): string {
  const k = keyword.toLowerCase()
  if (/(^|\s)(what|how|why)(\s|\?|$)/.test(k) || /guide|tutorial|explained/.test(k)) return "guide"
  if (/best|top \d|vs\.?(\s|$)|versus|alternative|compar|review/.test(k)) return "comparison page"
  return "landing page"
}

function impactOf(score: number): "high" | "medium" | "low" {
  return score >= 3000 ? "high" : score >= 800 ? "medium" : "low"
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

/* ------------------------- keyword opportunities ------------------------- */

export function buildKeywordOpportunities(d: DashboardData): Opportunity[] {
  const out: Opportunity[] = []
  const usedKeywords = new Set<string>()
  const usedPages = new Set<string>()

  /* 1. Striking distance, the best effort-to-reward ratio there is. */
  const striking = d.keywords
    .filter((k) => k.strikingDistance)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 4)
  for (const k of striking) {
    usedKeywords.add(k.keyword)
    if (k.url) usedPages.add(k.url)
    const score = k.volume * (k.position <= 10 ? 1.5 : 1)
    out.push({
      id: `sd:${k.keyword}`,
      action: "expand",
      title: `Expand your ${pageTypeFor(k.keyword)} for “${k.keyword}”`,
      why: `Ranks #${k.position} with ${formatCompact(k.volume)} searches/mo, answer the query directly near the top, refresh facts, and add internal links to push it into the top 3.`,
      impact: impactOf(score),
      score,
      target: { url: k.url || undefined },
      cta: { label: "Open Keywords", tab: "keywords" },
    })
  }

  /* 2. Biggest losses, recover before the slide compounds. */
  for (const m of d.overview.movers.losses.slice(0, 2)) {
    if (usedKeywords.has(m.keyword)) continue
    usedKeywords.add(m.keyword)
    const drop = m.to - m.from
    const score = m.volume * Math.min(2, drop / 4)
    out.push({
      id: `loss:${m.keyword}`,
      action: "refresh",
      title: `Recover “${m.keyword}” (slipped ${m.from}→${m.to})`,
      why: `Dropped ${drop} places since the last snapshot with ${formatCompact(m.volume)} searches/mo at stake, a content refresh usually reverses an early slide.`,
      impact: impactOf(score),
      score,
      cta: { label: "Open Keywords", tab: "keywords" },
    })
  }

  /* 3. Page-two keywords with real demand, one good edit from page one. */
  const pageTwo = d.keywords
    .filter((k) => !k.strikingDistance && k.position >= 11 && k.position <= 20 && k.volume >= 500 && !usedKeywords.has(k.keyword))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 2)
  for (const k of pageTwo) {
    usedKeywords.add(k.keyword)
    out.push({
      id: `p2:${k.keyword}`,
      action: "expand",
      title: `Bring “${k.keyword}” onto page one`,
      why: `Stuck at #${k.position} with ${formatCompact(k.volume)} searches/mo, add the section top-ranking pages have and yours doesn't.`,
      impact: impactOf(k.volume),
      score: k.volume,
      target: { url: k.url || undefined },
      cta: { label: "Open Keywords", tab: "keywords" },
    })
  }

  /* 4. Decaying pages, refresh beats rewrite, and they deep-link into Uniform. */
  for (const p of d.decayingPages.slice(0, 2)) {
    if (usedPages.has(p.path)) continue
    const score = Math.abs(p.trafficDelta) * 4
    out.push({
      id: `decay:${p.path}`,
      action: "refresh",
      title: `Refresh ${p.path}`,
      why: `Losing ~${formatCompact(Math.abs(p.trafficDelta))} visits/mo${
        p.keywordsLost.length ? `, slipping on “${p.keywordsLost[0].keyword}” (${p.keywordsLost[0].from}→${p.keywordsLost[0].to})` : ""
      }. Update facts, answer the main question in the intro, republish.`,
      impact: impactOf(score),
      score,
      target: { uniformEditUrl: p.uniformEditUrl || undefined },
      cta: p.uniformEditUrl
        ? { label: "Edit in Uniform", href: p.uniformEditUrl }
        : { label: "Open Decaying content", tab: "decaying" },
    })
  }

  /* 5. Keyword gaps, competitors already earn this traffic. */
  for (const g of (d.keywordGaps ?? []).slice(0, 2)) {
    if (usedKeywords.has(g.keyword)) continue
    out.push({
      id: `gap:${g.keyword}`,
      action: "create",
      title: `Create a ${pageTypeFor(g.keyword)} for “${g.keyword}”`,
      why: `${g.competitor} ranks #${g.competitorPosition} on ${formatCompact(g.volume)} searches/mo and you don't rank at all, ${g.difficulty} difficulty.`,
      impact: impactOf(g.volume),
      score: g.volume,
      model: { url: `https://${g.competitor}`, domain: g.competitor, note: `ranks #${g.competitorPosition} today` },
      cta: { label: "Open Keywords", tab: "keywords" },
    })
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 8)
}

/* --------------------------- AI opportunities --------------------------- */

export function buildAiOpportunities(d: DashboardData, promptInsights: PromptInsightsData | null): Opportunity[] {
  const out: Opportunity[] = []
  const ai = d.aiVisibility

  /* 1. Topic gaps, a competitor owns the AI conversation on your topic. */
  if (ai) {
    const gaps = ai.topicMentions
      .filter((t) => t.topCompetitor && t.topCompetitorMentions > t.yourMentions)
      .sort((a, b) => b.topCompetitorMentions - b.yourMentions - (a.topCompetitorMentions - a.yourMentions))
      .slice(0, 3)
    for (const t of gaps) {
      const compPages = ai.competitorCitedPages.find((c) => c.competitor === t.topCompetitor)?.pages ?? []
      const model = compPages[0]
      const score = (t.aiSearchVolume ?? 300) + (t.topCompetitorMentions - t.yourMentions) * 20
      out.push({
        id: `topic:${t.topic}`,
        action: "create",
        title: `Create the definitive page on “${t.topic}”`,
        why: `${t.topCompetitor} gets ${formatCompact(t.topCompetitorMentions)} AI mentions on this topic vs your ${formatCompact(t.yourMentions)}${
          t.aiSearchVolume ? `, ${formatCompact(t.aiSearchVolume)} AI searches/mo` : ""
        }.`,
        impact: impactOf(score),
        score,
        model: model
          ? { url: model.url, domain: t.topCompetitor!, note: `their most-cited page (${model.citations}× in AI answers)` }
          : undefined,
        cta: { label: "See topic mentions", tab: "ai" },
      })
    }
  }

  if (promptInsights) {
    /* 2. Invisible prompts, no assistant mentions you at all. */
    const invisible = promptInsights.prompts
      .filter((p) => p.visibilityPct === 0)
      .slice(0, 2)
    for (const p of invisible) {
      const model = p.topSources.find((s) => s.owner !== "yours")
      out.push({
        id: `prompt0:${p.prompt}`,
        action: "create",
        title: `Create a page that answers “${p.prompt}”`,
        why: "You're invisible in all four assistants' answers for this prompt, publish a page that answers it verbatim near the top.",
        impact: "high",
        score: 2600,
        model: model
          ? { url: model.url, domain: model.domain, note: `cited ${model.count}× for this prompt` }
          : undefined,
        cta: { label: "Open Topics & Prompts", tab: "prompts" },
      })
    }

    /* 3. Low-visibility prompts, reuse the per-prompt recommendation. */
    const weak = promptInsights.prompts
      .filter((p) => p.visibilityPct > 0 && p.visibilityPct < 50)
      .sort((a, b) => a.visibilityPct - b.visibilityPct)
      .slice(0, 2)
    for (const p of weak) {
      const model = p.topSources.find((s) => s.owner !== "yours")
      out.push({
        id: `promptW:${p.prompt}`,
        action: "citability",
        title: `Win more answers for “${p.prompt}”`,
        why: `Visible in only ${p.visibilityPct}% of answers. ${p.recommendation}`,
        impact: "medium",
        score: 1200,
        model: model
          ? { url: model.url, domain: model.domain, note: `top cited source (${model.count}×)` }
          : undefined,
        cta: { label: "Open Topics & Prompts", tab: "prompts" },
      })
    }
  }

  /* 4. Mentioned but not cited, name recognition without the traffic. */
  if (ai && ai.kpis.mentions.value > 0 && ai.kpis.citationRatePct.value < 50) {
    const topOwned = ai.ownedCitedPages[0]
    const score = ai.kpis.mentions.value * 8
    out.push({
      id: "citability:overall",
      action: "citability",
      title: "Turn AI mentions into citations",
      why: `Only ${ai.kpis.citationRatePct.value}% of your ${formatCompact(ai.kpis.mentions.value)} monthly AI mentions cite a page, add direct answers, data points, and sources to your most-mentioned pages.`,
      impact: impactOf(score),
      score,
      target: { url: topOwned?.url },
      cta: { label: "Review cited pages", tab: "ai" },
    })
  }

  /* 5. Assistant gaps, a competitor leads a specific assistant's answers. */
  if (promptInsights) {
    const lost = (promptInsights.byAssistant ?? []).filter((a) => a.leader && !a.leaderIsYou)
    if (lost.length) {
      const worst = lost.sort((a, b) => b.leaderMentions - a.leaderMentions)[0]
      out.push({
        id: `assistant:${worst.platform}`,
        action: "earn",
        title: `Close the gap on ${worst.platform}`,
        why: `${worst.leader} is ${worst.platform}'s most-mentioned brand across your prompts (${formatCompact(worst.leaderMentions)} vs your ${formatCompact(worst.yourMentions)})${
          lost.length > 1 ? `, plus ${lost.length - 1} more assistant${lost.length > 2 ? "s" : ""} lean${lost.length === 2 ? "s" : ""} their way` : ""
        }. Earn mentions in the publications that assistant cites.`,
        impact: "medium",
        score: 1000,
        cta: { label: "Open Topics & Prompts", tab: "prompts" },
      })
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, 8)
}

/** The overall top-N across both lists, for the Overview's "What to do next". */
export function topOpportunities(
  d: DashboardData,
  promptInsights: PromptInsightsData | null,
  n = 5,
): Opportunity[] {
  return [...buildKeywordOpportunities(d), ...buildAiOpportunities(d, promptInsights)]
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
}
