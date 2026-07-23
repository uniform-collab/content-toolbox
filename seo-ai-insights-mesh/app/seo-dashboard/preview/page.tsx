import { Suspense } from "react"
import { Dashboard } from "../../components/dashboard/dashboard"

/**
 * Standalone preview of the dashboard for local development.
 *
 * The real entry point (../page.tsx) wraps the dashboard in <MeshApp>, which
 * only resolves when embedded inside the Uniform dashboard iframe. This route
 * renders the same <Dashboard> directly with its built-in mock data so the UI
 * can be viewed in a plain browser, it is NOT used by the Mesh integration.
 */
export default function SeoDashboardPreviewPage() {
  return (
    <Suspense fallback={null}>
      <Dashboard configured={false} settingsHref="/settings/preview" />
    </Suspense>
  )
}
