/** @jsxImportSource @emotion/react */
"use client"

import type { ReactNode } from "react"
import { css } from "@emotion/react"
import { Chip, Icon, Skeleton, Tooltip } from "@uniformdev/design-system"
import { Sparkline } from "./charts"
import { formatCompact, formatSignedPct } from "../../lib/format"
import type { Kpi } from "../../lib/types"

/* ---------------- Info tooltip ---------------- */

const infoDot = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: var(--rounded-full);
  border: 1px solid var(--gray-300);
  color: var(--gray-500);
  font-size: 10px;
  font-weight: 700;
  font-style: italic;
  cursor: help;
  flex: none;
`

export function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip title={text} placement="top">
      <span css={infoDot} aria-label={text} role="img">
        i
      </span>
    </Tooltip>
  )
}

/* ---------------- Card ---------------- */

const card = css`
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  display: flex;
  flex-direction: column;
  min-width: 0;
`
const cardHead = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-3) var(--spacing-md);
  border-bottom: 1px solid var(--gray-100);
`
const cardTitle = css`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--typography-base);
  margin: 0;
`
const cardBodyPadded = css`
  flex: 1;
  padding: var(--spacing-md);
`
const cardBodyFlush = css`
  flex: 1;
  padding: 0;
`
const asOfCaption = css`
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--gray-100);
  font-size: var(--fs-xs);
  color: var(--typography-light);
`

export function DashCard({
  title,
  info,
  action,
  asOf,
  flush = false,
  children,
}: {
  title?: string
  info?: string
  action?: ReactNode
  asOf?: string
  flush?: boolean
  children: ReactNode
}) {
  return (
    <section css={card}>
      {title ? (
        <header css={cardHead}>
          <h3 css={cardTitle}>{title}</h3>
          {info ? <InfoTip text={info} /> : null}
          {action ? <div css={css`margin-left: auto;`}>{action}</div> : null}
        </header>
      ) : null}
      <div css={flush ? cardBodyFlush : cardBodyPadded}>{children}</div>
      {asOf ? <div css={asOfCaption}>{`as of ${asOf}`}</div> : null}
    </section>
  )
}

/* ---------------- Delta (percentage change) ---------------- */

const deltaWrap = (tone: "up" | "down" | "flat") => css`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-xs);
  font-weight: 600;
  color: ${tone === "up"
    ? "var(--utility-success-title)"
    : tone === "down"
      ? "var(--utility-danger-title)"
      : "var(--typography-light)"};
`

export function Delta({ value }: { value: number }) {
  const tone = value > 0 ? "up" : value < 0 ? "down" : "flat"
  return (
    <span css={deltaWrap(tone)}>
      {tone !== "flat" ? (
        <Icon
          icon={tone === "up" ? "arrow-up" : "arrow-down"}
          size="0.75rem"
          iconColor={tone === "up" ? "utility-success" : "red"}
        />
      ) : null}
      {formatSignedPct(value)}
    </span>
  )
}

/* ---------------- Position delta chip (▲3 / ▼2) ---------------- */

export function PositionDelta({ delta }: { delta: number }) {
  if (delta === 0) {
    return <Chip theme="neutral-light" variant="outlined" text="0" size="sm" />
  }
  const up = delta > 0
  return (
    <Chip
      theme={up ? "utility-success" : "utility-danger"}
      variant="outlined"
      size="sm"
      text={`${up ? "▲" : "▼"} ${Math.abs(delta)}`}
    />
  )
}

/* ---------------- KPI stat card ---------------- */

const kpiWrap = css`
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-lg);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
  /* Fill the grid row so KPI cards match taller siblings (e.g. gauge cards). */
  height: 100%;
`
const kpiSpark = css`
  margin-top: auto;
`
const kpiLabelRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
`
const kpiLabel = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  font-weight: 500;
`
const kpiValueRow = css`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--spacing-sm);
`
const kpiValue = css`
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--typography-base);
  line-height: 1.1;
`

export function KpiCard({
  label,
  info,
  kpi,
  format = formatCompact,
  sparkColor,
  footnote,
  benchmark,
}: {
  label: string
  info: string
  kpi: Kpi
  format?: (n: number) => string
  sparkColor?: string
  /** Small muted line under the value, e.g. a related secondary stat. */
  footnote?: string
  /** Comparison line colored by how you stack up (e.g. vs competitor average). */
  benchmark?: { text: string; tone: "up" | "down" | "flat" }
}) {
  const color =
    sparkColor ?? (kpi.deltaPct >= 0 ? "var(--utility-success-icon)" : "var(--utility-danger-icon)")
  return (
    <div css={kpiWrap}>
      <div css={kpiLabelRow}>
        <span css={kpiLabel}>{label}</span>
        <InfoTip text={info} />
      </div>
      <div css={kpiValueRow}>
        <span css={kpiValue}>{format(kpi.value)}</span>
        <Delta value={kpi.deltaPct} />
      </div>
      {benchmark ? (
        <span
          css={css`
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-2xs);
            font-size: var(--fs-xs);
            font-weight: 600;
            color: ${benchmark.tone === "up"
              ? "var(--utility-success-title)"
              : benchmark.tone === "down"
                ? "var(--utility-danger-title)"
                : "var(--typography-light)"};
          `}
        >
          {benchmark.tone !== "flat" ? (
            <Icon
              icon={benchmark.tone === "up" ? "arrow-up" : "arrow-down"}
              size="0.75rem"
              iconColor={benchmark.tone === "up" ? "utility-success" : "red"}
            />
          ) : null}
          {benchmark.text}
        </span>
      ) : null}
      {footnote ? (
        <span css={css`font-size: var(--fs-xs); color: var(--typography-light);`}>{footnote}</span>
      ) : null}
      <div css={kpiSpark}>
        <Sparkline data={kpi.spark} color={color} filled width={140} height={40} stretch />
      </div>
    </div>
  )
}

/* ---------------- Segmented distribution bar ---------------- */

const segBarTrack = css`
  display: flex;
  width: 100%;
  height: 14px;
  border-radius: var(--rounded-full);
  overflow: hidden;
  background: var(--gray-100);
`
const legendRow = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
`
const legendItem = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
`
const legendDot = (c: string) => css`
  width: 10px;
  height: 10px;
  border-radius: var(--rounded-sm);
  background: ${c};
  flex: none;
`
const legendLabel = css`
  color: var(--typography-light);
`
const legendValue = css`
  font-weight: 600;
  color: var(--typography-base);
`

export function DistributionBar({
  segments,
  selected = null,
  onSelect,
}: {
  segments: { label: string; value: number; delta: number; color: string }[]
  /** Index of the highlighted segment (interactive mode). */
  selected?: number | null
  /** Makes segments and legend entries clickable. */
  onSelect?: (index: number) => void
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const interactive = Boolean(onSelect)
  const dimmed = (i: number) => selected != null && selected !== i
  return (
    <div>
      <div css={segBarTrack} role={interactive ? "group" : "img"} aria-label="Keyword position distribution">
        {segments.map((s, i) => (
          <button
            key={s.label}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect?.(i)}
            aria-pressed={selected === i}
            aria-label={`${s.label}: ${s.value} keywords`}
            css={css`
              width: ${(s.value / total) * 100}%;
              background: ${s.color};
              border: none;
              padding: 0;
              opacity: ${dimmed(i) ? 0.35 : 1};
              cursor: ${interactive ? "pointer" : "default"};
              transition: opacity 160ms ease, transform 160ms ease;
              &:hover {
                opacity: ${interactive ? 0.85 : 1};
              }
            `}
          />
        ))}
      </div>
      <div css={legendRow}>
        {segments.map((s, i) => (
          <div
            css={css`
              ${legendItem};
              opacity: ${dimmed(i) ? 0.5 : 1};
              cursor: ${interactive ? "pointer" : "default"};
              border-radius: var(--rounded-md);
              transition: opacity 160ms ease;
            `}
            key={s.label}
            onClick={() => onSelect?.(i)}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={(e) => {
              if (interactive && (e.key === "Enter" || e.key === " ")) onSelect?.(i)
            }}
          >
            <span css={legendDot(s.color)} />
            <span css={legendLabel}>{s.label}</span>
            <span css={legendValue}>{formatCompact(s.value)}</span>
            <Delta value={s.delta} />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Skeletons ---------------- */

export function KpiSkeleton() {
  return (
    <div css={kpiWrap}>
      <Skeleton width="55%" height="12px" />
      <Skeleton width="40%" height="24px" />
      <Skeleton width="100%" height="30px" />
    </div>
  )
}

export function CardSkeleton({ height = "220px" }: { height?: string }) {
  return (
    <div css={card}>
      <div css={cardHead}>
        <Skeleton width="140px" height="14px" />
      </div>
      <div css={cardBodyPadded}>
        <Skeleton width="100%" height={height} />
      </div>
    </div>
  )
}
