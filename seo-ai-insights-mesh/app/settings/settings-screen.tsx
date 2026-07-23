"use client"

import { useMeshLocation } from "@uniformdev/mesh-sdk-react"
import { SettingsForm } from "./settings-form"
import type { IntegrationSettings } from "../lib/settings"

/**
 * Settings location entry. Reads/writes the integration settings through the
 * Mesh SDK and hands the form its value plus a setValue-backed save handler.
 * The form UI itself lives in <SettingsForm> so it can also be rendered in the
 * standalone dev preview (../settings/preview) without the Mesh context.
 */
export function SettingsScreen() {
  const { value, setValue } = useMeshLocation<"settings", IntegrationSettings>("settings")

  return (
    <SettingsForm
      initialValue={value}
      onSave={async (settings) => {
        // Settings write immediately to Uniform's integration settings storage.
        await setValue(() => ({ newValue: { ...settings } }))
      }}
    />
  )
}
