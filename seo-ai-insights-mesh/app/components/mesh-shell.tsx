"use client"

import type { ReactNode } from "react"
import { MeshApp } from "@uniformdev/mesh-sdk-react"

/**
 * Wraps Mesh location pages with the Mesh SDK provider. <MeshApp> performs the
 * iframe handshake with the Uniform dashboard; every page that calls
 * useMeshLocation must render inside it. The root landing page stays outside.
 */
export function MeshShell({ children }: { children: ReactNode }) {
  return <MeshApp>{children}</MeshApp>
}
