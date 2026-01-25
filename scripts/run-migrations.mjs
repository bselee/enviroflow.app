#!/usr/bin/env node
/**
 * Run pending database migrations via Supabase client
 * Uses service role key to bypass RLS
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please ensure .env.local is loaded');
  process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration files to run (in order)
const migrations = [
  '20260124_add_controller_health.sql',
  '20260124_add_device_schedules.sql',
  '20260124_add_alerts_system.sql',
];

async function runMigration(filename) {
  const migrationPath = join(__dirname, '../apps/automation-engine/supabase/migrations', filename);

  console.log(`\n=== Running migration: ${filename} ===`);

  try {
    const sql = readFileSync(migrationPath, 'utf-8');

    // Use the Supabase RPC to execute raw SQL
    // Note: This requires the exec_sql function or direct REST API call
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try splitting by statement if full execution fails
      console.log('Full execution failed, trying statement by statement...');
      throw error;
    }

    console.log(`✓ Migration ${filename} completed successfully`);
    return true;
  } catch (error) {
    console.error(`✗ Migration ${filename} failed:`, error.message);
    return false;
  }
}

async function checkTableExists(tableName) {
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  return !error || !error.message.includes('does not exist');
}

async function main() {
  console.log('EnviroFlow Database Migration Script');
  console.log('=====================================');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log('');

  // Check which tables already exist
  console.log('Checking existing tables...');

  const tables = ['controller_health', 'device_schedules', 'alerts'];
  for (const table of tables) {
    const exists = await checkTableExists(table);
    console.log(`  - ${table}: ${exists ? '✓ exists' : '✗ needs migration'}`);
  }

  console.log('\nNote: Migrations must be run via Supabase SQL Editor');
  console.log('Copy the SQL content and run at:');
  console.log(`  ${supabaseUrl.replace('.co', '.co/dashboard/project/')}/sql\n`);

  // Output the combined SQL for easy copy-paste
  console.log('=== COMBINED MIGRATION SQL ===\n');

  for (const migration of migrations) {
    const migrationPath = join(__dirname, '../apps/automation-engine/supabase/migrations', migration);
    try {
      const sql = readFileSync(migrationPath, 'utf-8');
      console.log(`-- ========== ${migration} ==========`);
      console.log(sql);
      console.log('');
    } catch (e) {
      console.error(`Could not read ${migration}:`, e.message);
    }
  }
}

main().catch(console.error);
