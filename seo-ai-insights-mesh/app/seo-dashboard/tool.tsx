/** @jsxImportSource @emotion/react */
"use client"

import { css } from "@emotion/react"
import { Button, Callout, LoadingIndicator } from "@uniformdev/design-system"
import { useMeshLocation } from "@uniformdev/mesh-sdk-react"
import { Dashboard } from "../components/dashboard/dashboard"
import { useDashboardReport } from "../lib/use-report"
import { effectiveAiPrompts, withDefaults, type IntegrationSettings } from "../lib/settings"

const stateWrap = css`
  max-width: 720px;
  margin: 0 auto;
  padding: var(--spacing-2xl) var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`
const centered = css`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl);
  color: var(--typography-light);
  font-size: var(--fs-sm);
`

/**
 * Project tool location entry.
 *
 * - Settings persistence: the settings location saves IntegrationSettings via
 *   `setValue`; Uniform stores them per project and hands them to every other
 *   location as `metadata.settings`, that is what we read here.
 * - No settings → no data: until a target domain is saved, we render a setup
 *   prompt instead of the dashboard.
 * - Live data: fetched from our own /api/report proxy (DataForSEO credentials
 *   stay server-side), cached server-side so repeat visits are free.
 */
export function SeoDashboardTool() {
  const { metadata, router } = useMeshLocation<"projectTool", unknown>("projectTool")
  const settings: IntegrationSettings = withDefaults(metadata?.settings)
  const meshMeta = metadata as { projectId?: string; dashboardOrigin?: string } | undefined
  const projectId = meshMeta?.projectId
  // Instance-aware origin (uniform.app, eu.uniform.app, …) for deep links built
  // server-side; the settings buttons use router.navigatePlatform instead.
  const dashboardOrigin = meshMeta?.dashboardOrigin
  const configured = Boolean(settings.targetDomain)

  // Opens this integration's settings in the embedding Uniform app, the router
  // targets the correct instance and prepends /projects/{projectId} itself.
  const openIntegrationSettings = () => router.navigatePlatform("/settings/integrations", { target: "_blank" })

  const { report, loading, error, reload } = useDashboardReport({
    domain: settings.targetDomain,
    location: settings.location,
    language: settings.language,
    brandAliases: settings.brandAliases,
    competitors: settings.competitors,
    aiTopics: settings.aiTopics,
    ignoredTerms: settings.ignoredTerms,
    projectId,
    dashboardOrigin,
    cadence: settings.snapshotCadence,
    enabled: configured,
  })

  if (!configured) {
    return (
      <div css={stateWrap}>
        <Callout type="info" title="Set up SEO & AI Insights to start collecting data">
          <div css={css`display: flex; flex-direction: column; gap: var(--spacing-sm); font-size: var(--fs-sm);`}>
            <span>
              No target domain is configured yet, so there is no data to show. Open the integration&apos;s
              settings, enter the domain to analyze (plus brands, competitors, and tracked keywords), and save.
            </span>
            <div>
              <Button buttonType="secondary" size="sm" onClick={openIntegrationSettings}>
                Open integration settings
              </Button>
            </div>
          </div>
        </Callout>
      </div>
    )
  }

  if (loading && !report) {
    return (
      <div css={centered}>
        <LoadingIndicator />
        <span>{`Collecting SEO data for ${settings.targetDomain}…`}</span>
      </div>
    )
  }

  if (error) {
    const isSetupIssue = error.kind === "not_configured"
    return (
      <div css={stateWrap}>
        <Callout type={isSetupIssue ? "caution" : "danger"} title={isSetupIssue ? "Data source not configured" : "Could not load report"}>
          <div css={css`display: flex; flex-direction: column; gap: var(--spacing-sm); font-size: var(--fs-sm);`}>
            <span>{error.message}</span>
            {!isSetupIssue ? (
              <div>
                <Button buttonType="secondary" size="sm" onClick={() => reload()}>
                  Try again
                </Button>
              </div>
            ) : null}
          </div>
        </Callout>
      </div>
    )
  }

  if (!report) return null

  return (
    <Dashboard
      data={report.data}
      meta={report.meta}
      configured
      cadence={settings.snapshotCadence}
      ignoredTerms={settings.ignoredTerms}
      onOpenSettings={openIntegrationSettings}
      promptRun={{
        domain: settings.targetDomain,
        brandAliases: settings.brandAliases,
        competitors: settings.competitors,
        aiTopics: settings.aiTopics,
        prompts: effectiveAiPrompts(settings),
        location: settings.location,
        language: settings.language,
      }}
    />
  )
}
