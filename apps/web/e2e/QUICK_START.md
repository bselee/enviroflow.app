# E2E Tests - Quick Start Guide

## 30-Second Setup

```bash
cd apps/web

# 1. Install browsers (first time only)
./e2e-setup.sh

# 2. Run tests interactively
npm run test:e2e:ui
```

## 5-Minute Tour

### Run Specific Tests

```bash
# All tests
npm run test:e2e

# Single test file
npx playwright test controller-setup.spec.ts

# Single test by name
npx playwright test -g "should add AC Infinity controller"

# Debug mode (step through test)
npm run test:e2e:debug

# Show browser while testing
npm run test:e2e:headed
```

### View Results

```bash
# Open HTML report
npm run test:e2e:report

# View trace file (detailed debug)
npx playwright show-trace test-results/[test-name]/trace.zip
```

## Test Files Overview

| File | Tests | What It Does |
|------|-------|--------------|
| `controller-setup.spec.ts` | 6 | Add controllers, assign to rooms |
| `device-control.spec.ts` | 7 | Control devices, view sensor data |
| `schedules.spec.ts` | 7 | Create schedules, verify execution |
| `bulk-operations.spec.ts` | 6 | Bulk assign/delete controllers |
| `export.spec.ts` | 9 | Export data to CSV/JSON |

**Total: 35+ test scenarios**

## Common Commands

```bash
# Development
npm run test:e2e:ui          # Interactive UI mode
npm run test:e2e:headed      # Show browser
npm run test:e2e:debug       # Debug mode

# Specific browsers
npm run test:e2e:chromium    # Desktop only
npm run test:e2e:mobile      # Mobile only

# Reporting
npm run test:e2e:report      # View HTML report
```

## CI Integration

Tests run automatically on:
- Pull requests to main/develop
- Pushes to main
- Manual trigger in GitHub Actions

Results: GitHub Actions → Artifacts → Download report

## Troubleshooting

### Browsers not installed?
```bash
./e2e-setup.sh
```

### Tests failing locally?
```bash
# Check dev server is running
npm run dev

# Run in debug mode
npm run test:e2e:debug
```

### Need to see what's happening?
```bash
# Run with visible browser
npm run test:e2e:headed
```

## File Locations

```
apps/web/e2e/
├── *.spec.ts              # Test files
├── fixtures/
│   ├── test-data.ts       # Test data
│   └── helpers.ts         # Helper functions
├── README.md              # Full documentation
└── QUICK_START.md         # This file

Test results:
├── test-results/          # Screenshots, traces
├── playwright-report/     # HTML report
```

## Key Features

- ✅ 35+ test scenarios
- ✅ Desktop + mobile testing
- ✅ Auto-cleanup test data
- ✅ Screenshots on failure
- ✅ CI/CD integration
- ✅ < 5 min execution time

## Next Steps

1. Read `README.md` for detailed guide
2. Run tests with `npm run test:e2e:ui`
3. Add `data-testid` to new UI components
4. Write tests for new features

---

**Need help?** See `README.md` or contact the team.
