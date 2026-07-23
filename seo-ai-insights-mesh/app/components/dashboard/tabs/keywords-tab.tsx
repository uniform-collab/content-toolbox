/** @jsxImportSource @emotion/react */
"use client"

import { useMemo, useState } from "react"
import { css } from "@emotion/react"
import {
  Chip,
  Icon,
  Input,
  ResponsiveTableContainer,
  SegmentedControl,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  Tooltip,
} from "@uniformdev/design-system"
import type { KeywordRow, KeywordSegment, SerpFeature } from "../../../lib/types"
import { formatCompact, truncateUrl } from "../../../lib/format"
import { VStack } from "../grids"
import { CardSkeleton, DashCard, PositionDelta } from "../widgets"
import { BrandLogo } from "../brand-logo"

const controls = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
`
const searchWrap = css`
  flex: 1 1 260px;
  min-width: 220px;
`
const spacer = css`
  margin-left: auto;
`
const toggleRow = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  color: var(--typography-light);
  cursor: pointer;
  user-select: none;
`
const note = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  margin: 0 0 var(--spacing-md);
`
const numCell = css`
  font-variant-numeric: tabular-nums;
  text-align: right;
`
const sortHead = css`
  cursor: pointer;
  user-select: none;
`
const sortInner = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2xs);
`
const kwText = css`
  font-weight: 600;
  color: var(--typography-base);
`
const urlText = css`
  font-family: var(--ff-mono);
  font-size: var(--fs-xs);
  color: var(--typography-light);
  display: block;
  margin-top: 2px;
`
const featureRow = css`
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--spacing-2xs);
`
const strikingRow = css`
  background: var(--utility-caution-container);
`
const posCell = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-variant-numeric: tabular-nums;
`
const posNum = css`
  font-weight: 700;
  color: var(--typography-base);
`
const emptyState = css`
  padding: var(--spacing-2xl) var(--spacing-md);
  text-align: center;
  color: var(--typography-light);
  font-size: var(--fs-sm);
`
const gapCompetitor = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-family: var(--ff-mono);
  font-size: var(--fs-xs);
  color: var(--typography-base);
`
const fixedTable = css`
  table-layout: fixed;
  width: 100%;
`
const sdDot = css`
  display: inline-block;
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: var(--rounded-full);
  background: var(--utility-caution-icon);
  cursor: help;
`

const SEGMENTS: { label: string; value: KeywordSegment | "all" }[] = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Improved", value: "improved" },
  { label: "Declined", value: "declined" },
  { label: "Lost", value: "lost" },
  { label: "Stable", value: "stable" },
]

const FEATURE_LABEL: Record<SerpFeature, { text: string; theme: Parameters<typeof Chip>[0]["theme"]; explain: string }> = {
  featured_snippet: {
    text: "Snippet",
    theme: "utility-info",
    explain: "Featured snippet: Google shows a page's answer in a box at the top of the results.",
  },
  aio_cited: {
    text: "AI cited",
    theme: "utility-success",
    explain: "Your page is cited as a source inside Google's AI Overview answer for this keyword. The strongest AI visibility signal.",
  },
  aio: {
    text: "AI overview",
    theme: "utility-caution",
    explain: "Google answers this keyword with an AI Overview, and your page is not cited in it. A citability opportunity.",
  },
  paa: {
    text: "PAA",
    theme: "neutral-light",
    explain: "People Also Ask: the results include expandable related questions. Answering them on your page can win those spots.",
  },
}

type SortKey = "position" | "volume" | "aiVolume" | "estTraffic"

/** Cap at two chips; each explains itself on hover, the rest collapse into "+n". */
function FeatureChips({ features }: { features: SerpFeature[] }) {
  if (features.length === 0) return <span css={css`color: var(--typography-inactive);`}>—</span>
  const shown = features.slice(0, 2)
  const rest = features.slice(2)
  return (
    <span css={featureRow}>
      {shown.map((f) => (
        <Tooltip title={FEATURE_LABEL[f].explain} placement="top" key={f}>
          <span>
            <Chip size="sm" variant="outlined" theme={FEATURE_LABEL[f].theme} text={FEATURE_LABEL[f].text} />
          </span>
        </Tooltip>
      ))}
      {rest.length ? (
        <Tooltip
          title={rest.map((f) => `${FEATURE_LABEL[f].text}: ${FEATURE_LABEL[f].explain}`).join(" ")}
          placement="top"
        >
          <span>
            <Chip size="sm" variant="outlined" theme="neutral-light" text={`+${rest.length}`} />
          </span>
        </Tooltip>
      ) : null}
    </span>
  )
}

export function KeywordsTab({
  rows: keywords,
  gaps,
  domain = "",
  brandAliases = [],
  loading,
  asOf,
}: {
  rows: KeywordRow[]
  gaps: {
    keyword: string
    volume: number
    competitor: string
    competitorPosition: number
    difficulty: "low" | "medium" | "high"
  }[]
  /** Your domain; its name is treated as a brand term in the gap filter. */
  domain?: string
  /** Brand names from settings, used by the gap brand filter. */
  brandAliases?: string[]
  loading?: boolean
  asOf: string
}) {
  const [segment, setSegment] = useState<KeywordSegment | "all">("all")
  const [query, setQuery] = useState("")
  const [strikingOnly, setStrikingOnly] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("volume")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  // Navigational brand searches ("huhtamaki near me") aren't content
  // opportunities, so the gap list hides them by default.
  const [hideBrandGaps, setHideBrandGaps] = useState(true)

  const visibleGaps = useMemo(() => {
    if (!hideBrandGaps) return gaps
    const brandTerms = new Set(
      [
        domain.split(".")[0],
        ...brandAliases.map((b) => b.trim().toLowerCase()),
        ...gaps.map((g) => g.competitor.split(".")[0]),
      ].filter((t) => t.length >= 3),
    )
    return gaps.filter((g) => {
      const kw = g.keyword.toLowerCase()
      return ![...brandTerms].some((t) => kw.includes(t))
    })
  }, [gaps, hideBrandGaps, domain, brandAliases])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      // position sorts ascending (best first) by default, others descending
      setSortDir(key === "position" ? "asc" : "desc")
    }
  }

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = keywords.filter((k) => {
      if (segment !== "all" && k.segment !== segment) return false
      if (strikingOnly && !k.strikingDistance) return false
      if (q && !k.keyword.toLowerCase().includes(q)) return false
      return true
    })
    const sorted = [...filtered].sort((a, b) => {
      // aiVolume can be null in live mode; sort nulls last regardless of direction.
      const av = a[sortKey] ?? -1
      const bv = b[sortKey] ?? -1
      return sortDir === "asc" ? av - bv : bv - av
    })
    return sorted
  }, [keywords, segment, query, strikingOnly, sortKey, sortDir])

  const strikingCount = keywords.filter((k) => k.strikingDistance).length

  if (loading) {
    return (
      <VStack>
        <CardSkeleton height="420px" />
        <CardSkeleton height="240px" />
      </VStack>
    )
  }

  function SortLabel({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k
    return (
      <span css={sortInner}>
        {label}
        <Icon
          icon={active ? (sortDir === "asc" ? "arrow-up" : "arrow-down") : "details-more"}
          size="0.75rem"
          iconColor={active ? "currentColor" : "gray"}
        />
      </span>
    )
  }

  return (
    <VStack>
      <DashCard
        title="Tracked keywords"
        info="Keywords tracked for this domain in the selected country and language. Position is your best ranking URL in organic search at the latest snapshot."
        asOf={asOf}
        flush
      >
        <div css={css`padding: var(--spacing-md) var(--spacing-md) 0;`}>
          <div css={controls}>
            <div css={searchWrap}>
              <Input
                type="search"
                placeholder="Filter keywords…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter keywords"
              />
            </div>
            <SegmentedControl
              name="keyword-segment"
              size="sm"
              value={segment}
              options={SEGMENTS}
              onChange={(v) => setSegment(v as KeywordSegment | "all")}
            />
            <label css={[toggleRow, spacer]}>
              <input
                type="checkbox"
                checked={strikingOnly}
                onChange={(e) => setStrikingOnly(e.target.checked)}
              />
              {`Striking distance only (${strikingCount})`}
            </label>
          </div>
        </div>

        <ResponsiveTableContainer>
          <Table css={fixedTable}>
            <TableHead>
              <TableRow>
                <TableCellHead css={css`width: 32%;`}>Keyword</TableCellHead>
                <TableCellHead css={[sortHead, css`width: 10%;`]} onClick={() => toggleSort("position")} align="right">
                  <SortLabel label="Position" k="position" />
                </TableCellHead>
                <TableCellHead css={css`width: 9%;`}>Change</TableCellHead>
                <TableCellHead css={css`width: 17%;`}>SERP features</TableCellHead>
                <TableCellHead css={[sortHead, css`width: 10%;`]} onClick={() => toggleSort("volume")} align="right">
                  <SortLabel label="Volume" k="volume" />
                </TableCellHead>
                <TableCellHead css={[sortHead, css`width: 11%;`]} onClick={() => toggleSort("aiVolume")} align="right">
                  <SortLabel label="AI volume" k="aiVolume" />
                </TableCellHead>
                <TableCellHead css={[sortHead, css`width: 11%;`]} onClick={() => toggleSort("estTraffic")} align="right">
                  <SortLabel label="Est. traffic" k="estTraffic" />
                </TableCellHead>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k.keyword} css={k.strikingDistance && strikingOnly ? strikingRow : undefined}>
                  <TableCellData>
                    <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); max-width: 100%;`}>
                      <span css={[kwText, css`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`]} title={k.keyword}>{k.keyword}</span>
                      {k.strikingDistance ? (
                        <Tooltip title="Striking distance: ranks 4 to 15, close to a page-one top spot." placement="top">
                          <span css={sdDot} aria-label="Striking distance" role="img" />
                        </Tooltip>
                      ) : null}
                    </span>
                    <span css={urlText} title={k.url}>{truncateUrl(k.url, 44)}</span>
                  </TableCellData>
                  <TableCellData css={numCell}>
                    <span css={posNum}>{k.position}</span>
                  </TableCellData>
                  <TableCellData>
                    <PositionDelta delta={k.delta} />
                  </TableCellData>
                  <TableCellData>
                    <FeatureChips features={k.serpFeatures} />
                  </TableCellData>
                  <TableCellData css={numCell}>{formatCompact(k.volume)}</TableCellData>
                  <TableCellData css={numCell}>{k.aiVolume != null ? formatCompact(k.aiVolume) : "—"}</TableCellData>
                  <TableCellData css={numCell}>{formatCompact(k.estTraffic)}</TableCellData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>

        {rows.length === 0 ? (
          <div css={emptyState}>No keywords match the current filters.</div>
        ) : (
          <div css={css`padding: var(--spacing-sm) var(--spacing-md); font-size: var(--fs-xs); color: var(--typography-light);`}>
            {`Showing ${rows.length} of ${keywords.length} keywords`}
          </div>
        )}
      </DashCard>

      <DashCard
        title="Keyword gaps"
        info="Keywords where a tracked competitor ranks on page one but your domain does not. Prioritized opportunities to create or improve content."
        asOf={asOf}
        flush
      >
        {gaps.length === 0 ? (
          <div css={emptyState}>
            No keyword gaps found yet. Gaps appear once tracked competitors rank on page one for terms you don&apos;t rank for.
          </div>
        ) : (
        <>
        <div css={css`padding: var(--spacing-md) var(--spacing-md) 0; display: flex; flex-wrap: wrap; align-items: center; gap: var(--spacing-md);`}>
          <p css={[note, css`margin: 0; flex: 1;`]}>Competitors rank on page one for these terms, and you don&apos;t yet.</p>
          <label css={toggleRow}>
            <input
              type="checkbox"
              checked={hideBrandGaps}
              onChange={(e) => setHideBrandGaps(e.target.checked)}
            />
            {`Hide brand terms${hideBrandGaps && gaps.length !== visibleGaps.length ? ` (${gaps.length - visibleGaps.length} hidden)` : ""}`}
          </label>
        </div>
        {visibleGaps.length === 0 ? (
          <div css={emptyState}>
            Every gap here is a brand-name search. Untick &ldquo;Hide brand terms&rdquo; to see them anyway.
          </div>
        ) : (
        <ResponsiveTableContainer>
          <Table css={fixedTable}>
            <TableHead>
              <TableRow>
                <TableCellHead css={css`width: 34%;`}>Keyword</TableCellHead>
                <TableCellHead css={css`width: 13%;`} align="right">Volume</TableCellHead>
                <TableCellHead css={css`width: 25%;`}>Ranking competitor</TableCellHead>
                <TableCellHead css={css`width: 14%;`} align="right">Their position</TableCellHead>
                <TableCellHead css={css`width: 14%;`}>Difficulty</TableCellHead>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleGaps.map((g) => (
                <TableRow key={g.keyword}>
                  <TableCellData>
                    <span css={kwText}>{g.keyword}</span>
                  </TableCellData>
                  <TableCellData css={numCell}>{formatCompact(g.volume)}</TableCellData>
                  <TableCellData>
                    <span css={gapCompetitor}>
                      <BrandLogo domain={g.competitor} size={16} />
                      {g.competitor}
                    </span>
                  </TableCellData>
                  <TableCellData css={numCell}>{g.competitorPosition}</TableCellData>
                  <TableCellData>
                    <Chip
                      size="sm"
                      variant="outlined"
                      theme={
                        g.difficulty === "low"
                          ? "utility-success"
                          : g.difficulty === "medium"
                            ? "utility-caution"
                            : "utility-danger"
                      }
                      text={g.difficulty}
                    />
                  </TableCellData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ResponsiveTableContainer>
        )}
        </>
        )}
      </DashCard>
    </VStack>
  )
}
