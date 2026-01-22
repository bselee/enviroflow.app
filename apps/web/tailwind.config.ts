import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        // Dashboard typography scale
        "hero": ["72px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "metric": ["64px", { lineHeight: "1", letterSpacing: "-0.02em", fontWeight: "600" }],
        "supporting": ["18px", { lineHeight: "1.5", fontWeight: "500" }],
        "context": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Semantic colors
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        // Status colors
        online: "hsl(var(--online))",
        offline: "hsl(var(--offline))",
        active: "hsl(var(--active))",
        paused: "hsl(var(--paused))",
        // Gray scale
        gray: {
          50: "hsl(var(--gray-50))",
          100: "hsl(var(--gray-100))",
          200: "hsl(var(--gray-200))",
          300: "hsl(var(--gray-300))",
          400: "hsl(var(--gray-400))",
          500: "hsl(var(--gray-500))",
          600: "hsl(var(--gray-600))",
          700: "hsl(var(--gray-700))",
          800: "hsl(var(--gray-800))",
          900: "hsl(var(--gray-900))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Dashboard Design System - Environment colors
        env: {
          bg: "var(--env-bg)",
          surface: "var(--env-surface)",
          border: "var(--env-border)",
        },
        // Dashboard Design System - Status gradients (use with gradient utilities)
        status: {
          optimal: {
            DEFAULT: "var(--status-optimal)",
            from: "var(--status-optimal-from)",
            to: "var(--status-optimal-to)",
          },
          warning: {
            DEFAULT: "var(--status-warning)",
            from: "var(--status-warning-from)",
            to: "var(--status-warning-to)",
          },
          alert: {
            DEFAULT: "var(--status-alert)",
            from: "var(--status-alert-from)",
            to: "var(--status-alert-to)",
          },
        },
        // Dashboard Design System - Accent
        "accent-blue": "var(--accent-blue)",
        // Dashboard Design System - Text hierarchy
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      backdropBlur: {
        glass: "12px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        // Dashboard animations
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 20px var(--pulse-glow-color, rgba(16, 185, 129, 0.4))",
            opacity: "1",
          },
          "50%": {
            boxShadow: "0 0 40px var(--pulse-glow-color, rgba(16, 185, 129, 0.6))",
            opacity: "0.8",
          },
        },
        "count-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(10px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        "slide-up": {
          "0%": {
            opacity: "0",
            transform: "translateY(20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translateY(0)",
          },
        },
        // Demo mode CTA pulsing glow animation
        "cta-pulse": {
          "0%, 100%": {
            boxShadow: "0 10px 15px -3px hsl(var(--primary) / 0.25), 0 4px 6px -4px hsl(var(--primary) / 0.25)",
          },
          "50%": {
            boxShadow: "0 20px 25px -5px hsl(var(--primary) / 0.4), 0 8px 10px -6px hsl(var(--primary) / 0.4)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-slow": "pulse-slow 2s ease-in-out infinite",
        // Dashboard animations
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "count-up": "count-up 0.6s ease-out forwards",
        "slide-up": "slide-up 0.4s ease-out forwards",
        // Demo mode CTA pulsing animation
        "cta-pulse": "cta-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
