#!/usr/bin/env node

/**
 * Database Migration Script for EnviroFlow
 * Applies SQL migrations to Supabase database
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const SUPABASE_PROJECT_REF = 'vhlnnfmuhttjpwyobklu';
const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20260120_ai_analysis_tables.sql');

console.log('🔧 EnviroFlow Database Migration');
console.log('=================================\n');

// Read environment variables
const dbPassword = process.env.DB_PASSWORD;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dbPassword && !serviceKey) {
  console.error('❌ ERROR: Database credentials not set');
  console.error('\nOption 1 - Direct database connection:');
  console.error('  export DB_PASSWORD=your_postgres_password');
  console.error('\nOption 2 - Use Supabase dashboard:');
  console.error('  https://supabase.com/dashboard/project/' + SUPABASE_PROJECT_REF + '/sql');
  console.error('  Copy and paste the migration SQL manually\n');
  process.exit(1);
}

// Read migration file
console.log('📁 Reading migration file...');
const migrationSQL = fs.readFileSync(MIGRATION_FILE, 'utf8');
console.log('✓ Migration loaded:', path.basename(MIGRATION_FILE));
console.log('');

if (dbPassword) {
  // Use direct PostgreSQL connection
  console.log('🔌 Attempting direct database connection...');
  runWithPostgres(migrationSQL);
} else {
  // Show manual instructions
  console.log('📋 Manual Migration Required');
  console.log('============================\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/' + SUPABASE_PROJECT_REF + '/sql');
  console.log('2. Copy the SQL below');
  console.log('3. Paste into the SQL Editor');
  console.log('4. Click "Run"\n');
  console.log('--- SQL MIGRATION ---');
  console.log(migrationSQL);
  console.log('--- END MIGRATION ---\n');
}

function runWithPostgres(sql) {
  const { Client } = require('pg');
  
  const client = new Client({
    host: `db.${SUPABASE_PROJECT_REF}.supabase.co`,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPassword,
    ssl: { rejectUnauthorized: false }
  });

  client.connect()
    .then(() => {
      console.log('✓ Connected to database');
      console.log('📦 Applying migration...\n');
      return client.query(sql);
    })
    .then(() => {
      console.log('✅ Migration applied successfully!\n');
      console.log('🔍 Verifying tables...');
      return client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ai_insights', 'sensor_logs', 'automation_actions')
        ORDER BY table_name
      `);
    })
    .then((result) => {
      if (result.rows.length > 0) {
        console.log('✓ Tables created:');
        result.rows.forEach(row => console.log('  -', row.table_name));
      }
      return client.end();
    })
    .then(() => {
      console.log('\n✨ Database migration complete!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration failed:', err.message);
      console.error('\nFalling back to manual migration...\n');
      console.log('📋 Go to: https://supabase.com/dashboard/project/' + SUPABASE_PROJECT_REF + '/sql');
      console.log('📋 Run this SQL:\n');
      console.log('--- SQL MIGRATION ---');
      console.log(sql);
      console.log('--- END MIGRATION ---\n');
      client.end();
      process.exit(1);
    });
}
