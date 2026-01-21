# EnviroFlow Mobile App Upgrade Plan

**Version:** 1.0  
**Date:** January 21, 2026  
**Status:** Planning  
**Target Platforms:** iOS (App Store) & Android (Google Play)  
**Timeline:** 20 weeks (5 months)

---

## Executive Summary

This document outlines the comprehensive plan to add full native mobile app capability to EnviroFlow, enabling deployment to both Apple App Store and Google Play Store. The mobile app will provide growers with real-time monitoring, push notifications, and control capabilities from their iOS and Android devices.

**Key Objectives:**
- ✅ Native iOS and Android apps with native performance and UX
- ✅ Real-time environmental monitoring and alerts
- ✅ Push notifications for critical events
- ✅ Bluetooth support for Govee sensors
- ✅ Biometric authentication for secure access
- ✅ Offline capability with sync when reconnected
- ✅ App Store and Google Play Store ready

**Recommended Approach:** React Native with Expo SDK

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Technology Stack Decision](#technology-stack-decision)
3. [Mobile App Architecture](#mobile-app-architecture)
4. [Feature Requirements](#feature-requirements)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Technical Specifications](#technical-specifications)
7. [Code Sharing Strategy](#code-sharing-strategy)
8. [Push Notification Architecture](#push-notification-architecture)
9. [App Store Submission Requirements](#app-store-submission-requirements)
10. [Resource Requirements](#resource-requirements)
11. [Risk Assessment](#risk-assessment)
12. [Success Metrics](#success-metrics)

---

## Current State Analysis

### Existing Web Application

**Framework:** Next.js 14.2 with TypeScript  
**Current Capabilities:**
- Web-based responsive design (basic mobile responsiveness)
- Dashboard with room cards and live sensor data
- Visual workflow builder using React Flow
- Multi-brand controller support (AC Infinity, Inkbird, CSV)
- Supabase backend with real-time subscriptions
- Authentication via Supabase Auth

**Mobile Readiness:**
- ✅ API architecture is mobile-compatible (HTTP/REST)
- ✅ Supabase Auth works on React Native
- ✅ Database schema includes `push_tokens` table
- ✅ Service worker stub exists for push notifications
- ✅ TypeScript types can be shared
- ❌ No native mobile app exists
- ❌ No Bluetooth support (needed for Govee)
- ❌ No push notification implementation
- ❌ No offline capability
- ❌ No biometric authentication

### Key Challenges

1. **New Codebase Required:** Cannot reuse React components directly; need React Native equivalents
2. **Workflow Builder:** React Flow (drag-and-drop) doesn't work well on mobile touch interfaces
3. **Bluetooth Requirement:** Govee adapter requires native BLE access (not available in web)
4. **Push Notifications:** Need FCM/APNS integration beyond basic web service worker
5. **Dual Maintenance:** Will maintain two frontends (web + mobile) with shared backend

---

## Technology Stack Decision

### Recommended: React Native with Expo SDK ✅

**Rationale:**
- Already planned in MVP Spec v2.0 (Phase 2)
- Full native API access (Bluetooth, biometric, push, camera)
- Excellent developer experience (Expo Go, EAS Build, OTA updates)
- Large ecosystem and community support
- TypeScript-first with strong typing
- Can share business logic and types with web app
- Near-native performance
- Proven track record for App Store submissions

### Alternatives Considered & Rejected

**Option 2: Capacitor**
- ❌ React Flow workflow builder won't work well in webview
- ❌ Performance overhead (webview wrapper)
- ❌ Non-native UX feel
- ✅ Faster development (4-6 weeks vs 20 weeks)

**Option 3: Progressive Web App (PWA)**
- ❌ No Bluetooth access (dealbreaker for Govee)
- ❌ Unreliable push notifications on iOS
- ❌ Cannot list in App Store/Play Store
- ❌ No biometric authentication
- ✅ Zero additional development

**Verdict:** React Native (Expo) is the only option that meets all requirements.

---

## Mobile App Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  React Native Mobile App                 │
│                      (apps/mobile/)                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Dashboard │  │Automations│  │Controllers│  │Settings│ │
│  │   Tab    │  │    Tab    │  │    Tab    │  │   Tab  │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         React Navigation (Tab Navigator)           │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Zustand     │  │ React Query  │  │  AsyncStorage│ │
│  │ (State Mgmt)  │  │ (API Cache)  │  │  (Offline)   │ │
│  └───────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────┘
                            ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────┐
│              Supabase Backend (Existing)                 │
├─────────────────────────────────────────────────────────┤
│  • PostgreSQL Database                                   │
│  • Supabase Auth (Email/Password, 2FA)                  │
│  • Realtime Subscriptions (WebSocket)                   │
│  • Storage (CSV uploads)                                 │
│  • Edge Functions (Cron jobs)                           │
│  • Row Level Security (RLS)                             │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│           Push Notification Services                     │
├─────────────────────────────────────────────────────────┤
│  • Firebase Cloud Messaging (FCM) - Android             │
│  • Apple Push Notification Service (APNS) - iOS        │
│  • Expo Push Notification Service (aggregator)         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Native Device APIs                          │
├─────────────────────────────────────────────────────────┤
│  • Bluetooth Low Energy (Govee sensors)                 │
│  • Biometric Authentication (Face ID, Touch ID)         │
│  • Camera (QR code scanner)                             │
│  • Local Storage (Encrypted AsyncStorage)               │
│  • Background Fetch (Periodic sync)                     │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack Details

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Framework** | React Native | 0.73+ | Cross-platform mobile app framework |
| **Build System** | Expo SDK | 50+ | Development and build toolchain |
| **Language** | TypeScript | 5.x | Type-safe development |
| **Navigation** | React Navigation | 6.x | Tab and stack navigation |
| **State Management** | Zustand | 4.x | Lightweight state management |
| **API Client** | React Query | 5.x | Data fetching, caching, sync |
| **Database Client** | Supabase JS | 2.x | Backend integration |
| **Styling** | NativeWind | 4.x | Tailwind CSS for React Native |
| **UI Components** | React Native Paper | 5.x | Material Design components |
| **Charts** | Victory Native | 36.x | Native charting library |
| **Forms** | React Hook Form | 7.x | Form validation |
| **Icons** | Expo Vector Icons | 14.x | Icon library |
| **Push Notifications** | Expo Notifications | 0.27+ | FCM/APNS wrapper |
| **Bluetooth** | react-native-ble-plx | 3.x | Bluetooth Low Energy |
| **Biometric Auth** | expo-local-authentication | 14.x | Face ID, Touch ID |
| **QR Scanner** | expo-barcode-scanner | 13.x | QR code scanning |
| **Secure Storage** | expo-secure-store | 13.x | iOS Keychain, Android EncryptedSharedPreferences |
| **Deep Linking** | Expo Linking | 6.x | URL schemes and universal links |

---

## Feature Requirements

### Phase 1: Core Features (MVP)

#### 1.1 Authentication & Onboarding
- ✅ Email/password login via Supabase Auth
- ✅ Sign up with email verification
- ✅ Password reset flow
- ✅ Biometric login (optional, after initial email/password)
- ✅ 3-screen onboarding tutorial (swipeable)
- ✅ Persistent session (remember me)
- ✅ Logout with confirmation

#### 1.2 Dashboard Tab
- ✅ **Room Cards (Carousel/Grid)**
  - Current temperature, humidity, VPD
  - Color-coded status indicators (green/yellow/red)
  - Last updated timestamp
  - Tap to view room details
  - Swipeable on mobile (carousel mode)
- ✅ **Real-time Updates**
  - Supabase subscription to `sensor_readings` table
  - 60-second polling fallback if WebSocket fails
  - Pull-to-refresh gesture
- ✅ **Quick Actions**
  - Floating Action Button (FAB) to add controller
  - View activity log (bottom sheet)
- ✅ **KPI Summary Cards**
  - Total rooms monitored
  - Active workflows
  - Controllers online/offline
- ✅ **Activity Feed**
  - Recent automation actions (last 20)
  - Scroll to load more
  - Filter by room or action type

#### 1.3 Controllers Tab
- ✅ **Controller List**
  - Brand logo and device name
  - Connection status (online/offline)
  - Last seen timestamp
  - Swipe left to delete (with confirmation)
- ✅ **Add Controller Wizard**
  - Step 1: Select brand (AC Infinity, Inkbird, Govee, CSV)
  - Step 2: Scan QR code OR manual entry (device ID, credentials)
  - Step 3: Test connection
  - Step 4: Assign to room
- ✅ **Controller Details**
  - View sensor readings
  - Edit device name and credentials
  - Remove device

#### 1.4 Settings Tab
- ✅ **Account**
  - Change email
  - Change password
  - Enable/disable 2FA (TOTP)
  - Delete account (with confirmation)
- ✅ **Notifications**
  - Enable/disable push notifications
  - Select notification categories (alerts, transitions, daily summary)
  - Quiet hours (mute notifications during hours)
- ✅ **Preferences**
  - Temperature unit (Celsius/Fahrenheit)
  - Theme (light/dark/auto)
  - Default room view
- ✅ **About**
  - App version
  - Privacy policy
  - Terms of service
  - Contact support

### Phase 2: Advanced Features

#### 2.1 Automations Tab
- ✅ **Workflow List**
  - Workflow name and description
  - Active/inactive toggle
  - Last run timestamp
  - Tap to view details
- ✅ **Workflow Details**
  - Read-only visualization (simplified node view)
  - "Edit on Web" link (opens web app in browser)
  - Dry-run button (simulate without executing)
  - Activation history
- ✅ **Workflow Actions**
  - Activate/deactivate workflow
  - Duplicate workflow
  - Delete workflow

#### 2.2 Push Notifications
- ✅ **Alert Notifications (Immediate)**
  - Controller offline
  - Sensor out of range
  - Workflow execution error
  - Tap to view details
- ✅ **Transition Notifications (Real-time)**
  - Growth stage change
  - Sunrise/sunset dimming started
- ✅ **Daily Summary (6 PM)**
  - Room status overview
  - Workflow execution count
  - Alerts summary
- ✅ **Security Notifications**
  - New device login
  - 2FA code requested
  - Password changed

#### 2.3 Offline Mode
- ✅ **View Cached Data**
  - Last synced sensor readings (up to 24 hours)
  - Controller list
  - Workflow list (read-only)
- ✅ **Queue Actions**
  - Add controller
  - Update controller credentials
  - Activate/deactivate workflow
  - Actions sync when reconnected
- ✅ **Offline Indicator**
  - Banner showing "Offline - Data may be stale"
  - Sync status icon in navigation bar

### Phase 3: Native Features

#### 3.1 Bluetooth (Govee Sensors)
- ✅ **BLE Scanning**
  - Scan for nearby Govee H5179 sensors
  - Display signal strength (RSSI)
  - Auto-discover devices
- ✅ **Pairing**
  - Pair with sensor
  - Store credentials securely
  - Test connection
- ✅ **Data Collection**
  - Read temperature/humidity every 60 seconds
  - Store in local SQLite cache
  - Upload to Supabase when online

#### 3.2 QR Code Scanner
- ✅ **Scan Controller QR Code**
  - Launch camera from "Add Controller" wizard
  - Parse QR code (device ID, credentials)
  - Auto-fill wizard form
- ✅ **Permissions**
  - Request camera permission on first use
  - Handle permission denial gracefully

#### 3.3 Biometric Authentication
- ✅ **Enable Biometric Login**
  - Detect device capability (Face ID, Touch ID, Fingerprint)
  - Enable in Settings → Security
  - Store session token in Secure Store
- ✅ **Login Flow**
  - Show biometric prompt on app launch
  - Fallback to email/password if failed
  - Auto-lock after 5 minutes of inactivity

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Week 1: Project Setup**
- [ ] Create `apps/mobile/` directory in monorepo
- [ ] Initialize Expo project with TypeScript template
- [ ] Configure turborepo to include mobile app
- [ ] Set up shared types package (`packages/shared/`)
- [ ] Install core dependencies (React Navigation, NativeWind, Zustand, React Query)
- [ ] Configure ESLint, Prettier for mobile
- [ ] Set up Git ignore for mobile build artifacts

**Week 2: Authentication & Navigation**
- [ ] Implement Supabase client for React Native
- [ ] Build login screen with email/password
- [ ] Build sign-up screen with validation
- [ ] Build password reset flow
- [ ] Create AuthContext provider
- [ ] Set up React Navigation (Tab Navigator)
- [ ] Create placeholder screens (Dashboard, Controllers, Automations, Settings)
- [ ] Implement protected routes (redirect to login if not authenticated)

**Week 3: Dashboard - Part 1**
- [ ] Build Room Card component (temperature, humidity, VPD)
- [ ] Implement room list fetching (Supabase query)
- [ ] Add real-time subscription to `sensor_readings`
- [ ] Build KPI summary cards (total rooms, active workflows)
- [ ] Implement pull-to-refresh
- [ ] Add loading states and error handling

**Week 4: Dashboard - Part 2**
- [ ] Build Activity Feed component
- [ ] Fetch activity logs from Supabase
- [ ] Implement infinite scroll (pagination)
- [ ] Add floating action button (FAB) for quick actions
- [ ] Build room detail screen (tap on room card)
- [ ] Add unit conversion (Celsius/Fahrenheit)

**Deliverable:** Working mobile app with authentication and dashboard viewing

---

### Phase 2: Controller Management (Weeks 5-8)

**Week 5: Controllers Tab - List & Details**
- [ ] Build controller list screen
- [ ] Fetch controllers from Supabase
- [ ] Display connection status (online/offline)
- [ ] Implement swipe-to-delete gesture
- [ ] Build controller detail screen
- [ ] Show sensor readings for selected controller

**Week 6: Add Controller Wizard - Part 1**
- [ ] Create multi-step wizard component
- [ ] Step 1: Brand selection (AC Infinity, Inkbird, Govee, CSV)
- [ ] Step 2: Manual entry form (device ID, credentials)
- [ ] Form validation with React Hook Form + Zod
- [ ] Store credentials in Supabase Vault (encrypted)

**Week 7: Add Controller Wizard - Part 2**
- [ ] Step 3: Test connection (API call to controller)
- [ ] Step 4: Assign to room (dropdown)
- [ ] Success/error feedback
- [ ] Save controller to Supabase
- [ ] Redirect to controller list

**Week 8: Controller Editing & Testing**
- [ ] Build edit controller screen
- [ ] Update credentials
- [ ] Re-test connection
- [ ] Delete controller with confirmation dialog
- [ ] Unit tests for controller CRUD operations
- [ ] E2E testing with Detox (basic flows)

**Deliverable:** Full controller management capability

---

### Phase 3: Push Notifications (Weeks 9-10)

**Week 9: Push Notification Setup**
- [ ] Configure Firebase Cloud Messaging (FCM) for Android
- [ ] Configure Apple Push Notification Service (APNS) for iOS
- [ ] Set up Expo Push Notification Service
- [ ] Request notification permissions on first app launch
- [ ] Store push token in Supabase `push_tokens` table
- [ ] Implement token refresh logic

**Week 10: Notification Handling**
- [ ] Build backend endpoint to send notifications (Supabase Edge Function)
- [ ] Implement notification categories (alerts, transitions, summary, security)
- [ ] Handle foreground notifications (in-app banner)
- [ ] Handle background notifications (tap to open app)
- [ ] Deep linking (open specific room/workflow from notification)
- [ ] Build notification settings UI (enable/disable categories)
- [ ] Implement quiet hours (mute during specified hours)

**Deliverable:** Push notifications working for all event types

---

### Phase 4: Automations & Workflows (Weeks 11-13)

**Week 11: Automations Tab - List View**
- [ ] Build workflow list screen
- [ ] Fetch workflows from Supabase
- [ ] Display workflow name, description, active status
- [ ] Implement activate/deactivate toggle
- [ ] Show last run timestamp
- [ ] Add filter (active/inactive/all)

**Week 12: Workflow Details - Read-Only**
- [ ] Build workflow detail screen
- [ ] Fetch workflow nodes and edges from Supabase
- [ ] Display simplified node visualization (list or tree view)
- [ ] Show trigger, conditions, actions
- [ ] Add "Edit on Web" button (deep link to web app)
- [ ] Implement dry-run mode (simulate workflow)

**Week 13: Workflow Actions**
- [ ] Implement duplicate workflow
- [ ] Implement delete workflow (with confirmation)
- [ ] Build execution history view (last 20 runs)
- [ ] Show execution logs (success/failure, actions taken)
- [ ] Add search/filter workflows
- [ ] Unit tests for workflow operations

**Deliverable:** Workflow monitoring and management (editing via web)

---

### Phase 5: Settings & Offline (Weeks 14-15)

**Week 14: Settings Tab**
- [ ] Build settings navigation structure
- [ ] Account section (change email, change password)
- [ ] 2FA setup (TOTP with QR code)
- [ ] Delete account flow (with confirmation)
- [ ] Notification preferences UI
- [ ] Theme selector (light/dark/auto)
- [ ] Temperature unit selector
- [ ] About section (version, privacy policy, terms, support)

**Week 15: Offline Mode**
- [ ] Implement React Query persistence (AsyncStorage)
- [ ] Cache sensor readings locally (SQLite or AsyncStorage)
- [ ] Queue offline actions (add controller, update workflow)
- [ ] Implement sync logic when reconnected
- [ ] Add offline indicator banner
- [ ] Handle conflict resolution (last-write-wins)
- [ ] Test offline scenarios thoroughly

**Deliverable:** Complete settings and offline capability

---

### Phase 6: Native Features (Weeks 16-18)

**Week 16: Biometric Authentication**
- [ ] Install `expo-local-authentication`
- [ ] Detect device biometric capability (Face ID, Touch ID, Fingerprint)
- [ ] Build biometric setup flow in Settings → Security
- [ ] Store encrypted session token in `expo-secure-store`
- [ ] Implement biometric login on app launch
- [ ] Add auto-lock after 5 minutes of inactivity
- [ ] Fallback to email/password if biometric fails

**Week 17: Bluetooth (Govee Sensors)**
- [ ] Install `react-native-ble-plx`
- [ ] Request Bluetooth permissions (Android/iOS)
- [ ] Implement BLE scanning (detect Govee H5179 devices)
- [ ] Display nearby devices with signal strength (RSSI)
- [ ] Implement pairing flow
- [ ] Read temperature/humidity from Govee sensor
- [ ] Store readings in local cache
- [ ] Upload to Supabase when online

**Week 18: QR Code Scanner**
- [ ] Install `expo-barcode-scanner`
- [ ] Request camera permissions
- [ ] Build QR scanner screen
- [ ] Integrate into "Add Controller" wizard
- [ ] Parse QR code data (JSON or URL format)
- [ ] Auto-fill wizard form with scanned data
- [ ] Handle invalid QR codes gracefully

**Deliverable:** Native features fully integrated

---

### Phase 7: Polish & Testing (Weeks 19-20)

**Week 19: UI/UX Polish**
- [ ] Dark mode styling for all screens
- [ ] Loading skeletons for async content
- [ ] Error boundaries for crash recovery
- [ ] Empty states (no rooms, no controllers, no workflows)
- [ ] Onboarding tutorial (3-screen swipeable)
- [ ] Haptic feedback for key interactions
- [ ] Accessibility audit (screen reader, contrast, touch targets)
- [ ] Performance optimization (React.memo, useMemo, lazy loading)

**Week 20: Testing & Bug Fixes**
- [ ] E2E testing with Detox (all critical flows)
- [ ] Unit tests for business logic (>80% coverage)
- [ ] Manual QA testing (iOS and Android devices)
- [ ] Beta testing with 5-10 external users (TestFlight, Play Store Internal)
- [ ] Bug triage and fixes
- [ ] Performance profiling (startup time, memory usage)
- [ ] Accessibility testing (VoiceOver, TalkBack)

**Deliverable:** Production-ready mobile app

---

### Phase 8: App Store Submission (Weeks 21-22)

**Week 21: App Store Assets & Submission Prep**
- [ ] Generate app icons (1024x1024 for iOS, adaptive icon for Android)
- [ ] Create screenshots (5.5", 6.5" for iOS; phone/tablet for Android)
- [ ] Write app description (short and long)
- [ ] Create privacy policy page (GDPR compliant)
- [ ] Create terms of service page
- [ ] Set up Apple Developer account ($99/year)
- [ ] Set up Google Play Console account ($25 one-time)
- [ ] Configure app signing (iOS: provisioning profiles, Android: keystore)
- [ ] Build production release with EAS Build

**Week 22: App Store Submission**
- [ ] Submit to Apple App Store
  - Fill out App Store Connect form
  - Add screenshots, description, keywords
  - Set pricing (free) and availability
  - Submit for review (7-14 day review process)
- [ ] Submit to Google Play Store
  - Fill out Play Console form
  - Add screenshots, description, categorization
  - Set pricing (free) and availability
  - Submit for review (1-3 day review process)
- [ ] Monitor review status
- [ ] Respond to reviewer feedback if rejected
- [ ] Publish app once approved

**Deliverable:** EnviroFlow live on both app stores! 🎉

---

## Technical Specifications

### Monorepo Structure

```
enviroflow.app/
├── apps/
│   ├── web/                    # Existing Next.js web app
│   ├── mobile/                 # NEW: React Native mobile app
│   │   ├── app.json           # Expo configuration
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── App.tsx            # Entry point
│   │   ├── src/
│   │   │   ├── navigation/    # React Navigation config
│   │   │   ├── screens/       # Screen components
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── controllers/
│   │   │   │   ├── automations/
│   │   │   │   └── settings/
│   │   │   ├── components/    # Reusable components
│   │   │   ├── hooks/         # Custom hooks
│   │   │   ├── stores/        # Zustand stores
│   │   │   ├── services/      # API clients
│   │   │   ├── utils/         # Helper functions
│   │   │   └── types/         # TypeScript types
│   │   ├── assets/            # Images, fonts
│   │   └── __tests__/         # Unit tests
│   └── automation-engine/     # Existing backend
└── packages/
    ├── shared/                 # NEW: Shared code
    │   ├── types/             # TypeScript interfaces
    │   ├── api-client/        # Supabase wrappers
    │   └── utils/             # Business logic
    └── types/                 # Existing types package
```

### State Management Architecture

**Zustand Stores:**

```typescript
// stores/authStore.ts
interface AuthStore {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

// stores/roomStore.ts
interface RoomStore {
  rooms: Room[];
  selectedRoom: Room | null;
  isLoading: boolean;
  fetchRooms: () => Promise<void>;
  subscribeToRooms: () => void;
  selectRoom: (roomId: string) => void;
}

// stores/controllerStore.ts
interface ControllerStore {
  controllers: Controller[];
  isLoading: boolean;
  addController: (data: AddControllerInput) => Promise<void>;
  updateController: (id: string, data: UpdateControllerInput) => Promise<void>;
  deleteController: (id: string) => Promise<void>;
}

// stores/workflowStore.ts
interface WorkflowStore {
  workflows: Workflow[];
  isLoading: boolean;
  toggleWorkflow: (id: string) => Promise<void>;
  dryRunWorkflow: (id: string) => Promise<void>;
}
```

**React Query for API Caching:**

```typescript
// hooks/queries.ts
export const useRooms = () => {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: fetchRooms,
    refetchInterval: 60000, // 60 seconds
    staleTime: 30000,
  });
};

export const useSensorReadings = (roomId: string) => {
  return useQuery({
    queryKey: ['sensor-readings', roomId],
    queryFn: () => fetchSensorReadings(roomId),
    refetchInterval: 60000,
  });
};

export const useActivityLogs = (limit = 20) => {
  return useInfiniteQuery({
    queryKey: ['activity-logs'],
    queryFn: ({ pageParam = 0 }) => fetchActivityLogs(limit, pageParam),
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length * limit : undefined;
    },
  });
};
```

---

## Code Sharing Strategy

### Shared Package Structure

```
packages/shared/
├── src/
│   ├── types/
│   │   ├── room.ts           # Room interface
│   │   ├── controller.ts     # Controller interface
│   │   ├── workflow.ts       # Workflow interface
│   │   ├── sensor.ts         # Sensor reading interface
│   │   └── index.ts
│   ├── api/
│   │   ├── supabase.ts       # Supabase client factory
│   │   ├── rooms.ts          # Room API calls
│   │   ├── controllers.ts    # Controller API calls
│   │   ├── workflows.ts      # Workflow API calls
│   │   └── index.ts
│   ├── utils/
│   │   ├── vpd.ts            # VPD calculation
│   │   ├── units.ts          # Unit conversion (C to F)
│   │   ├── validation.ts     # Zod schemas
│   │   └── index.ts
│   └── constants/
│       ├── brands.ts         # Controller brands
│       ├── node-types.ts     # Workflow node types
│       └── index.ts
├── package.json
└── tsconfig.json
```

### Import Examples

**In Web App:**
```typescript
import { Room, Controller } from '@enviroflow/shared/types';
import { fetchRooms } from '@enviroflow/shared/api';
import { calculateVPD } from '@enviroflow/shared/utils';
```

**In Mobile App:**
```typescript
import { Room, Controller } from '@enviroflow/shared/types';
import { fetchRooms } from '@enviroflow/shared/api';
import { calculateVPD } from '@enviroflow/shared/utils';
```

**Benefits:**
- Single source of truth for types
- No duplicate API logic
- Consistent business logic (VPD, unit conversion)
- Easier to maintain and test

---

## Push Notification Architecture

### Notification Flow

```
┌─────────────────────────────────────────────────────────┐
│         Automation Engine (Supabase Edge Function)      │
│                                                          │
│  1. Workflow executes (every 60 seconds)                │
│  2. Detects event (controller offline, sensor alert)    │
│  3. Queries push_tokens table for user                  │
│  4. Calls Expo Push Notification API                    │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│      Expo Push Notification Service (Aggregator)        │
│                                                          │
│  1. Receives notification payload from backend          │
│  2. Determines device platform (iOS or Android)         │
│  3. Forwards to appropriate service (FCM or APNS)       │
└─────────────────────────────────────────────────────────┘
                            ↓
         ┌──────────────────┴──────────────────┐
         ↓                                      ↓
┌────────────────────┐              ┌────────────────────┐
│  FCM (Android)     │              │  APNS (iOS)        │
│                    │              │                    │
│  Delivers to       │              │  Delivers to       │
│  Android devices   │              │  iOS devices       │
└────────────────────┘              └────────────────────┘
         ↓                                      ↓
┌────────────────────┐              ┌────────────────────┐
│  Mobile App        │              │  Mobile App        │
│  (Android)         │              │  (iOS)             │
│                    │              │                    │
│  1. Receives push  │              │  1. Receives push  │
│  2. Shows banner   │              │  2. Shows banner   │
│  3. Handles tap    │              │  3. Handles tap    │
│  4. Deep links     │              │  4. Deep links     │
└────────────────────┘              └────────────────────┘
```

### Notification Categories

| Category | Priority | Delivery | Example |
|----------|----------|----------|---------|
| **Alerts** | High | Immediate | "AC Infinity Controller 69 is offline" |
| **Transitions** | Medium | Real-time | "Sunrise dimming started in Veg Room" |
| **Daily Summary** | Low | Scheduled (6 PM) | "Today: 3 workflows ran, 0 alerts" |
| **Security** | High | Immediate | "New device logged in from Chrome on Windows" |

### Notification Payload Structure

```typescript
interface PushNotificationPayload {
  to: string; // Expo push token
  title: string;
  body: string;
  data: {
    type: 'alert' | 'transition' | 'summary' | 'security';
    roomId?: string;
    controllerId?: string;
    workflowId?: string;
    deepLink?: string; // e.g., "enviroflow://room/abc123"
  };
  sound: 'default' | null;
  priority: 'high' | 'normal' | 'low';
  badge?: number; // iOS only
  channelId?: string; // Android only
}
```

### Backend Implementation (Supabase Edge Function)

```typescript
// supabase/functions/send-push-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { userId, title, body, data } = await req.json();

  // Fetch user's push tokens
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token')
    .eq('user_id', userId)
    .eq('enabled', true);

  if (!tokens || tokens.length === 0) {
    return new Response(JSON.stringify({ error: 'No tokens found' }), {
      status: 404,
    });
  }

  // Send to Expo Push Notification Service
  const messages = tokens.map((t) => ({
    to: t.token,
    title,
    body,
    data,
    sound: 'default',
    priority: data.type === 'alert' ? 'high' : 'normal',
  }));

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  const result = await response.json();
  return new Response(JSON.stringify(result), { status: 200 });
});
```

---

## App Store Submission Requirements

### Apple App Store (iOS)

#### Required Assets
- **App Icon:** 1024x1024px PNG (no alpha channel)
- **Screenshots:**
  - 6.7" (iPhone 15 Pro Max): 1290 x 2796px (minimum 3)
  - 6.5" (iPhone 11 Pro Max): 1242 x 2688px
  - 5.5" (iPhone 8 Plus): 1242 x 2208px
- **App Preview Video (Optional):** 15-30 seconds MP4

#### Metadata
- **App Name:** EnviroFlow (max 30 characters)
- **Subtitle:** Environmental automation for growers (max 30 characters)
- **Keywords:** environmental control, grow room, automation, temperature, humidity
- **Description:** (max 4000 characters)
- **What's New:** Release notes for each version
- **Support URL:** https://enviroflow.app/support
- **Privacy Policy URL:** https://enviroflow.app/privacy

#### App Review Information
- **Contact Info:** Email and phone for App Review team
- **Demo Account:** Provide test credentials if app requires login
- **Notes:** Explain any special testing requirements

#### Technical Requirements
- **iOS Version:** iOS 13.4+ (minimum supported)
- **Devices:** iPhone, iPad (universal)
- **Permissions:**
  - Camera (for QR scanner)
  - Bluetooth (for Govee sensors)
  - Notifications (for push notifications)
  - Biometric (Face ID, Touch ID)
- **Entitlements:**
  - Push Notifications
  - Associated Domains (for deep linking)

#### Review Guidelines Compliance
- No private API usage
- All permissions must have usage descriptions (Info.plist)
- App must not crash or have major bugs
- Must comply with Apple Human Interface Guidelines

#### Estimated Timeline
- **Initial Review:** 1-2 days to "In Review"
- **Review Duration:** 1-7 days (average 2-3 days)
- **Rejection:** If rejected, fix and resubmit (add 2-3 days)
- **Approval:** App goes live within 24 hours

---

### Google Play Store (Android)

#### Required Assets
- **App Icon:** 512x512px PNG
- **Feature Graphic:** 1024x500px JPG or PNG (required)
- **Screenshots:**
  - Phone: 16:9 or 9:16 ratio (minimum 2, maximum 8)
  - 7-inch tablet (optional)
  - 10-inch tablet (optional)
- **Promo Video (Optional):** YouTube link

#### Store Listing
- **App Name:** EnviroFlow (max 50 characters)
- **Short Description:** max 80 characters
- **Full Description:** max 4000 characters
- **Category:** Productivity
- **Tags:** automation, smart home, IoT, sensors
- **Contact Email:** support@enviroflow.app
- **Privacy Policy URL:** https://enviroflow.app/privacy

#### Content Rating
- Complete questionnaire (rate for different regions)
- Expected rating: Everyone or Teen (based on content)

#### Technical Requirements
- **Android Version:** Android 6.0 (API 23)+ minimum
- **Permissions:**
  - Camera (for QR scanner)
  - Bluetooth (for Govee sensors)
  - Notifications (for push notifications)
  - Biometric (fingerprint)
  - Internet (required)
- **Target SDK:** API 33+ (Android 13)

#### App Signing
- **Google Play App Signing:** Enabled (recommended)
- **Upload Key:** Generated locally, used to sign uploads
- **App Signing Key:** Managed by Google Play

#### Release Tracks
1. **Internal Testing:** Test with <100 users (immediate)
2. **Closed Testing:** Test with specific testers (opt-in)
3. **Open Testing:** Public beta (opt-in via Play Store)
4. **Production:** Full release

#### Review Guidelines Compliance
- No malware or harmful behavior
- Must comply with Google Play Policies
- Accurate description and screenshots
- Privacy policy required if app collects personal data

#### Estimated Timeline
- **Internal Testing:** Live within 1 hour
- **Closed/Open Testing:** Live within 1 hour
- **Production (First Release):** 1-3 days review
- **Production (Updates):** <24 hours review

---

## Resource Requirements

### Team Structure

| Role | FTE | Duration | Responsibilities |
|------|-----|----------|------------------|
| **Senior Mobile Developer** | 1.0 | 20 weeks | React Native development, architecture, testing |
| **Backend Developer** | 0.5 | 10 weeks | API adjustments, push notifications, Supabase functions |
| **UI/UX Designer** | 0.5 | 10 weeks | Mobile UI design, app store assets, user flows |
| **QA Engineer** | 0.3 | 8 weeks | Manual testing, E2E tests, beta coordination |
| **DevOps Engineer** | 0.2 | 4 weeks | CI/CD setup (EAS Build), app signing, environment config |
| **Product Manager** | 0.2 | 20 weeks | Requirements, roadmap, app store submission coordination |

**Total:** ~2.7 FTE over 20 weeks

### Budget Estimate

| Category | Cost | Notes |
|----------|------|-------|
| **Development Labor** | $120,000 - $180,000 | 2.7 FTE × 20 weeks × $2,000-$3,000/week |
| **Apple Developer Account** | $99/year | Required for iOS submission |
| **Google Play Developer Account** | $25 one-time | Required for Android submission |
| **Expo EAS Build** | $300/month | Production builds, OTA updates |
| **Firebase (FCM)** | Free | Push notifications |
| **Testing Devices** | $2,000 | 2 iPhones, 2 Android phones (for QA) |
| **Design Tools** | $100/month | Figma Pro for design collaboration |
| **Miscellaneous** | $5,000 | Contingency (bug bounties, external testing) |
| **Total** | **$125,000 - $190,000** | 5-month project |

### Infrastructure Costs (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| **Supabase Pro** | $25/month | Existing (no change) |
| **Expo EAS Build** | $300/month | CI/CD for mobile builds |
| **Firebase (FCM)** | Free | Up to 10M notifications/month |
| **Vercel Pro** | $20/month | Existing (no change) |
| **Total** | **$345/month** | Ongoing (post-launch) |

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Workflow Builder Too Complex for Mobile** | High | Medium | Ship with "Edit on Web" link initially; build simplified mobile version in v2 if user demand is high |
| **Bluetooth (Govee) Integration Issues** | Medium | High | Start BLE integration early (Week 17); have fallback CSV upload if BLE fails |
| **Push Notification Delivery Unreliable** | Medium | Medium | Implement retry logic; use Expo's push notification service for reliability |
| **App Store Rejection (iOS)** | Medium | High | Follow Apple guidelines strictly; test with TestFlight beta; prepare for 1-2 rejection cycles |
| **Performance Issues on Older Devices** | Low | Medium | Test on mid-range Android devices (API 23+); optimize bundle size; lazy load components |
| **Offline Sync Conflicts** | Low | Low | Use last-write-wins strategy; most actions are user-initiated (low conflict probability) |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Scope Creep** | High | High | Lock requirements after Phase 1; defer non-essential features to v2 |
| **Timeline Slippage** | Medium | Medium | Build 4-week buffer into 20-week timeline; prioritize MVP features |
| **Resource Availability** | Medium | High | Hire mobile developer early; have backup freelancers identified |
| **Low User Adoption** | Low | High | Beta test with 10-20 users before launch; gather feedback; market in grow communities |

### Security Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Credential Theft (Man-in-the-Middle)** | Low | High | Use HTTPS for all API calls; implement certificate pinning; store credentials in Secure Store |
| **Unauthorized Access** | Low | High | Enforce biometric or 2FA; implement session timeouts (5 minutes); use Supabase RLS policies |
| **Push Notification Spoofing** | Low | Medium | Validate notification payload on server; use signed JWTs for deep links |

---

## Success Metrics

### Launch Metrics (Week 22)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **App Store Approval** | Both iOS and Android approved | Binary (pass/fail) |
| **Crash-Free Rate** | >99% | Firebase Crashlytics |
| **App Store Rating** | >4.0 stars | App Store and Play Store reviews |
| **Initial Downloads** | 100 downloads (first month) | App Store Connect, Play Console |

### 3-Month Post-Launch Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Monthly Active Users (MAU)** | 500 users | Analytics (Mixpanel, PostHog) |
| **Daily Active Users (DAU)** | 150 users | Analytics |
| **Session Duration** | >5 minutes/session | Analytics |
| **Retention Rate (7-day)** | >40% | Analytics |
| **Retention Rate (30-day)** | >20% | Analytics |
| **Push Notification Opt-In** | >60% | App analytics |
| **Push Notification Click-Through** | >15% | App analytics |
| **Controllers Added per User** | >2 controllers | Database query |
| **Workflows Active per User** | >1 workflow | Database query |

### User Satisfaction Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **App Store Rating** | >4.5 stars | App Store and Play Store |
| **Net Promoter Score (NPS)** | >50 | In-app survey |
| **Customer Support Tickets** | <5/week | Support system |
| **Bug Reports** | <2/week | GitHub Issues |

### Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **App Startup Time** | <2 seconds | Performance monitoring |
| **API Response Time (p95)** | <500ms | Supabase logs |
| **Push Notification Delivery** | >95% | Expo logs |
| **Crash-Free Rate** | >99.5% | Crashlytics |

---

## Appendix

### A. Competitive Analysis

| App | Platform | Features | Gaps in EnviroFlow Mobile |
|-----|----------|----------|----------------------------|
| **AC Infinity App** | iOS, Android | Controller management, scheduling | Cross-room automation, visual workflows |
| **Inkbird App** | iOS, Android | Temperature monitoring, alerts | Multi-brand support, workflow builder |
| **Govee Home** | iOS, Android | BLE sensors, notifications | Automation logic, integration with controllers |

**EnviroFlow's Competitive Advantage:**
- ✅ Multi-brand support (AC Infinity + Inkbird + Govee in one app)
- ✅ Cross-room automation workflows
- ✅ Centralized dashboard for all rooms
- ✅ Visual workflow builder (on web, monitoring on mobile)

---

### B. Future Enhancements (Post-v1.0)

**Phase 4 (6-12 months post-launch):**
- [ ] **Simplified Mobile Workflow Builder** (drag-and-drop on mobile)
- [ ] **Widgets** (iOS 14+ home screen widgets, Android app widgets)
- [ ] **Apple Watch App** (quick room status, notifications)
- [ ] **Wear OS App** (Android smartwatch support)
- [ ] **Siri Shortcuts** (voice commands to activate workflows)
- [ ] **Google Assistant Integration** (voice commands)
- [ ] **Geofencing** (auto-enable workflows when arriving at grow location)
- [ ] **Multi-Language Support** (Spanish, French, German)

**Phase 5 (12+ months post-launch):**
- [ ] **AR Room Scanner** (scan room with camera to auto-detect controllers)
- [ ] **AI-Powered Optimization** (recommend workflow adjustments based on data)
- [ ] **Community Workflow Library** (share/import workflows)
- [ ] **Live Streaming** (view cameras in grow rooms)
- [ ] **Collaboration Features** (share rooms with team members)

---

### C. References & Resources

**Documentation:**
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)

**App Store Guidelines:**
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policy](https://play.google.com/about/developer-content-policy/)

**Design Resources:**
- [Apple Human Interface Guidelines (iOS)](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design (Android)](https://m3.material.io/)
- [React Native Paper Components](https://callstack.github.io/react-native-paper/)

**Tools:**
- [EAS Build](https://docs.expo.dev/build/introduction/) - Cloud build service
- [Detox](https://wix.github.io/Detox/) - E2E testing framework
- [Reactotron](https://github.com/infinitered/reactotron) - Debugging tool

---

## Conclusion

This comprehensive plan provides a clear roadmap to deliver full native mobile app capability for EnviroFlow on both iOS and Android platforms. By following the 20-week implementation timeline, EnviroFlow will be app store-ready with:

✅ Native iOS and Android apps with superior UX  
✅ Real-time environmental monitoring  
✅ Push notifications for critical events  
✅ Bluetooth support for Govee sensors  
✅ Biometric authentication  
✅ Offline capability  
✅ Full controller and workflow management  

The phased approach ensures steady progress with clear deliverables at each stage. The recommended React Native (Expo) stack balances development velocity with native capabilities, while the shared code strategy maximizes reuse between web and mobile.

**Next Steps:**
1. Review and approve this plan
2. Hire senior mobile developer
3. Set up development environment (Expo, EAS Build)
4. Begin Phase 1: Foundation (Weeks 1-4)

---

**Document Version:** 1.0  
**Last Updated:** January 21, 2026  
**Maintained By:** EnviroFlow Engineering Team