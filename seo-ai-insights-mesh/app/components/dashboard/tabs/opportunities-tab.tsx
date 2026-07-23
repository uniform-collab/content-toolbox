/** @jsxImportSource @emotion/react */
"use client"

import { useMemo } from "react"
import { css, keyframes } from "@emotion/react"
import { Button, Chip, Icon } from "@uniformdev/design-system"
import type { DashboardData, PromptInsightsData } from "../../../lib/types"
import {
  ACTION_LABEL,
  buildAiOpportunities,
  buildKeywordOpportunities,
  type Opportunity,
  type OpportunityAction,
  type OpportunityTab,
} from "../../../lib/opportunities"
import { truncateUrl } from "../../../lib/format"
import { VStack } from "../grids"
import { CardSkeleton, DashCard } from "../widgets"
import { BrandLogo } from "../brand-logo"

/* ------------------------------ styles ------------------------------ */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
`
const noMotion = "@media (prefers-reduced-motion: reduce)"

const note = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  margin: 0 0 var(--spacing-md);
`
const oppRow = (i: number) => css`
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-top: 1px solid var(--gray-100);
  animation: ${fadeUp} 360ms both;
  animation-delay: ${Math.min(i, 8) * 55}ms;
  &:first-of-type {
    border-top: none;
  }
  ${noMotion} {
    animation: none;
  }
`
const oppRank = css`
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
  margin-top: 2px;
`
const oppBody = css`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
`
const oppTitleRow = css`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
`
const oppTitle = css`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--typography-base);
`
const oppWhy = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const modelRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  color: var(--typography-light);
  min-width: 0;
`
const modelLink = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-family: var(--ff-mono);
  color: var(--typography-base);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  &:hover {
    text-decoration: underline;
    color: var(--brand-secondary-4, #0052ed);
  }
`
/* Fixed-width action column so impact chips and CTA buttons align down the list. */
const oppSide = css`
  flex: none;
  width: 176px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--spacing-sm);
  /* !important: the design-system button sets its own width with equal specificity */
  button {
    width: 100% !important;
    max-width: none !important;
    justify-content: center !important;
  }
`
const emptyBox = css`
  padding: var(--spacing-lg) var(--spacing-md);
  font-size: var(--fs-sm);
  color: var(--typography-light);
  text-align: center;
`
const promptHint = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  margin: var(--spacing-md);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--rounded-md);
  background: var(--gray-50);
  font-size: var(--fs-xs);
  color: var(--typography-light);
`

const ACTION_THEME: Record<OpportunityAction, { theme: Parameters<typeof Chip>[0]["theme"]; variant: "solid" | "outlined" }> = {
  create: { theme: "accent-light", variant: "solid" },
  expand: { theme: "utility-caution", variant: "outlined" },
  refresh: { theme: "neutral-light", variant: "outlined" },
  citability: { theme: "utility-success", variant: "outlined" },
  earn: { theme: "neutral-light", variant: "solid" },
}

const IMPACT_THEME: Record<Opportunity["impact"], Parameters<typeof Chip>[0]["theme"]> = {
  high: "utility-success",
  medium: "utility-caution",
  low: "neutral-light",
}

/* ------------------------------ pieces ------------------------------ */

function OpportunityRow({
  opp,
  index,
  onNavigate,
}: {
  opp: Opportunity
  index: number
  onNavigate: (t: OpportunityTab) => void
}) {
  const action = ACTION_THEME[opp.action]
  return (
    <div css={oppRow(index)}>
      <span css={oppRank}>{index + 1}</span>
      <span css={oppBody}>
        <span css={oppTitleRow}>
          <Chip size="sm" variant={action.variant} theme={action.theme} text={ACTION_LABEL[opp.action]} />
          <span css={oppTitle}>{opp.title}</span>
        </span>
        <span css={oppWhy}>{opp.why}</span>
        {opp.model ? (
          <span css={modelRow}>
            <span css={css`flex: none;`}>Model:</span>
            <a css={modelLink} href={opp.model.url} target="_blank" rel="noopener noreferrer" title={opp.model.url}>
              <BrandLogo domain={opp.model.domain} size={14} />
              {truncateUrl(opp.model.url, 44)}
            </a>
            <span css={css`flex: none; color: var(--typography-inactive);`}>{`· ${opp.model.note}`}</span>
          </span>
        ) : opp.target?.url ? (
          <span css={modelRow}>
            <span css={css`flex: none;`}>Your page:</span>
            <a
              css={modelLink}
              href={opp.target.url.startsWith("http") ? opp.target.url : `https://${opp.target.url.replace(/^\//, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              title={opp.target.url}
            >
              {truncateUrl(opp.target.url, 48)}
            </a>
          </span>
        ) : null}
      </span>
      <span css={oppSide}>
        <Chip size="sm" variant="solid" theme={IMPACT_THEME[opp.impact]} text={`${opp.impact} impact`} />
        {opp.cta.href ? (
          <Button buttonType="secondary" size="sm" onClick={() => window.open(opp.cta.href, "_blank", "noopener")}>
            <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap;`}>
              {opp.cta.label}
              <Icon icon="external" size="0.75rem" iconColor="currentColor" />
            </span>
          </Button>
        ) : (
          <Button buttonType="secondary" size="sm" onClick={() => opp.cta.tab && onNavigate(opp.cta.tab)}>
            <span css={css`white-space: nowrap;`}>{opp.cta.label}</span>
          </Button>
        )}
      </span>
    </div>
  )
}

/* -------------------------------- tab -------------------------------- */

export function OpportunitiesTab({
  data: d,
  promptInsights,
  promptsLoading = false,
  loading,
  onNavigate,
  asOf,
}: {
  data: DashboardData
  promptInsights: PromptInsightsData | null
  /** True while the prompt run is in flight (fresh snapshot). */
  promptsLoading?: boolean
  loading: boolean
  onNavigate: (t: OpportunityTab) => void
  asOf: string
}) {
  const keywordOpps = useMemo(() => buildKeywordOpportunities(d), [d])
  const aiOpps = useMemo(() => buildAiOpportunities(d, promptInsights), [d, promptInsights])

  if (loading) {
    return (
      <VStack>
        <CardSkeleton height="320px" />
        <CardSkeleton height="320px" />
      </VStack>
    )
  }

  return (
    <VStack>
      <p css={note}>
        {`${keywordOpps.length} keyword and ${aiOpps.length} AI visibility opportunities, ranked by demand at stake, each with the concrete action and the page to model it on. Derived from data already collected; acting on these costs nothing.`}
      </p>

      <DashCard
        title="Keyword opportunities"
        info="Where a focused content edit moves real search traffic: striking-distance keywords, recent losses, page-two keywords with demand, and decaying pages. Impact reflects the monthly demand at stake."
        asOf={asOf}
        flush
      >
        {keywordOpps.length === 0 ? (
          <div css={emptyBox}>Nothing urgent, your rankings are holding. Check back after the next snapshot.</div>
        ) : (
          keywordOpps.map((o, i) => <OpportunityRow opp={o} index={i} onNavigate={onNavigate} key={o.id} />)
        )}
      </DashCard>

      <DashCard
        title="AI citation & mention opportunities"
        info="Where AI assistants send attention you're missing: topics a competitor dominates, prompts you're invisible for, mentions that never become citations. The model link shows the page the AIs cite today, that's the bar to beat."
        asOf={asOf}
        flush
      >
        {!promptInsights ? (
          <div css={promptHint}>
            <span>
              {promptsLoading
                ? "Running your prompts across the four assistants… prompt-level opportunities appear here in a minute."
                : "Run your prompts on the Topics & Prompts tab to unlock prompt-level opportunities here."}
            </span>
            <Button buttonType="ghost" size="sm" onClick={() => onNavigate("prompts")}>
              <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs); white-space: nowrap;`}>
                Topics &amp; Prompts
                <Icon icon="arrow-right" size="0.875rem" iconColor="currentColor" />
              </span>
            </Button>
          </div>
        ) : null}
        {aiOpps.length === 0 ? (
          <div css={emptyBox}>
            No AI visibility gaps detected{promptInsights ? "" : " yet"}, keep the cited pages fresh to stay there.
          </div>
        ) : (
          aiOpps.map((o, i) => <OpportunityRow opp={o} index={i} onNavigate={onNavigate} key={o.id} />)
        )}
      </DashCard>
    </VStack>
  )
}
