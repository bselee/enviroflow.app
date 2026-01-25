#!/bin/bash

# E2E Test Setup Script
# Run this script to install Playwright browsers and verify test setup

set -e

echo "🎭 EnviroFlow E2E Test Setup"
echo "=============================="
echo ""

# Navigate to web app directory
cd "$(dirname "$0")"

# Install Playwright browsers
echo "📦 Installing Playwright browsers..."
npx playwright install chromium --with-deps

echo ""
echo "✅ Setup complete!"
echo ""
echo "Run tests with:"
echo "  npm run test:e2e              # Run all tests"
echo "  npm run test:e2e:ui           # Interactive UI mode"
echo "  npm run test:e2e:headed       # Show browser"
echo "  npm run test:e2e:debug        # Debug mode"
echo ""
echo "For more information, see: e2e/README.md"
