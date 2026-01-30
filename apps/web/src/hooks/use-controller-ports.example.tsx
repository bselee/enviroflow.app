/**
 * Example usage of useControllerPorts hook
 *
 * This example demonstrates how to use the useControllerPorts hook
 * in a workflow builder component to populate port selection dropdowns.
 */

import { useControllerPorts } from './use-controller-ports';

export function PortSelectorExample({ controllerId }: { controllerId: string }) {
  const { ports, loading, error, refetch } = useControllerPorts({
    controllerId,
    enabled: true,
  });

  if (loading) {
    return <div>Loading ports...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h3>Available Ports</h3>
      <button onClick={refetch}>Refresh Ports</button>

      <select>
        {ports.map((port) => (
          <option key={port.id} value={port.port_number}>
            Port {port.port_number}: {port.port_name || 'Unnamed'}
            ({port.device_type || 'No device'})
            {port.is_online ? ' - Online' : ' - Offline'}
          </option>
        ))}
      </select>

      <div>
        <h4>Port Details</h4>
        {ports.map((port) => (
          <div key={port.id}>
            <strong>Port {port.port_number}</strong>
            <ul>
              <li>Name: {port.port_name || 'Unnamed'}</li>
              <li>Device: {port.device_type || 'None'}</li>
              <li>Status: {port.is_on ? 'On' : 'Off'}</li>
              <li>Power Level: {port.power_level}/10</li>
              <li>Mode: {['OFF', 'ON', 'AUTO', 'TIMER', 'CYCLE', 'SCHEDULE', 'VPD'][port.current_mode]}</li>
              <li>Dimming: {port.supports_dimming ? 'Yes' : 'No'}</li>
              <li>Online: {port.is_online ? 'Yes' : 'No'}</li>
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Example: Conditionally enabled hook
 */
export function ConditionalPortsExample({
  controllerId,
  shouldFetch
}: {
  controllerId: string;
  shouldFetch: boolean;
}) {
  const { ports, loading } = useControllerPorts({
    controllerId,
    enabled: shouldFetch, // Only fetch when needed
  });

  if (!shouldFetch) {
    return <div>Port fetching disabled</div>;
  }

  return (
    <div>
      {loading ? 'Loading...' : `Found ${ports.length} ports`}
    </div>
  );
}

/**
 * Example: No controller selected
 */
export function NoControllerExample() {
  // Returns empty array when no controllerId provided
  const { ports } = useControllerPorts({});

  return <div>Ports: {ports.length}</div>; // Will show "Ports: 0"
}
