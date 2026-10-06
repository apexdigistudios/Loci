export type NotificationPermissionResult = NotificationPermission | "unsupported";

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;

  try {
    return await Notification.requestPermission();
  } catch (error) {
    console.error("Notification permission request failed:", error);
    return Notification.permission;
  }
}

export async function showLocalNotification(title: string, options: NotificationOptions = {}) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return false;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
    return true;
  } catch (error) {
    console.error("Could not display local notification:", error);
    return false;
  }
}
