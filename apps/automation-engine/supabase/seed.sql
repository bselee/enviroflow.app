-- EnviroFlow Seed Data (for development/testing)
-- This file is run after migrations when using `supabase db reset`

-- Note: In development, you'll need to create a user first via the Supabase dashboard
-- or by signing up through your frontend. Then update the user_id below.

-- Example: Insert a test controller (requires valid user_id)
-- Replace 'your-user-uuid' with an actual user ID from auth.users

/*
-- Test Controller
INSERT INTO controllers (
  user_id,
  brand,
  controller_id,
  name,
  credentials,
  capabilities,
  is_online
) VALUES (
  'your-user-uuid'::uuid,
  'ac_infinity',
  'test-device-001',
  'Test Grow Room Controller',
  '{"email": "test@example.com", "password": "test123"}'::jsonb,
  '{
    "sensors": [
      {"port": 1, "type": "temperature", "unit": "F"},
      {"port": 1, "type": "humidity", "unit": "%"},
      {"port": 1, "type": "vpd", "unit": "kPa"}
    ],
    "devices": [
      {"port": 1, "type": "fan", "supportsDimming": true, "minLevel": 0, "maxLevel": 10},
      {"port": 2, "type": "light", "supportsDimming": true, "minLevel": 0, "maxLevel": 10}
    ]
  }'::jsonb,
  true
);

-- Test Workflow
INSERT INTO workflows (
  user_id,
  name,
  description,
  nodes,
  edges,
  is_active
) VALUES (
  'your-user-uuid'::uuid,
  'VPD Control',
  'Automatically adjusts fan speed based on VPD levels',
  '[
    {
      "id": "trigger-1",
      "type": "trigger",
      "position": {"x": 100, "y": 100},
      "data": {"label": "Every 60s", "variant": "timer"}
    },
    {
      "id": "condition-1",
      "type": "condition",
      "position": {"x": 300, "y": 100},
      "data": {"label": "VPD > 1.2", "sensorType": "vpd", "operator": ">", "threshold": 1.2}
    },
    {
      "id": "action-1",
      "type": "action",
      "position": {"x": 500, "y": 50},
      "data": {"label": "Fan High", "variant": "set_fan", "port": 1, "level": 80}
    },
    {
      "id": "action-2",
      "type": "action",
      "position": {"x": 500, "y": 150},
      "data": {"label": "Fan Low", "variant": "set_fan", "port": 1, "level": 40}
    }
  ]'::jsonb,
  '[
    {"id": "e1", "source": "trigger-1", "target": "condition-1"},
    {"id": "e2", "source": "condition-1", "target": "action-1", "data": {"branch": "true"}},
    {"id": "e3", "source": "condition-1", "target": "action-2", "data": {"branch": "false"}}
  ]'::jsonb,
  false
);
*/

-- Insert nothing by default (uncomment above for testing)
SELECT 'Seed file loaded. Uncomment sections above and update user_id for test data.';
