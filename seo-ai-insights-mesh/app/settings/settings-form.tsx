/** @jsxImportSource @emotion/react */
"use client"

import { useMemo, useState, type KeyboardEvent } from "react"
import { css } from "@emotion/react"
import {
  Button,
  Callout,
  Icon,
  Input,
  InputSelect,
  SegmentedControl,
  toast,
} from "@uniformdev/design-system"
import {
  LANGUAGE_OPTIONS,
  LOCATION_OPTIONS,
  MAX_AI_PROMPTS,
  MAX_AI_TOPICS,
  MAX_COMPETITORS,
  MAX_IGNORED_TERMS,
  MAX_TRACKED_KEYWORDS,
  effectiveAiPrompts,
  estimateSnapshotLoad,
  generateDefaultPrompts,
  normalizeDomain,
  withDefaults,
  type IntegrationSettings,
} from "../lib/settings"

const shell = css`
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  padding: var(--spacing-md) var(--spacing-sm) var(--spacing-2xl);
`
const title = css`
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--typography-base);
  margin: 0;
  letter-spacing: -0.01em;
`
const lede = css`
  font-size: var(--fs-sm);
  color: var(--typography-light);
  margin: 0;
  max-width: 60ch;
`
const section = css`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
`
const fieldLabel = css`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--typography-base);
`
const helper = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
`
const row = css`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
`
const chipWrap = css`
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
`
const chip = css`
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--fs-xs);
  color: var(--typography-base);
  background: var(--gray-100);
  border: 1px solid var(--gray-200);
  border-radius: var(--rounded-full);
  padding: var(--spacing-2xs) var(--spacing-sm);
`
const chipRemove = css`
  display: inline-flex;
  cursor: pointer;
  color: var(--typography-light);
  &:hover {
    color: var(--typography-base);
  }
`
const counter = css`
  font-size: var(--fs-xs);
  color: var(--typography-light);
  margin-left: auto;
`
const labelRow = css`
  display: flex;
  align-items: baseline;
  gap: var(--spacing-sm);
`
const usageTrack = css`
  height: 6px;
  border-radius: var(--rounded-full);
  background: var(--gray-100);
  overflow: hidden;
  max-width: 340px;
`
const footer = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--gray-200);
`

const USAGE_COLORS: Record<string, string> = {
  light: "var(--green-500, #1d9e75)",
  moderate: "var(--brand-secondary-4, #0052ed)",
  heavy: "var(--orange-500, #ba7517)",
  over: "var(--red-500, #a32d2d)",
}
const USAGE_LABELS: Record<string, string> = {
  light: "Light, plenty of room for on-demand refreshes",
  moderate: "Moderate, comfortable within your monthly allowance",
  heavy: "Heavy, little room left for on-demand refreshes",
  over: "Over allowance, reduce topics or switch to bi-weekly snapshots",
}

function ChipListField({
  label,
  helperText,
  placeholder,
  values,
  max,
  onChange,
  transform,
}: {
  label: string
  helperText?: string
  placeholder: string
  values: string[]
  max: number
  onChange: (next: string[]) => void
  /** Normalizes each entry on commit (e.g. URL → bare domain). */
  transform?: (value: string) => string
}) {
  const [draft, setDraft] = useState("")
  const atMax = values.length >= max

  function commit() {
    const parts = draft
      .split(/[,\n]/)
      .map((p) => (transform ? transform(p.trim()) : p.trim()))
      .filter(Boolean)
    if (parts.length === 0) return
    const next = [...values]
    for (const p of parts) {
      if (next.length >= max) break
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p)
    }
    onChange(next)
    setDraft("")
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      commit()
    }
    if (e.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div css={section}>
      <div css={labelRow}>
        <span css={fieldLabel}>{label}</span>
        <span css={counter}>{`${values.length} / ${max}`}</span>
      </div>
      {helperText ? <span css={helper}>{helperText}</span> : null}
      {values.length > 0 ? (
        <div css={chipWrap}>
          {values.map((v) => (
            <span key={v} css={chip}>
              {v}
              <span
                css={chipRemove}
                role="button"
                tabIndex={0}
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onChange(values.filter((x) => x !== v))
                }}
              >
                <Icon icon="close" size="0.625rem" iconColor="currentColor" />
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <Input
        type="text"
        aria-label={label}
        placeholder={atMax ? "Maximum reached" : placeholder}
        disabled={atMax}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        caption="Press Enter to add. Paste comma-separated values to add several at once."
      />
    </div>
  )
}

const promptRow = css`
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
`
const promptRemove = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: none;
  background: none;
  border-radius: var(--rounded-md);
  cursor: pointer;
  color: var(--typography-light);
  &:hover {
    color: var(--typography-base);
    background: var(--gray-100);
  }
`
const promptActions = css`
  display: flex;
  gap: var(--spacing-sm);
`

/**
 * Editor for the prompts run on the Topics & Prompts tab. Prompts can be
 * generated from the configured brands, AI topics, and competitors, then
 * adjusted line by line.
 */
function PromptListField({
  values,
  onChange,
  generate,
}: {
  values: string[]
  onChange: (next: string[]) => void
  generate: () => string[]
}) {
  const atMax = values.length >= MAX_AI_PROMPTS

  function fillFromGenerator() {
    const suggested = generate()
    // Keep user-entered prompts, append fresh suggestions up to the cap.
    const next = [...values]
    for (const s of suggested) {
      if (next.length >= MAX_AI_PROMPTS) break
      if (!next.some((v) => v.trim().toLowerCase() === s.toLowerCase())) next.push(s)
    }
    onChange(next)
  }

  return (
    <div css={section}>
      <div css={labelRow}>
        <span css={fieldLabel}>AI prompts</span>
        <span css={counter}>{`${values.length} / ${MAX_AI_PROMPTS}`}</span>
      </div>
      <span css={helper}>
        Asked live to ChatGPT, Claude, Gemini, and Perplexity on the Topics &amp; Prompts tab. Leave empty to
        use prompts generated from your brands, AI topics, and competitors, or generate them here and adjust.
      </span>
      {values.map((v, i) => (
        <div css={promptRow} key={i}>
          <div css={css`flex: 1;`}>
            <Input
              type="text"
              aria-label={`Prompt ${i + 1}`}
              placeholder="e.g. Best options for headless cms"
              value={v}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? e.currentTarget.value : x)))}
            />
          </div>
          <button
            type="button"
            css={promptRemove}
            aria-label={`Remove prompt ${i + 1}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            <Icon icon="close" size="0.75rem" iconColor="currentColor" />
          </button>
        </div>
      ))}
      <div css={promptActions}>
        <Button buttonType="secondary" size="sm" onClick={fillFromGenerator} disabled={atMax}>
          <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
            <Icon icon="magic-wand" size="0.875rem" iconColor="currentColor" />
            Generate from brands &amp; topics
          </span>
        </Button>
        <Button buttonType="ghost" size="sm" onClick={() => onChange([...values, ""])} disabled={atMax}>
          <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
            <Icon icon="add" size="0.875rem" iconColor="currentColor" />
            Add prompt
          </span>
        </Button>
      </div>
    </div>
  )
}

/**
 * Data refresh section. Reports stay cached for the snapshot interval; a
 * refresh inside the interval requires the override password (checked
 * server-side by /api/refresh) so the data budget stays protected.
 */
function RefreshSection({ settings }: { settings: IntegrationSettings }) {
  const [running, setRunning] = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState("")
  const [gateMessage, setGateMessage] = useState<string | null>(null)

  async function refresh() {
    setRunning(true)
    try {
      const res = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: settings.targetDomain,
          location: settings.location,
          language: settings.language,
          brandAliases: settings.brandAliases,
          competitors: settings.competitors,
          aiTopics: settings.aiTopics,
          ignoredTerms: settings.ignoredTerms,
          prompts: effectiveAiPrompts(settings),
          cadence: settings.snapshotCadence,
          ...(needsPassword && password ? { password } : {}),
        }),
      })
      const json = await res.json()
      if (res.ok) {
        setNeedsPassword(false)
        setPassword("")
        setGateMessage(null)
        toast.success("Data refreshed. Reopen the dashboard to see the update.", { toastId: "seo-ai-refresh-ok" })
      } else if (json.error === "password_required") {
        setNeedsPassword(true)
        setGateMessage(json.message)
      } else if (json.error === "wrong_password") {
        setGateMessage(json.message)
      } else {
        toast.error(json.message ?? "Refresh failed. Try again.", { toastId: "seo-ai-refresh-error" })
      }
    } catch {
      toast.error("Refresh failed. Check your connection and try again.", { toastId: "seo-ai-refresh-error" })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div css={section}>
      <span css={fieldLabel}>Data refresh</span>
      <span css={helper}>
        {`Data updates ${settings.snapshotCadence === "biweekly" ? "every two weeks" : "weekly"} and stays cached
        between snapshots to protect your monthly data allowance. Refreshing again within the interval requires
        the override password.`}
      </span>
      {gateMessage ? (
        <Callout type="caution" compact>
          {gateMessage}
        </Callout>
      ) : null}
      {needsPassword ? (
        <div css={css`max-width: 340px;`}>
          <Input
            type="password"
            aria-label="Refresh password"
            placeholder="Refresh password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
          />
        </div>
      ) : null}
      <div>
        <Button
          buttonType="secondary"
          size="sm"
          onClick={refresh}
          disabled={running || !settings.targetDomain || (needsPassword && !password)}
        >
          <span css={css`display: inline-flex; align-items: center; gap: var(--spacing-xs);`}>
            <Icon icon="arrows-exchange" size="0.875rem" iconColor="currentColor" />
            {running ? "Refreshing… this can take a couple of minutes" : "Refresh data now"}
          </span>
        </Button>
      </div>
    </div>
  )
}

/**
 * Presentational settings form. Holds its own draft state seeded from
 * `initialValue` and delegates persistence to `onSave`, the Mesh-backed screen
 * passes a setValue-backed handler, the standalone preview passes a no-op. The
 * success/error toast lives here so both entry points behave identically.
 */
export function SettingsForm({
  initialValue,
  onSave,
}: {
  initialValue?: IntegrationSettings
  onSave: (settings: IntegrationSettings) => Promise<void>
}) {
  const [form, setForm] = useState<IntegrationSettings>(() => withDefaults(initialValue))
  const [saving, setSaving] = useState(false)

  const load = useMemo(() => estimateSnapshotLoad(form), [form])
  const patch = (p: Partial<IntegrationSettings>) => setForm((f) => ({ ...f, ...p }))

  async function save() {
    setSaving(true)
    try {
      // Drop blank prompt rows left by "Add prompt".
      await onSave({ ...form, aiPrompts: form.aiPrompts.map((p) => p.trim()).filter(Boolean) })
      toast.success("Settings saved", { toastId: "seo-ai-settings-saved" })
    } catch (e) {
      toast.error("Settings could not be saved. Try again.", { toastId: "seo-ai-settings-error" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div css={shell}>
      <div css={section}>
        <h1 css={title}>SEO &amp; AI Insights settings</h1>
        <p css={lede}>
          Configure what to analyze for this project. Data collection runs through the integration&apos;s
          connected data sources, so no API keys are needed here.
        </p>
      </div>

      <div css={section}>
        <span css={fieldLabel}>Target domain</span>
        <span css={helper}>The website these insights are about. Enter a bare domain without protocol.</span>
        <Input
          type="text"
          aria-label="Target domain"
          placeholder="acme.com"
          value={form.targetDomain}
          onChange={(e) => patch({ targetDomain: e.currentTarget.value.trim().toLowerCase() })}
          onBlur={(e) => patch({ targetDomain: normalizeDomain(e.currentTarget.value) })}
        />
      </div>

      <div css={row}>
        <InputSelect
          label="Location"
          value={form.location}
          onChange={(e) => patch({ location: e.currentTarget.value })}
          options={LOCATION_OPTIONS.map((l) => ({ label: l, value: l }))}
          caption="Market used for rankings, volumes, and AI mentions."
        />
        <InputSelect
          label="Language"
          value={form.language}
          onChange={(e) => patch({ language: e.currentTarget.value })}
          options={LANGUAGE_OPTIONS.map((l) => ({ label: l, value: l }))}
        />
      </div>

      <ChipListField
        label="Brand names and aliases"
        helperText="Used to detect mentions of your brand in AI answers. Include common variants."
        placeholder="Acme, Acme Corp"
        values={form.brandAliases}
        max={10}
        onChange={(brandAliases) => patch({ brandAliases })}
      />

      <ChipListField
        label="Competitors"
        helperText="Domains compared in share of voice and keyword gap. Pasted URLs are trimmed to the bare domain."
        placeholder="contoso.com"
        values={form.competitors}
        max={MAX_COMPETITORS}
        onChange={(competitors) => patch({ competitors })}
        transform={normalizeDomain}
      />

      <ChipListField
        label="Tracked keywords"
        helperText="Keywords included in scheduled rank tracking. You can also add keywords from the dashboard's Keyword suggestions tab."
        placeholder="headless cms"
        values={form.trackedKeywords}
        max={MAX_TRACKED_KEYWORDS}
        onChange={(trackedKeywords) => patch({ trackedKeywords })}
      />

      <ChipListField
        label="AI visibility topics"
        helperText="Topics monitored across ChatGPT, Gemini, Perplexity, Claude, and Google AI Overviews. Topics are the main driver of monthly credit usage."
        placeholder="headless cms"
        values={form.aiTopics}
        max={MAX_AI_TOPICS}
        onChange={(aiTopics) => patch({ aiTopics })}
      />

      <ChipListField
        label="Ignored terms"
        helperText='Keywords and AI prompts containing these words are excluded from every report and from opportunities. Useful for "jobs", "careers", or brand misspellings.'
        placeholder="jobs, careers"
        values={form.ignoredTerms}
        max={MAX_IGNORED_TERMS}
        onChange={(ignoredTerms) => patch({ ignoredTerms })}
      />

      <PromptListField
        values={form.aiPrompts}
        onChange={(aiPrompts) => patch({ aiPrompts })}
        generate={() => generateDefaultPrompts(form)}
      />

      <div css={section}>
        <span css={fieldLabel}>Snapshot schedule</span>
        <span css={helper}>How often fresh data is collected. Bi-weekly roughly halves recurring credit usage.</span>
        <div css={css`max-width: 340px;`}>
          <SegmentedControl
            name="snapshot-cadence"
            size="sm"
            value={form.snapshotCadence}
            options={[
              { value: "weekly", label: "Weekly" },
              { value: "biweekly", label: "Every two weeks" },
            ]}
            onChange={(v) => patch({ snapshotCadence: v as IntegrationSettings["snapshotCadence"] })}
          />
        </div>
      </div>

      <div css={section}>
        <div css={labelRow}>
          <span css={fieldLabel}>Estimated monthly usage</span>
          <span css={counter}>{`~${Math.min(load.pct, 100)}% of allowance`}</span>
        </div>
        <div css={usageTrack} role="progressbar" aria-valuenow={Math.min(load.pct, 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Estimated share of monthly credits used by scheduled snapshots">
          <div
            css={css`
              height: 100%;
              border-radius: inherit;
              transition: width 200ms ease;
            `}
            style={{ width: `${Math.min(load.pct, 100)}%`, background: USAGE_COLORS[load.level] }}
          />
        </div>
        <span css={helper}>{USAGE_LABELS[load.level]}</span>
        {load.level === "over" ? (
          <Callout type="caution" compact>
            This configuration exceeds the monthly allowance. Scheduled snapshots will pause partway
            through the month. Remove AI topics or switch to bi-weekly snapshots.
          </Callout>
        ) : null}
      </div>

      <RefreshSection settings={form} />

      <div css={footer}>
        <Button buttonType="primary" onClick={save} disabled={saving || !form.targetDomain}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {!form.targetDomain ? <span css={helper}>Enter a target domain to save.</span> : null}
      </div>
    </div>
  )
}
