'use client'

/**
 * Local Discovery Panel Component
 *
 * UI for discovering controllers on the local network via mDNS/Bonjour
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Network,
  Wifi,
  WifiOff,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react'
import {
  discoverLocalDevices,
  testDeviceConnection,
  addManualDevice,
  isValidIPAddress,
  formatDeviceDisplay,
  sortLocalDevices,
  type LocalDevice,
  type LocalDiscoveryResult,
} from '@/lib/local-discovery'
import type { ControllerBrand } from '@/types'

interface LocalDiscoveryPanelProps {
  onDeviceSelect?: (device: LocalDevice) => void
  onClose?: () => void
}

export function LocalDiscoveryPanel({
  onDeviceSelect,
  onClose,
}: LocalDiscoveryPanelProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [devices, setDevices] = useState<LocalDevice[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scanDuration, setScanDuration] = useState<number | null>(null)

  // Manual entry state
  const [manualIP, setManualIP] = useState('')
  const [manualPort, setManualPort] = useState('80')
  const [isTestingConnection, setIsTestingConnection] = useState(false)

  // Scan for devices
  const handleScan = async () => {
    setIsScanning(true)
    setError(null)

    try {
      const result: LocalDiscoveryResult = await discoverLocalDevices({
        timeout: 10000,
        includeOffline: false,
      })

      if (result.success) {
        const sortedDevices = sortLocalDevices(result.devices, 'reachable')
        setDevices(sortedDevices)
        setScanDuration(result.scanDuration || null)

        if (result.devices.length === 0) {
          setError('No devices found on the local network. Try manual entry.')
        }
      } else {
        setError(result.error || 'Discovery failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed')
    } finally {
      setIsScanning(false)
    }
  }

  // Test manual connection
  const handleTestConnection = async () => {
    if (!isValidIPAddress(manualIP)) {
      setError('Invalid IP address format')
      return
    }

    const port = parseInt(manualPort, 10)
    if (isNaN(port) || port < 1 || port > 65535) {
      setError('Port must be between 1 and 65535')
      return
    }

    setIsTestingConnection(true)
    setError(null)

    try {
      const result = await testDeviceConnection(manualIP, port)

      if (result.reachable) {
        const device = await addManualDevice(manualIP, port)
        setDevices(prev => [...prev, device])
        setManualIP('')
        setManualPort('80')
      } else {
        setError(result.error || 'Device not reachable')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setIsTestingConnection(false)
    }
  }

  // Select a device
  const handleSelectDevice = (device: LocalDevice) => {
    if (onDeviceSelect) {
      onDeviceSelect(device)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6" />
          Local Network Discovery
        </h2>
        <p className="text-muted-foreground mt-1">
          Find controllers on your local network without cloud APIs
        </p>
      </div>

      {/* Network Scan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Network Scan
          </CardTitle>
          <CardDescription>
            Scan your local network for compatible devices using mDNS/Bonjour
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full"
          >
            {isScanning ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Scan Network
              </>
            )}
          </Button>

          {scanDuration && (
            <p className="text-sm text-muted-foreground text-center">
              Scan completed in {(scanDuration / 1000).toFixed(1)}s
            </p>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Manual Entry
          </CardTitle>
          <CardDescription>
            Enter a device IP address manually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="manual-ip">IP Address</Label>
              <Input
                id="manual-ip"
                type="text"
                placeholder="192.168.1.100"
                value={manualIP}
                onChange={(e) => setManualIP(e.target.value)}
                disabled={isTestingConnection}
              />
            </div>
            <div>
              <Label htmlFor="manual-port">Port</Label>
              <Input
                id="manual-port"
                type="number"
                placeholder="80"
                value={manualPort}
                onChange={(e) => setManualPort(e.target.value)}
                disabled={isTestingConnection}
                min={1}
                max={65535}
              />
            </div>
          </div>

          <Button
            onClick={handleTestConnection}
            disabled={isTestingConnection || !manualIP}
            className="w-full"
            variant="outline"
          >
            {isTestingConnection ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Device
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Discovered Devices */}
      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Discovered Devices ({devices.length})
            </CardTitle>
            <CardDescription>
              Click a device to add it to EnviroFlow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {devices.map((device, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectDevice(device)}
                  className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {device.isReachable ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium">
                          {formatDeviceDisplay(device)}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        {device.hostname && (
                          <div>Hostname: {device.hostname}</div>
                        )}
                        {device.port && (
                          <div>Port: {device.port}</div>
                        )}
                        {device.brand && (
                          <div>Brand: {device.brand}</div>
                        )}
                        {device.responseTime && (
                          <div>Response: {device.responseTime}ms</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {device.isReachable ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="mr-1 h-3 w-3" />
                          Offline
                        </Badge>
                      )}

                      <Badge variant="outline">
                        {device.discoveryMethod}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <p className="font-medium">Privacy Note</p>
              <p>
                Local network discovery happens entirely on your network.
                No data is sent to EnviroFlow servers or third parties.
              </p>
              <p className="mt-2">
                If automatic discovery doesn&apos;t find your device, use manual
                entry to add it by IP address.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      {onClose && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      )}
    </div>
  )
}
