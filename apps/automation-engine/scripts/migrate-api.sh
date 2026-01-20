#!/bin/bash

# EnviroFlow Database Migration via Supabase API
# Applies SQL migrations using REST API

set -e

echo "🔧 EnviroFlow Database Migration (API Method)"
echo "=============================================="

# Supabase credentials
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://vhlnnfmuhttjpwyobklu.supabase.co}"
SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ ERROR: SUPABASE_SERVICE_ROLE_KEY not set"
    echo ""
    echo "   export SUPABASE_SERVICE_ROLE_KEY='your_service_role_key'"
    echo ""
    exit 1
fi

# Get the migration directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/../supabase/migrations"

echo "📁 Migration directory: $MIGRATION_DIR"
echo "🌐 Supabase URL: $SUPABASE_URL"
echo ""

# Read and execute migration
MIGRATION_FILE="$MIGRATION_DIR/20260120_ai_analysis_tables.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📦 Reading migration: $(basename "$MIGRATION_FILE")"
SQL_CONTENT=$(cat "$MIGRATION_FILE")

echo "🚀 Executing migration via Supabase SQL endpoint..."
echo ""

# Execute via Supabase REST API
response=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SQL_CONTENT" | jq -Rs .)}" \
  -w "\nHTTP_CODE:%{http_code}")

http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d':' -f2)
body=$(echo "$response" | sed '/HTTP_CODE/d')

if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
    echo "✅ Migration applied successfully!"
else
    echo "⚠️  API response (code: $http_code):"
    echo "$body"
    echo ""
    echo "📝 Note: If the API method doesn't work, use direct database connection:"
    echo "   Use the Supabase dashboard SQL Editor to run the migration manually"
    echo "   Or set DATABASE_URL and use psql directly"
fi

echo ""
echo "📊 You can verify tables in Supabase Dashboard:"
echo "   ${SUPABASE_URL/https:\/\//https://supabase.com/dashboard/project/}/editor"
