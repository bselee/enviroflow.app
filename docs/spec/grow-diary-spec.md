# Grow Diary — Feature Specification

**Status:** In Progress (Phase 3 next) | **Started:** 2026-02-14 | **Last Updated:** 2026-02-14

> Single source of truth for the Grow Diary feature (Web + Mobile).
> Supersedes all prior docs in `docs/spec/grow-diary-feature/`.

---

## 1. Overview

A comprehensive grow-tracking system for EnviroFlow that lets users create **Diary Cycles**, log **Diary Entries** with rich text + photos, capture live sensor snapshots, and review historical environmental data — on the web and via a native iOS/Android app.

**Route:** `/diaries` (standalone page, not on dashboard)
**API:** `/api/diaries`

### Key Features

- **Rich Text Diary** — Tiptap editor with bold, italic, lists, links
- **Dual Photo Views** — Per-entry gallery + dedicated Photos tab for full cycle
- **Stage Progression UX** — Visual progress bar + day counters + transition prompts
- **Sensor Snapshots** — Auto-capture temp, humidity, VPD, CO₂ at entry time
- **Charts Integration** — Existing sensor charts filtered to cycle date range with diary markers
- **Export** — PDF/CSV download with photos and sensor data
- **Mobile** — React Native app with offline-first + camera integration

---

## 2. Data Model

Three PostgreSQL tables. Migration: `supabase/migrations/20260215_002_grow_diary.sql` (done).

### `grow_cycles`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `user_id` | UUID FK → `auth.users` | ON DELETE CASCADE |
| `name` | TEXT | Required, max 100 |
| `description` | TEXT | Optional |
| `started_at` | TIMESTAMPTZ | Default `NOW()` |
| `ended_at` | TIMESTAMPTZ | Set on completion |
| `room_id` | UUID FK → `rooms` | ON DELETE SET NULL |
| `controller_ids` | UUID[] | Controllers assigned |
| `current_stage` | TEXT CHECK | `germination \| seedling \| vegetative \| flowering \| harvest \| cure` |
| `status` | TEXT CHECK | `active \| completed \| archived` |
| `enable_device_logging` | BOOLEAN | Default `true` |
| `enable_sensor_logging` | BOOLEAN | Default `true` |
| `created_at`, `updated_at` | TIMESTAMPTZ | Auto-trigger on update |

### `diary_entries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `cycle_id` | UUID FK → `grow_cycles` | ON DELETE CASCADE |
| `user_id` | UUID FK → `auth.users` | ON DELETE CASCADE |
| `title` | TEXT | Optional (for milestones) |
| `content` | TEXT | Required — stored as **HTML** (Tiptap output) |
| `tags` | TEXT[] | `watering \| feeding \| training \| issue \| milestone \| observation \| harvest` |
| `sensor_snapshot` | JSONB | Immutable: `{ temperature, humidity, vpd, co2, timestamp, controllerId, controllerName }` |
| `entry_date` | TIMESTAMPTZ | Default `NOW()` |
| `created_at`, `updated_at` | TIMESTAMPTZ | Auto-trigger |

### `diary_photos`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `entry_id` | UUID FK → `diary_entries` | ON DELETE CASCADE |
| `storage_path` | TEXT | Supabase Storage path |
| `thumbnail_path` | TEXT | Compressed thumbnail |
| `filename` | TEXT | Original filename |
| `content_type` | TEXT | MIME type |
| `size_bytes` | INTEGER | |
| `width`, `height` | INTEGER | |
| `sort_order` | INTEGER | Default 0 |
| `created_at` | TIMESTAMPTZ | |

### Indexes (done)

`idx_grow_cycles_user`, `idx_grow_cycles_active`, `idx_grow_cycles_room`, `idx_diary_entries_cycle`, `idx_diary_entries_user`, `idx_diary_photos_entry`

### RLS Policies (done)

Per-operation SELECT/INSERT/UPDATE/DELETE policies on all 3 tables. Photos use subquery check against `diary_entries.user_id`.

### TypeScript Types (done)

All in `apps/web/src/types/index.ts` (lines 1660–1866): `DiaryCycleStage`, `DiaryCycleStatus`, `DiaryCycle`, `DiaryCycleWithRoom`, `DiaryCycleWithCounts`, `CreateDiaryCycleInput`, `UpdateDiaryCycleInput`, `DiaryEntryTag`, `SensorSnapshot`, `DiaryEntry`, `DiaryEntryWithPhotos`, `CreateDiaryEntryInput`, `UpdateDiaryEntryInput`, `DiaryPhoto`, `CreateDiaryPhotoInput`, `DiaryCyclesListResponse`, `DiaryEntriesListResponse`

---

## 3. API Endpoints

**Base:** `/api/diaries` (`apps/web/src/app/api/diaries/route.ts`)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/api/diaries` | ✅ Done | List cycles (filters: `status`, `room_id`, `include_counts`) |
| `POST` | `/api/diaries` | ✅ Done | Create cycle (Zod, dup-check, activity log) |
| `GET` | `/api/diaries/[id]` | ✅ Done | Cycle detail |
| `PATCH` | `/api/diaries/[id]` | ✅ Done | Update cycle. Auto-set `ended_at` when status → completed |
| `DELETE` | `/api/diaries/[id]` | ✅ Done | Cascade delete entries/photos + Storage cleanup |
| `GET` | `/api/diaries/[id]/entries` | ✅ Done | List entries with photos |
| `POST` | `/api/diaries/[id]/entries` | ✅ Done | Create entry + optional sensor snapshot |
| `PATCH` | `/api/diaries/[id]/entries/[eid]` | ✅ Done | Update entry |
| `DELETE` | `/api/diaries/[id]/entries/[eid]` | ✅ Done | Delete + cascade photos + Storage |
| `POST` | `.../entries/[eid]/photos` | ⬜ TODO | Upload photo(s) |
| `DELETE` | `.../entries/[eid]/photos/[pid]` | ⬜ TODO | Delete photo + Storage |
| `GET` | `/api/diaries/[id]/export` | ⬜ TODO | Export as PDF/CSV |

### API Conventions

- Bearer token auth via `getUserId()` helper
- Service-role Supabase client (bypasses RLS)
- Zod schemas with `sanitizeName()` / `sanitizeDescription()`
- Errors: `{ error, details }` with appropriate HTTP status
- Activity logging to `activity_logs` after mutations
- Stage changes logged to `activity_logs`
- Photo uploads: multipart/form-data

---

## 4. Supabase Storage (greenfield)

### Setup

1. Create bucket `diary-photos` (private) in Supabase Dashboard
2. Storage RLS: users can upload/read/delete only `{userId}/*`
3. Path: `{userId}/{entryId}/{uuid}.{ext}`
4. Thumbnails: `{userId}/{entryId}/thumb_{uuid}.{ext}`

### Constraints

| Limit | Value |
|-------|-------|
| Max file size | 10 MB per image |
| Max images per entry | 10 |
| Accepted types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Thumbnail | 400×400px, 80% quality JPEG |
| Full-size resize | Max 2048px longest side |

---

## 5. Web UI

### 5.1 Cycles List Page — `/diaries` ✅

```
┌─────────────────────────────────────────────────┐
│ PageHeader: "Diary"             [+ New Cycle]   │
├─────────────────────────────────────────────────┤
│ Filter: [All] [Active] [Completed] [Archived]   │
├─────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Cycle   │ │ Cycle   │ │ Cycle   │            │
│ │ Card    │ │ Card    │ │ Card    │            │
│ └─────────┘ └─────────┘ └─────────┘            │
└─────────────────────────────────────────────────┘
```

**CycleCard contents:**
- Name + status badge (Active / Completed / Archived)
- Current stage pill with icon
- Duration: "Day 45" (active) or "32 days total" (completed)
- Room name (if assigned)
- Entry count + Photo count
- Actions: View, Edit, Archive, Delete

### 5.2 Create/Edit Cycle Dialog

**`CycleFormDialog.tsx`** — modal dialog, not a separate page.

| Field | Type | Notes |
|-------|------|-------|
| Name | Input | Required, max 100 chars |
| Description | Textarea | Optional |
| Start Date | DatePicker | Default: now |
| Room | Select | From user's rooms |
| Controllers | Multi-select checkboxes | From user's controllers |
| Initial Stage | Select | germination → cure |
| Enable device logging | Switch | Default: ON |
| Enable sensor logging | Switch | Default: ON |

### 5.3 Cycle Detail Page — `/diaries/[id]` ✅

```
┌─────────────────────────────────────────────────┐
│ ← Back   "Tomato Spring 2026"  [Active] [Edit]  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │  🌱 SEEDLING         Day 12 of Seedling     │ │
│ │  ━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ │
│ │  Germ → [Seed] → Veg → Flower → Harvest     │ │
│ │                                             │ │
│ │  💡 Typically 14-21 days. Consider moving   │ │
│ │     to Vegetative when 3-4 leaf sets.       │ │
│ │                        [Move to Veg →]      │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ [📔 Diary] [📷 Photos] [📊 Charts] [⚙️ Settings]│
├─────────────────────────────────────────────────┤
│  Tab content here                               │
└─────────────────────────────────────────────────┘
```

**Four tabs:**
1. **📔 Diary** — Timeline of entries
2. **📷 Photos** — Full cycle photo gallery (masonry/grid, filterable by date/tags)
3. **📊 Charts** — Existing sensor charts filtered to cycle date range + diary entry markers
4. **⚙️ Settings** — Logging options, room/controller assignments

### 5.4 Stage Progress Component

**`StageProgress.tsx`** — visual progress bar at top of cycle detail.

| Feature | Detail |
|---------|--------|
| Progress Bar | Clickable stages with current highlighted |
| Day Counter | "Day 12 of Seedling" or "Week 3" |
| Transition Prompts | Smart suggestions based on typical durations |
| Quick Action | Button to advance stage |

**Default Stage Durations:**

| Stage | Typical Duration |
|-------|-----------------|
| Germination | 3–7 days |
| Seedling | 14–21 days |
| Vegetative | 21–60 days |
| Flowering | 45–70 days |
| Harvest | 1–3 days |
| Cure | 14–60 days |

### 5.5 Diary Timeline

```
┌─────────────────────────────────────────────────┐
│ [+ New Entry]                                   │
├─────────────────────────────────────────────────┤
│ ○── Today ────────────────────────────────────  │
│ │  ┌─────────────────────────────────────────┐  │
│ │  │ 🌱 Fed nutrients             2:30 PM    │  │
│ │  │ Added CalMag to feeding schedule...     │  │
│ │  │ [feeding] [observation]                 │  │
│ │  │ 🌡️ 78°F  💧 65%  📊 1.2 kPa             │  │
│ │  │ [📷 📷 📷 +2]                           │  │
│ │  └─────────────────────────────────────────┘  │
│ ○── Feb 12 ───────────────────────────────────  │
│ │  ...                                          │
└─────────────────────────────────────────────────┘
```

**DiaryEntryCard contents:**
- Title (if set) + time
- Rich text content (rendered HTML from Tiptap)
- Color-coded tag badges
- Sensor snapshot: temp, humidity, VPD
- Photo thumbnails inline (max 4 shown, "+X more")

### 5.6 Entry Form Dialog

**`EntryFormDialog.tsx`** — modal dialog.

| Field | Type | Notes |
|-------|------|-------|
| Entry Date/Time | DateTimePicker | Default: now |
| Title | Input | Optional, for milestones |
| Content | **Tiptap Rich Text Editor** | Bold, italic, lists, links, code blocks |
| Tags | Color-coded toggle buttons | Multi-select (see below) |
| Capture Sensor Snapshot | Switch | Default: ON |
| Photos | Upload zone | Drag-drop, multi-select |

**Tag Colors:**

| Tag | Color | Icon |
|-----|-------|------|
| Watering | Blue | 💧 |
| Feeding | Green | 🌱 |
| Training | Yellow | ✂️ |
| Issue | Red | ⚠️ |
| Milestone | Purple | 🎯 |
| Observation | Gray | 👁️ |
| Harvest | Gold | 🌾 |

### 5.7 Tiptap Rich Text Editor

**`RichTextEditor.tsx`**

- Deps: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`
- Static toolbar (Bold, Italic, Lists, Code, Link, Undo, Redo)
- Dark mode compatible styling
- Stores content as HTML in `diary_entries.content`
- Mobile-friendly touch interactions

### 5.8 Photo Components

**Per-Entry (inline in DiaryEntryCard):**
- Thumbnail grid, max 4 shown, "+X more" indicator
- Click to open entry-scoped lightbox

**Photos Tab (CyclePhotosTab — full cycle gallery):**
- Masonry or grid layout of ALL photos across all entries
- Filter by date range or entry tags
- Visual timeline with thumbnails
- Great for comparing growth progress over time

### 5.9 Charts Integration

**`CycleCharts.tsx`** — Charts tab in cycle detail.

- Reuse existing `EnviroSensorChart` and `DeviceWaveformChart`
- Filter by cycle date range (`started_at` → `ended_at` or now)
- Filter by assigned `controller_ids`
- Overlay diary entry markers as vertical lines on timeline
- Click marker → entry detail popover

---

## 6. Integration with Existing Systems

### Device State Logging

Modify `/api/cron/save-history` to:
1. Check if user has active grow cycles with `enable_device_logging: true`
2. If yes, tag device states for assigned controllers with `cycle_id`
3. Store with reference to cycle for easy querying

### Sensor Snapshot Capture

When creating a diary entry with `capture_sensor_snapshot: true`:
1. Call `/api/sensors/live` internally for the cycle's assigned controllers
2. Extract temp, humidity, VPD, CO₂ from response
3. Store as immutable JSONB in `diary_entries.sensor_snapshot`

### User Preferences

- Default `enableDeviceStateLogging: false`
- Auto-enable when creating a grow cycle
- Prompt to disable when completing a cycle

### Account Deletion

Add `grow_cycles`, `diary_entries`, `diary_photos` to cleanup in `/api/account/route.ts`. (CASCADE handles DB, but Storage bucket files need explicit deletion.)

---

## 7. Mobile App

**Status:** Greenfield — no React Native/Expo setup exists.

### Stack

| Layer | Tech |
|-------|------|
| Framework | React Native + Expo (TypeScript) |
| Navigation | React Navigation |
| Camera | `expo-image-picker` + `expo-camera` |
| Offline | `@react-native-async-storage/async-storage` |
| Image resize | `react-native-image-resizer` |
| Push notifications | `expo-notifications` |
| E2E testing | Detox |

### Monorepo Integration

```
apps/
├── web/              # Existing Next.js
├── mobile/           # NEW: React Native + Expo
└── automation-engine/
packages/
└── shared/           # NEW: Shared types + validation schemas
```

### Screens

| Screen | Description |
|--------|-------------|
| Cycles List | Active/completed, pull-to-refresh |
| Cycle Detail | Diary timeline, stage progress, tabs |
| New/Edit Entry | Title, content, tags, camera, sensor capture |
| Photo Viewer | Full-screen swipe gallery |
| Settings | Notifications, sync status |

### Offline-First

- Optimistic writes: create entries locally, queue for sync
- Photos compressed on device, uploaded when online
- Conflict resolution: server timestamp wins, user notified
- Sync badge: 🟢 synced / 🟡 pending / 🔴 offline

### Push Notifications (opt-in)

- Daily diary reminder (configurable time)
- Stage transition suggestions

---

## 8. Scope

### In Scope (v1)

| Feature | Web | Mobile |
|---------|-----|--------|
| Grow cycle CRUD | ✅ | ✅ |
| Diary entry CRUD (rich text) | ✅ Tiptap | ✅ |
| Photo upload (multi) | ✅ Drag-drop | ✅ Camera + gallery |
| Dual photo views | ✅ Per-entry + Photos tab | ✅ Swipe viewer |
| Sensor snapshot capture | ✅ | ✅ (when online) |
| 6-stage tracking + prompts | ✅ Progress bar + transitions | ✅ |
| Color-coded tags | ✅ | ✅ |
| Search & filter | ✅ | ✅ |
| Charts integration | ✅ With diary markers | ❌ |
| PDF/CSV export | ✅ | ❌ |
| Offline mode + sync | ❌ | ✅ |
| Push notifications | ❌ | ✅ |

### Out of Scope (v1)

- Video uploads
- Real-time collaboration / sharing
- ML-powered plant health analysis
- Community diary sharing
- Cycle comparison (side-by-side)

---

## 9. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D01 | Images in Supabase Storage, metadata in DB | Blob storage cheaper/faster |
| D02 | Max 10 photos/entry, 10MB each | Practical for phone camera photos |
| D03 | Sensor snapshot is immutable JSONB | Historical accuracy |
| D04 | `current_stage` is CHECK, not FK to `growth_stages` | Simpler; user-facing labels |
| D05 | RLS: users see only own data | Standard security |
| D06 | Server-side resize (Sharp) + mobile client-side | Quality + bandwidth |
| D07 | Pages: `/diaries`, API: `/api/diaries` | Consistent naming; code uses `DiaryCycle*` types |
| D08 | Dialogs for create/edit (not separate pages) | Stay on page, better UX |
| D09 | Tiptap for rich text, stored as HTML | Richer diary entries |
| D10 | Sensor capture is manual opt-in | Privacy; intentional logging |
| D11 | React Native + Expo for mobile | Single codebase iOS/Android |
| D12 | Offline-first mobile with sync queue | Greenhouses lack Wi-Fi |
| D13 | `packages/shared` for cross-platform code | Types + validation shared |
| D14 | Dual photo views (per-entry + Photos tab) | Per-entry for context, tab for progress review |
| D15 | Charts reuse existing components + diary markers | No new chart library needed |

---

## 10. Task Tracker

### Phase 1: Core Cycles ✅

| # | Task | Status | File |
|---|------|--------|------|
| 1 | DB migration (3 tables + RLS + indexes + triggers) | ✅ Done | `supabase/migrations/20260215_002_grow_diary.sql` |
| 2 | TypeScript types (all `DiaryCycle*` + `DiaryEntry*`) | ✅ Done | `types/index.ts` L1660–1866 |
| 3 | `GET /api/diaries` (list cycles) | ✅ Done | `api/diaries/route.ts` |
| 4 | `POST /api/diaries` (create cycle) | ✅ Done | `api/diaries/route.ts` |
| 5 | `GET /api/diaries/[id]` | ✅ Done | `api/diaries/[id]/route.ts` |
| 6 | `PATCH /api/diaries/[id]` | ✅ Done | Auto-sets `ended_at` on completion |
| 7 | `DELETE /api/diaries/[id]` | ✅ Done | Cascade + Storage cleanup |
| 8 | `useDiaryCycles` hook | ✅ Done | `hooks/use-diary-cycles.ts` |
| 9 | `CycleCard` component | ✅ Done | `components/diary/CycleCard.tsx` |
| 10 | `CycleFormDialog` component | ✅ Done | `components/diary/CycleFormDialog.tsx` |
| 11 | `StageProgress` component | ✅ Done | `components/diary/StageProgress.tsx` |
| 12 | Cycles list page | ✅ Done | `app/diaries/page.tsx` |
| 13 | Cycle detail page (shell + tabs) | ✅ Done | `app/diaries/[id]/page.tsx` |
| 14 | Sidebar nav + middleware | ✅ Done | `AppSidebar.tsx` + `middleware.ts` |

### Phase 2: Diary Entries ✅

| # | Task | Status | File |
|---|------|--------|------|
| 15 | `GET/POST /api/diaries/[id]/entries` | ✅ Done | `api/diaries/[id]/entries/route.ts` |
| 16 | `PATCH/DELETE .../entries/[eid]` | ✅ Done | `api/diaries/[id]/entries/[eid]/route.ts` |
| 17 | Sensor snapshot capture (call `/api/sensors/live`) | ✅ Done | Integrated into POST entries |
| 18 | `useDiaryEntries` hook | ✅ Done | `hooks/use-diary-entries.ts` |
| 19 | Install Tiptap deps | ✅ Done | `@tiptap/react@3.19.0` + starter-kit, link, placeholder |
| 20 | `RichTextEditor` component | ✅ Done | `components/diary/RichTextEditor.tsx` |
| 21 | `TagSelector` component | ✅ Done | `components/diary/TagSelector.tsx` |
| 22 | `DiaryTimeline` component | ✅ Done | `components/diary/DiaryTimeline.tsx` |
| 23 | `DiaryEntryCard` component | ✅ Done | `components/diary/DiaryEntryCard.tsx` |
| 24 | `EntryFormDialog` component | ✅ Done | `components/diary/EntryFormDialog.tsx` |
| 25 | `SensorSnapshotCard` component | ✅ Done | `components/diary/SensorSnapshotCard.tsx` |

### Phase 3: Photos (~10 hrs)

| # | Task | Status | File |
|---|------|--------|------|
| 26 | Supabase Storage bucket + policies | ⬜ TODO | Dashboard config |
| 27 | Photo upload API | ⬜ TODO | `.../photos/route.ts` |
| 28 | Photo delete API | ⬜ TODO | `.../photos/[pid]/route.ts` |
| 29 | `PhotoUpload` component (drag-drop) | ⬜ TODO | `components/diary/PhotoUpload.tsx` |
| 30 | `PhotoGallery` component (lightbox) | ⬜ TODO | `components/diary/PhotoGallery.tsx` |
| 31 | `CyclePhotosTab` (full cycle gallery) | ⬜ TODO | `components/diary/CyclePhotosTab.tsx` |

### Phase 4: Charts + Export + Polish (~8 hrs)

| # | Task | Status | File |
|---|------|--------|------|
| 32 | `CycleCharts` component | ⬜ TODO | `components/diary/CycleCharts.tsx` |
| 33 | Diary markers on chart timeline | ⬜ TODO | |
| 34 | Export API (PDF/CSV) | ⬜ TODO | `api/diaries/[id]/export/route.ts` |
| 35 | Account deletion cleanup | ⬜ TODO | `api/account/route.ts` |
| 36 | Responsive + dark mode + a11y | ⬜ TODO | |
| 37 | E2E tests (Playwright) | ⬜ TODO | `e2e/diary.spec.ts` |

### Phase 5: Mobile App (~22 hrs)

| # | Task | Status |
|---|------|--------|
| 38 | Bootstrap `apps/mobile` (Expo) | ⬜ TODO |
| 39 | Create `packages/shared` | ⬜ TODO |
| 40 | Cycles list + detail screens | ⬜ TODO |
| 41 | Entry form + camera | ⬜ TODO |
| 42 | Photo gallery + swipe viewer | ⬜ TODO |
| 43 | Offline sync | ⬜ TODO |
| 44 | Push notifications | ⬜ TODO |
| 45 | E2E tests (Detox) | ⬜ TODO |
| 46 | Cross-platform polish | ⬜ TODO |

### Summary

| Phase | Total | Done | Remaining | Est. Hours |
|-------|-------|------|-----------|------------|
| 1. Core Cycles | 14 | 14 | 0 | ✅ Complete |
| 2. Diary Entries | 11 | 11 | 0 | ✅ Complete |
| 3. Photos | 6 | 0 | 6 | ~10 hrs |
| 4. Charts + Export + Polish | 6 | 0 | 6 | ~8 hrs |
| 5. Mobile App | 9 | 0 | 9 | ~22 hrs |
| **Total** | **46** | **25** | **21** | **~40 hrs** |

---

## 11. New Dependencies (installed)

```bash
# Already installed:
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-placeholder
# Note: @tiptap/react v3 — BubbleMenu is extension-only (not a React component). Using static toolbar instead.
```

---

## 12. File Structure

```
apps/web/src/
├── app/
│   ├── diaries/
│   │   ├── page.tsx                    # ✅ Cycles list
│   │   └── [id]/
│   │       └── page.tsx                # ✅ Cycle detail (tabbed)
│   └── api/diaries/
│       ├── route.ts                    # ✅ GET + POST (cycles)
│       └── [id]/
│           ├── route.ts                # ✅ GET + PATCH + DELETE
│           ├── entries/
│           │   ├── route.ts            # ✅ GET + POST
│           │   └── [eid]/
│           │       ├── route.ts        # ✅ PATCH + DELETE
│           │       └── photos/
│           │           ├── route.ts    # ⬜ POST (upload)
│           │           └── [pid]/
│           │               └── route.ts  # ⬜ DELETE
│           └── export/
│               └── route.ts            # ⬜ GET (PDF/CSV)
├── components/diary/
│   ├── CycleCard.tsx                   # ✅
│   ├── CycleFormDialog.tsx             # ✅
│   ├── StageProgress.tsx               # ✅
│   ├── DiaryTimeline.tsx               # ✅
│   ├── DiaryEntryCard.tsx              # ✅
│   ├── EntryFormDialog.tsx             # ✅
│   ├── RichTextEditor.tsx              # ✅
│   ├── TagSelector.tsx                 # ✅
│   ├── SensorSnapshotCard.tsx          # ✅
│   ├── CycleCharts.tsx                 # ⬜ Phase 4
│   ├── CyclePhotosTab.tsx              # ⬜ Phase 3
│   ├── PhotoUpload.tsx                 # ⬜ Phase 3
│   └── PhotoGallery.tsx                # ⬜ Phase 3
├── hooks/
│   ├── use-diary-cycles.ts             # ✅
│   └── use-diary-entries.ts            # ✅
└── types/index.ts                      # ✅ All DiaryCycle* + DiaryEntry* types

apps/mobile/                            # Phase 5: Expo app
packages/shared/                        # Phase 5: Shared types + schemas
```

---

## 13. Verification

1. **Create cycle** → verify DB insert, shows in list with stage progress
2. **Stage transition** → use prompt to advance, verify day counter resets
3. **Create entry** → rich text formatting + tags render correctly
4. **Sensor snapshot** → temp/humidity/VPD captured and displayed
5. **Upload photos** → drag/drop multiple, verify thumbnails + lightbox
6. **Photos tab** → see all cycle photos in gallery, filter by tags
7. **Charts tab** → filtered to cycle date range, entry markers visible
8. **Export** → PDF contains entries + photos + sensor data
9. **Complete cycle** → `ended_at` set, status badge changes
10. **Delete cycle** → cascade delete entries/photos/Storage files
11. **Mobile offline** → create entry without Wi-Fi → reconnect → sync
12. **Dark mode** → all components render correctly
13. **Mobile viewport** → responsive layout, touch-friendly editor
