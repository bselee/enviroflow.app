"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Workflow,
  Cpu,
  Settings,
  LogOut,
  Menu,
  X,
  Leaf,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Automations", href: "/automations", icon: Workflow },
  { name: "Schedules", href: "/schedules", icon: Calendar },
  { name: "Controllers", href: "/controllers", icon: Cpu },
  { name: "Settings", href: "/settings", icon: Settings },
];

const COLLAPSED_STORAGE_KEY = "enviroflow-sidebar-collapsed";

export function AppSidebar({ isOpen, onToggle }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Desktop collapsed state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      }
    } catch (err) {
      console.warn("Failed to load sidebar collapsed state:", err);
    }
    setIsInitialized(true);
  }, []);

  // Persist collapsed state
  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(isCollapsed));
    } catch (err) {
      console.warn("Failed to save sidebar collapsed state:", err);
    }
  }, [isCollapsed, isInitialized]);

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => !prev);
  };

  // Get user display info
  const userEmail = user?.email || "user@example.com";
  const userName = user?.user_metadata?.name || userEmail.split("@")[0];
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSignOut = async () => {
    const result = await signOut();
    if (result.success) {
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
      router.push("/login");
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to sign out",
        variant: "destructive",
      });
    }
  };

  // Computed sidebar width
  const sidebarWidth = isCollapsed ? "w-16" : "w-60";
  const sidebarPadding = isCollapsed ? "px-2" : "px-3";

  return (
    <TooltipProvider delayDuration={0}>
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
          data-collapsed={isCollapsed}
          className={cn(
            "fixed left-0 top-0 z-[9999] flex h-full flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 lg:translate-x-0 border-r border-sidebar-border shadow-lg pointer-events-auto",
            sidebarWidth,
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center border-b border-sidebar-border",
            isCollapsed ? "justify-center px-2" : "justify-between px-4"
          )}>
            <div className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "gap-2"
            )}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary flex-shrink-0">
                <Leaf className="h-5 w-5 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <span className="text-lg font-semibold">EnviroFlow</span>
              )}
            </div>
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={onToggle}
              >
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 space-y-1 py-4 relative",
            sidebarPadding
          )} style={{ zIndex: 99999 }}>
            {navigation.map((item) => {
              const isActive = pathname?.startsWith(item.href);
              const navLink = (
                <a
                  key={item.name}
                  href={item.href}
                  style={{ position: 'relative', zIndex: 99999, display: 'flex' }}
                  className={cn(
                    "items-center rounded-lg py-2.5 text-sm font-medium transition-colors cursor-pointer",
                    isCollapsed ? "justify-center px-2" : "gap-3 px-3",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && item.name}
                </a>
              );

              // Wrap in tooltip when collapsed
              if (isCollapsed) {
                return (
                  <Tooltip key={item.name}>
                    <TooltipTrigger asChild>
                      {navLink}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navLink;
            })}
          </nav>

          {/* Collapse Toggle Button (Desktop only) */}
          <div className={cn(
            "hidden lg:flex border-t border-sidebar-border",
            isCollapsed ? "justify-center p-2" : "justify-end px-3 py-2"
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={toggleCollapsed}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* User menu */}
          <div className={cn(
            "border-t border-sidebar-border",
            isCollapsed ? "p-2" : "p-4"
          )}>
            {isCollapsed ? (
              // Collapsed: Show only avatar with tooltip
              <div className="flex flex-col items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-9 w-9 cursor-default">
                      <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="text-sm font-medium">{userName}</div>
                    <div className="text-xs text-muted-foreground">{userEmail}</div>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign out</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              // Expanded: Show full user info
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-sidebar-foreground/60 truncate">
                    {userEmail}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={handleSignOut}
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
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
    </TooltipProvider>
  );
}
