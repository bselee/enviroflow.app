/**
 * Bulk Connection Test Modal
 *
 * Tests connections for multiple controllers in parallel.
 *
 * Features:
 * - Parallel connection testing with 30s timeout per controller
 * - Real-time progress indicator
 * - Results table with status and response time
 * - Summary statistics
 * - Individual controller diagnostics
 */

import { useState } from 'react'
import { Loader2, XCircle, AlertCircle, Wifi, WifiOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import type { Controller } from '@/types'
import { supabase } from '@/lib/supabase'

// =============================================================================
// Types
// =============================================================================

interface BulkTestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedControllers: Controller[]
  onSuccess?: () => void
}

interface TestResult {
  controllerId: string
  controllerName: string
  success: boolean
  status: 'online' | 'offline' | 'error'
  responseTime?: number
  error?: string
  lastSeen?: string
}

interface TestResponse {
  success: boolean
  results?: TestResult[]
  summary?: {
    total: number
    online: number
    offline: number
    errors: number
  }
  error?: string
}

// =============================================================================
// Component
// =============================================================================

export function BulkTestModal({
  open,
  onOpenChange,
  selectedControllers,
  onSuccess,
}: BulkTestModalProps) {
  const [isTesting, setIsTesting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<TestResult[]>([])
  const [summary, setSummary] = useState<TestResponse['summary'] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setResults([])
      setSummary(null)
      setError(null)
      setProgress(0)
    }
    onOpenChange(newOpen)
  }

  const handleTest = async () => {
    if (!selectedControllers.length) return

    setIsTesting(true)
    setResults([])
    setSummary(null)
    setError(null)
    setProgress(0)

    try {
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setError('You must be logged in to test connections')
        setIsTesting(false)
        return
      }

      const response = await fetch('/api/controllers/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'test_connection',
          controllerIds: selectedControllers.map(c => c.id),
        }),
      })

      const data: TestResponse = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to test connections')
      } else if (data.results && data.summary) {
        setResults(data.results)
        setSummary(data.summary)
        setProgress(100)

        // Call success callback
        onSuccess?.()
      }
    } catch (err) {
      console.error('[BulkTest] Error:', err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
      case 'offline':
        return <WifiOff className="w-4 h-4 text-gray-400" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-destructive" />
    }
  }

  const getStatusBadge = (status: TestResult['status']) => {
    const baseClasses = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
    switch (status) {
      case 'online':
        return <span className={`${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400`}>
          {getStatusIcon(status)} Online
        </span>
      case 'offline':
        return <span className={`${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400`}>
          {getStatusIcon(status)} Offline
        </span>
      case 'error':
        return <span className={`${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400`}>
          {getStatusIcon(status)} Error
        </span>
    }
  }

  const formatResponseTime = (ms?: number) => {
    if (ms === undefined) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const hasResults = results.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Test Connections</DialogTitle>
              <DialogDescription>
                Test connections for {selectedControllers.length} controller{selectedControllers.length !== 1 ? 's' : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress Indicator */}
          {isTesting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Testing connections...</span>
                <span className="font-medium">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Summary Statistics */}
          {summary && (
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 bg-muted rounded-lg text-center">
                <p className="text-2xl font-bold">{summary.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{summary.online}</p>
                <p className="text-xs text-green-700 dark:text-green-400">Online</p>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-400">{summary.offline}</p>
                <p className="text-xs text-gray-700 dark:text-gray-400">Offline</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg text-center">
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">{summary.errors}</p>
                <p className="text-xs text-red-700 dark:text-red-400">Errors</p>
              </div>
            </div>
          )}

          {/* Results Table */}
          {hasResults && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Results</p>
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-3 space-y-2">
                  {results.map((result) => (
                    <div
                      key={result.controllerId}
                      className="p-3 rounded-lg border bg-card space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.controllerName}</p>
                        </div>
                        {getStatusBadge(result.status)}
                      </div>

                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Response Time:</span>
                        <span className="font-mono">{formatResponseTime(result.responseTime)}</span>
                      </div>

                      {result.error && (
                        <Alert variant="destructive" className="py-2">
                          <AlertDescription className="text-xs">
                            {result.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.lastSeen && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>Last Seen:</span>
                          <span className="text-xs">
                            {new Date(result.lastSeen).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 mt-0.5" />
                <AlertDescription>{error}</AlertDescription>
              </div>
            </Alert>
          )}

          {/* Information Alert */}
          {!hasResults && !error && !isTesting && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                This will test connections for {selectedControllers.length} controller{selectedControllers.length !== 1 ? 's' : ''} in parallel.
                Each controller has a 30-second timeout. Results will update controller statuses in the database.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isTesting}
          >
            {hasResults ? 'Close' : 'Cancel'}
          </Button>
          {!hasResults && (
            <Button
              onClick={handleTest}
              disabled={isTesting || selectedControllers.length === 0}
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Test {selectedControllers.length} Connection{selectedControllers.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
