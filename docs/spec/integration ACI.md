AC Infinity’s Wi‑Fi/Bluetooth UIS controllers can be monitored and controlled from Home Assistant by using a community integration that talks to AC Infinity’s cloud API over Wi‑Fi; Bluetooth is not used directly by Home Assistant today. [github](https://github.com/dalinicus/homeassistant-acinfinity)

## 1. What works today

- Supported controllers include **Controller 69 WiFi / 69 Pro / 69 Pro+ / AI+**, as long as they are connected to 2.4 GHz Wi‑Fi and linked to an AC Infinity cloud account. [acinfinity](https://acinfinity.com/controller-ai-environment-controller-uis-8-port-with-temp-humidity-vpd-sensor/)
- The integration exposes entities for temperature, humidity, VPD, ports, modes, and power levels, and can be visualized with an AC Infinity‑style Lovelace card for “Home Assistant‑like” dashboards. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- Bluetooth‑only controllers (e.g., 67, base 69) are not supported because they do not sync directly to the UIS cloud. [github](https://github.com/dalinicus/homeassistant-acinfinity)

## 2. Controller and app prerequisites

- Use a UIS controller with **Wi‑Fi + Bluetooth** (e.g., AI+, 69 Pro+, 69 WiFi) and connect it to the AC Infinity app over 2.4 GHz Wi‑Fi; this enables cloud control and advanced programs/graphs. [acinfinity](https://acinfinity.com/pages/controller-programming/controller-ai-overview.html)
- Confirm that the controller shows the Wi‑Fi/cloud icon when paired with the app; this indicates that the device is reachable through the online service that the Home Assistant integration will use. [acinfinity](https://acinfinity.com/pages/controller-programming/controller-ai-overview.html)

## 3. Home Assistant integration setup

- Install HACS if you have not already, then add **“AC Infinity”** from HACS (either the original `dalinicus/homeassistant-acinfinity` or the enhanced fork `JoshuaSeidel/homeassistant-acinfinity`). [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- In Home Assistant: Settings → Devices & Services → **Add Integration** → search for “AC Infinity”, then enter the **email and password** for your AC Infinity cloud account and choose a polling interval (minimum 5 seconds). [github](https://github.com/dalinicus/homeassistant-acinfinity)

## 4. Entities and dashboard “controller” card

- After setup, Home Assistant will create entities such as: controller sensor readings (temp, humidity, VPD), port states and power levels, and controller mode/status. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- For a controller‑like UI, install the Lovelace card from `acinfinityhomeassistantcard` or the card packaged with the enhanced fork; it mimics the physical controller display, with clickable ports and real‑time data. [github](https://github.com/almighty059/acinfinityhomeassistantcard)

## 5. Limitations and local/Bluetooth angle

- Current community integrations are **cloud‑backed**: they poll the AC Infinity API using your account credentials; there is no officially documented local LAN or MQTT API, and no direct use of Bluetooth from Home Assistant yet. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-bluetooth-69-pro-controllers-successful/514068)
- Some community members have experimented with Linux/BLE tools to talk to Bluetooth‑only controllers, but this is low‑level, undocumented work and not packaged as a robust Home Assistant integration at this time. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-bluetooth-69-pro-controllers-successful/514068)

If you share which exact controller model(s) you have and whether you want full local‑only control, a step‑by‑step tailored path (including possible BLE/MQTT bridge approaches) can be sketched out.
To connect to an AC Infinity Wi‑Fi/Bluetooth controller in a “foolproof” way, the most robust path today is: use the Wi‑Fi/cloud link with the existing Home Assistant custom integration and avoid writing low‑level API/BLE code yourself. [github](https://github.com/dalinicus/homeassistant-acinfinity)

Below is a practical, end‑to‑end outline with concrete steps and example code where it actually helps.

## 1. Hardware and account checklist

- Use a **Wi‑Fi‑capable** UIS controller (69 WiFi, 69 Pro, 69 Pro+, AI+). Bluetooth‑only units (e.g., 67) will not work with this method. [github](https://github.com/dalinicus/homeassistant-acinfinity)
- Create an AC Infinity cloud account and connect the controller to 2.4 GHz Wi‑Fi through the mobile app (follow “Connecting to the App” instructions). [acinfinity](https://acinfinity.com/pages/app-programming/connecting-to-the-app.html)

## 2. Home Assistant + HACS setup

- Ensure Home Assistant is running and updated; HACS must be installed (standard instructions on HACS site; once installed, HACS appears in the sidebar). [home-assistant](https://www.home-assistant.io/getting-started/integration/)
- In HACS:  
  - Open HACS → three dots → **Custom repositories** → add `https://github.com/JoshuaSeidel/homeassistant-acinfinity` as an **Integration** repo, then install “AC Infinity”. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

## 3. “Foolproof” connection steps (no custom code)

- Restart Home Assistant after installing the integration. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- Go to Settings → Devices & Services → **Add Integration** → search “AC Infinity” → select it and enter:  
  - Email = your AC Infinity account email  
  - Password = the same account password. [github](https://github.com/dalinicus/homeassistant-acinfinity)
- In the integration options, set a **polling interval** (5–30 seconds; 5 is the minimum allowed). [github](https://github.com/dalinicus/homeassistant-acinfinity)

If the credentials are correct and the controller is online in the app, Home Assistant will create devices and entities automatically, with no extra YAML required. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

## 4. Basic automations in YAML (actual “coding” part)

Once the entities exist, your “coding” is standard Home Assistant YAML. Example: turn on a fan port if temp > 80 °F.

- Identify the entities in Settings → Devices & Services → AC Infinity device page (e.g., `sensor.ac_infinity_ai_temperature`, `switch.ac_infinity_port_1`). [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- In `automations.yaml` (or via UI → Automations → Edit YAML):

```yaml
alias: AC Infinity - Cool when hot
mode: single
trigger:
  - platform: numeric_state
    entity_id: sensor.ac_infinity_ai_temperature
    above: 80
condition: []
action:
  - service: switch.turn_on
    target:
      entity_id: switch.ac_infinity_port_1
```

- Reload automations or restart HA; this uses only the integration’s entities and standard HA services. [home-assistant](https://www.home-assistant.io/getting-started/integration/)

## 5. Optional: controller‑style dashboard card

To get a Home‑Assistant‑style “controller screen”:

- Use the `acinfinityhomeassistantcard` Lovelace resources from GitHub. [github](https://github.com/almighty059/acinfinityhomeassistantcard)
- In HACS (Front‑end) or manually, add the JS resource, then in a dashboard:

```yaml
type: custom:acinfinity-card
entity: climate.ac_infinity_ai_controller   # Example main entity
name: Tent Controller
```

- The card repo includes example YAML for pop‑up and main cards; copy and adjust entity IDs to match your system. [github](https://github.com/almighty059/acinfinityhomeassistantcard)

## 6. If you truly want raw “coding to the API”

AC Infinity has not published a stable, public local LAN or UIS API; the HA integration wraps their cloud endpoints and handles auth, device discovery, and JSON parsing for you. [github](https://github.com/dalinicus/homeassistant-acinfinity)

If you still want to write code yourself (e.g., a Python script outside HA):

- Study the integration’s `api.py` / similar modules in `homeassistant-acinfinity` to see:  
  - Login endpoint, auth payload, headers.  
  - Polling endpoints returning controller state and ports. [github](https://github.com/dalinicus/homeassistant-acinfinity)
- Re‑implement those HTTP calls using `requests` in Python and a scheduler (e.g., loop every 5–10 seconds). Authentication typically uses email/password → token pattern, then Bearer- or session‑style auth headers, similar to standard web APIs. [scrapfly](https://scrapfly.io/blog/answers/how-to-set-authorization-with-curl-full-examples-guide)

That route is more brittle, because any AC Infinity cloud change can break your code; using the maintained HA integration is mechanically safer and requires less ongoing maintenance. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

If you tell which exact controller model you own and whether you want only cloud, only local, or a future‑proof abstraction (e.g., MQTT bridge), the outline can be tightened into a step‑by‑step checklist specific to your stack (HA OS vs Container, existing MQTT, etc.).
Home Assistant can integrate AC Infinity UIS Wi‑Fi controllers cleanly via HACS in about three phases: confirm hardware/app, install the integration through HACS, then add and tune the integration in HA. [github](https://github.com/dalinicus/homeassistant-acinfinity)

## 1. Prerequisites

- Use a **UIS Wi‑Fi** controller (e.g., 69 WiFi/Pro/Pro+, AI+) already linked to the AC Infinity mobile app and online. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- Have Home Assistant running with HACS installed and initialized in the sidebar; follow the standard HACS install docs or helper guides if not present yet. [asus](https://www.asus.com/support/faq/1055947/)

## 2. Install AC Infinity integration via HACS

- Open HACS → Integrations; AC Infinity’s original integration is in the default feed, and the enhanced fork is added as a custom repo. [github](https://github.com/dalinicus/homeassistant-acinfinity)
- For the **enhanced fork** (recommended): in HACS click ⋮ → Custom repositories → add `https://github.com/JoshuaSeidel/homeassistant-acinfinity` with category **Integration**, then search for “AC Infinity” in HACS and install it. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

## 3. Add the integration in Home Assistant

- Restart Home Assistant after HACS finishes installing the integration. [github](https://github.com/dalinicus/homeassistant-acinfinity)
- Go to Settings → Devices & Services → **Add Integration** → search “AC Infinity” → select it and enter:  
  - Email: AC Infinity account email  
  - Password: AC Infinity account password. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

## 4. Configure options and confirm entities

- In the integration’s **Configure** dialog, set the **Polling Interval (Seconds)**; minimum allowed is 5 seconds, typical is 5–30 depending on load tolerance. [github](https://github.com/dalinicus/homeassistant-acinfinity)
- Save and wait for discovery; a device per controller appears with many entities (temps, humidity, VPD, ports, modes, etc.), especially on AI+ where 100+ data points are exposed. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

## 5. Optional: add the controller card

- To mirror the controller UI, add the Lovelace card repo: in HACS → Frontend → ⋮ → Custom repositories → `https://github.com/JoshuaSeidel/hass-acinfinity-lovelace-card` category **Dashboard** and install “AC Infinity Controller Card”. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)
- Restart HA, then add a card to a dashboard using something like:  
  ```yaml
  type: custom:ac-infinity-card
  title: Grow Tent Controller
  auto_detect: true
  show_ports: true
  show_sensors: true
  ```  
  which auto‑detects entities and gives a controller‑style interface. [community.home-assistant](https://community.home-assistant.io/t/ac-infinity-updated-integration-and-lovelace-card/958620)

If you share whether you’re on HA OS, Container, or Supervised, a tighter checklist (with where to click and what to expect on each screen) can be mapped directly onto your setup.