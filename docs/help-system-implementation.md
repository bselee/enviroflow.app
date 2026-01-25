# Help Tooltip System Implementation

## Overview

The contextual help tooltip system provides inline help throughout EnviroFlow with:
- Hover tooltips for quick reference
- Click-to-expand modals with detailed information
- External documentation links
- Full keyboard accessibility
- Mobile-friendly touch support
- Emoji icons for visual scanning

## Architecture

### Components

1. **HelpTooltip** (`/apps/web/src/components/ui/HelpTooltip.tsx`)
   - Main help icon component
   - Supports multiple display variants (icon, text, inline)
   - Configurable sizes (sm, md, lg)
   - Opens modal on click for detailed help

2. **TooltipProvider** (`/apps/web/src/components/ui/TooltipProvider.tsx`)
   - Global context provider for Radix UI tooltips
   - Configured in root layout
   - Manages tooltip delays and behavior

3. **Help Content Registry** (`/apps/web/src/lib/help-content.ts`)
   - Centralized help content database
   - Organized by functional area
   - Includes titles, descriptions, icons, and links

## Usage

### Basic Usage

```tsx
import { HelpTooltip } from "@/components/ui/HelpTooltip";
import { Label } from "@/components/ui/label";

<Label htmlFor="name" className="flex items-center">
  Controller Name
  <HelpTooltip id="controller-name" />
</Label>
```

### Variants

```tsx
// Icon only (default)
<HelpTooltip id="controller-name" variant="icon" />

// Icon with "Help" text
<HelpTooltip id="controller-name" variant="text" />

// Inline with content flow
<HelpTooltip id="controller-name" variant="inline" />
```

### Sizes

```tsx
<HelpTooltip id="controller-name" size="sm" />   // 14px
<HelpTooltip id="controller-name" size="md" />   // 16px
<HelpTooltip id="controller-name" size="lg" />   // 20px
```

### Custom Content

For help content not in the registry:

```tsx
<HelpTooltip
  id="custom-help"
  content={{
    title: "Custom Feature",
    description: "Detailed explanation...",
    icon: "🎯",
    links: [{ text: "Learn More", url: "https://..." }]
  }}
/>
```

### Inline Help Text

For simple supplementary hints:

```tsx
import { InlineHelp } from "@/components/ui/HelpTooltip";

<InlineHelp>
  This is a helpful hint displayed below a form field.
</InlineHelp>
```

## Help Content Registry

### Structure

Each help entry includes:

```typescript
{
  id: string;                    // Unique identifier
  title: string;                 // Display title
  description: string;           // Full explanation (shown in modal)
  shortDescription?: string;     // Brief text for tooltip
  icon?: string;                 // Emoji/icon for visual identification
  links?: HelpLink[];           // External documentation links
}
```

### Adding New Help Content

Edit `/apps/web/src/lib/help-content.ts`:

```typescript
export const HELP_CONTENT: Record<string, HelpContent> = {
  "your-new-help-id": {
    id: "your-new-help-id",
    title: "Feature Name",
    icon: "🎯",
    shortDescription: "Brief tooltip text",
    description: "Detailed explanation shown in modal...",
    links: [
      {
        text: "Documentation",
        url: "https://enviroflow.app/docs/feature"
      }
    ]
  },
  // ... other entries
};
```

## Current Help Topics

### Controller Setup
- `controller-name` - Naming your controller
- `controller-credentials` - Account security information
- `controller-email` - Email field explanation
- `controller-password` - Password encryption details

### Room Management
- `room-assignment` - Organizing by location
- `room-name` - Naming conventions for rooms

### Sensors & Devices
- `sensor-type` - Environmental measurement types
- `device-port` - Physical port identification
- `device-type` - Device classification
- `vpd-calculation` - VPD formula and usage

### Workflows
- `workflow-trigger` - When automation runs
- `workflow-action` - What automation does
- `workflow-condition` - Extra execution requirements

### Data & Integration
- `csv-upload` - CSV import functionality
- `csv-template` - Template format explanation
- `network-discovery` - Automatic device detection
- `discovered-device` - Pre-configured devices

### Advanced Features
- `ai-insights` - AI-powered analysis
- `data-export` - Export functionality
- `notification-settings` - Alert configuration
- `growth-stage` - Plant development phases

## Integration Points

### Components Updated

1. **AddControllerDialog** (`/apps/web/src/components/controllers/AddControllerDialog.tsx`)
   - Email field: `controller-email`
   - Password field: `controller-password`
   - Name field: `controller-name`
   - Room selector: `room-assignment`

2. **AddRoomDialog** (`/apps/web/src/components/dashboard/AddRoomDialog.tsx`)
   - Room name field: `room-name`

### Root Layout

The `TooltipProviderWrapper` is configured in `/apps/web/src/app/layout.tsx`:

```tsx
<ThemeProvider>
  <TooltipProviderWrapper>
    <AuthProvider>
      {children}
    </AuthProvider>
  </TooltipProviderWrapper>
</ThemeProvider>
```

## Accessibility Features

### Keyboard Navigation
- **Tab**: Navigate between help icons
- **Enter/Space**: Open help modal when focused
- **Escape**: Close open modal

### Screen Readers
- Help icons include `aria-label` attributes
- Modal content is properly structured with headings
- Tooltip content is announced on focus

### Mobile Support
- Touch-friendly tap targets (minimum 44×44px)
- Tooltips remain visible on mobile
- Modals are responsive and scrollable

## Performance Considerations

### No Layout Shift
- Help icons are inline-flex to prevent reflow
- Modal is portal-mounted outside document flow
- Tooltip appears without shifting content

### Lazy Loading
- Help content is statically imported (tree-shakeable)
- Modal component only renders when triggered
- External links open in new tabs without navigation

### Caching
- Help content is immutable after build
- Can be cached indefinitely
- No network requests for help data

## Testing

### Demo Page

Visit `/help-demo` to see all help tooltips in action:
- Controller setup forms
- Room management
- Sensor configuration
- Workflow automation
- Advanced features
- Different variants and sizes

### Manual Testing Checklist

- [ ] Hover over help icon shows tooltip
- [ ] Click help icon opens modal
- [ ] Modal shows full description and links
- [ ] External links open in new tab
- [ ] Tab navigation works correctly
- [ ] Enter/Space opens modal when focused
- [ ] Escape closes modal
- [ ] Mobile tap opens modal
- [ ] Tooltip doesn't cause layout shift
- [ ] Icons render correctly with emojis

## Future Enhancements

### Potential Additions
1. **Search functionality** - Search all help content
2. **Recently viewed** - Quick access to recent help topics
3. **Contextual suggestions** - AI-powered help recommendations
4. **Video tutorials** - Embedded help videos in modals
5. **Multi-language** - Internationalization support
6. **Help analytics** - Track which help topics are most viewed
7. **User feedback** - "Was this helpful?" buttons
8. **In-app tours** - Guided walkthroughs using help system

### Extension Points

The help system is designed to be extensible:

```typescript
// Custom help provider
import { getHelpContent, searchHelpContent } from "@/lib/help-content";

// Search for help
const results = searchHelpContent("vpd");

// Get specific help
const help = getHelpContent("vpd-calculation");
```

## Maintenance

### Updating Help Content
1. Edit `/apps/web/src/lib/help-content.ts`
2. Add/modify entries in `HELP_CONTENT` object
3. No component changes needed
4. Changes take effect immediately

### Adding New Help Topics
1. Add entry to `HELP_CONTENT` in `help-content.ts`
2. Use `<HelpTooltip id="your-new-id" />` in components
3. Test tooltip and modal display
4. Update this documentation

### Deprecating Help Topics
1. Remove from `HELP_CONTENT` (don't reuse IDs)
2. Update components to remove `<HelpTooltip>` usage
3. Check for any custom content overrides

## Best Practices

### Content Writing
- **Tooltip (shortDescription)**: 1-2 sentences, < 120 chars
- **Modal (description)**: 2-4 sentences, detailed but concise
- **Links**: Only include highly relevant external docs
- **Icons**: Use recognizable emojis that enhance scanning

### Component Integration
- Place `<HelpTooltip>` immediately after label text
- Use `className="flex items-center"` on label for alignment
- Prefer registry over custom content for consistency
- Use `InlineHelp` for non-modal supplementary text

### Performance
- Don't create help tooltips in loops
- Reuse help IDs across similar fields
- Keep help content text-based (no heavy images)

## Troubleshooting

### Tooltip Not Appearing
- Ensure `TooltipProviderWrapper` is in root layout
- Check that help ID exists in registry
- Verify Radix UI tooltip package is installed

### Modal Not Opening
- Check `showModal={true}` prop (default)
- Ensure Dialog component is imported correctly
- Verify click handler isn't being prevented

### Content Not Found
- Check help ID spelling matches registry
- Confirm `help-content.ts` is properly imported
- Look for console warnings about missing content

### Keyboard Navigation Issues
- Verify `tabIndex={0}` on trigger element
- Check that parent elements aren't capturing events
- Ensure modal is properly portal-mounted

## Related Documentation
- [Radix UI Tooltip Docs](https://www.radix-ui.com/docs/primitives/components/tooltip)
- [Radix UI Dialog Docs](https://www.radix-ui.com/docs/primitives/components/dialog)
- [WCAG 2.1 Tooltip Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html)
