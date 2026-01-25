# Ecowitt Weather Station Connection Guide

## Prerequisites

Before connecting your Ecowitt weather station to EnviroFlow, ensure:

- [ ] Weather station is powered on and operational
- [ ] Station is connected to WiFi network
- [ ] WS View app (Ecowitt's mobile app) is installed
- [ ] You can see live data in the WS View app
- [ ] You know your station's MAC address

## Supported Models

Ecowitt WiFi-enabled weather stations and sensor gateways:

- **GW1000/GW1100** - WiFi Gateway (connects wireless sensors)
- **GW2000** - WiFi Gateway with display
- **WS2910** - WiFi Weather Station
- **WittBoy** - Compact WiFi Gateway
- Other Ecowitt WiFi gateways and weather stations

**Also Compatible:**
- Ambient Weather stations (many use Ecowitt hardware)
- Fine Offset weather stations
- Froggit weather stations

## How Ecowitt Integration Works

Ecowitt devices support **webhook/custom server upload**, which means:

1. Your Ecowitt device sends data directly to EnviroFlow
2. No cloud credentials needed (privacy-friendly!)
3. Data arrives in real-time whenever sensors update
4. Works even if Ecowitt cloud services are down

**Important:** This requires configuring your Ecowitt device to send data to EnviroFlow's webhook endpoint.

## Step 1: Find Your Station's IP Address

You need to access your Ecowitt device's web interface:

### Method A: WS View App
1. Open WS View app
2. Go to Device List
3. Tap your gateway/station
4. Look for "IP Address" or "LAN Settings"
5. Note the IP address (e.g., 192.168.1.100)

### Method B: Router Admin Panel
1. Log into your router's admin interface
2. Look for "Connected Devices" or "DHCP Clients"
3. Find device named "Ecowitt" or matching the MAC address
4. Note the IP address

### Method C: Network Scanner
1. Use a network scanner app (Fing, Advanced IP Scanner, etc.)
2. Scan your local network
3. Look for "Ecowitt" or "Shenzhen Fine Offset"
4. Note the IP address

## Step 2: Configure Custom Server Upload

Access your Ecowitt device's configuration page:

1. **Open web browser** on computer/phone connected to same WiFi
2. **Enter IP address** from Step 1 (e.g., http://192.168.1.100)
3. **Log in** (default is usually no password, or try admin/admin)
4. **Navigate to:** "Weather Services" or "Customized Upload"

### Configure Ecowitt Weather Upload

**Server Settings:**
- **Protocol:** HTTP or HTTPS
- **Server Address:** `enviroflow.app`
- **Path:** `/api/ecowitt`
- **Port:** `443` (for HTTPS) or `80` (for HTTP)
- **Station ID:** Create a unique ID (e.g., "greenhouse-station-1")
- **Station Key:** Leave blank or use a custom password (optional)
- **Upload Interval:** 60 seconds (recommended)

**Full URL Example:**
```
https://enviroflow.app/api/ecowitt
```

**Important Settings:**
- ✅ Enable "Customized Upload"
- ✅ Set interval to 60 seconds or less
- ✅ Enable "Send all sensor data"
- ❌ Don't enable authentication unless EnviroFlow support instructs you

5. **Click "Save" or "Apply"**
6. **Wait 60 seconds** for first upload

## Step 3: Add Station in EnviroFlow

Now register the station in EnviroFlow:

1. **Go to Controllers** in EnviroFlow
2. **Click "Add Controller"**
3. **Select "Ecowitt"** from brands list
4. **Enter Station Details:**
   - **Name:** Descriptive name (e.g., "Greenhouse Weather Station")
   - **Station ID:** MUST match the Station ID from Step 2
   - **MAC Address:** Found on device label or in WS View app (optional but recommended)
5. **Click "Add Controller"**

## Step 4: Verify Data Reception

Check that data is flowing:

1. **Wait 1-2 minutes** after saving both configurations
2. **Go to your Controllers page** in EnviroFlow
3. **Find your Ecowitt station**
4. **Check status:** Should show "Online" with recent timestamp
5. **View sensor readings:** Click to see temperature, humidity, etc.

**If no data appears after 5 minutes, see Troubleshooting below.**

## Common Issues

### "No data received from station"

**Cause:** Station not sending to EnviroFlow, or Station ID mismatch

**Fix:**
1. **Verify Station ID matches** exactly (case-sensitive!) in both:
   - Ecowitt device configuration
   - EnviroFlow controller settings
2. **Check Ecowitt device config:**
   - Open device web interface
   - Go to Weather Services > Customized
   - Verify "Enable" is checked
   - Verify server address is correct: `enviroflow.app`
   - Path should be `/api/ecowitt`
3. **Test upload manually:**
   - In Ecowitt web interface, click "Test Upload"
   - Should show "Success" or "OK"
4. **Check device logs:**
   - Some Ecowitt devices have a Status/Logs page
   - Look for upload errors or network issues

### "Station ID not recognized"

**Cause:** Station not registered in EnviroFlow, or ID typo

**Fix:**
1. Go to EnviroFlow Controllers page
2. Verify the Ecowitt station is added
3. Check the Station ID matches EXACTLY:
   - Same capitalization
   - No extra spaces
   - Same special characters
4. Edit controller in EnviroFlow if needed to fix ID

### "Controller shows offline"

**Cause:** Data hasn't been received in 5+ minutes

**Fix:**
1. **Check Ecowitt device:**
   - Is it powered on?
   - Can you access web interface?
   - Is WiFi connected? (check LED indicators)
2. **Check upload status:**
   - Open Ecowitt web interface
   - Go to Weather Services > Customized
   - Look for last upload timestamp
   - Should update every 60 seconds
3. **Power cycle the device:**
   - Unplug for 10 seconds
   - Plug back in
   - Wait 2 minutes for reconnection
4. **Check network:**
   - Can the Ecowitt device reach the internet?
   - Try accessing other websites from same network
   - Check firewall/router settings

### "Some sensors missing"

**Cause:** Sensors not paired, or selective upload enabled

**Fix:**
1. **Verify sensor pairing:**
   - Open WS View app
   - Check all sensors appear there
   - If missing, re-pair sensor with gateway
2. **Enable all sensors in upload:**
   - Ecowitt web interface
   - Weather Services > Customized
   - Find "Sensor Selection" or "Send all data"
   - Enable ALL sensors
3. **Check sensor batteries:**
   - Low battery can cause intermittent data
   - Replace batteries in wireless sensors

### "Wrong temperature units"

**Cause:** Ecowitt sending °F but you want °C (or vice versa)

**Fix:**
1. **Change in Ecowitt device:**
   - Web interface > Settings > Units
   - Select desired temperature unit
   - Save and reboot device
2. **Or change in EnviroFlow:**
   - Currently uses units as sent by device
   - Unit conversion coming in future update

## Supported Sensors

Ecowitt supports a wide variety of wireless sensors:

**Environmental:**
- Temperature (indoor/outdoor)
- Humidity (indoor/outdoor)
- Barometric pressure
- PM2.5 air quality
- CO2 levels

**Weather:**
- Wind speed and direction
- Rainfall
- UV index
- Solar radiation
- Lightning detection

**Specialty:**
- Soil moisture
- Soil temperature
- Leaf wetness
- Water/pond temperature

**EnviroFlow Support:**
- ✅ Temperature, humidity, VPD (calculated)
- ✅ Pressure, wind, rain
- ✅ PM2.5, UV, solar radiation
- ✅ Soil moisture and temperature
- 🔄 CO2 (coming soon)

## Advanced Configuration

### Custom Upload Interval

**Default:** 60 seconds (recommended)

**Faster updates:**
- Set to 30 seconds for more frequent data
- Increases network traffic
- May reduce device lifespan slightly

**Slower updates:**
- Set to 300 seconds (5 min) for battery-powered setups
- Reduces bandwidth usage
- Historical trends still accurate

### Station Key / Authentication

**Optional security feature:**

1. Choose a password (e.g., "mySecretKey123")
2. Enter in Ecowitt "Station Key" field
3. Contact EnviroFlow support to register your key
4. EnviroFlow will validate uploads using this key

**When to use:**
- Public/untrusted networks
- Multiple stations with same ID
- Extra security preference

### Multiple Stations

**You can add multiple Ecowitt stations:**

1. Each must have a UNIQUE Station ID
2. Configure each device separately
3. Add each as separate controller in EnviroFlow
4. Assign to different rooms for organization

**Example:**
- Station 1 ID: "greenhouse-east"
- Station 2 ID: "greenhouse-west"
- Station 3 ID: "outdoor-weather"

## Firewall & Network Requirements

**Outbound Connections:**
- Ecowitt device needs internet access
- Allow HTTPS (port 443) to enviroflow.app
- Or HTTP (port 80) if using HTTP

**No Inbound Ports Needed:**
- EnviroFlow receives webhook uploads
- No port forwarding required
- Works behind NAT/router

**VPN/Proxy:**
- Should work through most VPNs
- May need to whitelist enviroflow.app

## Getting Help

If you've tried troubleshooting and still have issues:

1. **Ecowitt Support (for device/sensor issues)**
   - Website: [https://www.ecowitt.com/](https://www.ecowitt.com/)
   - Forum: [https://www.osborneink.com/](https://www.osborneink.com/)
   - Verify device works with WS View app first

2. **EnviroFlow Support (for integration issues)**
   - Email: support@enviroflow.app
   - Include:
     - Station ID
     - Device model
     - Screenshot of Ecowitt upload config
     - Error messages (if any)

3. **Test Upload Endpoint**
   - Visit: https://enviroflow.app/api/ecowitt/test
   - Provides diagnostic information
   - Include results when contacting support

## Tips for Best Results

- **Station Placement:** Position outdoor sensors away from buildings, in shade, 5+ feet off ground
- **WiFi Signal:** Keep gateway close to router, or use WiFi extender
- **Sensor Maintenance:** Clean rain gauge monthly, replace batteries annually
- **Firmware Updates:** Check for Ecowitt firmware updates quarterly
- **Backup Power:** Consider UPS for gateway to prevent data gaps during power outages

## Privacy & Security

**Privacy-Friendly Design:**
- No Ecowitt cloud account needed
- No credentials stored
- Data flows directly from your device to EnviroFlow
- You control what data is sent

**Security:**
- HTTPS encryption recommended
- Optional station key for authentication
- EnviroFlow validates station ID before accepting data
- Malformed data is rejected automatically

## Troubleshooting Checklist

Before contacting support, verify:

- [ ] Ecowitt device powered on and WiFi connected
- [ ] Can access Ecowitt web interface from browser
- [ ] "Customized Upload" is ENABLED in device config
- [ ] Server address is exactly: `enviroflow.app`
- [ ] Path is exactly: `/api/ecowitt`
- [ ] Station ID in device matches EnviroFlow (case-sensitive!)
- [ ] Waited at least 2 minutes after saving settings
- [ ] Device can access internet (check other weather services work)
- [ ] EnviroFlow controller status shows correct Station ID
- [ ] "Test Upload" in Ecowitt web interface shows success

**Still stuck?** Email support@enviroflow.app with the checklist results.
