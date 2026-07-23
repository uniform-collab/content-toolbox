"use client"

/**
 * Client hook that loads the live dashboard report from /api/report.
 * The heavy lifting (DataForSEO calls, credentials, caching) happens
 * server-side; this only fetches the assembled JSON.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { ReportResponse } from "./types"

export interface ReportError {
  /** "not_configured" (server env missing) | "upstream" | "network" | ... */
  kind: string
  message: string
}

export function useDashboardReport(params: {
  domain: string
  location: string
  language: string
  brandAliases?: string[]
  competitors?: string[]
  aiTopics?: string[]
  ignoredTerms?: string[]
  projectId?: string
  /** Origin of the embedding Uniform app (e.g. https://eu.uniform.app) for deep links. */
  dashboardOrigin?: string
  /** Snapshot cadence, drives the server-side cache interval. */
  cadence?: "weekly" | "biweekly"
  enabled: boolean
}) {
  const { domain, location, language, projectId, dashboardOrigin, cadence, enabled } = params
  // Serialize the arrays so the fetch callback keys on content, not array
  // identity, withDefaults() produces fresh arrays on every render.
  const brandJson = JSON.stringify(params.brandAliases ?? [])
  const competitorJson = JSON.stringify(params.competitors ?? [])
  const aiTopicsJson = JSON.stringify(params.aiTopics ?? [])
  const ignoredJson = JSON.stringify(params.ignoredTerms ?? [])
  const [report, setReport] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<ReportError | null>(null)
  const requestSeq = useRef(0)

  const load = useCallback(
    async () => {
      if (!enabled || !domain) return
      const seq = ++requestSeq.current
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain,
            location,
            language,
            brandAliases: JSON.parse(brandJson),
            competitors: JSON.parse(competitorJson),
            aiTopics: JSON.parse(aiTopicsJson),
            ignoredTerms: JSON.parse(ignoredJson),
            projectId,
            dashboardOrigin,
            cadence,
          }),
        })
        const json = await res.json()
        if (seq !== requestSeq.current) return // superseded by a newer request
        if (!res.ok) {
          setError({ kind: json.error ?? "upstream", message: json.message ?? `HTTP ${res.status}` })
          setReport(null)
        } else {
          setReport(json as ReportResponse)
        }
      } catch (e) {
        if (seq !== requestSeq.current) return
        setError({ kind: "network", message: e instanceof Error ? e.message : "Network error" })
        setReport(null)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [enabled, domain, location, language, projectId, dashboardOrigin, cadence, brandJson, competitorJson, aiTopicsJson, ignoredJson],
  )

  useEffect(() => {
    void load()
  }, [load])

  return { report, loading, error, reload: load }
}
