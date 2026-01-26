/**
 * EnviroFlow Service Worker
 *
 * Handles push notifications for the EnviroFlow application.
 * This service worker receives push events and displays notifications.
 *
 * Features:
 * - Push notification handling
 * - Notification click handling (opens app)
 * - Notification action button support
 * - Offline caching (future enhancement)
 *
 * @version 1.0.0
 */

// Service Worker Version - update when making changes
// BUMP THIS VERSION TO FORCE CACHE CLEAR
const SW_VERSION = "2.1.0";

// Default notification options
const DEFAULT_NOTIFICATION_OPTIONS = {
  icon: "/icons/icon-192x192.png",
  badge: "/icons/badge-72x72.png",
  vibrate: [100, 50, 100],
  requireInteraction: false,
};

// Default URL to open when notification is clicked
const DEFAULT_URL = "/dashboard";

/**
 * Service Worker Installation
 * Called when the service worker is first installed
 */
self.addEventListener("install", (event) => {
  console.log(`[SW ${SW_VERSION}] Installing service worker...`);

  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Service Worker Activation
 * Called when the service worker becomes active
 */
self.addEventListener("activate", (event) => {
  console.log(`[SW ${SW_VERSION}] Service worker activated`);

  // Clear ALL caches and claim clients
  event.waitUntil(
    Promise.all([
      // Clear all caches to force fresh fetch
      caches.keys().then((cacheNames) => {
        console.log(`[SW ${SW_VERSION}] Clearing ${cacheNames.length} caches`);
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log(`[SW ${SW_VERSION}] Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }),
      // Claim all clients immediately
      clients.claim(),
    ])
  );
});

/**
 * Push Event Handler
 * Receives push notifications from the server and displays them
 */
self.addEventListener("push", (event) => {
  console.log(`[SW ${SW_VERSION}] Push event received`);

  if (!event.data) {
    console.warn("[SW] Push event has no data");
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (error) {
    // If not JSON, try to use as text
    const text = event.data.text();
    payload = {
      title: "EnviroFlow",
      body: text,
    };
  }

  // Extract notification details with defaults
  const title = payload.title || "EnviroFlow Notification";
  const options = {
    body: payload.body || "",
    icon: payload.icon || DEFAULT_NOTIFICATION_OPTIONS.icon,
    badge: payload.badge || DEFAULT_NOTIFICATION_OPTIONS.badge,
    vibrate: payload.vibrate || DEFAULT_NOTIFICATION_OPTIONS.vibrate,
    tag: payload.tag || `enviroflow-${Date.now()}`,
    requireInteraction:
      payload.requireInteraction !== undefined
        ? payload.requireInteraction
        : DEFAULT_NOTIFICATION_OPTIONS.requireInteraction,
    data: {
      url: payload.data?.url || DEFAULT_URL,
      type: payload.data?.type || "general",
      ...payload.data,
    },
    actions: payload.actions || [],
    silent: payload.silent || false,
  };

  // Add timestamp to data for tracking
  options.data.receivedAt = new Date().toISOString();

  // Show the notification
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      console.log(`[SW ${SW_VERSION}] Notification displayed:`, title);
    })
  );
});

/**
 * Notification Click Handler
 * Opens the app when a notification is clicked
 */
self.addEventListener("notificationclick", (event) => {
  console.log(`[SW ${SW_VERSION}] Notification clicked:`, event.notification.tag);

  // Close the notification
  event.notification.close();

  // Get the URL to open
  const url = event.notification.data?.url || DEFAULT_URL;
  const action = event.action;

  // Handle action buttons
  let targetUrl = url;
  if (action) {
    console.log(`[SW ${SW_VERSION}] Action clicked:`, action);

    // Map actions to URLs
    switch (action) {
      case "view":
        // Default action - use the notification URL
        break;
      case "dismiss":
        // Just close, don't open anything
        return;
      case "settings":
        targetUrl = "/settings";
        break;
      case "dashboard":
        targetUrl = "/dashboard";
        break;
      case "workflows":
        targetUrl = "/automations";
        break;
      default:
        // For custom actions, check if URL is in action data
        if (event.notification.data?.actions?.[action]?.url) {
          targetUrl = event.notification.data.actions[action].url;
        }
    }
  }

  // Focus existing window or open new one
  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            // Navigate existing window
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        // No window open, open a new one
        return clients.openWindow(targetUrl);
      })
  );
});

/**
 * Notification Close Handler
 * Called when a notification is dismissed (swiped away)
 */
self.addEventListener("notificationclose", (event) => {
  console.log(`[SW ${SW_VERSION}] Notification closed:`, event.notification.tag);

  // Track notification dismissal for analytics (optional)
  const data = event.notification.data;
  if (data?.type === "workflow") {
    // Could send analytics event here
    console.log(`[SW ${SW_VERSION}] Workflow notification dismissed:`, data.workflowName);
  }
});

/**
 * Push Subscription Change Handler
 * Called when the push subscription changes (e.g., token refresh)
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log(`[SW ${SW_VERSION}] Push subscription changed`);

  event.waitUntil(
    // Re-subscribe and update the server
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
      })
      .then((newSubscription) => {
        console.log(`[SW ${SW_VERSION}] New subscription obtained`);

        // Send new subscription to server
        return fetch("/api/push-tokens", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: JSON.stringify(newSubscription),
            type: "web_push",
            device_name: "Browser (auto-renewed)",
          }),
        });
      })
      .catch((error) => {
        console.error(`[SW ${SW_VERSION}] Failed to re-subscribe:`, error);
      })
  );
});

/**
 * Message Handler
 * Receives messages from the main application
 */
self.addEventListener("message", (event) => {
  console.log(`[SW ${SW_VERSION}] Message received:`, event.data);

  if (event.data && event.data.type) {
    switch (event.data.type) {
      case "SKIP_WAITING":
        // Force the waiting service worker to become active
        self.skipWaiting();
        break;

      case "GET_VERSION":
        // Reply with current version
        event.ports[0].postMessage({ version: SW_VERSION });
        break;

      case "CLEAR_CACHE":
        // Clear all caches (future enhancement)
        event.waitUntil(
          caches.keys().then((names) => {
            return Promise.all(names.map((name) => caches.delete(name)));
          })
        );
        break;

      case "TEST_NOTIFICATION":
        // Show a test notification
        self.registration.showNotification("Test Notification", {
          body: "This is a test notification from EnviroFlow",
          icon: DEFAULT_NOTIFICATION_OPTIONS.icon,
          badge: DEFAULT_NOTIFICATION_OPTIONS.badge,
          tag: "test-notification",
          data: { url: "/settings" },
        });
        break;

      default:
        console.log(`[SW ${SW_VERSION}] Unknown message type:`, event.data.type);
    }
  }
});

/**
 * Fetch Handler (for future offline support)
 * Currently just passes through all requests with cache bypass
 */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // For Next.js static assets, always fetch fresh from network
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
    );
    return;
  }

  // For HTML pages, fetch fresh with revalidation
  if (event.request.mode === 'navigate' ||
      event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
    );
    return;
  }

  // For other requests, just pass through
  event.respondWith(fetch(event.request));
});

// Log that the service worker has loaded
console.log(`[SW ${SW_VERSION}] Service worker loaded`);
