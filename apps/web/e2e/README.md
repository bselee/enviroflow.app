# EnviroFlow E2E Tests

Comprehensive end-to-end tests for critical user journeys using Playwright.

## Test Coverage

### 1. Controller Setup (`controller-setup.spec.ts`)
- Add AC Infinity controller
- Test connection with credentials
- Assign controller to room
- Verify dashboard display
- Update room assignments
- Delete controllers
- Display controller capabilities

### 2. Device Control (`device-control.spec.ts`)
- Control AC Infinity devices
- Display device status indicators
- Handle device control errors
- Filter activity log by controller
- Show real-time sensor readings
- Toggle device dimming levels
- Handle concurrent device commands

### 3. Schedule Management (`schedules.spec.ts`)
- Create time-based schedules
- Create sunrise/sunset schedules with offset
- Toggle schedule active state
- Display next execution time
- Delete schedules
- Show schedule execution in activity log

### 4. Bulk Operations (`bulk-operations.spec.ts`)
- Bulk assign 3 controllers to room
- Handle partial success/failure scenarios
- Bulk delete multiple controllers
- Show progress indicators
- Validate bulk operation limits
- Maintain transaction integrity

### 5. Data Export (`export.spec.ts`)
- Export sensor data to CSV
- Verify CSV structure and headers
- Validate data values
- Export in JSON format
- Filter by date range
- Filter by controller
- Filter by sensor type
- Handle empty exports
- Limit export size

## Running Tests

### Local Development

```bash
# Install dependencies and browsers
npm install
npx playwright install

# Run all tests
npm run test:e2e

# Run in UI mode (interactive)
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed

# Run in debug mode
npm run test:e2e:debug

# Run specific project
npm run test:e2e:chromium
npm run test:e2e:mobile

# Run specific test file
npx playwright test controller-setup.spec.ts

# Run specific test
npx playwright test -g "should add AC Infinity controller"

# View test report
npm run test:e2e:report
```

### CI Environment

Tests run automatically on:
- Pull requests to `main` or `develop` branches
- Pushes to `main` branch
- Manual workflow dispatch

Tests are sharded across 2 parallel jobs for faster execution.

## Test Configuration

See `playwright.config.ts` for:
- Timeout settings (60s per test, 5min total)
- Retry policy (2 retries on CI, 0 locally)
- Screenshot and video capture settings
- Browser configurations
- Web server auto-start

## Test Data

Test fixtures are located in `e2e/fixtures/`:

- **`test-data.ts`** - Test user credentials, controller configs, room settings, schedules, etc.
- **`helpers.ts`** - Reusable helper functions for login, navigation, API calls, cleanup

All test data is prefixed with "E2E" for easy identification and cleanup.

## Best Practices

### 1. Test Isolation
Each test is independent and can run in any order. Use `beforeEach` and `afterEach` hooks for setup/cleanup.

### 2. Cleanup
Always cleanup test data after tests to avoid pollution:
```typescript
test.afterEach(async ({ page }) => {
  await cleanupTestData(page)
})
```

### 3. Waiting for Elements
Use explicit waits instead of arbitrary timeouts:
```typescript
await waitForElement(page, selector)
await waitForApiResponse(page, '/api/controllers')
```

### 4. Selectors
Prefer `data-testid` attributes over text or CSS selectors:
```typescript
await page.click('[data-testid="add-controller"]')
```

### 5. API vs UI Testing
- Use UI for critical user flows
- Use API for test data setup (faster)
- Use API for verification when UI is not available

### 6. Error Handling
Tests should handle scenarios where features may not be implemented yet:
```typescript
const hasFeature = await element.isVisible({ timeout: 5000 }).catch(() => false)
if (hasFeature) {
  // Test the feature
} else {
  console.log('Feature not available - skipping')
}
```

### 7. Mobile Testing
Mobile tests run on iPhone 12 viewport. Consider:
- Touch targets (44x44px minimum)
- Viewport width constraints
- Bottom navigation on mobile

## Debugging Failed Tests

### View Screenshots
Screenshots are captured on test failure:
```
apps/web/test-results/[test-name]/screenshot.png
```

### View Traces
Traces include full DOM snapshots, network activity, and console logs:
```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### View Video
Videos are recorded on first retry:
```
apps/web/test-results/[test-name]/video.webm
```

### Run in Debug Mode
Step through tests with Playwright Inspector:
```bash
npm run test:e2e:debug
```

### View HTML Report
Interactive HTML report with detailed results:
```bash
npm run test:e2e:report
```

## Performance Targets

- Individual test: < 60 seconds
- Full suite: < 5 minutes
- Pass rate: 100% (no flaky tests)
- Retries: Max 2 on CI

## Common Issues

### Authentication Errors
Ensure test user exists in Supabase with correct credentials (see `test-data.ts`).

### API Mocking
Some tests may fail if external APIs (AC Infinity, Govee) are not mocked. Tests are designed to gracefully handle this.

### Timeouts
If tests timeout:
1. Check network speed
2. Verify dev server is running
3. Check for API rate limits
4. Increase timeout in `playwright.config.ts`

### Flaky Tests
If tests are flaky:
1. Add explicit waits for async operations
2. Use `waitForLoadState('networkidle')`
3. Check for race conditions
4. Review retry logic

## CI/CD Integration

Tests integrate with GitHub Actions:
- **Sharding**: Tests split across 2 parallel jobs
- **Artifacts**: Screenshots, videos, and traces uploaded on failure
- **Reports**: HTML report generated and uploaded
- **PR Comments**: Test results posted to PR automatically

## Future Enhancements

- [ ] Add visual regression testing
- [ ] Add accessibility (a11y) testing
- [ ] Add performance testing (Core Web Vitals)
- [ ] Add API mocking layer for external services
- [ ] Add database seeding for consistent test data
- [ ] Add cross-browser testing (Firefox, Safari)
- [ ] Add load testing for concurrent users
- [ ] Add mobile app testing (React Native)

## Contributing

When adding new features:
1. Write E2E tests for critical user flows
2. Add test data to `test-data.ts`
3. Add helper functions to `helpers.ts`
4. Add `data-testid` attributes to UI components
5. Run tests locally before committing
6. Verify tests pass in CI before merging

## Support

For issues or questions:
- Review test output and screenshots
- Check Playwright documentation: https://playwright.dev
- Review existing tests for examples
- Ask in team chat or create GitHub issue
