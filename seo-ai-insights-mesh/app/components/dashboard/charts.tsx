/** @jsxImportSource @emotion/react */
"use client"

import { css } from "@emotion/react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatCompact } from "../../lib/format"
import { brandLogoUrl } from "./brand-logo"

// Chart palette mapped to Uniform design tokens (SVG accepts CSS variables).
export const chartColors = {
  accent: "var(--primary-action-default)",
  accentSoft: "var(--brand-primary-1)",
  grid: "var(--gray-200)",
  axis: "var(--gray-500)",
  success: "var(--utility-success-icon)",
  danger: "var(--utility-danger-icon)",
  caution: "var(--utility-caution-icon)",
  neutral: "var(--gray-400)",
  compA: "var(--gray-400)",
  compB: "var(--gray-300)",
  compC: "var(--gray-500)",
}

const tickStyle = { fill: "var(--gray-500)", fontSize: 11 }

const tooltipWrap = css`
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-md);
  box-shadow: var(--elevation-300);
  padding: var(--spacing-sm) var(--spacing-3);
  font-size: var(--fs-xs);
  color: var(--typography-base);
`
const tooltipRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  line-height: 1.5;
`
const swatch = (c: string) => css`
  width: 8px;
  height: 8px;
  border-radius: var(--rounded-sm);
  background: ${c};
  flex: none;
`

function shortDate(v: string) {
  const d = new Date(v)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ChartTooltip({ active, payload, label, valueFormatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div css={tooltipWrap}>
      <div css={css`font-weight: 600; margin-bottom: var(--spacing-2xs);`}>
        {typeof label === "string" && label.includes("-") ? shortDate(label) : label}
      </div>
      {payload.map((p: any) => (
        <div css={tooltipRow} key={p.dataKey}>
          <span css={swatch(p.color || p.stroke || p.fill)} />
          <span css={css`color: var(--typography-light);`}>{p.name}</span>
          <span css={css`margin-left: auto; font-weight: 600;`}>
            {valueFormatter ? valueFormatter(p.value) : formatCompact(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Tiny inline sparkline (light-weight, used across tables/cards) ---
export function Sparkline({
  data,
  color = chartColors.accent,
  width = 84,
  height = 26,
  filled = false,
  stretch = false,
}: {
  data: number[]
  color?: string
  width?: number
  height?: number
  filled?: boolean
  /** Fill the container's width (the drawing scales; stroke width stays crisp). */
  stretch?: boolean
}) {
  if (!data.length) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1 || 1)
  const points = data.map((v, i) => {
    const x = i * step
    const y = height - 2 - ((v - min) / range) * (height - 4)
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
  const area = `${line} L${width},${height} L0,${height} Z`
  return (
    <svg
      width={stretch ? "100%" : width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? "none" : undefined}
      role="img"
      aria-hidden="true"
    >
      {filled ? <path d={area} style={{ fill: color }} opacity={0.16} /> : null}
      <path
        d={line}
        style={{ fill: "none", stroke: color, vectorEffect: "non-scaling-stroke" }}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// --- Semicircle score gauge (AI visibility score) ---
export function ScoreGauge({
  score,
  color,
  size = 148,
}: {
  /** 0–100 */
  score: number
  color: string
  size?: number
}) {
  const stroke = 14
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const halfCircumference = Math.PI * r
  const clamped = Math.max(0, Math.min(100, score))
  const arc = (clamped / 100) * halfCircumference
  const d = `M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`
  return (
    <svg width={size} height={cy + stroke / 2} viewBox={`0 0 ${size} ${cy + stroke / 2}`} role="img" aria-label={`Score ${clamped} of 100`}>
      <path d={d} fill="none" stroke="var(--gray-100)" strokeWidth={stroke} strokeLinecap="round" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${halfCircumference}`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
    </svg>
  )
}

// --- Mini donut (sentiment and other part-of-whole stats) ---
export function MiniDonut({
  segments,
  size = 96,
  thickness = 12,
}: {
  segments: { value: number; color: string }[]
  size?: number
  thickness?: number
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-100)" strokeWidth={thickness} />
      {segments.map((seg, i) => {
        const frac = seg.value / total
        const dash = frac * circumference
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

// --- Traffic trend (area) ---
export function TrafficAreaChart({ data }: { data: { date: string; traffic: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.22} />
            <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={tickStyle} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={24} />
        <YAxis tickFormatter={(v) => formatCompact(v as number)} tick={tickStyle} tickLine={false} axisLine={false} width={44} />
        <RTooltip content={<ChartTooltip />} />
        <Area type="monotone" dataKey="traffic" name="Est. traffic" stroke={chartColors.accent} strokeWidth={2} fill="url(#trafficFill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// --- Mentions vs citations by model (grouped bars, logo axis) ---

/** Domain used for each AI model's logo on chart axes. */
const MODEL_LOGO_DOMAIN: Record<string, string> = {
  ChatGPT: "openai.com",
  Claude: "anthropic.com",
  Gemini: "gemini.google.com",
  Perplexity: "perplexity.ai",
  "Google AIO": "google.com",
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ModelLogoTick({ x, y, payload }: any) {
  const url = brandLogoUrl(MODEL_LOGO_DOMAIN[payload.value] ?? "", 16)
  return (
    <g transform={`translate(${x},${y})`}>
      {url ? <image href={url} x={-8} y={4} width={16} height={16} /> : null}
      <text x={0} y={url ? 34 : 16} textAnchor="middle" fill="var(--gray-500)" fontSize={11}>
        {payload.value}
      </text>
    </g>
  )
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function ByModelChart({
  data,
  height = 260,
}: {
  data: { model: string; mentions: number; citations: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="model" tick={<ModelLogoTick />} height={44} tickLine={false} axisLine={{ stroke: chartColors.grid }} interval={0} />
        <YAxis tickFormatter={(v) => formatCompact(v as number)} tick={tickStyle} tickLine={false} axisLine={false} width={44} />
        <RTooltip cursor={{ fill: "var(--gray-100)" }} content={<ChartTooltip />} />
        <Bar dataKey="mentions" name="Mentions" fill={chartColors.accent} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
        <Bar dataKey="citations" name="Citations" fill={chartColors.accentSoft} radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- New vs lost mentions (momentum: green up, red down) ---
export function NewLostChart({
  data,
  height = 240,
}: {
  data: { date: string; newMentions: number; lostMentions: number }[]
  height?: number
}) {
  const rows = data.map((d) => ({ date: d.date, New: d.newMentions, Lost: -d.lostMentions }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} stackOffset="sign" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={tickStyle} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={24} />
        <YAxis tickFormatter={(v) => formatCompact(Math.abs(v as number))} tick={tickStyle} tickLine={false} axisLine={false} width={44} />
        <RTooltip
          cursor={{ fill: "var(--gray-100)" }}
          content={<ChartTooltip valueFormatter={(v: number) => formatCompact(Math.abs(v))} />}
        />
        <ReferenceLine y={0} stroke={chartColors.axis} />
        <Bar dataKey="New" name="New mentions" stackId="nl" fill={chartColors.success} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        <Bar dataKey="Lost" name="Lost mentions" stackId="nl" fill={chartColors.danger} radius={[0, 0, 3, 3]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// --- Share of voice (multi-line) ---
export function ShareOfVoiceChart({
  data,
  series,
  visible,
  height = 260,
}: {
  data: Record<string, number | string>[]
  series: { key: string; brand?: boolean }[]
  visible: Record<string, boolean>
  /** Number of pixels, or "100%" to fill a sized flex parent. */
  height?: number | `${number}%`
}) {
  const colorFor = (s: { key: string; brand?: boolean }, i: number) =>
    s.brand ? chartColors.accent : [chartColors.compA, chartColors.compB, chartColors.compC][i % 3]
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={chartColors.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={tickStyle} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={24} />
        <YAxis tickFormatter={(v) => `${v}%`} tick={tickStyle} tickLine={false} axisLine={false} width={40} />
        <RTooltip content={<ChartTooltip valueFormatter={(v: number) => `${v}%`} />} />
        {series.map((s, i) =>
          visible[s.key] !== false ? (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.key}
              stroke={colorFor(s, i)}
              strokeWidth={s.brand ? 2.5 : 1.5}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ) : null,
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
