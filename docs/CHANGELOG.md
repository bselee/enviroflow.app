# Changelog

All notable changes to EnviroFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-24

Major release introducing comprehensive UX improvements, multi-brand controller support, advanced analytics, scheduling capabilities, and extensive platform integrations.

### Added

#### Onboarding & User Experience (Phase 1)
- **Interactive onboarding tour** for new users with step-by-step guidance (TASK-001)
  - Contextual tooltips throughout the application (TASK-002)
  - Smart defaults for room creation and controller setup (TASK-003)
  - Room suggestions based on common grow setups (vegetative, flowering, drying)

- **Enhanced error handling system** with 5 error categories (TASK-004)
  - Credential errors with specific fix guidance
  - Network errors with retry suggestions
  - Configuration errors with correction steps
  - Controller-specific errors with brand-specific troubleshooting
  - System errors with support escalation

- **Automatic retry logic** with exponential backoff (TASK-005)
  - Smart retry for transient network failures
  - Circuit breaker pattern for persistent failures
  - User-configurable retry settings

#### Controller Management & Health (Phase 1)
- **Controller health scoring system** (0-100) (TASK-009)
  - Real-time health monitoring based on connection stability
  - Last seen timestamp tracking
  - Error rate calculation
  - Health trend visualization

- **Proactive alerts** for connection issues (TASK-011)
  - Email notifications for offline controllers
  - Push notifications (web and mobile)
  - Alert threshold configuration
  - Notification preferences per controller

- **Bulk controller operations** (TASK-013-016)
  - Bulk room assignment for multiple controllers
  - Bulk connection testing
  - Bulk delete with confirmation
  - Multi-select UI with keyboard shortcuts

#### Analytics & Data Visualization (Phase 2)
- **Custom date range selection** for analytics (TASK-017)
  - Preset ranges: 24h, 7d, 30d, 90d, 1y, All time
  - Custom date picker for specific ranges
  - Date range comparison mode
  - Export filtered data

- **Heatmap visualization** for sensor patterns (TASK-018)
  - Temperature/humidity heatmaps by hour of day
  - VPD heatmaps across multiple rooms
  - Color-coded zones for optimal ranges
  - Interactive tooltips with exact values

- **Correlation analysis** between sensors (TASK-019)
  - Cross-sensor correlation matrix
  - Scatter plots for relationship visualization
  - Statistical significance indicators
  - Export correlation data

- **Data export functionality** (TASK-020)
  - CSV export for sensor readings
  - JSON export for automation workflows
  - PDF reports with charts and summaries
  - Scheduled export via email

#### Scheduling & Automation (Phase 3)
- **Device schedule builder** with visual calendar (TASK-022)
  - Drag-and-drop schedule creation
  - Weekly/daily recurring schedules
  - Schedule preview and validation
  - Conflict detection

- **Sunrise/sunset dimming schedules** (TASK-024)
  - Gradual dimming over configurable duration (15-60 min)
  - Natural light curve simulation
  - DLI (Daily Light Integral) optimization
  - Seasonal adjustment options

- **Schedule templates and presets** (TASK-025)
  - Pre-built templates for common scenarios
  - User-created custom templates
  - Template sharing (export/import)
  - Template versioning

- **AI-powered schedule recommendations** (TASK-026)
  - Grok AI integration for optimal schedules
  - Growth stage-specific recommendations
  - Energy efficiency optimization
  - Historical data-based suggestions

#### Controller Integrations (Phase 3)
- **Govee device integration** (TASK-028-032)
  - Full API support for Govee WiFi devices
  - Temperature and humidity monitoring
  - Smart plug control
  - LED strip dimming and color control
  - Device discovery via Govee cloud API

- **MQTT generic device support** (TASK-033-037)
  - MQTT broker connection management
  - Topic subscription and publishing
  - Custom payload mapping
  - Support for Home Assistant MQTT discovery
  - TLS/SSL connection support

- **Home Assistant bridge** (TASK-039)
  - HA API integration
  - Entity discovery and control
  - State synchronization
  - Event-based automation triggers
  - HA webhook support

- **Local network discovery** (TASK-041)
  - mDNS/Bonjour device discovery
  - UPnP device detection
  - Manual IP entry fallback
  - Local-first operation mode

#### Ecowitt Weather Station Integration
- **Ecowitt adapter** for weather station data
  - Real-time weather data via webhook
  - Support for 20+ sensor types (temperature, humidity, wind, rain, UV, soil moisture, etc.)
  - Multiple device support per account
  - Automatic sensor reading storage
  - Weather-based automation triggers

- **Ecowitt webhook endpoint** (`/api/ecowitt`)
  - Secure webhook validation
  - Multi-tenant support
  - Rate limiting protection
  - Error recovery and logging

#### Infrastructure & Performance
- **Database optimizations**
  - New sensor type mappings for Ecowitt devices
  - Indexed queries for faster data retrieval
  - Connection pooling improvements
  - Query result caching

- **Real-time updates**
  - Supabase Realtime subscriptions for live data
  - WebSocket connection management
  - Automatic reconnection on failure
  - Client-side data synchronization

- **Improved error logging**
  - Structured error logging with severity levels
  - Error aggregation and reporting
  - Client-side error tracking
  - Performance monitoring

### Changed

#### Dashboard & UI
- **Dashboard empty states** improved to match demo quality
  - Actionable empty state messages
  - Quick-start buttons and links
  - Visual illustrations for empty states
  - Context-aware suggestions

- **Controller onboarding UX** significantly enhanced
  - Streamlined add controller flow
  - Better credential validation feedback
  - Discovery improvements with loading states
  - Success/error messaging clarity

- **Device control UI** for connected controllers
  - Unified control panel for all device types
  - Real-time status updates
  - Port-based device grouping
  - Quick action buttons

#### Technical Improvements
- **VPD calculation consistency** across dashboard
  - Fixed race conditions in VPD computation
  - Consistent formula application
  - Proper unit handling (Fahrenheit/Celsius)
  - Historical VPD recalculation

- **Encryption system enhancements**
  - Better error logging for encryption failures
  - Automatic whitespace trimming from encryption keys
  - Key validation on startup
  - Secure key rotation support

- **AC Infinity adapter reliability**
  - Fixed API authentication issues
  - Improved sensor polling infrastructure
  - Better error handling for rate limits
  - Device capability detection improvements

### Fixed

#### Critical Fixes
- **Race conditions** in VPD calculation and dashboard updates (TASK-007)
- **Controller discovery flow** - properly saves credentials and supports multi-select (TASK-014)
- **Discovered device capabilities** - correct database format conversion (TASK-015)
- **Database schema alignment** - is_online column type consistency (TASK-010)
- **AC Infinity API** - authentication and sensor polling reliability (TASK-006)

#### UI/UX Fixes
- **Error guidance** integrated across UI for better user experience (TASK-004)
- **Dashboard empty states** now actionable and informative (TASK-012)
- **Controller status indicators** - accurate real-time status (TASK-009)
- **Analytics controller query** - proper is_online field selection (TASK-017)

#### Backend Fixes
- **Mock adapter replacement** - real ACInfinityAdapter in sensors route (TASK-008)
- **Encryption error handling** - better logging and validation (TASK-005)
- **Sensor reading storage** - proper timestamp and value handling (TASK-018)
- **Webhook validation** - secure request verification (TASK-037)

### Security

#### Authentication & Authorization
- **Credential encryption** - AES-256-GCM for all controller credentials
- **Encryption key validation** - startup checks for proper key format
- **Row-level security** - Supabase RLS policies for all tables
- **API key rotation** - support for key rotation without downtime

#### API Security
- **Rate limiting** on credential update endpoints
- **Webhook validation** - cryptographic signature verification for Ecowitt
- **CORS policy** - strict origin validation
- **SQL injection protection** - parameterized queries throughout

#### Audit & Compliance
- **Audit logging** for sensitive actions
  - Controller credential updates
  - User permission changes
  - Bulk operations
  - Data exports
- **GDPR compliance** preparations
  - Data export functionality
  - User data deletion support
  - Privacy policy integration points

### Deprecated

- **Mock adapter** - replaced with real controller adapters
- **Legacy error handling** - replaced with structured error guidance system
- **Old dashboard layout** - replaced with upgraded UI components

### Removed

- **Deprecated dashboard documentation** (dashboard-upgrade2.md)
- **Old Ecowitt documentation** (ecowitt.md) - replaced with comprehensive guide

### Breaking Changes

None - this is the first major release with full backward compatibility.

### Migration Guide

If upgrading from a pre-2.0 installation:

1. **Database migrations required:**
   - Run `/apps/automation-engine/supabase/migrations/20260124_add_ecowitt_sensor_types.sql`
   - This adds support for Ecowitt weather station sensor types

2. **Environment variables:**
   - Ensure `ENCRYPTION_KEY` is set (64-character hex string)
   - Add `XAI_API_KEY` for AI-powered features (optional)
   - Add `GOVEE_API_KEY` for Govee integration (optional)

3. **Controller re-authentication:**
   - Controllers added before 2.0 may need credential re-entry
   - Use the "Test Connection" feature to verify
   - Bulk operations can help re-test multiple controllers

4. **Data export:**
   - Export existing data before upgrading if desired
   - New export formats are compatible with old data

## [1.0.0] - 2026-01-21

Initial MVP release.

### Added
- AC Infinity controller integration
- Inkbird controller integration (CSV upload)
- CSV upload for manual data entry
- Dashboard with real-time sensor monitoring
- VPD calculation and visualization
- Room-based controller organization
- Workflow automation engine
- Visual workflow builder (React Flow)
- Supabase authentication and database
- Vercel cron-based automation execution
- Activity logging
- AI insights via Grok API

### Security
- AES-256-GCM credential encryption
- Supabase Row-Level Security (RLS)
- Secure credential storage
- Environment-based configuration

---

## Upcoming Releases

### [2.1.0] - Q1 2026 (Planned)

#### Phase 4 Features
- Mobile-responsive improvements
- PWA (Progressive Web App) support
- Push notification enhancements
- Offline mode capabilities
- Performance optimizations for large installations (50+ controllers)

#### Additional Integrations
- Philips Hue integration
- Shelly device support
- Tuya/Smart Life integration
- Custom webhook support

#### Analytics Enhancements
- Predictive analytics (ML-based)
- Anomaly detection
- Growth stage tracking improvements
- Energy consumption tracking

### [3.0.0] - Q2 2026 (Planned)

- Multi-user support and team collaboration
- Role-based access control (RBAC)
- Organization/workspace management
- Advanced workflow features (loops, conditionals)
- Workflow marketplace and templates
- Native mobile apps (iOS and Android)
- White-label OEM support

---

## Version History

| Version | Release Date | Status | Highlights |
|---------|--------------|--------|------------|
| 2.0.0 | 2026-01-24 | Current | Multi-brand, advanced analytics, scheduling |
| 1.0.0 | 2026-01-21 | Stable | Initial MVP release |

---

## Getting Help

- **Documentation:** [docs/](https://github.com/yourusername/enviroflow/tree/main/docs)
- **User Guide:** [docs/user-guide/](https://github.com/yourusername/enviroflow/tree/main/docs/user-guide)
- **API Docs:** [docs/api/](https://github.com/yourusername/enviroflow/tree/main/docs/api)
- **Support:** support@enviroflow.app
- **Issues:** [GitHub Issues](https://github.com/yourusername/enviroflow/issues)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and how to contribute to EnviroFlow.

## License

See [LICENSE](LICENSE) for licensing information.
