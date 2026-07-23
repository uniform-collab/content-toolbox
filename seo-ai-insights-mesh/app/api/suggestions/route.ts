/**
 * POST /api/suggestions
 * Body: { algorithm, seed, domain, location, language, depth?, refresh? }
 *
 * Live keyword discovery through the server-side DataForSEO proxy (cached).
 */

import { NextRequest, NextResponse } from "next/server"
import type { SuggestionAlgorithm } from "../../lib/types"
import { DataForSeoError, hasCredentials } from "../../lib/server/dataforseo"
import { fetchSuggestions } from "../../lib/server/suggestions"

export const dynamic = "force-dynamic"

const ALGORITHMS: SuggestionAlgorithm[] = ["related", "contains_phrase", "same_topic", "from_site"]

export async function POST(req: NextRequest) {
  let body: {
    algorithm?: SuggestionAlgorithm
    seed?: string
    domain?: string
    location?: string
    language?: string
    depth?: 1 | 2 | 3
    refresh?: boolean
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON body." }, { status: 400 })
  }

  const algorithm = body.algorithm
  if (!algorithm || !ALGORITHMS.includes(algorithm)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid algorithm." }, { status: 400 })
  }
  if (algorithm !== "from_site" && !body.seed?.trim()) {
    return NextResponse.json({ error: "bad_request", message: "Missing seed keyword." }, { status: 400 })
  }
  if (algorithm === "from_site" && !body.domain?.trim()) {
    return NextResponse.json({ error: "bad_request", message: "Missing domain." }, { status: 400 })
  }
  if (!hasCredentials()) {
    return NextResponse.json(
      { error: "not_configured", message: "The data provider credentials are not configured on the server (.env.local)." },
      { status: 503 },
    )
  }

  try {
    const results = await fetchSuggestions({
      algorithm,
      seed: body.seed?.trim() ?? "",
      domain: body.domain?.trim().toLowerCase() ?? "",
      location: body.location ?? "United States",
      language: body.language ?? "English",
      depth: body.depth,
      refresh: body.refresh,
    })
    return NextResponse.json({ results, searchedAt: new Date().toISOString() })
  } catch (e) {
    const kind = e instanceof DataForSeoError ? e.kind : "upstream"
    const message = e instanceof Error ? e.message : "Unknown error fetching suggestions."
    return NextResponse.json({ error: kind, message }, { status: kind === "not_configured" ? 503 : 502 })
  }
}
