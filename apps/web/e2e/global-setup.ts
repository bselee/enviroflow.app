/**
 * Global Setup for E2E Tests
 *
 * Creates test users in Supabase if they don't exist.
 * Runs once before all tests.
 *
 * IMPORTANT: This requires either:
 * 1. SUPABASE_SERVICE_ROLE_KEY environment variable for programmatic user creation
 * 2. Manual test user creation in Supabase Dashboard
 * 3. Disabled email confirmation in Supabase Auth settings
 *
 * See E2E_TEST_SETUP.md for detailed instructions.
 */

import { FullConfig } from '@playwright/test'
import { TEST_USER, TEST_USER_ALT } from './fixtures/test-data'

async function globalSetup(_config: FullConfig) {
  console.log('\n🔧 E2E Test Environment Setup')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Check if we can create users programmatically
  if (!supabaseUrl || !serviceRoleKey) {
    console.log('\n⚠️  Missing Supabase credentials')
    console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
    console.log('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗')
    console.log('\n📝 To run E2E tests, you need to either:')
    console.log('   1. Set SUPABASE_SERVICE_ROLE_KEY environment variable')
    console.log('   2. Manually create test users in Supabase Dashboard')
    console.log('   3. See e2e/E2E_TEST_SETUP.md for instructions')
    console.log('\n   Test users required:')
    console.log(`   - ${TEST_USER.email}`)
    console.log(`   - ${TEST_USER_ALT.email}`)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    return // Continue without failing - let tests handle auth issues
  }

  try {
    console.log('\n👤 Creating test users via Supabase Admin API...')

    // Dynamically import Supabase client to avoid bundling issues
    const { createClient } = await import('@supabase/supabase-js')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Create test users
    for (const user of [TEST_USER, TEST_USER_ALT]) {
      try {
        // Try to create user (will fail if already exists, which is fine)
        const { data, error } = await supabase.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            name: user.name,
          },
        })

        if (error) {
          // User might already exist
          if (error.message.includes('already registered')) {
            console.log(`   ✓ ${user.email} (already exists)`)
          } else {
            console.log(`   ⚠️  ${user.email} (${error.message})`)
          }
        } else {
          console.log(`   ✓ ${user.email} (created: ${data.user?.id})`)
        }
      } catch (error) {
        console.log(
          `   ⚠️  ${user.email} (${error instanceof Error ? error.message : 'unknown error'})`
        )
      }
    }

    console.log('\n✅ Test environment setup complete')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  } catch (error) {
    console.error('\n❌ Failed to setup test environment:', error)
    console.log('\n📝 Fallback: Ensure test users exist manually')
    console.log('   See e2e/E2E_TEST_SETUP.md for instructions')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    // Don't fail completely - let tests handle auth issues
  }
}

export default globalSetup
