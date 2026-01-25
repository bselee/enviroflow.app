#!/bin/bash

# E2E Test Setup Verification Script
# Checks if all required files and dependencies are in place

set -e

echo "🔍 Verifying E2E Test Setup"
echo "============================"
echo ""

cd "$(dirname "$0")/.."

# Check for package.json scripts
echo "✓ Checking package.json scripts..."
if grep -q "test:e2e" package.json; then
  echo "  ✅ Test scripts configured"
else
  echo "  ❌ Test scripts missing"
  exit 1
fi

# Check for Playwright config
echo ""
echo "✓ Checking Playwright configuration..."
if [ -f "playwright.config.ts" ]; then
  echo "  ✅ playwright.config.ts exists"
else
  echo "  ❌ playwright.config.ts missing"
  exit 1
fi

# Check for test files
echo ""
echo "✓ Checking test files..."
test_files=(
  "e2e/controller-setup.spec.ts"
  "e2e/device-control.spec.ts"
  "e2e/schedules.spec.ts"
  "e2e/bulk-operations.spec.ts"
  "e2e/export.spec.ts"
)

for file in "${test_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file missing"
    exit 1
  fi
done

# Check for fixture files
echo ""
echo "✓ Checking fixture files..."
fixture_files=(
  "e2e/fixtures/test-data.ts"
  "e2e/fixtures/helpers.ts"
)

for file in "${fixture_files[@]}"; do
  if [ -f "$file" ]; then
    echo "  ✅ $file"
  else
    echo "  ❌ $file missing"
    exit 1
  fi
done

# Check for CI workflow
echo ""
echo "✓ Checking CI workflow..."
if [ -f "../.github/workflows/e2e-tests.yml" ]; then
  echo "  ✅ GitHub Actions workflow exists"
else
  echo "  ⚠️  GitHub Actions workflow missing (optional)"
fi

# Check for documentation
echo ""
echo "✓ Checking documentation..."
if [ -f "e2e/README.md" ]; then
  echo "  ✅ README.md exists"
else
  echo "  ❌ README.md missing"
fi

# Check for Playwright installation
echo ""
echo "✓ Checking Playwright installation..."
if npm list @playwright/test > /dev/null 2>&1; then
  echo "  ✅ @playwright/test installed"
  version=$(npm list @playwright/test --depth=0 | grep @playwright/test | awk '{print $2}')
  echo "     Version: $version"
else
  echo "  ❌ @playwright/test not installed"
  echo "     Run: npm install"
  exit 1
fi

# Check for browsers
echo ""
echo "✓ Checking Playwright browsers..."
if [ -d "$HOME/.cache/ms-playwright" ] || [ -d "$HOME/Library/Caches/ms-playwright" ]; then
  echo "  ✅ Playwright browsers installed"
else
  echo "  ⚠️  Playwright browsers not installed"
  echo "     Run: ./e2e-setup.sh"
fi

# Count test scenarios
echo ""
echo "✓ Counting test scenarios..."
total_tests=$(grep -r "test(" e2e/*.spec.ts | wc -l)
echo "  ✅ $total_tests test scenarios found"

echo ""
echo "============================"
echo "✅ Setup verification complete!"
echo ""
echo "Next steps:"
echo "  1. Run ./e2e-setup.sh to install browsers (if needed)"
echo "  2. Run npm run test:e2e:ui to run tests interactively"
echo "  3. See e2e/README.md for more information"
echo ""
