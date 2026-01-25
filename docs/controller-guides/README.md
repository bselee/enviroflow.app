# Controller Connection Guides

This directory contains brand-specific connection guides for EnviroFlow controllers. These guides help users troubleshoot connection issues and successfully set up their hardware.

## Purpose

Brand guides provide:

1. **Prerequisites checklist** - What users need before starting
2. **Step-by-step instructions** - How to connect each brand
3. **Common errors and fixes** - Troubleshooting specific to each brand
4. **Best practices** - Tips for optimal setup and operation

## Available Guides

| Brand | File | Status |
|-------|------|--------|
| AC Infinity | `ac_infinity.md` | Available |
| Inkbird | `inkbird.md` | Available (CSV Upload recommended) |
| Ecowitt | `ecowitt.md` | Available |
| CSV Upload | `csv_upload.md` | Available |

## Guide Format

All guides follow this structure:

```markdown
# Brand Name Controller Connection Guide

## Prerequisites
- [ ] Checklist item 1
- [ ] Checklist item 2

## Supported Models
List of supported hardware models

## Step 1: Title
Detailed instructions...

## Step 2: Title
More instructions...

## Common Errors

### "Error message here"

**Cause:** Why this happens

**Fix:**
1. Step to resolve
2. Another step
3. Final step

## Getting Help
Where to get support
```

## How Guides Are Used

### 1. In-App Display

Guides are shown in a modal when users:
- Click "View Connection Guide" in error messages
- Have connection failures during controller setup
- Need help with specific error messages

### 2. Error Guidance Integration

The `error-guidance.ts` system automatically:
- Detects which brand is having issues
- Suggests viewing the brand guide
- Links directly to relevant error sections

### 3. Guide Loading

Guides are loaded from `/public/guides/*.md` and rendered in the `BrandGuideModal` component.

## Editing Guides

### For Non-Developers

1. **Find the guide file** in this directory (`docs/controller-guides/`)
2. **Edit in any text editor** (supports Markdown)
3. **Copy to public folder**: `docs/controller-guides/*.md` → `apps/web/public/guides/`
4. **Test in browser** - changes appear immediately in development

### For Developers

1. Edit guide in `docs/controller-guides/`
2. Copy to `apps/web/public/guides/`
3. Guides are served as static files by Next.js
4. Component auto-loads from `/guides/{brand}.md`

### Markdown Features Supported

- **Headings**: `# H1`, `## H2`, `### H3`
- **Bold**: `**text**`
- **Links**: `[text](url)`
- **Lists**: `- item` or `1. item`
- **Checklists**: `- [ ] item` or `- [x] item`
- **Code blocks**: ` ```code``` `
- **Inline code**: `` `code` ``

## Adding a New Brand Guide

### 1. Create Guide File

Create `docs/controller-guides/new_brand.md`:

```markdown
# New Brand Controller Connection Guide

## Prerequisites
- [ ] Device powered on
- [ ] WiFi connected
- [ ] App installed

## Step 1: Setup
Instructions here...

## Common Errors
### "Connection failed"
**Cause:** Reason
**Fix:** Steps to fix
```

### 2. Copy to Public Folder

```bash
cp docs/controller-guides/new_brand.md apps/web/public/guides/
```

### 3. Register in brand-guides.ts

Edit `apps/web/src/lib/brand-guides.ts`:

```typescript
export const BRAND_GUIDES: Record<string, BrandGuide> = {
  // ... existing brands
  new_brand: {
    brand: "new_brand",
    title: "New Brand Connection Guide",
    description: "How to connect New Brand controllers",
    available: true,
    externalUrl: "https://newbrand.com/support",
  },
}
```

### 4. Test

1. Run dev server: `npm run dev`
2. Try adding a New Brand controller
3. Trigger an error
4. Click "View Connection Guide"
5. Verify guide displays correctly

## Guide Metadata

Each guide is registered in `apps/web/src/lib/brand-guides.ts` with:

```typescript
{
  brand: "brand_id",           // Must match ControllerBrand type
  title: "Display Title",      // Shown in modal header
  description: "Short desc",   // Shown in modal subtitle
  available: true,             // Whether guide exists
  externalUrl: "https://...",  // Link to vendor support (optional)
}
```

## Content Guidelines

### Writing Style

- **Clear and concise** - Use simple language
- **Action-oriented** - Start steps with verbs (Click, Verify, Check)
- **Visual cues** - Use ✅ ❌ for do/don't
- **Examples** - Include real examples of values, commands, etc.

### Structure

1. **Prerequisites** - Always start with checklist
2. **Steps** - Number all major steps
3. **Common Errors** - Cover top 5-10 issues
4. **Getting Help** - Provide escalation path

### Error Sections

Each error should have:
- **Clear error message** - Exact text user sees
- **Cause** - One sentence why it happens
- **Fix** - Numbered steps to resolve (max 5 steps)

### Links

- Use absolute URLs for external links
- Test all links before publishing
- Prefer official documentation over third-party

## Maintenance

### Update Frequency

- **After product changes** - When brand adds features or changes API
- **Based on support tickets** - Add new errors as they're reported
- **Quarterly review** - Check all links and instructions still valid

### Version History

Track major guide updates in the file itself:

```markdown
---
Last Updated: 2024-01-24
Major Changes:
- Added Ecowitt webhook configuration
- Updated AC Infinity WiFi requirements
---
```

## Testing Checklist

Before publishing guide updates:

- [ ] All links work
- [ ] Steps are accurate (test yourself if possible)
- [ ] Markdown renders correctly in modal
- [ ] Table of contents generates properly
- [ ] Prerequisites checklist is complete
- [ ] Common errors cover recent support issues
- [ ] Screenshots (if any) are up to date
- [ ] No typos or grammar errors

## Components Using Guides

### BrandGuideModal

**Location:** `apps/web/src/components/controllers/BrandGuideModal.tsx`

**Features:**
- Loads markdown from `/guides/{brand}.md`
- Renders with syntax highlighting
- Shows table of contents
- Highlights specific errors
- Search within guide

### ErrorGuidance

**Location:** `apps/web/src/components/ui/error-guidance.tsx`

**Integration:**
- Shows "View Connection Guide" button
- Passes brand and error context
- Opens BrandGuideModal on click

### brand-guides.ts

**Location:** `apps/web/src/lib/brand-guides.ts`

**Functions:**
- `loadGuideContent(brand)` - Fetch markdown
- `getPrerequisites(brand)` - Extract checklist
- `getCommonErrors(brand)` - Parse error sections
- `searchGuide(brand, term)` - Find keyword matches

## Future Enhancements

Planned improvements:

- **Video embeds** - Add tutorial videos inline
- **Interactive wizards** - Step-through setup
- **Screenshots** - Visual aids for complex steps
- **Translations** - Multi-language support
- **Community edits** - User-submitted improvements
- **Analytics** - Track which sections are most helpful

## Support

Questions about guides?

- **Technical issues**: Slack #dev-support
- **Content questions**: Product team
- **User feedback**: Customer support tickets

## License

All guides are part of EnviroFlow and follow the main project license.
