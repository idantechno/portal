import { notificationsApi } from "../api/notifications";

/**
 * Web Push opt-in for the installed PWA. Kept deliberately small: the SW handles
 * display (see public/sw.js), the backend stores subscriptions + sends. On iOS
 * this only works when the app is launched from the Home Screen (iOS 16.4+).
 */

export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Running as an installed PWA (standalone), not a regular browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari exposes this legacy flag on navigator.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function pushPermission(): NotificationPermission {
  return isPushSupported() ? Notification.permission : "denied";
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Ask permission, subscribe this device, and register it with the backend.
 * Returns "subscribed", "denied", or "unavailable" (no support / no VAPID key).
 * Must be called from a user gesture (a button tap) — required on iOS.
 */
export async function enablePush(
  businessId: string,
): Promise<"subscribed" | "denied" | "unavailable"> {
  if (!isPushSupported()) return "unavailable";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const publicKey = await notificationsApi.vapidPublicKey(businessId);
  if (!publicKey) return "unavailable"; // push disabled server-side

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast: the key is ArrayBuffer-backed; the DOM lib's BufferSource type is
      // stricter than the inferred Uint8Array<ArrayBufferLike>.
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const json = sub.toJSON();
  await notificationsApi.subscribePush(businessId, {
    endpoint: sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
    userAgent: navigator.userAgent,
  });
  return "subscribed";
}

/** Whether this device already has an active push subscription. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  return (await reg.pushManager.getSubscription()) !== null;
}
