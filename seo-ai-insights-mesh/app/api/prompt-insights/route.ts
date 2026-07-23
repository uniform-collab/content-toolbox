/**
 * Topics & Prompts proxy. Runs the configured prompts through the four AI
 * assistants via DataForSEO (server-side credentials, cached responses) and
 * returns the reduced PromptInsightsData. Kept separate from /api/report
 * because a full run is 4 live LLM calls per prompt, the dashboard only
 * requests it when the Topics & Prompts tab is opened.
 *
 * POST /api/prompt-insights
 *   body: { domain, brandAliases?, competitors?, aiTopics?, prompts, location?, refresh? }
 */

import { NextRequest, NextResponse } from "next/server"
import { DataForSeoError, hasCredentials } from "../../lib/server/dataforseo"
import { buildPromptInsights } from "../../lib/server/prompt-insights"
import { cadenceTtlHours } from "../../lib/server/report"

export const dynamic = "force-dynamic"
// A cold run (10 prompts × 4 assistants) can take a while, allow up to 5 min.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  let body: {
    domain?: string
    brandAliases?: string[]
    competitors?: string[]
    aiTopics?: string[]
    prompts?: string[]
    location?: string
    language?: string
    cadence?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const domain = body.domain?.trim().toLowerCase() ?? ""
  const prompts = Array.isArray(body.prompts) ? body.prompts.filter((p) => typeof p === "string") : []
  if (!domain) {
    return NextResponse.json({ error: "bad_request", message: "Missing domain." }, { status: 400 })
  }
  if (prompts.length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "No prompts configured. Add prompts (or brands and AI topics) in settings." },
      { status: 400 },
    )
  }
  if (!hasCredentials()) {
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "The data provider credentials are not configured on the server. Copy .env.local.example to .env.local, set the provider login and password, and restart the dev server.",
      },
      { status: 503 },
    )
  }

  try {
    const data = await buildPromptInsights({
      domain,
      brandAliases: Array.isArray(body.brandAliases) ? body.brandAliases : [],
      competitors: Array.isArray(body.competitors) ? body.competitors : [],
      aiTopics: Array.isArray(body.aiTopics) ? body.aiTopics : [],
      prompts,
      location: body.location ?? "United States",
      language: body.language ?? "English",
      ttlHours: cadenceTtlHours(body.cadence === "biweekly" ? "biweekly" : "weekly"),
      // Forced refreshes go through the gated /api/refresh endpoint.
    })
    return NextResponse.json(data)
  } catch (e) {
    const kind = e instanceof DataForSeoError ? e.kind : "upstream"
    const message = e instanceof Error ? e.message : "Unknown error running the prompts."
    return NextResponse.json({ error: kind, message }, { status: kind === "not_configured" ? 503 : 502 })
  }
}
