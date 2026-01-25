# CSV Upload Connection Guide

## Overview

CSV Upload allows you to manually import sensor data into EnviroFlow. This is ideal for:

- Controllers without API access
- Historical data import
- Manual data logging
- Legacy equipment
- Testing and development
- Offline data collection

**No credentials needed** - just upload a CSV file with your sensor readings.

## Prerequisites

- [ ] CSV file prepared with sensor data
- [ ] Data in correct format (see below)
- [ ] Basic spreadsheet software (Excel, Google Sheets, LibreOffice, etc.)

## Step 1: Download CSV Template

Get the official CSV template to ensure correct formatting:

1. **Go to EnviroFlow**
2. **Click "Add Controller"**
3. **Select "CSV Upload"**
4. **Click "Download CSV template"** link

**Or download directly:** `https://enviroflow.app/api/controllers/csv-template`

## Step 2: Prepare Your Data

### Required CSV Format

Your CSV must have these columns (in any order):

| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| `timestamp` | When reading was taken | `2024-01-24T10:30:00Z` | Yes |
| `sensor_type` | Type of sensor | `temperature` | Yes |
| `value` | Numeric reading | `72.5` | Yes |
| `unit` | Unit of measurement | `°F` | Yes |
| `port` | Sensor port/channel | `1` | No |

### Example CSV Content

```csv
timestamp,sensor_type,value,unit,port
2024-01-24T10:00:00Z,temperature,72.5,°F,1
2024-01-24T10:00:00Z,humidity,65.0,%,2
2024-01-24T10:15:00Z,temperature,73.0,°F,1
2024-01-24T10:15:00Z,humidity,64.5,%,2
2024-01-24T10:30:00Z,temperature,72.8,°F,1
2024-01-24T10:30:00Z,humidity,66.0,%,2
```

### Timestamp Format

**Use ISO 8601 format:** `YYYY-MM-DDTHH:MM:SSZ`

**Examples:**
- `2024-01-24T10:30:00Z` - UTC time
- `2024-01-24T10:30:00-05:00` - Eastern Time (with timezone)
- `2024-01-24T10:30:00+00:00` - UTC time (explicit)

**Excel tip:** If using Excel date/time cells, format them as ISO 8601 before exporting to CSV.

### Supported Sensor Types

Use these exact values for `sensor_type`:

| Sensor Type | Description |
|-------------|-------------|
| `temperature` | Temperature readings |
| `humidity` | Relative humidity |
| `vpd` | Vapor Pressure Deficit |
| `co2` | CO2 levels |
| `light` | Light intensity |
| `ph` | pH levels |
| `ec` | Electrical conductivity |
| `pressure` | Barometric pressure |
| `soil_moisture` | Soil moisture |
| `wind_speed` | Wind speed |
| `pm25` | PM2.5 air quality |
| `water_level` | Water level |
| `uv` | UV index |
| `solar_radiation` | Solar radiation |
| `rain` | Rainfall |

### Supported Units

**Temperature:**
- `°F` - Fahrenheit
- `°C` - Celsius
- `K` - Kelvin

**Humidity:**
- `%` - Percentage
- `g/m³` - Grams per cubic meter

**VPD:**
- `kPa` - Kilopascals

**CO2:**
- `ppm` - Parts per million

**Light:**
- `lux` - Lux
- `µmol/m²/s` - PPFD

**pH:**
- `pH` - pH scale

**EC:**
- `mS/cm` - Millisiemens per centimeter
- `µS/cm` - Microsiemens per centimeter

**Pressure:**
- `hPa` - Hectopascals
- `inHg` - Inches of mercury
- `mmHg` - Millimeters of mercury

## Step 3: Upload to EnviroFlow

1. **Click "Add Controller"**
2. **Select "CSV Upload"** from brands
3. **Click the upload area** or drag your CSV file
4. **Verify** file name appears
5. **Click "Continue"**
6. **Name your controller** (e.g., "Manual Readings - January 2024")
7. **Optionally assign to a room**
8. **Click "Connect Controller"**

Your data will be imported immediately!

## Common Issues

### "Invalid CSV format"

**Cause:** CSV structure doesn't match requirements

**Fix:**
1. Download the official template again
2. Verify column headers match exactly (case-sensitive):
   - ✅ `timestamp` not `Timestamp` or `time`
   - ✅ `sensor_type` not `sensor` or `type`
   - ✅ `value` not `reading` or `measurement`
3. Save as CSV (not Excel .xlsx)
4. Use UTF-8 encoding
5. No blank rows at the top
6. No extra columns (extra columns are okay, they're ignored)

### "Invalid timestamp format"

**Cause:** Timestamps not in ISO 8601 format

**Fix:**
1. Use format: `YYYY-MM-DDTHH:MM:SSZ`
2. Must include 'T' between date and time
3. Time must have colons: `HH:MM:SS`
4. Add 'Z' at end for UTC, or timezone like `-05:00`

**Excel users:**
- Select timestamp column
- Format > Custom
- Use: `yyyy-mm-dd"T"hh:mm:ss"Z"`
- Copy values, paste into text editor
- Save as CSV

**Google Sheets users:**
- Use formula: `=TEXT(A1,"yyyy-mm-dd'T'hh:mm:ss'Z'")`
- Replace A1 with your date/time cell

### "Unknown sensor type"

**Cause:** Sensor type not recognized

**Fix:**
1. Use exact values from "Supported Sensor Types" table above
2. Check spelling: `temperature` not `temp`
3. Lowercase only: `humidity` not `Humidity`
4. No extra spaces: `co2` not `co2 `

### "Invalid unit"

**Cause:** Unit not recognized for that sensor type

**Fix:**
1. Match units to sensor type (can't use `°F` for humidity)
2. Use exact symbols: `°F` not `F` or `deg F`
3. Use `%` for humidity and percentages
4. Check "Supported Units" table above

### "Duplicate data"

**Cause:** Same timestamp + sensor_type uploaded multiple times

**Fix:**
- This is usually okay - EnviroFlow will update the previous value
- If you want to keep both readings, change the timestamp slightly
- Or use different `port` numbers to distinguish sensors

### "File too large"

**Cause:** CSV file exceeds size limit (usually 10 MB)

**Fix:**
1. Split large files into smaller chunks
2. Remove unnecessary columns
3. Upload data in batches (e.g., by month)
4. Consider using a different integration method for continuous data

## Tips for Success

### Data Organization

**Separate controllers for different periods:**
- "Manual Readings - January 2024"
- "Manual Readings - February 2024"

**OR combine into one:**
- "Manual Temperature Logger"
- Update with new CSV files periodically

### Formatting in Excel

1. **Prepare data in Excel**
2. **Format timestamp column** as ISO 8601
3. **Save As > CSV (Comma delimited) (.csv)**
4. **Close Excel** (to release file)
5. **Upload to EnviroFlow**

**Pro tip:** Use Excel formulas to convert your date format:
```excel
=TEXT(A2,"yyyy-mm-dd")&"T"&TEXT(A2,"hh:mm:ss")&"Z"
```

### Formatting in Google Sheets

1. **Prepare data in Google Sheets**
2. **Use TEXT formula** for timestamps (see above)
3. **File > Download > CSV (.csv)**
4. **Upload to EnviroFlow**

### Bulk Data Import

**For large datasets:**

1. **Sort by timestamp** (oldest first)
2. **Verify no gaps or duplicates**
3. **Split into manageable files** (1000-5000 rows each)
4. **Upload one at a time**
5. **Verify data in EnviroFlow** between uploads

### Updating Data

**To add new readings:**

1. Create a new CSV with only new data
2. Use the SAME controller name
3. Upload as usual
4. New readings will be added to existing controller

**To correct mistakes:**

1. Create CSV with corrected readings
2. Use exact same timestamps
3. Upload to same controller
4. EnviroFlow updates existing readings

## Advanced Usage

### Custom Port Numbers

Use `port` column to distinguish multiple sensors of same type:

```csv
timestamp,sensor_type,value,unit,port
2024-01-24T10:00:00Z,temperature,72.5,°F,1
2024-01-24T10:00:00Z,temperature,68.0,°F,2
2024-01-24T10:00:00Z,humidity,65.0,%,1
2024-01-24T10:00:00Z,humidity,70.0,%,2
```

**Port 1:** Main grow area
**Port 2:** Propagation area

### Calculated Sensors

**VPD is auto-calculated** from temperature + humidity in EnviroFlow, but you can also include it:

```csv
timestamp,sensor_type,value,unit,port
2024-01-24T10:00:00Z,temperature,75.0,°F,1
2024-01-24T10:00:00Z,humidity,60.0,%,1
2024-01-24T10:00:00Z,vpd,1.2,kPa,1
```

### Missing Data / Gaps

**Gaps in data are okay:**
- Just include the readings you have
- EnviroFlow handles gaps gracefully
- Charts will show gaps visually

**Don't fill gaps with fake data:**
- Leave missing periods out
- Don't use zeros or averages
- Honest data is best data

### Multiple Sensor Types

**You can mix sensor types in one CSV:**

```csv
timestamp,sensor_type,value,unit,port
2024-01-24T10:00:00Z,temperature,72.5,°F,1
2024-01-24T10:00:00Z,humidity,65.0,%,1
2024-01-24T10:00:00Z,co2,850,ppm,1
2024-01-24T10:00:00Z,light,500,µmol/m²/s,1
```

All will be imported as part of the same controller.

## Sample Use Cases

### Manual Logging

**Scenario:** You check sensors twice daily and record in a notebook

**Solution:**
1. Keep a notebook or spreadsheet of readings
2. At end of week/month, enter into CSV
3. Upload to EnviroFlow
4. Visualize trends and history

### Legacy Equipment

**Scenario:** Old controller with LCD display, no connectivity

**Solution:**
1. Read values from display
2. Record in CSV
3. Upload periodically
4. Get modern analytics for legacy hardware

### Historical Import

**Scenario:** You have years of data from old system

**Solution:**
1. Export data from old system
2. Convert to EnviroFlow CSV format
3. Upload in chunks by month/year
4. Analyze long-term trends

### Offline Grows

**Scenario:** Growing in remote location, no WiFi

**Solution:**
1. Use battery-powered data logger
2. Collect CSV file when you visit
3. Upload to EnviroFlow
4. Monitor trends between visits

## Getting Help

**CSV format questions:**
- Download the template
- Check examples in this guide
- Verify column names exactly

**Upload errors:**
- Email support@enviroflow.app
- Include: Error message, sample CSV (first 5 rows)

**Need custom format conversion:**
- Contact support with your format
- We can help create conversion script

## Why CSV Upload?

**Advantages:**
- ✅ No credentials needed
- ✅ No cloud dependencies
- ✅ Works with any hardware
- ✅ Privacy-friendly (your data, your control)
- ✅ Perfect for historical imports
- ✅ Simple and reliable

**Limitations:**
- ❌ Manual process (not automated)
- ❌ No real-time updates
- ❌ Can't control devices
- ❌ Requires data formatting

**When to use CSV:**
- Legacy/offline equipment
- Manual logging
- Historical data import
- Privacy-critical applications
- Testing/development

**When to use API integration:**
- Real-time monitoring needed
- Automated workflows
- Remote control of devices
- Modern WiFi-enabled hardware
