const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars. Run with: source apps/web/.env.local && node scripts/check-tables.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkTables() {
  console.log('Checking database tables...\n');

  const tables = ['controller_health', 'device_schedules', 'alerts', 'activity_logs'];
  const results = {};

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    const exists = !error || !error.message.includes('does not exist');
    results[table] = { exists, error: error?.message };
    console.log(`${table}: ${exists ? 'EXISTS' : 'MISSING'}`);
    if (error && !error.message.includes('does not exist')) {
      console.log(`  └─ Note: ${error.message}`);
    }
  }

  // Check for specific columns mentioned in build errors
  console.log('\nChecking activity_logs.created_at column...');
  const { data: columns, error: colError } = await supabase
    .from('activity_logs')
    .select('created_at')
    .limit(1);

  if (colError) {
    console.log(`  └─ Column check: ${colError.message}`);
  } else {
    console.log('  └─ Column exists');
  }

  return results;
}

checkTables().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
