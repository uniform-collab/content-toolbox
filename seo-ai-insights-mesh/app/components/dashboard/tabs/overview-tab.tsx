/** @jsxImportSource @emotion/react */
"use client"

import { Fragment, useMemo, useState } from "react"
import { css, keyframes } from "@emotion/react"
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
import type { DashboardData, KeywordRow, OverviewData, PromptInsightsData } from "../../../lib/types"
import { topOpportunities } from "../../../lib/opportunities"
import { formatCompact, formatNumber, truncateUrl } from "../../../lib/format"
import { AutoGrid, SplitGrid, VStack } from "../grids"
import { CardSkeleton, DashCard, DistributionBar, KpiCard, KpiSkeleton } from "../widgets"
import { TrafficAreaChart, chartColors } from "../charts"
import { BrandLogo } from "../brand-logo"

type TabId = "overview" | "opportunities" | "ai" | "prompts" | "keywords" | "suggestions" | "decaying"

/* ------------------------------ animations ------------------------------ */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`
const noMotion = "@media (prefers-reduced-motion: reduce)"

/* ------------------------------ findings ------------------------------ */

const findingsGrid = css`
  display: grid;
  gap: var(--spacing-md);
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
`
const findingCard = (accent: string, i: number) => css`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: linear-gradient(160deg, var(--white) 55%, color-mix(in srgb, ${accent} 7%, var(--white)));
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  overflow: hidden;
  animation: ${fadeUp} 420ms both;
  animation-delay: ${i * 70}ms;
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 3px;
    background: ${accent};
  }
  &:hover {
    border-color: var(--gray-300);
    box-shadow: var(--elevation-200, 0 4px 14px rgba(0, 0, 0, 0.08));
    transform: translateY(-2px);
  }
  ${noMotion} {
    animation: none;
    transition: none;
  }
`
const findingLabel = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--typography-light);
`
const findingIcon = (accent: string) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: var(--rounded-md);
  background: color-mix(in srgb, ${accent} 14%, var(--white));
  color: ${accent};
  flex: none;
`
const findingHeadline = css`
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--typography-base);
  line-height: 1.15;
`
const findingBody = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  flex: 1;
  min-height: 2.6em;
`
const findingCta = css`
  margin-top: auto;
`

interface Finding {
  key: string
  label: string
  icon: string
  accent: string
  headline: string
  body: string
  cta: { label: string; tab: TabId }
}

/** Derive the four headline findings from data already on hand, no extra calls. */
function buildFindings(
  d: DashboardData,
  promptInsights: PromptInsightsData | null,
  promptsLoading: boolean,
): Finding[] {
  const ai = d.aiVisibility
  const findings: Finding[] = []

  /* Card 1, AI visibility */
  if (ai) {
    const score = Math.max(0, Math.min(100, Math.round(ai.kpis.shareOfVoicePct.value)))
    const verdict = score < 10 ? "Low" : score < 30 ? "Moderate" : score < 60 ? "Strong" : "Leading"
    const bench = ai.competitorBenchmark
    findings.push({
      key: "ai",
      label: "AI visibility",
      icon: "comment",
      accent: score < 10 ? "var(--utility-danger-icon)" : score < 30 ? "var(--utility-caution-icon)" : "var(--utility-success-icon)",
      headline: `${score}/100 · ${verdict}`,
      body: bench
        ? `${formatCompact(ai.kpis.mentions.value)} AI mentions this month, tracked competitors average ${formatCompact(bench.mentionsAvg)}.`
        : `${formatCompact(ai.kpis.mentions.value)} AI mentions this month across the covered assistants.`,
      cta: { label: "Review AI visibility", tab: "ai" },
    })
  } else {
    findings.push({
      key: "ai",
      label: "AI visibility",
      icon: "comment",
      accent: "var(--gray-400)",
      headline: "Not collecting yet",
      body: "AI visibility hasn't produced data for this domain yet, check back after the next snapshot.",
      cta: { label: "Open AI visibility", tab: "ai" },
    })
  }

  /* Card 2, Topics & Prompts */
  if (promptInsights && promptInsights.prompts.length) {
    const prompts = promptInsights.prompts
    const avgVisibility = Math.round(prompts.reduce((s, p) => s + p.visibilityPct, 0) / prompts.length)
    const weakest = promptInsights.byAssistant?.slice().sort((a, b) => a.yourMentions - b.yourMentions)[0]
    findings.push({
      key: "prompts",
      label: "Topics & prompts",
      icon: "bulb",
      accent: avgVisibility < 40 ? "var(--utility-danger-icon)" : avgVisibility < 75 ? "var(--utility-caution-icon)" : "var(--utility-success-icon)",
      headline: `${avgVisibility}% prompt visibility`,
      body: `Across ${prompts.length} prompts on four assistants${
        weakest && !weakest.leaderIsYou && weakest.leader ? `, ${weakest.platform} leans toward ${weakest.leader}` : ""
      }.`,
      cta: { label: "Open Topics & Prompts", tab: "prompts" },
    })
  } else if (promptsLoading) {
    findings.push({
      key: "prompts",
      label: "Topics & prompts",
      icon: "bulb",
      accent: "var(--brand-secondary-4, #0052ed)",
      headline: "Running your prompts…",
      body: "Asking ChatGPT, Claude, Gemini, and Perplexity right now. A fresh snapshot takes a minute or two.",
      cta: { label: "Open Topics & Prompts", tab: "prompts" },
    })
  } else {
    findings.push({
      key: "prompts",
      label: "Topics & prompts",
      icon: "bulb",
      accent: "var(--brand-secondary-4, #0052ed)",
      headline: "Prompts not run yet",
      body: "Ask your configured prompts to ChatGPT, Claude, Gemini, and Perplexity to see who wins each answer.",
      cta: { label: "Run your prompts", tab: "prompts" },
    })
  }

  /* Card 3, Keywords */
  const striking = d.keywords.filter((k) => k.strikingDistance)
  const topStriking = striking.slice().sort((a, b) => b.volume - a.volume)[0]
  findings.push({
    key: "keywords",
    label: "Keywords",
    icon: "search",
    accent: "var(--primary-action-default)",
    headline: `${striking.length} quick win${striking.length === 1 ? "" : "s"}`,
    body: striking.length
      ? `${striking.length} keywords rank 4–15, almost page-one.${topStriking ? ` Biggest: “${topStriking.keyword}” at #${topStriking.position}.` : ""}`
      : `${formatCompact(d.overview.kpis.rankedKeywords.value)} ranked keywords tracked, no striking-distance targets right now.`,
    cta: { label: "Work the keyword list", tab: "keywords" },
  })

  /* Card 4, vs competitors */
  const gaps = (ai?.topicMentions ?? []).filter((t) => t.topCompetitorMentions > t.yourMentions)
  const worstGap = gaps.slice().sort((a, b) => b.topCompetitorMentions - b.yourMentions - (a.topCompetitorMentions - a.yourMentions))[0]
  findings.push({
    key: "competitors",
    label: "vs competitors",
    icon: "flag-alt",
    accent: gaps.length ? "var(--utility-caution-icon)" : "var(--utility-success-icon)",
    headline: gaps.length ? `${gaps.length} topic gap${gaps.length === 1 ? "" : "s"}` : "Holding your ground",
    body: worstGap
      ? `Competitors lead ${gaps.length} of ${ai?.topicMentions.length ?? 0} tracked topics, biggest: “${worstGap.topic}” (${worstGap.topCompetitor} ${worstGap.topCompetitorMentions} vs you ${worstGap.yourMentions}).`
      : "No tracked topic where a competitor out-mentions you in AI answers.",
    cta: { label: "See the topic battle", tab: "ai" },
  })

  return findings
}

/* --------------------------- recommendations --------------------------- */

const recoList = css`
  display: flex;
  flex-direction: column;
`
const recoRow = (i: number) => css`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--gray-100);
  animation: ${fadeUp} 360ms both;
  animation-delay: ${i * 60}ms;
  &:first-of-type {
    border-top: none;
  }
  ${noMotion} {
    animation: none;
  }
`
const recoRank = css`
  flex: none;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--rounded-full);
  background: var(--gray-100);
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--typography-base);
`
const recoText = css`
  flex: 1;
  min-width: 0;
`
const recoTitle = css`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--typography-base);
`
const recoWhy = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
/* Fixed-width action column: every CTA button spans the same width so the
   right edge of the list stays crisp regardless of label length. */
const recoAction = css`
  flex: none;
  width: 176px;
  /* !important: the design-system button sets its own width with equal specificity */
  button {
    width: 100% !important;
    max-width: none !important;
    justify-content: center !important;
  }
`

/* ------------------------------- movers ------------------------------- */

const moversGrid = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  column-gap: var(--spacing-sm);
  font-size: var(--fs-sm);
`
const moverCell = css`
  padding: var(--spacing-sm) 0;
  border-bottom: 1px solid var(--gray-100);
  /* drop the border on the three cells of the last row */
  &:nth-last-of-type(-n + 3) {
    border-bottom: none;
  }
`
const moverKw = css`
  min-width: 0;
  color: var(--typography-base);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const moverPos = (up: boolean) => css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2xs);
  font-variant-numeric: tabular-nums;
  color: ${up ? "var(--utility-success-title)" : "var(--utility-danger-title)"};
  font-weight: 600;
`
const moverVol = css`
  color: var(--typography-light);
  font-size: var(--fs-xs);
  font-variant-numeric: tabular-nums;
  text-align: right;
`
const moverColTitle = css`
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--typography-light);
  margin-bottom: var(--spacing-2xs);
`
const alertRow = (tone: "danger" | "caution") => css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  text-align: left;
  padding: var(--spacing-sm) var(--spacing-3);
  border: 1px solid var(--gray-200);
  border-left: 3px solid
    ${tone === "danger" ? "var(--utility-danger-icon)" : "var(--utility-caution-icon)"};
  border-radius: var(--rounded-md);
  background: var(--white);
  cursor: pointer;
  transition: background 0.15s ease;
  &:hover {
    background: var(--gray-50);
  }
`
const alertCount = css`
  font-weight: 700;
  font-size: var(--fs-md);
  color: var(--typography-base);
  font-variant-numeric: tabular-nums;
`
const alertLabel = css`
  font-size: var(--fs-sm);
  color: var(--typography-base);
  flex: 1;
`
const linkRow = css`
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-sm);
`
const bucketDrill = css`
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--gray-100);
`
const bucketRow = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-2xs) 0;
  font-size: var(--fs-sm);
`
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

function MoversList({
  title,
  movers,
  direction,
}: {
  title: string
  movers: OverviewData["movers"]["gains"]
  direction: "up" | "down"
}) {
  const up = direction === "up"
  return (
    <div>
      <div css={moverColTitle}>{title}</div>
      <div css={moversGrid}>
        {movers.map((m) => (
          <Fragment key={m.keyword}>
            <Tooltip title={m.keyword} placement="top-start">
              <span css={[moverCell, moverKw]}>{m.keyword}</span>
            </Tooltip>
            <span css={[moverCell, moverPos(up)]}>
              <Icon icon={up ? "arrow-up" : "arrow-down"} size="0.75rem" iconColor={up ? "utility-success" : "red"} />
              {`${m.from}→${m.to}`}
            </span>
            <span css={[moverCell, moverVol]}>{formatCompact(m.volume)}</span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------- tab --------------------------------- */

const POSITION_BUCKETS = [
  { label: "Positions 1–3", min: 1, max: 3, color: chartColors.success },
  { label: "Positions 4–10", min: 4, max: 10, color: chartColors.accent },
  { label: "Positions 11–20", min: 11, max: 20, color: chartColors.caution },
  { label: "Positions 21+", min: 21, max: 10000, color: chartColors.neutral },
] as const

export function OverviewTab({
  data: d,
  promptInsights,
  promptsLoading = false,
  loading,
  onNavigate,
  asOf,
}: {
  /** The full dashboard dataset, findings cards draw on every tab's data. */
  data: DashboardData
  promptInsights: PromptInsightsData | null
  /** True while the prompt run is in flight (fresh snapshot). */
  promptsLoading?: boolean
  loading: boolean
  onNavigate: (t: TabId) => void
  asOf: string
}) {
  const [bucket, setBucket] = useState<number | null>(null)

  const findings = useMemo(() => buildFindings(d, promptInsights, promptsLoading), [d, promptInsights, promptsLoading])
  // Top slice of the Opportunities tab's lists, one source of truth.
  const recommendations = useMemo(() => topOpportunities(d, promptInsights, 5), [d, promptInsights])

  const bucketKeywords: KeywordRow[] = useMemo(() => {
    if (bucket == null) return []
    const b = POSITION_BUCKETS[bucket]
    return d.keywords
      .filter((k) => k.position >= b.min && k.position <= b.max)
      .sort((a, b2) => b2.volume - a.volume)
      .slice(0, 5)
  }, [bucket, d.keywords])

  if (loading) {
    return (
      <VStack>
        <AutoGrid min="250px">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton height="120px" key={i} />
          ))}
        </AutoGrid>
        <AutoGrid min="200px">
          {Array.from({ length: 3 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </AutoGrid>
        <SplitGrid>
          <CardSkeleton />
          <CardSkeleton />
        </SplitGrid>
      </VStack>
    )
  }

  const data = d.overview
  const k = data.kpis
  const pd = data.positionDistribution

  return (
    <VStack>
      {/* ---- headline findings: what matters right now, one card per report ---- */}
      <div css={findingsGrid}>
        {findings.map((f, i) => (
          <div css={findingCard(f.accent, i)} key={f.key}>
            <span css={findingLabel}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <span css={findingIcon(f.accent)}><Icon icon={f.icon as any} size="0.875rem" iconColor="currentColor" /></span>
              {f.label}
            </span>
            <span css={findingHeadline}>{f.headline}</span>
            <span css={findingBody}>{f.body}</span>
            <div css={findingCta}>
              <Button buttonType="ghost" size="sm" onClick={() => onNavigate(f.cta.tab)}>
                <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
                  {f.cta.label}
                  <Icon icon="arrow-right" size="0.875rem" iconColor="currentColor" />
                </span>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <AutoGrid min="200px">
        <KpiCard label="Est. organic traffic" info="Estimated monthly organic visits from ranked keywords." kpi={k.traffic} />
        <KpiCard label="Ranked keywords" info="Total keywords the domain ranks for in the top 100." kpi={k.rankedKeywords} />
        {/* Nullable KPIs are hidden when the live data source can't provide them. */}
        {k.referringDomains ? (
          <KpiCard label="Referring domains" info="Unique domains linking to your site." kpi={k.referringDomains} />
        ) : null}
        {k.siteHealth ? (
          <KpiCard label="Site health score" info="Aggregate technical SEO health from the latest crawl (0–100)." kpi={k.siteHealth} format={(n) => `${n}`} />
        ) : null}
        {k.aiMentions30d ? (
          <KpiCard label="AI mentions (30d)" info="Times your brand was mentioned by AI assistants in the last 30 days." kpi={k.aiMentions30d} />
        ) : null}
      </AutoGrid>

      <SplitGrid template="1fr 1fr">
        <DashCard
          title="Position distribution"
          info="How your ranked keywords are spread across SERP positions. Click a segment to see its top keywords."
          asOf={asOf}
        >
          <DistributionBar
            segments={POSITION_BUCKETS.map((b, i) => ({
              label: b.label,
              value: [pd.top3, pd.p4to10, pd.p11to20, pd.p21plus][i],
              delta: [pd.deltas.top3, pd.deltas.p4to10, pd.deltas.p11to20, pd.deltas.p21plus][i],
              color: b.color,
            }))}
            selected={bucket}
            onSelect={(i) => setBucket((cur) => (cur === i ? null : i))}
          />
          {bucket != null ? (
            <div css={bucketDrill}>
              <div css={moverColTitle}>{`Top keywords · ${POSITION_BUCKETS[bucket].label}`}</div>
              {bucketKeywords.length === 0 ? (
                <span css={css`font-size: var(--fs-sm); color: var(--typography-inactive);`}>
                  No tracked keywords in this range.
                </span>
              ) : (
                bucketKeywords.map((kw) => (
                  <div css={bucketRow} key={kw.keyword}>
                    <Tooltip title={kw.keyword} placement="top-start">
                      <span css={moverKw}>{kw.keyword}</span>
                    </Tooltip>
                    <Chip size="sm" variant="outlined" theme="neutral-light" text={`#${kw.position}`} />
                    <span css={moverVol}>{`${formatCompact(kw.volume)}/mo`}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </DashCard>

        <DashCard title="Movers" info="Biggest ranking gains and losses since the previous snapshot. Hover a keyword to see it in full." asOf={asOf}>
          <SplitGrid template="1fr 1fr">
            <MoversList title="Top gains" movers={data.movers.gains} direction="up" />
            <MoversList title="Top losses" movers={data.movers.losses} direction="down" />
          </SplitGrid>
          <div css={linkRow}>
            <Button buttonType="ghost" size="sm" onClick={() => onNavigate("keywords")}>
              View all in Keywords
            </Button>
          </div>
        </DashCard>
      </SplitGrid>

      <SplitGrid template="minmax(0, 340px) 1fr">
        <DashCard title="Attention needed" info="Issues that may be costing you traffic or visibility." asOf={asOf}>
          <VStack>
            <button css={alertRow("caution")} onClick={() => onNavigate("decaying")}>
              <Icon icon="trending-down" size="1rem" iconColor="red" />
              <span css={alertLabel}>pages decaying</span>
              <span css={alertCount}>{data.alerts.decayingPages}</span>
              <Icon icon="chevron-right" size="0.875rem" iconColor="gray" />
            </button>
            <button css={alertRow("danger")} onClick={() => onNavigate("ai")}>
              <Icon icon="flag-alt" size="1rem" iconColor="red" />
              <span css={alertLabel}>pages lost AI citations</span>
              <span css={alertCount}>{data.alerts.lostAiCitations}</span>
              <Icon icon="chevron-right" size="0.875rem" iconColor="gray" />
            </button>
            <button css={alertRow("caution")} onClick={() => onNavigate("keywords")}>
              <Icon icon="close-r" size="1rem" iconColor="gray" />
              <span css={alertLabel}>crawl issues</span>
              <span css={alertCount}>{data.alerts.crawlIssues}</span>
              <Icon icon="chevron-right" size="0.875rem" iconColor="gray" />
            </button>
          </VStack>
        </DashCard>

        <DashCard title="Traffic trend" info="Estimated organic traffic across the last 12 weekly snapshots." asOf={asOf}>
          <TrafficAreaChart data={data.trafficTrend} />
          <div css={css`font-size: var(--fs-xs); color: var(--typography-light); margin-top: var(--spacing-sm);`}>
            {`Latest week: ${formatNumber(data.trafficTrend[data.trafficTrend.length - 1].traffic)} est. visits`}
          </div>
        </DashCard>
      </SplitGrid>

      {/* ---- top backlinks (hidden when the backlinks API isn't subscribed) ---- */}
      {d.backlinks.length > 0 ? (
        <DashCard
          title="Top backlinks"
          info="Your strongest inbound links by page rank, the authority signals search engines and AI assistants both weigh."
          asOf={asOf}
          flush
        >
          <ResponsiveTableContainer>
            <Table css={fixedTable}>
              <TableHead>
                <TableRow>
                  <TableCellHead css={css`width: 36%;`}>Source</TableCellHead>
                  <TableCellHead css={css`width: 22%;`}>Anchor</TableCellHead>
                  <TableCellHead css={css`width: 24%;`}>Links to</TableCellHead>
                  <TableCellHead css={css`width: 9%;`} align="right">Rank</TableCellHead>
                  <TableCellHead css={css`width: 9%;`}>Follow</TableCellHead>
                </TableRow>
              </TableHead>
              <TableBody>
                {d.backlinks.map((b) => (
                  <TableRow key={`${b.urlFrom}→${b.urlTo}`}>
                    <TableCellData>
                      <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); max-width: 100%;`}>
                        <BrandLogo domain={b.urlFrom} size={16} />
                        <a css={pageLink} href={b.urlFrom} target="_blank" rel="noopener noreferrer" title={b.urlFrom}>
                          {truncateUrl(b.urlFrom, 42)}
                        </a>
                      </span>
                    </TableCellData>
                    <TableCellData>
                      <span css={css`font-size: var(--fs-xs); color: var(--typography-light); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; max-width: 100%; vertical-align: bottom;`} title={b.anchor ?? undefined}>
                        {b.anchor || "—"}
                      </span>
                    </TableCellData>
                    <TableCellData>
                      <a css={pageLink} href={b.urlTo} target="_blank" rel="noopener noreferrer" title={b.urlTo}>
                        {truncateUrl(b.urlTo, 32)}
                      </a>
                    </TableCellData>
                    <TableCellData css={css`font-variant-numeric: tabular-nums; text-align: right;`}>{b.rank}</TableCellData>
                    <TableCellData>
                      {b.dofollow ? (
                        <Chip size="sm" variant="solid" theme="utility-success" text="dofollow" />
                      ) : (
                        <Chip size="sm" variant="outlined" theme="neutral-light" text="nofollow" />
                      )}
                    </TableCellData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ResponsiveTableContainer>
        </DashCard>
      ) : null}

      {/* ---- what to do next: the five moves the data says matter most ---- */}
      {recommendations.length > 0 ? (
        <DashCard
          title="What to do next"
          info="The five highest-impact actions based on everything above, each one is content work you can do in Uniform Canvas. The Opportunities tab has the full ranked lists."
          asOf={asOf}
          flush
          action={
            <Button buttonType="ghost" size="sm" onClick={() => onNavigate("opportunities")}>
              <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap;`}>
                All opportunities
                <Icon icon="arrow-right" size="0.875rem" iconColor="currentColor" />
              </span>
            </Button>
          }
        >
          <div css={recoList}>
            {recommendations.map((r, i) => (
              <div css={recoRow(i)} key={r.id}>
                <span css={recoRank}>{i + 1}</span>
                <span css={recoText}>
                  <span css={css`display: block; ${recoTitle}`}>{r.title}</span>
                  <span css={css`display: block; ${recoWhy}`} title={r.why}>{r.why}</span>
                </span>
                <span css={recoAction}>
                  {r.cta.href ? (
                    <Button buttonType="secondary" size="sm" onClick={() => window.open(r.cta.href, "_blank", "noopener")}>
                      <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap;`}>
                        {r.cta.label}
                        <Icon icon="external" size="0.75rem" iconColor="currentColor" />
                      </span>
                    </Button>
                  ) : (
                    <Button buttonType="secondary" size="sm" onClick={() => r.cta.tab && onNavigate(r.cta.tab)}>
                      <span css={css`white-space: nowrap;`}>{r.cta.label}</span>
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </DashCard>
      ) : null}
    </VStack>
  )
}
