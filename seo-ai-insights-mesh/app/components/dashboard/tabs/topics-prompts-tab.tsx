/** @jsxImportSource @emotion/react */
"use client"

import { useState } from "react"
import { css, keyframes } from "@emotion/react"
import {
  Button,
  Callout,
  Chip,
  Icon,
  LoadingIndicator,
  ResponsiveTableContainer,
  Table,
  TableBody,
  TableCellData,
  TableCellHead,
  TableHead,
  TableRow,
  Tooltip,
} from "@uniformdev/design-system"
import type { AiVisibilityData, DerivedTopic, PromptInsight, PromptInsightsData, TopicSourceLink } from "../../../lib/types"
import { AI_PLATFORM_DOMAIN } from "../../../lib/types"
import type { ReportError } from "../../../lib/use-report"
import { formatCompact, truncateUrl } from "../../../lib/format"
import { VStack } from "../grids"
import { CardSkeleton, DashCard, InfoTip } from "../widgets"
import { Sparkline, chartColors } from "../charts"
import { BrandLogo, PlatformLogo } from "../brand-logo"

/* ------------------------------ animations ------------------------------ */
/* Subtle, entrance-only, and disabled entirely for reduced-motion users. */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`
const growBar = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`
const noMotion = "@media (prefers-reduced-motion: reduce)"

/* ------------------------------- styles ------------------------------- */

const note = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  margin: 0 0 var(--spacing-md);
`
const promptList = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`
const promptCard = (i: number) => css`
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  overflow: hidden;
  animation: ${fadeUp} 360ms both;
  animation-delay: ${Math.min(i, 8) * 45}ms;
  transition: border-color 160ms ease, box-shadow 160ms ease;
  &:hover {
    border-color: var(--gray-300);
    box-shadow: var(--elevation-100, 0 1px 3px rgba(0, 0, 0, 0.06));
  }
  ${noMotion} {
    animation: none;
  }
`
const promptHeader = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
  padding: var(--spacing-3) var(--spacing-md);
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
`
const promptText = css`
  flex: 1;
  min-width: 0;
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--typography-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  &::before {
    content: "“";
    color: var(--typography-inactive);
  }
  &::after {
    content: "”";
    color: var(--typography-inactive);
  }
`
const platformStrip = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: none;
`
const platformChip = (state: "cited" | "mentioned" | "absent" | "error") => css`
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px var(--spacing-xs) 2px 2px;
  border-radius: var(--rounded-full);
  border: 1px solid ${state === "cited" ? "var(--utility-success-border, var(--green-300))" : "var(--gray-200)"};
  background: ${state === "cited" ? "var(--utility-success-background, var(--green-100))" : "var(--white)"};
  opacity: ${state === "absent" || state === "error" ? 0.45 : 1};
  filter: ${state === "absent" || state === "error" ? "grayscale(1)" : "none"};
  transition: opacity 160ms ease, transform 160ms ease;
  &:hover {
    opacity: 1;
    transform: translateY(-1px);
  }
  ${noMotion} {
    transition: none;
  }
`
const platformCount = css`
  font-size: 10px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--typography-light);
  min-width: 10px;
  text-align: center;
`
const meterWrap = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: none;
  width: 120px;
`
const meterTrack = css`
  flex: 1;
  height: 6px;
  border-radius: var(--rounded-full);
  background: var(--gray-100);
  overflow: hidden;
`
const meterFill = (pct: number) => css`
  width: ${pct}%;
  height: 100%;
  border-radius: inherit;
  background: ${pct >= 75 ? "var(--utility-success-icon)" : pct >= 40 ? "var(--utility-caution-icon)" : "var(--utility-danger-icon)"};
  transform-origin: left;
  animation: ${growBar} 600ms 120ms both ease-out;
  ${noMotion} {
    animation: none;
  }
`
const meterPct = css`
  font-size: var(--fs-xs);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--typography-base);
  width: 34px;
  text-align: right;
`
const chevron = (open: boolean) => css`
  flex: none;
  display: inline-flex;
  color: var(--gray-500);
  transform: rotate(${open ? 180 : 0}deg);
  transition: transform 200ms ease;
  ${noMotion} {
    transition: none;
  }
`
/* Expand/collapse without measuring content: animate grid rows 0fr → 1fr. */
const expandGrid = (open: boolean) => css`
  display: grid;
  grid-template-rows: ${open ? "1fr" : "0fr"};
  transition: grid-template-rows 260ms ease;
  ${noMotion} {
    transition: none;
  }
`
const expandInner = css`
  overflow: hidden;
  min-height: 0;
`
const detailGrid = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  padding: var(--spacing-md);
  border-top: 1px solid var(--gray-100);
`
const detailTitle = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--typography-light);
  margin: 0 0 var(--spacing-sm);
`
const rankRow = css`
  display: grid;
  grid-template-columns: 16px 110px 1fr 56px;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-2xs) 0;
  font-size: var(--fs-sm);
`
const rankName = (you: boolean) => css`
  font-weight: ${you ? 700 : 500};
  color: var(--typography-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const rankBarTrack = css`
  height: 8px;
  border-radius: var(--rounded-full);
  background: var(--gray-100);
  overflow: hidden;
`
const rankBarFill = (pct: number, you: boolean, i: number) => css`
  width: ${Math.max(pct, 2)}%;
  height: 100%;
  border-radius: inherit;
  background: ${you ? "var(--primary-action-default)" : "var(--gray-300)"};
  transform-origin: left;
  animation: ${growBar} 500ms ${i * 70}ms both ease-out;
  ${noMotion} {
    animation: none;
  }
`
const rankCount = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  font-variant-numeric: tabular-nums;
  text-align: right;
`
const quote = css`
  margin: 0 0 var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-left: 3px solid var(--gray-200);
  background: var(--gray-50);
  border-radius: 0 var(--rounded-md) var(--rounded-md) 0;
  font-size: var(--fs-sm);
  color: var(--typography-base);
  font-style: italic;
`
const quoteMeta = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-2xs);
  font-size: var(--fs-xs);
  font-style: normal;
  color: var(--typography-light);
`
const sourceRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-2xs) var(--spacing-2xs);
  font-size: var(--fs-sm);
  text-decoration: none;
  border-radius: var(--rounded-md);
  transition: background 140ms ease;
  &:hover {
    background: var(--gray-50);
  }
  &:hover [data-source-url] {
    text-decoration: underline;
    color: var(--brand-secondary-4, #0052ed);
  }
  ${noMotion} {
    transition: none;
  }
`
const sourceDomain = css`
  font-family: var(--ff-mono);
  font-size: var(--fs-xs);
  color: var(--typography-base);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`
const sourceCount = css`
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-xs);
  color: var(--typography-light);
  flex: none;
`
const rankChip = css`
  flex: none;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--typography-light);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`
const numCell = css`
  font-variant-numeric: tabular-nums;
  text-align: right;
`
/* Fixed layout + shared column widths keep sibling tables (e.g. the three
   per-competitor tables) visually aligned instead of each auto-sizing. */
const fixedTable = css`
  table-layout: fixed;
  width: 100%;
`
const colWide = css`width: 46%;`
const colPlatform = css`width: 18%;`
const colVolume = css`width: 18%;`
const colTail = css`width: 18%;`
const topicExpandBtn = css`
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
const topicDetailGrid = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  padding: var(--spacing-xs) 0 var(--spacing-sm);
`
const srcListTitle = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--typography-light);
  margin: 0 0 var(--spacing-xs);
`
const presenceCell = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 120px;
`
const presenceTrack = css`
  flex: 1;
  max-width: 90px;
  height: 6px;
  border-radius: var(--rounded-full);
  background: var(--gray-100);
  overflow: hidden;
`
const competitorCell = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  color: var(--typography-base);
`
const loadingBox = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
  color: var(--typography-light);
  font-size: var(--fs-sm);
  text-align: center;
`
const legendStrip = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const promptCell = css`
  display: inline-block;
  max-width: 46ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
`

/* ------------------------------ pieces ------------------------------ */

/**
 * Link label for a cited source. Gemini cites through a Google redirect whose
 * host differs from the real source domain, show the domain in that case
 * instead of the redirect URL (the href still resolves to the exact page).
 */
function sourceLabel(s: { url: string; domain: string }): string {
  try {
    const host = new URL(s.url).hostname.replace(/^www\./, "")
    if (host !== s.domain && !host.endsWith(`.${s.domain}`)) return s.domain
  } catch {
    return s.domain
  }
  return truncateUrl(s.url, 46)
}

/** Hover text for a cited source: the full URL, or a note for redirect links. */
function sourceTitle(s: { url: string; domain: string }): string {
  return sourceLabel(s) === truncateUrl(s.url, 46)
    ? s.url
    : `Opens the cited ${s.domain} page (via the assistant's redirect link)`
}

function PlatformBadge({
  platform,
  mentions,
  cited,
  error,
}: {
  platform: keyof typeof AI_PLATFORM_DOMAIN
  mentions: number
  cited: boolean
  error?: boolean
}) {
  const state = error ? "error" : cited ? "cited" : mentions > 0 ? "mentioned" : "absent"
  const tip = error
    ? `${platform}: no answer (call failed)`
    : cited
      ? `${platform}: cites your page · ${mentions} brand mention${mentions === 1 ? "" : "s"}`
      : mentions > 0
        ? `${platform}: ${mentions} brand mention${mentions === 1 ? "" : "s"}, no citation`
        : `${platform}: brand not mentioned`
  return (
    <Tooltip title={tip} placement="top">
      <span css={platformChip(state)} aria-label={tip} role="img">
        <BrandLogo domain={AI_PLATFORM_DOMAIN[platform]} size={16} />
        <span css={platformCount}>{error ? "–" : cited ? "✓" : mentions > 0 ? mentions : "·"}</span>
      </span>
    </Tooltip>
  )
}

function PromptCard({ insight, index }: { insight: PromptInsight; index: number }) {
  const [open, setOpen] = useState(false)
  const you = insight.ranking.find((r) => r.isYou)
  const rank = you ? insight.ranking.indexOf(you) + 1 : insight.ranking.length
  const maxMentions = Math.max(...insight.ranking.map((r) => r.mentions), 1)

  return (
    <div css={promptCard(index)}>
      <button css={promptHeader} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span css={promptText}>{insight.prompt}</span>
        <span css={platformStrip}>
          {insight.platforms.map((pl) => (
            <PlatformBadge
              key={pl.platform}
              platform={pl.platform}
              mentions={pl.brandMentions}
              cited={pl.brandCited}
              error={pl.error}
            />
          ))}
        </span>
        <Tooltip title="Share of AI answers that mention or cite your brand." placement="top">
          <span css={meterWrap}>
            <span css={meterTrack}>
              <span css={css`display: block; ${meterFill(insight.visibilityPct)}`} />
            </span>
            <span css={meterPct}>{`${insight.visibilityPct}%`}</span>
          </span>
        </Tooltip>
        <span css={rankChip}>{`#${rank} of ${insight.ranking.length}`}</span>
        <span css={chevron(open)}>
          <Icon icon="chevron-down" size="1rem" iconColor="currentColor" />
        </span>
      </button>

      <div css={expandGrid(open)}>
        <div css={expandInner}>
          <div css={detailGrid}>
            <div>
              <h4 css={detailTitle}>
                Who the AIs mention
                <InfoTip text="Total brand mentions across the four answers, you vs tracked competitors." />
              </h4>
              {insight.ranking.map((r, i) => (
                <div css={rankRow} key={r.name}>
                  <span css={css`font-size: var(--fs-xs); color: var(--typography-inactive); font-variant-numeric: tabular-nums;`}>{i + 1}</span>
                  <span css={rankName(r.isYou)}>
                    {r.name}
                    {r.isYou ? " (you)" : ""}
                  </span>
                  <span css={rankBarTrack}>
                    {open ? <span css={css`display: block; ${rankBarFill((r.mentions / maxMentions) * 100, r.isYou, i)}`} /> : null}
                  </span>
                  <span css={rankCount}>{`${r.mentions} · ${r.citations} cit.`}</span>
                </div>
              ))}
            </div>

            <div>
              <h4 css={detailTitle}>
                Top cited sources
                <InfoTip text="The sources the AI answers cite most for this prompt, across all four assistants." />
              </h4>
              {insight.topSources.length === 0 ? (
                <span css={css`font-size: var(--fs-sm); color: var(--typography-inactive);`}>
                  The answers cited no sources.
                </span>
              ) : (
                insight.topSources.map((s) => (
                  <a
                    css={sourceRow}
                    key={s.domain}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={sourceTitle(s)}
                  >
                    <BrandLogo domain={s.domain} size={16} />
                    <span css={sourceDomain} data-source-url>{sourceLabel(s)}</span>
                    <span css={css`display: inline-flex; flex: none; color: var(--typography-inactive);`}>
                      <Icon icon="external" size="0.7rem" iconColor="currentColor" />
                    </span>
                    {s.owner !== "other" ? (
                      <Chip
                        size="sm"
                        variant="solid"
                        theme={s.owner === "yours" ? "accent-light" : "neutral-light"}
                        text={s.owner === "yours" ? "Yours" : "Competitor"}
                      />
                    ) : null}
                    <span css={sourceCount}>{`×${s.count}`}</span>
                  </a>
                ))
              )}
            </div>

            {insight.topMentions.length > 0 ? (
              <div css={css`grid-column: 1 / -1;`}>
                <h4 css={detailTitle}>
                  How it comes up
                  <InfoTip text="Quotes from the AI answers where tracked brands are mentioned." />
                </h4>
                {insight.topMentions.map((m) => (
                  <blockquote css={quote} key={`${m.platform}:${m.text.slice(0, 40)}`}>
                    {m.text}
                    <span css={quoteMeta}>
                      <BrandLogo domain={AI_PLATFORM_DOMAIN[m.platform]} size={14} />
                      {`${m.platform} · about ${m.entity}`}
                    </span>
                  </blockquote>
                ))}
              </div>
            ) : null}

            <div css={css`grid-column: 1 / -1;`}>
              <Callout type="info" title="Next step">
                <span css={css`font-size: var(--fs-sm);`}>{insight.recommendation}</span>
              </Callout>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TopicSourceList({
  title,
  logoDomain,
  sources,
  emptyText,
}: {
  title: string
  logoDomain?: string
  sources: TopicSourceLink[]
  emptyText: string
}) {
  return (
    <div>
      <h5 css={srcListTitle}>
        {logoDomain ? <BrandLogo domain={logoDomain} size={14} /> : null}
        {title}
      </h5>
      {sources.length === 0 ? (
        <span css={css`font-size: var(--fs-xs); color: var(--typography-inactive);`}>{emptyText}</span>
      ) : (
        sources.map((s) => (
          <a
            css={sourceRow}
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            title={sourceTitle(s)}
          >
            <BrandLogo domain={s.domain} size={16} />
            <span css={sourceDomain} data-source-url>{sourceLabel(s)}</span>
            <span css={css`display: inline-flex; flex: none; color: var(--typography-inactive);`}>
              <Icon icon="external" size="0.7rem" iconColor="currentColor" />
            </span>
            <span css={sourceCount}>{`×${s.count}`}</span>
          </a>
        ))
      )}
    </div>
  )
}

/** One derived topic: stats row + expandable cited-page comparison. */
function TopicRow({ topic: t, yourName }: { topic: DerivedTopic; yourName: string }) {
  const [open, setOpen] = useState(false)
  const expandable = t.yourTopSources.length > 0 || t.competitorTopSources.length > 0
  return (
    <>
      <TableRow>
        <TableCellData>{t.topic}</TableCellData>
        <TableCellData css={numCell}>
          {t.aiSearchVolume == null ? (
            <span css={css`color: var(--typography-inactive);`}>—</span>
          ) : (
            formatCompact(t.aiSearchVolume)
          )}
        </TableCellData>
        <TableCellData>
          <span css={presenceCell}>
            <span css={presenceTrack}>
              <span
                css={css`
                  display: block;
                  width: ${t.presencePct}%;
                  height: 100%;
                  border-radius: inherit;
                  background: var(--primary-action-default);
                  transform-origin: left;
                  animation: ${growBar} 500ms both ease-out;
                  ${noMotion} {
                    animation: none;
                  }
                `}
              />
            </span>
            <span css={css`font-size: var(--fs-xs); color: var(--typography-light); font-variant-numeric: tabular-nums;`}>
              {`${t.presencePct}%`}
            </span>
          </span>
        </TableCellData>
        <TableCellData css={numCell}>{`${t.brandPresencePct}%`}</TableCellData>
        <TableCellData css={numCell}>{t.citations}</TableCellData>
        <TableCellData>
          <TrendArrowSmall trend={t.trend} />
        </TableCellData>
        <TableCellData>
          {t.topCompetitor ? (
            <span css={competitorCell}>
              <BrandLogo domain={t.topCompetitor} size={16} />
              <span css={css`overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`}>{t.topCompetitor}</span>
              <span css={css`color: var(--typography-inactive); flex: none;`}>{`· ${t.competitorMentions}`}</span>
            </span>
          ) : (
            <span css={css`color: var(--typography-inactive);`}>—</span>
          )}
        </TableCellData>
        <TableCellData>
          {expandable ? (
            <button
              css={topicExpandBtn}
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={`Show cited pages for ${t.topic}`}
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
          <TableCellData colSpan={8}>
            <div css={topicDetailGrid}>
              <TopicSourceList
                title={`${yourName}, cited pages`}
                sources={t.yourTopSources}
                emptyText="None of your pages are cited in these answers yet."
              />
              <TopicSourceList
                title={`${t.topCompetitor ?? "Competitor"}, cited pages`}
                logoDomain={t.topCompetitor ?? undefined}
                sources={t.competitorTopSources}
                emptyText="No competitor pages cited in these answers."
              />
            </div>
          </TableCellData>
        </TableRow>
      ) : null}
    </>
  )
}

function TrendArrowSmall({ trend }: { trend: number[] }) {
  if (trend.length < 2) return <span css={css`color: var(--typography-inactive);`}>—</span>
  const up = trend[trend.length - 1] >= trend[0]
  return (
    <Sparkline data={trend} color={up ? chartColors.success : chartColors.danger} />
  )
}

/* ------------------------------ the tab ------------------------------ */

export function TopicsPromptsTab({
  data,
  loading,
  error,
  onRetry,
  ai,
  live,
  asOf,
  onOpenSettings,
}: {
  data: PromptInsightsData | null
  loading: boolean
  error: ReportError | null
  onRetry: () => void
  /** AI Visibility data, feeds the topic demand / search-mentions cards moved here. */
  ai: AiVisibilityData | null
  live: boolean
  asOf: string
  onOpenSettings: () => void
}) {
  if (loading && !data) {
    return (
      <VStack>
        <div css={loadingBox}>
          <LoadingIndicator />
          <span>
            Running your prompts across ChatGPT, Claude, Gemini, and Perplexity…
            <br />
            A first run takes a minute or two; afterwards answers stay cached until the next snapshot.
          </span>
        </div>
        <CardSkeleton height="60px" />
        <CardSkeleton height="60px" />
        <CardSkeleton height="60px" />
      </VStack>
    )
  }

  if (error) {
    return (
      <Callout type="danger" title="Could not run your prompts">
        <div css={css`display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); font-size: var(--fs-sm);`}>
          <span>{error.message}</span>
          <Button buttonType="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      </Callout>
    )
  }

  if (!data || data.prompts.length === 0) {
    return (
      <Callout type="info" title="No prompts configured yet">
        <div css={css`display: flex; flex-direction: column; align-items: flex-start; gap: var(--spacing-sm); font-size: var(--fs-sm);`}>
          <span>
            Add brand names, AI visibility topics, and competitors in settings, prompts are generated from
            them automatically, and you can fine-tune the list there too.
          </span>
          <Button buttonType="secondary" size="sm" onClick={onOpenSettings}>
            Go to settings
          </Button>
        </div>
      </Callout>
    )
  }

  const fetchedDay = data.fetchedAt ? data.fetchedAt.slice(0, 10) : asOf
  const yourName = data.prompts[0]?.ranking.find((r) => r.isYou)?.name ?? "You"

  return (
    <VStack>
      <p css={note}>
        Your configured prompts, asked live to four AI assistants, and what their answers say about you.
      </p>

      <DashCard
        title="Prompt performance"
        info="Each prompt is sent to ChatGPT, Claude, Gemini, and Perplexity. Visibility is the share of answers that mention or cite your brand. Expand a prompt for the full breakdown."
        asOf={fetchedDay}
        flush
        action={
          <span css={legendStrip}>
            Run across
            {(Object.keys(AI_PLATFORM_DOMAIN) as (keyof typeof AI_PLATFORM_DOMAIN)[]).map((p) => (
              <Tooltip title={p} placement="top" key={p}>
                <span css={css`display: inline-flex;`}>
                  <BrandLogo domain={AI_PLATFORM_DOMAIN[p]} size={16} />
                </span>
              </Tooltip>
            ))}
          </span>
        }
      >
        <div css={css`padding: var(--spacing-md); ${promptList}`}>
          {data.prompts.map((insight, i) => (
            <PromptCard insight={insight} index={i} key={insight.prompt} />
          ))}
        </div>
      </DashCard>

      {data.topics.length > 0 ? (
        <DashCard
          title="Topics in the AI answers"
          info="Themes derived from the assistants' own answers to your prompts (their related queries and recurring phrasing). Presence: how many answers touch the topic. You: how often those answers mention your brand. Expand a row to compare your cited pages with the top competitor's."
          asOf={fetchedDay}
          flush
        >
          <ResponsiveTableContainer>
            <Table css={fixedTable}>
              <TableHead>
                <TableRow>
                  <TableCellHead css={css`width: 15%;`}>Topic</TableCellHead>
                  <TableCellHead css={css`width: 9%;`} align="right">AI volume</TableCellHead>
                  <TableCellHead css={css`width: 17%;`}>Presence in answers</TableCellHead>
                  <TableCellHead css={css`width: 7%;`} align="right">You</TableCellHead>
                  <TableCellHead css={css`width: 10%;`} align="right">Your citations</TableCellHead>
                  <TableCellHead css={css`width: 12%;`}>Trend</TableCellHead>
                  <TableCellHead css={css`width: 25%;`}>Top competitor</TableCellHead>
                  <TableCellHead css={css`width: 5%;`} aria-label="Cited pages" />
                </TableRow>
              </TableHead>
              <TableBody>
                {data.topics.map((t) => (
                  <TopicRow topic={t} yourName={yourName} key={t.topic} />
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </DashCard>
      ) : null}

      {/* ---- moved from the AI Visibility tab: demand & mention prompts ---- */}

      {ai && ai.topics.length > 0 ? (
        <DashCard
          title="Topic demand in AI search"
          info="AI search volume for the topics configured in the integration settings, how often people ask AI assistants about each theme."
          asOf={asOf}
          flush
        >
          <ResponsiveTableContainer>
            <Table css={fixedTable}>
              <TableHead>
                <TableRow>
                  <TableCellHead css={colWide}>Topic</TableCellHead>
                  <TableCellHead css={colVolume} align="right">AI search volume</TableCellHead>
                  <TableCellHead css={css`width: 36%;`}>12-mo trend</TableCellHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {ai.topics.map((t) => (
                  <TableRow key={t.topic}>
                    <TableCellData>{t.topic}</TableCellData>
                    <TableCellData css={numCell}>{formatCompact(t.aiSearchVolume)}</TableCellData>
                    <TableCellData>
                      <Sparkline
                        data={t.trend12mo}
                        color={t.trendDirection === "down" ? chartColors.danger : t.trendDirection === "up" ? chartColors.success : chartColors.neutral}
                      />
                    </TableCellData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </DashCard>
      ) : null}

      {ai && ai.prompts.length > 0 ? (
        <DashCard
          title="Prompts that surface you"
          info="Actual questions people ask AI assistants where your domain appears in the answer, from the LLM mentions database. 'Cited' means one of your pages is linked as a source."
          asOf={asOf}
          flush
        >
          <ResponsiveTableContainer>
            <Table css={fixedTable}>
              <TableHead>
                <TableRow>
                  <TableCellHead css={colWide}>Prompt</TableCellHead>
                  <TableCellHead css={colPlatform}>Platform</TableCellHead>
                  <TableCellHead css={colVolume} align="right">AI search volume</TableCellHead>
                  <TableCellHead css={colTail}>Cited</TableCellHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {ai.prompts.map((pr) => (
                  <TableRow key={pr.prompt}>
                    <TableCellData>
                      <span css={promptCell} title={pr.prompt}>{pr.prompt}</span>
                    </TableCellData>
                    <TableCellData>
                      <PlatformLogo platform={pr.platform} />
                    </TableCellData>
                    <TableCellData css={numCell}>{formatCompact(pr.aiSearchVolume)}</TableCellData>
                    <TableCellData>
                      {pr.cited ? (
                        <Chip size="sm" variant="solid" theme="utility-success" text="Cited" />
                      ) : (
                        <span css={css`color: var(--typography-inactive);`}>—</span>
                      )}
                    </TableCellData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </DashCard>
      ) : null}

      {ai && ai.competitorPrompts.length > 0 ? (
        <DashCard
          title="Where competitors get cited"
          info="For each tracked competitor, the top prompts (by AI search volume) whose AI answers cite one of their pages as a source."
          asOf={asOf}
          flush
        >
          {ai.competitorPrompts.map((cp) => (
            <div
              css={css`
                padding: var(--spacing-md) var(--spacing-lg);
                border-top: 1px solid var(--gray-200);
                &:first-of-type {
                  border-top: none;
                }
              `}
              key={cp.competitor}
            >
              <div css={css`display: flex; align-items: center; gap: var(--spacing-xs); margin-bottom: var(--spacing-sm); font-weight: 600; color: var(--typography-base);`}>
                <BrandLogo domain={cp.competitor} size={20} />
                {cp.competitor}
                <span css={css`font-weight: 400; font-size: var(--fs-xs); color: var(--typography-light);`}>
                  {`· top ${cp.prompts.length} prompt${cp.prompts.length === 1 ? "" : "s"}`}
                </span>
              </div>
              <ResponsiveTableContainer>
                <Table css={fixedTable}>
                  <TableHead>
                    <TableRow>
                      <TableCellHead css={colWide}>Prompt</TableCellHead>
                      <TableCellHead css={colPlatform}>Platform</TableCellHead>
                      <TableCellHead css={colVolume} align="right">AI search volume</TableCellHead>
                      <TableCellHead css={colTail}>Last seen</TableCellHead>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cp.prompts.map((pr) => (
                      <TableRow key={pr.prompt}>
                        <TableCellData>
                          <span css={promptCell} title={pr.prompt}>{pr.prompt}</span>
                        </TableCellData>
                        <TableCellData>
                          <PlatformLogo platform={pr.platform} />
                        </TableCellData>
                        <TableCellData css={numCell}>{formatCompact(pr.aiSearchVolume)}</TableCellData>
                        <TableCellData>
                          <span css={css`color: var(--typography-light); font-size: var(--fs-xs); white-space: nowrap;`}>
                            {pr.lastSeen ? pr.lastSeen.slice(0, 10) : "—"}
                          </span>
                        </TableCellData>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ResponsiveTableContainer>
            </div>
          ))}
        </DashCard>
      ) : null}
    </VStack>
  )
}
