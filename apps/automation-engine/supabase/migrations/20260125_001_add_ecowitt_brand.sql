-- Migration: Add 'ecowitt' to controllers.brand constraint
-- Date: 2026-01-25
-- Description: Adds 'ecowitt' brand to support Ecowitt weather stations and sensors

-- Drop existing constraint and add new one with ecowitt included
ALTER TABLE controllers DROP CONSTRAINT IF EXISTS controllers_brand_check;
ALTER TABLE controllers ADD CONSTRAINT controllers_brand_check
  CHECK (brand IN ('ac_infinity', 'inkbird', 'govee', 'ecowitt', 'csv_upload', 'mqtt', 'custom'));

-- Add comment for documentation
COMMENT ON COLUMN controllers.brand IS 'Controller brand: ac_infinity, inkbird, govee, ecowitt, csv_upload, mqtt, or custom';
