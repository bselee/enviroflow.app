# Govee Controller Connection Guide

## Prerequisites

Before connecting your Govee devices to EnviroFlow, ensure:

- [ ] Device is powered on and functioning
- [ ] Device is connected to WiFi network
- [ ] Govee Home app is installed on your device
- [ ] You have a Govee account
- [ ] Your device appears online in the Govee Home app
- [ ] You have generated a Govee API key

## Supported Devices

EnviroFlow supports WiFi-enabled Govee devices via the Govee Developer API:

### Temperature & Humidity Monitors
- **H5179** - WiFi Thermometer Hygrometer
- **H5074** - Bluetooth/WiFi Hygrometer
- **H5075** - Smart Hygrometer Thermometer
- **H5101** - WiFi Temperature Humidity Monitor
- **H5177** - Smart Thermometer Hygrometer

### Smart Plugs & Outlets
- **H5080** - WiFi Smart Plug
- **H5081** - Smart Plug Mini
- **H7015** - Smart Outdoor Outlet

### LED Strip Lights (with dimming)
- **H6159** - RGBIC LED Strip Lights
- **H6182** - Smart LED Strip Lights
- **H6188** - LED Strip Lights Pro
- **H619A** - RGBIC Floor Lamp
- **H619B** - RGBIC Table Lamp
- **H619C** - RGBIC Strip Light M1
- **H619D** - Glide Wall Light
- **H619E** - Glide Hexa Light Panels
- **H619Z** - Outdoor LED Strip Lights

### Other Smart Devices
- **H7130** - Smart Tower Fan
- **H7131** - Smart Air Purifier
- **H7132** - Smart Humidifier

**Note:** Only WiFi-enabled models are supported. Bluetooth-only models require the Govee Home app and cannot be integrated directly.

## Step 1: Get Your Govee API Key

Govee requires an API key for third-party integrations like EnviroFlow.

### Obtain API Key from Govee

1. **Open Govee Home App**
   - Launch the Govee Home app on your phone
   - Sign in to your Govee account

2. **Navigate to Account Settings**
   - Tap the profile icon (top right)
   - Select "Settings"
   - Scroll down to "Apply for API Key"

3. **Request API Key**
   - Tap "Apply for API Key"
   - Fill out the application form:
     - **Application Name:** EnviroFlow
     - **Description:** Environmental automation platform
     - **Purpose:** Control and monitor Govee devices
   - Submit the application

4. **Receive API Key**
   - Govee will review your application (usually within 24-48 hours)
   - You'll receive an email with your API key
   - API key format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

**Important:**
- Keep your API key secret - treat it like a password
- Each account can have only one API key
- If you lose your key, you'll need to reapply

### Alternative: Developer Portal

For developers, you can also apply via the Govee Developer Portal:
1. Visit [developer.govee.com](https://developer.govee.com)
2. Create an account or sign in
3. Apply for API access
4. Generate your API key

## Step 2: Verify Device Compatibility

Not all Govee devices support API control. Verify your device is compatible:

1. **Check Device in Govee Home App**
   - Open Govee Home app
   - Select your device
   - Look for "API Control" or "Third Party Control" in settings
   - If available, the device supports API integration

2. **Test API Access**

You can test if your device is accessible via API:

```bash
# Replace YOUR_API_KEY with your actual API key
curl -X GET \
  https://developer-api.govee.com/v1/devices \
  -H "Govee-API-Key: YOUR_API_KEY"
```

**Expected Response:**

```json
{
  "code": 200,
  "message": "Success",
  "data": {
    "devices": [
      {
        "device": "12:34:56:78:9A:BC:DE:F0",
        "model": "H6159",
        "deviceName": "Grow Room LED",
        "controllable": true,
        "retrievable": true,
        "supportCmds": ["turn", "brightness", "color", "colorTem"],
        "properties": {}
      }
    ]
  }
}
```

If you see your devices listed, you're ready to connect them to EnviroFlow!

## Step 3: Add Govee Device in EnviroFlow

### Option A: Automatic Discovery (Recommended)

1. **Navigate to Controllers**
   - Log into EnviroFlow
   - Go to "Controllers" page
   - Click "Add Controller"

2. **Select Govee and Discover**
   - Click the "Discover" tab
   - Choose "Govee" from the brand list
   - Enter your Govee API key
   - Click "Discover Devices"

3. **Select Your Devices**
   - EnviroFlow will fetch all your Govee devices
   - Check the boxes next to devices you want to add
   - You can add multiple devices at once
   - Click "Add Selected Devices"

4. **Assign to Rooms (Optional)**
   - After adding, assign devices to rooms
   - This helps organize devices by location
   - You can change room assignments later

### Option B: Manual Entry

1. **Add Single Device**
   - Click "Add Controller"
   - Select "Manual" tab
   - Choose "Govee" from brand dropdown

2. **Enter Device Information**
   - **API Key:** Your Govee API key
   - **Device MAC Address:** Find in Govee Home app (Settings > Device Info)
   - **Device Model:** e.g., H6159 (from Govee Home app)
   - **Device Name:** Descriptive name (e.g., "Veg Room LED Strip")

3. **Save and Test**
   - Click "Connect Device"
   - EnviroFlow will test the connection
   - If successful, device appears in your controller list

## Step 4: Verify Connection

After adding your Govee device:

1. **Check Status**
   - Go to Controllers page
   - Your Govee device should show status: "Online" (green)
   - If offline, see troubleshooting below

2. **Read Sensor Data** (for monitors)
   - Click on the device
   - View current temperature and humidity readings
   - Data refreshes every 5 minutes

3. **Test Control** (for smart plugs and lights)
   - Click "Test Device" or "Control"
   - Try turning on/off
   - Try adjusting brightness (for lights)
   - Verify the physical device responds

## Supported Features by Device Type

### Temperature & Humidity Monitors

**Read:**
- Current temperature (°F or °C)
- Current humidity (%)
- VPD calculation (automatic)

**Actions:**
- None (read-only sensors)

**Workflows:**
- Trigger based on temperature/humidity thresholds
- Use in VPD automation
- Alert on out-of-range conditions

### Smart Plugs

**Read:**
- On/Off state
- Power consumption (if supported by model)

**Actions:**
- Turn On
- Turn Off
- Toggle

**Workflows:**
- Turn on/off based on sensor conditions
- Schedule on/off times
- Power cycle devices

### LED Strip Lights

**Read:**
- On/Off state
- Current brightness (0-100%)
- Current color (if RGB)
- Current color temperature (if tunable white)

**Actions:**
- Turn On
- Turn Off
- Set Brightness (0-100%)
- Set Color (RGB)
- Set Color Temperature (2000-9000K)

**Workflows:**
- Sunrise/sunset dimming schedules
- Brightness based on time of day
- Color changes for growth stages
- DLI (Daily Light Integral) optimization

## Common Errors

### "Invalid API Key"

**Cause:** API key is incorrect or hasn't been activated yet

**Fix:**
1. Double-check your API key (no extra spaces)
2. Ensure API key was approved by Govee (check email)
3. Wait 5-10 minutes after receiving API key for activation
4. Try regenerating API key in Govee Home app

### "Device not found"

**Cause:** Device MAC address is incorrect or device is offline

**Fix:**
1. Verify MAC address in Govee Home app (Settings > Device Info)
2. Ensure device is online in Govee Home app
3. Power cycle the device (unplug 10 seconds, plug back in)
4. Check WiFi connection on device
5. Try using "Discover" instead of manual entry

### "API rate limit exceeded"

**Cause:** Too many API requests in short time

**Fix:**
1. Govee limits: 10 requests per minute per API key
2. Wait 1 minute before retrying
3. Reduce polling frequency in EnviroFlow settings
4. Avoid rapid on/off control commands

### "Device is not controllable"

**Cause:** Device doesn't support API control

**Fix:**
1. Check if device model supports API (see supported devices list)
2. Update device firmware in Govee Home app
3. Some older Govee devices don't support third-party control
4. Consider upgrading to a newer model with API support

### "Connection timeout"

**Cause:** Network issue or Govee cloud API unavailable

**Fix:**
1. Check your internet connection
2. Verify Govee Home app can control the device
3. Check Govee API status: [status.govee.com](https://status.govee.com)
4. Try again in 5 minutes
5. Contact Govee support if persistent

### "Temperature/humidity not updating"

**Cause:** Govee API caching or device battery low

**Fix:**
1. Govee updates sensor data every 2-5 minutes (not real-time)
2. Check device battery level in Govee Home app
3. Replace batteries if low
4. Power cycle the device
5. Ensure device is within WiFi range

## Advanced: LED Dimming Schedules

Govee LED strips are perfect for sunrise/sunset automation:

### Create Sunrise Schedule

1. **Go to Schedules**
   - Navigate to Schedules page in EnviroFlow
   - Click "Create Schedule"

2. **Configure Sunrise**
   - **Name:** "Sunrise - Veg Room"
   - **Device:** Select your Govee LED strip
   - **Start Time:** 6:00 AM
   - **Duration:** 30 minutes
   - **Start Brightness:** 0%
   - **End Brightness:** 100%
   - **Curve:** Natural (mimics sunrise curve)

3. **Save and Activate**

### Create Sunset Schedule

1. **Create Sunset Schedule**
   - **Name:** "Sunset - Veg Room"
   - **Device:** Same Govee LED strip
   - **Start Time:** 10:00 PM
   - **Duration:** 30 minutes
   - **Start Brightness:** 100%
   - **End Brightness:** 0%
   - **Curve:** Natural (mimics sunset curve)

2. **Save and Activate**

Your Govee lights will now automatically dim up in the morning and down at night, simulating natural light cycles!

### DLI Optimization

For advanced growers, optimize Daily Light Integral:

1. **Set Growth Stage**
   - Go to Room Settings
   - Select growth stage (seedling, vegetative, flowering)

2. **Configure DLI Target**
   - Seedling: 10-15 mol/m²/day
   - Vegetative: 15-30 mol/m²/day
   - Flowering: 25-40 mol/m²/day

3. **Let AI Recommend**
   - Click "AI Recommend Schedule"
   - EnviroFlow calculates optimal brightness and duration
   - Review and activate schedule

## Performance Considerations

### API Rate Limits

Govee imposes these limits:
- **10 requests/minute** per API key
- **1 control command** per second per device

**Recommendations:**
- Poll sensors every 5 minutes (not every second)
- Avoid rapid on/off toggling
- Use workflows to batch commands

### Response Times

- **Sensor reads:** 1-3 seconds
- **Control commands:** 2-5 seconds
- **Device state updates:** 5-10 seconds

For time-critical automation, consider local control via Home Assistant integration.

## Tips for Success

### Naming Conventions

Use clear, descriptive names:
- **Good:** "Veg Room North LED - H6159"
- **Bad:** "Light 1"

Include room, location, and model for easy identification.

### Room Organization

Organize devices by physical location:
- Assign all devices in a room to the same Room in EnviroFlow
- This enables room-level automation and analytics

### Battery Monitoring

For battery-powered sensors (H5179, H5074):
- Check battery level weekly in Govee Home app
- Replace batteries when below 20%
- Low battery causes missed readings

### Firmware Updates

Keep device firmware updated:
- Check Govee Home app monthly
- Install firmware updates when available
- Updates improve stability and add features

### WiFi Best Practices

- Use 2.4GHz WiFi (most Govee devices don't support 5GHz)
- Keep devices within strong WiFi range
- Avoid WiFi congestion (too many devices on one router)
- Consider WiFi extenders for large spaces

## Integration with Other Systems

### Use with AC Infinity

Combine Govee sensors with AC Infinity controllers:
- Read temperature from Govee monitor
- Control AC Infinity fans based on Govee readings
- Create cross-brand automation workflows

### Use with MQTT

Bridge Govee to Home Assistant:
- Use EnviroFlow's Home Assistant integration
- Expose Govee devices via MQTT
- Control from Home Assistant dashboards

## Troubleshooting Checklist

If your Govee device isn't working:

- [ ] API key is correct and activated
- [ ] Device is online in Govee Home app
- [ ] Device model supports API control
- [ ] WiFi connection is stable
- [ ] No rate limiting errors
- [ ] Firmware is up to date
- [ ] Battery level is sufficient (for battery devices)
- [ ] EnviroFlow has correct device MAC address
- [ ] Device name matches in Govee Home app

## Getting Help

If you need assistance:

1. **Govee Support**
   - Website: [https://www.govee.com/pages/contact-us](https://www.govee.com/pages/contact-us)
   - Email: support@govee.com
   - Verify device works in Govee Home app first

2. **Govee Developer Support**
   - Email: developer@govee.com
   - For API-related issues

3. **EnviroFlow Support**
   - Email: support@enviroflow.app
   - Include: Device model, API error, and troubleshooting steps tried

4. **Community**
   - EnviroFlow Community Forum
   - Search for similar Govee integration issues

## Security & Privacy

- **API key encryption:** Your Govee API key is encrypted using AES-256-GCM
- **Local storage:** API key stored securely, never exposed in responses
- **Read-only by default:** EnviroFlow only reads data unless you create control workflows
- **No device modifications:** EnviroFlow doesn't change device settings in Govee Home app

## API Reference

For developers, Govee API documentation:
- **Official Docs:** [https://govee-public.s3.amazonaws.com/developer-docs/GoveeAPIReference.pdf](https://govee-public.s3.amazonaws.com/developer-docs/GoveeAPIReference.pdf)
- **Base URL:** `https://developer-api.govee.com/v1/`
- **Authentication:** Header `Govee-API-Key: YOUR_API_KEY`

## What's Next?

Now that your Govee devices are connected:

1. **Create your first workflow** - Automate based on Govee sensor readings
2. **Set up schedules** - Configure sunrise/sunset dimming for Govee lights
3. **Monitor dashboard** - View real-time data from Govee sensors
4. **Set up alerts** - Get notified when Govee sensors detect issues

Welcome to automated environmental control with Govee and EnviroFlow!
