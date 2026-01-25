/**
 * Brand-Specific Connection Guides
 *
 * This module loads and serves markdown guides for each controller brand.
 * Guides are stored as markdown files for easy editing by non-developers.
 *
 * Guide locations: /docs/controller-guides/*.md
 */

import type { ControllerBrand } from "@/types";

// ============================================
// Guide Metadata
// ============================================

export interface BrandGuide {
  /** Controller brand ID */
  brand: ControllerBrand;
  /** Guide title */
  title: string;
  /** Short description */
  description: string;
  /** Markdown content (loaded async) */
  content?: string;
  /** Whether this guide is available */
  available: boolean;
  /** External help URL (fallback if no guide) */
  externalUrl?: string;
}

/**
 * Guide metadata for all brands
 * Content is loaded on-demand via loadGuideContent()
 */
export const BRAND_GUIDES: Record<string, BrandGuide> = {
  ac_infinity: {
    brand: "ac_infinity",
    title: "AC Infinity Connection Guide",
    description: "Step-by-step guide for connecting AC Infinity WiFi controllers",
    available: true,
    externalUrl: "https://www.acinfinity.com/contact/",
  },
  inkbird: {
    brand: "inkbird",
    title: "Inkbird Connection Guide",
    description: "Instructions for Inkbird controllers and CSV upload",
    available: true,
    externalUrl: "https://www.inkbird.com/pages/contact-us",
  },
  ecowitt: {
    brand: "ecowitt",
    title: "Ecowitt Weather Station Guide",
    description: "How to configure Ecowitt weather stations with webhook upload",
    available: true,
    externalUrl: "https://www.ecowitt.com/",
  },
  csv_upload: {
    brand: "csv_upload",
    title: "CSV Upload Guide",
    description: "Format requirements and tips for manual CSV data import",
    available: true,
  },
  govee: {
    brand: "govee",
    title: "Govee Integration Guide",
    description: "Connecting Govee smart sensors and devices",
    available: true,
    externalUrl: "https://www.govee.com/",
  },
  mqtt: {
    brand: "mqtt",
    title: "MQTT Integration Guide",
    description: "Configure MQTT broker connection for custom sensors",
    available: true,
  },
  custom: {
    brand: "custom",
    title: "Custom Integration Guide",
    description: "Build your own integration with EnviroFlow API",
    available: false,
  },
};

// ============================================
// Guide Content Loading
// ============================================

/**
 * Cache for loaded guide content to avoid repeated fetches
 */
const guideContentCache = new Map<ControllerBrand, string>();

/**
 * Load guide content for a specific brand
 *
 * Content is fetched from /docs/controller-guides/{brand}.md
 * Results are cached for performance
 */
export async function loadGuideContent(
  brand: ControllerBrand
): Promise<string | null> {
  // Check cache first
  if (guideContentCache.has(brand)) {
    return guideContentCache.get(brand) || null;
  }

  const guide = BRAND_GUIDES[brand];
  if (!guide || !guide.available) {
    return null;
  }

  try {
    // In production, these will be static files served by Next.js
    // In development, we read them from the docs folder
    const response = await fetch(`/guides/${brand}.md`);

    if (!response.ok) {
      console.error(`Failed to load guide for ${brand}: ${response.status}`);
      return null;
    }

    const content = await response.text();

    // Cache the content
    guideContentCache.set(brand, content);

    return content;
  } catch (error) {
    console.error(`Error loading guide for ${brand}:`, error);
    return null;
  }
}

/**
 * Get guide for a specific brand (metadata only, no content)
 */
export function getBrandGuide(brand: ControllerBrand): BrandGuide | null {
  return BRAND_GUIDES[brand] || null;
}

/**
 * Get all available guides
 */
export function getAllGuides(): BrandGuide[] {
  return Object.values(BRAND_GUIDES);
}

/**
 * Get guides for available brands only
 */
export function getAvailableGuides(): BrandGuide[] {
  return Object.values(BRAND_GUIDES).filter((guide) => guide.available);
}

/**
 * Check if a guide exists for a brand
 */
export function hasGuide(brand: ControllerBrand): boolean {
  const guide = BRAND_GUIDES[brand];
  return guide?.available || false;
}

/**
 * Get guide URL (for external links)
 */
export function getGuideUrl(brand: ControllerBrand): string | null {
  const guide = BRAND_GUIDES[brand];
  return guide?.externalUrl || null;
}

// ============================================
// Guide Search & Filtering
// ============================================

/**
 * Search guide content for a keyword
 *
 * Returns section headings and snippets that match the search term
 */
export async function searchGuide(
  brand: ControllerBrand,
  searchTerm: string
): Promise<Array<{ heading: string; snippet: string }>> {
  const content = await loadGuideContent(brand);
  if (!content) return [];

  const results: Array<{ heading: string; snippet: string }> = [];
  const lines = content.split("\n");
  let currentHeading = "";

  const lowerSearch = searchTerm.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track current heading
    if (line.startsWith("#")) {
      currentHeading = line.replace(/^#+\s*/, "");
      continue;
    }

    // Check if line matches search
    if (line.toLowerCase().includes(lowerSearch)) {
      // Get context (current line + next 2 lines)
      const snippet = [line, lines[i + 1] || "", lines[i + 2] || ""]
        .filter(Boolean)
        .join(" ")
        .substring(0, 200);

      results.push({
        heading: currentHeading || "Introduction",
        snippet: snippet.trim() + "...",
      });
    }
  }

  return results.slice(0, 5); // Return top 5 results
}

/**
 * Extract table of contents from guide
 *
 * Parses markdown headings to build a TOC
 */
export async function getGuideTableOfContents(
  brand: ControllerBrand
): Promise<Array<{ level: number; title: string; id: string }>> {
  const content = await loadGuideContent(brand);
  if (!content) return [];

  const toc: Array<{ level: number; title: string; id: string }> = [];
  const lines = content.split("\n");

  for (const line of lines) {
    // Match markdown headings: # Heading
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      toc.push({ level, title, id });
    }
  }

  return toc;
}

// ============================================
// Common Sections Extraction
// ============================================

/**
 * Extract prerequisites section from guide
 */
export async function getPrerequisites(
  brand: ControllerBrand
): Promise<string[]> {
  const content = await loadGuideContent(brand);
  if (!content) return [];

  const prerequisites: string[] = [];
  const lines = content.split("\n");
  let inPrerequisites = false;

  for (const line of lines) {
    if (line.includes("## Prerequisites")) {
      inPrerequisites = true;
      continue;
    }

    if (inPrerequisites) {
      // Stop at next heading
      if (line.startsWith("##")) {
        break;
      }

      // Extract checklist items
      const match = line.match(/^- \[ \] (.+)$/);
      if (match) {
        prerequisites.push(match[1]);
      }
    }
  }

  return prerequisites;
}

/**
 * Extract common errors section from guide
 */
export async function getCommonErrors(
  brand: ControllerBrand
): Promise<Array<{ error: string; cause: string; fix: string }>> {
  const content = await loadGuideContent(brand);
  if (!content) return [];

  const errors: Array<{ error: string; cause: string; fix: string }> = [];
  const lines = content.split("\n");
  let inCommonErrors = false;
  let currentError = "";
  let currentCause = "";
  let currentFix: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("## Common")) {
      inCommonErrors = true;
      continue;
    }

    if (inCommonErrors) {
      // Stop at next major heading
      if (line.startsWith("## ") && !line.includes("Common")) {
        break;
      }

      // Error heading (### "Error message")
      if (line.startsWith("### ")) {
        // Save previous error if exists
        if (currentError) {
          errors.push({
            error: currentError,
            cause: currentCause,
            fix: currentFix.join(" "),
          });
        }

        // Start new error
        currentError = line.replace(/^###\s*/, "").replace(/['"]/g, "");
        currentCause = "";
        currentFix = [];
        continue;
      }

      // Cause line
      if (line.startsWith("**Cause:**")) {
        currentCause = line.replace("**Cause:**", "").trim();
        continue;
      }

      // Fix section
      if (line.startsWith("**Fix:**")) {
        // Fix steps follow
        continue;
      }

      // Fix steps (numbered or bulleted)
      if (currentError && (line.match(/^\d+\./) || line.startsWith("-"))) {
        const step = line.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").trim();
        if (step) {
          currentFix.push(step);
        }
      }
    }
  }

  // Add last error
  if (currentError) {
    errors.push({
      error: currentError,
      cause: currentCause,
      fix: currentFix.join(" "),
    });
  }

  return errors;
}

/**
 * Clear guide content cache (useful for development)
 */
export function clearGuideCache(): void {
  guideContentCache.clear();
}
