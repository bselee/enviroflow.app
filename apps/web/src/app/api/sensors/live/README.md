# Live Sensor Data API

**Endpoint:** `GET /api/sensors/live`

## Purpose

Fetches real-time sensor data directly from the AC Infinity cloud API without any database operations. This endpoint is designed for live monitoring, testing, and debugging purposes.

## Features

- **No Database Operations**: Pure API passthrough with data transformation
- **Direct AC Infinity Integration**: Fetches from `https://myacinfinity.com/api/user/devInfoListAll`
- **Automatic VPD Calculation**: Calculates VPD from temperature and humidity when not provided
- **10-Second Timeout**: Prevents hanging requests
- **Port Information**: Includes device port status and speed information

## Configuration

### Required Environment Variable

```bash
AC_INFINITY_TOKEN=your_ac_infinity_token_here
```

The token is obtained from the AC Infinity login API and must be set in your environment variables.

## Request

```bash
GET /api/sensors/live
```

**Headers:** None required

**Query Parameters:** None

## Response

### Success Response (200 OK)

```json
{
  "sensors": [
    {
      "id": "1424979258063365808",
      "name": "Biggie",
      "deviceType": "ac_infinity",
      "temperature": 75.5,
      "humidity": 55.0,
      "vpd": 1.07,
      "online": true,
      "lastUpdate": "2026-01-30T12:00:00.000Z",
      "ports": [
        {
          "portId": 1,
          "name": "Exhaust Fan",
          "speed": 7,
          "isOn": true
        },
        {
          "portId": 2,
          "name": "Intake Fan",
          "speed": 0,
          "isOn": false
        }
      ]
    }
  ],
  "timestamp": "2026-01-30T12:00:00.000Z",
  "source": "ac_infinity",
  "count": 1,
  "responseTimeMs": 245
}
```

### Error Response (500/504)

```json
{
  "sensors": [],
  "timestamp": "2026-01-30T12:00:00.000Z",
  "source": "ac_infinity",
  "count": 0,
  "responseTimeMs": 10000,
  "error": "Request timed out after 10 seconds"
}
```

## Response Fields

### LiveSensorResponse

| Field | Type | Description |
|-------|------|-------------|
| `sensors` | `LiveSensor[]` | Array of sensor data from devices |
| `timestamp` | `string` | ISO 8601 timestamp of when the data was fetched |
| `source` | `'ac_infinity'` | Data source identifier |
| `count` | `number` | Number of sensors returned |
| `responseTimeMs` | `number` | API response time in milliseconds |
| `error` | `string?` | Error message if request failed |

### LiveSensor

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique device identifier (devId) |
| `name` | `string` | Device name |
| `deviceType` | `'ac_infinity'` | Device type |
| `temperature` | `number` | Temperature in Fahrenheit |
| `humidity` | `number` | Relative humidity percentage (0-100) |
| `vpd` | `number` | Vapor Pressure Deficit in kPa |
| `online` | `boolean` | Device online status |
| `lastUpdate` | `string` | ISO 8601 timestamp |
| `ports` | `LivePort[]?` | Array of port information |

### LivePort

| Field | Type | Description |
|-------|------|-------------|
| `portId` | `number` | Port number (1-4) |
| `name` | `string` | Port name |
| `speed` | `number` | Fan/device speed (0-10) |
| `isOn` | `boolean` | Whether the port is currently on |

## Data Transformations

The endpoint performs the following transformations on AC Infinity API data:

1. **Temperature Conversion**: Divides raw value by 100 (e.g., 7550 → 75.5°F)
2. **Humidity Conversion**: Divides raw value by 100 (e.g., 5500 → 55.0%)
3. **VPD Conversion**: Divides raw value by 100 (e.g., 107 → 1.07 kPa)
4. **VPD Calculation**: If VPD is not provided, calculates from temperature and humidity using the Magnus-Tetens formula:
   ```
   VPD = SVP × (1 - RH/100)
   SVP = 0.6108 × exp(17.27 × T / (T + 237.3))
   ```

## Error Handling

The endpoint handles the following error scenarios:

- **Missing Token**: Returns 500 with error message
- **Timeout**: Returns 504 after 10 seconds
- **API Error**: Returns appropriate status code with error message
- **Invalid Response**: Returns 400 with error details

## Usage Examples

### cURL

```bash
curl http://localhost:3000/api/sensors/live
```

### JavaScript/TypeScript

```typescript
async function fetchLiveSensors() {
  const response = await fetch('/api/sensors/live')
  const data = await response.json()

  if (data.error) {
    console.error('Error fetching sensors:', data.error)
    return
  }

  console.log(`Fetched ${data.count} sensors in ${data.responseTimeMs}ms`)
  data.sensors.forEach(sensor => {
    console.log(`${sensor.name}: ${sensor.temperature}°F, ${sensor.humidity}%, VPD: ${sensor.vpd} kPa`)
  })
}
```

### React Hook

```typescript
import { useEffect, useState } from 'react'

interface UseLiveSensorsResult {
  sensors: LiveSensor[]
  loading: boolean
  error: string | null
  refetch: () => void
}

function useLiveSensors(intervalMs?: number): UseLiveSensorsResult {
  const [sensors, setSensors] = useState<LiveSensor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSensors = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/sensors/live')
      const data = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setSensors(data.sensors)
        setError(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSensors()

    if (intervalMs) {
      const interval = setInterval(fetchSensors, intervalMs)
      return () => clearInterval(interval)
    }
  }, [intervalMs])

  return { sensors, loading, error, refetch: fetchSensors }
}

// Usage: Poll every 30 seconds
const { sensors, loading, error } = useLiveSensors(30000)
```

## Testing

To test the endpoint locally:

1. Set the `AC_INFINITY_TOKEN` environment variable in `.env.local`
2. Start the development server: `npm run dev`
3. Navigate to `http://localhost:3000/api/sensors/live` in your browser
4. Or use the cURL command above

## Performance

- **Typical Response Time**: 200-500ms
- **Timeout**: 10 seconds
- **Caching**: Disabled (always fetches fresh data)
- **Rate Limiting**: None (consider adding if needed)

## Security Considerations

- **Token Security**: The AC_INFINITY_TOKEN is server-side only and never exposed to clients
- **No Authentication**: This endpoint does not require user authentication (consider adding if deploying to production)
- **CORS**: Not configured (same-origin only)

## Future Enhancements

- [ ] Add user authentication requirement
- [ ] Implement rate limiting
- [ ] Add support for multiple AC Infinity accounts
- [ ] Cache responses with short TTL (5-10 seconds)
- [ ] Add WebSocket support for real-time updates
- [ ] Support filtering by device ID
