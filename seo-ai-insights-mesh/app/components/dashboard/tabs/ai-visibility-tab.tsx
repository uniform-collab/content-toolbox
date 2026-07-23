/** @jsxImportSource @emotion/react */
"use client"

import { useMemo, useState } from "react"
import { css } from "@emotion/react"
import {
  Button,
  Chip,
  Icon,
  ResponsiveTableContainer,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  Tooltip,
} from "@uniformdev/design-system"
import type { AiVisibilityData, CitedPage, PromptInsightsData, TopicMentionRow } from "../../../lib/types"
import { AI_PLATFORM_DOMAIN } from "../../../lib/types"
import { formatCompact, truncateUrl } from "../../../lib/format"
import { AutoGrid, SplitGrid, VStack } from "../grids"
import { CardSkeleton, DashCard, InfoTip, KpiCard, KpiSkeleton } from "../widgets"
import { ByModelChart, MiniDonut, NewLostChart, ScoreGauge, ShareOfVoiceChart, chartColors } from "../charts"
import { BrandLogo, PlatformLogo } from "../brand-logo"

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
  justify-content: flex-end;
`
const legend = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
`
const legendBtn = (active: boolean, color: string) => css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-2xs) var(--spacing-sm);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-full);
  background: ${active ? "var(--gray-50)" : "var(--white)"};
  cursor: pointer;
  font-size: var(--fs-xs);
  color: ${active ? "var(--typography-base)" : "var(--typography-inactive)"};
  &::before {
    content: "";
    width: 10px;
    height: 10px;
    border-radius: var(--rounded-sm);
    background: ${active ? color : "var(--gray-300)"};
  }
`
/* ---- hero cards ---- */
const heroCard = css`
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
`
const heroLabelRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
`
const heroLabel = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  font-weight: 500;
`
const gaugeWrap = css`
  position: relative;
  display: flex;
  justify-content: center;
`
const gaugeCenter = css`
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  text-align: center;
`
const gaugeScore = css`
  font-size: var(--fs-xl, 28px);
  font-weight: 700;
  line-height: 1;
  color: var(--typography-base);
`
const gaugeOutOf = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const gaugeVerdict = (color: string) => css`
  text-align: center;
  font-weight: 700;
  color: ${color};
`
const gaugeSub = css`
  text-align: center;
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const donutRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
`
const donutCenterWrap = css`
  position: relative;
  flex: none;
  display: flex;
`
const donutCenter = css`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--typography-base);
`
const sentLegend = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const sentDot = (c: string) => css`
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: var(--rounded-sm);
  background: ${c};
  margin-right: var(--spacing-2xs);
`
const unavailableBox = css`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--fs-xs);
  color: var(--typography-inactive);
  text-align: center;
  padding: var(--spacing-md) 0;
`
/* ---- by-assistant rows ---- */
const assistantRow = css`
  display: grid;
  grid-template-columns: 110px 1fr auto auto;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  font-size: var(--fs-sm);
`
const leaderCell = css`
  display: flex;
  justify-content: flex-end;
`
const assistantName = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-weight: 600;
  color: var(--typography-base);
`
const assistantBarTrack = css`
  display: block;
  min-width: 56px;
  height: 8px;
  border-radius: var(--rounded-full);
  background: var(--gray-100);
  overflow: hidden;
`
const assistantBarFill = (pct: number) => css`
  width: ${Math.max(pct, 2)}%;
  height: 100%;
  border-radius: inherit;
  background: ${pct >= 75 ? "var(--utility-success-icon)" : pct >= 40 ? "var(--utility-caution-icon)" : "var(--utility-danger-icon)"};
  transition: width 500ms ease;
`
const assistantStats = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  font-variant-numeric: tabular-nums;
  text-align: right;
  white-space: nowrap;
`
const assistantDivider = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin: var(--spacing-md) 0 var(--spacing-xs);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--typography-light);
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--gray-200);
  }
`
const promptHint = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  font-size: var(--fs-xs);
  color: var(--typography-light);
  background: var(--gray-50);
  border-radius: var(--rounded-md);
  padding: var(--spacing-sm) var(--spacing-md);
`
/* ---- cited pages ---- */
const fixedTable = css`
  table-layout: fixed;
  width: 100%;
`
const pageLink = css`
  font-family: var(--ff-mono);
  font-size: var(--fs-xs);
  color: var(--typography-base);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  max-width: 100%;
  vertical-align: bottom;
  &:hover {
    text-decoration: underline;
    color: var(--brand-secondary-4, #0052ed);
  }
`
const citedForWrap = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2xs);
`
const compGroup = css`
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 1px solid var(--gray-200);
  &:first-of-type {
    border-top: none;
  }
`
const expandBtn = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: none;
  border-radius: var(--rounded-md);
  cursor: pointer;
  color: var(--gray-500);
  &:hover {
    background: var(--gray-100);
    color: var(--typography-base);
  }
`
const chevron = (open: boolean) => css`
  display: inline-flex;
  transform: rotate(${open ? 180 : 0}deg);
  transition: transform 200ms ease;
  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`
/* Fixed column widths so logos and metadata align across sibling rows
   (each row is its own grid, auto columns would drift with text width). */
const citationRow = css`
  display: grid;
  grid-template-columns: 1fr 28px 96px 88px;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xs) 0;
  font-size: var(--fs-sm);
`
const citationLogoCell = css`
  display: flex;
  justify-content: center;
`
const citationPrompt = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--typography-base);
  &::before {
    content: "“";
    color: var(--typography-inactive);
  }
  &::after {
    content: "”";
    color: var(--typography-inactive);
  }
`
const citationMeta = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: right;
`
const citationListTitle = css`
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--typography-light);
  margin: 0 0 var(--spacing-xs);
`
const compHeader = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
  font-weight: 600;
  color: var(--typography-base);
`

/* --------------------------- hero components --------------------------- */

function scoreVerdict(score: number): { label: string; color: string } {
  if (score < 10) return { label: "Low", color: "var(--utility-danger-title)" }
  if (score < 30) return { label: "Moderate", color: "var(--utility-caution-title)" }
  if (score < 60) return { label: "Strong", color: "var(--utility-success-title)" }
  return { label: "Leading", color: "var(--utility-success-title)" }
}

function VisibilityScoreCard({ score }: { score: number }) {
  const verdict = scoreVerdict(score)
  const gaugeColor =
    score < 10 ? "var(--utility-danger-icon)" : score < 30 ? "var(--utility-caution-icon)" : "var(--utility-success-icon)"
  return (
    <div css={heroCard}>
      <div css={heroLabelRow}>
        <span css={heroLabel}>AI visibility</span>
        <InfoTip text="Your share of AI mentions across you and the tracked competitors (latest month). 0 means the AIs never mention you; 100 means they only mention you." />
      </div>
      <div css={gaugeWrap}>
        <ScoreGauge score={score} color={gaugeColor} />
        <div css={gaugeCenter}>
          <span css={gaugeScore}>{score}</span>
          <span css={gaugeOutOf}>/100</span>
        </div>
      </div>
      <div css={gaugeVerdict(verdict.color)}>{verdict.label}</div>
      <div css={gaugeSub}>vs tracked competitors</div>
    </div>
  )
}

function SentimentCard({ sentiment }: { sentiment: { positive: number; neutral: number; negative: number } }) {
  const total = sentiment.positive + sentiment.neutral + sentiment.negative
  return (
    <div css={heroCard}>
      <div css={heroLabelRow}>
        <span css={heroLabel}>Sentiment</span>
        <InfoTip text="Tone of AI mentions of your brand. Not yet provided by the live data source, shown when available." />
      </div>
      {total === 0 ? (
        <div css={unavailableBox}>
          Not provided by the
          <br />
          data source yet
        </div>
      ) : (
        <div css={donutRow}>
          <div css={donutCenterWrap}>
            <MiniDonut
              segments={[
                { value: sentiment.positive, color: chartColors.success },
                { value: sentiment.neutral, color: chartColors.neutral },
                { value: sentiment.negative, color: chartColors.danger },
              ]}
            />
            <div css={donutCenter}>
              <span css={css`font-size: var(--fs-base); line-height: 1;`}>{`${Math.round((sentiment.positive / total) * 100)}%`}</span>
              <span css={css`font-size: 10px; font-weight: 500; color: var(--typography-light);`}>positive</span>
            </div>
          </div>
          <div css={sentLegend}>
            <span>
              <span css={sentDot(chartColors.success)} />
              {`Positive ${sentiment.positive}`}
            </span>
            <span>
              <span css={sentDot(chartColors.neutral)} />
              {`Neutral ${sentiment.neutral}`}
            </span>
            <span>
              <span css={sentDot(chartColors.danger)} />
              {`Negative ${sentiment.negative}`}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ----------------------- by-assistant (prompt runs) ----------------------- */

const PROMPT_PLATFORMS = ["ChatGPT", "Claude", "Gemini", "Perplexity"] as const

function AssistantRows({ promptInsights }: { promptInsights: PromptInsightsData }) {
  const stats = PROMPT_PLATFORMS.map((platform) => {
    const rows = promptInsights.prompts
      .map((p) => p.platforms.find((pl) => pl.platform === platform))
      .filter((pl): pl is NonNullable<typeof pl> => Boolean(pl) && !pl!.error)
    const visible = rows.filter((r) => r.brandMentions > 0 || r.brandCited).length
    const summary = promptInsights.byAssistant?.find((a) => a.platform === platform)
    return {
      platform,
      total: rows.length,
      visible,
      mentions: rows.reduce((s, r) => s + r.brandMentions, 0),
      cited: rows.filter((r) => r.brandCited).length,
      leader: summary?.leader ?? null,
      leaderIsYou: summary?.leaderIsYou ?? false,
      leaderMentions: summary?.leaderMentions ?? 0,
    }
  }).filter((s) => s.total > 0)

  if (stats.length === 0) return null
  return (
    <>
      {stats.map((s) => {
        const pct = s.total ? Math.round((s.visible / s.total) * 100) : 0
        return (
          <div css={assistantRow} key={s.platform}>
            <span css={assistantName}>
              <BrandLogo domain={AI_PLATFORM_DOMAIN[s.platform]} size={18} />
              {s.platform}
            </span>
            <Tooltip title={`Your brand appears in ${s.visible} of ${s.total} prompt answers (${pct}%).`} placement="top">
              <span css={assistantBarTrack}>
                <span css={css`display: block; ${assistantBarFill(pct)}`} />
              </span>
            </Tooltip>
            <span css={assistantStats}>
              {`${s.visible}/${s.total} prompts · ${s.mentions} mentions · cited ${s.cited}×`}
            </span>
            <span css={leaderCell}>
              {s.leader ? (
                <Tooltip
                  title={
                    s.leaderIsYou
                      ? `You are the most-mentioned brand in ${s.platform}'s answers (${s.leaderMentions} mentions).`
                      : `${s.leader} is the most-mentioned brand in ${s.platform}'s answers (${s.leaderMentions} mentions).`
                  }
                  placement="top"
                >
                  <span>
                    <Chip
                      size="sm"
                      variant="solid"
                      theme={s.leaderIsYou ? "utility-success" : "neutral-light"}
                      text={s.leaderIsYou ? "You lead" : `Top: ${s.leader}`}
                    />
                  </span>
                </Tooltip>
              ) : (
                <span css={css`color: var(--typography-inactive); font-size: var(--fs-xs);`}>—</span>
              )}
            </span>
          </div>
        )
      })}
    </>
  )
}

/* --------------------------- mentions by topic --------------------------- */

const splitBarTrack = css`
  display: flex;
  width: 100%;
  height: 8px;
  border-radius: var(--rounded-full);
  overflow: hidden;
  background: var(--gray-100);
`

function TopicMentionsTable({ rows }: { rows: TopicMentionRow[] }) {
  return (
    <ResponsiveTableContainer>
      <Table css={fixedTable}>
        <TableHead>
          <TableRow>
            <TableCellHead css={css`width: 24%;`}>Topic</TableCellHead>
            <TableCellHead css={css`width: 13%;`} align="right">AI volume</TableCellHead>
            <TableCellHead css={css`width: 11%;`} align="right">You</TableCellHead>
            <TableCellHead css={css`width: 20%;`}>Share</TableCellHead>
            <TableCellHead css={css`width: 32%;`}>Top competitor</TableCellHead>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const total = r.yourMentions + r.topCompetitorMentions
            const youPct = total ? Math.round((r.yourMentions / total) * 100) : 0
            return (
              <TableRow key={r.topic}>
                <TableCellData>
                  <span css={css`overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; max-width: 100%; vertical-align: bottom;`} title={r.topic}>
                    {r.topic}
                  </span>
                </TableCellData>
                <TableCellData css={numCell}>
                  {r.aiSearchVolume == null ? (
                    <span css={css`color: var(--typography-inactive);`}>—</span>
                  ) : (
                    formatCompact(r.aiSearchVolume)
                  )}
                </TableCellData>
                <TableCellData css={numCell}>{formatCompact(r.yourMentions)}</TableCellData>
                <TableCellData>
                  <Tooltip
                    title={`You: ${youPct}% of mentions in this category (vs ${r.topCompetitor ?? "competitors"}).`}
                    placement="top"
                  >
                    <span css={splitBarTrack}>
                      <span css={css`width: ${youPct}%; background: var(--primary-action-default);`} />
                      <span css={css`width: ${100 - youPct}%; background: var(--gray-300);`} />
                    </span>
                  </Tooltip>
                </TableCellData>
                <TableCellData>
                  {r.topCompetitor ? (
                    <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); max-width: 100%; font-size: var(--fs-xs);`}>
                      <BrandLogo domain={r.topCompetitor} size={16} />
                      <span css={css`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>{r.topCompetitor}</span>
                      <span css={css`color: var(--typography-inactive); flex: none;`}>{`· ${formatCompact(r.topCompetitorMentions)}`}</span>
                    </span>
                  ) : (
                    <span css={css`color: var(--typography-inactive);`}>—</span>
                  )}
                </TableCellData>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </ResponsiveTableContainer>
  )
}

/* ------------------------------ cited pages ------------------------------ */


/** Prompts whose answers cite this URL, joined from the prompt-run data. */
function citedForPrompts(url: string, promptInsights: PromptInsightsData | null): string[] {
  if (!promptInsights) return []
  const norm = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase()
  const target = norm(url)
  return promptInsights.prompts
    .filter((p) => p.topSources.some((s) => norm(s.url) === target))
    .map((p) => p.prompt)
}

/** One cited page: stats row plus an expandable list of its actual citations. */
function CitedPageRow({
  page: p,
  promptInsights,
  showCitedFor,
}: {
  page: CitedPage
  promptInsights: PromptInsightsData | null
  showCitedFor: boolean
}) {
  const [open, setOpen] = useState(false)
  const prompts = showCitedFor ? citedForPrompts(p.url, promptInsights) : []
  const colSpan = showCitedFor ? 5 : 4
  return (
    <>
      <TableRow>
        <TableCellData>
          <a css={pageLink} href={p.url} target="_blank" rel="noopener noreferrer" title={p.url}>
            {truncateUrl(p.url, 60)}
          </a>
        </TableCellData>
        <TableCellData css={numCell}>{p.citations}</TableCellData>
        <TableCellData css={numCell}>
          {p.aiSearchVolume == null ? (
            <span css={css`color: var(--typography-inactive);`}>—</span>
          ) : (
            formatCompact(p.aiSearchVolume)
          )}
        </TableCellData>
        {showCitedFor ? (
          <TableCellData>
            {prompts.length ? (
              <span css={citedForWrap}>
                {prompts.slice(0, 2).map((q) => (
                  <Tooltip title={q} placement="top" key={q}>
                    <span css={css`max-width: 100%;`}>
                      <Chip size="sm" variant="outlined" theme="neutral-light" text={q.length > 26 ? `${q.slice(0, 25)}…` : q} />
                    </span>
                  </Tooltip>
                ))}
                {prompts.length > 2 ? (
                  <Tooltip title={prompts.slice(2).join(" · ")} placement="top">
                    <span>
                      <Chip size="sm" variant="outlined" theme="neutral-light" text={`+${prompts.length - 2}`} />
                    </span>
                  </Tooltip>
                ) : null}
              </span>
            ) : (
              <span css={css`color: var(--typography-inactive);`}>—</span>
            )}
          </TableCellData>
        ) : null}
        <TableCellData>
          {p.citationDetails.length ? (
            <button
              css={expandBtn}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={`Show citations for ${p.url}`}
            >
              <span css={chevron(open)}>
                <Icon icon="chevron-down" size="0.875rem" iconColor="currentColor" />
              </span>
            </button>
          ) : null}
        </TableCellData>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCellData colSpan={colSpan}>
            <div css={css`padding: var(--spacing-2xs) 0 var(--spacing-sm);`}>
              <h5 css={citationListTitle}>{`Questions whose AI answers cite this page (${p.citationDetails.length})`}</h5>
              {p.citationDetails.map((c) => (
                <div css={citationRow} key={`${c.platform}:${c.prompt}`}>
                  <span css={citationPrompt} title={c.prompt}>{c.prompt}</span>
                  <span css={citationLogoCell}>
                    <PlatformLogo platform={c.platform} />
                  </span>
                  <span css={citationMeta}>{`${formatCompact(c.aiSearchVolume)} AI vol.`}</span>
                  <span css={citationMeta}>{c.lastSeen ? c.lastSeen.slice(0, 10) : "—"}</span>
                </div>
              ))}
            </div>
          </TableCellData>
        </TableRow>
      ) : null}
    </>
  )
}

function CitedPagesTable({
  pages,
  promptInsights,
  showCitedFor,
}: {
  pages: CitedPage[]
  promptInsights: PromptInsightsData | null
  showCitedFor: boolean
}) {
  return (
    <ResponsiveTableContainer>
      <Table css={fixedTable}>
        <TableHead>
          <TableRow>
            <TableCellHead css={css`width: ${showCitedFor ? 37 : 55}%;`}>Page</TableCellHead>
            <TableCellHead css={css`width: 13%;`} align="right">Citations</TableCellHead>
            <TableCellHead css={css`width: 17%;`} align="right">AI search volume</TableCellHead>
            {showCitedFor ? <TableCellHead css={css`width: 27%;`}>Cited when asked</TableCellHead> : null}
            <TableCellHead css={css`width: 6%;`} aria-label="Citations detail" />
          </TableRow>
        </TableHead>
        <TableBody>
          {pages.map((p) => (
            <CitedPageRow page={p} promptInsights={promptInsights} showCitedFor={showCitedFor} key={p.url} />
          ))}
        </TableBody>
      </Table>
    </ResponsiveTableContainer>
  )
}

/* --------------------------------- tab --------------------------------- */

export function AiVisibilityTab({
  data,
  domain,
  loading,
  asOf,
  promptInsights,
  promptsLoading = false,
  onOpenPrompts,
}: {
  data: AiVisibilityData
  /** Your domain, flagged as the brand series in the share-of-voice chart. */
  domain: string
  loading: boolean
  asOf: string
  /** Prompt-run results reused from the Topics & Prompts tab (no extra queries). */
  promptInsights: PromptInsightsData | null
  /** True while the prompt run is in flight (fresh snapshot). */
  promptsLoading?: boolean
  onOpenPrompts: () => void
}) {
  const [citeSortDesc, setCiteSortDesc] = useState(true)
  // Series keys come from the data (your domain first), not a hardcoded list.
  const competitorKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const row of data.shareOfVoiceTrend) {
      for (const k of Object.keys(row)) if (k !== "date") keys.add(k)
    }
    return [domain, ...[...keys].filter((k) => k !== domain)].filter((k) => keys.has(k) || k === domain)
  }, [data.shareOfVoiceTrend, domain])
  const [visible, setVisible] = useState<Record<string, boolean>>(
    () => Object.fromEntries(competitorKeys.map((k) => [k, true])),
  )

  const ownedSorted = useMemo(
    () => [...data.ownedCitedPages].sort((a, b) => (citeSortDesc ? b.citations - a.citations : a.citations - b.citations)),
    [data.ownedCitedPages, citeSortDesc],
  )

  if (loading) {
    return (
      <VStack>
        <AutoGrid min="200px">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </AutoGrid>
        <SplitGrid>
          <CardSkeleton height="240px" />
          <CardSkeleton height="240px" />
        </SplitGrid>
        <CardSkeleton height="260px" />
      </VStack>
    )
  }

  const score = Math.max(0, Math.min(100, Math.round(data.kpis.shareOfVoicePct.value)))
  const citationRate = data.kpis.citationRatePct.value
  const bench = data.competitorBenchmark
  const benchmarkFor = (value: number, avg: number) => ({
    text: `Competitor avg ${formatCompact(avg)}`,
    tone: value > avg ? ("up" as const) : value < avg ? ("down" as const) : ("flat" as const),
  })

  return (
    <VStack>
      <p css={note}>
        Brand mentions and citations in AI assistant answers, per platform covered by the data source.
      </p>

      <AutoGrid min="210px">
        <VisibilityScoreCard score={score} />
        <KpiCard
          label="Mentions (monthly)"
          info={`AI answers where your domain appeared, in cited sources or search results.${bench ? ` Competitor average is across the ${bench.competitors} tracked competitors.` : ""}`}
          kpi={data.kpis.mentions}
          benchmark={bench ? benchmarkFor(data.kpis.mentions.value, bench.mentionsAvg) : undefined}
        />
        <KpiCard
          label="Citations (monthly)"
          info={`AI answers that cite one of your pages as a source. Citation rate is citations divided by mentions.${bench ? ` Competitor average is across the ${bench.competitors} tracked competitors.` : ""}`}
          kpi={data.kpis.citations}
          benchmark={bench ? benchmarkFor(data.kpis.citations.value, bench.citationsAvg) : undefined}
          footnote={`Citation rate ${citationRate}%`}
        />
        <SentimentCard sentiment={data.sentiment} />
      </AutoGrid>

      <SplitGrid template="1fr 1fr">
        <DashCard
          title="Visibility by assistant"
          info="Top: monthly mentions and citations from the LLM mentions database (covers ChatGPT and Google AI Overviews). Below: how often each assistant's answers to your configured prompts surface your brand, reused from the Topics & Prompts run, no extra queries."
          asOf={asOf}
        >
          <ByModelChart data={data.byModel} />
          <div css={assistantDivider}>From your prompt runs</div>
          {promptInsights ? (
            <AssistantRows promptInsights={promptInsights} />
          ) : (
            <div css={promptHint}>
              <span>
                {promptsLoading
                  ? "Running your prompts across the four assistants… per-assistant visibility appears here in a minute."
                  : "Run your prompts to see Claude, Gemini, and Perplexity visibility here."}
              </span>
              <Button buttonType="ghost" size="sm" onClick={onOpenPrompts}>
                <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap;`}>
                  Topics &amp; Prompts
                  <Icon icon="arrow-right" size="0.875rem" iconColor="currentColor" />
                </span>
              </Button>
            </div>
          )}
        </DashCard>

        <DashCard title="Share of voice" info="Your AI share of voice vs competitors over 12 snapshots." asOf={asOf}>
          {/* Fills the card so this chart matches the assistant card's height. */}
          <div css={css`display: flex; flex-direction: column; height: 100%;`}>
            <div css={legend}>
              {competitorKeys.map((key, i) => {
                const color = i === 0 ? chartColors.accent : [chartColors.compA, chartColors.compB, chartColors.compC][(i - 1) % 3]
                return (
                  <button
                    key={key}
                    css={legendBtn(visible[key] !== false, color)}
                    onClick={() => setVisible((v) => ({ ...v, [key]: v[key] === false }))}
                    aria-pressed={visible[key] !== false}
                  >
                    <BrandLogo domain={key} size={16} />
                    {key}
                  </button>
                )
              })}
            </div>
            <div css={css`flex: 1; min-height: 240px;`}>
              <ShareOfVoiceChart
                data={data.shareOfVoiceTrend}
                series={competitorKeys.map((key) => ({ key, brand: key === domain }))}
                visible={visible}
                height="100%"
              />
            </div>
          </div>
        </DashCard>
      </SplitGrid>

      {data.newLostTrend.length > 0 || data.topicMentions.length > 0 ? (
        <SplitGrid template="1fr 1fr">
          {data.newLostTrend.length > 0 ? (
            <DashCard
              title="AI mention momentum"
              info="AI answers that newly mention your domain vs answers that stopped mentioning it, per month. A growing red bar is early warning of citation decay."
              asOf={asOf}
            >
              <NewLostChart data={data.newLostTrend} />
            </DashCard>
          ) : (
            <div />
          )}
          {data.topicMentions.length > 0 ? (
            <DashCard
              title="Mentions by topic"
              info="For each AI topic configured in settings: mentions of your domain vs competitors within AI answers about that topic. The bar splits mention share: you (blue) against the strongest competitor (gray)."
              asOf={asOf}
              flush
            >
              <TopicMentionsTable rows={data.topicMentions} />
            </DashCard>
          ) : (
            <div />
          )}
        </SplitGrid>
      ) : null}

      {data.ownedCitedPages.length > 0 ? (
        <DashCard
          title="Your top cited pages"
          info="Your pages most frequently cited as sources by AI assistants (top 20). 'Cited when asked' shows which of your configured prompts produced answers citing the page, from the Topics & Prompts run."
          asOf={asOf}
          flush
          action={
            <button
              css={css`${sortHead} border: none; background: none; font-size: var(--fs-xs); color: var(--typography-light); display: inline-flex;`}
              onClick={() => setCiteSortDesc((d) => !d)}
            >
              <span css={sortInner}>
                Citations
                <Icon icon={citeSortDesc ? "chevron-down" : "chevron-up"} size="0.75rem" iconColor="gray" />
              </span>
            </button>
          }
        >
          <CitedPagesTable pages={ownedSorted} promptInsights={promptInsights} showCitedFor={Boolean(promptInsights)} />
        </DashCard>
      ) : null}

      {data.competitorCitedPages.length > 0 ? (
        <DashCard
          title="Competitor cited pages"
          info="Each tracked competitor's pages most frequently cited by AI assistants (top 10 per competitor), the content you're competing against for citations."
          asOf={asOf}
          flush
        >
          {data.competitorCitedPages.map((cp) => (
            <div css={compGroup} key={cp.competitor}>
              <div css={compHeader}>
                <BrandLogo domain={cp.competitor} size={20} />
                {cp.competitor}
                <span css={css`font-weight: 400; font-size: var(--fs-xs); color: var(--typography-light);`}>
                  {`· top ${cp.pages.length} page${cp.pages.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <CitedPagesTable pages={cp.pages} promptInsights={promptInsights} showCitedFor={Boolean(promptInsights)} />
            </div>
          ))}
        </DashCard>
      ) : null}

      {/* Topic demand, prompt lists, and competitor prompt citations live on the
          Topics & Prompts tab, this tab stays focused on mentions/citations. */}
    </VStack>
  )
}
