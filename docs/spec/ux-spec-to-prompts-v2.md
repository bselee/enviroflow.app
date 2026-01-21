---
description: Transform UX specifications into build-order prompts for UI generation tools. Optimized for MuRP procurement workflows with autonomy-aware sequencing and procurement-specific component patterns.
---

# UX Spec to Build-Order Prompts (Procurement Edition)

## Overview

Transform detailed UX specifications into a sequence of self-contained prompts optimized for UI generation tools. Each prompt builds one discrete feature/view with full context included.

**Procurement principle:** Build order depends on autonomy level. User-driven features (L1-L3) build from inputs → outputs. Monitoring features (L4-L7) build from activity feeds → intervention controls.

## When to Use

- User has a UX spec from `prd-to-ux` skill or similar detailed documentation
- Output needs to feed into UI generation tools (v0, Bolt, Claude frontend-design, Google Stitch)
- User wants build-order sequencing (foundations → features → polish)
- Large specs that would overwhelm a single prompt

**Not for:** Quick component requests, already-atomic features, specs that fit in one prompt.

## Core Pattern

```
UX Spec → Identify Autonomy Level → Extract Atomic Units → Sequence by Dependencies → Generate Self-Contained Prompts
```

---

## Build Order Strategy

### Standard Build Order (All Features)

```
1. Foundation (tokens, types, base styles)
    ↓
2. Layout Shell (page structure, navigation)
    ↓
3. Core Components (primary UI elements)
    ↓
4. Interactions (user actions, system responses)
    ↓
5. States & Feedback (empty, loading, error, success)
    ↓
6. Polish (animations, responsive, edge cases)
```

### Autonomy-Adjusted Build Order

**The autonomy level from the UX spec determines which components are "core" vs "supporting":**

| Autonomy Level | Core Components (Build First) | Supporting Components |
|----------------|------------------------------|----------------------|
| L1 - Detect | Alert cards, notification badges, indicator lights | Drill-down views, history |
| L2 - Analyze | Data tables, charts, metric cards | Filters, export, comparison |
| L3 - Recommend | Recommendation cards, approve/reject/modify controls | Calculation explainers, confidence indicators |
| L4 - Decide | Rule configuration panels, exception queues | Audit logs, rule testing |
| L5 - Execute | Activity feeds, pause/cancel controls, execution status | Rollback UI, intervention confirmations |
| L6 - Confirm | Match/mismatch views, discrepancy resolution UI | Reconciliation history, variance reports |
| L7 - Learn | Performance dashboards, feedback collection, tuning controls | Model comparison, A/B results |

---

## Procurement-Specific Component Library

When extracting atomic units, map UX spec elements to these procurement patterns:

### Entity Display Components

| Component | Use Case | Key States |
|-----------|----------|------------|
| PO Card | Purchase order summary | Draft, Pending, Approved, Sent, Partial, Complete |
| Supplier Badge | Vendor identification | Active, Preferred, On-hold, New |
| SKU Row | Product/item in a list | In-stock, Low, Out, Discontinued |
| Line Item | PO line detail | Pending, Received, Partial, Variance |

### Data Provenance Components

| Component | Use Case | Variants |
|-----------|----------|----------|
| Source Label | Shows where data originated | Shopify, Finale, Sheets, Manual, Calculated |
| Freshness Indicator | Shows data age | Fresh (green), Stale (yellow), Unavailable (red) |
| Confidence Badge | Shows calculation certainty | High, Medium, Low, Insufficient data |
| Sync Status | Shows integration health | Synced, Syncing, Failed, Pending |

### Action Components

| Component | Use Case | Consequence Level |
|-----------|----------|-------------------|
| Approve Button | Accept recommendation/PO | Consequential |
| Send to Supplier | Transmit PO | Consequential (commits money) |
| Override Control | Change automated decision | Consequential |
| Cancel Action | Stop in-progress action | Destructive |
| Batch Action Bar | Bulk operations | Variable |

### Monitoring Components (L4+ Features)

| Component | Use Case | Key States |
|-----------|----------|------------|
| Activity Feed | Stream of automated actions | Running, Completed, Failed, Paused |
| Intervention Panel | Override automation | Available, Unavailable (window closed) |
| Rule Status Card | Show active automation rules | Active, Paused, Error, Disabled |
| Execution Timeline | Show automation progress | Pending → Executing → Complete/Failed |

### Status & Feedback Components

| Component | Use Case | Procurement States |
|-----------|----------|-------------------|
| Supplier Response Status | Awaiting supplier action | Awaiting, Responded, Overdue, Unresponsive |
| Shipment Tracker | Delivery progress | Ordered, Shipped, In-transit, Delivered, Partial |
| Price Variance Alert | Flag unexpected costs | Within tolerance, Warning, Escalated |
| Stock Level Indicator | Inventory health | Healthy, Low, Critical, Stockout |

---

## Extraction Process

### Step 1: Identify Autonomy Level

Read the UX spec header for:
- `Autonomy Level: L[X] - [Mode]`
- `User role at this level: [Actor/Supervisor/Monitor/etc.]`

This determines build order priorities.

### Step 2: Extract Atomic Units

Read through the spec and categorize:

**From Pass 2 (Information Architecture):**
- Each concept → potential component
- Each group → potential view/panel

**From Pass 3 (Affordances):**
- Each user action → interactive component
- Each system action → status/feedback component

**From Pass 5 (State Design):**
- Each state table → component variants
- Each automation state → monitoring component

**From Pass 6 (Flow Integrity):**
- Each intervention point → override control
- Each re-entry scenario → context restoration UI

### Step 3: Map Dependencies

For each unit, note what it requires:

**Foundation dependencies:**
- "PO Card requires design tokens (colors for states)"
- "Source Label requires data source icon set"

**Component dependencies:**
- "Recommendation Panel requires SKU Row component"
- "Batch Action Bar requires selectable list items"

**Data dependencies:**
- "Inventory Chart requires data from Finale/Shopify"
- "Confidence Badge requires calculation metadata"

### Step 4: Sequence by Dependency + Autonomy

Order prompts so:
1. Dependencies come first
2. Core components for the autonomy level come before supporting
3. User-facing components come before admin/config components

### Step 5: Write Self-Contained Prompts

For each prompt, include all context needed for isolated implementation.

---

## Prompt Structure Template

### Standard Component Prompt

```markdown
## [Component Name]

### Context
[What this component is, where it appears, what autonomy level it supports]

### Requirements
- [Specific dimensions, layout]
- [Content structure]
- [Visual treatment]

### States
- Default: [description]
- [State from spec]: [description]
- [Include ALL states from Pass 5]

### Interactions
- [User interaction]: [Response]
- [Include ALL interactions from Pass 3]

### Data Display (if applicable)
- Source: [Where data comes from]
- Freshness: [How staleness is shown]
- Confidence: [If calculated, how certainty is shown]

### Constraints
- [What NOT to include]
- [Technical constraints]
```

### Procurement-Specific Prompt Additions

**For L4+ Monitoring Components, add:**

```markdown
### Automation Context
- What triggered this: [Rule/threshold/schedule]
- What will happen next: [Next automated action]
- Intervention window: [Time/condition when user can still intervene]

### Override Behavior
- Override available: [Yes/No, under what conditions]
- Override action: [What user does to intervene]
- Override consequence: [What happens to automation]
```

**For Data Provenance Components, add:**

```markdown
### Data Sources
- Primary source: [System name]
- Fallback source: [If primary unavailable]
- Last sync: [How recency is displayed]

### Conflict Handling
- If sources conflict: [How discrepancy is shown]
- Resolution action: [What user can do]
```

**For Batch/Volume Components, add:**

```markdown
### Volume Handling
- Expected count: [Typical number of items]
- Selection behavior: [Single/multi/all]
- Batch actions available: [List]

### Performance Considerations
- Pagination: [Yes/No, strategy]
- Lazy loading: [Yes/No]
- Filter persistence: [Yes/No]
```

---

## Example Transformations

### Example 1: Recommendation Card (L3 Feature)

**From UX Spec (Pass 3 - Affordances):**
```
| Action | Consequence Level | Visual/Interaction Signal |
|--------|-------------------|---------------------------|
| Approve recommendation | Consequential | Primary button + confirmation |
| Modify quantity | Safe | Inline editable field |
| Reject recommendation | Safe | Secondary button, no confirmation |
```

**From UX Spec (Pass 5 - State Design):**
```
| State | User Sees | User Can Do |
|-------|-----------|-------------|
| Pending review | Card with yellow border | Approve/Modify/Reject |
| Approved | Card with green checkmark | Undo (if not yet sent) |
| Rejected | Card grayed out | Restore |
```

**To Prompt:**

```markdown
## Reorder Recommendation Card

### Context
A card displaying a system-generated reorder recommendation for a single SKU.
Part of an L3 (Recommend) feature where users review and approve/reject
suggestions before any PO is created. Appears in a list of recommendations
on the Reorder Dashboard.

### Requirements
- Width: Full width of container (responsive)
- Height: Auto, approximately 120px
- Layout: 
  - Left: SKU thumbnail (48x48) + SKU name + supplier name
  - Center: Recommended quantity (large, editable) + calculation summary
  - Right: Action buttons stacked vertically

### Content
- SKU thumbnail: Product image or placeholder
- SKU name: Primary text, truncate with ellipsis if >30 chars
- Supplier: Secondary text, muted color
- Recommended qty: Large number, editable input field
- Calculation summary: "Based on 90-day velocity + 14-day lead time"
- Confidence indicator: High/Medium/Low badge

### States
- Pending review: Yellow left border, white background
- Approved: Green left border, subtle green background tint, checkmark icon
- Rejected: Gray left border, muted/grayed content
- Modified: Blue left border (user changed quantity from recommendation)

### Interactions
- Approve button (primary): Opens brief confirmation toast, transitions to Approved state
- Modify quantity: Click on number makes it editable, blur saves
- Reject button (secondary): Immediate transition to Rejected, no confirmation
- Undo (on Approved): Available for 30 seconds or until PO created, reverts to Pending

### Data Display
- Source indicators: Small labels showing "Velocity: Shopify" and "Stock: Finale"
- Freshness: "Updated 2h ago" in muted text
- Confidence: Badge next to recommended quantity

### Constraints
- This is one card component, not the full list
- Do not implement the actual PO creation logic
- Assume quantity validation happens elsewhere (min/max/MOQ)
```

---

### Example 2: Automation Activity Feed (L5 Feature)

**From UX Spec (Pass 5 - State Design, Automation States):**
```
| State | User Sees | User Can Do |
|-------|-----------|-------------|
| Monitoring | "Watching 12 SKUs for reorder" | View rules, pause |
| Triggered | "Reorder triggered for SKU-123" | Review before execution |
| Executing | "Sending PO to supplier..." | Cancel if window open |
| Completed | "PO #456 sent automatically" | View details |
| Failed | "Failed to send: API error" | Retry, manual fallback |
```

**To Prompt:**

```markdown
## Automation Activity Feed

### Context
A real-time feed showing automated procurement actions as they occur.
Part of an L5 (Execute) feature where the system autonomously creates and
sends POs. User role is Monitor—they watch and intervene only when needed.
Appears as a panel on the right side of the Procurement Dashboard.

### Requirements
- Width: 320px fixed (sidebar panel)
- Height: Full viewport height minus header
- Layout: Scrollable list of activity items, newest at top
- Header: "Auto-Procurement Activity" + pause/resume toggle

### Activity Item Structure
- Timestamp: Relative time ("2m ago", "Just now")
- Icon: Status-specific (eye for monitoring, lightning for triggered, spinner for executing, check for completed, X for failed)
- Title: Brief action description
- Detail: Expandable additional info
- Action button: Context-dependent (View, Cancel, Retry)

### States (per activity item)
- Monitoring: Blue icon, muted text, no action button
- Triggered: Yellow icon, "Review" button available
- Executing: Animated spinner icon, "Cancel" button (if window open)
- Completed: Green check icon, "View PO" link
- Failed: Red X icon, "Retry" and "Manual" buttons
- Paused (system-wide): All items show paused indicator, "Resume" in header

### Interactions
- Pause toggle: Pauses all automation, shows confirmation
- Expand item: Shows full details (PO number, supplier, amounts)
- Cancel (during Executing): Confirmation modal, attempts to halt
- Retry (on Failed): Re-attempts the action
- Manual fallback: Opens manual PO creation with pre-filled data

### Automation Context
- Shows intervention window: "Cancel available for 30 more seconds"
- Shows trigger reason: "Triggered by: Stock below reorder point"
- Shows next action: "Next: Will auto-send in 5 minutes unless paused"

### Override Behavior
- Cancel available during: Executing state, first 60 seconds
- Cancel action: Click button → confirmation → system attempts halt
- Cancel consequence: PO not sent, item moves to "Cancelled" state

### Constraints
- Feed component only, not the full dashboard
- Assume WebSocket/polling provides real-time updates
- Do not implement actual automation logic
- Maximum 50 items in feed (older items paginate)
```

---

### Example 3: Data Conflict Resolution Modal

**From UX Spec (Pass 2 - Cross-source relationships):**
```
| Relationship | Sources Involved | Conflict Potential |
|--------------|------------------|-------------------|
| Available inventory | Finale + Shopify | High - sync lag possible |
```

**To Prompt:**

```markdown
## Inventory Conflict Resolution Modal

### Context
A modal that appears when Shopify and Finale report different inventory
counts for the same SKU. Part of data integrity handling across MuRP's
multi-source architecture. User must resolve before proceeding with
reorder calculations.

### Requirements
- Width: 480px
- Layout: Modal with backdrop
- Structure:
  - Header: "Inventory Discrepancy Detected"
  - Body: Side-by-side comparison + resolution options
  - Footer: Action buttons

### Content
- SKU identifier: Name + thumbnail
- Shopify count: Large number + "Sales system" label + last sync time
- Finale count: Large number + "Warehouse system" label + last sync time
- Difference: Calculated, highlighted if significant
- Suggested resolution: System recommendation with rationale

### Resolution Options (radio buttons)
- Use Shopify count: "Trust sales data (Finale may lag)"
- Use Finale count: "Trust warehouse data (Shopify is just a channel)"
- Use lower count: "Conservative approach (prevents overselling)"
- Enter manual count: Text input for override
- Investigate later: "Skip this SKU, flag for review"

### States
- Default: No option selected, "Resolve" button disabled
- Option selected: "Resolve" button enabled
- Resolving: Button shows spinner
- Resolved: Modal closes, toast confirms

### Interactions
- Select option: Radio button, immediate visual feedback
- Resolve button: Applies selection, closes modal
- Cancel/X: Closes without resolving (SKU remains flagged)
- "Why is this happening?": Expandable explanation of sync timing

### Data Display
- Last sync times: Prominent, color-coded (green if <1h, yellow if 1-24h, red if >24h)
- Source health: Small indicator if either source has recent sync failures

### Constraints
- Modal component only
- Do not implement actual data reconciliation logic
- Assume conflict data is passed as props
```

---

## Output Format

Generate a markdown document with:

```markdown
# Build-Order Prompts: [Project Name]

## Overview
[1-2 sentence summary of what's being built]

## Autonomy Level
[L1-L7] - [Mode]: [Brief description of user role]

## Build Sequence
1. [Prompt name] - [brief description] - [Phase: Foundation/Layout/Core/etc.]
2. [Prompt name] - [brief description] - [Phase]
...

## Component Dependency Map
```
[ASCII or simple diagram showing dependencies]
```

---

## Prompt 1: [Feature Name]
**Phase:** [Foundation/Layout/Core/Interactions/States/Polish]
**Depends on:** [List or "None"]

[Full self-contained prompt]

---

## Prompt 2: [Feature Name]
**Phase:** [Phase]
**Depends on:** [List]

[Full self-contained prompt]

...
```

---

## Quality Checklist

Before finalizing prompts:

- [ ] Autonomy level identified and informs build order
- [ ] Every measurement from spec is captured in a prompt
- [ ] Every state from Pass 5 is captured in a prompt
- [ ] Every interaction from Pass 3 is captured in a prompt
- [ ] Every data source from Pass 2 has provenance UI
- [ ] No prompt references another prompt ("see previous")
- [ ] Build order respects dependencies
- [ ] Each prompt could be given to someone with no context
- [ ] Procurement-specific states included (supplier, shipment, etc.)
- [ ] Override/intervention UI included for L4+ features

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Prompts too large (whole spec in one) | Break into atomic features |
| Prompts reference each other | Re-state needed context inline |
| Missing states | Cross-reference spec's Pass 5 state tables |
| Vague measurements ("good spacing") | Use exact values from spec |
| Wrong build order | Check dependency graph + autonomy level |
| Duplicated component definitions | Each component defined once, in first prompt that needs it |
| Missing data provenance UI | Every data element needs source/freshness treatment |
| No override UI for L4+ features | Monitoring features need intervention controls |
| Ignoring batch/volume patterns | Procurement has high transaction counts |
| Generic states only | Include procurement states (supplier awaiting, partial shipment) |

---

## Integration with Upstream Skills

This skill expects UX specs produced by `prd-to-ux` with these sections:

| UX Spec Section | Maps To |
|-----------------|---------|
| Pass 1 (Mental Model) | Context paragraphs in prompts |
| Pass 2 (Information Architecture) | Component inventory, data sources |
| Pass 3 (Affordances) | Interactions section in prompts |
| Pass 4 (Cognitive Load) | Batch handling, defaults |
| Pass 5 (State Design) | States section in prompts |
| Pass 6 (Flow Integrity) | Override behavior, re-entry handling |
| Visual Specifications | Requirements section in prompts |

If any of these sections are missing from the UX spec, flag before proceeding—the prompts will be incomplete.
