# Fix Sensor Display & Device Control
**Status**: 🟡 In Progress | **Started**: 2026-01-29

## Objective
Restore sensor data visibility and device control by fixing polling mechanisms and ensuring device discovery.

## Findings
1. **Background Polling Failure**: The "Immediate Poll" after adding a controller was implemented as a background promise without `await`. In serverless environments (Vercel), the process terminates immediately after the response is sent, killing the poll.
   - **Status**: ✅ Fixed in `/apps/web/src/app/api/controllers/route.ts`.
2. **Stale Data**: Periodic polling relies on Vercel Cron (`/api/cron/poll-sensors`). In local dev or unconfigured environments, this never runs.
   - **Impact**: Database contains stale data (last reading 4 days ago).
3. **Missing Devices**: The `controller_ports` table is empty. This table is populated during polling (specifically `storeControllerPorts`). Since polling hasn't completed successfully or regularly, devices are not discovered, preventing control.

## Success Metrics
- [ ] User sees sensor data immediately after adding a controller.
- [ ] Existing controllers show up-to-date availability (online).
- [ ] "Control" button shows list of devices (ports).
- [ ] `controller_ports` table is populated.

## Scope
In:
- Fix API route for immediate polling.
- Verify/Implement periodic polling strategy.
- Add "Force Sync" capability to UI (optional but recommended).
Out:
- Rewriting the entire automation engine.
