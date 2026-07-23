/**
 * The dashboard report proxy. Assembles the report from DataForSEO using the
 * credentials in server env (never exposed to the browser). Responses are
 * cached for the snapshot cadence (weekly/bi-weekly) so repeat visits are
 * free; forced refreshes go through the gated /api/refresh endpoint.
 *
 * POST /api/report  body: { domain, location, language, brandAliases?,
 *                           competitors?, aiTopics?, projectId?, cadence? }
 * GET  /api/report?domain=...&location=...&language=...
 *      (curl-friendly variant without the settings arrays)
 */

import { NextRequest, NextResponse } from "next/server"
import { DataForSeoError, hasCredentials } from "../../lib/server/dataforseo"
import { buildReport, type ReportParams } from "../../lib/server/report"

export const dynamic = "force-dynamic"

async function respond(params: ReportParams) {
  if (!params.domain) {
    return NextResponse.json({ error: "bad_request", message: "Missing domain." }, { status: 400 })
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
    const report = await buildReport(params)
    return NextResponse.json(report)
  } catch (e) {
    const kind = e instanceof DataForSeoError ? e.kind : "upstream"
    const message = e instanceof Error ? e.message : "Unknown error building the report."
    return NextResponse.json({ error: kind, message }, { status: kind === "not_configured" ? 503 : 502 })
  }
}

export async function POST(req: NextRequest) {
  let body: Partial<ReportParams>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }
  return respond({
    domain: body.domain?.trim().toLowerCase() ?? "",
    location: body.location ?? "United States",
    language: body.language ?? "English",
    brandAliases: Array.isArray(body.brandAliases) ? body.brandAliases : [],
    competitors: Array.isArray(body.competitors) ? body.competitors : [],
    aiTopics: Array.isArray(body.aiTopics) ? body.aiTopics : [],
    ignoredTerms: Array.isArray(body.ignoredTerms) ? body.ignoredTerms : [],
    projectId: body.projectId,
    dashboardOrigin: body.dashboardOrigin,
    cadence: body.cadence === "biweekly" ? "biweekly" : "weekly",
    // Cache bypass is NOT accepted here, forced refreshes go through the
    // gated /api/refresh endpoint (interval + password) to protect the budget.
  })
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  return respond({
    domain: q.get("domain")?.trim().toLowerCase() ?? "",
    location: q.get("location") ?? "United States",
    language: q.get("language") ?? "English",
    projectId: q.get("projectId") ?? undefined,
  })
}
