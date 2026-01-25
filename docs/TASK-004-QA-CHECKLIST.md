# TASK-004: Error Guidance System - QA Checklist

## Test Environment Setup

- [ ] Fresh browser session
- [ ] Test on desktop (Chrome, Firefox, Safari)
- [ ] Test on mobile (iOS Safari, Android Chrome)
- [ ] Test with different controller brands

## 1. Error Classification Tests

### Credentials Errors
- [ ] Test invalid email/password
- [ ] Test 401 Unauthorized response
- [ ] Test "Authentication failed" message
- [ ] Verify error classified as 'credentials'
- [ ] Verify NOT retryable
- [ ] Verify "Update Credentials" button appears

### Network Errors
- [ ] Test with airplane mode enabled
- [ ] Test with VPN blocking API
- [ ] Test "ECONNREFUSED" error
- [ ] Test timeout error
- [ ] Verify error classified as 'network'
- [ ] Verify IS retryable with 5s delay
- [ ] Verify "Try Again" button appears

### Offline Device Errors
- [ ] Test with powered-off controller
- [ ] Test "Controller is offline" message
- [ ] Test 503 Service Unavailable
- [ ] Verify error classified as 'offline'
- [ ] Verify IS retryable with 30s delay
- [ ] Verify "Refresh Status" button appears
- [ ] Verify last seen time displays

### Rate Limit Errors
- [ ] Test by making many rapid requests
- [ ] Test 429 Too Many Requests
- [ ] Test "Rate limit exceeded" message
- [ ] Verify error classified as 'rate_limit'
- [ ] Verify IS retryable with 60s delay
- [ ] Verify "Wait & Retry" button appears

### Server Errors
- [ ] Test 500 Internal Server Error
- [ ] Test "Service unavailable" message
- [ ] Verify error classified as 'server'
- [ ] Verify IS retryable with 30s delay
- [ ] Verify "Try Again" button appears

## 2. UI Component Tests

### Standard Error Guidance
- [ ] Error icon displays correctly
- [ ] Error title is user-friendly
- [ ] Error message is clear
- [ ] First troubleshooting step visible
- [ ] "Show troubleshooting steps" expands
- [ ] All steps numbered correctly
- [ ] Help links work (check each)
- [ ] Support info displays
- [ ] Action buttons work
- [ ] Color scheme matches error type

### Compact Mode
- [ ] Error displays inline
- [ ] Icon + title + brief message visible
- [ ] Retry button appears for retryable errors
- [ ] No expansion sections
- [ ] Fits in small containers
- [ ] Mobile friendly

### Last Seen Time
- [ ] Displays for offline errors
- [ ] Shows relative time (e.g., "2 hours ago")
- [ ] Updates correctly
- [ ] Shows "Never" if null
- [ ] Formats correctly on mobile

### Connection Diagnostics
- [ ] "Show connection diagnostics" button appears
- [ ] Only shows for connection/discovery context
- [ ] Expands to show steps
- [ ] Each step has:
  - [ ] Step number and title
  - [ ] Description
  - [ ] Expected result (green)
  - [ ] Troubleshoot tip (amber)
- [ ] Brand-specific content shows

## 3. Brand-Specific Guidance

### AC Infinity
- [ ] Credentials error mentions AC Infinity app
- [ ] Network error mentions 2.4GHz WiFi
- [ ] Offline error shows WiFi indicator check
- [ ] Connection diagnostics show compatibility check
- [ ] Support URL links to acinfinity.com

### Ecowitt
- [ ] Credentials error mentions API keys
- [ ] Connection diagnostics show MAC address format
- [ ] Gateway status checks included
- [ ] Sensor range troubleshooting shown

### MQTT
- [ ] Credentials error mentions broker auth
- [ ] Connection diagnostics show WebSocket requirement
- [ ] Topic configuration help shown
- [ ] Broker accessibility checks included

### CSV Upload
- [ ] No credentials errors (N/A)
- [ ] Connection diagnostics show template download
- [ ] Format validation tips shown

## 4. Action Handlers

### Retry Action
- [ ] onRetry callback fires
- [ ] Button disables during retry
- [ ] Success clears error
- [ ] Failure shows new error
- [ ] Retry count tracked (if implemented)

### Update Credentials Action
- [ ] Navigates to edit page
- [ ] Correct controller ID in URL
- [ ] Page loads successfully
- [ ] No 404 errors

### Login Action
- [ ] Navigates to /login
- [ ] Login page loads
- [ ] Can return to original page after login

### Refresh Action
- [ ] Triggers reload or retry
- [ ] Fresh data fetched
- [ ] Error clears on success

## 5. Activity Logging

### API Route Logging
- [ ] Error logged to activity_logs table
- [ ] user_id populated correctly
- [ ] controller_id populated (if applicable)
- [ ] action_type is 'error_[type]'
- [ ] details contains error_type, brand, context
- [ ] error_message populated
- [ ] ip_address captured
- [ ] user_agent captured
- [ ] created_at timestamp correct

### Database Queries
```sql
-- Verify recent error logs
SELECT * FROM activity_logs
WHERE action_type LIKE 'error_%'
ORDER BY created_at DESC
LIMIT 10;
```

- [ ] All fields populated correctly
- [ ] JSONB details parseable
- [ ] No duplicate logs
- [ ] RLS policies working

## 6. Mobile Responsiveness

### iPhone (iOS Safari)
- [ ] Error guidance fits screen
- [ ] Text readable without zoom
- [ ] Buttons tap-able (min 44x44px)
- [ ] Expansion animations smooth
- [ ] No horizontal scroll
- [ ] Compact mode works well

### Android (Chrome)
- [ ] Error guidance fits screen
- [ ] Text readable without zoom
- [ ] Buttons tap-able
- [ ] Expansion animations smooth
- [ ] No horizontal scroll
- [ ] Compact mode works well

### Tablet
- [ ] Error guidance not too wide
- [ ] Proper spacing maintained
- [ ] Touch targets appropriate

## 7. Accessibility

- [ ] Screen reader announces errors
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Color contrast sufficient (WCAG AA)
- [ ] Buttons have aria-labels
- [ ] Expandable sections have aria-expanded

## 8. Edge Cases

- [ ] Empty error message → Shows default
- [ ] Null error → Doesn't crash
- [ ] Very long error message → Truncates/scrolls
- [ ] No brand specified → Generic guidance
- [ ] No context specified → Works with 'general'
- [ ] No user ID → Logs warning, doesn't crash
- [ ] Multiple rapid errors → Shows latest
- [ ] Network offline → Logging fails gracefully

## 9. Performance

- [ ] Error classification < 1ms
- [ ] Logging doesn't block response
- [ ] Component renders quickly
- [ ] No memory leaks on retry
- [ ] Animations smooth (60fps)
- [ ] No layout shift on expansion

## 10. Integration Tests

### Controller Connection Flow
```
1. Go to Add Controller
2. Enter invalid credentials
   → Should show credentials error
3. Click "Update Credentials"
   → Should edit fields or navigate
4. Enter valid credentials
   → Error should clear
```

- [ ] Full flow works
- [ ] Error persists until fixed
- [ ] Success clears error

### Controller Discovery Flow
```
1. Go to Discover Devices
2. Enter valid credentials with no devices
   → Should show "No devices found"
3. Click "Show connection diagnostics"
   → Should show brand-specific steps
4. Fix issue
5. Click retry
   → Should discover devices
```

- [ ] Full flow works
- [ ] Diagnostics helpful
- [ ] Retry works

### Device Control Flow
```
1. Go to controller dashboard
2. Click device control (with device offline)
   → Should show offline error
3. Check last seen time
   → Should show relative time
4. Power on device
5. Click retry
   → Should succeed
```

- [ ] Full flow works
- [ ] Last seen accurate
- [ ] Retry clears error

## 11. Documentation

- [ ] error-guidance-system.md complete
- [ ] error-handling-migration.md clear
- [ ] error-guidance-examples.md accurate
- [ ] All code examples work
- [ ] All links work (no 404s)
- [ ] TypeScript examples compile

## 12. Security

- [ ] No sensitive data in error messages
- [ ] No stack traces exposed
- [ ] No credentials in logs
- [ ] RLS policies enforced
- [ ] IP addresses anonymized (if required)
- [ ] Activity logs protected

## Known Issues to Verify

1. **Help Page 404s**
   - [ ] /reset-password exists or handled
   - [ ] /troubleshooting/network exists or handled
   - [ ] /troubleshooting/offline exists or handled
   - [ ] /troubleshooting/server-errors exists or handled

2. **Type Compatibility**
   - [ ] ActivityLog interface works with old code
   - [ ] timestamp/created_at aliasing works
   - [ ] action_data/details aliasing works

## Regression Tests

Test that existing features still work:

- [ ] Old error messages still display
- [ ] useActivityLogs hook still works
- [ ] Activity log dashboard shows errors
- [ ] Filtering by error type works
- [ ] Export includes error logs

## Sign-Off

- [ ] All critical tests pass
- [ ] All blocking issues resolved
- [ ] Documentation reviewed
- [ ] Performance acceptable
- [ ] Mobile tested
- [ ] Security verified

**Tested by:** _______________
**Date:** _______________
**Build:** _______________

## Notes

Use this section to document any issues found:

```
Issue #1: [Description]
  Severity: Critical/High/Medium/Low
  Steps to reproduce:
  Expected:
  Actual:
  Status: Open/Fixed/Won't Fix

Issue #2: ...
```
