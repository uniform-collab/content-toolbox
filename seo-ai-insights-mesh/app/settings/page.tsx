import { Suspense } from "react"
import { MeshShell } from "../components/mesh-shell"
import { SettingsScreen } from "./settings-screen"

export default function SettingsPage() {
  return (
    <MeshShell>
      <Suspense fallback={null}>
        <SettingsScreen />
      </Suspense>
    </MeshShell>
  )
}
