# MQTT Controller Connection Guide

## Prerequisites

Before connecting MQTT devices to EnviroFlow, ensure:

- [ ] You have access to an MQTT broker (Mosquitto, HiveMQ, CloudMQTT, etc.)
- [ ] MQTT broker is accessible from the internet OR running locally
- [ ] You have MQTT broker credentials (username/password or client certificate)
- [ ] You know the broker address and port
- [ ] Your devices are publishing to MQTT topics
- [ ] You can subscribe to topics using an MQTT client (for testing)

## What is MQTT?

MQTT (Message Queuing Telemetry Transport) is a lightweight publish/subscribe messaging protocol ideal for IoT devices.

**Key Concepts:**
- **Broker:** Central server that routes messages (e.g., Mosquitto)
- **Topic:** Channel for messages (e.g., `home/growroom/temperature`)
- **Publish:** Devices send data to topics
- **Subscribe:** Applications listen to topics
- **QoS:** Quality of Service levels (0, 1, 2)

EnviroFlow acts as an MQTT **subscriber** to receive sensor data and a **publisher** to send control commands.

## Supported Devices

EnviroFlow's MQTT adapter supports:

### Generic MQTT Devices
- **DIY Sensors:** ESP8266, ESP32, Arduino with MQTT
- **Temperature/Humidity Sensors:** DHT22, BME280, SHT31
- **CO2 Sensors:** MH-Z19, SCD30, SCD40
- **Soil Moisture Sensors:** Capacitive soil sensors
- **Light Sensors:** BH1750, TSL2561
- **pH Sensors:** Atlas Scientific pH, analog pH
- **Water Level Sensors:** Ultrasonic, float switches

### Smart Home Platforms
- **Home Assistant:** MQTT entities
- **OpenHAB:** MQTT bindings
- **Node-RED:** MQTT nodes
- **Tasmota Devices:** Smart plugs, relays, sensors
- **ESPHome Devices:** Custom sensors and controls
- **Zigbee2MQTT:** Zigbee devices via MQTT bridge
- **Shelly Devices:** (with MQTT firmware)

### Commercial IoT Platforms
- **AWS IoT Core:** MQTT endpoint
- **Azure IoT Hub:** MQTT protocol
- **ThingSpeak:** MQTT publish
- **Adafruit IO:** MQTT feeds

## Step 1: Setup MQTT Broker

You need an MQTT broker to connect devices and EnviroFlow.

### Option A: Use a Public Cloud Broker

**HiveMQ Cloud (Free Tier):**
1. Visit [https://www.hivemq.com/mqtt-cloud-broker/](https://www.hivemq.com/mqtt-cloud-broker/)
2. Sign up for free account
3. Create a cluster
4. Note connection details:
   - **Host:** your-cluster.s1.eu.hivemq.cloud
   - **Port:** 8883 (TLS)
   - **Username:** your-username
   - **Password:** your-password

**EMQX Cloud (Free Tier):**
1. Visit [https://www.emqx.com/en/cloud](https://www.emqx.com/en/cloud)
2. Create free account
3. Deploy serverless cluster
4. Get connection credentials

### Option B: Self-Hosted Mosquitto

**Install on Linux:**

```bash
# Install Mosquitto
sudo apt-get update
sudo apt-get install mosquitto mosquitto-clients

# Start Mosquitto
sudo systemctl start mosquitto
sudo systemctl enable mosquitto
```

**Configure Mosquitto:**

Edit `/etc/mosquitto/mosquitto.conf`:

```conf
# Listen on all interfaces
listener 1883
protocol mqtt

# Enable authentication
allow_anonymous false
password_file /etc/mosquitto/passwd

# Enable persistence
persistence true
persistence_location /var/lib/mosquitto/
```

**Create User:**

```bash
# Add user
sudo mosquitto_passwd -c /etc/mosquitto/passwd enviroflow

# Restart Mosquitto
sudo systemctl restart mosquitto
```

**Open Firewall:**

```bash
# Allow MQTT port
sudo ufw allow 1883/tcp
```

### Option C: Docker Mosquitto

```bash
# Create config directory
mkdir -p mosquitto/config mosquitto/data mosquitto/log

# Create config file
cat > mosquitto/config/mosquitto.conf <<EOF
listener 1883
allow_anonymous false
password_file /mosquitto/config/passwd
persistence true
persistence_location /mosquitto/data/
log_dest file /mosquitto/log/mosquitto.log
EOF

# Run Mosquitto container
docker run -d \
  --name mosquitto \
  -p 1883:1883 \
  -v $(pwd)/mosquitto/config:/mosquitto/config \
  -v $(pwd)/mosquitto/data:/mosquitto/data \
  -v $(pwd)/mosquitto/log:/mosquitto/log \
  eclipse-mosquitto

# Create password file
docker exec mosquitto mosquitto_passwd -c /mosquitto/config/passwd enviroflow
docker restart mosquitto
```

## Step 2: Test MQTT Connection

Before adding to EnviroFlow, test your MQTT broker:

### Using mosquitto_sub (Command Line)

```bash
# Subscribe to test topic
mosquitto_sub -h broker.hivemq.com -p 1883 -u username -P password -t "test/#" -v
```

In another terminal, publish a test message:

```bash
# Publish test message
mosquitto_pub -h broker.hivemq.com -p 1883 -u username -P password -t "test/sensor" -m "25.5"
```

You should see `test/sensor 25.5` in the subscriber terminal.

### Using MQTT Explorer (GUI)

1. Download [MQTT Explorer](http://mqtt-explorer.com/)
2. Create new connection:
   - **Host:** your-broker-address
   - **Port:** 1883 (or 8883 for TLS)
   - **Username:** your-username
   - **Password:** your-password
3. Connect and browse topics
4. Publish test messages

## Step 3: Add MQTT Broker to EnviroFlow

### Configure MQTT Connection

1. **Navigate to Controllers**
   - Log into EnviroFlow
   - Go to "Controllers" page
   - Click "Add Controller"

2. **Select MQTT**
   - Choose "MQTT" from the brand list
   - Select "Manual" tab (MQTT doesn't support discovery)

3. **Enter Broker Details**

**Basic Settings:**
- **Name:** Descriptive name (e.g., "Home MQTT Broker")
- **Host:** Broker address (e.g., broker.hivemq.com)
- **Port:** 1883 (unencrypted) or 8883 (TLS)
- **Protocol:** mqtt:// or mqtts:// (for TLS)

**Authentication:**
- **Username:** Your MQTT username
- **Password:** Your MQTT password
- **Client ID:** (optional) Unique identifier for this connection

**Advanced Options:**
- **Keep Alive:** 60 seconds (default)
- **Clean Session:** true (recommended)
- **QoS:** 1 (default) - Options: 0, 1, 2
- **Use TLS:** Enable for encrypted connections (port 8883)

4. **Save and Test**
   - Click "Connect"
   - EnviroFlow will test the connection
   - If successful, broker appears in controller list

## Step 4: Configure Topic Mappings

Map MQTT topics to EnviroFlow sensors and devices.

### Add Sensor Topic

1. **Go to MQTT Controller Settings**
   - Click on your MQTT controller
   - Go to "Topic Mappings" tab
   - Click "Add Sensor Mapping"

2. **Configure Sensor Mapping**

**Topic Information:**
- **Topic:** MQTT topic to subscribe (e.g., `growroom/temp`)
- **Sensor Type:** temperature, humidity, co2, vpd, soil_moisture, ph, light, etc.
- **Unit:** °F, °C, %, ppm, lux, pH, etc.

**Payload Format:**
Choose how sensor data is formatted:

**Option 1: Plain Value** (simplest)
```
Topic: growroom/temp
Payload: 75.5
```

**Option 2: JSON**
```
Topic: growroom/sensors
Payload: {"temperature": 75.5, "humidity": 62.0}
JSON Path: temperature
```

**Option 3: JSON with Timestamp**
```
Topic: growroom/data
Payload: {"temp": 75.5, "timestamp": "2026-01-24T10:30:00Z"}
JSON Path: temp
Timestamp Path: timestamp
```

3. **Save Mapping**

### Add Control Topic (for devices)

1. **Add Device Mapping**
   - Click "Add Device Mapping"

2. **Configure Device Mapping**

**Topic Information:**
- **Topic:** MQTT topic to publish (e.g., `growroom/fan/set`)
- **Device Type:** fan, humidifier, heater, light, pump, valve
- **Port:** Virtual port number (1-8)

**Command Format:**

**Option 1: Simple On/Off**
```
Topic: growroom/fan/set
ON Payload: ON
OFF Payload: OFF
```

**Option 2: JSON**
```
Topic: growroom/fan/control
ON Payload: {"state": "on"}
OFF Payload: {"state": "off"}
```

**Option 3: Percentage (for dimmers, PWM)**
```
Topic: growroom/light/brightness
Payload Template: {{value}}
Range: 0-100
```

3. **Save Mapping**

## MQTT Topic Patterns

### Recommended Topic Structure

Use hierarchical topics for organization:

```
location/room/device/measurement
```

**Examples:**
- `home/growroom/temp1/temperature`
- `home/growroom/temp1/humidity`
- `home/growroom/fan1/speed`
- `home/growroom/light1/brightness`

### Wildcards

Subscribe to multiple topics using wildcards:

- **Single-level wildcard (+):** `home/+/temperature` matches `home/growroom/temperature` and `home/dryroom/temperature`
- **Multi-level wildcard (#):** `home/growroom/#` matches all topics under `home/growroom/`

**Example in EnviroFlow:**

Subscribe to all sensors in a room:
```
Topic: home/growroom/#
Parse: Use JSON path to extract specific sensors
```

## Common Payload Formats

### Home Assistant

Home Assistant MQTT discovery format:

```json
{
  "temperature": 75.5,
  "humidity": 62.0,
  "unit_of_measurement": "°F",
  "device_class": "temperature",
  "state_class": "measurement"
}
```

**EnviroFlow Mapping:**
- JSON Path: `temperature`
- Unit: °F (from payload or manual)

### Tasmota

Tasmota devices publish JSON:

```json
{
  "Time": "2026-01-24T10:30:00",
  "SENSOR": {
    "Temperature": 75.5,
    "Humidity": 62.0
  }
}
```

**EnviroFlow Mapping:**
- JSON Path: `SENSOR.Temperature`
- Timestamp Path: `Time`

### ESPHome

ESPHome publishes to individual topics:

```
Topic: esphome/growroom_sensor/temperature/state
Payload: 75.5

Topic: esphome/growroom_sensor/humidity/state
Payload: 62.0
```

**EnviroFlow Mapping:**
- Subscribe to each topic separately
- Format: Plain Value

## Common Errors

### "Connection refused"

**Cause:** Broker unreachable or wrong credentials

**Fix:**
1. Verify broker address and port
2. Check username and password
3. Test with MQTT Explorer or mosquitto_sub
4. Ensure broker is running (`sudo systemctl status mosquitto`)
5. Check firewall allows MQTT port (1883 or 8883)

### "Connection timeout"

**Cause:** Network issue or broker not responding

**Fix:**
1. Check internet connection
2. Verify broker is accessible (ping broker address)
3. Try different port (1883 vs 8883)
4. Check if broker is behind firewall
5. For cloud brokers, check service status page

### "Authentication failed"

**Cause:** Wrong username or password

**Fix:**
1. Verify credentials in MQTT Explorer
2. Check username has permissions on broker
3. Re-create user in Mosquitto: `mosquitto_passwd -b /etc/mosquitto/passwd username newpassword`
4. Restart broker after password change

### "No data received"

**Cause:** Wrong topic or device not publishing

**Fix:**
1. Subscribe to topic with MQTT Explorer - confirm data is being published
2. Check topic name matches exactly (case-sensitive)
3. Verify device is connected to broker
4. Check device logs for publish errors
5. Use wildcard `#` to see all topics

### "SSL/TLS error"

**Cause:** TLS configuration mismatch

**Fix:**
1. Ensure port is 8883 for TLS
2. Protocol should be `mqtts://` (not `mqtt://`)
3. Check broker certificate is valid
4. For self-signed certificates, disable strict TLS validation (advanced)

### "Payload parse error"

**Cause:** JSON path doesn't match payload structure

**Fix:**
1. View raw payload in MQTT Explorer
2. Verify JSON path is correct (e.g., `sensor.temperature` not `temperature`)
3. Check payload is valid JSON
4. Use plain value format if payload is just a number

## Advanced: Home Assistant Integration

EnviroFlow can integrate with Home Assistant via MQTT.

### Option A: EnviroFlow Subscribes to HA

1. **Enable MQTT in Home Assistant**
   - Add MQTT integration
   - Configure broker (same as EnviroFlow)

2. **Find HA Entity Topics**
   - In HA, go to entity settings
   - MQTT topic format: `homeassistant/sensor/growroom_temp/state`

3. **Add to EnviroFlow**
   - Create MQTT mapping
   - Subscribe to HA entity topic
   - Map to EnviroFlow sensor type

### Option B: EnviroFlow Publishes to HA

1. **EnviroFlow Publishes Sensor Data**
   - Configure device mapping in EnviroFlow
   - Set topic: `enviroflow/growroom/temperature`

2. **Add MQTT Sensor in HA**

Edit `configuration.yaml`:

```yaml
mqtt:
  sensor:
    - name: "Grow Room Temperature"
      state_topic: "enviroflow/growroom/temperature"
      unit_of_measurement: "°F"
      device_class: "temperature"
```

3. **Restart Home Assistant**

## Advanced: DIY Sensor Setup

Example: ESP8266 with DHT22 sensor publishing to MQTT.

### Arduino Code

```cpp
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// WiFi
const char* ssid = "YourWiFi";
const char* password = "YourPassword";

// MQTT
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* mqtt_user = "your-username";
const char* mqtt_pass = "your-password";

// Sensor
#define DHTPIN D4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  dht.begin();

  // Connect WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }

  // Connect MQTT
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read sensor
  float temp = dht.readTemperature(true); // Fahrenheit
  float humidity = dht.readHumidity();

  // Publish
  if (!isnan(temp) && !isnan(humidity)) {
    char tempStr[8];
    char humStr[8];
    dtostrf(temp, 1, 2, tempStr);
    dtostrf(humidity, 1, 2, humStr);

    client.publish("growroom/temperature", tempStr);
    client.publish("growroom/humidity", humStr);
  }

  delay(60000); // Publish every 60 seconds
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect("ESP8266Client", mqtt_user, mqtt_pass)) {
      Serial.println("MQTT connected");
    } else {
      delay(5000);
    }
  }
}
```

### EnviroFlow Setup

1. **Add MQTT broker** (as above)
2. **Add two sensor mappings:**
   - Topic: `growroom/temperature`, Type: temperature, Unit: °F
   - Topic: `growroom/humidity`, Type: humidity, Unit: %
3. **View data** on EnviroFlow dashboard

## Performance Considerations

### QoS Levels

Choose appropriate Quality of Service:

| QoS | Description | Use Case | Performance |
|-----|-------------|----------|-------------|
| 0 | At most once | Non-critical sensors | Fastest, no guarantee |
| 1 | At least once | Most sensors | Good balance, may duplicate |
| 2 | Exactly once | Critical data, commands | Slowest, guaranteed |

**Recommendation:** Use QoS 1 for sensors, QoS 2 for critical commands.

### Publish Frequency

Balance data freshness with broker load:
- **Environmental sensors:** Every 30-60 seconds
- **Critical sensors:** Every 10-30 seconds
- **Device status:** On change (not polling)
- **Avoid:** Publishing every second (excessive)

### Connection Keep-Alive

Keep-alive setting affects connection stability:
- **Default:** 60 seconds
- **Slow networks:** 120 seconds
- **Fast networks:** 30 seconds

## Security Best Practices

### 1. Use TLS Encryption

Always use TLS for production:
- Port 8883 (not 1883)
- Protocol: `mqtts://`
- Valid SSL certificates

### 2. Strong Credentials

- Long, random passwords
- Unique username per client
- Rotate credentials periodically

### 3. Broker ACLs

Configure access control lists in Mosquitto:

```conf
# /etc/mosquitto/acl
user enviroflow
topic read growroom/#
topic write enviroflow/#

user sensor1
topic write growroom/sensor1/#
```

### 4. Network Isolation

- Run broker on private network if possible
- Use VPN for remote access
- Firewall rules to restrict access

## Tips for Success

### Topic Design

- Use hierarchical structure
- Include location in topic
- Keep topics concise
- Avoid spaces and special characters

### Payload Design

- Keep payloads small
- Use JSON for complex data
- Include timestamps when possible
- Version your payload format

### Testing

- Test with MQTT Explorer before EnviroFlow
- Publish test data manually
- Verify topic names exactly
- Check payload format

### Monitoring

- Monitor broker logs
- Track message rates
- Watch for connection drops
- Set up alerts for offline clients

## Troubleshooting Checklist

If MQTT integration isn't working:

- [ ] Broker is running and accessible
- [ ] Credentials are correct
- [ ] Port is correct (1883 or 8883)
- [ ] Topics match exactly (case-sensitive)
- [ ] Device is publishing (verify with MQTT Explorer)
- [ ] Payload format matches mapping
- [ ] Firewall allows MQTT traffic
- [ ] QoS level is appropriate
- [ ] Keep-alive timeout is sufficient

## Getting Help

If you need assistance:

1. **MQTT Community**
   - Mosquitto mailing list
   - MQTT Discord/Slack channels
   - Stack Overflow (tag: mqtt)

2. **EnviroFlow Support**
   - Email: support@enviroflow.app
   - Include: Broker type, topic structure, error messages

3. **Broker Documentation**
   - Mosquitto: [mosquitto.org](https://mosquitto.org)
   - HiveMQ: [hivemq.com/docs](https://hivemq.com/docs)
   - EMQX: [emqx.io/docs](https://emqx.io/docs)

## Examples

See the [Examples Repository](https://github.com/enviroflow/mqtt-examples) for:
- ESP8266/ESP32 sensor code
- Home Assistant configurations
- Node-RED flows
- Python MQTT clients
- Topic mapping templates

## What's Next?

Now that your MQTT devices are connected:

1. **Create workflows** - Automate based on MQTT sensor data
2. **Set up alerts** - Get notified on MQTT events
3. **Monitor dashboard** - View real-time MQTT data
4. **Build custom sensors** - DIY sensors for your specific needs

Welcome to unlimited device integration with MQTT and EnviroFlow!
