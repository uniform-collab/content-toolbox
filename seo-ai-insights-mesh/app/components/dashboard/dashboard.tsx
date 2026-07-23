/** @jsxImportSource @emotion/react */
"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { css } from "@emotion/react"
import { Button, Callout, Icon, TabButton, TabButtonGroup, TabContent, Tabs, Tooltip } from "@uniformdev/design-system"
import { dashboardData, mockPromptInsights } from "../../lib/mock-data"
import type { DashboardData, ReportMeta } from "../../lib/types"
import { usePromptInsights } from "../../lib/use-prompt-insights"
import { GuidePanel } from "../guide-panel"
import { TAB_HELP } from "../../lib/guide"
import { DashboardHeader } from "./dashboard-header"
import { OverviewTab } from "./tabs/overview-tab"
import { OpportunitiesTab } from "./tabs/opportunities-tab"
import { AiVisibilityTab } from "./tabs/ai-visibility-tab"
import { TopicsPromptsTab } from "./tabs/topics-prompts-tab"
import { KeywordsTab } from "./tabs/keywords-tab"
import { KeywordSuggestionsTab } from "./tabs/keyword-suggestions-tab"
import { DecayingTab } from "./tabs/decaying-tab"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "ai", label: "AI Visibility" },
  { id: "prompts", label: "Topics & Prompts" },
  { id: "keywords", label: "Keywords" },
  { id: "suggestions", label: "Keyword suggestions" },
  { id: "decaying", label: "Decaying content" },
] as const

type TabId = (typeof TABS)[number]["id"]

const shell = css`
  min-width: 900px;
  max-width: 1360px;
  margin: 0 auto;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-2xl);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
`
const divider = css`
  height: 1px;
  background: var(--gray-200);
`
const panel = css`
  padding-top: var(--spacing-lg);
`
const bannerBody = css`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-sm);
  font-size: var(--fs-sm);
`
const helpStrip = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding-top: var(--spacing-sm);
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const helpInfo = css`
  display: inline-flex;
  align-items: center;
  cursor: help;
`
const learnMore = css`
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  font-size: var(--fs-xs);
  color: var(--brand-secondary-4, #0052ed);
  text-decoration: underline;
  cursor: pointer;
`

export interface DashboardConfig {
  domain: string
  country: string
  language: string
}

/** Inputs for the Topics & Prompts tab (live mode only; mock data otherwise). */
export interface PromptRunConfig {
  domain: string
  brandAliases: string[]
  competitors: string[]
  aiTopics: string[]
  prompts: string[]
  location: string
  language: string
}

export function Dashboard({
  config,
  configured = true,
  settingsHref = "/settings",
  data,
  meta,
  onOpenSettings,
  promptRun,
  cadence = "weekly",
  ignoredTerms = [],
}: {
  /** Targeting config from integration settings; falls back to demo data when absent. */
  config?: DashboardConfig
  /** False when the integration has not been configured yet (no target domain saved). */
  configured?: boolean
  /** Where the "Settings" link and the setup banner point (mock/preview mode). */
  settingsHref?: string
  /** Live report data; when absent the dashboard renders built-in sample data. */
  data?: DashboardData
  /** Metadata about the live report (cache status, unavailable sections). */
  meta?: ReportMeta
  /** Overrides the default settings navigation (used inside the Uniform iframe). */
  onOpenSettings?: () => void
  /** Prompt-run inputs for the Topics & Prompts tab; mock data when absent. */
  promptRun?: PromptRunConfig
  /** Snapshot cadence, shown in the header and sent with data requests. */
  cadence?: "weekly" | "biweekly"
  /** Ignore-list terms from settings; filters keyword suggestions client-side. */
  ignoredTerms?: string[]
} = {}) {
  const live = Boolean(data)
  const d = data ?? dashboardData
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = searchParams.get("tab") as TabId | null
  const activeTab: TabId = TABS.some((t) => t.id === urlTab) ? (urlTab as TabId) : "overview"

  const [loadedTabs, setLoadedTabs] = useState<Set<TabId>>(new Set())
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideSection, setGuideSection] = useState<string | undefined>(undefined)

  // Prompt insights load with the dashboard: the answers are part of the
  // snapshot (cached for the cadence, refresh gated), so the Overview and
  // Opportunities can use them without the user visiting the prompts tab first.
  const promptInsights = usePromptInsights({
    domain: promptRun?.domain ?? "",
    brandAliases: promptRun?.brandAliases ?? [],
    competitors: promptRun?.competitors ?? [],
    aiTopics: promptRun?.aiTopics ?? [],
    prompts: promptRun?.prompts ?? [],
    location: promptRun?.location ?? "United States",
    language: promptRun?.language ?? "English",
    cadence,
    enabled: live && Boolean(promptRun),
  })

  // Simulate per-tab data loading the first time a tab is opened (mock mode only).
  useEffect(() => {
    if (live || loadedTabs.has(activeTab)) return
    const t = setTimeout(() => {
      setLoadedTabs((prev) => new Set(prev).add(activeTab))
    }, 550)
    return () => clearTimeout(t)
  }, [activeTab, loadedTabs, live])

  const selectTab = useCallback(
    (id: string | undefined) => {
      if (!id) return
      const params = new URLSearchParams(searchParams.toString())
      params.set("tab", id)
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  const goToTab = useCallback((id: TabId) => selectTab(id), [selectTab])

  const openSettings = useCallback(() => {
    if (onOpenSettings) onOpenSettings()
    else router.push(settingsHref)
  }, [onOpenSettings, router, settingsHref])

  const openGuide = useCallback(() => {
    setGuideSection(undefined)
    setGuideOpen(true)
  }, [])

  // Live data arrives fully loaded; the per-tab skeletons are mock-mode only.
  const isLoading = (id: TabId) => !live && !loadedTabs.has(id)

  return (
    <main css={shell}>
      {!configured ? (
        <Callout type="info" title="Finish setup to see your own data">
          <div css={bannerBody}>
            <span>
              No target domain configured yet, you&apos;re viewing sample data. Add your domain, brands, and
              tracked topics in settings to start collecting real insights.
            </span>
            <div>
              <Button buttonType="secondary" size="sm" onClick={openSettings}>
                <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
                  Go to settings
                  <Icon icon="arrow-right" size="0.875rem" iconColor="currentColor" />
                </span>
              </Button>
            </div>
          </div>
        </Callout>
      ) : null}
      <DashboardHeader
        domain={config?.domain ?? d.domain}
        country={config?.country ?? d.country}
        language={config?.language ?? d.language}
        lastSnapshot={d.lastSnapshot}
        cadence={cadence}
        onOpenSettings={openSettings}
        onOpenGuide={openGuide}
      />
        <div css={divider} />
        <Tabs selectedId={activeTab} onSelectedIdChange={selectTab}>
          <TabButtonGroup>
            {TABS.map((t) => (
              <TabButton key={t.id} id={t.id}>
                {t.label}
              </TabButton>
            ))}
          </TabButtonGroup>

          <div css={helpStrip}>
            <Tooltip title={TAB_HELP[activeTab].tooltip} placement="bottom-start">
              <span css={helpInfo} aria-label={TAB_HELP[activeTab].tooltip} role="img">
                <Icon icon="info" size="0.875rem" iconColor="gray" />
              </span>
            </Tooltip>
            <span>{TAB_HELP[activeTab].short}</span>
            <button
              type="button"
              css={learnMore}
              onClick={() => {
                setGuideSection(activeTab)
                setGuideOpen(true)
              }}
            >
              Learn more
            </button>
          </div>

          <TabContent tabId="overview">
            <div css={panel}>
              <OverviewTab
                data={d}
                promptInsights={live ? promptInsights.data : mockPromptInsights}
                promptsLoading={live && promptInsights.loading}
                loading={isLoading("overview")}
                onNavigate={goToTab}
                asOf={d.lastSnapshot}
              />
            </div>
          </TabContent>
          <TabContent tabId="opportunities">
            <div css={panel}>
              <OpportunitiesTab
                data={d}
                promptInsights={live ? promptInsights.data : mockPromptInsights}
                promptsLoading={live && promptInsights.loading}
                loading={isLoading("opportunities")}
                onNavigate={goToTab}
                asOf={d.lastSnapshot}
              />
            </div>
          </TabContent>
          <TabContent tabId="ai">
            <div css={panel}>
              {d.aiVisibility ? (
                <AiVisibilityTab
                  data={d.aiVisibility}
                  domain={d.domain}
                  loading={isLoading("ai")}
                  asOf={d.lastSnapshot}
                  promptInsights={live ? promptInsights.data : mockPromptInsights}
                  promptsLoading={live && promptInsights.loading}
                  onOpenPrompts={() => goToTab("prompts")}
                />
              ) : (
                <Callout type="info" title="AI visibility isn't collecting data yet">
                  {meta?.aiVisibilityMessage ??
                    "AI visibility data could not be loaded from the data source. Try refreshing, and check the server logs if it persists."}
                </Callout>
              )}
            </div>
          </TabContent>
          <TabContent tabId="prompts">
            <div css={panel}>
              <TopicsPromptsTab
                data={live ? promptInsights.data : mockPromptInsights}
                loading={live ? promptInsights.loading : isLoading("prompts")}
                error={live ? promptInsights.error : null}
                onRetry={() => promptInsights.reload()}
                ai={d.aiVisibility}
                live={live}
                asOf={d.lastSnapshot}
                onOpenSettings={openSettings}
              />
            </div>
          </TabContent>
          <TabContent tabId="keywords">
            <div css={panel}>
              <KeywordsTab
                rows={d.keywords}
                gaps={d.keywordGaps}
                domain={d.domain}
                brandAliases={promptRun?.brandAliases ?? []}
                loading={isLoading("keywords")}
                asOf={d.lastSnapshot}
              />
            </div>
          </TabContent>
          <TabContent tabId="suggestions">
            <div css={panel}>
              <KeywordSuggestionsTab
                search={d.keywordSuggestions}
                domain={d.domain}
                loading={isLoading("suggestions")}
                live={live}
                aiVisibility={d.aiVisibility}
                promptInsights={live ? promptInsights.data : mockPromptInsights}
                ignoredTerms={ignoredTerms}
              />
            </div>
          </TabContent>
          <TabContent tabId="decaying">
            <div css={panel}>
              <DecayingTab pages={d.decayingPages} loading={isLoading("decaying")} asOf={d.lastSnapshot} />
            </div>
          </TabContent>
        </Tabs>
      <GuidePanel open={guideOpen} focusSectionId={guideSection} onClose={() => setGuideOpen(false)} />
    </main>
  )
}
