/**
 * Example usage of useControllerModes hook
 *
 * This example demonstrates how to use the useControllerModes hook
 * in a workflow builder component to display and verify current mode configurations.
 */

import { useControllerModes } from './use-controller-modes';

export function ModeConfigDisplayExample({ controllerId }: { controllerId: string }) {
  const { modes, loading, error, refetch } = useControllerModes({
    controllerId,
    enabled: true,
  });

  if (loading) {
    return <div>Loading mode configurations...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h3>Controller Mode Configurations</h3>
      <button onClick={refetch}>Refresh Modes</button>

      {modes.map((mode) => (
        <div key={mode.id}>
          <h4>
            Port {mode.port_number} - {mode.mode_name}
            {mode.is_active && ' (ACTIVE)'}
          </h4>

          {/* AUTO Mode Display */}
          {mode.autoConfig && (
            <div>
              <h5>Auto Mode Settings</h5>
              <ul>
                <li>Temp High: {mode.autoConfig.tempHighTrigger}°F</li>
                <li>Temp Low: {mode.autoConfig.tempLowTrigger}°F</li>
                <li>Humidity High: {mode.autoConfig.humidityHighTrigger}%</li>
                <li>Humidity Low: {mode.autoConfig.humidityLowTrigger}%</li>
                <li>Behavior: {mode.autoConfig.deviceBehavior}</li>
                <li>Level Range: {mode.autoConfig.minLevel}-{mode.autoConfig.maxLevel}</li>
                <li>Transition: {mode.autoConfig.transitionEnabled ? 'Yes' : 'No'}</li>
              </ul>
            </div>
          )}

          {/* VPD Mode Display */}
          {mode.vpdConfig && (
            <div>
              <h5>VPD Mode Settings</h5>
              <ul>
                <li>VPD High: {mode.vpdConfig.vpdHighTrigger} kPa</li>
                <li>VPD Low: {mode.vpdConfig.vpdLowTrigger} kPa</li>
                <li>Leaf Temp Offset: {mode.vpdConfig.leafTempOffset}°F</li>
                <li>Behavior: {mode.vpdConfig.deviceBehavior}</li>
                <li>Level Range: {mode.vpdConfig.minLevel}-{mode.vpdConfig.maxLevel}</li>
              </ul>
            </div>
          )}

          {/* Timer Mode Display */}
          {mode.timerConfig && (
            <div>
              <h5>Timer Mode Settings</h5>
              <ul>
                <li>Type: {mode.timerConfig.timerType}</li>
                <li>Duration: {mode.timerConfig.timerDuration}s</li>
              </ul>
            </div>
          )}

          {/* Cycle Mode Display */}
          {mode.cycleConfig && (
            <div>
              <h5>Cycle Mode Settings</h5>
              <ul>
                <li>On Duration: {mode.cycleConfig.cycleOnDuration}s</li>
                <li>Off Duration: {mode.cycleConfig.cycleOffDuration}s</li>
              </ul>
            </div>
          )}

          {/* Schedule Mode Display */}
          {mode.scheduleConfig && (
            <div>
              <h5>Schedule Mode Settings</h5>
              <ul>
                <li>Start: {mode.scheduleConfig.scheduleStartTime}</li>
                <li>End: {mode.scheduleConfig.scheduleEndTime}</li>
                <li>Days: {mode.scheduleConfig.scheduleDays?.toString(2)}</li>
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Example: Filter modes for a specific port
 */
export function SinglePortModesExample({
  controllerId,
  portNumber
}: {
  controllerId: string;
  portNumber: number;
}) {
  const { modes, loading } = useControllerModes({
    controllerId,
    port: portNumber, // Only get modes for this port
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <h4>Port {portNumber} Modes ({modes.length})</h4>
      {modes.map((mode) => (
        <div key={mode.id}>
          {mode.mode_name} {mode.is_active && '✓'}
        </div>
      ))}
    </div>
  );
}

/**
 * Example: Get active mode for a port
 */
export function ActiveModeIndicatorExample({
  controllerId,
  portNumber
}: {
  controllerId: string;
  portNumber: number;
}) {
  const { modes, loading } = useControllerModes({
    controllerId,
    port: portNumber,
  });

  if (loading) {
    return <span>...</span>;
  }

  // Find the active mode
  const activeMode = modes.find(m => m.is_active);

  if (!activeMode) {
    return <span>No active mode</span>;
  }

  return (
    <span>
      Current Mode: {activeMode.mode_name}
    </span>
  );
}

/**
 * Example: Conditional fetching
 */
export function ConditionalModesExample({
  controllerId,
  shouldFetch
}: {
  controllerId: string;
  shouldFetch: boolean;
}) {
  const { modes, loading } = useControllerModes({
    controllerId,
    enabled: shouldFetch, // Only fetch when panel is open
  });

  if (!shouldFetch) {
    return <div>Mode fetching disabled</div>;
  }

  return (
    <div>
      {loading ? 'Loading...' : `Found ${modes.length} mode configurations`}
    </div>
  );
}
