/**
 * Help System Demo Page
 *
 * This page showcases all help tooltips and demonstrates the contextual help system.
 * Can be accessed at /help-demo for testing purposes.
 */

"use client";

import { HelpTooltip, InlineHelp } from "@/components/ui/HelpTooltip";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function HelpDemoPage() {
  return (
    <div className="container max-w-4xl py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Help Tooltip System Demo</h1>
        <p className="text-muted-foreground">
          This page demonstrates the contextual help tooltips throughout EnviroFlow.
        </p>
      </div>

      {/* Controller Setup Section */}
      <Card>
        <CardHeader>
          <CardTitle>Controller Setup</CardTitle>
          <CardDescription>
            Form fields with contextual help tooltips
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="controller-name" className="flex items-center">
              Controller Name
              <HelpTooltip id="controller-name" />
            </Label>
            <Input
              id="controller-name"
              placeholder="My AC Infinity Controller"
            />
            <InlineHelp>
              Give your controller a descriptive name for easy identification.
            </InlineHelp>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center">
              Account Email
              <HelpTooltip id="controller-email" />
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="flex items-center">
              Account Password
              <HelpTooltip id="controller-password" />
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
            />
          </div>
        </CardContent>
      </Card>

      {/* Room Management Section */}
      <Card>
        <CardHeader>
          <CardTitle>Room Management</CardTitle>
          <CardDescription>
            Organize controllers by physical location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room-name" className="flex items-center">
              Room Name
              <HelpTooltip id="room-name" />
            </Label>
            <Input
              id="room-name"
              placeholder="e.g., Veg Room A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="room-assignment" className="flex items-center">
              Assign to Room
              <HelpTooltip id="room-assignment" />
            </Label>
            <Select>
              <SelectTrigger id="room-assignment">
                <SelectValue placeholder="Select a room" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No room</SelectItem>
                <SelectItem value="room1">Veg Room A</SelectItem>
                <SelectItem value="room2">Flower Tent 1</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sensors & Devices Section */}
      <Card>
        <CardHeader>
          <CardTitle>Sensors & Devices</CardTitle>
          <CardDescription>
            Configure sensor types and device ports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sensor-type" className="flex items-center">
              Sensor Type
              <HelpTooltip id="sensor-type" />
            </Label>
            <Select>
              <SelectTrigger id="sensor-type">
                <SelectValue placeholder="Select sensor type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temperature">Temperature</SelectItem>
                <SelectItem value="humidity">Humidity</SelectItem>
                <SelectItem value="vpd">VPD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-port" className="flex items-center">
              Device Port
              <HelpTooltip id="device-port" />
            </Label>
            <Select>
              <SelectTrigger id="device-port">
                <SelectValue placeholder="Select port" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Port 1</SelectItem>
                <SelectItem value="2">Port 2</SelectItem>
                <SelectItem value="3">Port 3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-type" className="flex items-center">
              Device Type
              <HelpTooltip id="device-type" />
            </Label>
            <Select>
              <SelectTrigger id="device-type">
                <SelectValue placeholder="Select device type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fan">Fan</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="outlet">Outlet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Automation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Workflow Automation</CardTitle>
          <CardDescription>
            Create intelligent automation rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center">
              Workflow Trigger
              <HelpTooltip id="workflow-trigger" />
            </Label>
            <p className="text-sm text-muted-foreground">
              Define when your automation should run
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center">
              Workflow Action
              <HelpTooltip id="workflow-action" />
            </Label>
            <p className="text-sm text-muted-foreground">
              Specify what happens when triggered
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center">
              Workflow Condition
              <HelpTooltip id="workflow-condition" />
            </Label>
            <p className="text-sm text-muted-foreground">
              Add extra requirements before execution
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Features Section */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Features</CardTitle>
          <CardDescription>
            Explore additional capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              CSV Upload
            </Button>
            <HelpTooltip id="csv-upload" variant="inline" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Network Discovery
            </Button>
            <HelpTooltip id="network-discovery" variant="inline" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              AI Insights
            </Button>
            <HelpTooltip id="ai-insights" variant="inline" />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              VPD Calculation
            </Button>
            <HelpTooltip id="vpd-calculation" variant="inline" />
          </div>
        </CardContent>
      </Card>

      {/* Tooltip Variants */}
      <Card>
        <CardHeader>
          <CardTitle>Tooltip Variants</CardTitle>
          <CardDescription>
            Different display styles for help content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm">Icon variant:</span>
            <HelpTooltip id="controller-name" variant="icon" />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">Text variant:</span>
            <HelpTooltip id="controller-name" variant="text" />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">Inline variant:</span>
            <HelpTooltip id="controller-name" variant="inline" />
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm">Different sizes:</span>
            <HelpTooltip id="controller-name" size="sm" />
            <HelpTooltip id="controller-name" size="md" />
            <HelpTooltip id="controller-name" size="lg" />
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted rounded-lg p-4 text-sm">
        <p className="font-medium mb-2">How to use:</p>
        <ul className="space-y-1 list-disc list-inside text-muted-foreground">
          <li>Hover over any help icon to see a quick tooltip</li>
          <li>Click the help icon to open a detailed modal with more information</li>
          <li>Use Tab key to navigate between help icons</li>
          <li>Press Enter or Space to open the help modal when focused</li>
          <li>Press Escape to close any open modals</li>
        </ul>
      </div>
    </div>
  );
}
