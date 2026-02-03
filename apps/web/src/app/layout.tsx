import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { TooltipProviderWrapper } from '@/components/ui/TooltipProvider'
import { DragDropProvider } from '@/components/providers/DragDropProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EnviroFlow - Environmental Control Automation',
  description: 'Monitor sensors, control devices, and automate your environment with powerful workflows.',
}

/**
 * Root Layout Component
 *
 * Wraps the entire application with necessary providers:
 * - ThemeProvider: Handles light/dark theme state
 * - TooltipProviderWrapper: Provides tooltip context for help system
 * - AuthProvider: Handles Supabase authentication state
 * - DragDropProvider: Enables drag-and-drop card reordering on dashboard
 * - Toaster: Provides toast notification support
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} bg-background text-foreground`}>
        <ThemeProvider>
          <TooltipProviderWrapper>
            <AuthProvider>
              <DragDropProvider>
                {children}
              </DragDropProvider>
            </AuthProvider>
          </TooltipProviderWrapper>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
