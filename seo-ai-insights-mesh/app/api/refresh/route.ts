/**
 * Gated data refresh, the ONLY path that bypasses the report caches and
 * re-spends DataForSEO budget. Called from the integration settings screen.
 *
 * Gate rules (protecting a ~$50/month per-customer budget):
 *  - A refresh is free once per snapshot interval (weekly/bi-weekly).
 *  - Inside the interval, an override password is required
 *    (REFRESH_PASSWORD env var; falls back to the built-in default).
 *
 * POST /api/refresh
 *   body: { domain, location?, language?, brandAliases?, competitors?,
 *           aiTopics?, prompts?, cadence?, password? }
 *   → 200 { ok, refreshedAt } | 403 { error: "password_required" | "wrong_password" }
 */

import { NextRequest, NextResponse } from "next/server"
import { readRefreshStamp, writeRefreshStamp } from "../../lib/server/cache"
import { DataForSeoError, hasCredentials } from "../../lib/server/dataforseo"
import { buildPromptInsights } from "../../lib/server/prompt-insights"
import { buildReport, cadenceTtlHours } from "../../lib/server/report"

export const dynamic = "force-dynamic"
// A full forced refresh re-runs every upstream call, including the LLM prompts.
export const maxDuration = 300

const DEFAULT_REFRESH_PASSWORD = "Unis3arc4"

export async function POST(req: NextRequest) {
  let body: {
    domain?: string
    location?: string
    language?: string
    brandAliases?: string[]
    competitors?: string[]
    aiTopics?: string[]
    ignoredTerms?: string[]
    prompts?: string[]
    cadence?: string
    password?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const domain = body.domain?.trim().toLowerCase() ?? ""
  if (!domain) {
    return NextResponse.json({ error: "bad_request", message: "Missing domain." }, { status: 400 })
  }
  if (!hasCredentials()) {
    return NextResponse.json(
      { error: "not_configured", message: "The data provider credentials are not configured on the server." },
      { status: 503 },
    )
  }

  const cadence = body.cadence === "biweekly" ? ("biweekly" as const) : ("weekly" as const)
  const intervalMs = cadenceTtlHours(cadence) * 60 * 60 * 1000

  /* ---- the gate ---- */
  const lastRefresh = await readRefreshStamp(domain)
  const withinInterval = lastRefresh !== null && Date.now() - new Date(lastRefresh).getTime() < intervalMs
  if (withinInterval) {
    const expected = process.env.REFRESH_PASSWORD ?? DEFAULT_REFRESH_PASSWORD
    if (!body.password) {
      return NextResponse.json(
        {
          error: "password_required",
          message: `Data was refreshed within the current ${cadence} interval. Enter the refresh password to force an update.`,
          lastRefresh,
        },
        { status: 403 },
      )
    }
    if (body.password !== expected) {
      return NextResponse.json(
        { error: "wrong_password", message: "That refresh password is not correct." },
        { status: 403 },
      )
    }
  }

  /* ---- allowed: bypass every cache, then record the refresh ---- */
  try {
    const common = {
      domain,
      location: body.location ?? "United States",
      language: body.language ?? "English",
      brandAliases: Array.isArray(body.brandAliases) ? body.brandAliases : [],
      competitors: Array.isArray(body.competitors) ? body.competitors : [],
      aiTopics: Array.isArray(body.aiTopics) ? body.aiTopics : [],
      ignoredTerms: Array.isArray(body.ignoredTerms) ? body.ignoredTerms : [],
    }
    await buildReport({ ...common, cadence, refresh: true })
    const prompts = Array.isArray(body.prompts) ? body.prompts.filter((p) => typeof p === "string" && p.trim()) : []
    if (prompts.length) {
      await buildPromptInsights({ ...common, prompts, ttlHours: cadenceTtlHours(cadence), refresh: true })
    }
    await writeRefreshStamp(domain)
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() })
  } catch (e) {
    const kind = e instanceof DataForSeoError ? e.kind : "upstream"
    const message = e instanceof Error ? e.message : "Refresh failed."
    return NextResponse.json({ error: kind, message }, { status: 502 })
  }
}
