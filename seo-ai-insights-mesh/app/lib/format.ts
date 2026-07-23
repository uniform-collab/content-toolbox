const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCompact(value: number): string {
  return compact.format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatPct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`
}

export function formatSignedPct(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(digits)}%`
}

/** Truncate a URL for display, dropping the protocol. */
export function truncateUrl(url: string, max = 42): string {
  const clean = url.replace(/^https?:\/\//, "")
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}
