/** @jsxImportSource @emotion/react */
"use client"

import type { ReactNode } from "react"
import { css } from "@emotion/react"
import { mq } from "@uniformdev/design-system"

const autoGrid = (min: string) => css`
  display: grid;
  gap: var(--spacing-md);
  grid-template-columns: repeat(auto-fit, minmax(${min}, 1fr));
`

export function AutoGrid({ min = "200px", children }: { min?: string; children: ReactNode }) {
  return <div css={autoGrid(min)}>{children}</div>
}

const splitGrid = (template: string) => css`
  display: grid;
  gap: var(--spacing-md);
  grid-template-columns: 1fr;

  ${mq("md")} {
    grid-template-columns: ${template};
    align-items: stretch;
  }
`

export function SplitGrid({ template = "1fr 1fr", children }: { template?: string; children: ReactNode }) {
  return <div css={splitGrid(template)}>{children}</div>
}

const stack = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`

export function VStack({ children }: { children: ReactNode }) {
  return <div css={stack}>{children}</div>
}
