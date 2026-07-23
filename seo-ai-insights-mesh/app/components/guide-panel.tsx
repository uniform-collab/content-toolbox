/** @jsxImportSource @emotion/react */
"use client"

import { useEffect, useRef } from "react"
import { css } from "@emotion/react"
import { Button, Icon } from "@uniformdev/design-system"
import { GUIDE_SECTIONS, type GuideSection } from "../lib/guide"

const overlay = css`
  position: fixed;
  inset: 0;
  background: rgba(20, 20, 20, 0.35);
  z-index: 900;
`
const panel = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(480px, 92vw);
  background: var(--white, #fff);
  border-left: 1px solid var(--gray-200);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
  z-index: 901;
  display: flex;
  flex-direction: column;
`
const panelHeader = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--gray-200);
`
const panelTitle = css`
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--typography-base);
  margin: 0;
`
const body = css`
  overflow-y: auto;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
`
const sectionCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  scroll-margin-top: var(--spacing-md);
`
const sectionTitle = css`
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--typography-base);
  margin: 0;
  padding-bottom: var(--spacing-2xs);
  border-bottom: 1px solid var(--gray-100);
`
const para = css`
  font-size: var(--fs-sm);
  color: var(--typography-base);
  line-height: 1.55;
  margin: 0;
`
const lead = css`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--typography-base);
  margin: 0;
`
const list = css`
  margin: 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);

  li {
    font-size: var(--fs-sm);
    color: var(--typography-base);
    line-height: 1.5;
  }
`

function Section({ section }: { section: GuideSection }) {
  return (
    <section css={sectionCss} id={`guide-${section.id}`} aria-label={section.title}>
      <h3 css={sectionTitle}>{section.title}</h3>
      {section.blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i} css={para}>
            {b.text}
          </p>
        ) : (
          <div key={i} css={css`display: flex; flex-direction: column; gap: var(--spacing-xs);`}>
            {b.lead ? <p css={lead}>{b.lead}</p> : null}
            <ul css={list}>
              {b.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ),
      )}
    </section>
  )
}

/**
 * Slide-over panel with the full user guide. When `focusSectionId` is set,
 * the panel opens scrolled to that section (used by the per-tab "Learn more" links).
 */
export function GuidePanel({
  open,
  focusSectionId,
  onClose,
}: {
  open: boolean
  focusSectionId?: string
  onClose: () => void
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const target = focusSectionId
      ? bodyRef.current?.querySelector(`#guide-${focusSectionId}`)
      : bodyRef.current?.firstElementChild
    target?.scrollIntoView({ block: "start" })
  }, [open, focusSectionId])

  if (!open) return null

  return (
    <>
      <div css={overlay} onClick={onClose} aria-hidden="true" />
      <aside css={panel} role="dialog" aria-modal="true" aria-label="How to use this dashboard">
        <div css={panelHeader}>
          <h2 css={panelTitle}>How to use this dashboard</h2>
          <Button buttonType="ghost" size="sm" onClick={onClose} aria-label="Close guide">
            <Icon icon="close" size="0.875rem" iconColor="currentColor" />
          </Button>
        </div>
        <div css={body} ref={bodyRef}>
          {GUIDE_SECTIONS.map((s) => (
            <Section key={s.id} section={s} />
          ))}
        </div>
      </aside>
    </>
  )
}
