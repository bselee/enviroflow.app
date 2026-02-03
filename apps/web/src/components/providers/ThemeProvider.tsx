'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Available theme options.
 */
export type Theme = 'light' | 'dark';

/**
 * Theme context value.
 */
interface ThemeContextType {
  /** Current active theme */
  theme: Theme;
  /** Set theme directly */
  setTheme: (theme: Theme) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** Whether the theme has been initialized from storage */
  mounted: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'enviroflow-theme';
const DEFAULT_THEME: Theme = 'dark';

// =============================================================================
// Context
// =============================================================================

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// =============================================================================
// Provider Component
// =============================================================================

/**
 * ThemeProvider Component
 *
 * Provides theme context to the application with:
 * - localStorage persistence
 * - System preference detection (prefers-color-scheme)
 * - Automatic system preference change detection
 * - No flash of wrong theme on initial load
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <ThemeProvider>
 *   {children}
 * </ThemeProvider>
 *
 * // In any component
 * const { theme, toggleTheme } = useTheme();
 * ```
 */
export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element | null {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const isValidTheme = (value: string | null): value is Theme =>
      value === 'light' || value === 'dark';
    const savedTheme = isValidTheme(saved) ? saved : null;

    if (savedTheme) {
      setThemeState(savedTheme);
    } else if (typeof window !== 'undefined') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeState(prefersDark ? 'dark' : 'light');
    }

    setMounted(true);
  }, []);

  // Apply theme to document
  useEffect(() => {
    if (mounted) {
      const root = document.documentElement;

      // Update data-theme attribute
      root.setAttribute('data-theme', theme);

      // Toggle dark class for Tailwind
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Persist to localStorage
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme, mounted]);

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (event: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly set a preference
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      if (!savedTheme) {
        setThemeState(event.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  /**
   * Set theme with validation.
   */
  const setTheme = useCallback((newTheme: Theme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      setThemeState(newTheme);
    }
  }, []);

  /**
   * Toggle between light and dark themes.
   */
  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  // Render children even before mounted - the initial dark class on html handles the flash
  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access theme context.
 *
 * @throws Error if used outside of ThemeProvider
 *
 * @example
 * ```tsx
 * function ThemeToggle() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       Current: {theme}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
