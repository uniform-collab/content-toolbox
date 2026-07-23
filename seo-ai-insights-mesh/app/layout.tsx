import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Providers } from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "SEO & AI Insights",
  description:
    "SEO and AI visibility insights for your domain, rankings, AI mentions, keywords, and decaying content.",
}

export const viewport: Viewport = {
  themeColor: "#0052ed",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
