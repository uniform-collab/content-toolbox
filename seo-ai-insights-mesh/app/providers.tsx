"use client"

import type { ReactNode } from "react"
import { Theme, IconsProvider, ToastContainer } from "@uniformdev/design-system"

/**
 * Mounts the Uniform design system at the root of the app.
 *
 * - <Theme /> is a self-contained element (it takes no children). It injects
 *   the design token CSS variables and the baseline reset globally, so render
 *   it once as a sibling of your app content.
 * - <IconsProvider /> wraps the tree to enable string-based <Icon icon="..." />
 *   lookups used by many components (buttons with icons, inputs, menus, etc.).
 *
 * Emotion-based components are client components, so this wrapper is a client
 * boundary mounted from the server layout.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <>
      <Theme />
      <ToastContainer limit={4} autoCloseDelay="normal" />
      <IconsProvider>{children}</IconsProvider>
    </>
  )
}
