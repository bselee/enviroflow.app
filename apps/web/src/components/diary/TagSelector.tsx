"use client";

import { Badge } from "@/components/ui/badge";
import type { DiaryEntryTag } from "@/types";
import { cn } from "@/lib/utils";

interface TagConfig {
  value: DiaryEntryTag;
  label: string;
  icon: string;
  colorClass: string;
  activeClass: string;
}

const TAG_CONFIG: TagConfig[] = [
  {
    value: "watering",
    label: "Watering",
    icon: "💧",
    colorClass: "border-blue-300 text-blue-700 dark:text-blue-400",
    activeClass: "bg-blue-500/20 border-blue-500",
  },
  {
    value: "feeding",
    label: "Feeding",
    icon: "🌱",
    colorClass: "border-green-300 text-green-700 dark:text-green-400",
    activeClass: "bg-green-500/20 border-green-500",
  },
  {
    value: "training",
    label: "Training",
    icon: "✂️",
    colorClass: "border-yellow-300 text-yellow-700 dark:text-yellow-400",
    activeClass: "bg-yellow-500/20 border-yellow-500",
  },
  {
    value: "issue",
    label: "Issue",
    icon: "⚠️",
    colorClass: "border-red-300 text-red-700 dark:text-red-400",
    activeClass: "bg-red-500/20 border-red-500",
  },
  {
    value: "milestone",
    label: "Milestone",
    icon: "🎯",
    colorClass: "border-purple-300 text-purple-700 dark:text-purple-400",
    activeClass: "bg-purple-500/20 border-purple-500",
  },
  {
    value: "observation",
    label: "Observation",
    icon: "👁️",
    colorClass: "border-gray-300 text-gray-700 dark:text-gray-400",
    activeClass: "bg-gray-500/20 border-gray-500",
  },
  {
    value: "harvest",
    label: "Harvest",
    icon: "🌾",
    colorClass: "border-amber-300 text-amber-700 dark:text-amber-400",
    activeClass: "bg-amber-500/20 border-amber-500",
  },
];

// Export for use in DiaryEntryCard etc.
export { TAG_CONFIG };

interface TagSelectorProps {
  selectedTags: DiaryEntryTag[];
  onChange: (tags: DiaryEntryTag[]) => void;
  disabled?: boolean;
}

/**
 * Color-coded toggle buttons for selecting diary entry tags.
 */
export function TagSelector({ selectedTags, onChange, disabled = false }: TagSelectorProps) {
  const toggleTag = (tag: DiaryEntryTag) => {
    if (disabled) return;

    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {TAG_CONFIG.map((tag) => {
        const isActive = selectedTags.includes(tag.value);
        return (
          <button
            key={tag.value}
            type="button"
            disabled={disabled}
            onClick={() => toggleTag(tag.value)}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            aria-pressed={isActive}
            aria-label={`${tag.label} tag`}
          >
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer select-none transition-all gap-1 px-3 py-1",
                isActive ? tag.activeClass : tag.colorClass,
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <span>{tag.icon}</span>
              <span>{tag.label}</span>
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Display-only tag badges for showing tags on diary entries.
 */
export function TagBadges({ tags }: { tags: DiaryEntryTag[] }) {
  if (!tags || tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tagValue) => {
        const config = TAG_CONFIG.find((t) => t.value === tagValue);
        if (!config) return null;
        return (
          <Badge
            key={tagValue}
            variant="outline"
            className={cn("gap-1 text-xs", config.activeClass)}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </Badge>
        );
      })}
    </div>
  );
}
