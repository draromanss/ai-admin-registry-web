import type { Metadata, Viewport } from "next"
import Script from "next/script"
import "./globals.css"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

export const metadata: Metadata = {
  title: "AI Admin Registry",
  description: "A human accountability and authorization layer for autonomous AI agents.",
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071017",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  )
}
