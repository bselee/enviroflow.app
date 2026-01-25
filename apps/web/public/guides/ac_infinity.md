# AC Infinity Controller Connection Guide

## Prerequisites

Before connecting your AC Infinity controller to EnviroFlow, ensure:

- [ ] Controller is powered on (green LED visible)
- [ ] Controller is connected to 2.4GHz WiFi network (not 5GHz)
- [ ] AC Infinity mobile app is installed on your device
- [ ] You have an active AC Infinity account with email/password login
- [ ] Your controller appears online in the AC Infinity app

## Supported Models

EnviroFlow supports WiFi-enabled AC Infinity controllers:

- **Controller 69 WiFi** - Base WiFi controller
- **Controller 69 Pro** - Advanced WiFi controller with LCD display
- **Controller 69 Pro+** - Premium WiFi controller with enhanced features
- **AI+ Controllers** - Next-generation smart controllers

**NOT SUPPORTED:** Bluetooth-only controllers (Controller 67, base Controller 69 without WiFi)

## Step 1: Verify WiFi Connection

Your AC Infinity controller must be connected to WiFi to work with EnviroFlow.

1. Check your controller display for a WiFi/cloud icon
2. Open the AC Infinity mobile app
3. Verify your controller shows as "Online" in the app
4. If offline, reconnect using the app's WiFi setup wizard

**WiFi Requirements:**
- Must use 2.4GHz band (5GHz is NOT supported by AC Infinity hardware)
- Strong signal strength recommended (controller near router)
- Stable internet connection required for cloud API access

## Step 2: Find Your Credentials

EnviroFlow uses the same credentials as your AC Infinity mobile app.

1. **Email Address:** The email you used to register your AC Infinity account
2. **Password:** Your AC Infinity account password

**Important:**
- Use the SAME email and password you use in the AC Infinity app
- If you recently changed your password, use the NEW password
- Credentials are encrypted and stored securely in EnviroFlow

## Step 3: Add Controller in EnviroFlow

### Option A: Automatic Discovery (Recommended)

1. Click "Add Controller" in EnviroFlow
2. Select the "Discover" tab
3. Choose "AC Infinity" from the brand list
4. Enter your AC Infinity email and password
5. Click "Discover Devices"
6. Select your controller(s) from the discovered list
7. Click "Add Selected Devices"

### Option B: Manual Entry

1. Click "Add Controller" in EnviroFlow
2. Select the "Manual" tab
3. Choose "AC Infinity"
4. Enter your email and password
5. Give your controller a name (e.g., "Veg Room Controller")
6. Click "Connect Controller"

## Common Errors

### "Email or password incorrect"

**Cause:** Invalid credentials

**Fix:**
1. Verify your email address is correct (no typos)
2. Log into the AC Infinity mobile app to confirm your password works
3. If you forgot your password, reset it in the AC Infinity app first
4. After changing your password, wait 1-2 minutes before trying EnviroFlow
5. Make sure you're using your AC Infinity account (not Google/Apple sign-in)

### "No devices found"

**Cause:** Controller not registered or offline

**Fix:**
1. Open the AC Infinity app and verify your controller appears there
2. Check that the controller shows "Online" status in the AC Infinity app
3. If offline, power cycle the controller (unplug 10 seconds, plug back in)
4. Verify WiFi connection on the controller display
5. Try logging out and back into the AC Infinity app to refresh
6. Wait 5 minutes after initial setup - new devices may take time to register

### "Controller offline"

**Cause:** Controller lost WiFi connection

**Fix:**
1. Check the WiFi/cloud icon on your controller display
2. Verify your router is working and internet is connected
3. Move controller closer to WiFi router if signal is weak
4. Power cycle the controller (unplug 10 seconds, plug back in)
5. Reconnect to WiFi using the AC Infinity app if needed
6. Check for firmware updates in the AC Infinity app

### "Connection timeout"

**Cause:** Slow network or AC Infinity cloud API issues

**Fix:**
1. Check your internet connection speed
2. Try again in 30 seconds - AC Infinity servers may be busy
3. Disable VPN if you're using one
4. Check if other cloud services are working
5. Visit AC Infinity's status page or contact their support

### "Controller already registered"

**Cause:** This controller is already added to EnviroFlow

**Fix:**
1. Check your Controllers page - it may already be there
2. If you need to re-add it, delete it first from the Controllers page
3. Then add it again using the connection wizard

## Advanced Troubleshooting

### Controller won't stay connected

**Potential causes and fixes:**

1. **Weak WiFi Signal**
   - Move controller closer to router
   - Add a WiFi extender near the controller
   - Use a 2.4GHz-dedicated router if possible

2. **Router Settings**
   - Enable 2.4GHz band (disable "5GHz only" mode)
   - Disable WiFi isolation/client isolation
   - Allow cloud connectivity (don't block AC Infinity domains)

3. **Firmware Outdated**
   - Open AC Infinity app
   - Go to controller settings
   - Check for and install firmware updates

### Credentials work in app but not EnviroFlow

**This usually means:**

1. **Third-party login:** You're using Google/Apple sign-in in the AC Infinity app
   - **Fix:** Log out and create a password-based AC Infinity account

2. **Special characters in password:** Some characters may need escaping
   - **Fix:** Change your AC Infinity password to use only letters and numbers

3. **Recent password change:** API may not have updated yet
   - **Fix:** Wait 2-5 minutes after changing password, then try again

## Getting Help

If you've tried all troubleshooting steps and still can't connect:

1. **AC Infinity Support**
   - Website: [https://www.acinfinity.com/contact/](https://www.acinfinity.com/contact/)
   - Verify your controller works with their official app first

2. **EnviroFlow Support**
   - Email: support@enviroflow.app
   - Include: Controller model, error message, and steps you've tried

3. **Community Forum**
   - Search for similar issues
   - Post your question with details

## Tips for Success

- **Name controllers clearly:** Use descriptive names like "Veg Room A" instead of "Controller 1"
- **Assign to rooms:** Group controllers by physical location for better organization
- **Monitor connection status:** Check the Controllers page regularly to ensure all devices are online
- **Keep firmware updated:** Regular updates improve stability and add features
- **Test with official app first:** If EnviroFlow can't connect, verify the AC Infinity app works first

## Security & Privacy

- **Credentials are encrypted** using AES-256-GCM encryption at rest
- **Credentials are never exposed** in API responses or logs
- **EnviroFlow doesn't modify** your controller settings without your explicit action
- **Read-only by default:** EnviroFlow only reads sensor data unless you create control workflows
