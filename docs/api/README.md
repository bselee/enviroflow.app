# EnviroFlow API Documentation

EnviroFlow provides a comprehensive REST API for managing controllers, sensors, workflows, and automation.

## Table of Contents

1. [Authentication](#authentication)
2. [Controllers API](#controllers-api)
3. [Sensors API](#sensors-api)
4. [Rooms API](#rooms-api)
5. [Workflows API](#workflows-api)
6. [Analytics API](#analytics-api)
7. [Webhooks](#webhooks)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Examples](#examples)

## Base URL

```
Production: https://enviroflow.app/api
Development: http://localhost:3000/api
```

## Authentication

EnviroFlow uses Supabase authentication with JWT tokens.

### Getting an Access Token

```bash
# Login
curl -X POST https://enviroflow.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'

# Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "v1.MJUqYj...",
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  }
}
```

### Using the Token

Include the access token in the Authorization header:

```bash
curl -X GET https://enviroflow.app/api/controllers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Token Refresh

Tokens expire after 1 hour. Refresh using:

```bash
curl -X POST https://enviroflow.app/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "v1.MJUqYj..."
  }'
```

## Controllers API

Manage hardware controllers (AC Infinity, Govee, Ecowitt, MQTT, etc.).

### List Controllers

```http
GET /api/controllers
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Veg Room Controller",
      "brand": "ac_infinity",
      "type": "Controller 69 Pro",
      "room_id": "uuid",
      "is_online": true,
      "health_score": 98,
      "last_seen": "2026-01-24T10:30:00Z",
      "capabilities": ["temperature", "humidity", "fan_control"],
      "created_at": "2026-01-20T08:00:00Z"
    }
  ]
}
```

### Get Controller by ID

```http
GET /api/controllers/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Veg Room Controller",
    "brand": "ac_infinity",
    "type": "Controller 69 Pro",
    "room_id": "uuid",
    "is_online": true,
    "health_score": 98,
    "last_seen": "2026-01-24T10:30:00Z",
    "capabilities": ["temperature", "humidity", "fan_control"],
    "ports": [
      {
        "port": 1,
        "device_type": "fan",
        "device_name": "Exhaust Fan",
        "current_state": "on",
        "current_speed": 75
      }
    ],
    "created_at": "2026-01-20T08:00:00Z"
  }
}
```

### Add Controller

```http
POST /api/controllers
```

**Request Body:**

```json
{
  "name": "Flower Room Controller",
  "brand": "ac_infinity",
  "type": "Controller 69 Pro",
  "credentials": {
    "email": "user@example.com",
    "password": "controller-password"
  },
  "room_id": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Flower Room Controller",
    "brand": "ac_infinity",
    "type": "Controller 69 Pro",
    "is_online": true,
    "created_at": "2026-01-24T10:35:00Z"
  }
}
```

### Update Controller

```http
PUT /api/controllers/:id
```

**Request Body:**

```json
{
  "name": "Updated Name",
  "room_id": "new-room-uuid"
}
```

### Delete Controller

```http
DELETE /api/controllers/:id
```

**Response:**

```json
{
  "success": true,
  "message": "Controller deleted successfully"
}
```

### Discover Devices

```http
POST /api/controllers/discover
```

**Request Body:**

```json
{
  "brand": "ac_infinity",
  "credentials": {
    "email": "user@example.com",
    "password": "controller-password"
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "device_id": "12345",
        "device_name": "Controller 69 Pro",
        "device_type": "Controller 69 Pro",
        "is_online": true,
        "capabilities": ["temperature", "humidity", "fan_control"]
      }
    ]
  }
}
```

### Test Connection

```http
POST /api/controllers/:id/test
```

**Response:**

```json
{
  "success": true,
  "data": {
    "is_online": true,
    "latency_ms": 145,
    "last_reading": "2026-01-24T10:30:00Z"
  }
}
```

### Get Supported Brands

```http
GET /api/controllers/brands
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "ac_infinity",
      "name": "AC Infinity",
      "status": "full_support",
      "capabilities": ["cloud_api", "sensor_reading", "device_control"],
      "auth_method": "email_password"
    },
    {
      "id": "govee",
      "name": "Govee",
      "status": "full_support",
      "capabilities": ["cloud_api", "sensor_reading", "device_control", "led_control"],
      "auth_method": "api_key"
    }
  ]
}
```

## Sensors API

Read sensor data from controllers.

### Get Sensor Readings

```http
GET /api/controllers/:id/sensors
```

**Query Parameters:**
- `start_date` (optional): ISO 8601 timestamp
- `end_date` (optional): ISO 8601 timestamp
- `sensor_type` (optional): temperature, humidity, vpd, co2, etc.

**Response:**

```json
{
  "success": true,
  "data": {
    "controller_id": "uuid",
    "readings": [
      {
        "timestamp": "2026-01-24T10:30:00Z",
        "sensor_type": "temperature",
        "value": 75.5,
        "unit": "°F",
        "port": 1
      },
      {
        "timestamp": "2026-01-24T10:30:00Z",
        "sensor_type": "humidity",
        "value": 62.0,
        "unit": "%",
        "port": 2
      },
      {
        "timestamp": "2026-01-24T10:30:00Z",
        "sensor_type": "vpd",
        "value": 1.15,
        "unit": "kPa",
        "calculated": true
      }
    ]
  }
}
```

### Get Latest Sensor Reading

```http
GET /api/controllers/:id/sensors/latest
```

**Response:**

```json
{
  "success": true,
  "data": {
    "temperature": {
      "value": 75.5,
      "unit": "°F",
      "timestamp": "2026-01-24T10:30:00Z"
    },
    "humidity": {
      "value": 62.0,
      "unit": "%",
      "timestamp": "2026-01-24T10:30:00Z"
    },
    "vpd": {
      "value": 1.15,
      "unit": "kPa",
      "timestamp": "2026-01-24T10:30:00Z"
    }
  }
}
```

## Rooms API

Organize controllers by location.

### List Rooms

```http
GET /api/rooms
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Vegetative Room A",
      "description": "Main veg area",
      "controller_count": 3,
      "created_at": "2026-01-20T08:00:00Z"
    }
  ]
}
```

### Create Room

```http
POST /api/rooms
```

**Request Body:**

```json
{
  "name": "Flowering Room B",
  "description": "Secondary flower space"
}
```

### Update Room

```http
PUT /api/rooms/:id
```

### Delete Room

```http
DELETE /api/rooms/:id
```

## Workflows API

Manage automation workflows.

### List Workflows

```http
GET /api/workflows
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "VPD Control",
      "description": "Maintain optimal VPD",
      "is_active": true,
      "room_id": "uuid",
      "trigger_count": 145,
      "last_triggered": "2026-01-24T10:25:00Z",
      "created_at": "2026-01-20T08:00:00Z"
    }
  ]
}
```

### Get Workflow

```http
GET /api/workflows/:id
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "VPD Control",
    "description": "Maintain optimal VPD",
    "is_active": true,
    "room_id": "uuid",
    "nodes": [
      {
        "id": "node-1",
        "type": "trigger",
        "data": {
          "sensor_type": "vpd",
          "operator": ">",
          "threshold": 1.5
        }
      },
      {
        "id": "node-2",
        "type": "action",
        "data": {
          "device_type": "humidifier",
          "action": "turn_on"
        }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": "node-1",
        "target": "node-2"
      }
    ]
  }
}
```

### Create Workflow

```http
POST /api/workflows
```

**Request Body:**

```json
{
  "name": "Temperature Control",
  "description": "Keep temp in range",
  "room_id": "uuid",
  "nodes": [...],
  "edges": [...]
}
```

### Update Workflow

```http
PUT /api/workflows/:id
```

### Delete Workflow

```http
DELETE /api/workflows/:id
```

### Activate/Deactivate Workflow

```http
POST /api/workflows/:id/activate
POST /api/workflows/:id/deactivate
```

## Analytics API

Access analytics and reports.

### Get Analytics Summary

```http
GET /api/analytics
```

**Query Parameters:**
- `start_date`: ISO 8601 timestamp (required)
- `end_date`: ISO 8601 timestamp (required)
- `room_id`: Filter by room (optional)
- `controller_id`: Filter by controller (optional)

**Response:**

```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2026-01-17T00:00:00Z",
      "end": "2026-01-24T00:00:00Z"
    },
    "summary": {
      "avg_temperature": 74.2,
      "avg_humidity": 61.5,
      "avg_vpd": 1.12,
      "uptime_percentage": 99.8
    },
    "trends": {
      "temperature": "stable",
      "humidity": "increasing",
      "vpd": "optimal"
    }
  }
}
```

### Get Heatmap Data

```http
GET /api/analytics/heatmap
```

**Query Parameters:**
- `sensor_type`: temperature, humidity, vpd (required)
- `start_date`: ISO 8601 timestamp (required)
- `end_date`: ISO 8601 timestamp (required)
- `room_id`: Filter by room (optional)

**Response:**

```json
{
  "success": true,
  "data": {
    "sensor_type": "temperature",
    "heatmap": [
      {
        "hour": 0,
        "day": 0,
        "value": 72.5
      },
      {
        "hour": 1,
        "day": 0,
        "value": 72.3
      }
    ]
  }
}
```

### Get Correlation Data

```http
GET /api/analytics/correlation
```

**Query Parameters:**
- `sensor_x`: First sensor type (required)
- `sensor_y`: Second sensor type (required)
- `start_date`: ISO 8601 timestamp (required)
- `end_date`: ISO 8601 timestamp (required)

**Response:**

```json
{
  "success": true,
  "data": {
    "correlation_coefficient": 0.87,
    "significance": "high",
    "scatter_data": [
      { "x": 75.0, "y": 62.0 },
      { "x": 76.5, "y": 64.5 }
    ]
  }
}
```

### Export Data

```http
GET /api/export
```

**Query Parameters:**
- `format`: csv, json, pdf (required)
- `data_type`: sensors, workflows, activity (required)
- `start_date`: ISO 8601 timestamp (optional)
- `end_date`: ISO 8601 timestamp (optional)

**Response:**

Returns file download with appropriate Content-Type header.

## Webhooks

EnviroFlow supports incoming webhooks for external integrations.

### Ecowitt Webhook

```http
POST /api/ecowitt
```

**Headers:**
- No authentication required (validates using webhook signature)

**Request Body (application/x-www-form-urlencoded):**

```
PASSKEY=ABC123&dateutc=2026-01-24+10:30:00&tempf=75.5&humidity=62
```

**Response:**

```json
{
  "success": true,
  "message": "Data received"
}
```

### Custom Webhooks (Coming Soon)

```http
POST /api/webhooks/:webhook_id
```

## Error Handling

All API responses follow this format:

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Email or password is incorrect",
    "category": "credential_error",
    "details": {
      "field": "password",
      "suggestion": "Verify your password in the controller's official app"
    }
  }
}
```

### Error Categories

| Category | HTTP Status | Description |
|----------|-------------|-------------|
| `credential_error` | 401 | Authentication failed |
| `network_error` | 503 | Network or API connectivity issue |
| `configuration_error` | 400 | Invalid configuration or parameters |
| `controller_error` | 500 | Controller-specific error |
| `system_error` | 500 | Internal server error |

### Common Error Codes

| Code | Category | Description |
|------|----------|-------------|
| `INVALID_CREDENTIALS` | credential_error | Wrong email/password/API key |
| `CONTROLLER_OFFLINE` | network_error | Controller not reachable |
| `INVALID_PARAMETERS` | configuration_error | Missing or invalid parameters |
| `RATE_LIMIT_EXCEEDED` | network_error | Too many requests |
| `DEVICE_NOT_FOUND` | configuration_error | Controller/device not found |
| `PERMISSION_DENIED` | credential_error | Insufficient permissions |

## Rate Limiting

API requests are rate-limited to ensure fair usage:

| Endpoint | Limit | Window |
|----------|-------|--------|
| Authentication | 5 requests | 15 minutes |
| Controller operations | 60 requests | 1 minute |
| Sensor readings | 120 requests | 1 minute |
| Workflow execution | 30 requests | 1 minute |
| Analytics | 30 requests | 1 minute |

**Rate Limit Headers:**

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1706097600
```

**Rate Limit Exceeded Response:**

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "category": "network_error",
    "details": {
      "retry_after": 30
    }
  }
}
```

## Examples

### Complete Workflow: Add Controller and Read Sensors

```javascript
// 1. Login
const loginResponse = await fetch('https://enviroflow.app/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

const { access_token } = await loginResponse.json();

// 2. Add Controller
const addControllerResponse = await fetch('https://enviroflow.app/api/controllers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    name: 'Veg Room Controller',
    brand: 'ac_infinity',
    type: 'Controller 69 Pro',
    credentials: {
      email: 'ac@example.com',
      password: 'ac-password'
    }
  })
});

const { data: controller } = await addControllerResponse.json();

// 3. Get Latest Sensor Reading
const sensorsResponse = await fetch(
  `https://enviroflow.app/api/controllers/${controller.id}/sensors/latest`,
  {
    headers: {
      'Authorization': `Bearer ${access_token}`
    }
  }
);

const { data: sensors } = await sensorsResponse.json();
console.log('Temperature:', sensors.temperature.value, sensors.temperature.unit);
console.log('VPD:', sensors.vpd.value, sensors.vpd.unit);
```

### Python Example: Export Data

```python
import requests
from datetime import datetime, timedelta

# Login
login_response = requests.post(
    'https://enviroflow.app/api/auth/login',
    json={
        'email': 'user@example.com',
        'password': 'password'
    }
)
access_token = login_response.json()['access_token']

# Export last 7 days of sensor data
end_date = datetime.utcnow()
start_date = end_date - timedelta(days=7)

export_response = requests.get(
    'https://enviroflow.app/api/export',
    headers={'Authorization': f'Bearer {access_token}'},
    params={
        'format': 'csv',
        'data_type': 'sensors',
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat()
    }
)

# Save to file
with open('sensor_data.csv', 'wb') as f:
    f.write(export_response.content)
```

### cURL Example: Create Workflow

```bash
curl -X POST https://enviroflow.app/api/workflows \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "VPD Control",
    "description": "Maintain VPD between 0.8-1.5 kPa",
    "room_id": "room-uuid",
    "nodes": [
      {
        "id": "trigger-1",
        "type": "trigger",
        "data": {
          "sensor_type": "vpd",
          "operator": ">",
          "threshold": 1.5
        }
      },
      {
        "id": "action-1",
        "type": "action",
        "data": {
          "controller_id": "controller-uuid",
          "port": 3,
          "action": "turn_on"
        }
      }
    ],
    "edges": [
      {
        "id": "edge-1",
        "source": "trigger-1",
        "target": "action-1"
      }
    ]
  }'
```

## SDK & Client Libraries

Official client libraries coming soon:

- JavaScript/TypeScript SDK
- Python SDK
- Go SDK

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API changes across versions.

## Support

For API support:
- **Email:** api@enviroflow.app
- **Documentation:** https://docs.enviroflow.app
- **Status Page:** https://status.enviroflow.app
