"use client"

import { SettingsForm } from "../settings-form"

/**
 * Standalone preview of the settings form for local development.
 *
 * The real entry point (../page.tsx) wraps <SettingsScreen> in <MeshApp>, which
 * only resolves when embedded inside the Uniform dashboard iframe. This route
 * renders the same <SettingsForm> directly with a no-op save so the UI can be
 * viewed and exercised in a plain browser, it is NOT used by the Mesh
 * integration and never writes to Uniform.
 */
export default function SettingsPreviewPage() {
  return (
    <SettingsForm
      onSave={async (settings) => {
        // No Uniform host in standalone preview, log instead of persisting.
        // The form still shows its "Settings saved" toast on success.
        console.log("[settings preview] would save:", settings)
      }}
    />
  )
}
