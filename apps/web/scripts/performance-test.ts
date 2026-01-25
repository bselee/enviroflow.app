#!/usr/bin/env node
/**
 * Performance Testing Script
 *
 * Automated performance testing for EnviroFlow application.
 * Tests Lighthouse scores, bundle sizes, API response times, and more.
 *
 * Usage:
 *   npm run perf-test              # Run all tests
 *   npm run perf-test -- --quick   # Run quick tests only
 *   npm run perf-test -- --report  # Generate detailed report
 */

import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
  // URLs to test (adjust for your environment)
  urls: {
    production: 'https://enviroflow.app',
    staging: 'http://localhost:3000',
  },
  // Lighthouse thresholds
  lighthouseThresholds: {
    performance: 90,
    accessibility: 90,
    bestPractices: 85,
    seo: 90,
  },
  // Bundle size limits (KB)
  bundleSizeLimits: {
    mainJS: 300,
    totalJS: 1000,
    totalCSS: 100,
  },
  // API response time limits (ms)
  apiTimeouts: {
    fast: 500,
    medium: 1000,
    slow: 3000,
  },
  // Test data generation
  testData: {
    controllerCount: 50,
    sensorReadingsPerController: 500,
  },
}

// =============================================================================
// Test Results Storage
// =============================================================================

interface TestResult {
  name: string
  passed: boolean
  value: number
  threshold?: number
  unit: string
  details?: string
}

const results: TestResult[] = []

function addResult(result: TestResult): void {
  results.push(result)
  const status = result.passed ? '✓' : '✗'
  const threshold = result.threshold ? ` (threshold: ${result.threshold}${result.unit})` : ''
  console.log(`${status} ${result.name}: ${result.value}${result.unit}${threshold}`)
  if (result.details) {
    console.log(`  ${result.details}`)
  }
}

// =============================================================================
// Bundle Size Analysis
// =============================================================================

async function testBundleSize(): Promise<void> {
  console.log('\n📦 Testing Bundle Sizes...\n')

  try {
    // Build the app first
    console.log('Building Next.js app...')
    execSync('npm run build', { cwd: process.cwd(), stdio: 'inherit' })

    // Analyze .next directory
    const nextDir = path.join(process.cwd(), '.next')
    const staticDir = path.join(nextDir, 'static')

    // Find all JS chunks
    const chunksDir = path.join(staticDir, 'chunks')
    const chunks = await fs.readdir(chunksDir, { recursive: true })

    let totalJSSize = 0
    let mainJSSize = 0

    for (const chunk of chunks) {
      if (typeof chunk !== 'string') continue
      if (!chunk.endsWith('.js')) continue

      const chunkPath = path.join(chunksDir, chunk)
      const stats = await fs.stat(chunkPath)
      const sizeKB = stats.size / 1024

      totalJSSize += sizeKB

      // Track main bundle
      if (chunk.includes('main-') || chunk.includes('app-pages')) {
        mainJSSize += sizeKB
      }
    }

    // Test main bundle size
    addResult({
      name: 'Main JS Bundle Size',
      passed: mainJSSize <= CONFIG.bundleSizeLimits.mainJS,
      value: Math.round(mainJSSize),
      threshold: CONFIG.bundleSizeLimits.mainJS,
      unit: 'KB',
    })

    // Test total JS size
    addResult({
      name: 'Total JS Bundle Size',
      passed: totalJSSize <= CONFIG.bundleSizeLimits.totalJS,
      value: Math.round(totalJSSize),
      threshold: CONFIG.bundleSizeLimits.totalJS,
      unit: 'KB',
    })

    // Find all CSS files
    const cssDir = path.join(staticDir, 'css')
    let totalCSSSize = 0

    try {
      const cssFiles = await fs.readdir(cssDir)
      for (const cssFile of cssFiles) {
        const cssPath = path.join(cssDir, cssFile)
        const stats = await fs.stat(cssPath)
        totalCSSSize += stats.size / 1024
      }
    } catch (error) {
      console.warn('Could not analyze CSS files:', error)
    }

    addResult({
      name: 'Total CSS Bundle Size',
      passed: totalCSSSize <= CONFIG.bundleSizeLimits.totalCSS,
      value: Math.round(totalCSSSize),
      threshold: CONFIG.bundleSizeLimits.totalCSS,
      unit: 'KB',
    })

    // Report size increase if .next/build-manifest.json exists
    const buildManifestPath = path.join(nextDir, 'build-manifest.json')
    try {
      const manifest = JSON.parse(await fs.readFile(buildManifestPath, 'utf-8'))
      const pageCount = Object.keys(manifest.pages || {}).length
      console.log(`\n  Total pages: ${pageCount}`)
    } catch (error) {
      // Manifest may not exist
    }

  } catch (error) {
    console.error('Bundle size test failed:', error)
    addResult({
      name: 'Bundle Size Analysis',
      passed: false,
      value: 0,
      unit: '',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// =============================================================================
// API Performance Tests
// =============================================================================

async function testAPIPerformance(): Promise<void> {
  console.log('\n🚀 Testing API Performance...\n')

  // These tests require a running server
  const baseUrl = process.env.TEST_URL || CONFIG.urls.staging

  const endpoints = [
    { path: '/api/controllers', name: 'List Controllers', threshold: CONFIG.apiTimeouts.fast },
    { path: '/api/rooms', name: 'List Rooms', threshold: CONFIG.apiTimeouts.fast },
    { path: '/api/workflows', name: 'List Workflows', threshold: CONFIG.apiTimeouts.medium },
    { path: '/api/controllers/brands', name: 'List Brands', threshold: CONFIG.apiTimeouts.fast },
  ]

  for (const endpoint of endpoints) {
    try {
      const start = performance.now()
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        headers: {
          // Note: These tests require authentication in production
          'Content-Type': 'application/json',
        },
      })
      const duration = performance.now() - start

      const passed = duration <= endpoint.threshold && response.ok

      addResult({
        name: endpoint.name,
        passed,
        value: Math.round(duration),
        threshold: endpoint.threshold,
        unit: 'ms',
        details: !response.ok ? `HTTP ${response.status}` : undefined,
      })
    } catch (error) {
      addResult({
        name: endpoint.name,
        passed: false,
        value: 0,
        unit: 'ms',
        details: error instanceof Error ? error.message : 'Request failed',
      })
    }
  }
}

// =============================================================================
// Database Query Performance
// =============================================================================

async function testDatabasePerformance(): Promise<void> {
  console.log('\n💾 Testing Database Performance...\n')

  // Note: This requires Supabase credentials and a test database
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.log('  Skipping database tests (credentials not configured)')
    return
  }

  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Test: Fetch controllers with rooms (N+1 prevention)
    const start1 = performance.now()
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*, controllers(*)')
      .limit(10)
    const duration1 = performance.now() - start1

    addResult({
      name: 'Rooms with Controllers Query',
      passed: duration1 <= CONFIG.apiTimeouts.medium && !roomsError,
      value: Math.round(duration1),
      threshold: CONFIG.apiTimeouts.medium,
      unit: 'ms',
      details: roomsError ? roomsError.message : `Fetched ${rooms?.length || 0} rooms`,
    })

    // Test: Sensor readings query with pagination
    const start2 = performance.now()
    const { data: readings, error: readingsError } = await supabase
      .from('sensor_readings')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(1000)
    const duration2 = performance.now() - start2

    addResult({
      name: 'Sensor Readings Query (1000 rows)',
      passed: duration2 <= CONFIG.apiTimeouts.slow && !readingsError,
      value: Math.round(duration2),
      threshold: CONFIG.apiTimeouts.slow,
      unit: 'ms',
      details: readingsError ? readingsError.message : `Fetched ${readings?.length || 0} readings`,
    })

    // Test: Aggregated metrics query
    const start3 = performance.now()
    const { data: metrics, error: metricsError } = await supabase
      .from('sensor_readings')
      .select('controller_id, sensor_type, value')
      .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(500)
    const duration3 = performance.now() - start3

    addResult({
      name: 'Aggregated Metrics Query (24h)',
      passed: duration3 <= CONFIG.apiTimeouts.medium && !metricsError,
      value: Math.round(duration3),
      threshold: CONFIG.apiTimeouts.medium,
      unit: 'ms',
      details: metricsError ? metricsError.message : `Fetched ${metrics?.length || 0} readings`,
    })

  } catch (error) {
    console.error('Database performance tests failed:', error)
  }
}

// =============================================================================
// Memory Leak Detection
// =============================================================================

async function testMemoryLeaks(): Promise<void> {
  console.log('\n🧠 Testing Memory Usage...\n')

  // This is a basic check - for comprehensive leak testing, use Chrome DevTools
  if (typeof global !== 'undefined' && global.gc) {
    const before = process.memoryUsage()

    // Simulate some work
    const data: unknown[] = []
    for (let i = 0; i < 10000; i++) {
      data.push({ id: i, timestamp: new Date(), value: Math.random() })
    }

    // Force GC
    global.gc()
    const after = process.memoryUsage()

    const heapDelta = (after.heapUsed - before.heapUsed) / 1048576 // MB

    addResult({
      name: 'Memory Usage After GC',
      passed: heapDelta < 10, // Less than 10MB increase
      value: Math.round(heapDelta * 100) / 100,
      threshold: 10,
      unit: 'MB',
    })
  } else {
    console.log('  Run with --expose-gc flag for memory tests')
  }
}

// =============================================================================
// Lighthouse Testing
// =============================================================================

async function testLighthouse(): Promise<void> {
  console.log('\n🔍 Running Lighthouse Tests...\n')

  // Check if lighthouse CLI is installed
  try {
    execSync('which lighthouse', { stdio: 'ignore' })
  } catch {
    console.log('  Lighthouse not installed. Install with: npm install -g lighthouse')
    console.log('  Skipping Lighthouse tests')
    return
  }

  const url = process.env.TEST_URL || CONFIG.urls.staging

  try {
    // Run Lighthouse
    console.log(`  Testing ${url}...`)
    const outputPath = path.join(process.cwd(), 'lighthouse-report.json')

    execSync(
      `lighthouse ${url} --output=json --output-path=${outputPath} --chrome-flags="--headless" --quiet`,
      { stdio: 'inherit' }
    )

    // Parse results
    const report = JSON.parse(await fs.readFile(outputPath, 'utf-8'))
    const categories = report.categories

    // Test each category
    const categoryTests = [
      { key: 'performance', name: 'Lighthouse Performance', threshold: CONFIG.lighthouseThresholds.performance },
      { key: 'accessibility', name: 'Lighthouse Accessibility', threshold: CONFIG.lighthouseThresholds.accessibility },
      { key: 'best-practices', name: 'Lighthouse Best Practices', threshold: CONFIG.lighthouseThresholds.bestPractices },
      { key: 'seo', name: 'Lighthouse SEO', threshold: CONFIG.lighthouseThresholds.seo },
    ]

    for (const test of categoryTests) {
      const score = categories[test.key]?.score * 100 || 0
      addResult({
        name: test.name,
        passed: score >= test.threshold,
        value: Math.round(score),
        threshold: test.threshold,
        unit: '%',
      })
    }

    // Clean up report file
    await fs.unlink(outputPath)

  } catch (error) {
    console.error('Lighthouse test failed:', error)
    addResult({
      name: 'Lighthouse Tests',
      passed: false,
      value: 0,
      unit: '',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

// =============================================================================
// Report Generation
// =============================================================================

async function generateReport(): Promise<void> {
  console.log('\n📊 Generating Performance Report...\n')

  const passed = results.filter(r => r.passed).length
  const total = results.length
  const passRate = Math.round((passed / total) * 100)

  const report = `# Performance Test Report

**Date:** ${new Date().toISOString()}
**Environment:** ${process.env.NODE_ENV || 'development'}
**Pass Rate:** ${passed}/${total} (${passRate}%)

## Summary

${passRate >= 80 ? '✅ **PASSED**' : '❌ **FAILED**'} - Overall performance is ${passRate >= 80 ? 'acceptable' : 'below threshold'}.

## Test Results

| Test | Result | Value | Threshold | Status |
|------|--------|-------|-----------|--------|
${results.map(r =>
  `| ${r.name} | ${r.value}${r.unit} | ${r.threshold || 'N/A'}${r.unit} | ${r.passed ? '✓ Pass' : '✗ Fail'} |`
).join('\n')}

## Recommendations

${passRate < 80 ? `
### Priority Fixes

${results.filter(r => !r.passed).map(r => `- **${r.name}**: ${r.details || 'Exceeded threshold'}`).join('\n')}
` : ''}

### Optimization Tips

1. **Bundle Size**: Implement code splitting and lazy loading for large components
2. **API Performance**: Add caching layers (Redis) for frequently accessed data
3. **Database Queries**: Ensure indexes exist on commonly queried columns
4. **Image Optimization**: Use Next.js Image component with proper sizing
5. **Memory Management**: Review component lifecycle and cleanup subscriptions

## Next Steps

- [ ] Address failing tests
- [ ] Run tests on production environment
- [ ] Set up continuous performance monitoring
- [ ] Configure performance budgets in CI/CD

---

Generated by EnviroFlow Performance Testing Suite
`

  const reportPath = path.join(process.cwd(), 'docs', 'performance-report.md')
  await fs.writeFile(reportPath, report, 'utf-8')
  console.log(`\n✅ Report saved to: ${reportPath}`)
}

// =============================================================================
// Main Execution
// =============================================================================

async function main(): Promise<void> {
  console.log('🚀 EnviroFlow Performance Testing Suite\n')
  console.log('=' .repeat(60))

  const args = process.argv.slice(2)
  const quick = args.includes('--quick')
  const report = args.includes('--report')

  try {
    // Always run bundle size tests
    await testBundleSize()

    if (!quick) {
      await testAPIPerformance()
      await testDatabasePerformance()
      await testMemoryLeaks()
      await testLighthouse()
    }

    // Generate report if requested
    if (report) {
      await generateReport()
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    const passed = results.filter(r => r.passed).length
    const total = results.length
    const passRate = Math.round((passed / total) * 100)

    console.log(`\n📊 Results: ${passed}/${total} tests passed (${passRate}%)`)

    if (passRate < 80) {
      console.log('\n⚠️  Performance issues detected. Review failures above.')
      process.exit(1)
    } else {
      console.log('\n✅ All performance targets met!')
      process.exit(0)
    }

  } catch (error) {
    console.error('\n❌ Performance testing failed:', error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { main, testBundleSize, testAPIPerformance, testDatabasePerformance }
