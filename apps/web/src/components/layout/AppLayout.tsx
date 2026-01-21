"use client";

import { useState, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  /**
   * When true, hides the sidebar for full-screen experiences like the workflow builder.
   * The main content will take up the entire viewport width.
   */
  hideSidebar?: boolean;
}

export function AppLayout({ children, hideSidebar = false }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Full-screen mode without sidebar
  if (hideSidebar) {
    return (
      <div className="min-h-screen bg-background">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main content area */}
      <main className="lg:pl-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
