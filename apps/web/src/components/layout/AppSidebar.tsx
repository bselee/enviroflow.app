"use client";

/**
 * Application Sidebar Component
 *
 * Displays navigation links, user information, and logout functionality.
 * Uses the AuthContext to get current user data and handle sign out.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Workflow,
  Cpu,
  Settings,
  LogOut,
  Menu,
  X,
  Leaf,
  BarChart3,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

/**
 * Navigation items for the sidebar
 */
const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Workflow },
  { name: "Controllers", href: "/controllers", icon: Cpu },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

/**
 * Get user initials from email or name
 * Falls back to "U" if no data available
 */
function getUserInitials(
  user: { email?: string | null; user_metadata?: { name?: string } } | null
): string {
  if (!user) return "U";

  // Try to get name from user metadata first
  const name = user.user_metadata?.name;
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  // Fall back to email
  const email = user.email;
  if (email) {
    // Use first two characters of email before @
    const localPart = email.split("@")[0];
    return localPart.substring(0, 2).toUpperCase();
  }

  return "U";
}

/**
 * Get display name from user
 * Falls back to email local part if no name is set
 */
function getDisplayName(
  user: { email?: string | null; user_metadata?: { name?: string } } | null
): string {
  if (!user) return "User";

  // Try to get name from user metadata first
  const name = user.user_metadata?.name;
  if (name) return name;

  // Fall back to email local part
  const email = user.email;
  if (email) {
    return email.split("@")[0];
  }

  return "User";
}

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps): JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  /**
   * Handle user sign out
   * Shows loading state and redirects to login on success
   */
  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);

    try {
      const result = await signOut();

      if (!result.success) {
        toast({
          title: "Sign out failed",
          description: result.error,
          variant: "destructive",
        });
        setIsSigningOut(false);
        return;
      }

      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });

      // Redirect to login page
      router.push("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Sign out failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  }

  const userInitials = getUserInitials(user);
  const displayName = getDisplayName(user);
  const userEmail = user?.email ?? "No email";

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Leaf className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold">EnviroFlow</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={onToggle}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                onClick={() => {
                  // Close mobile sidebar on navigation
                  if (typeof window !== "undefined" && window.innerWidth < 1024)
                    onToggle();
                }}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User menu */}
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {userEmail}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={handleSignOut}
              disabled={isSigningOut}
              title="Sign out"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-30 lg:hidden"
        onClick={onToggle}
      >
        <Menu className="h-6 w-6" />
      </Button>
    </>
  );
}
