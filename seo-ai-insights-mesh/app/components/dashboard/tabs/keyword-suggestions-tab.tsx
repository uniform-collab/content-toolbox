/** @jsxImportSource @emotion/react */
"use client"

import { useMemo, useRef, useState } from "react"
import { css } from "@emotion/react"
import {
  Button,
  Chip,
  Icon,
  Input,
  InputSelect,
  Menu,
  MenuItem,
  ResponsiveTableContainer,
  SegmentedControl,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  Tooltip,
  toast,
} from "@uniformdev/design-system"
import type {
  AiVisibilityData,
  KeywordSuggestion,
  PromptInsightsData,
  SuggestionAlgorithm,
  SuggestionSearchState,
} from "../../../lib/types"
import { LOCATION_DEFAULT_LANGUAGE, LOCATION_OPTIONS, makeIgnoreMatcher } from "../../../lib/settings"
import { formatCompact, formatNumber, formatUsd } from "../../../lib/format"
import { VStack, SplitGrid } from "../grids"
import { CardSkeleton, DashCard, InfoTip } from "../widgets"
import { Sparkline, chartColors } from "../charts"

/* ------------------------------ constants ------------------------------ */

const ALGORITHMS: {
  value: SuggestionAlgorithm
  label: string
  info: string
  example: string
}[] = [
  {
    value: "related",
    label: "Related",
    info: "What people also search for, follows Google's own “related searches” outward from your seed.",
    example: "“headless cms” → “content api”, “jamstack architecture”",
  },
  {
    value: "contains_phrase",
    label: "Contains phrase",
    info: "Long-tail variations that contain your seed phrase, with words before, after, or in between.",
    example: "“headless cms” → “best headless cms for nextjs”",
  },
  {
    value: "same_topic",
    label: "Same topic",
    info: "Keywords from the same product or service category, even when they share no words with your seed.",
    example: "“headless cms” → “digital experience platform”",
  },
  {
    value: "from_site",
    label: "From your site",
    info: "No seed needed, keywords your configured domain is relevant for, according to its content.",
    example: `great first run when you're not sure where to start`,
  },
]

const ALGORITHM_LABEL: Record<SuggestionAlgorithm, string> = {
  related: "Related",
  contains_phrase: "Contains phrase",
  same_topic: "Same topic",
  from_site: "From your site",
}

/** Depth for “Related” in words, how far to follow the related-search chain. */
const DEPTH_OPTIONS: { value: "1" | "2" | "3"; label: string; hint: string }[] = [
  { value: "1", label: "Closely related", hint: "tight, highly relevant set" },
  { value: "2", label: "Broader set", hint: "balanced reach and relevance" },
  { value: "3", label: "Widest net", hint: "most keywords, loosest ties" },
]

const PAGE_SIZE = 25

type SortKey = "keyword" | "volume" | "aiVolume" | "cpc" | "competition"
type CompFilter = "all" | "low" | "medium" | "high"

function competitionBand(v: number): { label: string; theme: Parameters<typeof Chip>[0]["theme"] } {
  if (v < 0.33) return { label: "Low", theme: "utility-success" }
  if (v < 0.66) return { label: "Medium", theme: "utility-caution" }
  return { label: "High", theme: "utility-danger" }
}

/* ------------------------------ styles ------------------------------ */

const searchGrid = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
`
const seedRow = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--spacing-md);
`
const seedField = css`
  flex: 1 1 340px;
  min-width: 260px;
  position: relative;
`
const searchIcon = css`
  position: absolute;
  left: var(--spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
`
const seedInput = css`
  input {
    padding-left: var(--spacing-2xl);
    height: 44px;
    font-size: var(--fs-md);
  }
`
const domainChip = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  height: 44px;
  padding: 0 var(--spacing-md);
  border: 1px dashed var(--gray-300);
  border-radius: var(--rounded-md);
  background: var(--gray-50);
  color: var(--typography-base);
  font-weight: 600;
  font-family: var(--ff-mono);
  font-size: var(--fs-sm);
`
const findBlock = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
`
/* Primary CTA in Mesh brand blue, the one action this panel exists for. */
const findButtonTall = css`
  button {
    height: 44px;
    padding-inline: var(--spacing-lg);
    background: var(--primary-action-default, var(--brand-secondary-4, #0052ed));
    border-color: var(--primary-action-default, var(--brand-secondary-4, #0052ed));
    color: var(--white);
    font-weight: 600;
    &:hover:not(:disabled) {
      background: var(--primary-action-hover, var(--brand-secondary-5, #0043c4));
      border-color: var(--primary-action-hover, var(--brand-secondary-5, #0043c4));
    }
  }
`
const countryField = css`
  width: 190px;
  flex: none;
`
const fieldLabel = css`
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--typography-light);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 var(--spacing-sm);
`
/* Fixed-height explainer under the algorithm control: swapping algorithms
   changes the text, never the layout, no cumulative layout shift. */
const algoDetails = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  /* Tall enough for the depth select + its caption, so no algorithm changes the box size. */
  min-height: 112px;
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--gray-100);
  border-radius: var(--rounded-md);
  background: var(--gray-50);
`
const algoInfoText = css`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`
const algoInfoMain = css`
  font-size: var(--fs-sm);
  color: var(--typography-base);
`
const algoInfoExample = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  font-style: italic;
`
const depthField = css`
  width: 190px;
  flex: none;
`
const recentWrap = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  /* Reserved even when empty (e.g. “From your site”) so the panel height is stable. */
  min-height: 34px;
`
const recentLabel = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const recentChip = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-2xs) var(--spacing-sm);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-full);
  background: var(--white);
  font-size: var(--fs-sm);
  color: var(--typography-base);
  cursor: pointer;
  &:hover {
    border-color: var(--gray-400);
    background: var(--gray-50);
  }
`
const recentRemove = css`
  display: inline-flex;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--typography-inactive);
  padding: 0;
  &:hover {
    color: var(--utility-danger-title);
  }
`

const summaryStrip = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  background: var(--white);
`
const summaryText = css`
  font-size: var(--fs-sm);
  color: var(--typography-base);
  font-weight: 600;
`
const summaryMuted = css`
  color: var(--typography-light);
  font-weight: 500;
`
const summaryActions = css`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
`
const addBlock = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
  align-items: flex-end;
`
const addHelper = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const selectedCount = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
`
const filterBar = css`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-md) 0;
`
const minVolField = css`
  width: 150px;
`
const compField = css`
  width: 150px;
`
const hideToggle = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  color: var(--typography-light);
  cursor: pointer;
  user-select: none;
  height: 38px;
`

const sortHead = css`
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  &:hover {
    color: var(--typography-base);
  }
`
const sortInner = (right?: boolean) => css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2xs);
  ${right ? "flex-direction: row-reverse;" : ""}
`
const numMono = css`
  font-variant-numeric: tabular-nums;
`
const trackedRow = css`
  background: var(--gray-50);
`
const checkCol = css`
  width: 36px;
`
const kwCell = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
`
const kwName = css`
  font-weight: 600;
  color: var(--typography-base);
`
const aiMuted = css`
  color: var(--typography-light);
  font-variant-numeric: tabular-nums;
`
const dash = css`
  color: var(--typography-inactive);
`
const trendCell = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
`
const catText = css`
  color: var(--typography-light);
  font-size: var(--fs-xs);
  cursor: help;
`
const kebabButton = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  border-radius: var(--rounded-sm);
  cursor: pointer;
  color: var(--typography-light);
  &:hover {
    background: var(--gray-100);
    color: var(--typography-base);
  }
`

const pager = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  flex-wrap: wrap;
`
const pagerInfo = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const pagerButtons = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
`

/* demand compare card */
const compareList = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`
const compareRow = css`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-2xs);
`
const compareLabel = css`
  font-size: var(--fs-sm);
  color: var(--typography-base);
  font-weight: 500;
`
const barTrack = css`
  display: flex;
  flex-direction: column;
  gap: 3px;
`
const bar = (widthPct: number, color: string) => css`
  height: 8px;
  border-radius: var(--rounded-full);
  width: ${Math.max(2, widthPct)}%;
  background: ${color};
  transition: width 200ms ease;
`
const legendRow = css`
  display: flex;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
`
const legendItem = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  color: var(--typography-light);
`
const legendDot = (c: string) => css`
  width: 10px;
  height: 10px;
  border-radius: var(--rounded-sm);
  background: ${c};
`

/* opportunity card */
const oppList = css`
  display: flex;
  flex-direction: column;
`
const oppRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--gray-100);
  &:last-of-type {
    border-bottom: none;
  }
`
const oppMeta = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`
const oppKw = css`
  font-weight: 600;
  color: var(--typography-base);
`
const oppStats = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const oppAction = css`
  margin-left: auto;
`

/* states */
const emptyState = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl) var(--spacing-md);
`
const emptyIcon = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--rounded-full);
  background: var(--brand-primary-1);
  color: var(--primary-action-default);
`
const emptyTitle = css`
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--typography-base);
  margin: 0;
`
const emptySub = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  max-width: 42ch;
  margin: 0;
`
const exampleChips = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  justify-content: center;
  margin-top: var(--spacing-sm);
`
const noResults = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl) var(--spacing-md);
`

/* ------------------------------ component ------------------------------ */

/** Recent seeds persist per analyzed domain so projects never see each other's searches. */
function recentSeedsKey(domain: string): string {
  return `seo-ai-insights:recent-seeds:${domain || "preview"}`
}

function loadRecentSeeds(domain: string): string[] {
  try {
    const raw = window.localStorage.getItem(recentSeedsKey(domain))
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string").slice(0, 5) : []
  } catch {
    return []
  }
}

export function KeywordSuggestionsTab({
  search,
  domain,
  loading,
  live = false,
  aiVisibility = null,
  promptInsights = null,
  ignoredTerms = [],
}: {
  search: SuggestionSearchState
  domain: string
  loading?: boolean
  /** When true, searches call /api/suggestions (the live proxy) instead of the local sample catalog. */
  live?: boolean
  /** Reused (not re-fetched) to enrich results with AI demand and categories. */
  aiVisibility?: AiVisibilityData | null
  promptInsights?: PromptInsightsData | null
  /** Ignore-list terms from settings; matching suggestions are dropped. */
  ignoredTerms?: string[]
}) {
  const seedInputRef = useRef<HTMLInputElement>(null)

  // search form state
  const [algorithm, setAlgorithm] = useState<SuggestionAlgorithm>(search.algorithm)
  const [depth, setDepth] = useState<1 | 2 | 3>(2)
  const [seedText, setSeedText] = useState(search.seed)
  // Starts on the settings market; explorable per search without touching settings.
  // The language follows the market, Labs rejects invalid location/language pairs.
  const [location, setLocation] = useState(search.location)
  const effectiveLanguage =
    location === search.location ? search.language : LOCATION_DEFAULT_LANGUAGE[location] ?? "English"
  const [recentSeeds, setRecentSeedsState] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : loadRecentSeeds(domain),
  )
  const setRecentSeeds = (update: (prev: string[]) => string[]) => {
    setRecentSeedsState((prev) => {
      const next = update(prev)
      try {
        window.localStorage.setItem(recentSeedsKey(domain), JSON.stringify(next))
      } catch {
        // Persistence is best-effort; the in-memory list still works.
      }
      return next
    })
  }

  // results state (live mode starts with no preloaded results → empty state)
  const [phase, setPhase] = useState<"empty" | "loading" | "results">(search.results.length ? "results" : "empty")
  const [activeSearch, setActiveSearch] = useState<SuggestionSearchState>(search)

  // Example seeds come from THIS project's tracked AI topics, never hardcoded.
  const exampleSeeds = useMemo(
    () => (aiVisibility?.topics ?? []).slice(0, 3).map((t) => t.topic),
    [aiVisibility],
  )

  // table state
  const [tracked, setTracked] = useState<Set<string>>(
    () => new Set(search.results.filter((r) => r.alreadyTracked).map((r) => r.keyword)),
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>("volume")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [minVolume, setMinVolume] = useState("")
  const [compFilter, setCompFilter] = useState<CompFilter>("all")
  const [hideTracked, setHideTracked] = useState(false)
  const [page, setPage] = useState(0)

  function runSearch(seed: string) {
    const trimmed = algorithm === "from_site" ? domain : seed.trim()
    if (algorithm !== "from_site" && !trimmed) {
      setPhase("empty")
      requestAnimationFrame(() => seedInputRef.current?.focus())
      return
    }
    // Register the seed in recents (skip for domain mode).
    if (algorithm !== "from_site") {
      setRecentSeeds((prev) => [trimmed, ...prev.filter((s) => s !== trimmed)].slice(0, 5))
    }
    setPhase("loading")
    setPage(0)
    setSelected(new Set())

    if (live) {
      // Live mode: keyword discovery through the server-side DataForSEO proxy.
      void (async () => {
        try {
          const res = await fetch("/api/suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              algorithm,
              seed: trimmed,
              domain,
              location,
              language: effectiveLanguage,
              depth: algorithm === "related" ? depth : undefined,
            }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.message ?? `Keyword search failed (HTTP ${res.status}).`)
          setActiveSearch({
            seed: algorithm === "from_site" ? domain : trimmed,
            algorithm,
            depth: algorithm === "related" ? depth : undefined,
            location,
            language: effectiveLanguage,
            results: json.results as KeywordSuggestion[],
            searchedAt: json.searchedAt,
          })
          setPhase("results")
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Keyword search failed.", { toastId: "suggestions-error" })
          setPhase("empty")
        }
      })()
      return
    }

    window.setTimeout(() => {
      // "contains_phrase" actually filters the catalog to the phrase, so a
      // non-matching seed naturally yields the no-results state. Every other
      // algorithm returns the full precomputed set (prototype behaviour).
      const base = search.results
      const results =
        algorithm === "contains_phrase"
          ? base.filter((r) => r.keyword.toLowerCase().includes(trimmed.toLowerCase()))
          : base
      setActiveSearch({
        seed: algorithm === "from_site" ? domain : trimmed,
        algorithm,
        depth: algorithm === "related" ? depth : undefined,
        location,
        language: effectiveLanguage,
        results,
        searchedAt: new Date().toISOString(),
      })
      setPhase("results")
    }, 1500)
  }

  function isTracked(kw: string) {
    return tracked.has(kw)
  }

  function addToTracked(keywords: string[]) {
    if (keywords.length === 0) return
    setTracked((prev) => {
      const next = new Set(prev)
      keywords.forEach((k) => next.add(k))
      return next
    })
    setSelected(new Set())
    toast.success(
      keywords.length === 1
        ? `Added "${keywords[0]}" to tracked keywords`
        : `Added ${keywords.length} keywords to tracked keywords`,
    )
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "keyword" ? "asc" : "desc")
    }
  }

  /*
   * Enrich live results with knowledge we already paid for: the AI-topic
   * volumes from the LLM-mentions dataset and the Topics & Prompts run fill
   * the AI-volume and Category columns by topic match, zero extra API calls.
   */
  const enrichedResults = useMemo(() => {
    const isIgnored = makeIgnoreMatcher(ignoredTerms)
    const kept = activeSearch.results.filter((r) => !isIgnored(r.keyword))
    const known: { topic: string; volume: number | null }[] = [
      ...(aiVisibility?.topics ?? []).map((t) => ({ topic: t.topic.toLowerCase(), volume: t.aiSearchVolume })),
      ...(promptInsights?.topics ?? []).map((t) => ({ topic: t.topic.toLowerCase(), volume: t.aiSearchVolume })),
    ]
      .filter((t) => t.topic.length >= 3)
      .sort((a, b) => b.topic.length - a.topic.length) // most specific topic wins
    if (!known.length) return kept
    return kept.map((r) => {
      if (r.aiVolume != null && r.categories.length) return r
      const kw = r.keyword.toLowerCase()
      const matches = known.filter((t) => kw.includes(t.topic) || t.topic.includes(kw))
      if (!matches.length) return r
      return {
        ...r,
        aiVolume: r.aiVolume ?? matches.find((m) => m.volume != null)?.volume ?? null,
        categories: r.categories.length ? r.categories : [...new Set(matches.map((m) => m.topic))].slice(0, 2),
      }
    })
  }, [activeSearch.results, aiVisibility, promptInsights, ignoredTerms])

  const filtered = useMemo(() => {
    const min = Number(minVolume) || 0
    const rows = enrichedResults.filter((r) => {
      if (r.volume < min) return false
      if (hideTracked && isTracked(r.keyword)) return false
      if (compFilter !== "all" && competitionBand(r.competition).label.toLowerCase() !== compFilter) return false
      return true
    })
    const sorted = [...rows].sort((a, b) => {
      let av: number | string
      let bv: number | string
      if (sortKey === "keyword") {
        av = a.keyword
        bv = b.keyword
      } else if (sortKey === "aiVolume") {
        av = a.aiVolume ?? -1
        bv = b.aiVolume ?? -1
      } else {
        av = a[sortKey]
        bv = b[sortKey]
      }
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return sorted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedResults, minVolume, hideTracked, compFilter, sortKey, sortDir, tracked])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const pageRows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  const selectablePageRows = pageRows.filter((r) => !isTracked(r.keyword))
  const allPageSelected =
    selectablePageRows.length > 0 && selectablePageRows.every((r) => selected.has(r.keyword))

  function toggleSelectAllPage() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allPageSelected) {
        selectablePageRows.forEach((r) => next.delete(r.keyword))
      } else {
        selectablePageRows.forEach((r) => next.add(r.keyword))
      }
      return next
    })
  }

  function toggleSelect(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }

  // Top 8 by volume for the demand comparison card.
  const demandTop = useMemo(() => {
    const withAi = enrichedResults.filter((r) => r.aiVolume != null)
    const max = Math.max(...enrichedResults.map((r) => r.volume), 1)
    return [...withAi].sort((a, b) => b.volume - a.volume).slice(0, 8).map((r) => ({ ...r, max }))
  }, [enrichedResults])

  // Opportunity picks: high volume, low competition, not tracked.
  const opportunities = useMemo(
    () =>
      [...enrichedResults]
        .filter((r) => r.competition < 0.33 && !isTracked(r.keyword) && r.volume >= 800)
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enrichedResults, tracked],
  )

  if (loading) {
    return (
      <VStack>
        <CardSkeleton height="120px" />
        <CardSkeleton height="420px" />
      </VStack>
    )
  }

  const locale = `${activeSearch.location === "United States" ? "US" : activeSearch.location} / ${activeSearch.language}`

  const selectedCountNum = selected.size
  const addCostHint = "Added keywords are included in future snapshots"

  return (
    <VStack>
      {/* -------- Search panel -------- */}
      <DashCard
        title="Discover keywords"
        info="Find related keywords with search volume, competition, and AI demand, then add the best ones to your tracked keyword set."
      >
        <div css={searchGrid}>
          <div css={seedRow}>
            {algorithm === "from_site" ? (
              <div css={seedField}>
                <span css={fieldLabel}>Source domain</span>
                <span css={domainChip}>
                  <Icon icon="globe-alt" size="0.875rem" iconColor="gray" />
                  {domain}
                </span>
              </div>
            ) : (
              <div css={seedField}>
                <span css={fieldLabel}>Seed keyword</span>
                <div css={css`position: relative;`}>
                  <span css={searchIcon}>
                    <Icon icon="glass-alt" size="1rem" iconColor="gray" />
                  </span>
                  <div css={seedInput}>
                    <Input
                      ref={seedInputRef}
                      type="search"
                      placeholder="Enter a seed keyword, e.g. headless cms"
                      value={seedText}
                      onChange={(e) => setSeedText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                          runSearch(seedText)
                        }
                      }}
                      aria-label="Seed keyword"
                    />
                  </div>
                </div>
              </div>
            )}

            <div css={countryField}>
              <span css={fieldLabel}>Market</span>
              <InputSelect
                label="Market"
                showLabel={false}
                value={location}
                onChange={(e) => setLocation(e.currentTarget.value)}
                options={LOCATION_OPTIONS.map((l) => ({ label: l, value: l }))}
                caption={location === search.location ? "From your settings" : `Searching in ${effectiveLanguage}`}
              />
            </div>

            <div css={findBlock}>
              <span css={fieldLabel}>&nbsp;</span>
              <div css={findButtonTall}>
                <Button
                  buttonType="primary"
                  onClick={() => runSearch(seedText)}
                >
                  <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
                    <Icon icon="glass-alt" size="0.875rem" iconColor="currentColor" />
                    Find keywords
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* algorithm selector, the explainer below has a fixed height so
              switching options never shifts the layout */}
          <div>
            <span css={fieldLabel}>Discovery algorithm</span>
            <SegmentedControl
              name="discovery-algorithm"
              size="sm"
              value={algorithm}
              options={ALGORITHMS.map((a) => ({ value: a.value, label: a.label }))}
              onChange={(v) => setAlgorithm(v as SuggestionAlgorithm)}
            />
            {(() => {
              const active = ALGORITHMS.find((a) => a.value === algorithm)!
              return (
                <div css={algoDetails}>
                  <span css={algoInfoText}>
                    <span css={algoInfoMain}>{active.info}</span>
                    <span css={algoInfoExample}>{active.example}</span>
                  </span>
                  {algorithm === "related" ? (
                    <div css={depthField}>
                      <InputSelect
                        label="How far to search"
                        showLabel={false}
                        compact
                        value={String(depth)}
                        onChange={(e) => setDepth(Number(e.currentTarget.value) as 1 | 2 | 3)}
                        options={DEPTH_OPTIONS.map((d) => ({ label: d.label, value: d.value }))}
                        caption={DEPTH_OPTIONS.find((d) => d.value === String(depth))?.hint}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })()}
          </div>

          {/* recent seeds (the row is always rendered so the panel height is stable) */}
          <div css={recentWrap}>
          {algorithm === "from_site" ? (
            <span css={recentLabel}>Searches run against your configured domain, no seed keyword needed.</span>
          ) : recentSeeds.length > 0 ? (
            <>
              <span css={recentLabel}>Recent:</span>
              {recentSeeds.map((s) => (
                <span key={s} css={recentChip} role="button" tabIndex={0} onClick={() => { setSeedText(s); runSearch(s) }} onKeyDown={(e) => { if (e.key === "Enter") { setSeedText(s); runSearch(s) } }}>
                  {s}
                  <span
                    css={recentRemove}
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${s}`}
                    onClick={(e) => { e.stopPropagation(); setRecentSeeds((prev) => prev.filter((x) => x !== s)) }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setRecentSeeds((prev) => prev.filter((x) => x !== s)) } }}
                  >
                    <Icon icon="close-r" size="0.75rem" iconColor="currentColor" />
                  </span>
                </span>
              ))}
            </>
          ) : null}
          </div>
        </div>
      </DashCard>

      {/* -------- Results area -------- */}
      {phase === "empty" ? (
        <DashCard flush>
          <div css={emptyState}>
            <span css={emptyIcon}>
              <Icon icon="glass-alt" size="1.75rem" iconColor="currentColor" />
            </span>
            <h3 css={emptyTitle}>Discover keywords worth tracking</h3>
            <p css={emptySub}>
              Enter a seed keyword and pick a discovery algorithm to surface related search terms,
              their demand, and AI visibility potential.
            </p>
            {exampleSeeds.length > 0 ? (
              <div css={exampleChips}>
                {exampleSeeds.map((s) => (
                  <span key={s} css={recentChip} role="button" tabIndex={0} onClick={() => { setSeedText(s); runSearch(s) }} onKeyDown={(e) => { if (e.key === "Enter") { setSeedText(s); runSearch(s) } }}>
                    <Icon icon="glass-alt" size="0.75rem" iconColor="gray" />
                    {s}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </DashCard>
      ) : phase === "loading" ? (
        <>
          <CardSkeleton height="60px" />
          <CardSkeleton height="420px" />
        </>
      ) : activeSearch.results.length === 0 ? (
        <DashCard flush>
          <div css={noResults}>
            <Icon icon="search-found" size="2rem" iconColor="gray" />
            <h3 css={emptyTitle}>{`No keywords found for "${activeSearch.seed}"`}</h3>
            <p css={emptySub}>Try the &lsquo;Same topic&rsquo; algorithm for broader matches.</p>
            <Button
              buttonType="secondary"
              size="sm"
              onClick={() => { setAlgorithm("same_topic"); window.setTimeout(() => runSearch(activeSearch.seed), 0) }}
            >
              Switch to Same topic and retry
            </Button>
          </div>
        </DashCard>
      ) : (
        <>
          {/* summary strip */}
          <div css={summaryStrip}>
            <span css={summaryText}>
              {`${formatNumber(activeSearch.results.length)} keywords found for `}
              <span>{`"${activeSearch.seed}"`}</span>
              <span css={summaryMuted}>
                {`  ·  ${ALGORITHM_LABEL[activeSearch.algorithm]}${
                  activeSearch.depth
                    ? ` (${DEPTH_OPTIONS.find((d) => d.value === String(activeSearch.depth))?.label.toLowerCase() ?? activeSearch.depth})`
                    : ""
                }  ·  ${locale}`}
              </span>
            </span>
            <div css={summaryActions}>
              <span css={selectedCount}>{`${selectedCountNum} selected`}</span>
              <div css={addBlock}>
                <Button
                  buttonType="primary"
                  size="sm"
                  disabled={selectedCountNum === 0}
                  onClick={() => addToTracked([...selected])}
                >
                  {`Add ${selectedCountNum} to tracked keywords`}
                </Button>
                {selectedCountNum > 0 ? <span css={addHelper}>{addCostHint}</span> : null}
              </div>
            </div>
          </div>

          {/* results table */}
          <DashCard
            flush
            asOf={
              activeSearch.searchedAt
                ? `searched ${new Date(activeSearch.searchedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : undefined
            }
          >
            <div css={filterBar}>
              <div css={minVolField}>
                <Input
                  type="number"
                  label="Min volume"
                  showLabel
                  placeholder="0"
                  value={minVolume}
                  onChange={(e) => { setMinVolume(e.target.value); setPage(0) }}
                  aria-label="Minimum search volume"
                />
              </div>
              <div css={compField}>
                <InputSelect
                  label="Competition"
                  showLabel
                  value={compFilter}
                  onChange={(e) => { setCompFilter(e.target.value as CompFilter); setPage(0) }}
                  options={[
                    { label: "All", value: "all" },
                    { label: "Low", value: "low" },
                    { label: "Medium", value: "medium" },
                    { label: "High", value: "high" },
                  ]}
                />
              </div>
              <label css={hideToggle}>
                <input
                  type="checkbox"
                  checked={hideTracked}
                  onChange={(e) => { setHideTracked(e.target.checked); setPage(0) }}
                />
                Hide already tracked
              </label>
            </div>

            <ResponsiveTableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCellHead css={checkCol}>
                      <input
                        type="checkbox"
                        aria-label="Select all on page"
                        checked={allPageSelected}
                        onChange={toggleSelectAllPage}
                        disabled={selectablePageRows.length === 0}
                      />
                    </TableCellHead>
                    <TableCellHead css={sortHead} onClick={() => toggleSort("keyword")}>
                      <span css={sortInner()}>
                        Keyword
                        <SortIcon active={sortKey === "keyword"} dir={sortDir} />
                      </span>
                    </TableCellHead>
                    <TableCellHead css={sortHead} align="right" onClick={() => toggleSort("volume")}>
                      <span css={sortInner(true)}>
                        Volume
                        <SortIcon active={sortKey === "volume"} dir={sortDir} />
                      </span>
                    </TableCellHead>
                    <TableCellHead css={sortHead} align="right" onClick={() => toggleSort("aiVolume")}>
                      <span css={sortInner(true)}>
                        <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-2xs);`}>
                          AI volume
                          <InfoTip text="Monthly demand in AI assistants (ai_keyword_data). Exact per keyword where the AI dataset covers it; otherwise estimated from your tracked topics." />
                        </span>
                        <SortIcon active={sortKey === "aiVolume"} dir={sortDir} />
                      </span>
                    </TableCellHead>
                    <TableCellHead>12-mo trend</TableCellHead>
                    <TableCellHead css={sortHead} align="right" onClick={() => toggleSort("cpc")}>
                      <span css={sortInner(true)}>
                        CPC
                        <SortIcon active={sortKey === "cpc"} dir={sortDir} />
                      </span>
                    </TableCellHead>
                    <TableCellHead css={sortHead} onClick={() => toggleSort("competition")}>
                      <span css={sortInner()}>
                        Competition
                        <SortIcon active={sortKey === "competition"} dir={sortDir} />
                      </span>
                    </TableCellHead>
                    <TableCellHead>Category</TableCellHead>
                    <TableCellHead aria-label="Actions" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pageRows.map((r) => {
                    const t = isTracked(r.keyword)
                    const band = competitionBand(r.competition)
                    return (
                      <TableRow key={r.keyword} css={t ? trackedRow : undefined}>
                        <TableCellData css={checkCol}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.keyword}`}
                            checked={selected.has(r.keyword)}
                            disabled={t}
                            onChange={() => toggleSelect(r.keyword)}
                          />
                        </TableCellData>
                        <TableCellData>
                          <span css={kwCell}>
                            <span css={kwName}>{r.keyword}</span>
                            {t ? <Chip size="sm" variant="outlined" theme="neutral-light" text="Tracked" /> : null}
                          </span>
                        </TableCellData>
                        <TableCellData css={numMono} align="right">{formatCompact(r.volume)}</TableCellData>
                        <TableCellData css={numMono} align="right">
                          {r.aiVolume == null ? (
                            <span css={dash}>—</span>
                          ) : (
                            <span css={aiMuted}>{formatCompact(r.aiVolume)}</span>
                          )}
                        </TableCellData>
                        <TableCellData>
                          <span css={trendCell}>
                            <Sparkline
                              data={r.trend12mo}
                              color={
                                r.trendDirection === "up"
                                  ? "var(--utility-success-icon)"
                                  : r.trendDirection === "down"
                                    ? "var(--utility-danger-icon)"
                                    : "var(--gray-400)"
                              }
                              width={64}
                              height={22}
                            />
                            {r.trendDirection !== "flat" ? (
                              <Icon
                                icon={r.trendDirection === "up" ? "arrow-up" : "arrow-down"}
                                size="0.75rem"
                                iconColor={r.trendDirection === "up" ? "utility-success" : "red"}
                              />
                            ) : (
                              <span css={dash}>–</span>
                            )}
                          </span>
                        </TableCellData>
                        <TableCellData css={numMono} align="right">{formatUsd(r.cpc)}</TableCellData>
                        <TableCellData>
                          <Chip size="sm" variant="outlined" theme={band.theme} text={band.label} />
                        </TableCellData>
                        <TableCellData>
                          {r.categories.length ? (
                            <Tooltip title={`Matched your tracked AI topics: ${r.categories.join(", ")}`} placement="top">
                              <span css={catText}>{r.categories[0]}</span>
                            </Tooltip>
                          ) : (
                            <span css={dash}>—</span>
                          )}
                        </TableCellData>
                        <TableCellData>
                          <Menu
                            placement="bottom-end"
                            menuTrigger={
                              <button type="button" css={kebabButton} aria-label={`Actions for ${r.keyword}`}>
                                <Icon icon="more-vertical-r" size="1rem" iconColor="currentColor" />
                              </button>
                            }
                          >
                            <MenuItem
                              icon={<Icon icon="math-plus" size="0.875rem" />}
                              disabled={t}
                              onClick={() => addToTracked([r.keyword])}
                            >
                              Add to tracked keywords
                            </MenuItem>
                            <MenuItem
                              icon={<Icon icon="arrow-top-right" size="0.875rem" />}
                              onClick={() =>
                                window.open(
                                  `https://www.google.com/search?q=${encodeURIComponent(r.keyword)}`,
                                  "_blank",
                                  "noopener,noreferrer",
                                )
                              }
                            >
                              View SERP
                            </MenuItem>
                            <MenuItem
                              icon={<Icon icon="glass-alt" size="0.875rem" />}
                              onClick={() => { setSeedText(r.keyword); runSearch(r.keyword) }}
                            >
                              Find related to this
                            </MenuItem>
                          </Menu>
                        </TableCellData>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ResponsiveTableContainer>

            <div css={pager}>
              <span css={pagerInfo}>
                {filtered.length === 0
                  ? "No keywords match the current filters"
                  : `Showing ${currentPage * PAGE_SIZE + 1}–${Math.min(
                      (currentPage + 1) * PAGE_SIZE,
                      filtered.length,
                    )} of ${filtered.length}`}
              </span>
              <div css={pagerButtons}>
                <Button
                  buttonType="tertiary"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <Icon icon="chevron-left" size="0.875rem" iconColor="currentColor" />
                </Button>
                <span css={pagerInfo}>{`Page ${currentPage + 1} of ${pageCount}`}</span>
                <Button
                  buttonType="tertiary"
                  size="sm"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  <Icon icon="chevron-right" size="0.875rem" iconColor="currentColor" />
                </Button>
              </div>
            </div>
          </DashCard>

          {/* insight cards */}
          <SplitGrid>
            <DashCard
              title="Classic vs AI demand"
              info="Compares Google search volume with AI-assistant demand. AI demand is matched from the topic volumes already collected by your AI Visibility and Topics & Prompts runs, no extra data spend."
            >
              {demandTop.length === 0 ? (
                <p css={emptySub}>
                  None of these keywords match a tracked AI topic yet. Add related topics in settings (or run
                  Topics &amp; Prompts) and AI demand will appear here.
                </p>
              ) : (
                <>
                  <div css={legendRow}>
                    <span css={legendItem}>
                      <span css={legendDot(chartColors.neutral)} />
                      Google volume
                    </span>
                    <span css={legendItem}>
                      <span css={legendDot("var(--primary-action-default)")} />
                      AI search volume
                    </span>
                  </div>
                  <div css={compareList}>
                    {demandTop.map((r) => (
                      <Tooltip
                        key={r.keyword}
                        placement="top"
                        title={`Google ${formatNumber(r.volume)} · AI ${formatNumber(r.aiVolume ?? 0)}`}
                      >
                        <div css={compareRow}>
                          <span css={compareLabel}>{r.keyword}</span>
                          <div css={barTrack}>
                            <span css={bar((r.volume / r.max) * 100, chartColors.neutral)} />
                            <span css={bar(((r.aiVolume ?? 0) / r.max) * 100, "var(--primary-action-default)")} />
                          </div>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </>
              )}
            </DashCard>

            <DashCard
              title="Opportunity picks"
              info="High-volume keywords with low competition that you are not tracking yet, quick wins to add to your snapshot."
            >
              {opportunities.length === 0 ? (
                <p css={emptySub}>No untracked low-competition opportunities in this result set.</p>
              ) : (
                <div css={oppList}>
                  {opportunities.map((r) => (
                    <div css={oppRow} key={r.keyword}>
                      <span css={oppMeta}>
                        <span css={oppKw}>{r.keyword}</span>
                        <span css={oppStats}>
                          {`${formatCompact(r.volume)} vol · ${competitionBand(r.competition).label} comp · ${formatUsd(r.cpc)} CPC`}
                        </span>
                      </span>
                      <span css={oppAction}>
                        <Button
                          buttonType="secondary"
                          size="sm"
                          onClick={() => addToTracked([r.keyword])}
                        >
                          <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-2xs);`}>
                            <Icon icon="math-plus" size="0.75rem" iconColor="currentColor" />
                            Track
                          </span>
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DashCard>
          </SplitGrid>
        </>
      )}
    </VStack>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <Icon
      icon={active ? (dir === "asc" ? "arrow-up" : "arrow-down") : "details-more"}
      size="0.75rem"
      iconColor={active ? "currentColor" : "gray"}
    />
  )
}
