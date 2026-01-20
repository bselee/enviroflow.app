import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EnviroFlow - Environmental Compliance Automation',
  description: 'Automate your environmental compliance workflows',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
