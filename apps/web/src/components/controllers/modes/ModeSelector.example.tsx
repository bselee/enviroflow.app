"use client";

import * as React from "react";
import { ModeSelector } from "./ModeSelector";
import type { DeviceMode } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/**
 * Example usage of the ModeSelector component
 * Demonstrates all size variants and interactive features
 */
export function ModeSelectorExample() {
  const [mode, setMode] = React.useState<DeviceMode>("auto");
  const [temperature, setTemperature] = React.useState(72);
  const [humidity, setHumidity] = React.useState(55);
  const [vpd, setVpd] = React.useState(1.2);
  const [showSensors, setShowSensors] = React.useState(true);
  const [disabled, setDisabled] = React.useState(false);
  const [size, setSize] = React.useState<"sm" | "md" | "lg">("md");

  const handleModeChange = (newMode: DeviceMode) => {
    setMode(newMode);
    console.log("Mode changed to:", newMode);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Mode Selector Component</h1>
          <p className="text-muted-foreground">
            Circular mode selector for AC Infinity controller programming
          </p>
        </div>

        {/* Interactive Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Interactive Demo</CardTitle>
            <CardDescription>
              Try selecting different modes and adjusting the sensor values
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Mode Selector */}
              <div className="flex items-center justify-center min-h-[400px]">
                <ModeSelector
                  currentMode={mode}
                  onModeChange={handleModeChange}
                  temperature={showSensors ? temperature : undefined}
                  humidity={showSensors ? humidity : undefined}
                  vpd={showSensors ? vpd : undefined}
                  disabled={disabled}
                  size={size}
                  temperatureUnit="°F"
                />
              </div>

              {/* Controls */}
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-semibold mb-4 block">
                    Current Mode
                  </Label>
                  <div className="text-2xl font-bold text-primary capitalize">
                    {mode}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-sensors">Show Sensor Data</Label>
                    <Switch
                      id="show-sensors"
                      checked={showSensors}
                      onCheckedChange={setShowSensors}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="disabled">Disabled</Label>
                    <Switch
                      id="disabled"
                      checked={disabled}
                      onCheckedChange={setDisabled}
                    />
                  </div>
                </div>

                {showSensors && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Temperature</Label>
                        <span className="text-sm font-medium">{temperature}°F</span>
                      </div>
                      <Slider
                        value={[temperature]}
                        onValueChange={([val]) => setTemperature(val)}
                        min={40}
                        max={100}
                        step={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Humidity</Label>
                        <span className="text-sm font-medium">{humidity}%</span>
                      </div>
                      <Slider
                        value={[humidity]}
                        onValueChange={([val]) => setHumidity(val)}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>VPD</Label>
                        <span className="text-sm font-medium">{vpd.toFixed(2)} kPa</span>
                      </div>
                      <Slider
                        value={[vpd * 100]}
                        onValueChange={([val]) => setVpd(val / 100)}
                        min={0}
                        max={300}
                        step={1}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-4 border-t">
                  <Label>Size</Label>
                  <div className="flex gap-2">
                    {(["sm", "md", "lg"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSize(s)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          size === s
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Size Variants */}
        <Card>
          <CardHeader>
            <CardTitle>Size Variants</CardTitle>
            <CardDescription>
              Three size options: small (192px), medium (288px), and large (384px)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Small</h3>
                <ModeSelector
                  currentMode="off"
                  onModeChange={handleModeChange}
                  temperature={72}
                  humidity={55}
                  size="sm"
                />
              </div>

              <div className="flex flex-col items-center gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Medium</h3>
                <ModeSelector
                  currentMode="auto"
                  onModeChange={handleModeChange}
                  temperature={72}
                  humidity={55}
                  vpd={1.2}
                  size="md"
                />
              </div>

              <div className="flex flex-col items-center gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Large</h3>
                <ModeSelector
                  currentMode="schedule"
                  onModeChange={handleModeChange}
                  temperature={72}
                  humidity={55}
                  vpd={1.2}
                  size="lg"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All Modes */}
        <Card>
          <CardHeader>
            <CardTitle>All Mode States</CardTitle>
            <CardDescription>
              Each mode has its own color, icon, and description
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
              {(
                ["off", "on", "auto", "vpd", "timer", "cycle", "schedule"] as DeviceMode[]
              ).map((m) => (
                <div key={m} className="flex flex-col items-center gap-4">
                  <ModeSelector
                    currentMode={m}
                    onModeChange={handleModeChange}
                    temperature={72}
                    humidity={55}
                    size="sm"
                  />
                  <div className="text-center">
                    <p className="text-sm font-medium capitalize">{m}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Usage Example */}
        <Card>
          <CardHeader>
            <CardTitle>Usage Example</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{`import { ModeSelector } from "@/components/controllers/modes";

function MyComponent() {
  const [mode, setMode] = useState<DeviceMode>("auto");

  return (
    <ModeSelector
      currentMode={mode}
      onModeChange={setMode}
      temperature={72}
      humidity={55}
      vpd={1.2}
      size="md"
      temperatureUnit="°F"
    />
  );
}`}</code>
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
