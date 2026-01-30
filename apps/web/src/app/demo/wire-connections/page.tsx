'use client';

/**
 * Demo page for ConnectionWire components
 * Shows various layouts and wire connection styles
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ConnectionWireContainer,
  ControllerCardWrapper,
  DeviceCardWrapper,
} from '@/components/controllers/ConnectionWireContainer';

// Mock data for demonstration
const MOCK_CONTROLLER = {
  id: 'ctrl-1',
  name: 'AC Infinity Controller 69',
  brand: 'AC Infinity',
  status: 'online' as const,
};

const MOCK_DEVICES = [
  { id: 'dev-1', name: 'Exhaust Fan', type: 'fan', isOn: true, power: 75 },
  { id: 'dev-2', name: 'LED Grow Light', type: 'light', isOn: true, power: 100 },
  { id: 'dev-3', name: 'Circulation Fan', type: 'fan', isOn: false, power: 0 },
  { id: 'dev-4', name: 'Heater', type: 'heater', isOn: false, power: 0 },
  { id: 'dev-5', name: 'Humidifier', type: 'humidifier', isOn: true, power: 60 },
  { id: 'dev-6', name: 'Power Outlet', type: 'outlet', isOn: true, power: 100 },
];

export default function WireConnectionDemoPage() {
  const [devices, setDevices] = useState(MOCK_DEVICES);

  const toggleDevice = (deviceId: string) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === deviceId
          ? { ...device, isOn: !device.isOn }
          : device
      )
    );
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Connection Wire Demo</h1>
          <p className="text-muted-foreground">
            Click devices to toggle them on/off and see the wire colors change
          </p>
        </div>

        {/* Main Demo */}
        <ConnectionWireContainer
          controllerId={MOCK_CONTROLLER.id}
          className="bg-muted/20 rounded-lg p-8"
        >
          {/* Controller Card */}
          <div className="flex justify-center mb-16">
            <ControllerCardWrapper controllerId={MOCK_CONTROLLER.id}>
              <Card className="w-96 border-2 border-primary shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{MOCK_CONTROLLER.name}</span>
                    <Badge variant="default">
                      {MOCK_CONTROLLER.status.toUpperCase()}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Brand: {MOCK_CONTROLLER.brand}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Connected Devices: {devices.length}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Active: {devices.filter((d) => d.isOn).length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </ControllerCardWrapper>
          </div>

          {/* Device Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {devices.map((device) => (
              <DeviceCardWrapper
                key={device.id}
                deviceId={device.id}
                controllerId={MOCK_CONTROLLER.id}
                deviceType={device.type}
                isActive={device.isOn}
              >
                <Card
                  className={`
                    cursor-pointer transition-all hover:scale-105
                    ${device.isOn ? 'border-2 border-primary shadow-lg' : 'border'}
                  `}
                  onClick={() => toggleDevice(device.id)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      <span>{device.name}</span>
                      <Badge variant={device.isOn ? 'default' : 'outline'}>
                        {device.isOn ? 'ON' : 'OFF'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Type:</span>
                        <span className="font-medium capitalize">{device.type}</span>
                      </div>
                      {device.isOn && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Power:</span>
                          <span className="font-medium">{device.power}%</span>
                        </div>
                      )}
                      <Button
                        variant={device.isOn ? 'default' : 'outline'}
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDevice(device.id);
                        }}
                      >
                        {device.isOn ? 'Turn Off' : 'Turn On'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </DeviceCardWrapper>
            ))}
          </div>
        </ConnectionWireContainer>

        {/* Color Legend */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Wire Color Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded bg-blue-500" />
                <span className="text-sm">Fan - Blue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded bg-yellow-500" />
                <span className="text-sm">Light - Yellow</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded bg-green-500" />
                <span className="text-sm">Outlet - Green</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded bg-orange-500" />
                <span className="text-sm">Heater - Orange</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded bg-cyan-500" />
                <span className="text-sm">Humidifier - Cyan</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-1 rounded bg-gray-500" />
                <span className="text-sm">Inactive - Gray</span>
              </div>
            </div>

            <div className="mt-6 space-y-2 text-sm text-muted-foreground">
              <p>• Active devices show colored wires with animated pulses</p>
              <p>• Inactive devices show gray wires with no animation</p>
              <p>• Wires automatically adjust when window is resized</p>
              <p>• Click any device card to toggle its state</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex justify-center gap-4">
          <Button
            variant="outline"
            onClick={() =>
              setDevices((prev) => prev.map((d) => ({ ...d, isOn: true })))
            }
          >
            Turn All On
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setDevices((prev) => prev.map((d) => ({ ...d, isOn: false })))
            }
          >
            Turn All Off
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setDevices((prev) =>
                prev.map((d) => ({ ...d, isOn: Math.random() > 0.5 }))
              )
            }
          >
            Randomize
          </Button>
        </div>
      </div>
    </div>
  );
}
