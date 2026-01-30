/**
 * Example Usage of Auth Token Refresh Utilities
 *
 * This file demonstrates how to use the new auth refresh utilities
 * to handle JWT token expiration gracefully.
 */

import { authenticatedFetch, getValidAccessToken, AuthTokenError } from './auth-refresh';

// ============================================================================
// EXAMPLE 1: Simple GET request with automatic token refresh
// ============================================================================

export async function fetchControllers() {
  try {
    const response = await authenticatedFetch('/api/controllers', {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch controllers: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (error instanceof AuthTokenError) {
      // Session expired - redirect to login
      window.location.href = '/login';
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// EXAMPLE 2: POST request with body
// ============================================================================

export async function addController(controllerData: Record<string, unknown>) {
  try {
    const response = await authenticatedFetch('/api/controllers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(controllerData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add controller');
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// EXAMPLE 3: Using getValidAccessToken for custom scenarios
// ============================================================================

export async function uploadFile(file: File) {
  try {
    // Get a valid token (will refresh if needed)
    const token = await getValidAccessToken();

    if (!token) {
      throw new AuthTokenError('No valid access token');
    }

    // Use FormData for file upload
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // Don't set Content-Type - browser will set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

// ============================================================================
// EXAMPLE 4: React Hook using authenticatedFetch
// ============================================================================

import { useState, useCallback } from 'react';

interface UseApiOptions {
  onError?: (error: string) => void;
  onAuthError?: () => void;
}

export function useApi<T>(options?: UseApiOptions) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(
    async (url: string, init?: RequestInit): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await authenticatedFetch(url, init);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Request failed');
        }

        const data = await response.json();
        setLoading(false);
        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error';

        setError(errorMessage);
        setLoading(false);

        // Handle auth errors
        if (err instanceof AuthTokenError) {
          options?.onAuthError?.();
        } else {
          options?.onError?.(errorMessage);
        }

        return null;
      }
    },
    [options]
  );

  return { apiCall, loading, error };
}

// Usage in a component:
/**
 * function ControllerList() {
 *   const { apiCall, loading, error } = useApi({
 *     onAuthError: () => router.push('/login'),
 *     onError: (err) => toast.error(err),
 *   });
 *
 *   useEffect(() => {
 *     apiCall('/api/controllers').then((data) => {
 *       if (data) setControllers(data.controllers);
 *     });
 *   }, [apiCall]);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error} />;
 *   return <ControllerGrid controllers={controllers} />;
 * }
 */

// ============================================================================
// EXAMPLE 5: Migrating existing code
// ============================================================================

// BEFORE (old way - doesn't handle token refresh):
import { createClient } from './supabase';

async function fetchDataOldWay() {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/data', {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  return response.json();
}

// AFTER (new way - handles token refresh automatically):
async function fetchDataNewWay() {
  const response = await authenticatedFetch('/api/data');

  if (!response.ok) {
    throw new Error('Request failed');
  }

  return response.json();
}

// ============================================================================
// EXAMPLE 6: Parallel requests with authentication
// ============================================================================

export async function fetchDashboardData() {
  try {
    // All requests will use the same refreshed token
    const [controllersRes, roomsRes, workflowsRes] = await Promise.all([
      authenticatedFetch('/api/controllers'),
      authenticatedFetch('/api/rooms'),
      authenticatedFetch('/api/workflows'),
    ]);

    const [controllers, rooms, workflows] = await Promise.all([
      controllersRes.json(),
      roomsRes.json(),
      workflowsRes.json(),
    ]);

    return { success: true, data: { controllers, rooms, workflows } };
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return { success: false, error: 'Session expired' };
    }

    return { success: false, error: 'Failed to load dashboard data' };
  }
}

// ============================================================================
// EXAMPLE 7: Handling specific HTTP status codes
// ============================================================================

export async function deleteController(id: string) {
  try {
    const response = await authenticatedFetch(`/api/controllers/${id}`, {
      method: 'DELETE',
    });

    // Handle specific status codes
    if (response.status === 404) {
      return { success: false, error: 'Controller not found' };
    }

    if (response.status === 409) {
      return {
        success: false,
        error: 'Controller is in use by active workflows',
      };
    }

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    return { success: true };
  } catch (error) {
    if (error instanceof AuthTokenError) {
      return { success: false, error: 'Session expired' };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}
