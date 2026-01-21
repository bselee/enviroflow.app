import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EnviroFlow - Environmental Control Automation",
  description:
    "Monitor sensors, control devices, and automate your environment with powerful workflows.",
};

/**
 * Root Layout Component
 *
 * Wraps the entire application with:
 * - AuthProvider: Provides authentication state and methods
 * - Toaster: Global toast notifications
 *
 * Note: AuthProvider must be a client component, so we wrap it here
 * in the server component layout.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
