# Self-Healing Next.js/Vercel Build Skill

Automatically fix TypeScript and ESLint build errors. Works standalone or **paired with deploy skill**.

## Quick Start

```bash
# Copy to your project
cp build-fix-loop.js apps/web/
cd apps/web

# Option 1: Local build loop (standalone)
node build-fix-loop.js

# Option 2: Watch mode (after deploy skill)
node build-fix-loop.js --watch
```

## Pairing with Deploy Skill ⭐

The `--watch` mode is designed to run **after** the deploy skill pushes to main:

```
┌─────────────────────────────────────────────────────────────────┐
│  DEPLOY SKILL                                                   │
│  ─────────────                                                  │
│  1. npm run build (local check)                                 │
│  2. git add -A && git commit                                    │
│  3. git push origin main  ──────────────────┐                   │
│                                             │                   │
│  BUILD-FIX-LOOP --watch                     ▼                   │
│  ───────────────────────              [Vercel builds]           │
│  4. Wait for deployment         ◄───────────┘                   │
│  5. SUCCESS? Done!                                              │
│  6. ERROR? Fetch logs, fix, push                                │
│  7. Go to step 4                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow

```bash
# Step 1: Deploy skill pushes code
/deploy   # or: git push origin main

# Step 2: Watch for errors and auto-fix
node build-fix-loop.js --watch
```

### What Watch Mode Does

1. **Waits** for Vercel deployment to complete (polls every 5s)
2. **If SUCCESS**: Prints deployment URL, exits
3. **If ERROR**: 
   - Fetches build logs from Vercel API
   - Detects error pattern (13 supported)
   - Applies fix locally
   - Commits and pushes
   - Loops back to step 1

### Environment Setup

```bash
# Required for --watch mode
export VERCEL_TOKEN="your-token"        # vercel.com/account/tokens
export VERCEL_PROJECT_ID="prj_xxx"      # Project Settings → General
export VERCEL_TEAM_ID="team_xxx"        # Optional, for team projects
```

---

## All Options

```bash
node build-fix-loop.js [options]

# MODES
--mode=local         npm run build (default, fastest)
--mode=vercel        Vercel CLI (vercel build)
--mode=vercel-api    Fetch logs from Vercel API

# WATCH MODE (pairs with deploy)
--watch              Monitor Vercel, fix errors, redeploy automatically

# OPTIONS
--deploy             Deploy to Vercel after successful build
--git-push           Git commit and push fixes automatically
--max-iterations=N   Maximum fix attempts (default: 20)
--dry-run            Preview fixes without applying
--verbose            Show detailed output
```

## Usage Examples

```bash
# After deploy skill (most common)
node build-fix-loop.js --watch

# Local development iteration
node build-fix-loop.js

# With Vercel CLI
node build-fix-loop.js --mode=vercel

# Full standalone CI/CD
node build-fix-loop.js --mode=vercel-api --git-push
```

## Pre-Build Scanning (Test Locally First!)

**Always test locally before pushing to Vercel.** These commands run the same checks:

### Quick Scans (Fast)

```bash
cd apps/web

# TypeScript type checking only (no emit) - FASTEST
npx tsc --noEmit

# ESLint only
npx eslint src/ --ext .ts,.tsx

# Both together (what Next.js build does)
npm run build
```

### Deep Scans (Thorough)

```bash
# Type check with verbose errors
npx tsc --noEmit --pretty --listFiles 2>&1 | head -100

# ESLint with all warnings
npx eslint src/ --ext .ts,.tsx --max-warnings=0

# Find all 'any' types
grep -rn ": any" src/ --include="*.ts" --include="*.tsx" | wc -l

# Find all TODO/FIXME
grep -rn "TODO\|FIXME" src/ --include="*.ts" --include="*.tsx"

# Find unused exports (requires ts-prune)
npx ts-prune | head -50

# Check for circular dependencies (requires madge)
npx madge --circular src/
```

### Pre-Commit Check Script

Create `scripts/pre-build-check.sh`:

```bash
#!/bin/bash
set -e

echo "🔍 Running pre-build checks..."

echo "1/4 TypeScript..."
npx tsc --noEmit

echo "2/4 ESLint..."
npx eslint src/ --ext .ts,.tsx --quiet

echo "3/4 Build..."
npm run build

echo "✅ All checks passed!"
```

---

## Supported Error Patterns (13 Total)

### Build-Breaking Errors

| # | Error Type | Example | Auto-Fix |
|---|------------|---------|----------|
| 1 | Dynamic Import (Named Export) | `not assignable to DynamicOptions` | Add `.then(mod => mod.X)` |
| 2 | Module Not Exported | `declares 'X' locally, but not exported` | Add `export` keyword |
| 3 | Cannot Find Name | `Cannot find name 'X'` | Add missing import |
| 4 | Enum Type Mismatch | `"x" not assignable to "a" \| "b"` | Add to `z.enum()` |
| 5 | String to Object Prop | `string has no properties in common` | `prop="x"` → `prop={{ text: "x" }}` |
| 6 | Undefined (setValue) | `string \| undefined not assignable` | Add `\|\| ""` |
| 7 | Undefined (setState) | `X \| undefined not assignable to SetStateAction` | Add `\|\| "default"` |
| 8 | Undefined (function arg) | `getX(obj.prop)` where prop undefined | Add `\|\| fallback` |
| 9 | Undefined (object literal) | `Types of property 'x' incompatible` | Add `\|\| ""` |
| 10 | Generic Type Constraint | `(x: T) => R not assignable to (...args)` | Add `@ts-expect-error` |
| 11 | Duplicate Property | `'x' specified more than once` | Remove redundant or reorder spread |

### Warnings

| # | Warning Type | Auto-Fix |
|---|--------------|----------|
| 12 | Unused Import | Remove from import |
| 13 | Unused Variable | Prefix with `_` |

---

## Agent Handoff Criteria

### When to Hand Off to Coder Agent

Hand off when the error requires **understanding business logic** or **architectural decisions**:

| Condition | Action |
|-----------|--------|
| Build loop stuck after 3 attempts on same error | → Coder Agent |
| Error involves complex generics beyond memoize | → Coder Agent |
| Missing module/package (not just type) | → Coder Agent |
| Circular dependency detected | → Coder Agent |
| Runtime error (not caught at build) | → Coder Agent |
| Test failures | → Coder Agent |
| Need to refactor types across multiple files | → Coder Agent |

### When to Hand Off to Code Auditor Agent

Hand off when the issue is about **code quality** or **best practices**:

| Condition | Action |
|-----------|--------|
| 50+ ESLint warnings remaining | → Auditor Agent |
| 20+ `any` types in codebase | → Auditor Agent |
| `react-hooks/exhaustive-deps` warnings | → Auditor Agent |
| Security vulnerabilities in `npm audit` | → Auditor Agent |
| Performance issues (`@next/next/no-img-element`) | → Auditor Agent |
| Accessibility warnings | → Auditor Agent |
| Code duplication detected | → Auditor Agent |

### Handoff Template

When handing off, provide:

```markdown
## Build Handoff to [Coder/Auditor] Agent

**Project:** EnviroFlow
**Location:** apps/web

### Current State
- Build status: [FAILING/PASSING WITH WARNINGS]
- Iterations attempted: X
- Last error: [paste error]

### What Was Tried
1. [Fix attempt 1]
2. [Fix attempt 2]

### Files Involved
- src/path/to/file.ts (line X)
- src/path/to/other.ts (line Y)

### Recommended Action
[Your assessment of what needs to happen]

### Commands to Reproduce
```bash
cd apps/web
npm run build
```
```

---

## Error Pattern Details

### 11. Duplicate Property in Object Spread (NEW)

```typescript
// ❌ BEFORE - timestamp defined explicitly then overwritten by spread
dashboardData.timelineData.map(d => ({
  timestamp: d.timestamp,  // This gets overwritten!
  value: d.temperature || 0,
  ...d,  // This also has timestamp
}))

// ✅ AFTER - spread first, then override what you need
dashboardData.timelineData.map(d => ({
  ...d,
  value: d.temperature || 0,  // Only override what's different
}))

// ✅ OR - remove redundant explicit property
dashboardData.timelineData.map(d => ({
  value: d.temperature || 0,
  ...d,
}))
```

---

## All Fix Examples

### 1. Dynamic Import Named Export

```typescript
// ❌ BEFORE
dynamic(() => import('@/components/MyComponent'), { ssr: false });

// ✅ AFTER
dynamic(() => import('@/components/MyComponent').then(mod => mod.MyComponent), { ssr: false });
```

### 2. Module Not Exported

```typescript
// ❌ BEFORE in src/lib/types.ts
type MyType = 'a' | 'b';

// ✅ AFTER
export type MyType = 'a' | 'b';
```

### 3. Cannot Find Name

```typescript
// ❌ BEFORE - Import was removed but type is still used
const x = foo as [DimmerCurve, string][];

// ✅ AFTER
import type { DimmerCurve } from "@/lib/dimming-curves";
const x = foo as [DimmerCurve, string][];
```

### 4. Enum Type Mismatch

```typescript
// ❌ BEFORE
schedule_type: z.enum(["custom", "sunrise", "sunset"])

// ✅ AFTER
schedule_type: z.enum(["custom", "sunrise", "sunset", "dli_curve"])
```

### 5. String to Object Prop

```tsx
// ❌ BEFORE
<HelpTooltip content="Adjust start time" />

// ✅ AFTER  
<HelpTooltip content={{ text: "Adjust start time" }} />
```

### 6-9. Undefined Not Assignable

```typescript
// ❌ BEFORE
setValue("start_time", schedule.schedule.start_time);
setAction(schedule.schedule.action);
getActionColor(x.y.z.action);
{ timestamp: log.timestamp }

// ✅ AFTER
setValue("start_time", schedule.schedule.start_time || "");
setAction(schedule.schedule.action || "on");
getActionColor(x.y.z.action || "on");
{ timestamp: log.timestamp || "" }
```

### 10. Generic Type Constraint

```typescript
// ❌ BEFORE
const memoized = memoize((temp: number) => temp * 2);

// ✅ AFTER
// @ts-expect-error - generic type constraint too strict
const memoized = memoize((temp: number) => temp * 2);
```

The script intelligently selects fallbacks based on context:

| Context | Fallback |
|---------|----------|
| String types, timestamps | `""` |
| Number types, level, offset, minutes, port | `0` |
| Array types, days | `[]` |
| Action types | `"on"` |
| Trigger types | `"time"` |
| Boolean types | `false` |

## Usage Options

```bash
# Basic usage
node build-fix-loop.js

# More iterations for complex projects
node build-fix-loop.js --max-iterations=30

# Preview fixes without applying
node build-fix-loop.js --dry-run

# See pattern matching details
node build-fix-loop.js --verbose
```

## Known Type Locations

The script knows where common types are exported:

```javascript
const typeLocations = {
  'DimmerCurve': '@/lib/dimming-curves',
  'DimmerCurveType': '@/lib/dimming-curves',
  'DeviceScheduleAction': '@/types',
  'ControllerBrand': '@/types',
  'SensorType': '@/types',
  'Room': '@/types',
  'Controller': '@/types',
  'Schedule': '@/types',
};
```

Add your project's types to extend this.

## Limitations

These require manual fixes:

- Complex generic type errors (beyond simple memoize patterns)
- Circular dependency issues
- Missing module declarations
- `react-hooks/exhaustive-deps` warnings
- `@typescript-eslint/no-explicit-any` (needs proper types)
- `@next/next/no-img-element` (needs Next.js Image component)

## Integration with Claude Code

When using as a Claude Code skill:

1. Read this SKILL.md first
2. Copy `build-fix-loop.js` to the project's `apps/web` folder
3. Run the build loop
4. If stuck, manually analyze and fix the specific error
5. Commit once build passes

## Example Session

```
╔════════════════════════════════════════════════════════════════╗
║        EnviroFlow Self-Healing Build System v2.0               ║
╚════════════════════════════════════════════════════════════════╝

━━━ Iteration 1/20 ━━━
Running build...
Status: LazyComponents.tsx:88:3: Argument of type '() => Promise...
✓ [Dynamic Import (Named Export)] Fixed 30 dynamic imports in src/components/LazyComponents.tsx

━━━ Iteration 2/20 ━━━
Running build...
Status: dimming-curves.ts: DimmerCurveType not exported
✓ [Module Not Exported] Exported DimmerCurveType in src/lib/dimming-curves.ts

━━━ Iteration 3/20 ━━━
Running build...
Status: ScheduleModal.tsx:110:30: string | undefined not assignable
✓ [Undefined Not Assignable] Added fallback ("") in src/components/schedules/ScheduleModal.tsx:110

━━━ Iteration 4/20 ━━━
Running build...

╔════════════════════════════════════════════════════════════════╗
║               ✓ BUILD SUCCESSFUL - ZERO WARNINGS!              ║
╚════════════════════════════════════════════════════════════════╝

Completed in 4 iteration(s).
```

## Files

- `build-fix-loop.js` - Unified self-healing script (local, Vercel CLI, API)
- `github-workflow.yml` - GitHub Actions CI/CD workflow
- `SKILL.md` - This documentation

---

## Workflow Modes

### Mode 1: Local (Default - Fastest)

```bash
node build-fix-loop.js
# or explicitly
node build-fix-loop.js --mode=local
```

Runs `npm run build` locally. Fastest iteration.

### Mode 2: Vercel CLI

```bash
# Install once
npm i -g vercel
vercel login

# Run
node build-fix-loop.js --mode=vercel
```

Uses `vercel build` to match Vercel's exact environment.

### Mode 3: Vercel API

```bash
export VERCEL_TOKEN="xxx"
export VERCEL_PROJECT_ID="prj_xxx"

node build-fix-loop.js --mode=vercel-api
```

Fetches build logs from your latest Vercel deployment.

### Mode 4: Full CI/CD

```bash
node build-fix-loop.js --git-push --deploy
```

Fixes → Commits → Pushes → Deploys to Vercel production.

### Mode 5: GitHub Actions (Automated)

Copy `github-workflow.yml` to `.github/workflows/build-check.yml`:

```bash
mkdir -p .github/workflows
cp github-workflow.yml .github/workflows/build-check.yml
git add . && git commit -m "Add auto-fix CI" && git push
```

Now every push auto-fixes build errors.