'use client';

import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { ConnectionWire, ConnectionWireFilters } from './ConnectionWire';

interface DevicePosition {
  id: string;
  x: number;
  y: number;
  deviceType: string;
  isActive: boolean;
}

interface ControllerPosition {
  x: number;
  y: number;
}

interface ConnectionWireContainerProps {
  children: ReactNode;
  controllerId: string;
  className?: string;
}

/**
 * Container component that manages wire connections between controller and devices.
 * Uses refs and ResizeObserver to dynamically calculate positions.
 */
export const ConnectionWireContainer = ({
  children,
  controllerId,
  className = '',
}: ConnectionWireContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [controllerPos, setControllerPos] = useState<ControllerPosition | null>(null);
  const [devicePositions, setDevicePositions] = useState<DevicePosition[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  /**
   * Calculate position of an element relative to the container
   */
  const getRelativePosition = useCallback((element: Element, container: Element) => {
    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate center point of the element
    const x = elementRect.left - containerRect.left + elementRect.width / 2;
    const y = elementRect.top - containerRect.top + elementRect.height / 2;

    return { x, y };
  }, []);

  /**
   * Update all wire positions
   */
  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Find controller card (must have data-controller-id attribute)
    const controllerElement = container.querySelector(`[data-controller-id="${controllerId}"]`);
    if (controllerElement) {
      const pos = getRelativePosition(controllerElement, container);
      setControllerPos(pos);
    }

    // Find all device cards (must have data-device-id, data-device-type, and data-device-active attributes)
    const deviceElements = container.querySelectorAll(`[data-device-controller="${controllerId}"]`);
    const positions: DevicePosition[] = [];

    deviceElements.forEach((element) => {
      const deviceId = element.getAttribute('data-device-id');
      const deviceType = element.getAttribute('data-device-type');
      const isActive = element.getAttribute('data-device-active') === 'true';

      if (deviceId && deviceType) {
        const pos = getRelativePosition(element, container);
        positions.push({
          id: deviceId,
          x: pos.x,
          y: pos.y,
          deviceType,
          isActive,
        });
      }
    });

    setDevicePositions(positions);
  }, [controllerId, getRelativePosition]);

  /**
   * Set up ResizeObserver and window resize handler
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // Initial position calculation
    updatePositions();

    // Set up ResizeObserver for container and children
    resizeObserverRef.current = new ResizeObserver(() => {
      updatePositions();
    });

    resizeObserverRef.current.observe(containerRef.current);

    // Observe all children that might affect layout
    const observer = resizeObserverRef.current;
    const children = containerRef.current.querySelectorAll('[data-controller-id], [data-device-id]');
    children.forEach((child) => observer.observe(child));

    // Window resize handler
    const handleResize = () => {
      updatePositions();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [updatePositions]);

  /**
   * Also update positions when children change (devices added/removed)
   */
  useEffect(() => {
    // Small delay to allow DOM to update
    const timeout = setTimeout(updatePositions, 50);
    return () => clearTimeout(timeout);
  }, [children, updatePositions]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* SVG overlay for connection wires */}
      {controllerPos && devicePositions.length > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            width: '100%',
            height: '100%',
          }}
        >
          <ConnectionWireFilters />

          {/* Render wire for each device */}
          {devicePositions.map((device) => (
            <ConnectionWire
              key={device.id}
              startX={controllerPos.x}
              startY={controllerPos.y}
              endX={device.x}
              endY={device.y}
              isActive={device.isActive}
              deviceType={device.deviceType}
              animated={true}
            />
          ))}
        </svg>
      )}

      {/* Actual content (cards) */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

/**
 * Helper components for marking controller and device cards
 */

interface ControllerCardWrapperProps {
  controllerId: string;
  children: ReactNode;
  className?: string;
}

export const ControllerCardWrapper = ({
  controllerId,
  children,
  className = '',
}: ControllerCardWrapperProps) => {
  return (
    <div
      data-controller-id={controllerId}
      className={className}
    >
      {children}
    </div>
  );
};

interface DeviceCardWrapperProps {
  deviceId: string;
  controllerId: string;
  deviceType: string;
  isActive: boolean;
  children: ReactNode;
  className?: string;
}

export const DeviceCardWrapper = ({
  deviceId,
  controllerId,
  deviceType,
  isActive,
  children,
  className = '',
}: DeviceCardWrapperProps) => {
  return (
    <div
      data-device-id={deviceId}
      data-device-controller={controllerId}
      data-device-type={deviceType}
      data-device-active={isActive.toString()}
      className={className}
    >
      {children}
    </div>
  );
};
