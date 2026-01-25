const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars');
  process.exit(1);
}

// Check if service role key looks valid
if (!serviceRoleKey.startsWith('eyJ')) {
  console.error('Service role key appears invalid');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key length:', serviceRoleKey.length);
console.log('Key prefix:', serviceRoleKey.substring(0, 20) + '...');

async function runSQL(sql, description) {
  console.log(`\nRunning: ${description}`);

  // Use the Supabase SQL API (PostgREST doesn't support raw SQL)
  // But we can use the pg API endpoint
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ sql_query: sql })
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('  Error:', error);
    return false;
  }

  console.log('  Success!');
  return true;
}

async function checkTableViaREST(tableName) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${tableName}?select=id&limit=1`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }
  });

  const body = await response.text();

  if (response.ok) {
    return { exists: true, message: 'Table exists' };
  } else if (body.includes('does not exist')) {
    return { exists: false, message: 'Table does not exist' };
  } else {
    return { exists: 'unknown', message: body };
  }
}

async function main() {
  console.log('=== Checking Tables ===\n');

  const tables = ['controller_health', 'device_schedules', 'alerts'];

  for (const table of tables) {
    const result = await checkTableViaREST(table);
    console.log(`${table}: ${result.exists === true ? 'EXISTS' : result.exists === false ? 'MISSING' : 'UNKNOWN'}`);
    if (result.exists !== true) {
      console.log(`  └─ ${result.message.substring(0, 100)}`);
    }
  }

  // Output migration SQL for manual execution
  console.log('\n\n=== MIGRATION SQL FOR SUPABASE DASHBOARD ===');
  console.log('Copy and paste the following SQL into your Supabase SQL Editor:');
  console.log(`${supabaseUrl.replace('.co', '.co/dashboard/project/')}/sql`);
  console.log('\n--- Copy below this line ---\n');

  const migrations = [
    '20260124_add_controller_health.sql',
    '20260124_add_device_schedules.sql',
    '20260124_add_alerts_system.sql'
  ];

  for (const migration of migrations) {
    const sqlPath = path.join(__dirname, '../apps/automation-engine/supabase/migrations', migration);
    if (fs.existsSync(sqlPath)) {
      console.log(`-- ========== ${migration} ==========\n`);
      console.log(fs.readFileSync(sqlPath, 'utf-8'));
      console.log('\n');
    }
  }
}

main().catch(console.error);
