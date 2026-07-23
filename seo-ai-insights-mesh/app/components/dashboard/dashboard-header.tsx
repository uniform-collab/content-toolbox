/** @jsxImportSource @emotion/react */
"use client"

import { css } from "@emotion/react"
import { Button, Icon, mq } from "@uniformdev/design-system"
import { BrandLogo } from "./brand-logo"

const header = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  ${mq("lg")} {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
`
const titleBlock = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);
  min-width: 0;
`
const title = css`
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--typography-base);
  margin: 0;
  letter-spacing: -0.01em;
`
const subMeta = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
  color: var(--typography-light);
`
const dotSep = css`
  color: var(--gray-300);
`
const snapshotPill = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  color: var(--typography-light);
  background: var(--gray-100);
  border-radius: var(--rounded-full);
  padding: var(--spacing-2xs) var(--spacing-sm);
`
const rightBlock = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);

  ${mq("lg")} {
    align-items: flex-end;
  }
`
const refreshBlock = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2xs);

  ${mq("lg")} {
    align-items: flex-end;
  }
`
const refreshRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
`

function relativeDays(iso: string): string {
  const then = new Date(iso).getTime()
  const days = Math.round((Date.now() - then) / (1000 * 60 * 60 * 24))
  if (days <= 0) return "today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

function nextUpdate(lastSnapshot: string, cadence: "weekly" | "biweekly"): string {
  const next = new Date(lastSnapshot)
  next.setDate(next.getDate() + (cadence === "biweekly" ? 14 : 7))
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function DashboardHeader({
  domain,
  country,
  language,
  lastSnapshot,
  cadence = "weekly",
  onOpenSettings,
  onOpenGuide,
}: {
  domain: string
  country: string
  language: string
  lastSnapshot: string
  /** Snapshot cadence, data updates on this schedule (refresh lives in settings). */
  cadence?: "weekly" | "biweekly"
  onOpenSettings: () => void
  onOpenGuide?: () => void
}) {
  return (
    <div css={header}>
      <div css={titleBlock}>
        <h1 css={title}>SEO &amp; AI Insights</h1>
        <div css={subMeta}>
          <BrandLogo domain={domain} size={20} />
          <span>{`${domain} · ${country} · ${language}`}</span>
        </div>
        <div css={css`margin-top: var(--spacing-2xs); display: flex; gap: var(--spacing-xs); flex-wrap: wrap;`}>
          <span css={snapshotPill}>
            <Icon icon="clock-edit" size="0.75rem" iconColor="gray" />
            {`Last snapshot: ${relativeDays(lastSnapshot)}`}
          </span>
          <span css={snapshotPill} title="Data refreshes on the snapshot schedule. Force an update from the integration settings.">
            <Icon icon="arrows-exchange" size="0.75rem" iconColor="gray" />
            {`Updates ${cadence === "biweekly" ? "every two weeks" : "weekly"} · next ~${nextUpdate(lastSnapshot, cadence)}`}
          </span>
        </div>
      </div>

      <div css={rightBlock}>
        <div css={refreshBlock}>
          <div css={refreshRow}>
            <Button buttonType="ghost" size="sm" onClick={onOpenSettings} tooltip="Open integration settings">
              <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
                Settings
                <Icon icon="arrow-right" size="0.875rem" iconColor="currentColor" />
              </span>
            </Button>
            {onOpenGuide ? (
              <Button buttonType="ghost" size="sm" onClick={onOpenGuide} tooltip="How to use this dashboard">
                <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
                  <Icon icon="info" size="0.875rem" iconColor="currentColor" />
                  Guide
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
