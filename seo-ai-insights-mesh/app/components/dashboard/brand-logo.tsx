/** @jsxImportSource @emotion/react */
"use client"

import { useState } from "react"
import { css } from "@emotion/react"
import { Chip, Tooltip } from "@uniformdev/design-system"
import { AI_PLATFORM_DOMAIN } from "../../lib/types"

/**
 * Renders a company/competitor logo by domain via logo.dev's image API
 * (https://www.logo.dev/). The token is a publishable key embedded in the
 * image URL, read from NEXT_PUBLIC_LOGO_DEV_TOKEN.
 *
 * Degrades gracefully: with no token, or if logo.dev has no logo for the
 * domain and the image 404s, it shows a monogram badge (first letter of the
 * domain) so the layout never shows a broken image.
 */

const LOGO_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN

/** Raw logo image URL for places that can't render the component (e.g. SVG chart ticks). */
export function brandLogoUrl(domain: string, size = 20): string | null {
  return logoUrl(domain, size)
}

function logoUrl(domain: string, size: number): string | null {
  if (!LOGO_TOKEN) return null
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "")
  if (!host) return null
  // Request 2x for crisp rendering on retina displays.
  return `https://img.logo.dev/${encodeURIComponent(host)}?token=${LOGO_TOKEN}&size=${size * 2}&format=png&retina=true`
}

const wrap = (size: number) => css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${size}px;
  height: ${size}px;
  flex: none;
  border-radius: var(--rounded-md);
  overflow: hidden;
  background: var(--gray-100);
  border: 1px solid var(--gray-200);
`
const img = css`
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
`
const monogram = (size: number) => css`
  font-size: ${Math.round(size * 0.5)}px;
  font-weight: 700;
  line-height: 1;
  color: var(--typography-light);
  text-transform: uppercase;
`

/** Logo domain for platform names seen in the data (AI models + Google AIO). */
const PLATFORM_DOMAIN: Record<string, string> = {
  ...AI_PLATFORM_DOMAIN,
  "Google AIO": "google.com",
}

/**
 * An AI platform shown as its logo with the name in a tooltip, used wherever
 * data rows carry a platform name ("ChatGPT", "Google AIO", …). Unknown
 * platforms fall back to a text chip.
 */
export function PlatformLogo({ platform, size = 18 }: { platform: string; size?: number }) {
  const domain = PLATFORM_DOMAIN[platform]
  if (!domain) return <Chip size="sm" variant="outlined" theme="neutral-light" text={platform} />
  return (
    <Tooltip title={platform} placement="top">
      <span css={css`display: inline-flex;`} aria-label={platform} role="img">
        <BrandLogo domain={domain} size={size} />
      </span>
    </Tooltip>
  )
}

export function BrandLogo({
  domain,
  size = 20,
  className,
}: {
  domain: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const url = logoUrl(domain, size)
  const letter = domain.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").charAt(0) || "?"

  return (
    <span css={wrap(size)} className={className} title={domain} role="img" aria-label={`${domain} logo`}>
      {url && !failed ? (
        <img css={img} src={url} alt="" width={size} height={size} onError={() => setFailed(true)} />
      ) : (
        <span css={monogram(size)} aria-hidden="true">
          {letter}
        </span>
      )}
    </span>
  )
}
