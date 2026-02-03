"use client";

import { useState, useEffect, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";

interface AppLayoutProps {
  children: ReactNode;
  /** When true, hides the sidebar completely for full-width content */
  hideSidebar?: boolean;
}

const COLLAPSED_STORAGE_KEY = "enviroflow-sidebar-collapsed";

export function AppLayout({ children, hideSidebar = false }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Sync with sidebar's collapsed state from localStorage
  useEffect(() => {
    const syncCollapsedState = () => {
      try {
        const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
        setIsCollapsed(stored === "true");
      } catch (err) {
        console.warn("Failed to load sidebar collapsed state:", err);
      }
    };

    // Initial sync
    syncCollapsedState();

    // Listen for storage changes (for multi-tab sync)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === COLLAPSED_STORAGE_KEY) {
        setIsCollapsed(e.newValue === "true");
      }
    };

    // Also listen for custom events (for same-tab sync)
    const handleSidebarToggle = () => {
      syncCollapsedState();
    };

    window.addEventListener("storage", handleStorageChange);
    
    // Use MutationObserver to watch sidebar's data-collapsed attribute
    const observer = new MutationObserver(() => {
      syncCollapsedState();
    });

    // Observe localStorage changes via a polling approach (simple solution)
    const interval = setInterval(syncCollapsedState, 100);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

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

      {/* Main content area - adjusts based on sidebar collapsed state */}
      <main className={`min-h-screen transition-all duration-300 ${isCollapsed ? "lg:pl-16" : "lg:pl-60"}`}>
        {children}
      </main>
    </div>
  );
}
