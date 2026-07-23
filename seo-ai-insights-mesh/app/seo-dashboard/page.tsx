import { Suspense } from "react"
import { MeshShell } from "../components/mesh-shell"
import { SeoDashboardTool } from "./tool"

export default function SeoDashboardPage() {
  return (
    <MeshShell>
      <Suspense fallback={null}>
        <SeoDashboardTool />
      </Suspense>
    </MeshShell>
  )
}
