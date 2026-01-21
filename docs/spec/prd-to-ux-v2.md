---
name: prd-to-ux
description: Translate PRDs into UX specifications for procurement systems. Use before creating mockups, wireframes, or component specs. Optimized for MuRP's autonomy-based, multi-source architecture.
---

# PRD to UX Translation (Procurement Edition)

## Overview

Translate product requirements into UX foundations through **6 forced designer mindset passes** + **procurement-specific lenses**. Each pass asks questions that visual-first approaches skip—especially critical for autonomous procurement systems where users shift from "doing" to "monitoring."

**Core principle:** UX foundations come BEFORE visual specifications. Mental models, information architecture, and cognitive load analysis prevent "pretty but unusable" designs.

**Procurement principle:** Autonomy level determines UX posture. A user approving recommendations (L3) needs different UX than a user monitoring autonomous execution (L5).

## When to Use

- Translating PRD/spec to mockup tool input (Google Stitch, Figma, etc.)
- Creating UX specifications from feature requirements
- Preparing design handoff documents
- Before any visual design work

## PRD Prerequisite Check

Before starting, verify the source PRD includes:

| Section | Why It Matters for UX |
|---------|----------------------|
| Section 2.2 - Autonomy Target | Determines user's role (actor vs. monitor) |
| Section 4.2 - Edge Cases | Reveals states beyond happy path |
| Section 7.1 - Data Source Matrix | Informs data provenance UI, freshness indicators |
| Section 8 - Integration Touchpoints | Identifies external system states to surface |

If these sections are missing or vague, flag them before proceeding—they directly impact UX decisions.

## Output Location

**Write the UX specification to a file in the same directory as the source PRD.**

Naming convention:
- If PRD is `feature-auto-reorder.md` → output `feature-auto-reorder-ux-spec.md`
- If PRD is `supplier-portal-prd.md` → output `supplier-portal-prd-ux-spec.md`

Pattern: `{prd-basename}-ux-spec.md`

**Do not output to conversation.** Always write to file so the spec is persistent and can be passed to mockup tools.

---

## The Iron Law

```
NO VISUAL SPECS UNTIL ALL 6 PASSES COMPLETE
```

**Not negotiable:**
- Don't mention colors, typography, or spacing until Pass 6 is done
- Don't describe screen layouts until information architecture is explicit
- Don't design components until affordances are mapped

**No exceptions for urgency:**
- "I'm in a hurry" → Passes take 5 minutes; fixing bad UX takes days
- "Just give me screens" → Screens without foundations need rework
- "Skip the analysis" → Analysis IS the value; screens are just output
- "I know what I want" → Then passes will be fast; still do them
- "It's just a dashboard" → Dashboards have the MOST information architecture complexity

Skipping passes to "save time" produces specs that need redesign. The 6 passes ARE the shortcut.

---

## Autonomy-Level UX Framework

**Before starting passes, identify the PRD's autonomy target.** This fundamentally shapes UX posture:

| Autonomy Level | User Role | UX Posture | Primary Pattern |
|----------------|-----------|------------|-----------------|
| L1 - Detect | Actor | Notification consumer | Alerts, badges, indicators |
| L2 - Analyze | Actor | Data interpreter | Charts, tables, drill-downs |
| L3 - Recommend | Decision-maker | Recommendation reviewer | Cards with approve/reject/modify |
| L4 - Decide | Supervisor | Rule configurator + exception handler | Settings panels, exception queues |
| L5 - Execute | Monitor | Execution auditor + intervener | Activity feeds, pause/cancel controls |
| L6 - Confirm | Auditor | Reconciliation reviewer | Match/mismatch views, discrepancy resolution |
| L7 - Learn | Overseer | Model performance reviewer | Metrics dashboards, feedback loops |

**Key UX shifts by autonomy level:**

- **L1-L3 (User as Actor):** User initiates, system responds. UX emphasizes input controls, clear feedback.
- **L4-L5 (User as Supervisor):** System acts within rules, user monitors and intervenes. UX emphasizes activity visibility, override controls, confidence indicators.
- **L6-L7 (User as Overseer):** System self-corrects, user audits performance. UX emphasizes trends, anomalies, tuning controls.

---

## The 6 Passes

Execute these IN ORDER. Each pass produces required outputs before the next begins.

```
Pass 1 (Mental Model) 
    ↓
Pass 2 (Information Architecture) 
    ↓
Pass 3 (Affordances) 
    ↓
Pass 4 (Cognitive Load) 
    ↓
Pass 5 (State Design) 
    ↓
Pass 6 (Flow Integrity) 
    ↓
THEN: Visual Specifications
```

---

### Pass 1: User Intent & Mental Model Alignment

**Designer mindset:** "What does the user think is happening?"

**Procurement-specific considerations:**
- Procurement users have strong existing mental models from ERP/spreadsheet workflows
- Autonomy features can violate expectations ("Wait, it sent the PO without asking me?")
- Multi-source data creates confusion ("Which number is right?")

**Force these questions:**
- What does the user believe this system does?
- What are they trying to accomplish in one sentence?
- What wrong mental models are likely?
- **How does the autonomy level affect their sense of control?**
- **What existing tool behavior might they expect (Excel, ERP, email)?**

**Procurement mental model pitfalls:**
| Pitfall | Example | UX Mitigation |
|---------|---------|---------------|
| Automation anxiety | "Will it order without my approval?" | Explicit control boundaries |
| Data trust issues | "Is this inventory count current?" | Freshness indicators, source labels |
| Process ownership confusion | "Who's responsible if this goes wrong?" | Clear accountability in UI |
| Approval fatigue | "I just click approve on everything" | Batch actions, smart defaults |

**Required output:**
```markdown
## Pass 1: Mental Model

**Autonomy level:** L[X] - [Mode]
**User role at this level:** [Actor / Decision-maker / Supervisor / Monitor / Auditor / Overseer]

**Primary user intent:** [One sentence]

**Existing mental model (from current tools):**
- [What they expect based on Excel/ERP/email workflows]

**Likely misconceptions:**
- [Misconception 1]
- [Misconception 2]

**Autonomy-specific concerns:**
- [What might make them uncomfortable about the automation level?]

**UX principle to reinforce/correct:** [Specific principle]
```

---

### Pass 2: Information Architecture

**Designer mindset:** "What exists, and how is it organized?"

**Procurement-specific considerations:**
- Procurement has natural hierarchies: Supplier → PO → Line Item → Receipt → Invoice
- Data comes from multiple sources with different refresh rates
- Users need to understand data provenance to trust the system

**Force these actions:**
1. Enumerate ALL concepts the user will encounter
2. Group into logical buckets (use procurement-native groupings)
3. Classify each as: Primary / Secondary / Hidden (progressive)
4. **Map data source for each concept**
5. **Identify cross-source relationships**

**Procurement concept categories:**
- **Entities:** Suppliers, Products/SKUs, Purchase Orders, Line Items, Receipts, Invoices
- **Metrics:** Inventory levels, Reorder points, Lead times, Costs, Velocity
- **Actions:** Create PO, Approve, Send, Receive, Reconcile
- **Statuses:** Draft, Pending approval, Sent, Acknowledged, Shipped, Partial, Complete, Closed
- **System outputs:** Recommendations, Alerts, Forecasts, Reports

**Required output:**
```markdown
## Pass 2: Information Architecture

**All user-visible concepts:**
| Concept | Category | Data Source | Refresh Rate |
|---------|----------|-------------|--------------|
| [Concept] | Entity/Metric/Action/Status/Output | [Shopify/Finale/Sheets/Calculated] | [Real-time/Hourly/Daily/On-demand] |

**Grouped structure:**

### [Group Name] (e.g., "Purchase Order Management")
| Concept | Visibility | Rationale |
|---------|------------|-----------|
| [Concept] | Primary/Secondary/Hidden | [Why this visibility level] |

### [Group Name] (e.g., "Inventory Intelligence")
...

**Cross-source relationships:**
| Relationship | Sources Involved | Conflict Potential |
|--------------|------------------|-------------------|
| [e.g., "Available inventory"] | [Finale + Shopify] | [High - sync lag possible] |

**Data provenance decisions:**
- Show source label: [List concepts]
- Show last-updated timestamp: [List concepts]
- Show confidence indicator: [List concepts]
```

**This is where most AI UX attempts fail.** If you skip explicit IA, your visual specs will be disorganized—especially with multi-source data.

---

### Pass 3: Affordances & Action Clarity

**Designer mindset:** "What actions are obvious without explanation?"

**Procurement-specific considerations:**
- Procurement actions have consequences (sending a PO commits money)
- Some actions are reversible, some aren't—this must be visually clear
- Automation actions need different affordances than manual actions

**Force explicit decisions:**
- What is clickable?
- What looks editable?
- What looks like output (read-only)?
- What looks final vs in-progress?
- **What looks like user action vs system action?**
- **What looks reversible vs committed?**

**Procurement affordance patterns:**
| Action Type | Affordance Signal | Example |
|-------------|-------------------|---------|
| Safe/reversible | Standard button | "Save draft" |
| Consequential | Emphasized button + confirmation | "Send to supplier" |
| Destructive | Warning styling + confirmation | "Cancel PO" |
| System-initiated | Different visual treatment | "Auto-approved (rule: <$500)" |
| Override | Clearly labeled intervention | "Override recommendation" |
| Batch | Selection + bulk action bar | "Approve selected (5)" |

**Required output:**
```markdown
## Pass 3: Affordances

### User Actions
| Action | Consequence Level | Visual/Interaction Signal |
|--------|-------------------|---------------------------|
| [Action] | Safe/Consequential/Destructive | [What makes it obvious + appropriate friction] |

### System Actions (for L4+ autonomy)
| System Action | User Visibility | Override Affordance |
|---------------|-----------------|---------------------|
| [Action] | [How user knows it happened] | [How user can intervene] |

**Affordance rules:**
- If user sees X, they should assume Y
- System-initiated actions are visually distinct from user-initiated
- Consequential actions require [confirmation pattern]
- ...

**Reversibility signals:**
| State | Reversible? | Signal |
|-------|-------------|--------|
| Draft PO | Yes | [No warning needed] |
| Sent to supplier | Partial | [Cancel button + consequences explained] |
| Supplier confirmed | No | [No cancel option; shows "committed" state] |
```

---

### Pass 4: Cognitive Load & Decision Minimization

**Designer mindset:** "Where will the user hesitate?"

**Procurement-specific considerations:**
- Procurement users handle high transaction volumes (hundreds of POs/month)
- Decision fatigue is real—especially for approvals
- Multi-source data increases uncertainty
- Autonomous recommendations add "should I trust this?" decisions

**Force identification of:**
- Moments of choice (decisions required)
- Moments of uncertainty (unclear what to do)
- Moments of waiting (system processing)
- **Moments of trust (should I accept the recommendation?)**
- **Moments of volume (too many items to review individually)**

**Procurement cognitive load patterns:**
| Load Type | Procurement Example | Simplification Strategy |
|-----------|---------------------|------------------------|
| Decision fatigue | Approving 50 POs | Batch approve, exception-only review |
| Data overload | 6 columns of numbers | Progressive disclosure, key metrics first |
| Trust uncertainty | "Is this reorder quantity right?" | Show calculation logic, confidence score |
| Source confusion | "Which inventory is correct?" | Clear source labels, conflict resolution UI |
| Approval fatigue | Rubber-stamping everything | Smart defaults, "approve all standard" option |

**Required output:**
```markdown
## Pass 4: Cognitive Load

**Volume context:** [Expected transaction volume, e.g., "~200 POs/month, ~15 requiring attention"]

**Friction points:**
| Moment | Type | Location | Simplification |
|--------|------|----------|----------------|
| [When] | Choice/Uncertainty/Waiting/Trust/Volume | [Where in flow] | [Reduction strategy] |

**Defaults introduced:**
| Default | Rationale | Override Visibility |
|---------|-----------|---------------------|
| [Default 1] | [Why this is safe] | [How user changes it] |

**Batch handling strategy:**
- Review individually: [Which items]
- Review by exception: [Which items]
- Auto-process: [Which items, with what guardrails]

**Trust-building elements:**
| Recommendation Type | Trust Signal |
|--------------------|--------------|
| [e.g., Reorder quantity] | [e.g., "Based on 90-day velocity + 14-day lead time"] |
```

---

### Pass 5: State Design & Feedback

**Designer mindset:** "How does the system talk back?"

**Procurement-specific considerations:**
- Procurement involves external parties (suppliers) with their own timelines
- Multi-source systems have sync states to communicate
- Autonomous systems need to show what they're doing and why

**Procurement-specific states to consider:**

| State Category | States |
|----------------|--------|
| Data states | Empty, Loading, Loaded, Stale, Conflicting, Sync-in-progress |
| PO states | Draft, Pending approval, Approved, Sent, Acknowledged, Shipped, Partial, Complete, Cancelled |
| Supplier states | Awaiting response, Responded, Overdue, Unresponsive |
| Automation states | Monitoring, Triggered, Executing, Completed, Failed, Paused, Overridden |
| Confidence states | High confidence, Low confidence, Needs review, Insufficient data |

**For each major element, answer:**
- What does the user see?
- What do they understand?
- What can they do next?
- **What's the system doing in the background?**
- **When will the state change, and how will they know?**

**Required output:**
```markdown
## Pass 5: State Design

### [Element/Screen]

| State | User Sees | User Understands | User Can Do | Auto-transition? |
|-------|-----------|------------------|-------------|------------------|
| Empty | | | | |
| Loading | | | | |
| Success | | | | |
| Partial | | | | |
| Error | | | | |

### Data Freshness States
| Data Element | Fresh | Stale | Unavailable |
|--------------|-------|-------|-------------|
| [e.g., Inventory count] | [Normal display] | [Warning + timestamp] | [Last known + alert] |

### Supplier Response States (if applicable)
| State | User Sees | Escalation |
|-------|-----------|------------|
| Awaiting (<24h) | | None |
| Awaiting (24-48h) | | [Visual flag] |
| Overdue (>48h) | | [Alert + suggested action] |

### Automation States (for L4+ features)
| State | User Sees | User Can Do |
|-------|-----------|-------------|
| Monitoring | [e.g., "Watching 12 SKUs for reorder"] | [View rules, pause] |
| Triggered | [e.g., "Reorder triggered for SKU-123"] | [Review before execution] |
| Executing | [e.g., "Sending PO to supplier..."] | [Cancel if window open] |
| Completed | [e.g., "PO #456 sent automatically"] | [View details, undo if possible] |
| Failed | [e.g., "Failed to send: supplier API error"] | [Retry, manual fallback] |
| Paused | [e.g., "Auto-ordering paused by user"] | [Resume] |
```

This prevents "dead UX"—screens with no feedback, especially critical for autonomous systems where users need confidence the system is working.

---

### Pass 6: Flow Integrity Check

**Designer mindset:** "Does this feel inevitable?"

**Procurement-specific considerations:**
- Procurement flows often span days/weeks (PO → receipt → invoice)
- Users may return to a flow after interruption
- Autonomous systems need clear intervention points

**Force these checks:**
- Where could users get lost?
- Where would a first-time user fail?
- What must be visible vs can be implied?
- **Where can users intervene in autonomous flows?**
- **What happens when users return after time away?**

**Procurement flow risks:**
| Risk Category | Example | Mitigation Pattern |
|---------------|---------|-------------------|
| Lost context | "What was I doing with this PO?" | Status summary, recent activity |
| Missed intervention window | "It already sent and I wanted to change it" | Clear timing, notifications |
| Unclear next step | "PO is 'sent'—now what?" | Next action prompts |
| Supplier limbo | "No response for 3 days—is this normal?" | Expected timeline, escalation prompts |
| Override confusion | "I changed it but automation changed it back" | Clear override persistence |

**Required output:**
```markdown
## Pass 6: Flow Integrity

**Flow risks:**
| Risk | Where | Mitigation |
|------|-------|------------|
| [Risk] | [Location in flow] | [Guardrail/Nudge/UI element] |

**Intervention points (for L4+ autonomy):**
| Automation Step | Can User Intervene? | How | Window |
|-----------------|---------------------|-----|--------|
| [Step] | Yes/No | [Mechanism] | [Time/condition] |

**Re-entry handling:**
| If User Returns During... | They See... | They Can... |
|---------------------------|-------------|-------------|
| [State] | [Summary/context] | [Resume/modify/cancel] |

**Visibility decisions:**
- Must be visible: [List]
- Can be implied: [List]
- Must be hidden until needed: [List]

**UX constraints for visual phase:**
- [Hard rules that visual design must follow]
```

---

## THEN: Visual Specifications

Only after all 6 passes are complete, create:

### Standard Visual Outputs
- Screen layouts
- Component specifications
- Interaction specifications
- Responsive breakpoints

### Procurement-Specific Visual Outputs
- Data provenance indicators (source labels, timestamps, confidence)
- Automation activity feed design
- Override/intervention control patterns
- Batch action interfaces
- Status timeline visualizations
- Alert/notification hierarchy

### Design System Considerations
- Colors for state indication (not just brand)
- Typography hierarchy for dense data
- Spacing for scannable tables/lists
- Icons for procurement concepts (PO, supplier, shipment, etc.)

The 6 passes inform every visual decision.

---

## Red Flags - STOP and Restart

If you catch yourself doing any of these, STOP and return to the passes:

| Violation | What You're Skipping |
|-----------|---------------------|
| Describing colors/fonts | All foundational passes |
| "The main screen shows..." | Pass 1-2 (mental model, IA) |
| Designing components before actions mapped | Pass 3 (affordances) |
| No friction point analysis | Pass 4 (cognitive load) |
| States only in component specs | Pass 5 (holistic state design) |
| No "where could they fail?" | Pass 6 (flow integrity) |
| "User is in a hurry" | ALL passes—urgency is a trap |
| "Just this once, skip to visuals" | ALL passes—exceptions become habits |
| "The PRD is simple enough" | ALL passes—simple PRDs still need mental model analysis |
| No autonomy level consideration | Procurement flows depend on it |
| Ignoring data source provenance | Multi-source UX will confuse users |
| No supplier/external party states | Procurement involves waiting on others |

---

## Common Mistakes

**Merging passes:** "I'll cover mental model while doing IA" → You won't. Separate passes force separate thinking.

**Skipping to visuals:** "The PRD is clear, I can design screens" → Baseline testing shows agents skip 4+ passes when allowed.

**Implicit affordances:** "Buttons are obviously clickable" → Map EVERY action explicitly. What's obvious to you isn't obvious to users.

**Scattered state design:** "I'll add states to each component" → Holistic state table in Pass 5 catches gaps.

**Ignoring autonomy implications:** "It's just showing data" → L3 recommendation UX is fundamentally different from L5 monitoring UX.

**Underestimating data provenance:** "Users don't care where data comes from" → In procurement, data trust is everything.

**Forgetting external parties:** "User does X, system does Y" → Suppliers, carriers, and other systems have their own timelines.

---

## Output Template

```markdown
# UX Specification: [Feature Name]

**Source PRD:** [filename]
**Autonomy Level:** L[X] - [Mode]
**Primary Data Sources:** [List]

---

## Pass 1: Mental Model
[Required content with autonomy-specific sections]

## Pass 2: Information Architecture
[Required content with data source mapping]

## Pass 3: Affordances
[Required content with system action visibility]

## Pass 4: Cognitive Load
[Required content with volume/trust considerations]

## Pass 5: State Design
[Required content with procurement-specific states]

## Pass 6: Flow Integrity
[Required content with intervention points]

---

## Visual Specifications

### Screen Inventory
[List of screens/views needed]

### Component Specifications
[Component details]

### Data Display Patterns
- Source indicators: [Pattern]
- Freshness indicators: [Pattern]
- Confidence indicators: [Pattern]

### Automation Visibility Patterns
- Activity feed: [Pattern]
- Intervention controls: [Pattern]

### Interaction Specifications
[Interaction details]

### Responsive Considerations
[Breakpoints, mobile adaptations]
```
