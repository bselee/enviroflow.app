"use client";

import { useState, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
  /** When true, hides the sidebar completely for full-width content */
  hideSidebar?: boolean;
}

export function AppLayout({ children, hideSidebar = false }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // When hideSidebar is true, render full-width content without sidebar
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
