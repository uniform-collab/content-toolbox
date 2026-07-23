"use client"

/**
 * Client hook for the Topics & Prompts tab. Loads PromptInsightsData from
 * /api/prompt-insights lazily, `enabled` only flips true once the tab is
 * opened, because a cold run fans out to 4 live LLM calls per prompt.
 * Repeat visits are served from the server-side cache.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { PromptInsightsData } from "./types"
import type { ReportError } from "./use-report"

export function usePromptInsights(params: {
  domain: string
  brandAliases: string[]
  competitors: string[]
  aiTopics: string[]
  prompts: string[]
  location: string
  language: string
  cadence?: "weekly" | "biweekly"
  enabled: boolean
}) {
  const { domain, location, language, cadence, enabled } = params
  // Key the fetch on content, not array identity (fresh arrays every render).
  const brandJson = JSON.stringify(params.brandAliases)
  const competitorJson = JSON.stringify(params.competitors)
  const topicsJson = JSON.stringify(params.aiTopics)
  const promptsJson = JSON.stringify(params.prompts)
  const [data, setData] = useState<PromptInsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ReportError | null>(null)
  const requestSeq = useRef(0)

  const load = useCallback(
    async () => {
      if (!enabled || !domain) return
      const seq = ++requestSeq.current
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/prompt-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain,
            location,
            language,
            brandAliases: JSON.parse(brandJson),
            competitors: JSON.parse(competitorJson),
            aiTopics: JSON.parse(topicsJson),
            prompts: JSON.parse(promptsJson),
            cadence,
          }),
        })
        const json = await res.json()
        if (seq !== requestSeq.current) return
        if (!res.ok) {
          setError({ kind: json.error ?? "upstream", message: json.message ?? `HTTP ${res.status}` })
          setData(null)
        } else {
          setData(json as PromptInsightsData)
        }
      } catch (e) {
        if (seq !== requestSeq.current) return
        setError({ kind: "network", message: e instanceof Error ? e.message : "Network error" })
        setData(null)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [enabled, domain, location, language, cadence, brandJson, competitorJson, topicsJson, promptsJson],
  )

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}
