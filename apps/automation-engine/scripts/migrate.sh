#!/bin/bash

# EnviroFlow Database Migration Script
# Applies SQL migrations to hosted Supabase instance

set -e

echo "🔧 EnviroFlow Database Migration"
echo "================================="

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Installing postgresql-client..."
    sudo apt-get update && sudo apt-get install -y postgresql-client
fi

# Database connection string
DB_URL="${DATABASE_URL:-postgresql://postgres:[YOUR-PASSWORD]@db.vhlnnfmuhttjpwyobklu.supabase.co:5432/postgres}"

if [[ "$DB_URL" == *"[YOUR-PASSWORD]"* ]]; then
    echo "❌ ERROR: Please set DATABASE_URL with your actual Supabase password"
    echo ""
    echo "   export DATABASE_URL='postgresql://postgres:YOUR_PASSWORD@db.vhlnnfmuhttjpwyobklu.supabase.co:5432/postgres'"
    echo ""
    exit 1
fi

# Get the migration directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$SCRIPT_DIR/../supabase/migrations"

echo "📁 Migration directory: $MIGRATION_DIR"
echo ""

# Check if migrations directory exists
if [ ! -d "$MIGRATION_DIR" ]; then
    echo "❌ Migrations directory not found: $MIGRATION_DIR"
    exit 1
fi

# Apply each migration file
for migration_file in "$MIGRATION_DIR"/*.sql; do
    if [ -f "$migration_file" ]; then
        filename=$(basename "$migration_file")
        echo "📦 Applying migration: $filename"
        
        # Run the migration
        if psql "$DB_URL" -f "$migration_file" 2>&1 | grep -v "NOTICE"; then
            echo "✅ Success: $filename"
        else
            echo "❌ Failed: $filename"
            exit 1
        fi
        echo ""
    fi
done

echo "✨ All migrations applied successfully!"
echo ""
echo "🔍 Verifying tables..."
psql "$DB_URL" -c "\dt" 2>&1 | grep -E "(ai_insights|sensor_logs|automation_actions)" || echo "Note: Run \dt in psql to see all tables"

echo ""
echo "✅ Database migration complete!"
