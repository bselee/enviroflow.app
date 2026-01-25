/**
 * Credential Update Modal Component
 *
 * Allows users to update credentials for offline controllers and revalidate connections.
 *
 * Features:
 * - Shows masked current credentials
 * - Form to re-enter credentials
 * - Re-tests connection on submit
 * - Shows success/error with guidance
 * - Updates encrypted credentials + resets status to 'online' on success
 * - Audit log entry for security
 * - Rate limiting: max 5 attempts per hour per controller
 */

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Loader2, CheckCircle, XCircle, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Controller, ControllerBrand } from '@/types'

// ============================================
// Types
// ============================================

interface CredentialUpdateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  controller: Controller | null
  onSuccess?: () => void
}

interface CredentialFormData {
  email: string
  password: string
}

interface UpdateResult {
  success: boolean
  error?: string
  message?: string
  remainingAttempts?: number
}

// ============================================
// Credential Fields by Brand
// ============================================

function getCredentialFields(brand: ControllerBrand): { name: keyof CredentialFormData; label: string; type: string; placeholder: string }[] {
  switch (brand) {
    case 'ac_infinity':
    case 'inkbird':
      return [
        { name: 'email', label: 'Email', type: 'email', placeholder: 'your-email@example.com' },
        { name: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password' }
      ]
    default:
      return []
  }
}

function getBrandName(brand: ControllerBrand): string {
  switch (brand) {
    case 'ac_infinity':
      return 'AC Infinity'
    case 'inkbird':
      return 'Inkbird'
    case 'csv_upload':
      return 'CSV Upload'
    case 'mqtt':
      return 'MQTT'
    case 'ecowitt':
      return 'Ecowitt'
    case 'govee':
      return 'Govee'
    default:
      return brand
  }
}

function getErrorGuidance(brand: ControllerBrand, error?: string): string {
  const lowercaseError = error?.toLowerCase() || ''

  // Generic guidance based on error message
  if (lowercaseError.includes('rate limit') || lowercaseError.includes('too many')) {
    return 'Too many attempts. Please wait an hour before trying again.'
  }

  if (lowercaseError.includes('invalid') || lowercaseError.includes('incorrect') || lowercaseError.includes('authentication')) {
    return 'The email or password is incorrect. Please verify your credentials and try again.'
  }

  if (lowercaseError.includes('network') || lowercaseError.includes('timeout')) {
    return 'Network error. Check your internet connection and try again.'
  }

  // Brand-specific guidance
  if (brand === 'ac_infinity') {
    return 'Ensure you are using the same credentials as the AC Infinity mobile app. If you recently changed your password, update it here.'
  }

  if (brand === 'inkbird') {
    return 'Verify your Inkbird account credentials. Make sure the device is powered on and connected to WiFi.'
  }

  return 'Please check your credentials and ensure the device is powered on and connected.'
}

// ============================================
// Component
// ============================================

export function CredentialUpdateModal({
  open,
  onOpenChange,
  controller,
  onSuccess,
}: CredentialUpdateModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<UpdateResult | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CredentialFormData>()

  // Reset form and result when dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset()
      setResult(null)
      setShowPassword(false)
    }
    onOpenChange(newOpen)
  }

  const onSubmit = async (data: CredentialFormData) => {
    if (!controller) return

    setIsSubmitting(true)
    setResult(null)

    try {
      const response = await fetch(`/api/controllers/${controller.id}/credentials`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      })

      const responseData = await response.json()

      if (response.status === 429) {
        // Rate limited
        setResult({
          success: false,
          error: responseData.error || 'Too many attempts. Please try again later.',
          remainingAttempts: 0,
        })
      } else if (!response.ok) {
        // Error
        setResult({
          success: false,
          error: responseData.error || responseData.details || 'Failed to update credentials',
        })
      } else {
        // Success
        setResult({
          success: true,
          message: responseData.message || 'Credentials updated successfully',
        })

        // Call success callback after short delay to show success message
        setTimeout(() => {
          onSuccess?.()
          handleOpenChange(false)
        }, 1500)
      }
    } catch (error) {
      console.error('[CredentialUpdate] Error:', error)
      setResult({
        success: false,
        error: 'Network error. Please check your connection and try again.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!controller) return null

  const brandName = getBrandName(controller.brand)
  const credentialFields = getCredentialFields(controller.brand)

  // Don't show modal for brands that don't require credentials
  if (credentialFields.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Update Credentials</DialogTitle>
              <DialogDescription>
                Update credentials for {controller.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Controller Info */}
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Controller:</span>
              <span className="font-medium">{controller.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Brand:</span>
              <span className="font-medium">{brandName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium text-destructive capitalize">{controller.status}</span>
            </div>
          </div>

          {/* Information Alert */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Enter your {brandName} account credentials to revalidate the connection.
              This will test the connection and update the stored credentials if successful.
            </AlertDescription>
          </Alert>

          {/* Credential Form Fields */}
          <div className="space-y-3">
            {credentialFields.map((field) => (
              <div key={field.name} className="space-y-2">
                <Label htmlFor={field.name}>{field.label}</Label>
                {field.type === 'password' ? (
                  <div className="relative">
                    <Input
                      id={field.name}
                      type={showPassword ? "text" : "password"}
                      placeholder={field.placeholder}
                      {...register(field.name, {
                        required: `${field.label} is required`,
                      })}
                      disabled={isSubmitting}
                      autoComplete="current-password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                ) : (
                  <Input
                    id={field.name}
                    type={field.type}
                    placeholder={field.placeholder}
                    {...register(field.name, {
                      required: `${field.label} is required`,
                      ...(field.type === 'email' && {
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: 'Invalid email format',
                        },
                      }),
                    })}
                    disabled={isSubmitting}
                    autoComplete={field.type === 'password' ? 'current-password' : 'email'}
                  />
                )}
                {errors[field.name] && (
                  <p className="text-sm text-destructive">{errors[field.name]?.message}</p>
                )}
              </div>
            ))}
          </div>

          {/* Result Display */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              <div className="flex items-start gap-2">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <AlertDescription className="font-medium">
                    {result.success ? result.message : result.error}
                  </AlertDescription>
                  {!result.success && (
                    <AlertDescription className="text-sm opacity-90">
                      {getErrorGuidance(controller.brand, result.error)}
                    </AlertDescription>
                  )}
                  {result.remainingAttempts !== undefined && result.remainingAttempts === 0 && (
                    <AlertDescription className="text-sm opacity-90">
                      Rate limit reached. You can try again in 1 hour.
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || (result?.success === true)}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : result?.success ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Success
                </>
              ) : (
                'Update & Verify'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
