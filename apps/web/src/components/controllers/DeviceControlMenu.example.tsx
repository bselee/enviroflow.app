/**
 * DeviceControlMenu Usage Example
 *
 * This file demonstrates how to integrate the DeviceControlMenu component
 * into a device card on the dashboard.
 */

import { DeviceControlMenu } from "./DeviceControlMenu";
import { useDeviceControl } from "@/hooks/use-device-control";

/**
 * Example: Device Card with Control Menu
 *
 * Shows how to add the DeviceControlMenu to the upper right corner
 * of a device card component.
 */
export function DeviceCardExample({ controllerId }: { controllerId: string }) {
  const { devices, isLoading } = useDeviceControl(controllerId);

  if (isLoading) {
    return <div>Loading devices...</div>;
  }

  return (
    <div className="space-y-4">
      {devices.map((device) => (
        <div
          key={device.port}
          className="relative rounded-lg border bg-card p-4 shadow-sm"
        >
          {/* Control menu in upper right corner */}
          <div className="absolute right-2 top-2">
            <DeviceControlMenu
              controllerId={controllerId}
              device={device}
              onCommandSuccess={() => {
                console.log(`Command executed for ${device.name}`);
              }}
            />
          </div>

          {/* Device card content */}
          <div className="space-y-2">
            <h3 className="font-semibold">{device.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Port {device.port}</span>
              <span>•</span>
              <span>{device.deviceType}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Status:</span>
              <span
                className={`text-sm font-medium ${device.isOn ? "text-green-600" : "text-gray-500"}`}
              >
                {device.isOn ? "On" : "Off"}
              </span>
            </div>
            {device.supportsDimming && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Level:</span>
                <span className="text-sm font-medium">{device.level}%</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Example: Inline Usage in Table Row
 *
 * Shows how to use DeviceControlMenu in a table layout.
 */
export function DeviceTableExample({ controllerId }: { controllerId: string }) {
  const { devices } = useDeviceControl(controllerId);

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Name</th>
          <th>Port</th>
          <th>Status</th>
          <th>Level</th>
          <th className="w-10">Actions</th>
        </tr>
      </thead>
      <tbody>
        {devices.map((device) => (
          <tr key={device.port}>
            <td>{device.name}</td>
            <td>Port {device.port}</td>
            <td>{device.isOn ? "On" : "Off"}</td>
            <td>{device.supportsDimming ? `${device.level}%` : "-"}</td>
            <td>
              <DeviceControlMenu
                controllerId={controllerId}
                device={device}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Example: With Custom Success Handler
 *
 * Shows how to handle command success with a custom callback,
 * such as refreshing related data or showing a custom notification.
 */
export function DeviceCardWithRefreshExample({
  controllerId
}: {
  controllerId: string
}) {
  const { devices, refreshDevices } = useDeviceControl(controllerId);

  const handleCommandSuccess = async () => {
    // Refresh device list to get updated states
    await refreshDevices();

    // You could also:
    // - Refresh sensor readings
    // - Update activity logs
    // - Trigger analytics refresh
    console.log("Device state refreshed after command");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {devices.map((device) => (
        <div
          key={device.port}
          className="relative rounded-lg border bg-card p-4"
        >
          <div className="absolute right-2 top-2">
            <DeviceControlMenu
              controllerId={controllerId}
              device={device}
              onCommandSuccess={handleCommandSuccess}
            />
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">{device.name}</h3>
            <div className="text-sm text-muted-foreground">
              {device.deviceType} on Port {device.port}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
