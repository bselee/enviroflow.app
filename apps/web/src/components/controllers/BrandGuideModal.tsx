/**
 * BrandGuideModal Component
 *
 * Displays brand-specific connection guides in a modal dialog.
 * Loads markdown content and renders it with proper formatting.
 *
 * Features:
 * - Markdown rendering with syntax highlighting
 * - Table of contents for easy navigation
 * - Search within guide
 * - Prerequisites checklist
 * - Common errors quick reference
 * - External help links
 */

"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ControllerBrand } from "@/types";
import {
  loadGuideContent,
  getBrandGuide,
  getGuideTableOfContents,
  getPrerequisites,
  getCommonErrors,
  type BrandGuide,
} from "@/lib/brand-guides";

// ============================================
// Simple Markdown Renderer
// ============================================

/**
 * Renders markdown content with basic formatting
 * Supports: headings, bold, italic, links, lists, code blocks
 */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBlockLines: string[] = [];
  let inCodeBlock = false;
  let listItems: string[] = [];
  let inList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-3 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {renderInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <pre
          key={`code-${elements.length}`}
          className="bg-muted rounded-lg p-4 overflow-x-auto my-3 text-sm"
        >
          <code>{codeBlockLines.join("\n")}</code>
        </pre>
      );
      codeBlockLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      flushList();
      elements.push(
        <h1 key={i} className="text-3xl font-bold mt-6 mb-4">
          {line.substring(2)}
        </h1>
      );
      continue;
    }

    if (line.startsWith("## ")) {
      flushList();
      const heading = line.substring(3);
      const id = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      elements.push(
        <h2 key={i} id={id} className="text-2xl font-semibold mt-6 mb-3 scroll-mt-20">
          {heading}
        </h2>
      );
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      const heading = line.substring(4);
      const id = heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      elements.push(
        <h3 key={i} id={id} className="text-xl font-medium mt-4 mb-2 scroll-mt-20">
          {heading}
        </h3>
      );
      continue;
    }

    // Lists
    if (line.match(/^- /) || line.match(/^\d+\. /)) {
      const content = line.replace(/^-\s*/, "").replace(/^\d+\.\s*/, "");
      listItems.push(content);
      inList = true;
      continue;
    } else if (inList && line.trim() === "") {
      flushList();
      inList = false;
      continue;
    }

    // Checklists
    if (line.startsWith("- [ ]") || line.startsWith("- [x]")) {
      flushList();
      const checked = line.startsWith("- [x]");
      const content = line.replace(/^- \[[x ]\]\s*/, "");
      elements.push(
        <div key={i} className="flex items-start gap-2 my-2">
          <CheckCircle2
            className={cn(
              "w-4 h-4 mt-0.5 flex-shrink-0",
              checked ? "text-success" : "text-muted-foreground"
            )}
          />
          <span className="text-sm text-muted-foreground">{renderInlineMarkdown(content)}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      flushList();
      continue;
    }

    // Regular paragraphs
    flushList();
    elements.push(
      <p key={i} className="text-sm text-muted-foreground my-2 leading-relaxed">
        {renderInlineMarkdown(line)}
      </p>
    );
  }

  flushList();
  flushCodeBlock();

  return <div className="space-y-2">{elements}</div>;
}

/**
 * Render inline markdown (bold, italic, links, code)
 */
function renderInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.substring(0, boldMatch.index));
      }
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold text-foreground">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Links: [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(remaining.substring(0, linkMatch.index));
      }
      parts.push(
        <a
          key={`link-${key++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          {linkMatch[1]}
          <ExternalLink className="w-3 h-3" />
        </a>
      );
      remaining = remaining.substring(linkMatch.index + linkMatch[0].length);
      continue;
    }

    // Inline code: `code`
    const codeMatch = remaining.match(/`([^`]+)`/);
    if (codeMatch && codeMatch.index !== undefined) {
      if (codeMatch.index > 0) {
        parts.push(remaining.substring(0, codeMatch.index));
      }
      parts.push(
        <code
          key={`code-${key++}`}
          className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
      continue;
    }

    // No more matches, add remaining text
    parts.push(remaining);
    break;
  }

  return <>{parts}</>;
}

// ============================================
// Component Props
// ============================================

interface BrandGuideModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Controller brand to show guide for */
  brand: ControllerBrand;
  /** Optional: specific error to highlight */
  highlightError?: string;
}

// ============================================
// Component
// ============================================

export function BrandGuideModal({
  open,
  onOpenChange,
  brand,
  highlightError,
}: BrandGuideModalProps) {
  const [guide, setGuide] = useState<BrandGuide | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [toc, setToc] = useState<Array<{ level: number; title: string; id: string }>>([]);
  const [prerequisites, setPrerequisites] = useState<string[]>([]);
  const [commonErrors, setCommonErrors] = useState<
    Array<{ error: string; cause: string; fix: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Load guide data when modal opens
  useEffect(() => {
    if (!open) return;

    const loadGuide = async () => {
      setLoading(true);

      const guideData = getBrandGuide(brand);
      setGuide(guideData);

      if (!guideData?.available) {
        setLoading(false);
        return;
      }

      try {
        const [guideContent, guideToc, guidePrereqs, guideErrors] = await Promise.all([
          loadGuideContent(brand),
          getGuideTableOfContents(brand),
          getPrerequisites(brand),
          getCommonErrors(brand),
        ]);

        setContent(guideContent);
        setToc(guideToc);
        setPrerequisites(guidePrereqs);
        setCommonErrors(guideErrors);

        // Auto-scroll to error if specified
        if (highlightError && guideErrors.length > 0) {
          const matchingError = guideErrors.find((e) =>
            e.error.toLowerCase().includes(highlightError.toLowerCase())
          );
          if (matchingError) {
            const errorId = matchingError.error
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-");
            setActiveSection(errorId);
          }
        }
      } catch (error) {
        console.error("Error loading guide:", error);
      } finally {
        setLoading(false);
      }
    };

    loadGuide();
  }, [open, brand, highlightError]);

  // Auto-scroll to active section
  useEffect(() => {
    if (activeSection && content) {
      setTimeout(() => {
        const element = document.getElementById(activeSection);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [activeSection, content]);

  // Filter content by search term
  const filteredContent = React.useMemo(() => {
    if (!content || !searchTerm.trim()) return content;

    const lines = content.split("\n");
    const filtered: string[] = [];
    const lowerSearch = searchTerm.toLowerCase();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.toLowerCase().includes(lowerSearch) ||
        line.startsWith("#") // Always include headings
      ) {
        filtered.push(line);
      }
    }

    return filtered.join("\n");
  }, [content, searchTerm]);

  if (!guide) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle>{guide.title}</DialogTitle>
              <DialogDescription className="mt-1">{guide.description}</DialogDescription>
            </div>
            {guide.externalUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={guide.externalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Official Support
                </a>
              </Button>
            )}
          </div>

          {/* Search */}
          {guide.available && (
            <div className="mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search guide..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !guide.available ? (
          <div className="px-6 py-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
            <h3 className="font-medium mb-2">Guide Coming Soon</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We&apos;re working on a comprehensive guide for {brand}. In the meantime:
            </p>
            <div className="space-y-2">
              {guide.externalUrl && (
                <Button variant="outline" asChild>
                  <a href={guide.externalUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Visit Official Documentation
                  </a>
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                Need help now? Contact support@enviroflow.app
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar - TOC & Quick Links */}
            <div className="w-64 border-r bg-muted/30 overflow-y-auto p-4 space-y-4">
              {/* Prerequisites */}
              {prerequisites.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Prerequisites</h4>
                  <div className="space-y-1">
                    {prerequisites.slice(0, 3).map((prereq, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {prereq}
                        </span>
                      </div>
                    ))}
                    {prerequisites.length > 3 && (
                      <button
                        onClick={() => setActiveSection("prerequisites")}
                        className="text-xs text-primary hover:underline"
                      >
                        +{prerequisites.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Common Errors */}
              {commonErrors.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Common Errors</h4>
                  <div className="space-y-1">
                    {commonErrors.slice(0, 3).map((error, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const id = error.error.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                          setActiveSection(id);
                        }}
                        className="w-full text-left text-xs text-muted-foreground hover:text-foreground line-clamp-2 transition-colors"
                      >
                        <ChevronRight className="w-3 h-3 inline mr-1" />
                        {error.error}
                      </button>
                    ))}
                    {commonErrors.length > 3 && (
                      <button
                        onClick={() => setActiveSection("common-errors")}
                        className="text-xs text-primary hover:underline"
                      >
                        +{commonErrors.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Table of Contents */}
              {toc.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Contents</h4>
                  <nav className="space-y-1">
                    {toc
                      .filter((item) => item.level <= 2)
                      .map((item, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveSection(item.id)}
                          className={cn(
                            "w-full text-left text-xs transition-colors block",
                            item.level === 1 && "font-medium",
                            item.level === 2 && "pl-3",
                            activeSection === item.id
                              ? "text-primary"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {item.title}
                        </button>
                      ))}
                  </nav>
                </div>
              )}
            </div>

            {/* Main Content */}
            <ScrollArea className="flex-1">
              <div className="p-6 max-w-3xl">
                {filteredContent ? (
                  <>
                    <MarkdownContent content={filteredContent} />
                    {searchTerm && filteredContent.split("\n").length < 10 && (
                      <div className="mt-8 p-4 bg-muted rounded-lg text-center">
                        <p className="text-sm text-muted-foreground">
                          No more results for &quot;{searchTerm}&quot;
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => setSearchTerm("")}
                          className="mt-2"
                        >
                          Clear search
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Failed to load guide content
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BrandGuideModal;
