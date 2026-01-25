# Inkbird Controller Connection Guide

## Prerequisites

Before connecting your Inkbird controller to EnviroFlow, ensure:

- [ ] Controller is powered on (display is lit)
- [ ] Controller is connected to WiFi network
- [ ] Inkbird mobile app (Inkbird Smart or BBQ-Go) is installed
- [ ] You have an active Inkbird account
- [ ] Your controller appears online in the Inkbird app

## Supported Models

Inkbird WiFi-enabled temperature and humidity controllers:

- **ITC-308-WiFi** - WiFi Temperature Controller
- **IHC-200-WiFi** - WiFi Humidity Controller
- **ITC-308S-WiFi** - WiFi Temperature Controller with LCD
- **IBT Series** - WiFi Bluetooth Thermometers
- Other WiFi-enabled Inkbird smart controllers

**Note:** Bluetooth-only models are not currently supported. Your device must have WiFi capability.

## Current Status: Partial Support

**IMPORTANT:** Inkbird integration is currently in **limited support** mode.

- **Full cloud API access:** Coming soon
- **CSV Upload:** Available now (recommended for manual data import)
- **Local API:** Under development

For the best experience, we recommend using **CSV Upload** to manually import your Inkbird sensor data until full cloud integration is complete.

## Step 1: Verify WiFi Connection

1. Check your Inkbird controller display for WiFi signal indicator
2. Open the Inkbird mobile app (Inkbird Smart or BBQ-Go)
3. Verify your device shows as "Online"
4. If offline, use the app's WiFi setup to reconnect

**WiFi Requirements:**
- 2.4GHz WiFi network (most Inkbird devices don't support 5GHz)
- WPA/WPA2 security (some older models don't support WPA3)
- Internet connection for cloud features

## Step 2: Using CSV Upload (Current Recommended Method)

Since full Inkbird cloud API is coming soon, use CSV Upload to import your data:

1. **Export data from Inkbird app (if available)**
   - Open Inkbird app
   - Go to history/data section
   - Export to CSV if supported by your model

2. **Or create manual CSV**
   - Download EnviroFlow's CSV template
   - Record your sensor readings manually
   - Fill in: timestamp, sensor type, value, unit

3. **Upload to EnviroFlow**
   - Click "Add Controller"
   - Select "CSV Upload" brand
   - Upload your CSV file
   - Name your controller (e.g., "Inkbird ITC-308")

## Step 3: Future Cloud Connection (Coming Soon)

When full Inkbird cloud support is available:

### Option A: Automatic Discovery
1. Click "Add Controller" in EnviroFlow
2. Select the "Discover" tab
3. Choose "Inkbird" from the brand list
4. Enter your Inkbird account credentials
5. Click "Discover Devices"
6. Select your controller(s)
7. Click "Add Selected Devices"

### Option B: Manual Entry
1. Click "Add Controller"
2. Select "Manual" tab
3. Choose "Inkbird"
4. Enter your credentials
5. Name your controller
6. Click "Connect Controller"

## Common Issues

### "Inkbird integration coming soon"

**Cause:** Full cloud API is not yet implemented

**Fix:**
1. Use CSV Upload method (see Step 2 above)
2. Check EnviroFlow changelog for integration updates
3. Sign up for email notifications when Inkbird support launches

### Device won't connect to WiFi

**Cause:** WiFi setup not completed or network incompatibility

**Fix:**
1. Reset WiFi on the Inkbird device (hold WiFi button 5+ seconds)
2. Use the Inkbird app's WiFi setup wizard
3. Ensure you're using 2.4GHz WiFi (not 5GHz)
4. Check router compatibility (WPA/WPA2, not WPA3)
5. Move device closer to router during setup

### Can't find device in Inkbird app

**Cause:** Device not registered or Bluetooth pairing needed

**Fix:**
1. Most Inkbird devices require initial Bluetooth pairing
2. Enable Bluetooth on your phone
3. Stand within 3 feet of the Inkbird device
4. Follow the app's pairing wizard
5. Once paired, configure WiFi through the app

### Temperature readings seem wrong

**Cause:** Probe placement or calibration issue

**Fix:**
1. Check probe is properly inserted and secured
2. Verify probe cable isn't damaged
3. Calibrate using ice water test (should read 32°F / 0°C)
4. In Inkbird app, go to Settings > Calibration
5. Adjust offset if needed

## CSV Upload Format

If using CSV Upload, follow this format:

```csv
timestamp,sensor_type,value,unit,port
2024-01-24T10:00:00Z,temperature,72.5,°F,1
2024-01-24T10:00:00Z,humidity,65.0,%,2
2024-01-24T10:15:00Z,temperature,73.0,°F,1
2024-01-24T10:15:00Z,humidity,64.5,%,2
```

**Required columns:**
- `timestamp` - ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
- `sensor_type` - temperature, humidity, ph, etc.
- `value` - Numeric reading
- `unit` - °F, °C, %, pH, etc.
- `port` - Port/channel number (1 for main probe)

## Tips for Inkbird Controllers

- **Probe placement matters:** Temperature probes should be placed at canopy level, away from direct airflow
- **Calibrate regularly:** Inkbird probes can drift over time - calibrate monthly
- **Use high/low alarms:** Set up alerts in the Inkbird app for critical thresholds
- **Battery backup:** Some models have battery backup - check batteries every 6 months
- **Firmware updates:** Keep Inkbird app updated to get latest firmware for your device

## Advanced: Local API (Experimental)

Some Inkbird devices support local network API access:

**Requirements:**
- Device must be on same network as EnviroFlow
- Local API must be enabled in device settings
- You'll need the device's local IP address

**Note:** This is experimental and not officially supported yet. Use CSV Upload for production.

## Getting Help

If you need assistance:

1. **Inkbird Support**
   - Website: [https://www.inkbird.com/pages/contact-us](https://www.inkbird.com/pages/contact-us)
   - Email: support@inkbird.com
   - Verify device works with official Inkbird app first

2. **EnviroFlow Support**
   - Email: support@enviroflow.app
   - Include: Device model, Inkbird app version, error details

3. **CSV Upload Questions**
   - Download template from EnviroFlow
   - Check format matches example above
   - Ensure timestamps are in ISO 8601 format

## Roadmap

**Current Status:** CSV Upload only

**Coming Soon:**
- ✅ CSV Upload (Available now)
- 🔄 Cloud API integration (In development)
- 📋 Local API support (Planned)
- 📋 Automatic data sync (Planned)
- 📋 Real-time alerts (Planned)

**Sign up for updates:** Visit enviroflow.app/integrations to get notified when Inkbird cloud support launches.

## Security & Privacy

When full cloud integration is available:

- **Credentials encrypted** using AES-256-GCM
- **Read-only access** by default
- **No device modifications** without explicit user action
- **CSV data stays local** - only uploaded to your EnviroFlow database
