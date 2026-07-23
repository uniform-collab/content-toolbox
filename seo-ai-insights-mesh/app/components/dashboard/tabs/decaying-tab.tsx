/** @jsxImportSource @emotion/react */
"use client"

import { useMemo, useState } from "react"
import { css } from "@emotion/react"
import { Button, Callout, Chip, Icon, SegmentedControl } from "@uniformdev/design-system"
import type { DecayingPage } from "../../../lib/types"
import { formatCompact } from "../../../lib/format"
import { VStack } from "../grids"
import { CardSkeleton, DashCard } from "../widgets"
import { Sparkline } from "../charts"

const intro = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  margin: 0 0 var(--spacing-md);
  max-width: 68ch;
`
const controls = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
`
const spacer = css`
  margin-left: auto;
`
const list = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`
const row = css`
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  background: var(--white);
  overflow: hidden;
`
const rowHead = css`
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  cursor: pointer;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  &:hover {
    background: var(--gray-50);
  }
`
const pathText = css`
  font-family: var(--ff-mono);
  font-size: var(--fs-sm);
  color: var(--typography-base);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
`
const pathTruncate = css`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`
const metric = css`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
`
const metricLabel = css`
  font-size: var(--fs-2xs, 0.6875rem);
  color: var(--typography-light);
  text-transform: uppercase;
  letter-spacing: 0.04em;
`
const metricValue = (tone: "danger" | "base") => css`
  font-size: var(--fs-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${tone === "danger" ? "var(--utility-danger-title)" : "var(--typography-base)"};
`
const chevron = (open: boolean) => css`
  transition: transform 120ms ease;
  transform: rotate(${open ? 90 : 0}deg);
  color: var(--typography-light);
`
const body = css`
  padding: 0 var(--spacing-md) var(--spacing-md);
  border-top: 1px solid var(--gray-100);
  display: grid;
  gap: var(--spacing-lg);
  grid-template-columns: 1fr;
`
const detailGrid = css`
  display: grid;
  gap: var(--spacing-lg);
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  padding-top: var(--spacing-md);
`
const detailBlock = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`
const detailTitle = css`
  font-size: var(--fs-xs);
  font-weight: 600;
  color: var(--typography-light);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
`
const lostRow = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  padding: var(--spacing-2xs) 0;
`
const lostKw = css`
  color: var(--typography-base);
`
const posChange = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2xs);
  font-variant-numeric: tabular-nums;
  color: var(--utility-danger-title);
  font-weight: 600;
`
const citationRow = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  padding: var(--spacing-2xs) 0;
`
const muted = css`
  color: var(--typography-inactive);
  font-size: var(--fs-sm);
`
const footerRow = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--gray-100);
`
const editMeta = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  color: var(--typography-light);
`

type SortKey = "traffic" | "keywords" | "citations"

const SORTS: { label: string; value: SortKey }[] = [
  { label: "Traffic drop", value: "traffic" },
  { label: "Keywords lost", value: "keywords" },
  { label: "AI citations lost", value: "citations" },
]

function StaleChip({ months }: { months: number }) {
  const theme = months >= 12 ? "utility-danger" : months >= 6 ? "utility-caution" : "neutral-light"
  return <Chip size="sm" variant="outlined" theme={theme} text={`Edited ${months}mo ago`} />
}

export function DecayingTab({
  pages,
  loading,
  asOf,
}: {
  pages: DecayingPage[]
  loading?: boolean
  asOf: string
}) {
  const [open, setOpen] = useState<string | null>(pages[0]?.path ?? null)
  const [sortKey, setSortKey] = useState<SortKey>("traffic")

  const sorted = useMemo(() => {
    const copy = [...pages]
    copy.sort((a, b) => {
      if (sortKey === "traffic") return a.trafficDelta - b.trafficDelta
      if (sortKey === "keywords") return b.keywordsLost.length - a.keywordsLost.length
      return b.aiCitationsLost.length - a.aiCitationsLost.length
    })
    return copy
  }, [pages, sortKey])

  const totals = useMemo(
    () => ({
      traffic: pages.reduce((s, p) => s + p.trafficDelta, 0),
      keywords: pages.reduce((s, p) => s + p.keywordsLost.length, 0),
      citations: pages.reduce((s, p) => s + p.aiCitationsLost.length, 0),
    }),
    [pages],
  )

  if (loading) {
    return (
      <VStack>
        <CardSkeleton height="480px" />
      </VStack>
    )
  }

  return (
    <VStack>
      <Callout type="caution" title="Content decay detected">
        {`${pages.length} pages are losing organic traffic, rankings, or AI citations versus prior snapshots. Refreshing stale content is the fastest way to recover this visibility.`}
      </Callout>

      <DashCard
        title="Decaying pages"
        info="Pages whose organic traffic, keyword rankings, or AI citations have declined between the compared snapshots. Sorted by the selected impact metric."
        asOf={asOf}
        flush
      >
        <div css={css`padding: var(--spacing-md);`}>
          <p css={intro}>
            Prioritize refreshes by impact. Each page links straight to its entry in Uniform so you can
            update the content and reclaim traffic and AI visibility.
          </p>
          <div css={controls}>
            <SegmentedControl
              name="decay-sort"
              size="sm"
              value={sortKey}
              options={SORTS}
              onChange={(v) => setSortKey(v as SortKey)}
            />
            <div css={[editMeta, spacer]}>
              <span>{`${formatCompact(Math.abs(totals.traffic))} visits lost`}</span>
              <span aria-hidden>·</span>
              <span>{`${totals.keywords} keywords`}</span>
              <span aria-hidden>·</span>
              <span>{`${totals.citations} AI citations`}</span>
            </div>
          </div>

          <div css={list}>
            {sorted.map((p) => {
              const isOpen = open === p.path
              return (
                <div css={row} key={p.path}>
                  <button
                    css={rowHead}
                    onClick={() => setOpen(isOpen ? null : p.path)}
                    aria-expanded={isOpen}
                  >
                    <span css={pathText}>
                      <Icon icon="chevron-right" size="0.875rem" css={chevron(isOpen)} />
                      <span css={pathTruncate}>{p.path}</span>
                    </span>
                    <span css={metric}>
                      <span css={metricLabel}>Traffic</span>
                      <span css={metricValue("danger")}>{formatCompact(p.trafficDelta)}</span>
                    </span>
                    <span css={metric}>
                      <span css={metricLabel}>Keywords</span>
                      <span css={metricValue(p.keywordsLost.length > 0 ? "danger" : "base")}>
                        {p.keywordsLost.length > 0 ? `-${p.keywordsLost.length}` : "0"}
                      </span>
                    </span>
                    <span css={metric}>
                      <span css={metricLabel}>AI cites</span>
                      <span css={metricValue(p.aiCitationsDelta < 0 ? "danger" : "base")}>
                        {p.aiCitationsDelta < 0 ? p.aiCitationsDelta : "0"}
                      </span>
                    </span>
                  </button>

                  {isOpen ? (
                    <div css={body}>
                      <div css={detailGrid}>
                        <div css={detailBlock}>
                          <h4 css={detailTitle}>Traffic trend</h4>
                          {p.trafficSpark.length > 0 ? (
                            <>
                              <Sparkline
                                data={p.trafficSpark}
                                color="var(--utility-danger-icon)"
                                filled
                                width={220}
                                height={56}
                              />
                              <span css={muted}>{`${formatCompact(p.trafficSpark[0])} → ${formatCompact(
                                p.trafficSpark[p.trafficSpark.length - 1],
                              )} monthly visits`}</span>
                            </>
                          ) : (
                            <span css={muted}>{`~${formatCompact(Math.abs(p.trafficDelta))} monthly visits at risk (estimated from slipping keywords)`}</span>
                          )}
                        </div>

                        <div css={detailBlock}>
                          <h4 css={detailTitle}>Keywords lost</h4>
                          {p.keywordsLost.length === 0 ? (
                            <span css={muted}>No keyword drops</span>
                          ) : (
                            p.keywordsLost.map((k) => (
                              <div css={lostRow} key={k.keyword}>
                                <span css={lostKw}>{k.keyword}</span>
                                <span css={posChange}>
                                  {`#${k.from}`}
                                  <Icon icon="arrow-right" size="0.75rem" iconColor="red" />
                                  {`#${k.to}`}
                                </span>
                              </div>
                            ))
                          )}
                        </div>

                        <div css={detailBlock}>
                          <h4 css={detailTitle}>AI citations lost</h4>
                          {p.aiCitationsLost.length === 0 ? (
                            <span css={muted}>No citations lost</span>
                          ) : (
                            p.aiCitationsLost.map((c) => (
                              <div css={citationRow} key={`${c.topic}-${c.model}`}>
                                <span css={lostKw}>{c.topic}</span>
                                <Chip size="sm" variant="outlined" theme="neutral-light" text={c.model} />
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div css={footerRow}>
                        <span css={editMeta}>
                          {p.lastEditedMonthsAgo != null ? <StaleChip months={p.lastEditedMonthsAgo} /> : null}
                        </span>
                        <Button
                          buttonType="primary"
                          size="sm"
                          disabled={!p.uniformEditUrl}
                          tooltip={p.uniformEditUrl ? undefined : "Available when running inside a Uniform project"}
                          onClick={() => window.open(p.uniformEditUrl, "_blank", "noopener,noreferrer")}
                        >
                          Refresh in Uniform
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </DashCard>
    </VStack>
  )
}
