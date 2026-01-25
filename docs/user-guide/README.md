# EnviroFlow User Guide

Welcome to EnviroFlow - the universal environmental automation platform for monitoring sensors, controlling devices, and automating workflows across multiple hardware controllers.

## Table of Contents

1. [Getting Started](01-getting-started.md)
2. [Adding Controllers](02-adding-controllers.md)
3. [Dashboard & Monitoring](03-dashboard-monitoring.md)
4. [Creating Workflows](04-creating-workflows.md)
5. [Scheduling & Automation](05-scheduling-automation.md)
6. [Analytics & Reports](06-analytics-reports.md)
7. [Troubleshooting](07-troubleshooting.md)
8. [Advanced Features](08-advanced-features.md)

## Quick Start

New to EnviroFlow? Follow these steps to get started:

### 1. Create Your Account
1. Visit [enviroflow.app](https://enviroflow.app)
2. Click "Sign Up"
3. Enter your email and create a password
4. Verify your email address

### 2. Complete the Onboarding Tour
First-time users will see an interactive tour highlighting key features:
- Dashboard overview
- Adding your first controller
- Creating your first room
- Building a simple automation

You can restart the tour anytime from Settings > Help > Take Tour.

### 3. Add Your First Controller
1. Click "Add Controller" from the dashboard
2. Choose your controller brand (AC Infinity, Inkbird, Govee, MQTT, Ecowitt, or CSV Upload)
3. Follow the brand-specific setup guide
4. Test the connection

See [Adding Controllers](02-adding-controllers.md) for detailed instructions.

### 4. Create a Room
Organize your controllers by location:
1. Go to Rooms
2. Click "Create Room"
3. Name your room (e.g., "Vegetative Room A")
4. Assign controllers to the room
5. Save

### 5. Build Your First Workflow
Automate your environment:
1. Go to Workflows
2. Click "Create Workflow"
3. Use the visual workflow builder to:
   - Add sensor triggers (e.g., "When temperature > 80°F")
   - Add actions (e.g., "Turn on exhaust fan")
   - Connect nodes
4. Save and activate

See [Creating Workflows](04-creating-workflows.md) for examples.

## Supported Controllers

EnviroFlow works with these controller brands:

| Brand | Status | Features |
|-------|--------|----------|
| **AC Infinity** | Full Support | Cloud API, sensor reading, device control |
| **Govee** | Full Support | Temperature, humidity, smart plugs, LED control |
| **Ecowitt** | Full Support | Weather stations, 20+ sensor types, webhooks |
| **MQTT** | Full Support | Generic MQTT devices, Home Assistant |
| **Inkbird** | CSV Upload | Temperature/humidity controllers |
| **CSV Upload** | Full Support | Manual data import for any device |

See [Controller Guides](../controller-guides/) for brand-specific setup instructions.

## Key Features

### Real-Time Monitoring
- Live sensor data from all connected controllers
- VPD (Vapor Pressure Deficit) calculation
- Temperature, humidity, CO2, and more
- Customizable dashboard widgets

### Visual Workflow Builder
- Drag-and-drop workflow creation
- No coding required
- Conditional logic support
- Test mode (dry-run) before activation

### Device Scheduling
- Weekly/daily recurring schedules
- Sunrise/sunset dimming for lights
- Schedule templates and presets
- AI-powered recommendations

### Advanced Analytics
- Custom date range selection
- Heatmap visualizations
- Correlation analysis
- Export to CSV/JSON/PDF

### Smart Alerts
- Email and push notifications
- Controller health monitoring
- Proactive connection alerts
- Customizable alert thresholds

## Getting Help

### In-App Help
- **Tooltips:** Hover over any element with a question mark icon
- **Help Center:** Click the "?" icon in the top navigation
- **Error Guidance:** Detailed error messages with fix suggestions

### Documentation
- **User Guide:** You're reading it!
- **API Docs:** [docs/api/](../api/)
- **Controller Guides:** [docs/controller-guides/](../controller-guides/)
- **Admin Guide:** [docs/admin-guide.md](../admin-guide.md)

### Support
- **Email:** support@enviroflow.app
- **Community Forum:** [community.enviroflow.app](https://community.enviroflow.app)
- **GitHub Issues:** Report bugs or request features

## What's New in 2.0

EnviroFlow 2.0 includes major improvements:

- Interactive onboarding for new users
- Enhanced error handling with specific fix guidance
- Controller health scoring (0-100)
- Bulk controller operations
- Advanced analytics (heatmaps, correlations)
- Device scheduling with visual calendar
- Govee, MQTT, and Home Assistant integrations
- Ecowitt weather station support
- AI-powered schedule recommendations

See the [Changelog](../CHANGELOG.md) for complete details.

## Video Tutorials

Coming soon! Check back for video walkthroughs of common tasks.

## Best Practices

### Controller Setup
1. **Test with official app first** - Ensure your controller works with the manufacturer's app before adding to EnviroFlow
2. **Use descriptive names** - Name controllers clearly (e.g., "Veg Room North - AC69")
3. **Organize by rooms** - Group controllers by physical location
4. **Monitor health scores** - Check the Controllers page regularly for offline devices

### Workflow Design
1. **Start simple** - Begin with basic automations, add complexity gradually
2. **Use dry-run mode** - Test workflows without sending real commands
3. **Set safe limits** - Add minimum/maximum constraints to prevent extreme actions
4. **Log everything** - Enable activity logging for troubleshooting

### Data Management
1. **Export regularly** - Back up your workflows and sensor data
2. **Clean old data** - Sensor readings are retained for 30 days by default
3. **Review activity logs** - Check automation history monthly
4. **Update credentials** - Rotate controller passwords periodically

### Security
1. **Enable 2FA** - Use two-factor authentication for your EnviroFlow account
2. **Use strong passwords** - For both EnviroFlow and controller accounts
3. **Review permissions** - Check which devices have access to your controllers
4. **Monitor audit logs** - Review sensitive actions in Settings > Security

## Common Workflows

### VPD Automation
Maintain optimal VPD for plant growth:
1. Add temperature and humidity sensors
2. Create workflow: "When VPD > 1.5 kPa, turn on humidifier"
3. Add reciprocal: "When VPD < 0.8 kPa, turn off humidifier"
4. Test in dry-run mode
5. Activate

### Lighting Schedule
Automate lights with sunrise/sunset dimming:
1. Connect dimmable light controller (AC Infinity, Govee)
2. Go to Schedules > Create Schedule
3. Set "Lights On" at 6:00 AM with 30-minute sunrise
4. Set "Lights Off" at 10:00 PM with 30-minute sunset
5. Choose dimming curve (linear, natural, or custom)
6. Save and activate

### Temperature Control
Keep temperature in optimal range:
1. Add temperature sensor and exhaust fan
2. Create workflow: "When temp > 85°F, set fan to 100%"
3. Add: "When temp 75-85°F, set fan to 50%"
4. Add: "When temp < 75°F, set fan to 25%"
5. Set minimum fan speed for air circulation
6. Test and activate

### Alert Setup
Get notified of critical events:
1. Go to Settings > Notifications
2. Enable email/push notifications
3. Set alert thresholds:
   - Temperature: Alert if > 90°F or < 60°F
   - Humidity: Alert if > 80% or < 40%
   - Controller offline: Alert after 5 minutes
4. Choose notification recipients
5. Save

## Keyboard Shortcuts

Speed up your workflow with keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Quick search |
| `Ctrl/Cmd + N` | New workflow |
| `Ctrl/Cmd + S` | Save current workflow |
| `Ctrl/Cmd + /` | Open help |
| `Esc` | Close modal/dialog |
| `Shift + ?` | Show all shortcuts |

## Mobile Access

EnviroFlow is fully responsive and works on mobile devices:

- **Dashboard:** Monitor sensors on the go
- **Alerts:** Receive push notifications
- **Quick actions:** Start/stop workflows
- **Device control:** Control devices remotely

For the best mobile experience:
1. Add EnviroFlow to your home screen (PWA)
2. Enable push notifications
3. Use landscape mode for workflow editing

## FAQ

### Can I use EnviroFlow without WiFi controllers?
Yes! Use the CSV Upload feature to manually import sensor data from any device.

### How many controllers can I connect?
No limit on the number of controllers. The platform is designed to scale.

### Is my data secure?
Yes. All controller credentials are encrypted with AES-256-GCM. See our [Security Guide](../admin/security.md) for details.

### Can I export my data?
Absolutely. Export sensor readings (CSV), workflows (JSON), or full reports (PDF) anytime.

### What happens if my internet goes down?
Controllers continue operating with their local automation. EnviroFlow reconnects automatically when internet is restored.

### Can I share workflows with others?
You can export workflows as JSON files and share them. Import/export is in Workflows > Menu > Export/Import.

### How accurate is the VPD calculation?
VPD is calculated using the standard formula with temperature and humidity. Accuracy depends on your sensor quality.

### Can I control multiple rooms at once?
Yes! Use bulk operations or create workflows that apply to multiple rooms.

## Next Steps

Ready to dive deeper? Continue to:

- [Adding Controllers](02-adding-controllers.md) - Detailed setup for each brand
- [Creating Workflows](04-creating-workflows.md) - Advanced automation examples
- [Analytics & Reports](06-analytics-reports.md) - Data analysis and insights

Welcome to EnviroFlow! Let's automate your environment.
